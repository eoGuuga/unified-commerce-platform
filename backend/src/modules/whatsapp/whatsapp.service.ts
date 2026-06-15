import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantsService } from '../tenants/tenants.service';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CouponsService } from '../coupons/coupons.service';
import { DbContextService } from '../common/services/db-context.service';
import { CanalVenda } from '../../database/entities/Pedido.entity';

// Services de inteligência (mantidos para recursos avançados)
import { OpenAIService } from './services/openai.service';
import { MessageIntelligenceService } from './services/message-intelligence.service';
import { ConversationalIntelligenceService } from './services/conversational-intelligence.service';
import { ConversationPlannerService } from './services/conversation-planner.service';
import { SalesIntelligenceService } from './services/sales-intelligence.service';
import { SalesPlaybookService } from './services/sales-playbook.service';
import { ConversationService } from './services/conversation.service';
import { LLMRouterService } from './services/llm-router.service';
import { ActionExecutorService } from './services/action-executor.service';
import { BotConfigService } from './services/bot-config.service';
import { CacheService } from '../common/services/cache.service';

// NOVOS SERVICES - arquitetura limpa
import { MessageProcessorService } from './services/message-processor.service';
import { CatalogManagerService } from './services/catalog-manager.service';
import { ResponseBuilderService } from './services/response-builder.service';
import { CartService } from './services/cart.service';
import { WhatsAppErrorHandler } from './services/error-handler.service';
import { WhatsAppAnalyticsService } from './services/analytics.service';
import { ConversationManagerService } from './services/conversation-manager.service';

import { TypedConversation, ConversationState, CustomerData, PendingOrder } from './types/whatsapp.types';

export type WhatsAppOutboundResponse = string | { kind: 'interactive_list'; previewText: string; list: any };

export interface WhatsAppMessage {
  from: string;
  body: string;
  timestamp: string;
  tenantId: string;
  messageId?: string;
  messageType?: 'text' | 'image' | 'document' | 'button' | 'audio';
  mediaUrl?: string;
  metadata?: Record<string, unknown>;
}

interface StageRecoveryKind {
  phone?: string;
  address?: string;
  name?: string;
  confirmation?: string;
  notes?: string;
  delivery?: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly MAX_MESSAGE_LENGTH = 4096;

  constructor(
    // Legacy services (mantidos para compatibilidade)
    private readonly openAIService: OpenAIService,
    private readonly messageIntelligenceService: MessageIntelligenceService,
    private readonly conversationalIntelligenceService: ConversationalIntelligenceService,
    private readonly conversationPlannerService: ConversationPlannerService,
    private readonly salesIntelligenceService: SalesIntelligenceService,
    private readonly salesPlaybookService: SalesPlaybookService,
    private readonly cacheService: CacheService,
    private readonly conversationService: ConversationService,
    private readonly tenantsService: TenantsService,
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly notificationsService: NotificationsService,
    private readonly couponsService: CouponsService,
    private readonly llmRouterService: LLMRouterService,
    private readonly actionExecutorService: ActionExecutorService,
    private readonly botConfigService: BotConfigService,
    private readonly config: ConfigService,

    // NEW: Clean architecture services
    private readonly messageProcessor: MessageProcessorService,
    private readonly catalogManager: CatalogManagerService,
    private readonly responseBuilder: ResponseBuilderService,
    private readonly cartService: CartService,
    private readonly errorHandler: WhatsAppErrorHandler,
    private readonly analytics: WhatsAppAnalyticsService,
    private readonly conversationManager: ConversationManagerService,
    private readonly db: DbContextService,
  ) {}

