import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIService } from './services/openai.service';
import { ConversationService } from './services/conversation.service';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService, CreatePaymentDto } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CanalVenda, PedidoStatus, Pedido } from '../../database/entities/Pedido.entity';
import { MetodoPagamento } from '../../database/entities/Pagamento.entity';
import { TypedConversation, ProductSearchResult, toTypedConversation, ConversationState, CustomerData, PendingOrder, PendingOrderItem, StockAdjustmentContext } from './types/whatsapp.types';
import { ProductWithStock } from '../products/types/product.types';
import * as crypto from 'crypto';
import { CouponsService } from '../coupons/coupons.service';

export interface WhatsappMessage {
  from: string;
  body: string;
  timestamp: string;
  tenantId?: string;
}

export interface ProductInfo {
  name: string;
  price: number;
  stock: number;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  // ⚠️ REMOVIDO: DEFAULT_TENANT_ID hardcoded - deve vir do JWT ou contexto
  private readonly HORARIO_FUNCIONAMENTO = 'Segunda a Sábado: 8h às 18h\nDomingo: 9h às 13h';
  
  // ✅ NOVO: Limites de validação
  private readonly MAX_MESSAGE_LENGTH = 1000;
  private readonly MAX_NAME_LENGTH = 100;
  private readonly MIN_NAME_LENGTH = 3;
  private readonly MAX_ADDRESS_LENGTH = 500;
  private readonly MIN_ADDRESS_LENGTH = 10;
  private readonly MAX_NOTES_LENGTH = 500;
  private readonly MAX_QUANTITY = 1000;
  private readonly MIN_QUANTITY = 1;
  private readonly MAX_PRICE = 1000000; // R$ 1.000.000,00
  // frete simples (dev/whatsapp) - configurável via env WHATSAPP_DEFAULT_SHIPPING_AMOUNT (fallback 10)

  constructor(
    private config: ConfigService,
    private openAIService: OpenAIService,
    private conversationService: ConversationService,
    private productsService: ProductsService,
    private ordersService: OrdersService,
    private paymentsService: PaymentsService,
    private couponsService: CouponsService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * ✅ IDEMPOTÊNCIA (WhatsApp):
   * Evita criação duplicada de pedido quando o cliente manda "sim" mais de uma vez
   * ou quando há reentrega de webhook.
   */
  private buildWhatsAppOrderIdempotencyKey(
    conversation: TypedConversation,
    pendingOrder: PendingOrder,
    customerData?: CustomerData,
  ): string {
    const attemptId = conversation.context?.order_attempt_id || conversation.id;
    const stablePayload = {
      order_attempt_id: attemptId,
      conversation_id: conversation.id,
      customer_phone: conversation.customer_phone,
      tenant_id: conversation.tenant_id,
      pending_order: pendingOrder,
      customer_data: {
        name: customerData?.name || null,
        phone: customerData?.phone || null,
        delivery_type: customerData?.delivery_type || null,
        address: customerData?.address || null,
      },
    };

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(stablePayload))
      .digest('hex');

    return `wa:${conversation.id}:create_order:${hash}`;
  }

  /**
   * ✅ NOVO: Sanitiza entrada do usuário para prevenir XSS e injeção
   */
  private sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Limitar tamanho
    let sanitized = input.substring(0, this.MAX_MESSAGE_LENGTH);

    // Remover HTML/JavaScript
    sanitized = sanitized
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');