  /**
   * ENTRY POINT - Processa mensagem de entrada
   */
  async processIncomingMessage(message: WhatsAppMessage): Promise<WhatsAppOutboundResponse> {
    const startTime = Date.now();

    try {
      // 1. Verificações básicas
      if (this.isGroupOrBroadcastMessage(message)) {
        this.logger.warn('Ignoring WhatsApp group/broadcast message', { from: message.from });
        return '';
      }

      if (this.isIgnoredInboundPhone(message.from)) {
        this.logger.warn('Ignoring WhatsApp message from blocked direct number', { from: message.from });
        return '';
      }

      if (!message.tenantId) {
        this.logger.error('Tenant ID missing from WhatsApp message', { from: message.from });
        throw new BadRequestException('Tenant ID é obrigatório para processar mensagens WhatsApp');
      }

      // 2. Validar tenant
      const tenant = await this.tenantsService.findOneById(message.tenantId);

      if (this.isIgnoredInboundPhone(message.from, tenant)) {
        this.logger.warn('Ignoring WhatsApp message from tenant-blocked direct number', {
          from: message.from,
          tenantId: message.tenantId,
        });
        return '';
      }

      // 3. Processar mensagem (nova arquitetura)
      const processed = this.messageProcessor.processMessage(message);

      // Validar corpo da mensagem
      if (!processed.sanitizedBody) {
        return '❌ Mensagem vazia ou inválida. Por favor, envie uma mensagem válida.';
      }

      if (processed.sanitizedBody.length > this.MAX_MESSAGE_LENGTH) {
        return `❌ Mensagem muito longa. Máximo ${this.MAX_MESSAGE_LENGTH} caracteres.`;
      }

      // 4. Verificar comando de controle do bot
      const botControlResponse = await this.tryHandleBotControlCommand(tenant, {
        body: processed.sanitizedBody,
        from: message.from,
      });
      if (botControlResponse !== null) {
        return botControlResponse;
      }

      // 5. Verificar abuso
      if (processed.containsAbusiveLanguage) {
        return this.responseBuilder.buildErrorMessage('abuse', false);
      }

      // 6. Obter ou criar conversa
      const conversation = await this.conversationService.getOrCreateConversation(
        message.tenantId,
        message.from,
      );

      // 7. Salvar mensagem de entrada
      await this.conversationService.saveMessage(
        conversation.id,
        'inbound',
        processed.sanitizedBody,
        message.messageType || 'text',
      );

      // 8. Detectar intent
      const intent = this.detectIntent(processed.sanitizedBody, conversation);

      // 9. Processar intent
      const response = await this.processByIntent(intent, {
        message,
        processed,
        conversation,
        tenant,
      });

      // 10. Salvar mensagem de saída
      if (response) {
        const responseText = typeof response === 'string' ? response : response.previewText;
        if (responseText) {
          await this.conversationService.saveMessage(
            conversation.id,
            'outbound',
            responseText,
            'text',
          );
        }
      }

      // 11. Track metrics
      await this.trackMessageMetrics(message, intent, Date.now() - startTime, true);

      return response || '';

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      console.error('[WhatsAppService] ERROR:', errorObj.message, errorObj.stack);

      this.logger.error('Error processing message', {
        error: errorObj.message,
        stack: errorObj.stack,
        message,
      });

      const fallback = this.errorHandler.handleError(errorObj, {
        tenantId: message.tenantId,
        customerPhone: message.from,
        action: 'processMessage',
      });

      await this.trackMessageMetrics(
        message,
        'error',
        Date.now() - startTime,
        false,
        fallback.message,
      );

      return fallback.message;
    }
  }

  /**
   * Envia resposta de saída (para o provider WhatsApp)
   */
  async sendOutboundResponse(to: string, response: WhatsAppOutboundResponse): Promise<void> {
    try {
      const messageContent = typeof response === 'string'
        ? response
        : response.previewText || '';

      if (!messageContent.trim()) {
        return;
      }

      // TODO: Integrar com Evolution API / Twilio
      this.logger.log('Sending outbound response', {
        to,
        preview: messageContent.substring(0, 50),
      });

    } catch (error) {
      this.logger.error('Failed to send outbound response', { error, to });
    }
  }

  // ============== INTENT DETECTION ==============

  private detectIntent(
    message: string,
    conversation: TypedConversation,
  ): 'greeting' | 'catalog' | 'cart' | 'order_status' | 'order_adjust' | 'payment' | 'help' | 'collection' | 'fallback' {
    const lower = message.toLowerCase().trim();
    const currentState = conversation.context?.state as ConversationState | undefined;

    // Verificar comandos de carrinho
    if (this.isCartCommand(lower)) {
      return 'cart';
    }

    // Verificar comandos de catálogo
    if (this.catalogManager.isCatalogCommand(lower)) {
      return 'catalog';
    }

    // Verificar status de pedido
    if (this.isOrderStatusIntent(lower)) {
      return 'order_status';
    }

    // Verificar intenção de pagamento
    if (this.isPaymentIntent(lower)) {
      return 'payment';
    }

    // Verificar ajuda
    if (lower.includes('ajuda') || lower === 'help' || lower === '?') {
      return 'help';
    }

    // Verificar saudação
    if (this.isGreetingIntent(lower)) {
      return 'greeting';
    }

    // Verificar se está em estado de coleta
    if (currentState && currentState !== 'idle' && currentState !== 'order_completed') {
      return 'collection';
    }

    // Verificar ajuste de pedido
    if (this.isOrderAdjustmentIntent(lower)) {
      return 'order_adjust';
    }

    // Verificar se tem pedido pendente
    const pendingOrder = conversation.context?.pending_order as PendingOrder | undefined;
    if (pendingOrder?.items?.length) {
      if (this.isProductIntent(lower)) {
        return 'cart';
      }
    }

    return 'fallback';
  }

  // ============== INTENT HANDLERS ==============

  private async processByIntent(
    intent: string,
    context: {
      message: WhatsAppMessage;
      processed: { sanitizedBody: string; normalizedBody: string };
      conversation: TypedConversation;
      tenant: any;
    },
  ): Promise<WhatsAppOutboundResponse> {
    switch (intent) {
      case 'greeting':
        return this.handleGreeting(context.conversation);

      case 'catalog':
        return await this.handleCatalog(
          context.message.tenantId,
          context.processed.sanitizedBody,
        );

      case 'cart':
        return await this.handleCart(
          context.message.tenantId,
          context.message.from,
          context.processed.sanitizedBody,
          context.conversation,
        );

      case 'order_status':
        return await this.handleOrderStatus(
          context.message.tenantId,
          context.message.from,
          context.processed.sanitizedBody,
          context.conversation,
        );

      case 'order_adjust':
        return await this.handleOrderAdjustment(
          context.message.tenantId,
          context.message.from,
          context.processed.sanitizedBody,
          context.conversation,
        );

      case 'payment':
        return await this.handlePayment(
          context.message.tenantId,
          context.message.from,
          context.processed.sanitizedBody,
          context.conversation,
        );

      case 'help':
        return this.responseBuilder.buildHelpMessage();

      case 'collection':
        return await this.handleCollectionStage(
          context.message.tenantId,
          context.processed.sanitizedBody,
          context.conversation,
        );

      default:
        return await this.handleFallback(
          context.message.tenantId,
          context.processed.sanitizedBody,
          context.conversation,
        );
    }
  }

  private handleGreeting(conversation: TypedConversation): WhatsAppOutboundResponse {
    const customerName = conversation.customer_name;
    return this.responseBuilder.buildGreeting(customerName);
  }

  private async handleCatalog(
    tenantId: string,
    message: string,
  ): Promise<WhatsAppOutboundResponse> {
    const selection = this.catalogManager.parseCatalogSelection(message);

    const response = await this.catalogManager.buildInteractiveCatalogResponse(
      tenantId,
      selection || undefined,
    );

    if (!response) {
      return 'Não temos produtos no momento. 😔';
    }

    return response;
  }

  private async handleCart(
    tenantId: string,
    customerPhone: string,
    message: string,
    conversation: TypedConversation,
  ): Promise<WhatsAppOutboundResponse> {
    const lower = message.toLowerCase().trim();

    // Verificar comandos diretos de carrinho primeiro
    if (lower === 'carrinho' || lower === 'ver carrinho' || lower === 'meu carrinho') {
      return this.handleCartCommand(tenantId, customerPhone, message);
    }

    // Verificar intenção de finalizar/confirmar pedido
    if (lower.includes('finalizar') || lower.includes('confirmar') || lower.includes('fechar pedido')) {
      return this.handleCheckout(tenantId, customerPhone);
    }

    // Verificar se é intenção de adicionar produto
    const addKeywords = ['adicionar', 'colocar', 'add', 'quero esse', 'quero este', 'comprar'];
    const isAddIntent = addKeywords.some(k => lower.includes(k));

    if (isAddIntent) {
      try {
        // Extrair nome do produto da mensagem
        const productName = lower
          .replace(/adicionar\s*/gi, '')
          .replace(/colocar\s*/gi, '')
          .replace(/add\s*/gi, '')
          .replace(/^quero\s+(esse|este)\s*/gi, '')
          .replace(/comprar\s*/gi, '')
          .trim();

        if (productName && productName.length > 1) {
          const products = await this.productsService.search(tenantId, productName);
          if (products.length > 0) {
            const product = products[0];
            await this.cartService.addItem({
              tenantId,
              customerPhone,
              produtoId: product.id,
              produtoName: product.name,
              quantity: 1,
              unitPrice: Number(product.price),
            });
            return `✅ Adicionado 1x ${product.name} - R$ ${Number(product.price).toFixed(2)} ao seu carrinho!`;
          } else {
            return `😕 Não encontrei nenhum produto chamado "${productName}". Tente "ver produtos" para ver o cardápio.`;
          }
        }
      } catch (error) {
        this.logger.error('Error adding product to cart', { error, message });
      }
    }

    return this.handleCartCommand(tenantId, customerPhone, message);
  }