    // Escapar caracteres especiais perigosos
    sanitized = sanitized
      .replace(/[<>]/g, '')
      .replace(/['"]/g, '');

    return sanitized.trim();
  }

  private getDefaultShippingAmount(): number {
    const raw = (this.config.get<string>('WHATSAPP_DEFAULT_SHIPPING_AMOUNT') || '').trim();
    if (!raw) return 10;
    const parsed = Number(raw.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    return 10;
  }

  private getPhonePrompt(): string {
    return `📱 *Para finalizar, preciso do seu telefone de contato:*\n` +
      `Exemplo: (11) 98765-4321 ou 11987654321`;
  }

  private getNotesPrompt(): string {
    return `📝 *Quer deixar alguma observação?*\n` +
      `Ex.: "Sem açúcar", "Entregar na portaria"\n\n` +
      `💬 Se não tiver, digite *"sem"*.`;
  }

  private formatCurrency(value: number): string {
    return Number(value || 0).toFixed(2).replace('.', ',');
  }

  private parseCurrencyAmount(raw: string): number | null {
    const text = (raw || '').trim();
    if (!text) return null;
    const match = text.match(/(\d+(?:[.,]\d{1,2})?)/);
    if (!match) return null;
    const parsed = Number(match[1].replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Number(parsed.toFixed(2));
  }

  private extractCouponCode(message: string): string | null {
    const text = (message || '').trim();
    if (!text) return null;
    const m = text.match(/^(?:cupom|coupon|usar\s+cupom|aplicar\s+cupom|aplicar)\s+([A-Za-z0-9_-]{2,50})\s*$/i);
    if (!m) return null;
    return (m[1] || '').trim().toUpperCase();
  }

  private extractStandaloneCouponCode(message: string): string | null {
    const text = (message || '').trim();
    if (!text) return null;
    if (!/^[A-Za-z0-9_-]{2,50}$/.test(text)) return null;
    const upper = text.toUpperCase();
    const reserved = new Set([
      'SIM',
      'NAO',
      'OK',
      'CANCELAR',
      'PIX',
      'CARTAO',
      'CREDITO',
      'DEBITO',
      'DINHEIRO',
      'RETIRADA',
      'ENTREGA',
      'CUPOM',
      'COUPON',
    ]);
    if (reserved.has(upper)) return null;
    return upper;
  }

  private extractOrderNo(message: string): string | null {
    const m = (message || '').toUpperCase().match(/\bPED-\d{8}-\d{3}\b/);
    return m ? m[0] : null;
  }

  private isCancelIntent(lowerMessage: string): boolean {
    const lm = (lowerMessage || '').trim();
    if (!lm) return false;
    return (
      lm.includes('cancelar') ||
      lm.includes('cancelamento') ||
      lm.includes('desistir') ||
      lm.includes('anular')
    );
  }

  private isReopenIntent(lowerMessage: string): boolean {
    const lm = (lowerMessage || '').trim();
    if (!lm) return false;
    return (
      lm.includes('reabrir') ||
      lm.includes('reabre') ||
      lm.includes('retomar') ||
      lm.includes('reativar') ||
      lm.includes('voltar pedido') ||
      lm.includes('continuar pedido')
    );
  }

  private isRepeatOrderIntent(lowerMessage: string): boolean {
    const lm = (lowerMessage || '').trim();
    if (!lm) return false;
    return (
      lm.includes('repetir pedido') ||
      lm.includes('pedido repetido') ||
      lm.includes('repetir meu pedido') ||
      lm.includes('refazer pedido')
    );
  }

  private getPaymentOptionsMessage(total: number): string {
    const totalAmount = Number(total || 0);
    const pixAmount = totalAmount > 0 ? totalAmount * 0.95 : 0;
    return (
      `💳 *ESCOLHA A FORMA DE PAGAMENTO:*\n\n` +
      `1️⃣ *PIX* - Desconto de 5% (R$ ${this.formatCurrency(pixAmount)})\n` +
      `2️⃣ *Cartão de Crédito*\n` +
      `3️⃣ *Cartão de Débito*\n` +
      `4️⃣ *Dinheiro* (retirada)\n\n` +
      `💬 Digite o número ou o nome do método de pagamento.\n` +
      `Exemplo: "1", "pix", "cartão de crédito"`
    );
  }

  private looksLikeOrderStatusQuery(lowerMessage: string): boolean {
    const lm = (lowerMessage || '').trim();
    if (!lm) return false;
    if (lm.includes('meu pedido') || lm.includes('status do pedido') || lm.startsWith('status')) return true;
    return /\bped-\d{8}-\d{3}\b/i.test(lm);
  }

  private async handleOrderStatusQuery(
    tenantId: string,
    conversation: TypedConversation | undefined,
    orderNo: string | null,
  ): Promise<string> {
    try {
      let pedido: Pedido | null = null;
      if (orderNo) {
        pedido = await this.ordersService.findByOrderNo(orderNo, tenantId);
      } else if (conversation?.pedido_id) {
        pedido = await this.ordersService.findOne(conversation.pedido_id, tenantId);
      }

      if (!pedido) {
        return (
          `📦 *ACOMPANHAR PEDIDO*\n\n` +
          `Me envie o código do pedido (ex.: *PED-20260108-001*).\n` +
          `Se você acabou de finalizar um pedido aqui, também posso achar pelo histórico desta conversa.`
        );
      }

      const itens = (pedido.itens || []).map((it: { quantity: number; produto?: { name: string } | null; produto_id?: string }) => 
        `• ${it.quantity}x ${it.produto?.name || it.produto_id || 'Produto'}`).join('\n');
      const total = Number(pedido.total_amount || 0).toFixed(2).replace('.', ',');

      return (
        `📦 *STATUS DO PEDIDO*\n\n` +
        `🆔 Código: *${pedido.order_no}*\n` +
        `📌 Status: *${pedido.status}*\n` +
        `💰 Total: R$ ${total}\n\n` +
        (itens ? `📋 *ITENS:*\n${itens}\n\n` : '') +
        `💬 Se quiser pagar, digite *"pix"* ou *"cartão"*.`
      );
    } catch (error) {
      this.logger.error('Error handling order status query', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { tenantId, orderNo, conversationId: conversation?.id },
      });
      return '❌ Não consegui buscar o status agora. Tente novamente em instantes.';
    }
  }

  private async handleCancelIntent(
    tenantId: string,
    conversation: TypedConversation | undefined,
    currentState?: ConversationState,
  ): Promise<string> {
    if (!conversation) {
      return '❌ Não encontrei um pedido para cancelar.';
    }

    const collectingStates: ConversationState[] = [
      'collecting_order',
      'collecting_name',
      'collecting_address',
      'collecting_phone',
      'collecting_notes',
      'collecting_cash_change',
      'confirming_order',
      'confirming_stock_adjustment',
    ];

    if (currentState && collectingStates.includes(currentState)) {
      await this.conversationService.clearPendingOrder(conversation.id);
      await this.conversationService.clearCustomerData(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      return '❌ Pedido cancelado.\n\n💬 Como posso ajudar você?';
    }

    const pedidoId = conversation.pedido_id || conversation.context?.pedido_id;
    if (!pedidoId) {
      await this.conversationService.clearPendingOrder(conversation.id);
      await this.conversationService.clearCustomerData(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      return '❌ Não encontrei um pedido pendente para cancelar.';
    }

    const pedido = await this.ordersService.findOne(pedidoId, tenantId);

    if (pedido.status === PedidoStatus.PENDENTE_PAGAMENTO) {
      await this.ordersService.updateStatus(pedidoId, PedidoStatus.CANCELADO, tenantId);
      await this.conversationService.clearPendingOrder(conversation.id);
      await this.conversationService.clearPedido(conversation.id);
      await this.conversationService.clearCustomerData(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      return `❌ Pedido *${pedido.order_no}* cancelado.`;
    }

    if (pedido.status === PedidoStatus.CANCELADO) {
      await this.conversationService.clearPedido(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      return `ℹ️ Pedido *${pedido.order_no}* já estava cancelado.`;
    }

    return (
      `⚠️ Pedido *${pedido.order_no}* já está em *${pedido.status}*.\n` +
      'Para cancelar após confirmação, fale com o atendimento.'
    );
  }

  private async handleReopenIntent(
    tenantId: string,
    conversation: TypedConversation | undefined,
  ): Promise<string> {
    if (!conversation) {
      return '❌ Não encontrei um pedido para reabrir.';
    }

    const pedidoId = conversation.pedido_id || conversation.context?.pedido_id;
    let pedido: Pedido | null = null;

    if (pedidoId) {
      pedido = await this.ordersService.findOne(pedidoId, tenantId);
    }

    if (!pedido || pedido.status !== PedidoStatus.PENDENTE_PAGAMENTO) {
      pedido = await this.ordersService.findLatestPendingByCustomerPhone(
        tenantId,
        conversation.customer_phone,
      );
    }

    if (!pedido) {
      await this.conversationService.clearPedido(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      return '❌ Não encontrei pedido pendente para reabrir.\n\n💬 Faça um novo pedido digitando: "Quero X [produto]"';
    }

    await this.conversationService.setPedidoId(conversation.id, pedido.id);
    await this.conversationService.updateState(conversation.id, 'waiting_payment');

    return (
      `♻️ Pedido *${pedido.order_no}* reaberto.\n\n` +
      this.getPaymentOptionsMessage(Number(pedido.total_amount))
    );
  }

  private async handleRepeatOrderIntent(
    tenantId: string,
    conversation: TypedConversation | undefined,
  ): Promise<string> {
    if (!conversation) {
      return '❌ Não encontrei um pedido para repetir.';
    }

    const latest = await this.ordersService.findLatestByCustomerPhone(
      tenantId,
      conversation.customer_phone,
    );

    if (!latest || !latest.itens || latest.itens.length === 0) {
      return '❌ Não encontrei um pedido anterior para repetir.\n\n💬 Faça um novo pedido digitando: "Quero X [produto]"';
    }

    const produtosResult = await this.productsService.findAll(tenantId);
    const produtos = Array.isArray(produtosResult) ? produtosResult : produtosResult.data;
    const produtoMap = new Map(produtos.map((p) => [p.id, p]));

    const missing: string[] = [];
    const insufficient: Array<{ name: string; available: number; requested: number }> = [];
    const items: PendingOrderItem[] = [];

    for (const item of latest.itens) {
      const produto = produtoMap.get(item.produto_id);
      if (!produto || !produto.is_active) {
        missing.push(produto?.name || item.produto_id);
        continue;
      }

      const requestedQty = Number(item.quantity || 0);
      if (produto.available_stock < requestedQty) {
        insufficient.push({
          name: produto.name,
          available: produto.available_stock,
          requested: requestedQty,
        });
        continue;
      }

      const unitPrice = Number(produto.price);
      const priceValidation = this.validatePrice(unitPrice);
      if (!priceValidation.valid) {
        return '❌ Erro no preço do produto. Por favor, tente novamente.';
      }

      items.push({
        produto_id: produto.id,
        produto_name: produto.name,
        quantity: requestedQty,
        unit_price: unitPrice,
      });
    }

    if (missing.length > 0) {
      return (
        `❌ Alguns itens do último pedido não estão mais disponíveis:\n` +
        missing.map((name) => `• ${name}`).join('\n') +
        `\n\n💬 Digite *"cardápio"* para ver os produtos disponíveis.`
      );
    }

    if (insufficient.length > 0) {
      let msg = '❌ Estoque insuficiente para repetir o pedido:\n\n';
      for (const item of insufficient) {
        msg += `• ${item.name}: solicitado ${item.requested}, disponível ${item.available}\n`;
      }
      msg += '\n💬 Ajuste a quantidade e faça um novo pedido.';
      return msg;
    }

    if (items.length === 0) {
      return '❌ Não consegui montar o pedido repetido.\n\n💬 Faça um novo pedido digitando: "Quero X [produto]"';
    }

    await this.conversationService.clearPendingOrder(conversation.id);
    await this.conversationService.clearPedido(conversation.id);

    const subtotal = items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
    const pendingOrder: PendingOrder = {
      items,
      subtotal,
      discount_amount: 0,
      shipping_amount: 0,
      total_amount: subtotal,
    };

    return await this.applyPendingOrderAndProceed(pendingOrder, tenantId, conversation);
  }

  private async applyCouponToPendingOrder(
    tenantId: string,
    conversation: TypedConversation | undefined,
    couponCode: string,
  ): Promise<string> {
    if (!conversation) return '❌ Erro ao processar. Tente novamente.';

    const pendingOrder = conversation.context?.pending_order;
    if (!pendingOrder) {
      return `❌ Não encontrei um pedido em andamento.\n\n💬 Faça um pedido primeiro e depois envie: *"cupom ${couponCode}"*`;
    }

    const normalized = (couponCode || '').trim().toUpperCase();
    if (!normalized) {
      return '❌ Código de cupom inválido.';
    }

    // remover cupom
    if (['REMOVER', 'REMOVE', 'CANCELAR', 'LIMPAR'].includes(normalized)) {
      pendingOrder.discount_amount = 0;
      pendingOrder.coupon_code = null;
      pendingOrder.total_amount =
        Number(pendingOrder.subtotal || 0) - Number(pendingOrder.discount_amount || 0) + Number(pendingOrder.shipping_amount || 0);
      await this.conversationService.savePendingOrder(conversation.id, pendingOrder);

      const currentState = conversation?.context?.state as ConversationState | undefined;
      if (currentState === 'confirming_order') {
        return await this.showOrderConfirmation(tenantId, conversation);
      }
      return `✅ Cupom removido. Total agora: R$ ${Number(pendingOrder.total_amount).toFixed(2).replace('.', ',')}`;
    }

    const coupon = await this.couponsService.findActiveByCode(tenantId, normalized);
    if (!coupon) {
      return `❌ Cupom *${normalized}* não encontrado ou inativo.\n\n💬 Dica: em dev, use *"cupom DEV10"*.`;
    }

    const validation = this.couponsService.validateCoupon(Number(pendingOrder.subtotal || 0), coupon);
    if (!validation.valid) {
      return `❌ Cupom *${normalized}* inválido: ${validation.reason}`;
    }

    pendingOrder.discount_amount = validation.discountAmount;
    pendingOrder.coupon_code = validation.code;
    pendingOrder.total_amount =
      Number(pendingOrder.subtotal || 0) - Number(pendingOrder.discount_amount || 0) + Number(pendingOrder.shipping_amount || 0);

    await this.conversationService.savePendingOrder(conversation.id, pendingOrder);

    const currentState = conversation?.context?.state as ConversationState | undefined;
    if (currentState === 'confirming_order') {
      return await this.showOrderConfirmation(tenantId, conversation);
    }

    return (
      `✅ Cupom *${validation.code}* aplicado!\n` +
      `Desconto: R$ ${validation.discountAmount.toFixed(2).replace('.', ',')}\n` +
      `Total agora: R$ ${Number(pendingOrder.total_amount).toFixed(2).replace('.', ',')}\n\n` +
      `💬 Para remover: *"cupom remover"*`
    );
  }

  /**
   * ✅ NOVO: Valida quantidade
   */
  private validateQuantity(quantity: number): { valid: boolean; error?: string } {
    if (!Number.isInteger(quantity)) {
      return { valid: false, error: 'Quantidade deve ser um número inteiro' };
    }

    if (quantity < this.MIN_QUANTITY) {
      return { valid: false, error: `Quantidade mínima é ${this.MIN_QUANTITY}` };
    }

    if (quantity > this.MAX_QUANTITY) {
      return { valid: false, error: `Quantidade máxima é ${this.MAX_QUANTITY}` };
    }

    return { valid: true };
  }

  /**
   * ✅ NOVO: Valida nome
   */
  private validateName(name: string): { valid: boolean; error?: string } {
    const sanitized = this.sanitizeInput(name);

    if (sanitized.length < this.MIN_NAME_LENGTH) {
      return { valid: false, error: `Nome deve ter no mínimo ${this.MIN_NAME_LENGTH} caracteres` };
    }

    if (sanitized.length > this.MAX_NAME_LENGTH) {
      return { valid: false, error: `Nome deve ter no máximo ${this.MAX_NAME_LENGTH} caracteres` };
    }

    // Validar caracteres permitidos (letras, espaços, acentos, hífen)
    if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(sanitized)) {
      return { valid: false, error: 'Nome contém caracteres inválidos' };
    }

    return { valid: true };
  }

  /**
   * ✅ NOVO: Valida endereço
   */
  private validateAddress(address: string): { valid: boolean; error?: string } {
    const sanitized = this.sanitizeInput(address);

    if (sanitized.length < this.MIN_ADDRESS_LENGTH) {
      return { valid: false, error: `Endereço deve ter no mínimo ${this.MIN_ADDRESS_LENGTH} caracteres` };
    }

    if (sanitized.length > this.MAX_ADDRESS_LENGTH) {
      return { valid: false, error: `Endereço deve ter no máximo ${this.MAX_ADDRESS_LENGTH} caracteres` };
    }

    return { valid: true };
  }

  /**
   * ✅ NOVO: Valida telefone
   */
  private validatePhone(phone: string): { valid: boolean; error?: string } {
    const digitsOnly = phone.replace(/\D/g, '');

    if (digitsOnly.length < 10 || digitsOnly.length > 11) {
      return { valid: false, error: 'Telefone deve ter 10 ou 11 dígitos (com DDD)' };
    }

    return { valid: true };
  }

  /**
   * ✅ NOVO: Valida preço
   */
  private validatePrice(price: number): { valid: boolean; error?: string } {
    if (typeof price !== 'number' || isNaN(price)) {
      return { valid: false, error: 'Preço deve ser um número válido' };
    }

    if (price <= 0) {
      return { valid: false, error: 'Preço deve ser maior que zero' };
    }

    if (price > this.MAX_PRICE) {
      return { valid: false, error: `Preço máximo é R$ ${this.MAX_PRICE.toLocaleString('pt-BR')}` };
    }

    return { valid: true };
  }

  /**
   * ✅ NOVO: Valida estado da conversa
   */
  private validateConversationState(conversation: TypedConversation | undefined): { valid: boolean; error?: string } {
    if (!conversation) {
      return { valid: false, error: 'Conversa não encontrada' };
    }

    const validStates: ConversationState[] = [
      'idle',
      'collecting_order',
      'collecting_name',
      'collecting_address',
      'collecting_phone',
      'collecting_notes',
      'confirming_order',
      'confirming_stock_adjustment',
      'waiting_payment',
      'order_confirmed',
      'order_completed',
    ];

    const currentState = conversation.context?.state as ConversationState | undefined;

    if (currentState && !validStates.includes(currentState)) {
      this.logger.warn(`Invalid conversation state: ${currentState}, resetting to idle`, {
        conversationId: conversation.id,
        customerPhone: conversation.customer_phone,
      });
      // Resetar estado inválido
      this.conversationService.updateState(conversation.id, 'idle').catch((err) => {
        this.logger.error('Error resetting conversation state', err);
      });
      return { valid: false, error: 'Estado da conversa inválido, resetado para idle' };
    }

    return { valid: true };
  }

  /**
   * ✅ NOVO: Valida pedido pendente
   */
  private validatePendingOrder(pendingOrder: PendingOrder | null | undefined): { valid: boolean; error?: string } {
    if (!pendingOrder) {
      return { valid: false, error: 'Pedido pendente não encontrado' };
    }

    if (!pendingOrder.items || !Array.isArray(pendingOrder.items) || pendingOrder.items.length === 0) {
      return { valid: false, error: 'Pedido pendente não tem itens' };
    }

    // Validar cada item
    for (const item of pendingOrder.items) {
      if (!item.produto_id || !item.produto_name) {
        return { valid: false, error: 'Item do pedido inválido: falta produto_id ou produto_name' };
      }

      const quantityValidation = this.validateQuantity(item.quantity);
      if (!quantityValidation.valid) {
        return { valid: false, error: `Item ${item.produto_name}: ${quantityValidation.error}` };
      }

      const priceValidation = this.validatePrice(item.unit_price);
      if (!priceValidation.valid) {
        return { valid: false, error: `Item ${item.produto_name}: ${priceValidation.error}` };
      }
    }

    // Validar totais
    const calculatedSubtotal = pendingOrder.items.reduce(
      (sum: number, item: PendingOrderItem) => sum + item.unit_price * item.quantity,
      0,
    );

    if (Math.abs(calculatedSubtotal - pendingOrder.subtotal) > 0.01) {
      return { valid: false, error: 'Subtotal do pedido não confere com os itens' };
    }

    const calculatedTotal = calculatedSubtotal - (pendingOrder.discount_amount || 0) + (pendingOrder.shipping_amount || 0);

    if (Math.abs(calculatedTotal - pendingOrder.total_amount) > 0.01) {
      return { valid: false, error: 'Total do pedido não confere com os valores' };
    }

    return { valid: true };
  }

  async processIncomingMessage(message: WhatsappMessage): Promise<string> {
    this.logger.log(`Processing message from ${message.from}: ${message.body}`);

    try {
      // ⚠️ CRÍTICO: tenantId deve vir obrigatoriamente, nunca usar default hardcoded
      if (!message.tenantId) {
        this.logger.error('Tenant ID missing from WhatsApp message', { from: message.from });
        throw new BadRequestException('Tenant ID é obrigatório para processar mensagens WhatsApp');
      }
      const tenantId = message.tenantId;
      
      // ✅ NOVO: Sanitizar mensagem recebida
      const sanitizedBody = this.sanitizeInput(message.body || '');
      if (!sanitizedBody) {
        return '❌ Mensagem vazia ou inválida. Por favor, envie uma mensagem válida.';
      }

      // ✅ NOVO: Validar tamanho da mensagem
      if (message.body && message.body.length > this.MAX_MESSAGE_LENGTH) {
        this.logger.warn(`Message too long: ${message.body.length} characters`, { from: message.from });
        return `❌ Mensagem muito longa. Por favor, envie uma mensagem com no máximo ${this.MAX_MESSAGE_LENGTH} caracteres.`;
      }
      
      // Buscar ou criar conversa
      const conversation = await this.conversationService.getOrCreateConversation(
        tenantId,
        message.from,
      );

      // ✅ NOVO: Validar estado da conversa
      const typedConversation = toTypedConversation(conversation);
      const stateValidation = this.validateConversationState(typedConversation);
      if (!stateValidation.valid) {
        this.logger.warn(`Invalid conversation state: ${stateValidation.error}`, {
          conversationId: conversation.id,
          customerPhone: message.from,
        });
      }

      // Salvar mensagem recebida (sanitizada)
      await this.conversationService.saveMessage(
        conversation.id,
        'inbound',
        sanitizedBody,
      );

      // Gerar resposta (usar mensagem sanitizada)
      const response = await this.generateResponse(
        sanitizedBody,
        tenantId,
        typedConversation,
      );

      // Salvar mensagem enviada
      await this.conversationService.saveMessage(
        conversation.id,
        'outbound',
        response,
      );

      this.logger.log(`Response: ${response}`);
      return response;
    } catch (error) {
      this.logger.error('Error processing WhatsApp message', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          from: message.from,
          tenantId: message.tenantId,
          messageBody: message.body?.substring(0, 100), // Limitar tamanho para logs
        },
      });
      // ✅ NOVO: Mensagem de erro sanitizada (não expor detalhes)
      return 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes.';
    }
  }

  private async generateResponse(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    const lowerMessage = message.toLowerCase().trim();

    // ✅ NOVO: Verificar estado da conversa PRIMEIRO (antes de qualquer outra coisa)
    const currentState = conversation?.context?.state as ConversationState | undefined;

    // ✅ ALTA PRIORIDADE: cupom e status do pedido devem funcionar em qualquer estado
    const couponCode = this.extractCouponCode(message);
    if (couponCode) {
      return await this.applyCouponToPendingOrder(tenantId, conversation, couponCode);
    }

    if (currentState === 'confirming_order') {
      const standaloneCoupon = this.extractStandaloneCouponCode(message);
      if (standaloneCoupon) {
        return await this.applyCouponToPendingOrder(tenantId, conversation, standaloneCoupon);
      }
    }

    const orderNo = this.extractOrderNo(message);
    if (this.looksLikeOrderStatusQuery(lowerMessage)) {
      return await this.handleOrderStatusQuery(tenantId, conversation, orderNo);
    }

    if (this.isCancelIntent(lowerMessage)) {
      return await this.handleCancelIntent(tenantId, conversation, currentState);
    }

    if (this.isReopenIntent(lowerMessage)) {
      return await this.handleReopenIntent(tenantId, conversation);
    }

    if (this.isRepeatOrderIntent(lowerMessage)) {
      return await this.handleRepeatOrderIntent(tenantId, conversation);
    }

    if (currentState === 'confirming_stock_adjustment') {
      return await this.processStockAdjustment(message, tenantId, conversation);
    }

    if (currentState === 'collecting_cash_change') {
      return await this.processCashChange(message, tenantId, conversation);
    }
    
    // Se está coletando dados do cliente, processar isso primeiro
    if (currentState === 'collecting_name') {
      return await this.processCustomerName(message, tenantId, conversation);
    }
    
    if (currentState === 'collecting_address') {
      return await this.processCustomerAddress(message, tenantId, conversation);
    }
    
    if (currentState === 'collecting_phone') {
      return await this.processCustomerPhone(message, tenantId, conversation);
    }

    if (currentState === 'collecting_notes') {
      return await this.processCustomerNotes(message, tenantId, conversation);
    }
    
    if (currentState === 'confirming_order') {
      return await this.processOrderConfirmation(message, tenantId, conversation);
    }

    // IMPORTANTE: Verificar seleção de método de pagamento
    const isPaymentSelection = this.isPaymentMethodSelection(message);
    const hasPaymentContext =
      currentState === 'waiting_payment' ||
      !!conversation?.pedido_id ||
      !!conversation?.context?.pedido_id;
    if (isPaymentSelection && hasPaymentContext) {
      return await this.processPaymentSelection(message, tenantId, conversation);
    }
    if (isPaymentSelection) {
      return '❌ Não encontrei um pedido pendente para pagamento.\n\n' +
        '💬 Faça um pedido primeiro digitando: "Quero X [produto]"';
    }

    // IMPORTANTE: Verificar pedidos (antes de outras respostas)
    if (this.isOrderIntent(lowerMessage)) {
      if (currentState === 'waiting_payment' && conversation) {
        await this.conversationService.clearPendingOrder(conversation.id);
        await this.conversationService.clearPedido(conversation.id);
        await this.conversationService.clearCustomerData(conversation.id);
        await this.conversationService.updateState(conversation.id, 'idle');
        conversation.context = {
          ...(conversation.context || {}),
          state: 'idle',
        };
      }
      // ✅ NOVO: Pedido com 2+ itens na mesma frase (ex.: "quero 5 brigadeiros e 1 brownie")
      // Faz parse e cria pending_order com múltiplos itens de uma vez.
      if (this.looksLikeMultiItemOrder(message)) {
        const multi = await this.processMultiItemOrder(message, tenantId, conversation);
        if (multi) return multi;
      }
      return await this.processOrder(message, tenantId, conversation);
    }

    // Comando: Cardápio / Menu
    if (lowerMessage.includes('cardapio') || lowerMessage.includes('menu') || lowerMessage.includes('produtos')) {
      return await this.getCardapio(tenantId);
    }

    // Comando: Preço de [produto]
    if (lowerMessage.includes('preco') || lowerMessage.includes('valor') || lowerMessage.includes('quanto custa')) {
      return await this.getPreco(message, tenantId);
    }

    // Comando: Estoque de [produto]
    if (lowerMessage.includes('estoque') || lowerMessage.includes('tem') || lowerMessage.includes('disponivel')) {
      return await this.getEstoque(message, tenantId);
    }

    // Comando: Horário
    if (lowerMessage.includes('horario') || lowerMessage.includes('funciona') || lowerMessage.includes('aberto')) {
      return this.getHorario();
    }

    // Comando: Ajuda
    if (lowerMessage.includes('ajuda') || lowerMessage.includes('help') || lowerMessage.includes('comandos')) {
      return this.getAjuda();
    }

    // Saudação
    if (lowerMessage.includes('ola') || lowerMessage.includes('oi') || lowerMessage.includes('bom dia') || 
        lowerMessage.includes('boa tarde') || lowerMessage.includes('boa noite')) {
      return this.getSaudacao();
    }

    // Resposta padrão
    return this.getRespostaPadrao();
  }

  private looksLikeMultiItemOrder(message: string): boolean {
    const lower = (message || '').toLowerCase();
    // Heurística simples: tem conector " e " / "," e mais de um número na frase
    const hasConnector = lower.includes(' e ') || lower.includes(',');
    const nums = lower.match(/\d+/g) || [];
    return hasConnector && nums.length >= 2;
  }

  private isOrderIntent(lowerMessage: string): boolean {
    const palavrasPedido = [
      'quero', 'preciso', 'comprar', 'pedir', 'vou querer', 'gostaria de',
      'desejo', 'vou comprar', 'preciso de', 'queria', 'ia querer',
      'me manda', 'manda', 'pode ser', 'faz', 'me faz', 'faz pra mim',
      'pode me enviar', 'tem como', 'dá pra', 'dá pra fazer', 'dá pra me enviar',
      'seria possível', 'poderia', 'pode me mandar', 'me envia', 'envia',
      'vou pedir', 'quero comprar', 'preciso comprar', 'quero pedir',
      'preciso pedir', 'quero encomendar', 'preciso encomendar',
      'quero fazer pedido', 'preciso fazer pedido', 'quero fazer um pedido',
      'preciso fazer um pedido', 'quero fazer uma encomenda', 'preciso fazer uma encomenda',
      'quero fazer encomenda', 'preciso fazer encomenda', 'quero fazer', 'preciso fazer',
    ];

    return palavrasPedido.some((palavra) => lowerMessage.includes(palavra));
  }

  private extractMultipleOrderInfos(
    message: string,
  ): Array<{ quantity: number; productName: string }> | null {
    const lower = (message || '').toLowerCase();
    const parts = lower
      // Divide itens apenas quando "e" for seguido de um número (ex.: "... e 1 brownie")
      // Isso evita quebrar nomes de produtos que contenham " e " dentro do próprio nome.
      .split(/\s+e\s+(?=\d+\s)|,/g)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length < 2) return null;

    const parsed: Array<{ quantity: number; productName: string }> = [];
    for (const part of parts) {
      const info = this.extractOrderInfo(part);
      if (!info.quantity || !info.productName) {
        return null;
      }
      parsed.push({ quantity: info.quantity, productName: info.productName });
    }

    return parsed.length >= 2 ? parsed : null;
  }

  /**
   * ✅ NOVO: Processa pedido com múltiplos itens em uma única mensagem.
   * Retorna string se conseguiu processar; retorna null para cair no fluxo antigo.
   */
  private async processMultiItemOrder(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string | null> {
    if (!conversation) return null;

    const parsed = this.extractMultipleOrderInfos(message);
    if (!parsed) return null;

    // Buscar produtos (sem paginação para WhatsApp - retorna array)
    const produtosResult = await this.productsService.findAll(tenantId);
    const produtos = Array.isArray(produtosResult) ? produtosResult : produtosResult.data;

    const items: Array<{
      produto_id: string;
      produto_name: string;
      quantity: number;
      unit_price: number;
    }> = [];

    for (const part of parsed) {
      const quantityValidation = this.validateQuantity(part.quantity);
      if (!quantityValidation.valid) {
        return `❌ ${quantityValidation.error}`;
      }

      const resultadoBusca = this.findProductByName(produtos, part.productName);

      if (!resultadoBusca.produto) {
        if (resultadoBusca.sugestoes && resultadoBusca.sugestoes.length > 0) {
          if (resultadoBusca.sugestoes.length === 1) {
            resultadoBusca.produto = resultadoBusca.sugestoes[0];
          } else {
            let msgSug = `❓ Não encontrei exatamente "${part.productName}", mas você quis dizer:\n\n`;
            resultadoBusca.sugestoes.forEach((p, index) => {
              msgSug += `${index + 1}. *${p.name}*\n`;
            });
            msgSug += '\n💬 Digite o nome completo do produto.';
            return msgSug;
          }
        } else {
          return `❌ Não encontrei o produto "${part.productName}".\n\n💬 Digite *"cardápio"* para ver nossos produtos.`;
        }
      }

      const produto = resultadoBusca.produto!;
      const unitPrice = Number(produto.price);
      const priceValidation = this.validatePrice(unitPrice);
      if (!priceValidation.valid) {
        return '❌ Erro no preço do produto. Por favor, tente novamente.';
      }

      if (produto.available_stock < part.quantity) {
        return `❌ Estoque insuficiente!\n\n` +
          `*${produto.name}*\n` +
          `Solicitado: ${part.quantity} unidades\n` +
          `Disponível: ${produto.available_stock} unidades\n\n` +
          `💬 Ajuste a quantidade e tente novamente.`;
      }

      items.push({
        produto_id: produto.id,
        produto_name: produto.name,
        quantity: part.quantity,
        unit_price: unitPrice,
      });
    }

    const subtotal = items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
    const pendingOrder = {
      items,
      subtotal,
      discount_amount: 0,
      shipping_amount: 0,
      total_amount: subtotal,
    };

    return await this.applyPendingOrderAndProceed(pendingOrder, tenantId, conversation);
  }

  private formatPendingOrderSummary(pendingOrder: PendingOrder): string {
    let msg = '';
    pendingOrder.items.forEach((item: PendingOrderItem) => {
      msg += `📦 *${item.produto_name}*\n`;
      msg += `Quantidade: ${item.quantity} unidades\n`;
      msg += `Preço unitário: R$ ${Number(item.unit_price).toFixed(2).replace('.', ',')}\n\n`;
    });
    msg += `💰 *Total: R$ ${Number(pendingOrder.total_amount).toFixed(2).replace('.', ',')}*\n\n`;
    return msg;
  }

  private async applyPendingOrderAndProceed(
    pendingOrder: PendingOrder,
    tenantId: string,
    conversation: TypedConversation,
  ): Promise<string> {
    if (!conversation.context?.order_attempt_id) {
      const attemptId = crypto.randomUUID();
      await this.conversationService.updateContext(conversation.id, {
        order_attempt_id: attemptId,
      });
      conversation.context = {
        ...(conversation.context || {}),
        order_attempt_id: attemptId,
      };
    }
    await this.conversationService.savePendingOrder(conversation.id, pendingOrder);

    const customerData = conversation?.context?.customer_data as CustomerData | undefined;

    // Se já temos nome, seguir o fluxo padrão de entrega/retirada/confirmação
    if (customerData?.name) {
      if (!customerData.address && !customerData.delivery_type) {
        await this.conversationService.updateState(conversation.id, 'collecting_address');
        return `✅ *PEDIDO PREPARADO!*\n\n` +
          this.formatPendingOrderSummary(pendingOrder) +
          `\n💬 *Como você prefere receber?*\n\n` +
          `1️⃣ *Entrega* (preciso do seu endereço)\n` +
          `2️⃣ *Retirada* (você busca aqui)\n\n` +
          `💬 Digite "1" para entrega ou "2" para retirada.`;
      }

      if (customerData.delivery_type === 'delivery' && !customerData.address) {
        await this.conversationService.updateState(conversation.id, 'collecting_address');
        return `📦 *VAMOS COLETAR SEU ENDEREÇO*\n\n` +
          `💬 Por favor, envie seu endereço completo:\n` +
          `Rua, número, complemento (se houver), bairro, cidade, estado e CEP.\n\n` +
          `Exemplo: "Rua das Flores, 123, Apto 45, Centro, São Paulo, SP, 01234-567"`;
      }

      if (!customerData.phone) {
        await this.conversationService.updateState(conversation.id, 'collecting_phone');
        return this.getPhonePrompt();
      }

      if (customerData.notes === undefined) {
        await this.conversationService.updateState(conversation.id, 'collecting_notes');
        return this.getNotesPrompt();
      }

      await this.conversationService.updateState(conversation.id, 'confirming_order');
      return await this.showOrderConfirmation(tenantId, conversation);
    }

    // Se não tem nome ainda, pedir nome
    await this.conversationService.updateState(conversation.id, 'collecting_name');

    return `✅ *PEDIDO PREPARADO!*\n\n` +
      this.formatPendingOrderSummary(pendingOrder) +
      `\n💬 *Para finalizar, preciso de algumas informações:*\n\n` +
      `👤 *Qual é o seu nome completo?*`;
  }

  private async processOrder(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    try {
      // Extrair quantidade e produto da mensagem
      const orderInfo = this.extractOrderInfo(message);
      
      this.logger.debug(`Order extraction: quantity=${orderInfo.quantity}, productName="${orderInfo.productName}"`);
      
      // Se não tem quantidade, perguntar ao usuário
      if (!orderInfo.quantity && orderInfo.productName) {
        return `❓ Quantos *${orderInfo.productName}* você gostaria?\n\n` +
               '💬 Digite a quantidade, por exemplo:\n' +
               '*"5 brigadeiros"* ou *"uma dúzia"*';
      }
      
      // Se não tem produto, mas tem quantidade, perguntar qual produto
      if (orderInfo.quantity && !orderInfo.productName) {
        return `❓ Qual produto você gostaria de ${orderInfo.quantity} unidades?\n\n` +
               '💬 Digite *"cardápio"* para ver nossos produtos disponíveis.';
      }
      
      // Se não tem nem quantidade nem produto
      if (!orderInfo.quantity || !orderInfo.productName) {
        return '❌ Não consegui entender seu pedido.\n\n' +
               '💬 Por favor, digite no formato:\n' +
               '*"Quero 10 brigadeiros"*\n' +
               '*"Me manda 5 bolos de chocolate"*\n' +
               '*"Preciso de uma dúzia de brigadeiros"*\n\n' +
               '💡 Ou digite *"ajuda"* para ver mais exemplos.';
      }

      // A partir daqui, temos certeza que quantity e productName não são null
      const quantity = orderInfo.quantity;
      const productName = orderInfo.productName;

      // Buscar produto (sem paginação para WhatsApp - retorna array)
      const produtosResult = await this.productsService.findAll(tenantId);
      const produtos = Array.isArray(produtosResult) ? produtosResult : produtosResult.data;
      const resultadoBusca = this.findProductByName(produtos, productName);
      
      this.logger.debug(`Product search: found=${!!resultadoBusca.produto}, searched="${productName}", suggestions=${resultadoBusca.sugestoes?.length || 0}`);

      // Se não encontrou produto exato, mas tem sugestões
      if (!resultadoBusca.produto && resultadoBusca.sugestoes && resultadoBusca.sugestoes.length > 0) {
        if (resultadoBusca.sugestoes.length === 1) {
          // Só uma sugestão - usar ela
          const produto = resultadoBusca.sugestoes[0];
          this.logger.debug(`Using single suggestion: ${produto.name}`);
          // Continuar com o produto sugerido
          return await this.createOrderWithProduct(produto, quantity, tenantId, conversation);
        } else {
          // Múltiplas sugestões - perguntar qual
          let mensagem = `❓ Não encontrei exatamente "${productName}", mas você quis dizer:\n\n`;
          resultadoBusca.sugestoes.forEach((p, index) => {
            mensagem += `${index + 1}. *${p.name}*\n`;
          });
          mensagem += '\n💬 Digite o número ou o nome completo do produto que você quer.';
          return mensagem;
        }
      }

      // Se não encontrou e não tem sugestões
      if (!resultadoBusca.produto) {
        // Tentar buscar produtos similares para sugerir
        const produtosSimilares = this.findSimilarProducts(produtos, productName);
        
        if (produtosSimilares.length > 0) {
          let mensagem = `❓ Não encontrei "${productName}". Você quis dizer:\n\n`;
          produtosSimilares.slice(0, 5).forEach((p, index) => {
            mensagem += `${index + 1}. *${p.name}*\n`;
          });
          mensagem += '\n💬 Digite o número ou o nome completo do produto.';
          mensagem += '\n💡 Ou digite *"cardápio"* para ver todos os produtos.';
          return mensagem;
        }
        
        return `❌ Não encontrei o produto "${productName}".\n\n` +
               '💬 Digite *"cardápio"* para ver nossos produtos disponíveis.';
      }

      const produto = resultadoBusca.produto;

      return await this.createOrderWithProduct(produto, quantity, tenantId, conversation);
    } catch (error) {
      this.logger.error('Error processing WhatsApp order', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          tenantId,
          customerPhone: conversation?.customer_phone,
          messageQuery: message?.substring(0, 100),
        },
      });
      return '❌ Ocorreu um erro ao processar seu pedido.\n\n' +
             '💬 Tente novamente ou digite *"ajuda"* para ver os comandos.';
    }
  }

  private async createOrderWithProduct(
    produto: ProductWithStock,
    quantity: number,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    // ✅ NOVO: Validar conversa
    if (!conversation) {
      return '❌ Erro ao processar. Tente novamente.';
    }

    const stateValidation = this.validateConversationState(conversation);
    if (!stateValidation.valid) {
      return `❌ ${stateValidation.error}`;
    }

    // ✅ NOVO: Validar quantidade
    const quantityValidation = this.validateQuantity(quantity);
    if (!quantityValidation.valid) {
      return `❌ ${quantityValidation.error}`;
    }

    // ✅ NOVO: Validar produto
    if (!produto || !produto.id || !produto.name) {
      return '❌ Produto inválido. Por favor, escolha um produto válido.';
    }

    // ✅ NOVO: Validar preço do produto
    const unitPrice = Number(produto.price);
    const priceValidation = this.validatePrice(unitPrice);
    if (!priceValidation.valid) {
      this.logger.error(`Invalid product price: ${priceValidation.error}`, {
        produtoId: produto.id,
        produtoName: produto.name,
        price: unitPrice,
      });
      return '❌ Erro no preço do produto. Por favor, tente novamente.';
    }

    // ✅ NOVO: Validar estoque
    if (produto.available_stock < quantity) {
      if (produto.available_stock <= 0) {
        return `❌ Estoque insuficiente!\n\n` +
               `*${produto.name}*\n` +
               `Solicitado: ${quantity} unidades\n` +
               `Disponível: 0 unidades\n\n` +
               `💬 Digite *"cardápio"* para ver outros produtos.`;
      }

      const stockAdjustment: StockAdjustmentContext = {
        produto_id: produto.id,
        produto_name: produto.name,
        requested_qty: quantity,
        available_qty: produto.available_stock,
        unit_price: unitPrice,
      };

      await this.conversationService.updateContext(conversation.id, {
        stock_adjustment: stockAdjustment,
      });
      await this.conversationService.updateState(conversation.id, 'confirming_stock_adjustment');

      return `❌ Estoque insuficiente!\n\n` +
             `*${produto.name}*\n` +
             `Solicitado: ${quantity} unidades\n` +
             `Disponível: ${produto.available_stock} unidades\n\n` +
             `💬 Posso seguir com *${produto.available_stock}* unidade(s)?\n` +
             `Digite *"sim"* para confirmar ou envie outra quantidade (até ${produto.available_stock}).`;
    }

    // ✅ NOVO: Calcular valores do pedido
    const subtotal = unitPrice * quantity;
    const discountAmount = 0;
    const shippingAmount = 0;
    const totalAmount = subtotal - discountAmount + shippingAmount;

    const pendingOrder = {
      items: [{
        produto_id: produto.id,
        produto_name: produto.name,
        quantity: quantity,
        unit_price: unitPrice,
      }],
      subtotal,
      discount_amount: discountAmount,
      shipping_amount: shippingAmount,
      total_amount: totalAmount,
    };

    return await this.applyPendingOrderAndProceed(pendingOrder, tenantId, conversation);
  }

  private extractOrderInfo(message: string): { quantity: number | null; productName: string | null } {
    const lowerMessage = message.toLowerCase().trim();
    
    // ============================================
    // ETAPA 1: EXTRAIR QUANTIDADE (múltiplas formas)
    // ============================================
    let quantity: number | null = null;
    
    // 1.1. Expressões de quantidade PRIMEIRO (dúzia, meia dúzia, quilo, etc.)
    // IMPORTANTE: Verificar ANTES de números por extenso para evitar conflitos
    if (lowerMessage.includes('meia duzia') || lowerMessage.includes('meia dúzia')) {
      quantity = 6;
    } else if (lowerMessage.includes('duzia') || lowerMessage.includes('dúzia')) {
      // Verificar se tem número antes de "dúzia" (duas dúzias, três dúzias, etc.)
      const duziaMatch = lowerMessage.match(/(\d+)\s*(duzia|dúzia)/);
      if (duziaMatch) {
        quantity = parseInt(duziaMatch[1]) * 12;
      } else if (lowerMessage.includes('uma duzia') || lowerMessage.includes('uma dúzia')) {
        quantity = 12;
      } else if (lowerMessage.includes('duas duzias') || lowerMessage.includes('duas dúzias')) {
        quantity = 24;
      } else if (lowerMessage.includes('tres duzias') || lowerMessage.includes('três dúzias')) {
        quantity = 36;
      } else {
        // Se só tem "dúzia" sem número, assumir 1 dúzia = 12
        quantity = 12;
      }
    } else if (lowerMessage.includes('quilo') || lowerMessage.includes('kg') || lowerMessage.includes('kilo')) {
      // Assumir 1 quilo (pode ser ajustado depois)
      quantity = 1;
    } else if (lowerMessage.match(/\d+\s*(g|gramas?)/)) {
      // Quantidade em gramas (ex: "500g de brigadeiros")
      const gramasMatch = lowerMessage.match(/(\d+)\s*(g|gramas?)/);
      if (gramasMatch) {
        // Converter gramas para quantidade aproximada (ex: 500g ≈ 20 brigadeiros)
        // Por enquanto, usar o número direto
        quantity = parseInt(gramasMatch[1]);
      }
    }
    
    // 1.2. Números escritos por extenso (um, dois, três, etc.)
    // IMPORTANTE: Só verificar se não encontrou quantidade nas expressões acima
    if (!quantity) {
      const numerosExtenso: Record<string, number> = {
        'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'três': 3, 'tres': 3,
        'quatro': 4, 'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8,
        'nove': 9, 'dez': 10, 'onze': 11, 'doze': 12, 'treze': 13,
        'quatorze': 14, 'quinze': 15, 'dezesseis': 16, 'dezessete': 17,
        'dezoito': 18, 'dezenove': 19, 'vinte': 20, 'trinta': 30,
        'quarenta': 40, 'cinquenta': 50, 'cem': 100
      };
      
      for (const [palavra, valor] of Object.entries(numerosExtenso)) {
        const regex = new RegExp(`\\b${palavra}\\b`, 'i');
        if (regex.test(lowerMessage)) {
          quantity = valor;
          break;
        }
      }
    }
    
    // 1.3. Números digitais (5, 10, 100, etc.)
    if (!quantity) {
      const quantityMatch = lowerMessage.match(/(\d+)/);
      if (quantityMatch) {
        quantity = parseInt(quantityMatch[1]);
      }
    }
    
    // 1.4. Quantidades indefinidas (uns, algumas, vários, etc.)
    // Se não encontrou quantidade específica, mas tem palavras de quantidade indefinida
    if (!quantity) {
      const indefinidas = ['uns', 'umas', 'alguns', 'algumas', 'vários', 'várias', 'um monte', 'muitos', 'muitas'];
      const temIndefinida = indefinidas.some(palavra => lowerMessage.includes(palavra));
      if (temIndefinida) {
        // Quantidade padrão para indefinidos (pode perguntar depois)
        quantity = 5; // Quantidade padrão
      }
    }
    
    // ============================================
    // ETAPA 2: REMOVER PALAVRAS DE AÇÃO (múltiplas variações)
    // ============================================
    let productName = lowerMessage;
    
    // Lista completa de palavras/frases de ação
    const acoes = [
      'quero', 'preciso', 'comprar', 'pedir', 'vou querer', 'gostaria de',
      'desejo', 'vou comprar', 'preciso de', 'queria', 'ia querer',
      'me manda', 'manda', 'pode ser', 'faz', 'me faz', 'faz pra mim',
      'pode me enviar', 'tem como', 'dá pra', 'dá pra fazer', 'dá pra me enviar',
      'seria possível', 'poderia', 'pode me mandar', 'me envia', 'envia',
      'vou pedir', 'vou comprar', 'quero comprar', 'preciso comprar',
      'quero pedir', 'preciso pedir', 'quero encomendar', 'preciso encomendar',
      'quero encomendar', 'preciso encomendar', 'quero fazer pedido',
      'preciso fazer pedido', 'quero fazer um pedido', 'preciso fazer um pedido',
      'quero fazer uma encomenda', 'preciso fazer uma encomenda',
      'quero fazer encomenda', 'preciso fazer encomenda',
      'quero fazer', 'preciso fazer', 'quero', 'preciso'
    ];
    
    // Remover palavras de ação (ordem importa - remover as mais longas primeiro)
    acoes.sort((a, b) => b.length - a.length);
    for (const acao of acoes) {
      const regex = new RegExp(`^${acao}\\s+`, 'i');
      productName = productName.replace(regex, '');
    }
    
    // Remover interjeições e palavras de cortesia
    productName = productName.replace(/^(por favor|pf|pfv|obrigado|obrigada|obg|vlw|valeu|tks|thanks)\s*/i, '');
    productName = productName.replace(/\s+(por favor|pf|pfv|obrigado|obrigada|obg|vlw|valeu|tks|thanks)\s*$/i, '');
    
    // ============================================
    // ETAPA 3: REMOVER QUANTIDADE DA STRING DO PRODUTO
    // ============================================
    
    // Remover número se ainda estiver na string
    if (quantity) {
      productName = productName.replace(new RegExp(`\\b${quantity}\\b`, 'g'), '');
    }
    
    // Remover números escritos por extenso
    const numerosExtensoList = ['um', 'uma', 'dois', 'duas', 'três', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'cem'];
    for (const palavra of numerosExtensoList) {
      const regex = new RegExp(`\\b${palavra}\\b`, 'gi');
      productName = productName.replace(regex, '');
    }
    
    // Remover expressões de quantidade
    productName = productName.replace(/\b(duzia|dúzia|meia duzia|meia dúzia|quilo|kg|kilo|gramas?|g)\b/gi, '');
    productName = productName.replace(/\b(unidades?|unidade|un|peças?|peça|pç)\b/gi, '');
    
    // Remover palavras de quantidade indefinida
    productName = productName.replace(/\b(uns|umas|alguns|algumas|vários|várias|um monte|muitos|muitas)\b/gi, '');
    
    // ============================================
    // ETAPA 4: LIMPAR E NORMALIZAR NOME DO PRODUTO
    // ============================================
    
    // Remover artigos no início/fim (mas manter "de" no meio)
    productName = productName.replace(/^\s*(o|a|os|as|um|uma|d[eo]|d[ao]s|d[ae]s)\s+/gi, '');
    productName = productName.replace(/\s+(o|a|os|as|um|uma|d[eo]|d[ao]s|d[ae]s)\s*$/gi, '');
    
    // Remover preposições soltas (mas manter "de" quando faz parte do nome)
    productName = productName.replace(/\b(para|pra|com|sem|em|na|no|nas|nos)\b/gi, '');
    
    // Remover palavras de questionamento
    productName = productName.replace(/\b(qual|quais|que|quem|onde|quando|como|porque|por que)\b/gi, '');
    
    // Remover interrogações e exclamações
    productName = productName.replace(/[?!.,;:]+/g, '');
    
    // Limpar espaços múltiplos e normalizar
    productName = productName.trim().replace(/\s+/g, ' ');
    
    // Remover "de" solto no início/fim (mas manter no meio)
    productName = productName.replace(/^\s*de\s+/gi, '');
    productName = productName.replace(/\s+de\s*$/gi, '');
    
    // Normalizar diminutivos comuns (brigadinho → brigadeiro, bolinho → bolo)
    productName = productName.replace(/inho\b/gi, '');
    productName = productName.replace(/inha\b/gi, '');
    
    this.logger.debug(`ExtractOrderInfo: original="${message}", quantity=${quantity}, productName="${productName}"`);

    return {
      quantity,
      productName: productName && productName.length >= 2 ? productName : null,
    };
  }

  private findProductByName(produtos: ProductWithStock[], productName: string): ProductSearchResult {
    if (!productName) return { produto: null };

    // Normalizar: remover acentos para busca mais flexivel
    const normalize = (str: string) => {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    };

    const pickBestProduct = (candidates: ProductWithStock[]): ProductWithStock | null => {
      if (!candidates.length) return null;

      return candidates.reduce((best, current) => {
        const bestStock = Number(best.available_stock || 0);
        const currentStock = Number(current.available_stock || 0);
        const bestInStock = bestStock > 0;
        const currentInStock = currentStock > 0;

        if (bestInStock !== currentInStock) {
          return currentInStock ? current : best;
        }

        if (bestStock !== currentStock) {
          return currentStock > bestStock ? current : best;
        }

        const bestDate = new Date(best.created_at || 0).getTime();
        const currentDate = new Date(current.created_at || 0).getTime();
        return currentDate > bestDate ? current : best;
      });
    };

    // 1) Tentar match exato do nome completo (inclui casos como "3 beijinhos de coco")
    const queryNormalized = normalize(productName).trim();
    const exactMatches = produtos.filter((p) => normalize(p.name).trim() === queryNormalized);
    const exact = pickBestProduct(exactMatches);
    if (exact) {
      return { produto: exact };
    }

    // 2) Fallback: tokenizacao (mantem tokens numericos mesmo com 1 char)
    const palavras = productName
      .toLowerCase()
      .split(/\s+/)
      .filter((p) => p.length >= 2 || /^\d+$/.test(p));

    if (palavras.length === 0) return { produto: null };

    // Estrategia 1: Buscar por nome exato (todas as palavras, sem acentos)
    let produto = pickBestProduct(
      produtos.filter((p) => {
        const nomeNormalizado = normalize(p.name);
        return palavras.every((palavra) => {
          const palavraNormalizada = normalize(palavra);
          return nomeNormalizado.includes(palavraNormalizada);
        });
      }),
    );

    // Estrategia 2: Buscar por nome completo (query completa)
    if (!produto) {
      const queryCompleta = palavras.join(' ');
      produto = pickBestProduct(
        produtos.filter((p) => {
          const nomeNormalizado = normalize(p.name);
          return nomeNormalizado.includes(normalize(queryCompleta));
        }),
      );
    }

    // Estrategia 3: Buscar por qualquer palavra (se nao encontrou)
    if (!produto) {
      produto = pickBestProduct(
        produtos.filter((p) => {
          const nomeNormalizado = normalize(p.name);
          return palavras.some((palavra) => {
            const palavraNormalizada = normalize(palavra);
            return nomeNormalizado.includes(palavraNormalizada);
          });
        }),
      );
    }

    // Estrategia 4: Buscar por singular/plural (brigadeiro/brigadeiros, bolo/bolos)
    if (!produto && palavras.length === 1) {
      const palavra = palavras[0];
      const palavraNormalizada = normalize(palavra);

      // Tentar com 's' no final (plural)
      const plural = palavraNormalizada + 's';
      // Tentar sem 's' (singular)
      const singular = palavraNormalizada.endsWith('s') && palavraNormalizada.length > 4
        ? palavraNormalizada.slice(0, -1)
        : palavraNormalizada;

      produto = pickBestProduct(
        produtos.filter((p) => {
          const nomeNormalizado = normalize(p.name);
          // Buscar por palavra singular ou plural (incluindo no inicio do nome)
          return (
            nomeNormalizado.includes(singular) ||
            nomeNormalizado.includes(plural) ||
            nomeNormalizado.startsWith(singular + ' ') ||
            nomeNormalizado.startsWith(plural + ' ') ||
            nomeNormalizado.startsWith(singular) ||
            nomeNormalizado.startsWith(plural)
          );
        }),
      );
    }

    // Estrategia 5: Busca por similaridade (erros de digitacao comuns)
    if (!produto) {
      // Mapeamento de erros comuns de digitacao
      const correcoes: Record<string, string[]> = {
        'brigadeiro': ['brigadeiro', 'brigadeiros', 'brigadinho', 'brigadinha'],
        'bolo': ['bolo', 'bolos', 'bolinho', 'bolinha'],
        'cenoura': ['cenoura', 'cenora', 'cenora'],
        'chocolate': ['chocolate', 'chocolat', 'chocolat'],
        'leite': ['leite', 'leite'],
        'ninho': ['ninho', 'nino'],
        'maracuja': ['maracuja', 'maracuja', 'maracuja'],
        'beijinho': ['beijinho', 'beijinho', 'beijinho'],
        'cajuzinho': ['cajuzinho', 'cajuzinho'],
        'coxinha': ['coxinha', 'coxinha'],
      };

      // Tentar correcoes
      for (const [_original, variacoes] of Object.entries(correcoes)) {
        if (palavras.some((p) => variacoes.some((v) => normalize(p).includes(normalize(v))))) {
          produto = pickBestProduct(
            produtos.filter((p) => {
              const nomeNormalizado = normalize(p.name);
              return variacoes.some((v) => nomeNormalizado.includes(normalize(v)));
            }),
          );
          if (produto) break;
        }
      }
    }

    // Se encontrou produto, retornar
    if (produto) {
      return { produto };
    }

    // Se nao encontrou, buscar produtos similares (para sugestoes)
    const sugestoes = this.findSimilarProducts(produtos, productName);

    return { produto: null, sugestoes: sugestoes.length > 0 ? sugestoes : undefined };
  }

  private findSimilarProducts(produtos: ProductWithStock[], productName: string, maxResults: number = 5): ProductWithStock[] {
    if (!productName || productName.length < 2) return [];

    const normalize = (str: string) => {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    };

    const queryNormalized = normalize(productName);
    const palavras = queryNormalized.split(/\s+/).filter(p => p.length >= 2);
    
    if (palavras.length === 0) return [];

    // Calcular similaridade para cada produto
    const produtosComScore = produtos.map(p => {
      const nomeNormalizado = normalize(p.name);
      let score = 0;

      // Score por palavras em comum
      palavras.forEach(palavra => {
        if (nomeNormalizado.includes(palavra)) {
          score += 10;
        }
        // Score por similaridade de caracteres (Levenshtein simplificado)
        if (palavra.length >= 3) {
          const similaridade = this.calculateSimilarity(palavra, nomeNormalizado);
          score += similaridade * 5;
        }
      });

      // Score por começar com a palavra
      palavras.forEach(palavra => {
        if (nomeNormalizado.startsWith(palavra)) {
          score += 5;
        }
      });

      // Score por conter todas as palavras (ordem não importa)
      if (palavras.every(palavra => nomeNormalizado.includes(palavra))) {
        score += 20;
      }

      return { produto: p, score };
    });

    // Filtrar produtos com score > 0 e ordenar por score
    return produtosComScore
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(item => item.produto);
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Similaridade simples baseada em caracteres em comum
    const chars1 = new Set(str1.split(''));
    const chars2 = new Set(str2.split(''));
    
    let common = 0;
    chars1.forEach(char => {
      if (chars2.has(char)) common++;
    });

    const total = Math.max(chars1.size, chars2.size);
    return total > 0 ? common / total : 0;
  }

  private formatStatus(status: PedidoStatus): string {
    const statusMap: Record<PedidoStatus, string> = {
      [PedidoStatus.PENDENTE_PAGAMENTO]: '⏳ Aguardando Pagamento',
      [PedidoStatus.CONFIRMADO]: '✅ Confirmado',
      [PedidoStatus.EM_PRODUCAO]: '👨‍🍳 Em Produção',
      [PedidoStatus.PRONTO]: '🎉 Pronto',
      [PedidoStatus.EM_TRANSITO]: '🚚 Em Trânsito',
      [PedidoStatus.ENTREGUE]: '✅ Entregue',
      [PedidoStatus.CANCELADO]: '❌ Cancelado',
    };
    return statusMap[status] || status;
  }

  private async getCardapio(tenantId: string): Promise<string> {
    try {
      const produtosResult = await this.productsService.findAll(tenantId);
      const produtos = Array.isArray(produtosResult) ? produtosResult : produtosResult.data;
      
      if (produtos.length === 0) {
        return '📋 *Cardápio*\n\nNão temos produtos cadastrados no momento.';
      }

      // Agrupar por categoria
      const porCategoria: Record<string, ProductWithStock[]> = {};
      produtos.forEach(produto => {
        const categoria = produto.categoria?.name || 'Outros';
        if (!porCategoria[categoria]) {
          porCategoria[categoria] = [];
        }
        porCategoria[categoria].push(produto);
      });

      let mensagem = '📋 *NOSSO CARDÁPIO*\n\n';
      
      Object.keys(porCategoria).forEach(categoria => {
        mensagem += `*${categoria.toUpperCase()}*\n`;
        porCategoria[categoria].forEach(produto => {
          const emoji = produto.available_stock > 0 ? '✅' : '❌';
          mensagem += `${emoji} ${produto.name} - R$ ${Number(produto.price).toFixed(2).replace('.', ',')}\n`;
        });
        mensagem += '\n';
      });

      mensagem += '💬 Digite o *nome do produto* para mais informações ou para fazer um pedido!';
      
      return mensagem;
    } catch (error) {
      this.logger.error('Error getting WhatsApp cardapio', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { tenantId },
      });
      return 'Desculpe, não consegui buscar o cardápio no momento. Tente novamente.';
    }
  }

  private async getPreco(message: string, tenantId: string): Promise<string> {
    try {
      // Extrair palavras-chave da mensagem (remover "preço", "valor", "quanto custa")
      const palavras = message.toLowerCase()
        .replace(/preco|preço|valor|quanto|custa|de|o|a|os|as|do|da|dos|das/gi, '')
        .trim()
        .split(/\s+/)
        .filter(p => p.length > 2);

      let produtoEncontrado = null;
      const produtosResult = await this.productsService.findAll(tenantId);
      const produtos = Array.isArray(produtosResult) ? produtosResult : produtosResult.data;

      // Se tem palavras-chave, buscar produto específico
      if (palavras.length > 0) {
        // Estratégia 1: Buscar por todas as palavras (produto composto)
        const queryCompleta = palavras.join(' ');
        produtoEncontrado = produtos.find(p => {
          const nomeLower = p.name.toLowerCase();
          return nomeLower.includes(queryCompleta);
        });

        // Estratégia 2: Buscar por todas as palavras individualmente (todas devem estar no nome)
        if (!produtoEncontrado) {
          produtoEncontrado = produtos.find(p => {
            const nomeLower = p.name.toLowerCase();
            return palavras.every(palavra => nomeLower.includes(palavra));
          });
        }

        // Estratégia 3: Usar busca do service
        if (!produtoEncontrado) {
          const produtosBuscados = await this.productsService.search(tenantId, queryCompleta);
          
          if (produtosBuscados.length > 0) {
            produtoEncontrado = produtos.find(p => p.id === produtosBuscados[0].id);
          }
        }

        // Estratégia 4: Buscar por qualquer palavra (fallback)
        if (!produtoEncontrado && palavras.length === 1) {
          produtoEncontrado = produtos.find(p => 
            p.name.toLowerCase().includes(palavras[0])
          );
        }
      }

      if (produtoEncontrado) {
        return `💰 *${produtoEncontrado.name}*\n\n` +
               `Preço: R$ ${Number(produtoEncontrado.price).toFixed(2).replace('.', ',')}\n` +
               `Estoque disponível: ${produtoEncontrado.available_stock} unidades\n\n` +
               `💬 Quer fazer um pedido? Digite: "Quero X ${produtoEncontrado.name}"`;
      }

      // Se não encontrou produto específico, mostrar alguns produtos
      if (produtos.length > 0) {
        let mensagem = '💰 *PREÇOS*\n\n';
        produtos.slice(0, 5).forEach(produto => {
          mensagem += `• ${produto.name}: R$ ${Number(produto.price).toFixed(2).replace('.', ',')}\n`;
        });
        mensagem += '\n💬 Digite o nome do produto para mais detalhes!';
        return mensagem;
      }

      return 'Não encontrei produtos. Digite "cardápio" para ver nossa lista completa.';
    } catch (error) {
      this.logger.error('Error getting WhatsApp preco', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          tenantId,
          messageQuery: message?.substring(0, 50),
        },
      });
      return 'Desculpe, não consegui buscar o preço no momento.';
    }
  }

  private async getEstoque(message: string, tenantId: string): Promise<string> {
    try {
      // Extrair palavras-chave da mensagem (remover "estoque", "tem", "disponivel")
      const palavras = message.toLowerCase()
        .replace(/estoque|tem|disponivel|disponível|de|o|a|os|as|do|da|dos|das/gi, '')
        .trim()
        .split(/\s+/)
        .filter(p => p.length > 2);

      let produtoEncontrado = null;
      const produtosResult = await this.productsService.findAll(tenantId);
      const produtos = Array.isArray(produtosResult) ? produtosResult : produtosResult.data;

      // Se tem palavras-chave, buscar produto específico
      if (palavras.length > 0) {
        // Estratégia 1: Buscar por todas as palavras (produto composto)
        const queryCompleta = palavras.join(' ');
        produtoEncontrado = produtos.find(p => {
          const nomeLower = p.name.toLowerCase();
          return nomeLower.includes(queryCompleta);
        });

        // Estratégia 2: Buscar por todas as palavras individualmente (todas devem estar no nome)
        if (!produtoEncontrado) {
          produtoEncontrado = produtos.find(p => {
            const nomeLower = p.name.toLowerCase();
            return palavras.every(palavra => nomeLower.includes(palavra));
          });
        }

        // Estratégia 3: Usar busca do service
        if (!produtoEncontrado) {
          const produtosBuscados = await this.productsService.search(tenantId, queryCompleta);
          
          if (produtosBuscados.length > 0) {
            produtoEncontrado = produtos.find(p => p.id === produtosBuscados[0].id);
          }
        }

        // Estratégia 4: Buscar por qualquer palavra (fallback)
        if (!produtoEncontrado && palavras.length === 1) {
          produtoEncontrado = produtos.find(p => 
            p.name.toLowerCase().includes(palavras[0])
          );
        }
      }

      if (produtoEncontrado) {
        const emoji = produtoEncontrado.available_stock > 0 ? '✅' : '❌';
        return `${emoji} *${produtoEncontrado.name}*\n\n` +
               `Estoque disponível: *${produtoEncontrado.available_stock}* unidades\n` +
               `Estoque total: ${produtoEncontrado.stock} unidades\n` +
               (produtoEncontrado.available_stock === 0 
                 ? '\n⚠️ Este produto está sem estoque no momento.' 
                 : '\n💬 Quer fazer um pedido? Digite: "Quero X ' + produtoEncontrado.name + '"');
      }

      // Se não encontrou produto específico, mostrar produtos com estoque baixo
      const produtosBaixoEstoque = produtos.filter(p => p.available_stock > 0 && p.available_stock <= (p.min_stock || 5));
      
      if (produtosBaixoEstoque.length > 0) {
        let mensagem = '⚠️ *PRODUTOS COM ESTOQUE BAIXO*\n\n';
        produtosBaixoEstoque.forEach(produto => {
          mensagem += `• ${produto.name}: ${produto.available_stock} unidades\n`;
        });
        return mensagem;
      }

      return 'Digite o nome do produto para verificar o estoque. Exemplo: "Estoque de brigadeiro"';
    } catch (error) {
      this.logger.error('Error getting WhatsApp estoque', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          tenantId,
          messageQuery: message?.substring(0, 50),
        },
      });
      return 'Desculpe, não consegui verificar o estoque no momento.';
    }
  }

  private getHorario(): string {
    return '🕐 *HORÁRIO DE FUNCIONAMENTO*\n\n' + this.HORARIO_FUNCIONAMENTO + '\n\n' +
           '💬 Estamos prontos para atender você!';
  }

  private getAjuda(): string {
    return '💬 *COMO POSSO AJUDAR?*\n\n' +
           'Digite um dos comandos abaixo:\n\n' +
           '📋 *cardápio* - Ver todos os produtos\n' +
           '💰 *preço de [produto]* - Ver preço de um produto\n' +
           '📦 *estoque de [produto]* - Ver estoque disponível\n' +
           '🕐 *horário* - Ver horário de funcionamento\n' +
           '🛒 *quero X [produto]* - Fazer um pedido\n' +
           '❌ *cancelar pedido* - Cancelar pedido atual\n' +
           '♻️ *reabrir pedido* - Retomar pedido pendente\n\n' +
           '💬 Exemplo: "Quero 10 brigadeiros"';
  }

  private getSaudacao(): string {
    return '👋 Olá! Bem-vindo(a) à nossa loja!\n\n' +
           'Como posso ajudar você hoje?\n\n' +
           '💬 Digite *ajuda* para ver os comandos disponíveis.';
  }

  private getRespostaPadrao(): string {
    return 'Desculpe, não entendi sua mensagem. 😅\n\n' +
           '💬 Digite *ajuda* para ver como posso ajudar você!';
  }

  /**
   * Verifica se a mensagem é uma seleção de método de pagamento
   */
  private isPaymentMethodSelection(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    
    // Verificar números (1, 2, 3, 4)
    if (/^[1-4]$/.test(lowerMessage)) {
      return true;
    }

    // Verificar palavras-chave de métodos de pagamento
    const metodos = [
      'pix', 'cartão', 'cartao', 'credito', 'crédito', 'debito', 'débito',
      'dinheiro', 'dinheiro', 'boleto'
    ];

    return metodos.some(metodo => lowerMessage.includes(metodo));
  }

  /**
   * Processa a seleção de método de pagamento
   */
  private async processPaymentSelection(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    try {
      if (!conversation) {
        return '❌ Não encontrei um pedido pendente para pagamento.\n\n' +
          '💬 Faça um pedido primeiro digitando: "Quero X [produto]"';
      }
      const lowerMessage = message.toLowerCase().trim();
      
      // Extrair método de pagamento
      let metodo: MetodoPagamento | null = null;

      // Por número
      if (lowerMessage === '1' || lowerMessage.includes('pix')) {
        metodo = MetodoPagamento.PIX;
      } else if (lowerMessage === '2' || lowerMessage.includes('credito') || lowerMessage.includes('crédito')) {
        metodo = MetodoPagamento.CREDITO;
      } else if (lowerMessage === '3' || lowerMessage.includes('debito') || lowerMessage.includes('débito')) {
        metodo = MetodoPagamento.DEBITO;
      } else if (lowerMessage === '4' || lowerMessage.includes('dinheiro')) {
        metodo = MetodoPagamento.DINHEIRO;
      } else if (lowerMessage.includes('boleto')) {
        metodo = MetodoPagamento.BOLETO;
      }

      if (!metodo) {
        return '❌ Método de pagamento não reconhecido.\n\n' +
               '💬 Digite:\n' +
               '*1* ou *PIX*\n' +
               '*2* ou *Cartão de Crédito*\n' +
               '*3* ou *Cartão de Débito*\n' +
               '*4* ou *Dinheiro*';
      }

      // Buscar pedido_id do contexto da conversa
      let pedidoId: string | null = null;

      if (conversation?.pedido_id) {
        pedidoId = conversation.pedido_id;
      } else if (conversation?.context?.pedido_id) {
        pedidoId = conversation.context.pedido_id;
      } else {
        // Fallback: buscar último pedido pendente (para compatibilidade)
        const pedidoPendente = await this.ordersService.findLatestPendingByCustomerPhone(
          tenantId,
          conversation?.customer_phone || '',
        );

        if (!pedidoPendente) {
          return '❌ Não encontrei um pedido pendente de pagamento.\n\n' +
                 '💬 Faça um pedido primeiro digitando: "Quero X [produto]"';
        }

        pedidoId = pedidoPendente.id;
      }

      if (!pedidoId) {
        return '❌ Não encontrei um pedido pendente de pagamento.\n\n' +
               '💬 Faça um pedido primeiro digitando: "Quero X [produto]"';
      }

      // Buscar pedido
      const pedidoPendente = await this.ordersService.findOne(pedidoId, tenantId);

      if (!pedidoPendente || pedidoPendente.status !== PedidoStatus.PENDENTE_PAGAMENTO) {
        return '❌ Pedido não está pendente de pagamento.\n\n' +
               '💬 Faça um pedido primeiro digitando: "Quero X [produto]"';
      }

      if (metodo === MetodoPagamento.DINHEIRO) {
        await this.conversationService.updateState(conversation.id, 'collecting_cash_change');
        return (
          `💵 *Pagamento em dinheiro selecionado.*\n\n` +
          `Total: R$ ${this.formatCurrency(Number(pedidoPendente.total_amount))}\n` +
          `Precisa de troco? Informe o valor (ex.: *"100"*) ou digite *"sem"*.`
        );
      }

      // Criar pagamento
      const createPaymentDto: CreatePaymentDto = {
        pedido_id: pedidoPendente.id,
        method: metodo,
        amount: pedidoPendente.total_amount,
      };

      const paymentResult = await this.paymentsService.createPayment(tenantId, createPaymentDto);

      // Retornar mensagem com QR Code se for Pix
      if (metodo === MetodoPagamento.PIX && paymentResult.qr_code) {
        // Em produção, enviar imagem do QR Code via WhatsApp
        // Por enquanto, retornar mensagem com instruções
        return paymentResult.message || 'Pagamento Pix processado';
      }

      return paymentResult.message || 'Pagamento processado com sucesso!';
    } catch (error) {
      this.logger.error('Error processing WhatsApp payment selection', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          tenantId,
          customerPhone: conversation?.customer_phone,
          pedidoId: conversation?.pedido_id || conversation?.context?.pedido_id,
          paymentMessage: message?.substring(0, 50),
        },
      });
      
      if (error instanceof NotFoundException) {
        return '❌ Pedido não encontrado.\n\n' +
               '💬 Faça um pedido primeiro digitando: "Quero X [produto]"';
      }
      
      if (error instanceof BadRequestException) {
        return `❌ ${error.message}`;
      }

      return '❌ Ocorreu um erro ao processar o pagamento.\n\n' +
             '💬 Tente novamente ou digite *"ajuda"* para ver os comandos.';
    }
  }

  private async processCashChange(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    if (!conversation) {
      return '❌ Erro ao processar. Tente novamente.';
    }

    const sanitizedMessage = this.sanitizeInput(message.trim());
    const lowerMessage = sanitizedMessage.toLowerCase();

    if (this.isOrderIntent(lowerMessage)) {
      await this.conversationService.clearPendingOrder(conversation.id);
      await this.conversationService.clearPedido(conversation.id);
      await this.conversationService.clearCustomerData(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      conversation.context = {
        ...(conversation.context || {}),
        state: 'idle',
      };
      return await this.processOrder(message, tenantId, conversation);
    }

    if (lowerMessage.includes('cancelar') || lowerMessage.includes('voltar')) {
      await this.conversationService.updateState(conversation.id, 'waiting_payment');
      return '✅ Ok! Escolha a forma de pagamento:\n' +
        '*1* PIX\n*2* Cartão de Crédito\n*3* Cartão de Débito\n*4* Dinheiro';
    }

    const pedidoId = conversation.pedido_id || conversation.context?.pedido_id;
    if (!pedidoId) {
      await this.conversationService.updateState(conversation.id, 'waiting_payment');
      return '❌ Não encontrei um pedido pendente para pagamento.\n\n' +
        '💬 Faça um pedido primeiro digitando: "Quero X [produto]"';
    }

    const pedidoPendente = await this.ordersService.findOne(pedidoId, tenantId);
    if (!pedidoPendente || pedidoPendente.status !== PedidoStatus.PENDENTE_PAGAMENTO) {
      await this.conversationService.updateState(conversation.id, 'waiting_payment');
      return '❌ Pedido não está pendente de pagamento.\n\n' +
        '💬 Faça um pedido primeiro digitando: "Quero X [produto]"';
    }

    const totalAmount = Number(pedidoPendente.total_amount || 0);
    const noChange =
      !lowerMessage ||
      lowerMessage === 'sem' ||
      lowerMessage === 'nao' ||
      lowerMessage === 'não' ||
      lowerMessage === 'nenhum' ||
      lowerMessage === 'nenhuma';

    let changeFor: number | null = null;
    let changeAmount = 0;

    if (!noChange) {
      const parsed = this.parseCurrencyAmount(sanitizedMessage);
      if (!parsed) {
        return (
          `❌ Não entendi o valor do troco.\n\n` +
          `Informe um valor (ex.: *"100"* ou *"100,00"*) ou digite *"sem"*.`
        );
      }

      if (parsed < totalAmount) {
        return (
          `❌ O valor informado é menor que o total do pedido.\n` +
          `Total: R$ ${this.formatCurrency(totalAmount)}\n\n` +
          `Informe um valor maior ou igual ao total.`
        );
      }

      changeFor = parsed;
      changeAmount = Number((parsed - totalAmount).toFixed(2));
    }

    await this.conversationService.saveCustomerData(conversation.id, {
      cash_change_for: changeFor,
      cash_change_amount: changeAmount,
    });

    await this.conversationService.updateState(conversation.id, 'waiting_payment');

    const createPaymentDto: CreatePaymentDto = {
      pedido_id: pedidoPendente.id,
      method: MetodoPagamento.DINHEIRO,
      amount: pedidoPendente.total_amount,
      metadata: {
        cash_change_for: changeFor,
        cash_change_amount: changeAmount,
      },
    };

    const paymentResult = await this.paymentsService.createPayment(tenantId, createPaymentDto);

    if (changeFor) {
      return (
        (paymentResult.message || 'Pagamento processado com sucesso!') +
        `\n\n💵 Troco para: R$ ${this.formatCurrency(changeFor)}` +
        `\n🧾 Troco: R$ ${this.formatCurrency(changeAmount)}`
      );
    }

    return (paymentResult.message || 'Pagamento processado com sucesso!') +
      '\n\n💵 Pagamento em dinheiro sem troco.';
  }

  private async processStockAdjustment(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    if (!conversation) {
      return '❌ Erro ao processar. Tente novamente.';
    }

    const stateValidation = this.validateConversationState(conversation);
    if (!stateValidation.valid) {
      return `❌ ${stateValidation.error}`;
    }

    const adjustment = conversation.context?.stock_adjustment as StockAdjustmentContext | undefined;
    if (!adjustment) {
      await this.conversationService.updateState(conversation.id, 'idle');
      return '❌ Não encontrei um pedido pendente. Por favor, faça um novo pedido.';
    }

    const sanitizedMessage = this.sanitizeInput(message.trim());
    const lowerMessage = sanitizedMessage.toLowerCase().trim();

    if (lowerMessage.includes('cancelar') || lowerMessage.includes('nao') || lowerMessage.includes('não')) {
      await this.conversationService.updateContext(conversation.id, { stock_adjustment: null });
      await this.conversationService.updateState(conversation.id, 'idle');
      return '❌ Pedido cancelado.\n\n💬 Como posso ajudar você?';
    }

    let chosenQty: number | null = null;

    if (lowerMessage.includes('sim') || lowerMessage.includes('confirmar') || lowerMessage === 'ok') {
      chosenQty = adjustment.available_qty;
    } else if (/^\d+$/.test(lowerMessage)) {
      chosenQty = Number(lowerMessage);
    }

    if (!chosenQty || chosenQty <= 0 || chosenQty > adjustment.available_qty) {
      return `❌ Quantidade inválida.\n\n` +
             `Disponível: ${adjustment.available_qty} unidade(s).\n` +
             `💬 Digite um número até ${adjustment.available_qty} ou *"cancelar"*.`;
    }

    const pendingOrder: PendingOrder = {
      items: [{
        produto_id: adjustment.produto_id,
        produto_name: adjustment.produto_name,
        quantity: chosenQty,
        unit_price: adjustment.unit_price,
      }],
      subtotal: adjustment.unit_price * chosenQty,
      discount_amount: 0,
      shipping_amount: 0,
      total_amount: adjustment.unit_price * chosenQty,
    };

    await this.conversationService.updateContext(conversation.id, { stock_adjustment: null });
    return await this.applyPendingOrderAndProceed(pendingOrder, tenantId, conversation);
  }

  /**
   * ✅ NOVO: Processa coleta de nome do cliente
   */
  private async processCustomerName(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    // ✅ NOVO: Validar conversa
    if (!conversation) {
      return '❌ Erro ao processar. Tente novamente.';
    }

    const stateValidation = this.validateConversationState(conversation);
    if (!stateValidation.valid) {
      return `❌ ${stateValidation.error}`;
    }

    const lowerMessage = this.sanitizeInput(message.trim()).toLowerCase();
    if (this.isOrderIntent(lowerMessage)) {
      await this.conversationService.clearPendingOrder(conversation.id);
      await this.conversationService.clearPedido(conversation.id);
      await this.conversationService.clearCustomerData(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      conversation.context = {
        ...(conversation.context || {}),
        state: 'idle',
      };
      return await this.processOrder(message, tenantId, conversation);
    }

    // ✅ NOVO: Sanitizar e validar nome
    const sanitizedName = this.sanitizeInput(message.trim());
    const nameValidation = this.validateName(sanitizedName);
    
    if (!nameValidation.valid) {
      return `❌ ${nameValidation.error}`;
    }

    // Salvar nome (sanitizado)
    await this.conversationService.saveCustomerData(conversation.id, { name: sanitizedName });
    
    // Verificar se precisa de endereço (perguntar se é entrega ou retirada)
    const pendingOrder = conversation.context?.pending_order;
    if (pendingOrder) {
      // ✅ NOVO: Validar pedido pendente
      const orderValidation = this.validatePendingOrder(pendingOrder);
      if (!orderValidation.valid) {
        this.logger.error(`Invalid pending order: ${orderValidation.error}`, {
          conversationId: conversation.id,
          customerPhone: conversation.customer_phone,
        });
        await this.conversationService.clearPendingOrder(conversation.id);
        await this.conversationService.updateState(conversation.id, 'idle');
        return '❌ Erro no pedido pendente. Por favor, faça um novo pedido.';
      }

      // ✅ Fluxo correto: após coletar nome, próximo passo é coletar tipo de entrega/endereço
      // (processCustomerAddress lida com "1"/"2" e com o endereço completo)
      await this.conversationService.updateState(conversation.id, 'collecting_address');

      return `✅ *Nome salvo: ${sanitizedName}*\n\n` +
             `💬 *Como você prefere receber?*\n\n` +
             `1️⃣ *Entrega* (preciso do seu endereço)\n` +
             `2️⃣ *Retirada* (você busca aqui)\n\n` +
             `💬 Digite "1" para entrega ou "2" para retirada.`;
    }

    // Se não tem pedido pendente, voltar ao estado idle
    await this.conversationService.updateState(conversation.id, 'idle');
    return `✅ Nome salvo: ${sanitizedName}\n\n💬 Como posso ajudar você?`;
  }

  /**
   * ✅ NOVO: Processa coleta de endereço do cliente
   */
  private async processCustomerAddress(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    // ✅ NOVO: Validar conversa
    if (!conversation) {
      return '❌ Erro ao processar. Tente novamente.';
    }

    const stateValidation = this.validateConversationState(conversation);
    if (!stateValidation.valid) {
      return `❌ ${stateValidation.error}`;
    }

    // ✅ NOVO: Sanitizar mensagem
    const sanitizedMessage = this.sanitizeInput(message.trim());
    const lowerMessage = sanitizedMessage.toLowerCase().trim();
    
    // Verificar se é seleção de tipo de entrega (1 ou 2)
    if (lowerMessage === '1' || lowerMessage.includes('entrega')) {
      // É entrega, coletar endereço
      await this.conversationService.saveCustomerData(conversation.id, { delivery_type: 'delivery' });
      // ✅ frete simples: aplica ao pedido pendente quando escolhe entrega
      const pendingOrder = conversation.context?.pending_order;
      if (pendingOrder) {
        pendingOrder.shipping_amount = this.getDefaultShippingAmount();
        pendingOrder.total_amount =
          Number(pendingOrder.subtotal || 0) - Number(pendingOrder.discount_amount || 0) + Number(pendingOrder.shipping_amount || 0);
        await this.conversationService.savePendingOrder(conversation.id, pendingOrder);
      }
      await this.conversationService.updateState(conversation.id, 'collecting_address');
      return `📦 *VAMOS COLETAR SEU ENDEREÇO*\n\n` +
             `💬 Por favor, envie seu endereço completo:\n` +
             `Rua, número, complemento (se houver), bairro, cidade, estado e CEP.\n\n` +
             `Exemplo: "Rua das Flores, 123, Apto 45, Centro, São Paulo, SP, 01234-567"`;
    } else if (lowerMessage === '2' || lowerMessage.includes('retirada') || lowerMessage.includes('buscar')) {
      // É retirada, ir direto para confirmação
      await this.conversationService.saveCustomerData(conversation.id, { delivery_type: 'pickup' });
      // ✅ retirada: sem frete
      const pendingOrder = conversation.context?.pending_order;
      if (pendingOrder) {
        pendingOrder.shipping_amount = 0;
        pendingOrder.total_amount =
          Number(pendingOrder.subtotal || 0) - Number(pendingOrder.discount_amount || 0) + Number(pendingOrder.shipping_amount || 0);
        await this.conversationService.savePendingOrder(conversation.id, pendingOrder);
      }
      if (!conversation.context?.customer_data?.phone) {
        await this.conversationService.updateState(conversation.id, 'collecting_phone');
        return this.getPhonePrompt();
      }
      await this.conversationService.updateState(conversation.id, 'collecting_notes');
      return this.getNotesPrompt();
    }
    
    // ✅ NOVO: Validar endereço
    const addressValidation = this.validateAddress(sanitizedMessage);
    if (!addressValidation.valid) {
      return `❌ ${addressValidation.error}`;
    }

    // Tentar extrair componentes do endereço (parsing básico)
    const addressParts = this.parseAddress(sanitizedMessage);
    
    if (!addressParts) {
      // Se não conseguiu fazer parse, salvar como texto e pedir confirmação
      await this.conversationService.saveCustomerData(conversation.id, {
        delivery_type: 'delivery',
        address: {
          street: sanitizedMessage,
          number: '',
          neighborhood: '',
          city: '',
          state: '',
          zipCode: '',
          zipcode: '',
        },
      });

      const pendingOrder = conversation.context?.pending_order;
      if (pendingOrder && Number(pendingOrder.shipping_amount || 0) === 0) {
        pendingOrder.shipping_amount = this.getDefaultShippingAmount();
        pendingOrder.total_amount =
          Number(pendingOrder.subtotal || 0) - Number(pendingOrder.discount_amount || 0) + Number(pendingOrder.shipping_amount || 0);
        await this.conversationService.savePendingOrder(conversation.id, pendingOrder);
      }

      await this.conversationService.updateState(conversation.id, 'confirming_order');
      return await this.showOrderConfirmation(tenantId, conversation);
    }

    // Salvar endereço parseado
    await this.conversationService.saveCustomerData(conversation.id, {
      delivery_type: 'delivery',
      address: {
        ...addressParts,
        zipcode: addressParts.zipCode || '',
      },
    });

    const pendingOrder = conversation.context?.pending_order;
    if (pendingOrder && Number(pendingOrder.shipping_amount || 0) === 0) {
      pendingOrder.shipping_amount = this.getDefaultShippingAmount();
      pendingOrder.total_amount =
        Number(pendingOrder.subtotal || 0) - Number(pendingOrder.discount_amount || 0) + Number(pendingOrder.shipping_amount || 0);
      await this.conversationService.savePendingOrder(conversation.id, pendingOrder);
    }

    if (!conversation.context?.customer_data?.phone) {
      await this.conversationService.updateState(conversation.id, 'collecting_phone');
      return this.getPhonePrompt();
    }

    await this.conversationService.updateState(conversation.id, 'collecting_notes');
    return this.getNotesPrompt();
  }

  /**
   * ✅ NOVO: Faz parse básico do endereço
   */
  private parseAddress(addressText: string): {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  } | null {
    // Formato esperado: "Rua, número, complemento, bairro, cidade, estado, CEP"
    const parts = addressText.split(',').map(p => p.trim()).filter(Boolean);

    if (parts.length < 3) {
      return null; // Endereço muito simples, não consegue fazer parse
    }

    // Extrair CEP a partir do final
    let zipCode = '';
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const match = parts[i].match(/(\d{5}-?\d{3})/);
      if (match) {
        zipCode = match[1].replace('-', '');
        parts.splice(i, 1);
        break;
      }
    }

    // Estado = último item com 2 letras (se existir)
    let state = '';
    if (parts.length > 0) {
      const last = parts[parts.length - 1];
      if (/^[A-Za-z]{2}$/.test(last)) {
        state = last.toUpperCase();
        parts.pop();
      }
    }

    // Cidade e bairro (a partir do final)
    const city = parts.length > 0 ? parts.pop() || '' : '';
    const neighborhood = parts.length > 0 ? parts.pop() || '' : '';

    // Rua e número
    let street = parts.length > 0 ? parts.shift() || '' : '';
    let number = '';
    let complement: string | undefined;

    if (street) {
      const numberMatch = street.match(/(\d+)/);
      if (numberMatch) {
        number = numberMatch[1];
        street = street.replace(/\d+.*$/, '').trim();
      }
    }

    if (!number && parts.length > 0 && /^\d+[A-Za-z]?$/.test(parts[0])) {
      number = parts.shift() || '';
    }

    if (parts.length > 0) {
      complement = parts.join(', ').trim();
    }

    return {
      street: street || addressText,
      number: number || '',
      complement,
      neighborhood: neighborhood || '',
      city: city || '',
      state: state || '',
      zipCode: zipCode || '',
    };
  }

  /**
   * ✅ NOVO: Processa coleta de telefone do cliente
   */
  private async processCustomerPhone(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    // ✅ NOVO: Validar conversa
    if (!conversation) {
      return '❌ Erro ao processar. Tente novamente.';
    }

    const stateValidation = this.validateConversationState(conversation);
    if (!stateValidation.valid) {
      return `❌ ${stateValidation.error}`;
    }

    // ✅ NOVO: Sanitizar e validar telefone
    const sanitizedMessage = this.sanitizeInput(message.trim());
    const phone = sanitizedMessage.replace(/\D/g, ''); // Remove tudo que não é dígito
    
    const phoneValidation = this.validatePhone(phone);
    if (!phoneValidation.valid) {
      return `❌ ${phoneValidation.error}\n\n` +
             'Exemplo: (11) 98765-4321 ou 11987654321';
    }

    // Formatar telefone
    const formattedPhone = `+55${phone}`;

    // Salvar telefone
    await this.conversationService.saveCustomerData(conversation.id, { phone: formattedPhone });

    await this.conversationService.updateState(conversation.id, 'collecting_notes');
    return this.getNotesPrompt();
  }

  private async processCustomerNotes(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    if (!conversation) {
      return '❌ Erro ao processar. Tente novamente.';
    }

    const stateValidation = this.validateConversationState(conversation);
    if (!stateValidation.valid) {
      return `❌ ${stateValidation.error}`;
    }

    const sanitizedMessage = this.sanitizeInput(message.trim());
    const lowerMessage = sanitizedMessage.toLowerCase().trim();

    const noNotes =
      !lowerMessage ||
      lowerMessage === 'sem' ||
      lowerMessage === 'nao' ||
      lowerMessage === 'não' ||
      lowerMessage === 'nenhuma' ||
      lowerMessage === 'nenhum';

    if (!noNotes && sanitizedMessage.length > this.MAX_NOTES_LENGTH) {
      return `❌ Observações devem ter no máximo ${this.MAX_NOTES_LENGTH} caracteres.`;
    }

    await this.conversationService.saveCustomerData(conversation.id, {
      notes: noNotes ? '' : sanitizedMessage,
    });

    await this.conversationService.updateState(conversation.id, 'confirming_order');
    return await this.showOrderConfirmation(tenantId, conversation);
  }

  /**
   * ✅ NOVO: Mostra confirmação do pedido antes de criar
   */
  private async showOrderConfirmation(
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    if (!conversation) {
      return '❌ Erro ao processar. Tente novamente.';
    }
    const refreshed = await this.conversationService.findById(conversation.id);
    const activeConversation = refreshed ? toTypedConversation(refreshed) : conversation;

    const pendingOrder = activeConversation.context?.pending_order;
    const customerData = activeConversation.context?.customer_data as CustomerData | undefined;

    if (!pendingOrder) {
      return '❌ Pedido não encontrado. Por favor, faça um novo pedido.';
    }

    let message = `✅ *CONFIRMAÇÃO DO PEDIDO*\n\n`;
    
    // Itens
    message += `📦 *ITENS:*\n`;
    pendingOrder.items.forEach((item: PendingOrderItem) => {
      message += `• ${item.quantity}x ${item.produto_name} - R$ ${item.unit_price.toFixed(2).replace('.', ',')}\n`;
    });
    
    message += `\n💰 *VALORES:*\n`;
    message += `Subtotal: R$ ${pendingOrder.subtotal.toFixed(2).replace('.', ',')}\n`;
    if (pendingOrder.coupon_code) {
      message += `Cupom: ${String(pendingOrder.coupon_code).toUpperCase()}\n`;
    }
    if (pendingOrder.discount_amount > 0) {
      message += `Desconto: R$ ${pendingOrder.discount_amount.toFixed(2).replace('.', ',')}\n`;
    }
    if (pendingOrder.shipping_amount > 0) {
      message += `Frete: R$ ${pendingOrder.shipping_amount.toFixed(2).replace('.', ',')}\n`;
    }
    message += `*Total: R$ ${pendingOrder.total_amount.toFixed(2).replace('.', ',')}*\n\n`;

    // Dados do cliente
    if (customerData?.name) {
      message += `👤 *Cliente:* ${customerData.name}\n`;
    }
    if (customerData?.phone) {
      message += `📱 *Telefone:* ${customerData.phone}\n`;
    }
    if (customerData?.notes && customerData.notes.trim()) {
      message += `📝 *Observações:* ${customerData.notes.trim()}\n`;
    }
    if (customerData?.delivery_type === 'delivery' && customerData?.address) {
      const addressNumber = customerData.address.number ? `, ${customerData.address.number}` : '';
      const addressComplement = customerData.address.complement ? `, ${customerData.address.complement}` : '';
      message += `📍 *Endereço:* ${customerData.address.street}${addressNumber}${addressComplement}\n`;
      message += `   ${customerData.address.neighborhood}, ${customerData.address.city} - ${customerData.address.state}\n`;
    } else if (customerData?.delivery_type === 'pickup') {

      if (!customerData.phone) {
        await this.conversationService.updateState(conversation.id, 'collecting_phone');
        return this.getPhonePrompt();
      }
      message += `📍 *Retirada* (cliente busca)\n`;
    }

    message += `\n💬 *Confirma o pedido?*\n\n`;
    message += `Digite *"sim"* ou *"confirmar"* para finalizar.\n`;
    message += `Ou *"cancelar"* para cancelar.`;

    return message;
  }

  /**
   * ✅ NOVO: Processa confirmação do pedido
   */
  private async processOrderConfirmation(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    // ✅ NOVO: Validar conversa
    if (!conversation) {
      return '❌ Erro ao processar. Tente novamente.';
    }

    const stateValidation = this.validateConversationState(conversation);
    if (!stateValidation.valid) {
      return `❌ ${stateValidation.error}`;
    }

    // ✅ NOVO: Sanitizar mensagem
    const sanitizedMessage = this.sanitizeInput(message.trim());
    const lowerMessage = sanitizedMessage.toLowerCase().trim();

    if (this.isOrderIntent(lowerMessage)) {
      await this.conversationService.clearPendingOrder(conversation.id);
      await this.conversationService.clearPedido(conversation.id);
      await this.conversationService.clearCustomerData(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      conversation.context = {
        ...(conversation.context || {}),
        state: 'idle',
      };
      return await this.processOrder(message, tenantId, conversation);
    }
    
    // Verificar se é cancelamento
    if (lowerMessage.includes('cancelar') || (lowerMessage.includes('não') && !lowerMessage.includes('sim')) || lowerMessage.includes('nao')) {
      await this.conversationService.clearPendingOrder(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      return '❌ Pedido cancelado.\n\n💬 Como posso ajudar você?';
    }

    // Verificar se é confirmação
    if (!lowerMessage.includes('sim') && !lowerMessage.includes('confirmar') && !lowerMessage.includes('ok')) {
      return '❌ Não entendi. Digite *"sim"* ou *"confirmar"* para finalizar o pedido, ou *"cancelar"* para cancelar.';
    }

    // Buscar dados do pedido pendente e cliente
    const pendingOrder = conversation.context?.pending_order;
    const customerData = conversation.context?.customer_data as CustomerData | undefined;

    // ✅ NOVO: Validar pedido pendente
    if (!pendingOrder) {
      return '❌ Pedido não encontrado. Por favor, faça um novo pedido.';
    }

    const orderValidation = this.validatePendingOrder(pendingOrder);
    if (!orderValidation.valid) {
      this.logger.error(`Invalid pending order: ${orderValidation.error}`, {
        conversationId: conversation.id,
        customerPhone: conversation.customer_phone,
      });
      await this.conversationService.clearPendingOrder(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      return '❌ Erro no pedido pendente. Por favor, faça um novo pedido.';
    }

    // ✅ NOVO: Validar dados obrigatórios do cliente
    if (!customerData?.name) {
      return '❌ Nome do cliente não encontrado. Por favor, faça um novo pedido.';
    }

    if (!customerData?.phone) {
      await this.conversationService.updateState(conversation.id, 'collecting_phone');
      return this.getPhonePrompt();
    }

    const nameValidation = this.validateName(customerData.name);
    if (!nameValidation.valid) {
      return `❌ Nome do cliente inválido: ${nameValidation.error}. Por favor, faça um novo pedido.`;
    }

    // ✅ NOVO: Validar endereço se for entrega
    if (customerData.delivery_type === 'delivery' && customerData.address) {
      const addressString = `${customerData.address.street}, ${customerData.address.number}, ${customerData.address.neighborhood}, ${customerData.address.city}, ${customerData.address.state}`;
      const addressValidation = this.validateAddress(addressString);
      if (!addressValidation.valid) {
        return `❌ Endereço inválido: ${addressValidation.error}. Por favor, forneça um endereço válido.`;
      }
    }

    // Criar pedido real
    try {
      // ✅ IDEMPOTÊNCIA: impedir criação duplicada do mesmo pedido via WhatsApp
      const idempotencyKey = this.buildWhatsAppOrderIdempotencyKey(
        conversation,
        pendingOrder,
        customerData,
      );

      const pedido = await this.ordersService.create({
        channel: CanalVenda.WHATSAPP,
        customer_name: customerData.name,
        customer_phone: customerData.phone || conversation.customer_phone,
        customer_notes: customerData.notes?.trim() || undefined,
        delivery_type: customerData.delivery_type,
        delivery_address:
          customerData.delivery_type === 'delivery' && customerData.address
            ? {
                street: customerData.address.street,
                number: customerData.address.number,
                complement: customerData.address.complement,
                neighborhood: customerData.address.neighborhood,
                city: customerData.address.city,
                state: customerData.address.state,
                zipcode: (customerData.address as { zipcode?: string; zipCode?: string }).zipcode || 
                         (customerData.address as { zipcode?: string; zipCode?: string }).zipCode || '',
              }
            : undefined,
        items: pendingOrder.items.map((item: PendingOrderItem) => ({
          produto_id: item.produto_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        coupon_code: pendingOrder.coupon_code || undefined,
        discount_amount: pendingOrder.discount_amount,
        shipping_amount: pendingOrder.shipping_amount,
      }, tenantId, undefined, idempotencyKey);

      // Limpar pedido pendente
      await this.conversationService.clearPendingOrder(conversation.id);
      
      // Salvar pedido_id e atualizar estado
      await this.conversationService.setPedidoId(conversation.id, pedido.id);
      await this.conversationService.updateState(conversation.id, 'waiting_payment');

      const total = pendingOrder.total_amount;
      
      return `✅ *PEDIDO CRIADO COM SUCESSO!*\n\n` +
             `🆔 Código do pedido: *${pedido.order_no}*\n\n` +
             `💳 *ESCOLHA A FORMA DE PAGAMENTO:*\n\n` +
             `1️⃣ *PIX* - Desconto de 5% (R$ ${(total * 0.95).toFixed(2).replace('.', ',')})\n` +
             `2️⃣ *Cartão de Crédito*\n` +
             `3️⃣ *Cartão de Débito*\n` +
             `4️⃣ *Dinheiro* (retirada)\n\n` +
             `💬 Digite o número ou o nome do método de pagamento.\n` +
             `Exemplo: "1", "pix", "cartão de crédito"`;
    } catch (error) {
      this.logger.error('Error creating confirmed order', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          tenantId,
          customerPhone: conversation?.customer_phone,
          pendingOrder,
        },
      });
      
      return '❌ Ocorreu um erro ao criar seu pedido.\n\n' +
             '💬 Tente novamente em alguns instantes.';
    }
  }

  async sendMessage(to: string, message: string): Promise<void> {
    await this.notificationsService.sendWhatsAppMessage({
      to,
      message,
      metadata: { source: 'whatsapp_service' },
    });
  }
}