  private async handleCartCommand(
    tenantId: string,
    customerPhone: string,
    message: string,
  ): Promise<WhatsAppOutboundResponse> {
    const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);

    if (cart.items.length === 0) {
      return this.responseBuilder.buildEmptyCartResponse();
    }

    return this.cartService.generateSummary(cart);
  }

  private async handleOrderStatus(
    tenantId: string,
    customerPhone: string,
    message: string,
    conversation: TypedConversation,
  ): Promise<WhatsAppOutboundResponse> {
    const orderNo = this.extractOrderNo(message);

    if (orderNo) {
      const pedido = await this.ordersService.findByOrderNo(orderNo, tenantId);
      if (pedido) {
        return this.responseBuilder.buildOrderStatusMessage(pedido);
      }
    }

    const pedido = await this.ordersService.findLatestByCustomerPhone(
      tenantId,
      customerPhone,
    );
    if (pedido) {
      return this.responseBuilder.buildOrderStatusMessage(pedido);
    }

    return 'Não encontrei pedidos recentes. Quer ver o cardápio?';
  }

  private async handleCheckout(
    tenantId: string,
    customerPhone: string,
  ): Promise<WhatsAppOutboundResponse> {
    try {
      const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);

      if (cart.items.length === 0) {
        return '🛒 Seu carrinho está vazio! Adicione itens primeiro.';
      }

      const order = await this.ordersService.create(
        {
          channel: CanalVenda.WHATSAPP,
          customer_phone: customerPhone,
          customer_name: undefined,
          items: cart.items.map((item: any) => ({
            produto_id: item.produto_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
          shipping_amount: Number(cart.shipping_amount) || 10,
          discount_amount: Number(cart.discount_amount) || 0,
          coupon_code: cart.coupon_code,
        },
        tenantId,
      );

      // Atualizar status do carrinho para convertido
      await this.cartService.markAsConverted(cart.id);

      return [
        `✅ *Pedido #${order.id.substring(0, 8).toUpperCase()} confirmado!*`,
        '',
        `📦 *Resumo:*`,
        cart.items.map((item: any, i: number) =>
          `${i + 1}. ${item.produto_name} x${item.quantity}`
        ).join('\n'),
        '',
        `💰 *Total: R$ ${Number(order.total_amount).toFixed(2)}*`,
        '',
        'Agora preciso do endereço de entrega. Qual seu endereço completo?',
      ].join('\n');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error during checkout', {
        error: err.message,
        tenantId,
        customerPhone
      });
      return '😕 Houve um erro ao processar seu pedido. Tente novamente.';
    }
  }

  private async handleOrderAdjustment(
    tenantId: string,
    customerPhone: string,
    message: string,
    conversation: TypedConversation,
  ): Promise<WhatsAppOutboundResponse> {
    // Simplificado - verificar se é ajuste de carrinho
    const lower = message.toLowerCase();
    const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);

    if (lower.includes('remover') || lower.includes('tirar')) {
      // Extrair nome do produto
      const productName = lower.replace(/remover|tirar/g, '').trim();
      if (productName) {
        const item = cart.items.find(i => i.produto_name.toLowerCase().includes(productName.toLowerCase()));
        if (item) {
          const updatedCart = await this.cartService.removeItem(cart.id, item.produto_id);
          return `Removido "${item.produto_name}" do carrinho.`;
        }
      }
    }

    return this.handleCartCommand(tenantId, customerPhone, message);
  }

  private async handlePayment(
    tenantId: string,
    customerPhone: string,
    message: string,
    conversation: TypedConversation,
  ): Promise<WhatsAppOutboundResponse> {
    const lower = message.toLowerCase();
    const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);

    if (cart.items.length === 0) {
      return '🛒 Seu carrinho está vazio. Adicione itens primeiro!';
    }

    if (lower.includes('pix')) {
      return [
        '💳 *Pagamento via PIX*',
        '',
        `Total: R$ ${Number(cart.total_amount).toFixed(2).replace('.', ',')}`,
        '',
        'Chave PIX: 00000000000',
        '',
        'Após o pagamento, envie o comprovante.',
      ].join('\n');
    }

    return [
      '💳 *Forma de pagamento*',
      '',
      `Total: R$ ${Number(cart.total_amount).toFixed(2).replace('.', ',')}`,
      '',
      '1. PIX (à vista)',
      '2. Cartão na entrega',
      '3. Dinheiro',
      '',
      'Escolha uma opção ou digite "pix".',
    ].join('\n');
  }

  private async handleCollectionStage(
    tenantId: string,
    message: string,
    conversation: TypedConversation,
  ): Promise<WhatsAppOutboundResponse> {
    // Simplificado - apenas coletar informações básicas
    const currentState =
      (conversation.context?.state as ConversationState) || 'collecting_order';

    switch (currentState) {
      case 'collecting_name':
        await this.conversationService.updateContext(conversation.id, {
          state: 'collecting_phone',
          customer_data: { ...conversation.context?.customer_data, name: message },
        });
        return 'Qual é o seu telefone?';

      case 'collecting_phone':
        await this.conversationService.updateContext(conversation.id, {
          state: 'collecting_address',
          customer_data: { ...conversation.context?.customer_data, phone: message },
        });
        return 'Qual é o endereço de entrega?';

      case 'collecting_address':
        await this.conversationService.updateContext(conversation.id, {
          state: 'confirming_order',
          customer_data: { ...conversation.context?.customer_data, address: message },
        });
        return this.responseBuilder.buildConfirmationMessage(
          'Confirma o pedido com esses dados?',
        );

      case 'confirming_order':
        const lower = message.toLowerCase();
        if (lower.includes('sim') || lower.includes('confirmar')) {
          await this.conversationService.updateContext(conversation.id, {
            state: 'order_confirmed',
          });
          return '✅ Pedido confirmado! Estamos preparando...';
        }
        return 'Ok, pode corrigir as informações.';

      default:
        return 'O que você gostaria de fazer?';
    }
  }

  private async handleFallback(
    tenantId: string,
    message: string,
    conversation: TypedConversation,
  ): Promise<WhatsAppOutboundResponse> {
    if (this.isProductIntent(message)) {
      return await this.handleCart(
        tenantId,
        conversation.customer_phone,
        message,
        conversation,
      );
    }

    try {
      const botConfig = await this.botConfigService.loadConfig(tenantId);

      const decision = await this.llmRouterService.route({
        message,
        botConfig,
        catalogSummary: [],
        currentState: conversation.context?.state || null,
        recentMessages: [],
        customerName: conversation.customer_name,
      });

      const executionResult = await this.actionExecutorService.execute(decision, {
        tenantId,
        conversation: conversation as any,
        botConfig,
        message,
        customerName: conversation.customer_name,
      });

      return executionResult.response;
    } catch (error) {
      this.logger.warn('LLM fallback failed', { error, message });
      return this.responseBuilder.buildHelpMessage();
    }
  }

  // ============== BOT CONTROL ==============

  private async tryHandleBotControlCommand(
    tenant: any,
    message: { body: string; from: string },
  ): Promise<WhatsAppOutboundResponse | null> {
    const normalized = String(message.body || '').trim().toLowerCase();
    if (!/^#?bot\s+\S+\s+(ligar|desligar|status|on|off)$/i.test(normalized)) {
      return null;
    }

    const match = normalized.match(/^#?bot\s+(\S+)\s+(ligar|desligar|status|on|off)$/i);
    if (!match) return null;

    const code = match[1];
    const actionToken = match[2].toLowerCase();

    if (tenant.settings?.bot_control_code !== code) {
      return '❌ Código incorreto.';
    }

    const action =
      actionToken === 'ligar' || actionToken === 'on'
        ? 'on'
        : actionToken === 'desligar' || actionToken === 'off'
          ? 'off'
          : 'status';

    switch (action) {
      case 'status':
        const enabled = tenant.settings?.whatsapp_enabled !== false;
        return `🤖 Bot: ${enabled ? 'Ligado' : 'Desligado'}`;

      case 'on':
        await this.tenantsService.updateSettings(tenant.id, { whatsapp_enabled: true });
        return '✅ Bot ligado!';

      case 'off':
        await this.tenantsService.updateSettings(tenant.id, { whatsapp_enabled: false });
        return '👋 Bot desligado!';

      default:
        return null;
    }
  }

  // ============== HELPERS ==============

  private isGroupOrBroadcastMessage(message: WhatsAppMessage): boolean {
    const chatType = (message.metadata?.chatType as string || '').toLowerCase();
    const candidateJids = [
      String(message.from || '').trim(),
      message.metadata?.sourceJid as string,
      message.metadata?.remoteJid as string,
    ].filter(Boolean);

    const explicitGroupFlag =
      message.metadata?.isGroupMessage === true ||
      message.metadata?.isGroup === true ||
      chatType === 'group';
    const explicitBroadcastFlag =
      message.metadata?.isBroadcastMessage === true ||
      chatType === 'broadcast';

    return (
      explicitGroupFlag ||
      explicitBroadcastFlag ||
      candidateJids.some((jid) => jid.endsWith('@g.us') || jid === 'status@broadcast')
    );
  }

  private isIgnoredInboundPhone(phoneNumber: string, tenant?: any): boolean {
    const ignoredPhonesEnv = String(process.env.WHATSAPP_IGNORED_PHONES || '').trim();
    const ignoredPhones = ignoredPhonesEnv
      ? ignoredPhonesEnv.split(/[\s,;]+/).map((p) => p.replace(/\D/g, ''))
      : [];

    const normalizedPhone = phoneNumber.replace(/\D/g, '');

    for (const ignored of ignoredPhones) {
      if (normalizedPhone === ignored) return true;
      if (normalizedPhone.slice(-11) === ignored.slice(-11)) return true;
    }

    if (tenant?.settings?.ignored_phones) {
      const tenantIgnored = tenant.settings.ignored_phones as string[];
      for (const ignored of tenantIgnored) {
        if (normalizedPhone === ignored.replace(/\D/g, '')) return true;
      }
    }

    return false;
  }

  private isCartCommand(message: string): boolean {
    const commands = [
      'carrinho', 'ver carrinho', 'mostrar carrinho', 'meu carrinho',
      'adicionar', 'remover', 'tirar', 'limpar', 'esvaziar',
      'add', 'delete', 'clear',
      'finalizar', 'confirmar', 'fechar pedido', 'encerrar',
    ];
    return commands.some((cmd) => message.includes(cmd));
  }

  private isOrderStatusIntent(message: string): boolean {
    const patterns = ['status', 'pedido', 'onde', 'quando', 'rastreio', 'entrega'];
    return patterns.some((p) => message.includes(p));
  }

  private isPaymentIntent(message: string): boolean {
    const patterns = ['pix', 'cartão', 'cartao', 'dinheiro', 'pagar', 'pagamento'];
    return patterns.some((p) => message.includes(p));
  }

  private isGreetingIntent(message: string): boolean {
    const greetings = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'eai', 'eaí'];
    return greetings.some((g) => message.startsWith(g));
  }

  private isProductIntent(message: string): boolean {
    const patterns = ['manda', 'quero', 'preciso', 'gostaria', 'procurando', 'procura'];
    return patterns.some((p) => message.includes(p)) || /^\d+\s+/.test(message);
  }

  private isOrderAdjustmentIntent(message: string): boolean {
    const patterns = ['remover', 'tirar', 'quantidade', 'qtd', 'alterar', 'mudar', 'update'];
    return patterns.some((p) => message.includes(p));
  }

  private extractOrderNo(message: string): string | null {
    const match = message.match(/(?:pedido\s*)?([A-Z]{2,3}-\d+|\d{5,})/i);
    return match ? match[1] : null;
  }

  private async trackMessageMetrics(
    message: WhatsAppMessage,
    intent: string,
    processingTimeMs: number,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.analytics.trackMessage({
        tenantId: message.tenantId,
        timestamp: new Date(),
        messageId: message.messageId || '',
        customerPhone: message.from,
        direction: 'inbound',
        messageType: message.messageType || 'text',
        processingTimeMs,
        intent,
        success,
        errorMessage,
      });
    } catch (error) {
      this.logger.warn('Failed to track message metrics', { error });
    }
  }
}

// Alias para compatibilidade com código legacy
export const WhatsappService = WhatsAppService;