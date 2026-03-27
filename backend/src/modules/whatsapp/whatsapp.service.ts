import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIService } from './services/openai.service';
import { MessageIntelligenceService } from './services/message-intelligence.service';
import {
  ConversationalAnalysis,
  ConversationalIntelligenceService,
} from './services/conversational-intelligence.service';
import { ConversationPlan, ConversationPlannerService } from './services/conversation-planner.service';
import {
  SalesConversationAnalysis,
  SalesIntelligenceService,
} from './services/sales-intelligence.service';
import {
  SalesPlaybookProfile,
  SalesPlaybookService,
} from './services/sales-playbook.service';
import {
  SalesConversationStrategy,
  SalesSegmentStrategyService,
} from './services/sales-segment-strategy.service';
import {
  SalesVerticalCrossSellSuggestion,
  SalesVerticalPackProfile,
  SalesVerticalPackService,
} from './services/sales-vertical-pack.service';
import {
  CatalogSalesContextService,
  CatalogSalesProfile,
} from './services/catalog-sales-context.service';
import {
  ProductOfferIntelligenceService,
} from './services/product-offer-intelligence.service';
import { ConversationService } from './services/conversation.service';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService, CreatePaymentDto } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CacheService } from '../common/services/cache.service';
import { TenantsService } from '../tenants/tenants.service';
import { CanalVenda, PedidoStatus, Pedido } from '../../database/entities/Pedido.entity';
import { MetodoPagamento } from '../../database/entities/Pagamento.entity';
import { Tenant } from '../../database/entities/Tenant.entity';
import { TypedConversation, ProductSearchResult, toTypedConversation, ConversationState, CustomerData, PendingOrder, PendingOrderItem, StockAdjustmentContext, ConversationIntelligenceMemory } from './types/whatsapp.types';
import { ProductWithStock } from '../products/types/product.types';
import * as crypto from 'crypto';
import { CouponsService } from '../coupons/coupons.service';

export interface WhatsappMessage {
  from: string;
  body: string;
  timestamp: string;
  tenantId?: string;
  messageId?: string;
  messageType?: 'text' | 'image' | 'document' | 'button' | 'audio';
  mediaUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ProductInfo {
  name: string;
  price: number;
  stock: number;
}

type CatalogSelection =
  | { type: 'root' }
  | { type: 'root_page'; page: number }
  | { type: 'category'; key: string }
  | { type: 'category_page'; key: string; page: number }
  | { type: 'product'; productId: string }
  | { type: 'buy'; productId: string }
  | { type: 'similar'; productId: string }
  | { type: 'recommendation'; mode: 'gift' | 'budget' | 'chocolate' | 'self_treat' };

export interface WhatsAppInteractiveListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppInteractiveListSection {
  title: string;
  rows: WhatsAppInteractiveListRow[];
}

export interface WhatsAppInteractiveListMessage {
  title: string;
  description: string;
  buttonText: string;
  footerText?: string;
  sections: WhatsAppInteractiveListSection[];
}

export type WhatsappOutboundResponse =
  | string
  | {
      kind: 'interactive_list';
      previewText: string;
      list: WhatsAppInteractiveListMessage;
    };

type StageRecoveryKind =
  | 'phone'
  | 'address'
  | 'delivery'
  | 'confirmation'
  | 'notes'
  | 'name';

type RankedSalesProduct = {
  product: ProductWithStock;
  score: number;
  reasons: string[];
};

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
  private readonly CATALOG_CATEGORY_PAGE_SIZE = 5;
  private readonly CATALOG_PRODUCT_PAGE_SIZE = 6;
  private readonly BRAZIL_STATE_CODES = new Set([
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ]);
  private readonly BRAZIL_STATE_NAME_TO_CODE: Record<string, string> = {
    acre: 'AC',
    alagoas: 'AL',
    amapa: 'AP',
    amazonas: 'AM',
    bahia: 'BA',
    ceara: 'CE',
    'distrito federal': 'DF',
    'espirito santo': 'ES',
    goias: 'GO',
    maranhao: 'MA',
    'mato grosso': 'MT',
    'mato grosso do sul': 'MS',
    'minas gerais': 'MG',
    para: 'PA',
    paraiba: 'PB',
    parana: 'PR',
    pernambuco: 'PE',
    piaui: 'PI',
    'rio de janeiro': 'RJ',
    'rio grande do norte': 'RN',
    'rio grande do sul': 'RS',
    rondonia: 'RO',
    roraima: 'RR',
    'santa catarina': 'SC',
    'sao paulo': 'SP',
    sergipe: 'SE',
    tocantins: 'TO',
  };
  private readonly GENERIC_SEARCH_TOKENS = new Set([
    'produto',
    'produtos',
    'item',
    'itens',
    'doce',
    'doces',
    'sabor',
    'sabores',
    'tradicional',
    'premium',
    'gourmet',
    'combo',
    'kit',
    'caixa',
    'presente',
    'presenteavel',
    'individual',
    'unidade',
    'unidades',
    'bolo',
    'bala',
    'docinho',
    'docinhos',
  ]);
  // frete simples (dev/whatsapp) - configurável via env WHATSAPP_DEFAULT_SHIPPING_AMOUNT (fallback 10)

  constructor(
    private config: ConfigService,
    private openAIService: OpenAIService,
    private messageIntelligenceService: MessageIntelligenceService,
    private conversationalIntelligenceService: ConversationalIntelligenceService,
    private conversationPlannerService: ConversationPlannerService,
    private salesIntelligenceService: SalesIntelligenceService,
    private salesPlaybookService: SalesPlaybookService,
    private salesSegmentStrategyService: SalesSegmentStrategyService,
    private salesVerticalPackService: SalesVerticalPackService,
    private catalogSalesContextService: CatalogSalesContextService,
    private productOfferIntelligenceService: ProductOfferIntelligenceService,
    private cacheService: CacheService,
    private conversationService: ConversationService,
    private tenantsService: TenantsService,
    private productsService: ProductsService,
    private ordersService: OrdersService,
    private paymentsService: PaymentsService,
    private couponsService: CouponsService,
    private notificationsService: NotificationsService,
  ) {}

  private normalizePhoneForControl(phoneNumber?: string | null): string {
    return String(phoneNumber || '').replace(/\D/g, '');
  }

  private getTenantSettingValue<T = unknown>(tenant: Tenant, keys: string[]): T | undefined {
    const settings = (tenant?.settings || {}) as Record<string, unknown>;

    for (const key of keys) {
      if (settings[key] !== undefined && settings[key] !== null) {
        return settings[key] as T;
      }
    }

    return undefined;
  }

  private getBotControlNumbers(tenant: Tenant): string[] {
    const configured =
      this.getTenantSettingValue<string[]>(tenant, [
        'whatsappBotControlNumbers',
        'whatsapp_bot_control_numbers',
        'botControlNumbers',
        'bot_control_numbers',
      ]) || [];

    if (Array.isArray(configured) && configured.length > 0) {
      return configured.map((item) => this.normalizePhoneForControl(item)).filter(Boolean);
    }

    const fallback =
      this.getTenantSettingValue<string[]>(tenant, ['whatsappNumbers', 'whatsapp_numbers']) || [];

    return Array.isArray(fallback)
      ? fallback.map((item) => this.normalizePhoneForControl(item)).filter(Boolean)
      : [];
  }

  private getBotControlCode(tenant: Tenant): string | null {
    const configured = this.getTenantSettingValue<string>(tenant, [
      'whatsappBotControlCode',
      'whatsapp_bot_control_code',
      'botControlCode',
      'bot_control_code',
    ]);

    const fallback = this.config.get<string>('WHATSAPP_BOT_CONTROL_CODE');
    return String(configured || fallback || '').trim() || null;
  }

  private isBotEnabled(tenant: Tenant): boolean {
    const explicit = this.getTenantSettingValue<boolean>(tenant, [
      'whatsappBotEnabled',
      'whatsapp_bot_enabled',
      'botEnabled',
      'bot_enabled',
    ]);

    if (typeof explicit === 'boolean') {
      return explicit;
    }

    return true;
  }

  private isAuthorizedBotControlSender(tenant: Tenant, phoneNumber: string): boolean {
    const normalizedPhone = this.normalizePhoneForControl(phoneNumber);
    const controlNumbers = this.getBotControlNumbers(tenant);

    return controlNumbers.some((configuredNumber) => {
      if (normalizedPhone === configuredNumber) {
        return true;
      }

      const last9Phone = normalizedPhone.slice(-9);
      const last9Configured = configuredNumber.slice(-9);
      if (last9Phone === last9Configured && last9Phone.length === 9) {
        return true;
      }

      const last11Phone = normalizedPhone.slice(-11);
      const last11Configured = configuredNumber.slice(-11);
      if (last11Phone === last11Configured && last11Phone.length === 11) {
        return true;
      }

      return false;
    });
  }

  private parseBotControlCommand(message: string): {
    matched: boolean;
    code?: string;
    action?: 'status' | 'on' | 'off';
  } {
    const normalized = String(message || '').trim();
    const match = normalized.match(/^#?bot\s+(\S+)\s+(ligar|desligar|status|on|off)$/i);

    if (!match) {
      return { matched: false };
    }

    const actionToken = match[2].toLowerCase();
    const action =
      actionToken === 'ligar' || actionToken === 'on'
        ? 'on'
        : actionToken === 'desligar' || actionToken === 'off'
          ? 'off'
          : 'status';

    return {
      matched: true,
      code: match[1],
      action,
    };
  }

  private buildBotControlStatusMessage(enabled: boolean): string {
    return enabled
      ? 'BOT ATIVO\n\nO atendimento automatico esta ligado e respondendo normalmente.'
      : 'BOT PAUSADO\n\nO atendimento automatico esta desligado. As mensagens ficam sem fluxo automatico ate voce religar.';
  }

  private async tryHandleBotControlCommand(
    tenant: Tenant,
    message: WhatsappMessage,
  ): Promise<WhatsappOutboundResponse | null> {
    const command = this.parseBotControlCommand(message.body || '');
    if (!command.matched) {
      return null;
    }

    if (!this.isAuthorizedBotControlSender(tenant, message.from)) {
      return null;
    }

    const configuredCode = this.getBotControlCode(tenant);
    if (!configuredCode) {
      return 'Canal administrativo indisponivel. Configure primeiro o codigo de controle do bot.';
    }

    if (String(command.code || '').trim() !== configuredCode) {
      return 'Codigo administrativo invalido.';
    }

    if (command.action === 'status') {
      return this.buildBotControlStatusMessage(this.isBotEnabled(tenant));
    }

    const nextEnabled = command.action === 'on';
    await this.tenantsService.updateSettings(tenant.id, {
      whatsappBotEnabled: nextEnabled,
    });

    return nextEnabled
      ? 'BOT LIGADO\n\nPronto. O atendimento automatico voltou a responder normalmente.'
      : 'BOT DESLIGADO\n\nPronto. O atendimento automatico foi pausado e nao vai mais responder clientes ate voce religar.';
  }

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
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/[<>]/g, '')
      .replace(/['"]/g, '');

    return sanitized.replace(/\s+/g, ' ').trim();
  }

  private getDefaultShippingAmount(): number {
    const raw = (this.config.get<string>('WHATSAPP_DEFAULT_SHIPPING_AMOUNT') || '').trim();
    if (!raw) return 10;
    const parsed = Number(raw.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    return 10;
  }

  private supportsInteractiveListMessaging(): boolean {
    const provider = (process.env.WHATSAPP_PROVIDER || 'mock').toLowerCase();
    return provider === 'evolution' || provider === 'mock';
  }

  private isInteractiveListResponse(
    response: WhatsappOutboundResponse,
  ): response is Extract<WhatsappOutboundResponse, { kind: 'interactive_list' }> {
    return typeof response !== 'string' && response.kind === 'interactive_list';
  }

  private getOutboundPreview(response: WhatsappOutboundResponse): string {
    return this.isInteractiveListResponse(response) ? response.previewText : response;
  }

  private serializeOutboundResponse(response: WhatsappOutboundResponse): string | null {
    try {
      return JSON.stringify(response);
    } catch {
      return null;
    }
  }

  private deserializeOutboundResponse(payload: unknown): WhatsappOutboundResponse | null {
    if (!payload) {
      return null;
    }

    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload) as WhatsappOutboundResponse;
        if (
          typeof parsed === 'string' ||
          (parsed &&
            typeof parsed === 'object' &&
            'kind' in parsed &&
            (parsed as any).kind === 'interactive_list')
        ) {
          return parsed;
        }
      } catch {
        return payload;
      }
    }

    if (
      typeof payload === 'object' &&
      payload !== null &&
      'kind' in payload &&
      (payload as any).kind === 'interactive_list'
    ) {
      return payload as WhatsappOutboundResponse;
    }

    return null;
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

  private getConversationIntelligenceMemory(
    conversation?: TypedConversation,
  ): ConversationIntelligenceMemory {
    return (conversation?.context?.intelligence_memory || {}) as ConversationIntelligenceMemory;
  }

  private buildMessageContextSnapshot(conversation?: TypedConversation) {
    const memory = this.getConversationIntelligenceMemory(conversation);
    return {
      lastIntent: memory.last_intent || null,
      lastProductName: memory.last_product_name || null,
      lastProductNames: memory.last_product_names || null,
      lastQuantity:
        typeof memory.last_quantity === 'number' && memory.last_quantity > 0
          ? memory.last_quantity
          : null,
      lastQuery: memory.last_query || null,
    };
  }

  private buildUniqueProductNames(
    names: Array<string | null | undefined>,
  ): string[] {
    return Array.from(
      new Set(
        names
          .map((name) => (name || '').trim())
          .filter((name) => name.length >= 2),
      ),
    );
  }

  private readMetadataString(message: WhatsappMessage, key: string): string {
    const value = message.metadata?.[key];
    return typeof value === 'string' ? value.trim() : '';
  }

  private readMetadataBoolean(message: WhatsappMessage, key: string): boolean {
    const value = message.metadata?.[key];
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  private isGroupOrBroadcastMessage(message: WhatsappMessage): boolean {
    const chatType = this.readMetadataString(message, 'chatType').toLowerCase();
    const candidateJids = [
      String(message.from || '').trim(),
      this.readMetadataString(message, 'sourceJid'),
      this.readMetadataString(message, 'remoteJid'),
    ].filter(Boolean);

    const explicitGroupFlag =
      this.readMetadataBoolean(message, 'isGroupMessage') ||
      this.readMetadataBoolean(message, 'isGroup') ||
      chatType === 'group';
    const explicitBroadcastFlag =
      this.readMetadataBoolean(message, 'isBroadcastMessage') ||
      chatType === 'broadcast';

    return (
      explicitGroupFlag ||
      explicitBroadcastFlag ||
      candidateJids.some((jid) => jid.endsWith('@g.us') || jid === 'status@broadcast')
    );
  }

  private async rememberConversationIntelligence(
    conversation: TypedConversation | undefined,
    updates: Partial<ConversationIntelligenceMemory>,
  ): Promise<void> {
    if (!conversation) {
      return;
    }

    const currentMemory = this.getConversationIntelligenceMemory(conversation);
    const nextMemory: ConversationIntelligenceMemory = {
      ...currentMemory,
      ...updates,
      last_reference_at: new Date().toISOString(),
    };

    if (nextMemory.last_product_names) {
      nextMemory.last_product_names = this.buildUniqueProductNames(nextMemory.last_product_names);
    }

    await this.conversationService.updateContext(conversation.id, {
      intelligence_memory: nextMemory,
    });

    conversation.context = {
      ...(conversation.context || {}),
      intelligence_memory: nextMemory,
    };
  }

  private async rememberPendingOrderIntelligence(
    conversation: TypedConversation | undefined,
    pendingOrder: PendingOrder,
  ): Promise<void> {
    const productNames = this.buildUniqueProductNames(
      pendingOrder.items.map((item) => item.produto_name),
    );
    const singleItem = pendingOrder.items.length === 1 ? pendingOrder.items[0] : null;

    await this.rememberConversationIntelligence(conversation, {
      last_intent: 'order',
      last_product_name: singleItem?.produto_name || null,
      last_product_names: productNames,
      last_quantity: singleItem ? Number(singleItem.quantity || 0) : null,
      last_query: singleItem?.produto_name || productNames[0] || null,
    });
  }

  private getConversationStageLabel(
    currentState?: ConversationState,
    customerData?: CustomerData,
  ): string {
    switch (currentState) {
      case 'collecting_order':
        return 'Montando o pedido';
      case 'collecting_name':
        return 'Coletando o nome do cliente';
      case 'collecting_address':
        return customerData?.delivery_type
          ? 'Coletando o endereco de entrega'
          : 'Escolhendo entrega ou retirada';
      case 'collecting_phone':
        return 'Coletando o telefone de contato';
      case 'collecting_notes':
        return 'Coletando observacoes finais';
      case 'collecting_cash_change':
        return 'Coletando informacao de troco';
      case 'confirming_stock_adjustment':
        return 'Confirmando ajuste por estoque';
      case 'confirming_order':
        return 'Revisando o pedido antes de fechar';
      case 'waiting_payment':
        return 'Aguardando pagamento';
      case 'order_confirmed':
        return 'Pedido confirmado';
      case 'order_completed':
        return 'Pedido concluido';
      default:
        return 'Conversa aberta';
    }
  }

  private getCollectionStageRequirement(
    currentState: ConversationState,
    conversation?: TypedConversation,
  ): string {
    const customerData = conversation?.context?.customer_data as CustomerData | undefined;

    switch (currentState) {
      case 'collecting_name':
        return 'do nome completo de quem vai receber o pedido';
      case 'collecting_address':
        return customerData?.delivery_type === 'delivery'
          ? 'do endereco de entrega'
          : 'de como voce prefere receber: entrega ou retirada';
      case 'collecting_phone':
        return 'do telefone de contato com DDD';
      default:
        return 'da etapa atual do pedido';
    }
  }

  private getCollectionStageHint(
    currentState: ConversationState,
    conversation?: TypedConversation,
  ): string {
    const customerData = conversation?.context?.customer_data as CustomerData | undefined;

    switch (currentState) {
      case 'collecting_name':
        return 'Me envie so o nome completo. Exemplo: "Jordan Lincoln".';
      case 'collecting_address':
        return customerData?.delivery_type === 'delivery'
          ? 'Me envie rua, numero, bairro, cidade, estado e CEP.'
          : 'Responda com "entrega" ou "retirada".';
      case 'collecting_phone':
        return 'Me envie so o telefone com DDD. Exemplo: 11987654321.';
      default:
        return 'Me responda so essa etapa para eu seguir sem me perder.';
    }
  }

  private buildCollectionStageDetourMessage(
    intro: string,
    currentState: ConversationState,
    conversation?: TypedConversation,
    extraLines: string[] = [],
  ): string {
    return [
      intro,
      ...extraLines,
      '',
      `Antes disso, preciso ${this.getCollectionStageRequirement(currentState, conversation)}.`,
      this.getCollectionStageHint(currentState, conversation),
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildCustomerFocusSnapshot(
    conversation?: TypedConversation,
    currentState?: ConversationState,
    orderSummary?: { orderNo?: string | null; statusLabel?: string | null },
  ): string[] {
    const lines: string[] = [];
    const memory = this.getConversationIntelligenceMemory(conversation);
    const customerData = (conversation?.context?.customer_data || {}) as CustomerData;
    const pendingOrder = conversation?.context?.pending_order as PendingOrder | undefined;

    if (this.shouldExposeCustomerName(customerData?.name)) {
      lines.push(`- Cliente: ${customerData.name}`);
    }

    if (currentState) {
      lines.push(`- Etapa atual: ${this.getConversationStageLabel(currentState, customerData)}`);
    }

    if (pendingOrder?.items?.length) {
      const summarizedItems = pendingOrder.items
        .slice(0, 3)
        .map((item) => `${item.quantity}x ${item.produto_name}`);
      const remainder = pendingOrder.items.length - summarizedItems.length;
      const itemSummary =
        remainder > 0
          ? `${this.joinNaturally(summarizedItems)} e mais ${remainder} item(ns)`
          : this.joinNaturally(summarizedItems);
      lines.push(`- Pedido em rascunho: ${itemSummary}`);
      lines.push(
        `- Total parcial: R$ ${this.formatCurrency(Number(pendingOrder.total_amount || 0))}`,
      );
    }

    if (orderSummary?.orderNo) {
      lines.push(`- Pedido atual: ${orderSummary.orderNo}`);
    }

    if (orderSummary?.statusLabel) {
      lines.push(`- Status: ${orderSummary.statusLabel}`);
    }

    if (memory.last_catalog_category_name) {
      lines.push(`- Categoria em foco: ${memory.last_catalog_category_name}`);
    }

    if (memory.last_product_names?.length) {
      lines.push(
        `- Itens recentes: ${this.joinNaturally(memory.last_product_names.slice(0, 3))}`,
      );
    }

    if (memory.last_customer_goal) {
      lines.push(`- Objetivo percebido: ${memory.last_customer_goal}`);
    }

    return lines;
  }

  private shouldExposeCustomerName(name?: string | null): boolean {
    const candidate = String(name || '').trim();
    if (!candidate) {
      return false;
    }

    if (!this.validateName(candidate).valid) {
      return false;
    }

    const normalized = this.normalizeIntentText(candidate);
    if (
      normalized.includes('catalog_') ||
      this.looksLikeStandalonePhoneMessage(candidate) ||
      this.hasAddressKeyword(candidate) ||
      this.isAddressLikelyComplete(candidate)
    ) {
      return false;
    }

    return true;
  }

  private buildMemoryAwareHandoffMessage(
    lead: string,
    summaryLines: string[],
    guidance: string,
  ): string {
    return [
      lead,
      '',
      'Posso deixar esse contexto mastigado para atendimento humano, sem te fazer repetir tudo.',
      '',
      'RESUMO PRONTO PARA ATENDIMENTO',
      ...summaryLines,
      '',
      guidance,
    ].join('\n');
  }

  private buildContextRecapMessage(
    lead: string,
    summaryLines: string[],
    guidance: string,
  ): string {
    return [
      lead,
      '',
      'RESUMO DO QUE JA ENTENDI',
      ...(summaryLines.length ? summaryLines : ['- Ainda nao tenho contexto suficiente travado aqui.']),
      '',
      guidance,
    ].join('\n');
  }

  private getCollectionCorrectionPrompt(
    currentState: ConversationState,
    customerData?: CustomerData,
  ): string {
    switch (currentState) {
      case 'collecting_name':
        return 'Pode me mandar o nome completo do jeito certo que eu ajusto sem apagar o resto.';
      case 'collecting_address':
        return customerData?.delivery_type
          ? 'Pode me mandar o endereco novamente do seu jeito que eu remonto por partes sem perder o resto do pedido.'
          : 'Sem problema. Antes de qualquer coisa, eu so preciso alinhar se vai ser entrega ou retirada.';
      case 'collecting_phone':
        return 'Pode me mandar o telefone novamente com DDD que eu corrijo aqui.';
      case 'collecting_notes':
        return 'Pode me mandar a observacao do jeito certo que eu atualizo isso para a equipe.';
      case 'collecting_cash_change':
        return 'Pode me dizer o troco correto, por exemplo: "troco para 100".';
      case 'confirming_stock_adjustment':
        return 'Me diga a quantidade certa que eu ajusto sem estourar o estoque.';
      case 'confirming_order':
        return 'Me diga exatamente o que ajustar: item, quantidade, entrega ou retirada, endereco, telefone ou observacao.';
      default:
        return 'Pode me dizer exatamente o que eu preciso corrigir que eu sigo dai.';
    }
  }

  private getCollectionRecapGuidance(
    currentState: ConversationState,
    customerData?: CustomerData,
  ): string {
    switch (currentState) {
      case 'collecting_name':
        return 'Se isso estiver certo ate aqui, agora eu so preciso do nome completo de quem vai receber o pedido.';
      case 'collecting_address':
        return customerData?.delivery_type
          ? 'Se isso estiver certo ate aqui, agora eu so preciso do endereco de entrega.'
          : 'Se isso estiver certo ate aqui, agora eu so preciso saber se voce prefere entrega ou retirada.';
      case 'collecting_phone':
        return 'Se isso estiver certo ate aqui, agora eu so preciso do telefone de contato com DDD.';
      case 'collecting_notes':
        return 'Se isso estiver certo ate aqui, agora eu so preciso saber se existe alguma observacao importante.';
      case 'collecting_cash_change':
        return 'Se isso estiver certo ate aqui, agora eu so preciso saber o troco para quanto.';
      case 'confirming_stock_adjustment':
        return 'Se isso estiver certo ate aqui, confirme a quantidade sugerida ou me diga a quantidade correta.';
      case 'confirming_order':
        return 'Se algo estiver errado, me diga exatamente o que ajustar. Se estiver tudo certo, responda "sim" ou "confirmar".';
      default:
        return 'Se estiver tudo certo ate aqui, pode me dizer o proximo passo que eu continuo com voce.';
    }
  }

  private isCatalogSimilarFollowUpIntent(message: string): boolean {
    const normalized = this.normalizeIntentText(message);
    return this.hasAnyNormalizedPhrase(normalized, [
      'parecidos',
      'parecido',
      'algo parecido',
      'algo semelhante',
      'semelhantes',
      'dessa linha',
      'nesse estilo',
      'mais nessa linha',
      'mais opcoes assim',
      'outros assim',
      'outro parecido',
      'me mostra parecidos',
    ]);
  }

  private isCatalogCategoryFollowUpIntent(message: string): boolean {
    const normalized = this.normalizeIntentText(message);
    return this.hasAnyNormalizedPhrase(normalized, [
      'volta pra categoria',
      'voltar pra categoria',
      'voltar para categoria',
      'mais dessa categoria',
      'ver mais dessa categoria',
      'mostra a categoria',
      'me mostra a categoria',
      'abre a categoria',
      'volta pros itens',
      'volta para os itens',
    ]);
  }

  private isCatalogProductRecallIntent(message: string): boolean {
    const normalized = this.normalizeIntentText(message);
    return this.hasAnyNormalizedPhrase(normalized, [
      'abre esse item',
      'mostra esse item',
      'me mostra esse item',
      'volta pra esse item',
      'voltar pra esse item',
      'detalhes desse item',
      'detalhe desse item',
      'me mostra esse de novo',
    ]);
  }

  private buildTrackingUrl(orderNo: string): string {
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || '').trim();
    const baseUrl =
      frontendUrl ||
      (process.env.NODE_ENV === 'production'
        ? 'https://gtsofthub.com.br'
        : 'http://localhost:3000');

    return `${baseUrl.replace(/\/+$/, '')}/pedido?order=${encodeURIComponent(orderNo)}`;
  }

  private getOrdersPortalUrl(): string {
    return this.buildTrackingUrl('PED-00000000-000').replace(/\?order=.*$/, '');
  }

  private getGreetingLine(customerName?: string | null): string {
    return customerName?.trim() ? `Ola, ${customerName.trim()}!` : 'Ola!';
  }

  private getStatusLabel(status: PedidoStatus): string {
    const labels: Record<PedidoStatus, string> = {
      [PedidoStatus.PENDENTE_PAGAMENTO]: 'Pagamento pendente',
      [PedidoStatus.CONFIRMADO]: 'Confirmado',
      [PedidoStatus.EM_PRODUCAO]: 'Em preparacao',
      [PedidoStatus.PRONTO]: 'Pronto',
      [PedidoStatus.EM_TRANSITO]: 'Em transito',
      [PedidoStatus.ENTREGUE]: 'Entregue',
      [PedidoStatus.CANCELADO]: 'Cancelado',
    };

    return labels[status] || status;
  }

  private getDeliveryTypeLabel(deliveryType?: string | null): string {
    return deliveryType === 'delivery' ? 'Entrega' : 'Retirada';
  }

  private getNextStepSummary(pedido: Pedido, status: PedidoStatus): string {
    switch (status) {
      case PedidoStatus.PENDENTE_PAGAMENTO:
        return pedido.delivery_type === 'pickup'
          ? 'Conclua o pagamento para liberar a preparacao e acompanhar quando a retirada estiver pronta.'
          : 'Conclua o pagamento para liberar a preparacao e acompanhar a entrega sem perder contexto.';
      case PedidoStatus.CONFIRMADO:
        return pedido.delivery_type === 'pickup'
          ? 'Agora a equipe segue para deixar tudo pronto para uma retirada rapida.'
          : 'Agora a equipe segue para a preparacao e depois para a expedicao do pedido.';
      case PedidoStatus.EM_PRODUCAO:
        return pedido.delivery_type === 'pickup'
          ? 'A proxima virada importante sera quando o pedido estiver pronto para retirada.'
          : 'A proxima virada importante sera quando o pedido estiver pronto para envio.';
      case PedidoStatus.PRONTO:
        return pedido.delivery_type === 'pickup'
          ? 'Tenha o codigo do pedido em maos para acelerar a retirada.'
          : 'O pedido concluiu a preparacao e aguarda a saida para entrega.';
      case PedidoStatus.EM_TRANSITO:
        return 'O pedido ja saiu e agora caminha para a ultima etapa da jornada.';
      case PedidoStatus.ENTREGUE:
        return 'Esse acompanhamento continua valendo como comprovante e referencia da compra.';
      case PedidoStatus.CANCELADO:
        return 'Se precisar retomar a compra, o codigo do pedido ajuda a equipe a continuar sem retrabalho.';
    }
  }

  private getOrderStatusAction(_pedido: Pedido, status: PedidoStatus): string | null {
    switch (status) {
      case PedidoStatus.PENDENTE_PAGAMENTO:
        return 'Se quiser concluir agora aqui no WhatsApp, responda: "pix" ou "dinheiro".';
      case PedidoStatus.CONFIRMADO:
      case PedidoStatus.EM_PRODUCAO:
      case PedidoStatus.PRONTO:
      case PedidoStatus.EM_TRANSITO:
        return 'Se quiser voltar a acompanhar por aqui depois, basta enviar: "status do pedido".';
      case PedidoStatus.ENTREGUE:
        return 'Se quiser repetir a compra, envie: "repetir pedido".';
      case PedidoStatus.CANCELADO:
        return 'Se quiser retomar a compra, envie: "reabrir pedido" ou me diga o produto que deseja.';
      default:
        return null;
    }
  }

  private buildOrderItemsPreview(pedido: Pedido): string {
    const items = (pedido.itens || []).slice(0, 4).map((item: {
      quantity: number;
      produto?: { name: string } | null;
      produto_id?: string;
    }) => `- ${item.quantity}x ${item.produto?.name || item.produto_id || 'Produto'}`);

    if (!items.length) {
      return '';
    }

    const hiddenItems = Math.max(0, (pedido.itens || []).length - items.length);
    return [
      'Itens:',
      ...items,
      hiddenItems > 0 ? `- mais ${hiddenItems} item(ns)` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private enrichPaymentMessage(
    baseMessage: string,
    pedido: Pedido,
    method: MetodoPagamento,
  ): string {
    const followUp =
      method === MetodoPagamento.PIX
        ? 'Assim que o pagamento for reconhecido, o pedido avanca automaticamente.'
        : method === MetodoPagamento.DINHEIRO
          ? 'Assim que a equipe confirmar o recebimento, o pedido segue para a preparacao.'
          : 'A proxima atualizacao chega assim que o pagamento avancar.';

    return [
      baseMessage.trim(),
      '',
      followUp,
      `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
    ].join('\n');
  }

  private getPremiumPaymentOptionsMessage(total: number): string {
    const totalAmount = Number(total || 0);
    const pixAmount = totalAmount > 0 ? totalAmount * 0.95 : 0;

    return [
      'FORMAS DE PAGAMENTO',
      '',
      `1. PIX com 5% de desconto (R$ ${this.formatCurrency(pixAmount)})`,
      '2. Dinheiro',
      '',
      'Responda com o numero ou o nome do metodo.',
      'Exemplo: "1", "pix" ou "dinheiro".',
    ].join('\n');
  }

  private buildOrderCreatedMessage(pedido: Pedido): string {
    return [
      this.getGreetingLine(pedido.customer_name),
      '',
      'PEDIDO CRIADO COM SUCESSO',
      '',
      `Pedido: *${pedido.order_no}*`,
      `Recebimento: ${this.getDeliveryTypeLabel(pedido.delivery_type)}`,
      `Total: R$ ${this.formatCurrency(Number(pedido.total_amount || 0))}`,
      '',
      'Seu pedido ja esta reservado e pronto para seguir assim que o pagamento for escolhido.',
      this.getNextStepSummary(pedido, PedidoStatus.PENDENTE_PAGAMENTO),
      '',
      this.getPremiumPaymentOptionsMessage(Number(pedido.total_amount || 0)),
      '',
      `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
    ].join('\n');
  }

  private async safelyFindOrderById(
    pedidoId: string,
    tenantId: string,
  ): Promise<Pedido | null> {
    try {
      return await this.ordersService.findOne(pedidoId, tenantId);
    } catch (error) {
      this.logger.warn('Could not resolve WhatsApp order by id', {
        pedidoId,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async resolveRelevantOrder(
    tenantId: string,
    conversation?: TypedConversation,
    orderNo?: string | null,
  ): Promise<Pedido | null> {
    if (orderNo) {
      const byOrderNo = await this.ordersService.findByOrderNo(orderNo, tenantId);
      if (byOrderNo) {
        return byOrderNo;
      }
    }

    const pedidoId = conversation?.pedido_id || conversation?.context?.pedido_id;
    if (pedidoId) {
      const byId = await this.safelyFindOrderById(pedidoId, tenantId);
      if (byId) {
        return byId;
      }
    }

    if (!conversation?.customer_phone) {
      return null;
    }

    const latestPending = await this.ordersService.findLatestPendingByCustomerPhone(
      tenantId,
      conversation.customer_phone,
    );
    if (latestPending) {
      return latestPending;
    }

    return await this.ordersService.findLatestByCustomerPhone(
      tenantId,
      conversation.customer_phone,
    );
  }

  private getStageRecoveryLabel(kind: StageRecoveryKind): string {
    const labels: Record<StageRecoveryKind, string> = {
      phone: 'telefone',
      address: 'endereco',
      delivery: 'forma de recebimento',
      confirmation: 'confirmacao final',
      notes: 'observacao',
      name: 'nome',
    };

    return labels[kind];
  }

  private classifyOutOfOrderReply(message: string): StageRecoveryKind | null {
    const sanitized = this.sanitizeInput((message || '').trim());
    const normalized = this.normalizeIntentText(sanitized);
    if (!normalized) {
      return null;
    }

    if (
      this.isPaymentProofIntent(normalized) ||
      this.isPostOrderCourtesyIntent(normalized) ||
      this.isPostOrderChangeIntent(normalized)
    ) {
      return null;
    }

    if (
      this.hasAnyNormalizedPhrase(normalized, [
        'oi',
        'ola',
        'bom dia',
        'boa tarde',
        'boa noite',
        'ajuda',
        'cardapio',
        'catalogo',
      ])
    ) {
      return null;
    }

    const digitsOnly = sanitized.replace(/\D/g, '');
    if (digitsOnly.length >= 10 && digitsOnly.length <= 13 && !this.extractOrderNo(sanitized)) {
      return 'phone';
    }

    if (
      digitsOnly.length >= 1 &&
      digitsOnly.length <= 8 &&
      !this.extractOrderNo(sanitized) &&
      /^\d{1,8}[A-Za-z]?$/.test(sanitized)
    ) {
      return 'address';
    }

    if (['sim', 'confirmar', 'ok'].includes(normalized)) {
      return 'confirmation';
    }

    if (['sem', 'nenhum', 'nenhuma'].includes(normalized)) {
      return 'notes';
    }

    if (['retirada', 'entrega', 'buscar'].includes(normalized)) {
      return 'delivery';
    }

    const addressSignal =
      /\b(rua|avenida|av|travessa|alameda|estrada|rodovia|bairro|cep|apto|apartamento|casa)\b/.test(
        normalized,
      ) && /\d/.test(sanitized);
    if (
      addressSignal ||
      this.hasAddressFragmentSignal(sanitized) ||
      (sanitized.includes(',') && /\d/.test(sanitized) && this.validateAddress(sanitized).valid)
    ) {
      return 'address';
    }

    const extractedName = this.extractCustomerNameCandidate(sanitized);
    if (extractedName !== sanitized && this.validateName(extractedName).valid) {
      return 'name';
    }

    const nameValidation = this.validateName(sanitized);
    const wordCount = sanitized.split(/\s+/).filter(Boolean).length;
    if (
      nameValidation.valid &&
      wordCount >= 2 &&
      wordCount <= 5 &&
      !this.isPaymentMethodSelection(normalized) &&
      !this.isOrderIntent(normalized) &&
      !this.looksLikeOrderStatusQuery(normalized)
    ) {
      return 'name';
    }

    return null;
  }

  private buildWaitingPaymentStageRecoveryMessage(
    pedido: Pedido | null,
    kind: StageRecoveryKind,
  ): string {
    const label = this.getStageRecoveryLabel(kind);
    const intro =
      kind === 'confirmation'
        ? 'A revisao final ja foi registrada e o pedido entrou na etapa de pagamento.'
        : `Nao preciso mais de ${label} para este pedido.`;

    return [
      intro,
      pedido ? '' : 'Seu pedido ja esta aguardando a escolha do pagamento.',
      pedido ? `Pedido: *${pedido.order_no}*` : '',
      pedido ? `Status atual: *${this.getStatusLabel(pedido.status)}*` : '',
      '',
      'Para seguir agora, responda com a forma de pagamento:',
      '- pix',
      '- dinheiro',
      pedido ? `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildClosedStageRecoveryMessage(
    pedido: Pedido | null,
    currentState: ConversationState,
    kind: StageRecoveryKind,
  ): string {
    const label = this.getStageRecoveryLabel(kind);
    const intro =
      currentState === 'order_completed'
        ? `O ${label} ja ficou registrado antes e esse pedido concluiu a jornada.`
        : `O ${label} ja ficou registrado antes e esse pedido ja esta em andamento.`;

    return [
      pedido ? `Pedido: *${pedido.order_no}*` : 'Esse pedido ja passou da etapa de cadastro.',
      pedido ? `Status atual: *${this.getStatusLabel(pedido.status)}*` : '',
      intro,
      pedido
        ? this.getNextStepSummary(pedido, pedido.status)
        : 'Se quiser, me envie "status do pedido" para acompanhar.',
      '',
      pedido
        ? `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`
        : 'Envie "status do pedido" para acompanhar.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildPaymentStageGuardMessage(pedido: Pedido): string {
    if (pedido.status === PedidoStatus.CANCELADO) {
      return [
        `O pedido *${pedido.order_no}* esta cancelado, entao eu nao vou gerar uma nova cobranca por seguranca.`,
        'Se quiser, eu monto um novo pedido do zero por aqui.',
        `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
      ].join('\n');
    }

    return [
      `O pagamento do pedido *${pedido.order_no}* nao precisa ser escolhido novamente.`,
      `Status atual: *${this.getStatusLabel(pedido.status)}*`,
      this.getNextStepSummary(pedido, pedido.status),
      '',
      `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
    ].join('\n');
  }

  private async tryHandleOutOfOrderStageReply(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
    currentState?: ConversationState,
    orderNo?: string | null,
  ): Promise<string | null> {
    if (
      !conversation ||
      !currentState ||
      !['waiting_payment', 'order_confirmed', 'order_completed'].includes(currentState)
    ) {
      return null;
    }

    const kind = this.classifyOutOfOrderReply(message);
    if (!kind) {
      return null;
    }

    const pedido = await this.resolveRelevantOrder(tenantId, conversation, orderNo);

    if (currentState === 'waiting_payment') {
      return this.buildWaitingPaymentStageRecoveryMessage(pedido, kind);
    }

    return this.buildClosedStageRecoveryMessage(pedido, currentState, kind);
  }

  private applyCommonChatNormalizations(value: string): string {
    return value
      .replace(/\b(qro|qru|kero|kero|queroo+)\b/g, 'quero')
      .replace(/\b(qria|qria|k(r)?ia|keria)\b/g, 'queria')
      .replace(/\b(to|tava|estou)\s+querendo\b/g, 'quero')
      .replace(/\b(presciso|presiso|precizo)\b/g, 'preciso')
      .replace(/\b(n|nao|num)\s+vo(u)?\b/g, 'nao vou')
      .replace(/\b(naum|naun|num)\b/g, 'nao')
      .replace(/\b(vcs|vc|ceis|ces)\b/g, 'voce')
      .replace(/\b(nois|noix)\b/g, 'nos')
      .replace(/\b(mim\s+ve|mi\s+ve|me\s+veja|mim\s+veja)\b/g, 'me ve')
      .replace(/\b(mim\s+manda|mi\s+manda|manda\s+pra\s+nois|manda\s+pra\s+nos)\b/g, 'me manda')
      .replace(/\b(manda\s+a[ie]|manda\s+aii+)\b/g, 'me manda')
      .replace(/\b(me\s+arruma|arruma\s+pra\s+mim|arruma\s+ai)\b/g, 'separa')
      .replace(/\b(dz)\b/g, 'duzia')
      .replace(/\b(pixx|piks|pics|pic)\b/g, 'pix')
      .replace(/\b(credto|crdito|creditoo)\b/g, 'credito')
      .replace(/\b(debto|dbito|debitoo)\b/g, 'debito')
      .replace(/\b(cancela|cancelaa|cancelai|cancela ai)\b/g, 'cancelar')
      .replace(/\b(desisti|desiste)\b/g, 'desistir')
      .replace(/\b(kd|qd|cadee)\b/g, 'cade')
      .replace(/\b(ond|ondee|aond|aondee)\b/g, 'onde')
      .replace(/\b(cardapioo|cadapio|cardpio|cardapo)\b/g, 'cardapio')
      .replace(/\b(catalogoo|catalogu)\b/g, 'catalogo')
      .replace(/\b(encomeda|encomnda|encomendaa)\b/g, 'encomenda')
      .replace(/\b(praviagem|pra viage[mn])\b/g, 'pra viagem')
      .replace(/\b(retira|retiraa)\b/g, 'retirada')
      .replace(/\b(obgd|obrgd|obgdo)\b/g, 'obrigado')
      .replace(/\b(vlw+|valeeu+)\b/g, 'valeu')
      .replace(/\b(blz+|belezinha)\b/g, 'beleza')
      .replace(/\b(fecho+|fexo+)\b/g, 'fechou')
      .replace(/\b(pfv|pfvr)\b/g, 'por favor')
      .replace(/([a-z])\1{3,}/g, '$1$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeForSearch(value: string): string {
    return this.applyCommonChatNormalizations(
      (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .trim(),
    );
  }

  private normalizeCatalogSearchText(value: string): string {
    return this.normalizeForSearch(value)
      .replace(/\bbolo\s+de\s+pote\b/g, 'bolo no pote')
      .replace(/\bpote\s+de\s+bolo\b/g, 'bolo no pote')
      .replace(/\bbala\s+brigadeiro\b/g, 'bala de brigadeiro')
      .replace(/\bbala\s+coco\b/g, 'bala de coco')
      .replace(/\bbejinh?o\b/g, 'beijinho')
      .replace(/\bbrigadeir[oa]s?\b/g, 'brigadeiro')
      .replace(/\bbrigader[oa]s?\b/g, 'brigadeiro')
      .replace(/\bmaracuj[ao]*\b/g, 'maracuja')
      .replace(/\bbanof+e\b/g, 'banoffe')
      .replace(/\bpresent(eavel|avel)\b/g, 'presenteavel')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeIntentText(value: string): string {
    return this.messageIntelligenceService.normalizeText(value);
  }

  private looksLikeAudioTranscription(message?: WhatsappMessage): boolean {
    if (!message) {
      return false;
    }

    if (message.messageType === 'audio') {
      return true;
    }

    const metadata = message.metadata || {};
    return Boolean(
      metadata.audio === true ||
      metadata.voice === true ||
      metadata.transcript ||
      metadata.transcription ||
      metadata.transcriptionSource,
    );
  }

  private normalizeIncomingMessageBody(message: WhatsappMessage): string {
    let normalized = message.body || '';

    if (this.looksLikeAudioTranscription(message)) {
      normalized = normalized
        .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
        .replace(/\b(aham|ahn|ahn?m|hum+|hmm+|eh+|ehh+|tipo|assim|entao|ta bom|beleza|visse|viu|ne|oxe|oxente|uai|eita|vixe|vish|rapaz|mano|minha fia|meu fi|meu filho|minha filha|kkk+|rs+|rsrs+|hein|seguinte|patrao|chefia|parceiro|meu rei|minha rainha|moca|moco)\b/gi, ' ')
        .replace(/\b(queria ver se tem como|queria ver se|ve se tem como|ve se|sera que tem como|sera que da pra|deixa eu ver|deixa eu|deixa eu te falar|to querendo|estou querendo|negocio e o seguinte|me ajuda ai|me ajuda ae|faz favor|se tiver como|tem como)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return normalized;
  }

  private extractCustomerNameCandidate(message: string): string {
    return this.sanitizeInput(message.trim())
      .replace(
        /^(?:meu\s+nome\s+[eé]|o\s+nome\s+[eé]|nome\s+[eé]|me\s+chamo|eu\s+sou|sou\s+(?:o|a)|pode\s+colocar\s+no\s+nome\s+de|coloca\s+no\s+nome\s+de|anota\s+no\s+nome\s+de|prazer[,:\s]*)\s+/i,
        '',
      )
      .replace(/\b(?:ta\s+bom|t[aá]|ok|beleza|blz|valeu|obrigad[oa]|por\s+favor)\b$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractPhoneDigitsCandidate(message: string): string {
    return this.sanitizeInput(message).replace(/\D/g, '');
  }

  private extractStateCodeFromText(value: string): string {
    const sanitized = this.sanitizeInput(value || '');
    if (!sanitized) {
      return '';
    }

    const directCodeMatch = sanitized.toUpperCase().match(
      new RegExp(`\\b(?:${Array.from(this.BRAZIL_STATE_CODES).join('|')})\\b`),
    );
    if (directCodeMatch) {
      return directCodeMatch[0];
    }

    const normalized = this.normalizeIntentText(sanitized).replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    return this.BRAZIL_STATE_NAME_TO_CODE[normalized] || '';
  }

  private containsStateReference(value: string): boolean {
    return Boolean(this.extractStateCodeFromText(value));
  }

  private looksLikeStandalonePhoneMessage(message: string): boolean {
    const sanitized = this.sanitizeInput((message || '').trim());
    if (!sanitized) {
      return false;
    }

    if (this.hasAddressKeyword(sanitized) || /\b\d{5}-?\d{3}\b/.test(sanitized)) {
      return false;
    }

    const normalized = this.normalizeIntentText(sanitized);
    const digitsOnly = this.extractPhoneDigitsCandidate(sanitized);
    if (digitsOnly.length < 10 || digitsOnly.length > 11) {
      return false;
    }

    if (/^\+?\d[\d\s().-]{8,}$/.test(sanitized)) {
      return true;
    }

    return /^(meu numero|meu telefone|telefone|numero|zap|whatsapp)\b/.test(normalized);
  }

  private normalizeAddressCandidate(message: string): string {
    return this.sanitizeInput(message.trim())
      .replace(
        /^(?:meu\s+endere[cç]o\s+[eé]|o\s+endere[cç]o\s+[eé]|endere[cç]o\s+[eé]|entrega\s+[eé]\s+(?:na|no)|pode\s+entregar\s+(?:na|no)|entrega\s+(?:na|no)|manda\s+(?:na|no)|fica\s+(?:na|no)|anota\s+a[ií]|segue\s+o\s+endere[cç]o|[eé]\s+na)\s+/i,
        '',
      )
      .replace(/\b(?:n[ºo]?|numero)\s*(\d+[A-Za-z]?)\b/gi, '$1')
      .replace(/\b(?:cep)\s+(\d{5}-?\d{3})\b/gi, '$1')
      .replace(/\s+-\s+/g, ', ')
      .replace(/\b(?:ta\s+bom|ok|beleza|blz|valeu|obrigad[oa]|por\s+favor)\b$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hasAddressKeyword(text: string): boolean {
    return /\b(rua|avenida|av|travessa|alameda|estrada|rodovia|bairro|cep|apto|apartamento|bloco|sala|quadra|lote|condominio|condomínio|casa)\b/i.test(
      this.normalizeIntentText(text),
    );
  }

  private hasAddressFragmentSignal(text: string): boolean {
    const normalized = this.normalizeIntentText(text);
    if (!normalized) {
      return false;
    }

    if (this.hasAddressKeyword(normalized)) {
      return true;
    }

    if (['centro', 'jardim', 'jd', 'vila', 'bairro', 'cep', 'apto', 'apartamento', 'bloco', 'quadra', 'lote', 'fundos', 'portaria', 'casa'].includes(normalized)) {
      return true;
    }

    return this.containsStateReference(normalized);
  }

  private looksLikeCollectionFragmentWithoutContext(message: string): boolean {
    const sanitized = this.sanitizeInput((message || '').trim());
    const normalized = this.normalizeIntentText(sanitized);
    if (!normalized) {
      return false;
    }

    const digitsOnly = sanitized.replace(/\D/g, '');
    if (
      digitsOnly.length >= 1 &&
      digitsOnly.length <= 8 &&
      !this.extractOrderNo(sanitized) &&
      /^\d{1,8}[A-Za-z]?$/.test(sanitized)
    ) {
      return true;
    }

    if (this.hasAddressFragmentSignal(normalized)) {
      return true;
    }

    const extractedName = this.extractCustomerNameCandidate(sanitized);
    return extractedName !== sanitized && this.validateName(extractedName).valid;
  }

  private getAddressDraftParts(conversation?: TypedConversation): string[] {
    const draft = conversation?.context?.address_draft_parts;
    return Array.isArray(draft)
      ? draft
          .filter((part): part is string => typeof part === 'string')
          .map((part) => part.trim())
          .filter(Boolean)
      : [];
  }

  private mergeAddressDraftParts(parts: string[], nextPart: string): string[] {
    const sanitizedPart = this.normalizeAddressCandidate(nextPart);
    if (!sanitizedPart) {
      return parts;
    }

    const normalizedPart = this.normalizeIntentText(sanitizedPart);
    if (!normalizedPart) {
      return parts;
    }

    const looksLikeFreshAddress =
      this.hasAddressKeyword(sanitizedPart) && /\d/.test(sanitizedPart) && sanitizedPart.length >= 12;
    if (looksLikeFreshAddress) {
      const existingHasStreetLike = parts.some((part) => this.hasAddressKeyword(part));
      const existingOnlyLooseFragments = parts.every((part) => {
        const normalizedExisting = this.normalizeAddressCandidate(part);
        return (
          /^\d{1,8}[A-Za-z]?$/.test(normalizedExisting) ||
          /\b\d{5}-?\d{3}\b/.test(normalizedExisting) ||
          !this.hasAddressKeyword(normalizedExisting)
        );
      });

      if (existingHasStreetLike || existingOnlyLooseFragments) {
        return [sanitizedPart];
      }
    }

    const merged = [...parts];
    const existingIndex = merged.findIndex((part) => {
      const existing = this.normalizeIntentText(part);
      return (
        existing === normalizedPart ||
        existing.includes(normalizedPart) ||
        normalizedPart.includes(existing)
      );
    });
    if (existingIndex >= 0) {
      const existing = merged[existingIndex];
      merged[existingIndex] =
        this.normalizeIntentText(existing).length >= normalizedPart.length
          ? existing
          : sanitizedPart;
      return merged;
    }

    return [...merged.slice(-4), sanitizedPart];
  }

  private buildAddressDraftText(parts: string[]): string {
    return parts
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ')
      .replace(/,\s*,+/g, ', ')
      .replace(/\s+,/g, ',')
      .trim();
  }

  private isAddressDraftWorthy(text: string): boolean {
    const normalized = this.normalizeIntentText(text);
    if (!normalized) {
      return false;
    }

    const trimmed = text.trim();
    if (trimmed === '0') {
      return false;
    }

    return (
      this.hasAddressKeyword(normalized) ||
      /^(?:[1-9]\d{0,5}[A-Za-z]?)$/.test(trimmed) ||
      /\b\d{5}-?\d{3}\b/.test(text)
    );
  }

  private parseLooseAddress(addressText: string): {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  } | null {
    const sanitized = this.normalizeAddressCandidate(addressText);
    if (!sanitized || sanitized.includes(',')) {
      return null;
    }

    let working = sanitized.replace(/\bcep\b/gi, ' ').replace(/\s+/g, ' ').trim();
    let zipCode = '';
    const zipMatch = working.match(/\b(\d{5}-?\d{3})\b/);
    if (zipMatch) {
      zipCode = zipMatch[1].replace('-', '');
      working = working.replace(zipMatch[0], ' ').replace(/\s+/g, ' ').trim();
    }

    const tokens = working.split(/\s+/).filter(Boolean);
    if (tokens.length < 4) {
      return null;
    }

    let state = '';
    const lastToken = tokens[tokens.length - 1];
    const detectedState = this.extractStateCodeFromText(lastToken);
    if (detectedState) {
      state = detectedState;
      tokens.pop();
    }

    const numberIndex = tokens.findIndex((token) => /^\d+[A-Za-z]?$/.test(token));
    if (numberIndex <= 0) {
      return null;
    }

    const street = tokens.slice(0, numberIndex).join(' ').trim();
    const number = tokens[numberIndex];
    const remainder = tokens.slice(numberIndex + 1);
    if (!street || remainder.length === 0) {
      return null;
    }

    const complementKeywords = new Set([
      'apto',
      'apartamento',
      'bloco',
      'bl',
      'casa',
      'fundos',
      'sala',
      'sl',
      'cj',
      'conjunto',
      'loja',
      'andar',
      'cobertura',
      'cob',
      'quadra',
      'qd',
      'lote',
      'lt',
    ]);
    const complementParts: string[] = [];
    while (remainder.length > 2 && complementKeywords.has(remainder[0].toLowerCase())) {
      complementParts.push(remainder.shift() as string);
      if (remainder.length > 2) {
        complementParts.push(remainder.shift() as string);
      }
    }

    if (remainder.length < 2) {
      return null;
    }

    let cityTokenCount = 1;
    if (state && remainder.length >= 3) {
      cityTokenCount = Math.min(2, remainder.length - 1);
    }

    const city = remainder.slice(-cityTokenCount).join(' ').trim();
    const neighborhood = remainder.slice(0, -cityTokenCount).join(' ').trim();
    if (!city || !neighborhood) {
      return null;
    }

    return {
      street,
      number,
      complement: complementParts.length > 0 ? complementParts.join(' ') : undefined,
      neighborhood,
      city,
      state,
      zipCode,
    };
  }

  private parseAddressCandidate(addressText: string): {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  } | null {
    const normalizedCandidate = this.normalizeAddressCandidate(addressText);
    return this.parseAddress(normalizedCandidate) || this.parseLooseAddress(normalizedCandidate);
  }

  private isAddressLikelyComplete(addressText: string): boolean {
    const candidate = this.normalizeAddressCandidate(addressText);
    if (!candidate || !this.validateAddress(candidate).valid) {
      return false;
    }

    const parsed = this.parseAddressCandidate(candidate);
    if (parsed) {
      const hasStreet = !!parsed.street?.trim();
      const hasNumber = !!parsed.number?.trim();
      const hasLocality =
        !!parsed.neighborhood?.trim() ||
        !!parsed.city?.trim() ||
        !!parsed.state?.trim() ||
        !!parsed.zipCode?.trim();
      return hasStreet && hasNumber && hasLocality;
    }

    return false;
  }

  private buildPremiumAddressDraftPrompt(draftText: string): string {
    const hasNumber = /\d/.test(draftText);
    const hasCep = /\b\d{5}-?\d{3}\b/.test(draftText);
    const hasState = this.containsStateReference(draftText);

    const nextStep = !hasNumber
      ? 'Agora me envie o numero.'
      : !hasState
        ? 'Agora complete com bairro, cidade e estado.'
        : !hasCep
          ? 'Se puder, complete com CEP ou complemento para reduzir erro na entrega.'
          : 'Se quiser, complete com complemento para reduzir erro na entrega.';

    return [
      'Estou montando o endereco por etapas para evitar erro de entrega.',
      '',
      `Rascunho atual: ${draftText}`,
      nextStep,
      'Exemplo completo: "Rua das Flores, 123, Apto 45, Centro, Sao Paulo, SP, 01234-567".',
    ].join('\n');
  }

  private isPaymentProofIntent(lowerMessage: string): boolean {
    const normalized = this.normalizeIntentText(lowerMessage);
    if (!normalized || this.isPaymentMethodSelection(normalized)) {
      return false;
    }

    return this.hasAnyNormalizedPhrase(normalized, [
      'ja paguei',
      'paguei',
      'ja fiz o pix',
      'fiz o pix',
      'ja fiz pix',
      'pix pago',
      'pagamento feito',
      'pagamento concluido',
      'ja transferi',
      'transferi',
      'mandei comprovante',
      'enviei comprovante',
      'ja mandei comprovante',
      'comprovante enviado',
      'ta pago',
      'pix caiu',
      'pix caiu ai',
      'enviei o pix',
      'paguei ja',
      'comprovante ta ai',
      'passei no cartao',
    ]);
  }

  private isPostOrderCourtesyIntent(lowerMessage: string): boolean {
    const normalized = this.normalizeIntentText(lowerMessage);
    if (!normalized) {
      return false;
    }

    return this.hasAnyNormalizedPhrase(normalized, [
      'obrigado',
      'obrigada',
      'obg',
      'valeu',
      'vlw',
      'fechou',
      'show',
      'beleza',
      'blz',
      'tranquilo',
      'perfeito',
      'certinho',
      'tamo junto',
      'top',
      'tmj',
      'brigado',
      'obrigadao',
      'deus abencoe',
      'deus te abencoe',
    ]);
  }

  private isPostOrderChangeIntent(lowerMessage: string): boolean {
    const normalized = this.normalizeIntentText(lowerMessage);
    if (!normalized) {
      return false;
    }

    if (this.hasAnyNormalizedPhrase(normalized, [
      'muda meu endereco',
      'mudar endereco',
      'trocar endereco',
      'troca meu endereco',
      'alterar endereco',
      'corrigir endereco',
      'novo endereco',
      'muda para retirada',
      'muda pra retirada',
      'troca para retirada',
      'troca pra retirada',
      'muda para entrega',
      'muda pra entrega',
      'troca para entrega',
      'troca pra entrega',
      'mudar forma de pagamento',
      'trocar forma de pagamento',
      'trocar pagamento',
      'muda pagamento',
      'alterar pagamento',
      'acrescenta',
      'acrescentar',
      'adiciona',
      'adicionar mais',
      'remover item',
      'tirar item',
      'trocar item',
      'mudar item',
      'alterar pedido',
      'mudar pedido',
      'trocar pedido',
      'corrigir pedido',
    ])) {
      return true;
    }

    const hasChangeVerb = this.hasAnyNormalizedPhrase(normalized, [
      'mudar',
      'trocar',
      'alterar',
      'corrigir',
      'acrescentar',
      'adicionar',
      'remover',
      'tirar',
      'ajustar',
    ]);
    const hasOrderTarget = this.hasAnyNormalizedPhrase(normalized, [
      'endereco',
      'entrega',
      'retirada',
      'pagamento',
      'pix',
      'credito',
      'debito',
      'cartao',
      'item',
      'produto',
      'pedido',
      'sabor',
    ]);
    const orderInfo = this.extractOrderInfo(normalized);

    return hasChangeVerb && (
      hasOrderTarget ||
      (Number(orderInfo.quantity || 0) > 0 && Boolean(orderInfo.productName))
    );
  }

  private buildPaymentProofGuidanceMessage(pedido: Pedido): string {
    if (pedido.status !== PedidoStatus.PENDENTE_PAGAMENTO) {
      return this.buildPaymentStageGuardMessage(pedido);
    }

    return [
      this.getGreetingLine(pedido.customer_name),
      '',
      `Recebi sua sinalizacao sobre o pagamento do pedido *${pedido.order_no}*.`,
      'Se voce ja concluiu o Pix ou o cartao, eu nao vou gerar outra cobranca por aqui.',
      'Assim que a operadora confirmar, o pedido avanca automaticamente.',
      this.getNextStepSummary(pedido, pedido.status),
      '',
      `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
    ].join('\n');
  }

  private buildPostOrderCourtesyMessage(
    pedido: Pedido,
    currentState?: ConversationState,
  ): string {
    if (pedido.status === PedidoStatus.CANCELADO) {
      return [
        'Sem problema.',
        'Se quiser retomar a compra depois, eu monto um novo pedido por aqui.',
        `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
      ].join('\n');
    }

    const contextualLine =
      currentState === 'waiting_payment' || pedido.status === PedidoStatus.PENDENTE_PAGAMENTO
        ? 'Fico acompanhando por aqui e o pedido avanca assim que o pagamento for confirmado.'
        : pedido.status === PedidoStatus.ENTREGUE
          ? 'Fico feliz em ajudar. Quando quiser repetir a compra, e so me chamar.'
          : 'Perfeito. O pedido segue na trilha certa e eu continuo disponivel por aqui.';

    return [
      this.getGreetingLine(pedido.customer_name),
      '',
      contextualLine,
      pedido.status === PedidoStatus.ENTREGUE
        ? 'Se quiser, posso te ajudar a repetir o pedido ou encontrar algo parecido.'
        : this.getNextStepSummary(pedido, pedido.status),
      '',
      `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
    ].join('\n');
  }

  private buildPostOrderChangeGuardMessage(
    pedido: Pedido,
    currentState?: ConversationState,
  ): string {
    const isWaitingPayment =
      currentState === 'waiting_payment' || pedido.status === PedidoStatus.PENDENTE_PAGAMENTO;
    const intro = isWaitingPayment
      ? 'Esse pedido ja esta montado e aguardando pagamento.'
      : pedido.status === PedidoStatus.ENTREGUE
        ? 'Esse pedido ja foi concluido.'
        : 'Esse pedido ja esta em andamento.';
    const safetyLine = isWaitingPayment
      ? 'Para evitar cobranca ou cadastro errado, eu nao altero itens, endereco ou forma de recebimento automaticamente nessa fase.'
      : 'Para evitar erro operacional com o cliente, eu nao altero itens, endereco ou forma de recebimento automaticamente nessa fase.';
    const nextLine = isWaitingPayment
      ? 'Se precisar ajustar algo agora, o caminho seguro e atendimento humano ou cancelar esse pedido para montar outro do zero.'
      : pedido.status === PedidoStatus.ENTREGUE
        ? 'Se voce quiser repetir a compra ou registrar um ajuste, eu te direciono para atendimento humano.'
        : 'Se precisar ajustar algo agora, o caminho seguro e atendimento humano.';

    return [
      this.getGreetingLine(pedido.customer_name),
      '',
      `Pedido: *${pedido.order_no}*`,
      `Status atual: *${this.getStatusLabel(pedido.status)}*`,
      intro,
      safetyLine,
      nextLine,
      '',
      `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
    ].join('\n');
  }

  private buildPostOrderStatusAndChangeGuardMessage(
    pedido: Pedido,
    currentState?: ConversationState,
  ): string {
    return [
      this.getGreetingLine(pedido.customer_name),
      '',
      `Pedido: *${pedido.order_no}*`,
      `Status atual: *${this.getStatusLabel(pedido.status)}*`,
      this.getNextStepSummary(pedido, pedido.status),
      '',
      currentState === 'waiting_payment'
        ? 'Tambem entendi que voce quer alterar o pedido, mas eu nao faco essa mudanca automaticamente enquanto ele aguarda pagamento.'
        : 'Tambem entendi que voce quer alterar o pedido, mas eu nao faco essa mudanca automaticamente nessa fase.',
      'Se precisar ajustar item, endereco, entrega ou pagamento, o caminho seguro e atendimento humano.',
      '',
      `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
    ].join('\n');
  }

  private hasAnyNormalizedPhrase(
    normalizedValue: string,
    phrases: string[],
  ): boolean {
    return this.messageIntelligenceService.hasAnyPhrase(normalizedValue, phrases);
  }

  private hasActiveOrderContext(
    conversation?: TypedConversation,
    currentState?: ConversationState,
  ): boolean {
    const activeStates = new Set<ConversationState>([
      'collecting_order',
      'collecting_name',
      'collecting_address',
      'collecting_phone',
      'collecting_notes',
      'collecting_cash_change',
      'confirming_order',
      'confirming_stock_adjustment',
      'waiting_payment',
      'order_confirmed',
      'order_completed',
    ]);

    return (
      !!conversation?.pedido_id ||
      !!conversation?.context?.pedido_id ||
      (!!currentState && activeStates.has(currentState))
    );
  }

  private isAmbiguousChoiceOrderIntent(lowerMessage: string): boolean {
    const normalized = this.normalizeIntentText(lowerMessage);
    if (!normalized) {
      return false;
    }

    const salesAnalysis = this.salesIntelligenceService.analyze(normalized);
    if (salesAnalysis.intent === 'comparison' || this.isDirectPriceQuestion(normalized)) {
      return false;
    }

    const orderInfo = this.extractOrderInfo(normalized);
    const hasDirectOrderVerb = this.hasAnyNormalizedPhrase(normalized, [
      'quero',
      'me ve',
      'me manda',
      'separa',
      'comprar',
      'pedir',
      'vou querer',
      'gostaria',
      'preciso',
    ]);
    const hasExplicitOrderPayload =
      this.looksLikeMultiItemOrder(normalized) ||
      (Number(orderInfo.quantity || 0) > 0 && Boolean(orderInfo.productName) && hasDirectOrderVerb);

    if (salesAnalysis.intent !== 'other' && !hasDirectOrderVerb) {
      return false;
    }

    const hasOrderShape =
      hasExplicitOrderPayload ||
      hasDirectOrderVerb;

    if (!hasOrderShape) {
      return false;
    }

    const hasUncertainty = this.hasAnyNormalizedPhrase(normalized, [
      'nao sei',
      'to em duvida',
      'estou em duvida',
      'em duvida',
      'talvez',
      'quem sabe',
      'qual voce indica',
      'qual vc indica',
      'qual e melhor',
      'qual eh melhor',
      'me indica',
      'me sugere',
    ]);

    return hasUncertainty || normalized.includes(' ou ');
  }

  private getPremiumOrderChoiceClarificationMessage(): string {
    return [
      'Eu prefiro fechar uma decisao por vez para nao montar o item errado.',
      '',
      'Me envie uma opcao clara para eu seguir sem risco.',
      'Exemplos:',
      '- "quero 1 brigadeiro gourmet"',
      '- "me indica entre brownie e brigadeiro"',
      '- "cardapio"',
    ].join('\n');
  }

  private shouldGuardPostFlowMutation(
    lowerMessage: string,
    currentState?: ConversationState,
  ): boolean {
    const normalized = this.normalizeIntentText(lowerMessage);
    if (!normalized || !currentState || !['waiting_payment', 'order_confirmed'].includes(currentState)) {
      return false;
    }

    if (
      this.isPaymentMethodSelection(normalized) ||
      this.isPaymentProofIntent(normalized) ||
      this.isPostOrderCourtesyIntent(normalized)
    ) {
      return false;
    }

    return (
      this.isPostOrderChangeIntent(normalized) ||
      this.looksLikeMultiItemOrder(normalized) ||
      this.isOrderIntent(normalized)
    );
  }

  private isMixedStatusAndMutationIntent(
    lowerMessage: string,
    conversation?: TypedConversation,
    currentState?: ConversationState,
  ): boolean {
    const normalized = this.normalizeIntentText(lowerMessage);
    if (!normalized || !currentState || !['waiting_payment', 'order_confirmed'].includes(currentState)) {
      return false;
    }

    return (
      this.looksLikeOrderStatusQuery(normalized, conversation) &&
      this.shouldGuardPostFlowMutation(normalized, currentState)
    );
  }

  private isMixedStatusAndFreshOrderIntent(
    lowerMessage: string,
    conversation?: TypedConversation,
  ): boolean {
    const normalized = this.normalizeIntentText(lowerMessage);
    if (!normalized) {
      return false;
    }

    return (
      this.looksLikeOrderStatusQuery(normalized, conversation) &&
      (this.looksLikeMultiItemOrder(normalized) || this.isOrderIntent(normalized))
    );
  }

  private getMixedIntentClarificationMessage(): string {
    return [
      'Entendi mais de um objetivo na mesma mensagem.',
      '',
      'Para eu nao tomar a acao errada, me envie uma coisa por vez.',
      'Exemplos:',
      '- "status do pedido"',
      '- "quero 2 brigadeiros"',
      '- "mudar endereco do pedido"',
    ].join('\n');
  }

  private buildInboundSignature(value: string): string {
    return this.normalizeIntentText(value)
      .replace(/\bped[\s-]?\d{8}[\s-]?[a-z0-9]{3,}\b/gi, 'pedido_codigo')
      .replace(/\b\d{10,11}\b/g, 'telefone')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildInboundEventReplayKey(
    message: WhatsappMessage,
    _sanitizedBody: string,
  ): string | null {
    const explicitMessageId = String(message.messageId || message.metadata?.['messageId'] || '').trim();
    if (explicitMessageId) {
      return `${message.tenantId || 'tenant'}:${message.from}:${explicitMessageId}`;
    }

    return null;
  }

  private getInboundReplayWindowMs(): number {
    return 24 * 60 * 60 * 1000;
  }

  private shouldReplayPreviousResponse(
    message: WhatsappMessage,
    sanitizedBody: string,
    conversation?: TypedConversation,
  ): { replay: boolean; eventKey: string | null; response?: WhatsappOutboundResponse } {
    const eventKey = this.buildInboundEventReplayKey(message, sanitizedBody);
    if (!conversation || !eventKey) {
      return { replay: false, eventKey };
    }

    const previousKey = String(conversation.context?.last_processed_event_key || '');
    const previousAt = conversation.context?.last_processed_event_at
      ? new Date(String(conversation.context.last_processed_event_at)).getTime()
      : Number.NaN;

    if (!previousKey || previousKey !== eventKey || !Number.isFinite(previousAt)) {
      return { replay: false, eventKey };
    }

    if (Date.now() - previousAt > this.getInboundReplayWindowMs()) {
      return { replay: false, eventKey };
    }

    const previousPayload = this.deserializeOutboundResponse(
      conversation.context?.last_processed_response_payload,
    );
    const previousResponse =
      previousPayload ||
      String(
        conversation.context?.last_processed_response ||
          conversation.context?.last_outbound_preview ||
          '',
      ).trim();

    return {
      replay: true,
      eventKey,
      response:
        previousResponse ||
        this.buildDuplicateProtectionMessage(conversation, Number(conversation.context?.last_inbound_repeat_count || 1)),
    };
  }

  private buildInboundMessageMetadata(message: WhatsappMessage): Record<string, unknown> {
    return {
      messageId: message.messageId || null,
      messageType: message.messageType || 'text',
      mediaUrl: message.mediaUrl || null,
      originalTimestamp: message.timestamp || null,
      ...(message.metadata || {}),
    };
  }

  private buildResponsePreview(value: string): string {
    return (value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
  }

  private getOutboundMessageType(
    response: WhatsappOutboundResponse,
  ): 'text' | 'button' {
    return this.isInteractiveListResponse(response) ? 'button' : 'text';
  }

  private buildOutboundMessageMetadata(
    response: WhatsappOutboundResponse,
  ): Record<string, unknown> {
    if (!this.isInteractiveListResponse(response)) {
      return {};
    }

    return {
      interactiveType: 'list',
      sectionCount: response.list.sections.length,
      rowCount: response.list.sections.reduce(
        (total, section) => total + section.rows.length,
        0,
      ),
      buttonText: response.list.buttonText,
      title: response.list.title,
    };
  }

  private getMessageRepeatWindowMs(): number {
    return 15000;
  }

  private shouldSuppressRepeatedInbound(
    message: string,
    conversation?: TypedConversation,
  ): { suppress: boolean; repeatCount: number } {
    if (!conversation) {
      return { suppress: false, repeatCount: 0 };
    }

    const currentState = conversation.context?.state as ConversationState | undefined;
    const signature = this.buildInboundSignature(message);
    const previousSignature = String(conversation.context?.last_inbound_signature || '');
    const previousAt = conversation.context?.last_inbound_at
      ? new Date(String(conversation.context.last_inbound_at)).getTime()
      : Number.NaN;
    const repeatCount = Number(conversation.context?.last_inbound_repeat_count || 0);

    if (!signature || signature !== previousSignature || !Number.isFinite(previousAt)) {
      return { suppress: false, repeatCount: 0 };
    }

    const ageMs = Date.now() - previousAt;
    if (ageMs > this.getMessageRepeatWindowMs()) {
      return { suppress: false, repeatCount: 0 };
    }

    const actionable =
      this.isPaymentMethodSelection(message) ||
      this.isCancelIntent(message, conversation, currentState) ||
      this.looksLikeOrderStatusQuery(message, conversation) ||
      this.isReopenIntent(message) ||
      this.isRepeatOrderIntent(message) ||
      this.isBareOrderIntent(message) ||
      this.isOrderIntent(message) ||
      this.looksLikeMultiItemOrder(message) ||
      ['ajuda', 'cardapio', 'menu', 'catálogo', 'catalogo'].includes(signature);

    if (!actionable) {
      return { suppress: false, repeatCount: 0 };
    }

    return { suppress: true, repeatCount: repeatCount + 1 };
  }

  private buildDuplicateProtectionMessage(
    conversation?: TypedConversation,
    repeatCount = 1,
  ): string {
    const currentState = conversation?.context?.state as ConversationState | undefined;
    const lastPreview =
      typeof conversation?.context?.last_outbound_preview === 'string'
        ? String(conversation.context.last_outbound_preview)
        : '';

    const intro =
      currentState === 'waiting_payment'
        ? 'Ja recebi essa mesma mensagem e estou evitando pagamento ou processamento em duplicidade.'
        : 'Ja recebi essa mesma mensagem ha instantes e estou evitando duplicidade por seguranca.';

    const followUp =
      repeatCount >= 2
        ? 'Se voce quiser mudar o pedido, me envie a proxima instrucao com mais detalhes.'
        : 'Se quiser corrigir algo, me envie a proxima instrucao com mais detalhes.';

    return [
      intro,
      '',
      lastPreview ? `Ultima orientacao: ${lastPreview}` : '',
      followUp,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private containsAbusiveLanguage(lowerMessage: string): boolean {
    const normalized = this.normalizeIntentText(lowerMessage);
    if (!normalized) return false;

    return [
      'idiota',
      'burro',
      'burr0',
      'burra',
      'lixo',
      'merda',
      'porra',
      'caralho',
      'caraio',
      'cacete',
      'otario',
      'otaria',
      'imbecil',
      'vtnc',
      'vsf',
      'fdp',
      'filho da puta',
      'vai tomar no cu',
      'vai se fuder',
      'sacanagem',
      'ridiculo',
      'ridicula',
      'inutil',
      'lerdo',
      'lerda',
      'palhacada',
      'patetico',
      'patetica',
      'responde direito',
    ].some((term) => normalized.includes(this.normalizeIntentText(term)));
  }

  private hasActionableIntent(
    lowerMessage: string,
    conversation?: TypedConversation,
    currentState?: ConversationState,
  ): boolean {
    const normalized = this.normalizeIntentText(lowerMessage);
    if (!normalized) return false;

    return (
      this.isPaymentMethodSelection(normalized) ||
      this.isPaymentProofIntent(normalized) ||
      this.isPostOrderChangeIntent(normalized) ||
      this.isCancelIntent(normalized, conversation, currentState) ||
      this.looksLikeOrderStatusQuery(normalized, conversation) ||
      this.isReopenIntent(normalized) ||
      this.isRepeatOrderIntent(normalized) ||
      this.isBareOrderIntent(normalized) ||
      this.isOrderIntent(normalized) ||
      this.looksLikeMultiItemOrder(normalized) ||
      this.hasAnyNormalizedPhrase(normalized, [
        'ajuda',
        'cardapio',
        'catalogo',
        'catalogo',
        'menu',
        'preco',
        'valor',
        'quanto custa',
        'estoque',
        'tem',
        'disponivel',
        'horario',
      ])
    );
  }

  private isConversationalSupportBlockedByActionableIntent(
    normalizedMessage: string,
    conversation?: TypedConversation,
    currentState?: ConversationState,
  ): boolean {
    if (!normalizedMessage) {
      return true;
    }

    if (this.salesIntelligenceService.analyze(normalizedMessage).intent !== 'other') {
      return true;
    }

    return (
      this.isPaymentMethodSelection(normalizedMessage) ||
      this.isPaymentProofIntent(normalizedMessage) ||
      this.isPostOrderChangeIntent(normalizedMessage) ||
      this.isCancelIntent(normalizedMessage, conversation, currentState) ||
      this.looksLikeOrderStatusQuery(normalizedMessage, conversation) ||
      this.isReopenIntent(normalizedMessage) ||
      this.isRepeatOrderIntent(normalizedMessage) ||
      this.isBareOrderIntent(normalizedMessage) ||
      this.isOrderIntent(normalizedMessage) ||
      this.looksLikeMultiItemOrder(normalizedMessage) ||
      this.isDirectCatalogRequest(normalizedMessage) ||
      this.isDirectPriceQuestion(normalizedMessage) ||
      this.isDirectStockQuestion(normalizedMessage) ||
      this.isDirectScheduleQuestion(normalizedMessage)
    );
  }

  private joinNaturally(items: string[]): string {
    const normalizedItems = items
      .map((item) => String(item || '').trim())
      .filter((item) => item.length > 0);

    if (!normalizedItems.length) {
      return '';
    }

    if (normalizedItems.length === 1) {
      return normalizedItems[0];
    }

    if (normalizedItems.length === 2) {
      return `${normalizedItems[0]} e ${normalizedItems[1]}`;
    }

    return `${normalizedItems.slice(0, -1).join(', ')} e ${
      normalizedItems[normalizedItems.length - 1]
    }`;
  }

  private getConversationalSupportLead(
    analysis: ConversationalAnalysis,
    plan?: ConversationPlan,
  ): string {
    if (plan?.lead) {
      return plan.lead;
    }

    switch (analysis.intent) {
      case 'issue':
        return 'Sem problema, vamos resolver isso sem perder o contexto.';
      case 'handoff':
        return 'Posso te adiantar por aqui sem perder nada do que ja foi enviado.';
      case 'hesitation':
        return 'Sem pressa.';
      case 'gratitude':
        return 'Eu que agradeco.';
      case 'clarification':
        return 'Calma, eu te explico certinho.';
      default:
        return 'Posso te ajudar por aqui.';
    }
  }

  private getConversationalCalibrationLine(
    analysis: ConversationalAnalysis,
    plan?: ConversationPlan,
  ): string {
    if (plan?.mode === 'trust_reassurance') {
      return 'Eu vou te explicar o motivo do que eu estou te pedindo e so depois te puxo para qualquer confirmacao.';
    }

    if (plan?.mode === 'decision_coaching') {
      return 'Eu vou organizar a decisao com criterio e sem te empurrar item so para girar venda.';
    }

    switch (analysis.posture) {
      case 'frustrated':
        return plan?.mode === 'issue_recovery' || plan?.mode === 'post_order_support'
          ? 'Eu vou separar o problema sem perder contexto nem baguncar o que ja esta certo.'
          : 'Eu vou organizar isso em uma etapa por vez para nao virar mais ruido.';
      case 'reassurance':
        return 'Eu vou te orientar com clareza para voce nao confirmar nada sem entender o que esta acontecendo.';
      case 'urgent':
        return 'Vou ser objetivo e puxar so o que resolve agora, sem pular o que e critico.';
      case 'confused':
        return 'Vou separar isso em uma etapa por vez para ficar claro.';
      case 'hesitant':
        return 'Sem pressa: eu posso te ajudar a comparar com criterio antes de fechar.';
      default:
        return '';
    }
  }

  private getCollectionStageNeedExplanation(
    currentState: ConversationState,
    customerData?: CustomerData,
  ): string {
    switch (currentState) {
      case 'collecting_name':
        return 'Eu preciso disso para identificar corretamente quem vai receber o pedido.';
      case 'collecting_address':
        return customerData?.delivery_type
          ? 'Eu preciso disso para a entrega sair certa, sem erro de rota nem de bairro.'
          : 'Eu preciso alinhar primeiro se vai ser entrega ou retirada para nao te fazer repetir nada depois.';
      case 'collecting_phone':
        return 'Eu preciso disso para te atualizar se a equipe precisar falar com voce sobre entrega, pagamento ou algum detalhe do pedido.';
      case 'collecting_notes':
        return 'Eu preciso disso para alinhar qualquer detalhe fino com a equipe antes de fechar.';
      case 'collecting_cash_change':
        return 'Eu preciso disso para o entregador ja sair com o troco certo.';
      case 'confirming_stock_adjustment':
        return 'Eu preciso alinhar isso agora para nao prometer uma quantidade que o estoque nao sustenta.';
      case 'confirming_order':
        return 'Eu preciso revisar isso agora para corrigir qualquer detalhe antes de gravar o pedido.';
      default:
        return 'Eu quero te conduzir sem te fazer repetir informacao desnecessaria.';
    }
  }

  private buildHumanSalesReasoning(
    analysis: SalesConversationAnalysis,
    strategy: SalesConversationStrategy,
    catalogProfile: CatalogSalesProfile,
  ): string {
    const detectedNeeds = strategy.detectedNeeds.slice(0, 2).map((need) => need.label);
    const focusThemes = catalogProfile.focusThemes.slice(0, 2).map((theme) => theme.label);
    const understandingLine = this.buildSalesUnderstandingLine(analysis);
    const decisionLine = this.buildSalesDecisionLine(analysis);

    const lead =
      analysis.intent === 'budget'
        ? 'Pelo valor que voce me passou, eu puxei o que ainda entrega bem sem ficar fraco para a ocasiao.'
        : analysis.intent === 'objection'
          ? 'Entendi a preocupacao com preco, entao eu puxei caminhos que preservam valor percebido sem forcar o ticket.'
          : analysis.intent === 'comparison'
            ? 'Comparei pensando no que faz mais sentido para o momento que voce descreveu.'
            : 'Pelo que voce me contou, eu puxei primeiro o que mais combina com esse momento da compra.';

    const details: string[] = [];

    if (analysis.customerGoalSummary) {
      details.push(`O que eu entendi da sua busca foi: ${analysis.customerGoalSummary}.`);
    }

    if (understandingLine) {
      details.push(understandingLine);
    }

    if (analysis.buyerConcerns.length) {
      details.push(
        `Eu tambem considerei principalmente ${this.joinNaturally(
          analysis.buyerConcerns.slice(0, 3),
        )}.`,
      );
    }

    if (detectedNeeds.length) {
      details.push(`Aqui eu considerei principalmente ${this.joinNaturally(detectedNeeds)}.`);
    }

    if (focusThemes.length) {
      details.push(
        `Dentro do catalogo atual da loja, eu estou lendo melhor uma vitrine de ${
          catalogProfile.storeLabel
        }, com saida mais forte para ${this.joinNaturally(focusThemes)}.`,
      );
    } else if (catalogProfile.storeLabel) {
      details.push(
        `Dentro do catalogo atual da loja, a leitura principal hoje esta em ${catalogProfile.storeLabel}.`,
      );
    }

    if (decisionLine) {
      details.push(decisionLine);
    }

    return [lead, ...details].join(' ');
  }

  private buildSalesUnderstandingLine(analysis: SalesConversationAnalysis): string | null {
    const pieces: string[] = [];

    if (analysis.useCaseTags.includes('gift') && analysis.recipientHint) {
      pieces.push(`um presente para ${analysis.recipientHint}`);
    } else if (analysis.useCaseTags.includes('gift')) {
      pieces.push('um contexto de presente');
    }

    if (analysis.useCaseTags.includes('sharing')) {
      pieces.push('algo para dividir sem perder impacto');
    }

    if (analysis.useCaseTags.includes('self_treat')) {
      pieces.push('um mimo mais voltado para voce');
    }

    if (analysis.useCaseTags.includes('chocolate_focus')) {
      pieces.push('uma pegada mais intensa no chocolate');
    }

    if (analysis.useCaseTags.includes('premium')) {
      pieces.push('uma leitura mais premium');
    }

    if (analysis.budgetCeiling !== null) {
      pieces.push(`um teto de ate R$ ${this.formatCurrency(analysis.budgetCeiling)}`);
    } else if (analysis.conversationDrivers.includes('value_pressure')) {
      pieces.push('cuidado com o valor da compra');
    }

    if (analysis.conversationDrivers.includes('reassurance')) {
      pieces.push('vontade de acertar sem erro');
    }

    if (analysis.conversationDrivers.includes('urgency')) {
      pieces.push('pressa para resolver isso agora');
    }

    if (analysis.conversationDrivers.includes('simplicity')) {
      pieces.push('algo mais simples e sem exagero');
    }

    if (!pieces.length) {
      return null;
    }

    return `Eu li aqui ${this.joinNaturally(pieces.slice(0, 4))}.`;
  }

  private buildSalesDecisionLine(analysis: SalesConversationAnalysis): string | null {
    if (analysis.decisionStage === 'closing') {
      return 'Como voce ja esta bem perto de fechar, eu puxei poucas opcoes prontas para virar pedido sem friccao.';
    }

    if (
      analysis.decisionStage === 'refining' &&
      (analysis.secondaryIntents.length > 0 ||
        analysis.conversationDrivers.includes('reassurance') ||
        analysis.conversationDrivers.includes('urgency'))
    ) {
      return 'Entao eu preferi reduzir ruido e organizar so o que mais ajuda a decidir com seguranca.';
    }

    return null;
  }

  private buildConversationalIdleSupportMessage(
    analysis: ConversationalAnalysis,
    plan?: ConversationPlan,
    conversation?: TypedConversation,
  ): string {
    const calibration = this.getConversationalCalibrationLine(analysis, plan);

    if (plan?.mode === 'context_recap') {
      const summaryLines = this.buildCustomerFocusSnapshot(conversation);
      return this.buildContextRecapMessage(
        this.getConversationalSupportLead(analysis, plan),
        summaryLines,
        summaryLines.length
          ? 'Se estiver tudo certo ate aqui, me diga o proximo passo que eu continuo do ponto certo.'
          : 'Ainda nao tenho um pedido travado aqui. Se quiser, me diga o que voce quer resolver e eu comeco com voce do jeito certo.',
      );
    }

    if (analysis.intent === 'gratitude') {
      return [
        'Eu que agradeco.',
        '',
        'Quando quiser continuar, pode falar do seu jeito.',
        'Exemplo: "quero um presente", "status do pedido" ou "o pix nao apareceu".',
      ].join('\n');
    }

    if (plan?.mode === 'trust_reassurance') {
      return [
        this.getConversationalSupportLead(analysis, plan),
        '',
        calibration,
        '',
        `Entendi que agora voce quer ${plan.customerGoal}.`,
        this.getIdleTrustBridge(analysis),
        '',
        'Pode me falar do seu jeito, por exemplo:',
        '- "me explica melhor antes de eu seguir"',
        '- "o que exatamente voce precisa agora?"',
        '- "quero ter certeza antes de fechar"',
      ].join('\n');
    }

    if (plan?.mode === 'decision_coaching') {
      const memory = this.getConversationIntelligenceMemory(conversation);
      const referenceLine =
        memory.last_product_name
          ? `Se quiser, eu parto de *${memory.last_product_name}* e te mostro o que muda a partir dele.`
          : 'Eu nao vou te empurrar nada; vou afinar a decisao com voce do jeito mais seguro.';

      return [
        this.getConversationalSupportLead(analysis, plan),
        '',
        calibration,
        '',
        `Entendi que agora voce quer ${plan.customerGoal}.`,
        referenceLine,
        '',
        'Pode me responder do seu jeito, por exemplo:',
        '- "o que voce escolheria no meu lugar?"',
        '- "me mostra a opcao mais segura"',
        '- "me compara com uma mais em conta"',
      ].join('\n');
    }

    if (plan?.mode === 'sales_consultative') {
      const memory = this.getConversationIntelligenceMemory(conversation);
      const bridge =
        memory.last_intent && memory.last_intent !== 'other'
          ? 'Se quiser, eu continuo exatamente de onde a nossa conversa ficou e refino a escolha sem te fazer voltar do zero.'
          : 'Se quiser, eu te guio como consultora mesmo: entendendo ocasiao, valor, quantidade ou duvida antes de empurrar qualquer item.';

      return [
        this.getConversationalSupportLead(analysis, plan),
        '',
        calibration,
        '',
        `Entendi que agora voce quer ${plan.customerGoal}.`,
        bridge,
        '',
        'Pode me responder do seu jeito, por exemplo:',
        '- "e para presente, mas nao quero nada exagerado"',
        '- "quero algo mais em conta"',
        '- "me compara duas opcoes"',
      ].join('\n');
    }

    const lead = this.getConversationalSupportLead(analysis, plan);
    if (plan?.mode === 'handoff_ready') {
      const summaryLines = this.buildCustomerFocusSnapshot(conversation);
      return this.buildMemoryAwareHandoffMessage(
        lead,
        summaryLines.length ? summaryLines : ['- Contexto aberto sem um pedido travado no momento'],
        'Se quiser, me diga em uma frase o que precisa que eu deixo esse resumo ainda mais pronto para a equipe.',
      );
    }

    const bridge =
      analysis.intent === 'handoff'
        ? 'Se depois precisar envolver alguem da equipe, eu ja deixo o contexto organizado sem te fazer repetir tudo.'
        : analysis.intent === 'issue'
          ? 'Me diga em uma frase o que deu errado e eu tento te puxar para o caminho certo sem baguncar pedido, pagamento ou estoque.'
          : 'Pode me dizer em uma frase o que voce quer resolver agora e eu sigo dai.';

    return [
      lead,
      '',
      calibration,
      '',
      bridge,
      '',
      'Voce pode falar naturalmente, por exemplo:',
      '- "quero um presente ate 50 reais"',
      '- "meu pix nao apareceu"',
      '- "quero acompanhar meu pedido"',
      '- "acho que voce nao entendeu o que eu quis dizer"',
    ].join('\n');
  }

  private buildConversationalCollectionSupportMessage(
    analysis: ConversationalAnalysis,
    plan: ConversationPlan,
    currentState: ConversationState,
    conversation?: TypedConversation,
  ): string {
    const customerData = (conversation?.context?.customer_data || {}) as CustomerData;
    const lead = this.getConversationalSupportLead(analysis, plan);
    const calibration = this.getConversationalCalibrationLine(analysis, plan);
    const whyThisStageMatters = plan.explainWhyCurrentStep
      ? this.getCollectionStageNeedExplanation(currentState, customerData)
      : '';
    const reassurance =
      plan.mode === 'handoff_ready'
        ? 'Se depois for preciso envolver alguem da equipe, eu mantenho tudo organizado para voce nao repetir nada.'
        : plan.mode === 'issue_recovery'
          ? 'Eu nao vou avancar nada errado antes de alinhar esse ponto com voce.'
          : '';
    const trustLine =
      plan.mode === 'trust_reassurance'
        ? this.getCollectionTrustLine(currentState, customerData)
        : '';
    const contextRecap =
      plan.mode === 'context_recap'
        ? this.buildContextRecapMessage(
            lead,
            this.buildCustomerFocusSnapshot(conversation, currentState),
            this.getCollectionRecapGuidance(currentState, customerData),
          )
        : null;
    const handoffMessage =
      plan.mode === 'handoff_ready'
        ? this.buildMemoryAwareHandoffMessage(
            lead,
            this.buildCustomerFocusSnapshot(conversation, currentState),
            'Antes disso, eu ainda consigo resolver por aqui se voce me disser exatamente o que precisa ajustar.',
          )
        : null;

    if (handoffMessage) {
      return handoffMessage;
    }

    if (contextRecap) {
      return contextRecap;
    }

    switch (currentState) {
      case 'collecting_name':
        return [
          lead,
          '',
          calibration,
          '',
          whyThisStageMatters,
          trustLine,
          reassurance,
          plan.mode === 'issue_recovery'
            ? this.getCollectionCorrectionPrompt(currentState, customerData)
            : 'Neste momento eu so preciso do nome completo de quem vai receber o pedido.',
          'Exemplo: "Ana Paula Souza".',
        ].join('\n');
      case 'collecting_address':
        const needsDeliveryChoice = !customerData?.delivery_type;
        return [
          lead,
          '',
          calibration,
          '',
          whyThisStageMatters,
          trustLine,
          reassurance,
          plan.mode === 'issue_recovery'
            ? this.getCollectionCorrectionPrompt(currentState, customerData)
            : needsDeliveryChoice
              ? 'Neste momento eu so preciso saber se voce prefere entrega ou retirada.'
              : 'Neste momento eu so preciso do endereco de entrega para fechar sem risco de erro.',
          '',
          needsDeliveryChoice
            ? this.getPremiumDeliveryChoicePrompt(customerData?.name)
            : this.getPremiumAddressPrompt(),
        ].join('\n');
      case 'collecting_phone':
        return [
          lead,
          '',
          calibration,
          '',
          whyThisStageMatters,
          trustLine,
          reassurance,
          plan.mode === 'issue_recovery'
            ? this.getCollectionCorrectionPrompt(currentState, customerData)
            : 'Neste momento eu so preciso do telefone de contato com DDD para seguir com seguranca.',
          '',
          this.getPremiumPhonePrompt(),
        ].join('\n');
      case 'collecting_notes':
        return [
          lead,
          '',
          calibration,
          '',
          whyThisStageMatters,
          trustLine,
          reassurance,
          plan.mode === 'issue_recovery'
            ? this.getCollectionCorrectionPrompt(currentState, customerData)
            : 'Neste momento eu so preciso saber se existe alguma observacao importante para a equipe.',
          '',
          this.getPremiumNotesPrompt(),
        ].join('\n');
      case 'collecting_cash_change':
        return [
          lead,
          '',
          calibration,
          '',
          whyThisStageMatters,
          trustLine,
          reassurance,
          plan.mode === 'issue_recovery'
            ? this.getCollectionCorrectionPrompt(currentState, customerData)
            : 'Neste momento eu so preciso saber o troco para quanto.',
          'Exemplo: "troco para 100".',
        ].join('\n');
      case 'confirming_stock_adjustment':
        return [
          lead,
          '',
          calibration,
          '',
          whyThisStageMatters,
          trustLine,
          reassurance,
          plan.mode === 'issue_recovery'
            ? this.getCollectionCorrectionPrompt(currentState, customerData)
            : 'Eu estou validando a quantidade segura para o estoque agora.',
          plan.mode === 'issue_recovery'
            ? 'Se quiser, eu ajusto a quantidade assim que voce me disser o numero certo.'
            : 'Se quiser seguir, confirme a quantidade sugerida ou me diga outra quantidade.',
        ].join('\n');
      case 'confirming_order':
        return [
          lead,
          '',
          calibration,
          '',
          whyThisStageMatters,
          trustLine,
          reassurance,
          'Agora eu estou na revisao final do pedido.',
          plan.mode === 'issue_recovery'
            ? this.getCollectionCorrectionPrompt(currentState, customerData)
            : 'Se algo estiver errado, me diga exatamente o que ajustar.',
          'Se estiver tudo certo, responda "sim" ou "confirmar".',
        ].join('\n');
      default:
        return lead;
    }
  }

  private async buildConversationalPostFlowSupportMessage(
    analysis: ConversationalAnalysis,
    plan: ConversationPlan,
    tenantId: string,
    conversation: TypedConversation,
    currentState: ConversationState,
  ): Promise<string | null> {
    const pedido = await this.resolveRelevantOrder(tenantId, conversation);
    if (!pedido) {
      return null;
    }

    const calibration = this.getConversationalCalibrationLine(analysis, plan);

    if (analysis.intent === 'gratitude') {
      return this.buildPostOrderCourtesyMessage(pedido, currentState);
    }

    if (plan.mode === 'context_recap') {
      return this.buildContextRecapMessage(
        this.getConversationalSupportLead(analysis, plan),
        this.buildCustomerFocusSnapshot(conversation, currentState, {
          orderNo: pedido.order_no,
          statusLabel: this.getStatusLabel(pedido.status),
        }),
        currentState === 'waiting_payment'
          ? `Se estiver tudo certo ate aqui, me diga "pix" para gerar outra cobranca ou "ja paguei" se o pagamento ja foi feito. Acompanhamento: ${this.buildTrackingUrl(
              pedido.order_no,
            )}`
          : `Se quiser, eu sigo por aqui com a proxima duvida sem mexer errado no pedido. Acompanhamento: ${this.buildTrackingUrl(
              pedido.order_no,
            )}`,
      );
    }

    if (plan.mode === 'handoff_ready') {
      return this.buildMemoryAwareHandoffMessage(
        this.getConversationalSupportLead(analysis, plan),
        this.buildCustomerFocusSnapshot(conversation, currentState, {
          orderNo: pedido.order_no,
          statusLabel: this.getStatusLabel(pedido.status),
        }),
        `Se quiser, eu continuo por aqui tambem. Acompanhamento completo: ${this.buildTrackingUrl(
          pedido.order_no,
        )}`,
      );
    }

    if (plan.mode === 'trust_reassurance') {
      const trustLine = this.getPostFlowTrustLine(currentState, analysis);

      if (currentState === 'waiting_payment') {
        return [
          this.getConversationalSupportLead(analysis, plan),
          '',
          calibration,
          '',
          `Entendi que agora voce quer ${plan.customerGoal}.`,
          `Pedido: *${pedido.order_no}*`,
          `Status atual: *${this.getStatusLabel(pedido.status)}*`,
          trustLine,
          'Se o Pix nao apareceu, me diga "pix". Se voce ja pagou, me diga "ja paguei".',
          '',
          `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
        ].join('\n');
      }

      return [
        this.getConversationalSupportLead(analysis, plan),
        '',
        calibration,
        '',
        `Entendi que agora voce quer ${plan.customerGoal}.`,
        `Pedido: *${pedido.order_no}*`,
        `Status atual: *${this.getStatusLabel(pedido.status)}*`,
        trustLine,
        this.getNextStepSummary(pedido, pedido.status),
        '',
        `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
      ].join('\n');
    }

    if (currentState === 'waiting_payment') {
      return [
        this.getConversationalSupportLead(analysis, plan),
        '',
        calibration,
        '',
        `Entendi que agora voce quer ${plan.customerGoal}.`,
        `Pedido: *${pedido.order_no}*`,
        `Status atual: *${this.getStatusLabel(pedido.status)}*`,
        'Eu nao vou mexer errado no pedido; neste momento eu so preciso destravar a etapa de pagamento.',
        'Se o Pix nao apareceu, me diga "pix". Se voce ja pagou, me diga "ja paguei".',
        '',
        `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
      ].join('\n');
    }

    return [
      this.getConversationalSupportLead(analysis, plan),
      '',
      calibration,
      '',
      `Entendi que agora voce quer ${plan.customerGoal}.`,
      `Pedido: *${pedido.order_no}*`,
      `Status atual: *${this.getStatusLabel(pedido.status)}*`,
      this.getNextStepSummary(pedido, pedido.status),
      'Se o problema for entrega, andamento ou alguma duvida dessa compra, me fale em uma frase que eu te respondo sem mexer errado no pedido.',
      '',
      `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
    ].join('\n');
  }

  private async tryConversationalSupportResponse(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
    currentState?: ConversationState,
  ): Promise<string | null> {
    const analysis = this.conversationalIntelligenceService.analyze(message);
    const normalized = analysis.normalizedText;

    if (
      (!currentState || ['idle', 'order_confirmed', 'order_completed'].includes(currentState)) &&
      this.isOutOfFlowStopIntent(normalized)
    ) {
      return this.getPremiumSoftResetMessage();
    }

    const salesAnalysis = this.salesIntelligenceService.analyze(message);
    const plan = this.conversationPlannerService.buildPlan({
      message,
      conversationalAnalysis: analysis,
      salesAnalysis,
      currentState,
      memory: this.getConversationIntelligenceMemory(conversation),
    });
    if (plan.mode === 'none') {
      return null;
    }

    if (
      this.containsAbusiveLanguage(normalized) &&
      !analysis.signals.issue &&
      !analysis.signals.clarification
    ) {
      return null;
    }

    const allowConversationalOverride = plan.shouldOverrideTransactional;

    if (
      !allowConversationalOverride &&
      this.isConversationalSupportBlockedByActionableIntent(
        normalized,
        conversation,
        currentState,
      )
    ) {
      return null;
    }

    if (
      currentState &&
      [
        'collecting_name',
        'collecting_address',
        'collecting_phone',
        'collecting_notes',
        'collecting_cash_change',
        'confirming_stock_adjustment',
        'confirming_order',
      ].includes(currentState)
    ) {
      const response = this.buildConversationalCollectionSupportMessage(
        analysis,
        plan,
        currentState,
        conversation,
      );
      await this.rememberConversationIntelligence(conversation, {
        last_response_mode: plan.mode,
        last_customer_goal: plan.customerGoal,
        last_handoff_summary:
          plan.mode === 'handoff_ready'
            ? this.buildCustomerFocusSnapshot(conversation, currentState).join(' | ')
            : null,
      });
      return response;
    }

    if (
      conversation &&
      currentState &&
      ['waiting_payment', 'order_confirmed', 'order_completed'].includes(currentState)
    ) {
      const response = await this.buildConversationalPostFlowSupportMessage(
        analysis,
        plan,
        tenantId,
        conversation,
        currentState,
      );
      if (response) {
        await this.rememberConversationIntelligence(conversation, {
          last_response_mode: plan.mode,
          last_customer_goal: plan.customerGoal,
          last_handoff_summary:
            plan.mode === 'handoff_ready'
              ? this.buildCustomerFocusSnapshot(conversation, currentState).join(' | ')
              : null,
        });
      }
      return response;
    }

    const response = this.buildConversationalIdleSupportMessage(analysis, plan, conversation);
    await this.rememberConversationIntelligence(conversation, {
      last_response_mode: plan.mode,
      last_customer_goal: plan.customerGoal,
      last_handoff_summary:
        plan.mode === 'handoff_ready'
          ? this.buildCustomerFocusSnapshot(conversation).join(' | ')
          : null,
    });
    return response;
  }

  private getPremiumBoundaryMessage(abuseCount = 0): string {
    const tone =
      abuseCount >= 2
        ? 'Eu nao vou seguir nesse tom. Se quiser atendimento, me envie uma mensagem objetiva e respeitosa.'
        : abuseCount >= 1
        ? 'Eu sigo disponivel para ajudar, mas preciso que a mensagem venha objetiva e respeitosa.'
        : 'Posso te ajudar melhor se a mensagem vier objetiva e respeitosa.';

    return [
      tone,
      '',
      abuseCount >= 2 ? 'Escolha um caminho claro para eu continuar sem ruido:' : 'Se quiser seguir, me diga o que precisa. Exemplos:',
      '- "quero 2 brigadeiros e 1 brownie"',
      '- "status do pedido"',
      '- "cardapio"',
    ].join('\n');
  }

  private async getCatalogProducts(tenantId: string): Promise<ProductWithStock[]> {
    const result = await this.productsService.findAll(tenantId);
    const products = Array.isArray(result) ? result : result.data;
    return products.filter((product) => !!product?.name);
  }

  private buildCatalogCategoryKey(categoryName: string): string {
    return this.normalizeForSearch(categoryName || '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 40);
  }

  private parseCatalogSelection(
    message: string,
  ): CatalogSelection | null {
    const normalized = String(message || '').trim();
    if (!normalized) {
      return null;
    }

    if (normalized === 'catalog_root') {
      return {
        type: 'root',
      };
    }

    const rootPageMatch = normalized.match(/^catalog_page:(\d+)$/);
    if (rootPageMatch) {
      return {
        type: 'root_page',
        page: Math.max(1, Number(rootPageMatch[1] || 1)),
      };
    }

    const categoryPageMatch = normalized.match(/^catalog_category:([^:]+):page:(\d+)$/);
    if (categoryPageMatch) {
      return {
        type: 'category_page',
        key: categoryPageMatch[1].trim(),
        page: Math.max(1, Number(categoryPageMatch[2] || 1)),
      };
    }

    if (normalized.startsWith('catalog_category:')) {
      return {
        type: 'category',
        key: normalized.substring('catalog_category:'.length).trim(),
      };
    }

    if (normalized.startsWith('catalog_product:')) {
      return {
        type: 'product',
        productId: normalized.substring('catalog_product:'.length).trim(),
      };
    }

    if (normalized.startsWith('catalog_buy:')) {
      return {
        type: 'buy',
        productId: normalized.substring('catalog_buy:'.length).trim(),
      };
    }

    if (normalized.startsWith('catalog_similar:')) {
      return {
        type: 'similar',
        productId: normalized.substring('catalog_similar:'.length).trim(),
      };
    }

    const recommendationMatch = normalized.match(
      /^catalog_recommend:(gift|budget|chocolate|self_treat)$/,
    );
    if (recommendationMatch) {
      return {
        type: 'recommendation',
        mode: recommendationMatch[1] as 'gift' | 'budget' | 'chocolate' | 'self_treat',
      };
    }

    return null;
  }

  private buildCatalogInteractiveResponse(
    title: string,
    description: string,
    buttonText: string,
    sections: WhatsAppInteractiveListSection[],
    previewText: string,
    footerText?: string,
  ): WhatsappOutboundResponse {
    return {
      kind: 'interactive_list',
      previewText,
      list: {
        title,
        description,
        buttonText,
        footerText,
        sections,
      },
    };
  }

  private getInteractiveCatalogProducts(products: ProductWithStock[]): ProductWithStock[] {
    return products.filter(
      (product) => product.is_active !== false && Number(product.available_stock || 0) > 0,
    );
  }

  private getCatalogCategoryEntries(
    products: ProductWithStock[],
  ): Array<[string, ProductWithStock[]]> {
    const grouped = new Map<string, ProductWithStock[]>();

    this.getInteractiveCatalogProducts(products).forEach((product) => {
      const categoryName = String(product.categoria?.name || 'Outros').trim() || 'Outros';
      const current = grouped.get(categoryName) || [];
      current.push(product);
      grouped.set(categoryName, current);
    });

    return Array.from(grouped.entries()).sort((left, right) =>
      left[0].localeCompare(right[0], 'pt-BR'),
    );
  }

  private paginateRows<T>(items: T[], page: number, pageSize: number): {
    pageItems: T[];
    totalPages: number;
    currentPage: number;
  } {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * pageSize;
    return {
      pageItems: items.slice(start, start + pageSize),
      totalPages,
      currentPage,
    };
  }

  private buildCatalogRootSections(
    products: ProductWithStock[],
    page = 1,
  ): WhatsAppInteractiveListSection[] {
    const groupedEntries = this.getCatalogCategoryEntries(products);
    const { pageItems, totalPages, currentPage } = this.paginateRows(
      groupedEntries,
      page,
      this.CATALOG_CATEGORY_PAGE_SIZE,
    );

    const sections: WhatsAppInteractiveListSection[] = [];
    const categoryRows = pageItems.map(([categoryName, items]) => ({
      id: `catalog_category:${this.buildCatalogCategoryKey(categoryName)}`,
      title: categoryName,
      description: `${items.length} item(ns) com estoque ativo`,
    }));

    if (categoryRows.length) {
      sections.push({
        title:
          totalPages > 1
            ? `Categorias (${currentPage}/${totalPages})`
            : 'Categorias',
        rows: categoryRows,
      });
    }

    const navigationRows: WhatsAppInteractiveListRow[] = [];
    if (currentPage > 1) {
      navigationRows.push({
        id: `catalog_page:${currentPage - 1}`,
        title: 'Ver categorias anteriores',
        description: 'Voltar uma pagina do catalogo',
      });
    }
    if (currentPage < totalPages) {
      navigationRows.push({
        id: `catalog_page:${currentPage + 1}`,
        title: 'Ver mais categorias',
        description: 'Abrir a proxima pagina do catalogo',
      });
    }
    if (navigationRows.length) {
      sections.push({
        title: 'Navegacao',
        rows: navigationRows,
      });
    }

    sections.push({
      title: 'Atalhos',
      rows: [
        {
          id: 'catalog_recommend:gift',
          title: 'Quero presentear',
          description: 'Sugestoes para presente e caixa',
        },
        {
          id: 'catalog_recommend:budget',
          title: 'Quero algo mais em conta',
          description: 'Opcoes com bom valor percebido',
        },
        {
          id: 'catalog_recommend:chocolate',
          title: 'Quero algo mais chocolatudo',
          description: 'Sugestoes mais intensas no chocolate',
        },
      ],
    });

    return sections;
  }

  private buildCategoryProductsSection(
    categoryName: string,
    products: ProductWithStock[],
    page = 1,
  ): WhatsAppInteractiveListSection[] {
    const activeProducts = this.getInteractiveCatalogProducts(products).sort((left, right) =>
      String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR'),
    );
    const { pageItems, totalPages, currentPage } = this.paginateRows(
      activeProducts,
      page,
      this.CATALOG_PRODUCT_PAGE_SIZE,
    );
    const categoryKey = this.buildCatalogCategoryKey(categoryName);

    const sections: WhatsAppInteractiveListSection[] = [];
    const rows = pageItems.map((product) => ({
      id: `catalog_product:${product.id}`,
      title: product.name,
      description: `R$ ${this.formatCurrency(Number(product.price || 0))}`,
    }));

    if (rows.length) {
      sections.push({
        title:
          totalPages > 1
            ? `${categoryName} (${currentPage}/${totalPages})`
            : categoryName,
        rows,
      });
    }

    const navigationRows: WhatsAppInteractiveListRow[] = [
      {
        id: 'catalog_root',
        title: 'Voltar ao cardapio',
        description: 'Ver todas as categorias novamente',
      },
    ];

    if (currentPage > 1) {
      navigationRows.push({
        id: `catalog_category:${categoryKey}:page:${currentPage - 1}`,
        title: `Itens anteriores de ${categoryName}`,
        description: 'Voltar uma pagina nesta categoria',
      });
    }
    if (currentPage < totalPages) {
      navigationRows.push({
        id: `catalog_category:${categoryKey}:page:${currentPage + 1}`,
        title: `Mais itens de ${categoryName}`,
        description: 'Abrir a proxima pagina desta categoria',
      });
    }

    sections.push({
      title: 'Navegacao',
      rows: navigationRows,
    });

    return sections;
  }

  private buildProductCardDescription(product: ProductWithStock): string {
    const description = String(product.description || '').replace(/\s+/g, ' ').trim();
    const stockLine =
      Number(product.available_stock || 0) > 0
        ? `${product.available_stock} unidade(s) com estoque ativo`
        : 'indisponivel agora';
    const categoryName = String(product.categoria?.name || 'Categoria').trim() || 'Categoria';

    return [
      `${this.formatProductHeadline(product)}`,
      `Disponibilidade: ${stockLine}`,
      description ? description.slice(0, 120) : `Categoria: ${categoryName}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private findCatalogSimilarProducts(
    target: ProductWithStock,
    products: ProductWithStock[],
  ): ProductWithStock[] {
    const targetCategory = String(target.categoria?.name || '').trim();
    const targetPrice = Number(target.price || 0);

    return this.getInteractiveCatalogProducts(products)
      .filter((product) => String(product.id) !== String(target.id))
      .map((product) => {
        let score = 0;
        if (String(product.categoria?.name || '').trim() === targetCategory) {
          score += 20;
        }

        const priceDistance = Math.abs(Number(product.price || 0) - targetPrice);
        score += Math.max(0, 12 - priceDistance);

        const targetDocument = this.buildProductSalesDocument(target);
        const productDocument = this.buildProductSalesDocument(product);
        const targetWords = targetDocument.split(/\s+/).filter((word) => word.length >= 4);
        targetWords.forEach((word) => {
          if (productDocument.includes(word)) {
            score += 2;
          }
        });

        return { product, score };
      })
      .sort((left, right) => right.score - left.score)
      .filter((item) => item.score > 0)
      .slice(0, 3)
      .map((item) => item.product);
  }

  private buildProductActionSections(
    product: ProductWithStock,
    products: ProductWithStock[],
  ): WhatsAppInteractiveListSection[] {
    const categoryName = String(product.categoria?.name || 'Categoria').trim() || 'Categoria';
    const categoryKey = this.buildCatalogCategoryKey(categoryName);
    const similarProducts = this.findCatalogSimilarProducts(product, products);

    const actionRows: WhatsAppInteractiveListRow[] = [
      {
        id: `catalog_buy:${product.id}`,
        title: 'Quero esse item',
        description: 'Comecar um pedido com 1 unidade',
      },
      {
        id: `catalog_category:${categoryKey}`,
        title: `Ver mais de ${categoryName}`,
        description: 'Voltar para esta categoria',
      },
      {
        id: 'catalog_root',
        title: 'Voltar ao cardapio',
        description: 'Ver todas as categorias novamente',
      },
    ];

    if (similarProducts.length) {
      actionRows.splice(1, 0, {
        id: `catalog_similar:${product.id}`,
        title: 'Ver parecidos',
        description: 'Itens com leitura parecida no catalogo',
      });
    }

    return [
      {
        title: 'Proximos passos',
        rows: actionRows,
      },
    ];
  }

  private async buildCatalogCategoryInteractiveResponse(
    categoryName: string,
    categoryProducts: ProductWithStock[],
    categoryPage: number,
    conversation?: TypedConversation,
  ): Promise<WhatsappOutboundResponse | string> {
    const sections = this.buildCategoryProductsSection(
      categoryName,
      categoryProducts,
      categoryPage,
    );
    if (!sections.length) {
      return `No momento eu nao encontrei itens ativos em ${categoryName}. Se quiser, envie "cardapio" para abrir outra categoria.`;
    }

    await this.rememberConversationIntelligence(conversation, {
      last_intent: 'suggestion',
      last_query: categoryName,
      last_catalog_category_key: this.buildCatalogCategoryKey(categoryName),
      last_catalog_category_name: categoryName,
      last_catalog_product_id: null,
    });

    return this.buildCatalogInteractiveResponse(
      categoryName,
      `Escolha um item para eu te mostrar com mais clareza dentro de ${categoryName}.`,
      'Ver itens',
      sections,
      `Abri ${categoryName} para voce. Escolha um item na lista e eu explico melhor por aqui.`,
      'Se preferir, tambem pode digitar o nome do item do seu jeito.',
    );
  }

  private async buildCatalogProductInteractiveResponse(
    selectedProduct: ProductWithStock,
    products: ProductWithStock[],
    conversation?: TypedConversation,
  ): Promise<WhatsappOutboundResponse> {
    const categoryName =
      String(selectedProduct.categoria?.name || 'Categoria').trim() || 'Categoria';

    await this.rememberConversationIntelligence(conversation, {
      last_intent: 'price',
      last_product_name: selectedProduct.name,
      last_product_names: [selectedProduct.name],
      last_query: selectedProduct.name,
      last_catalog_product_id: String(selectedProduct.id),
      last_catalog_category_key: this.buildCatalogCategoryKey(categoryName),
      last_catalog_category_name: categoryName,
    });

    return this.buildCatalogInteractiveResponse(
      selectedProduct.name,
      this.buildProductCardDescription(selectedProduct),
      'Ver opcoes',
      this.buildProductActionSections(selectedProduct, products),
      `Separei ${selectedProduct.name} com os proximos passos para voce seguir sem se perder.`,
      'Se preferir, tambem pode digitar do seu jeito: "quero 2 desse item".',
    );
  }

  private buildCatalogSimilarInteractiveResponse(
    selectedProduct: ProductWithStock,
    products: ProductWithStock[],
  ): WhatsappOutboundResponse | string {
    const similarProducts = this.findCatalogSimilarProducts(selectedProduct, products);
    if (!similarProducts.length) {
      return `Nao achei parecidos fortes com ${selectedProduct.name} agora. Se quiser, eu te mostro a categoria dele ou o cardapio inteiro.`;
    }

    const intro = `Itens parecidos com ${selectedProduct.name}`;
    const rows = similarProducts.map((product) => ({
      id: `catalog_product:${product.id}`,
      title: product.name,
      description: `R$ ${this.formatCurrency(Number(product.price || 0))}`,
    }));

    return this.buildCatalogInteractiveResponse(
      intro,
      'Separei opcoes com leitura parecida para voce comparar sem se perder.',
      'Ver parecidos',
      [
        {
          title: 'Parecidos',
          rows,
        },
        {
          title: 'Navegacao',
          rows: [
            {
              id: `catalog_product:${selectedProduct.id}`,
              title: 'Voltar para este item',
              description: selectedProduct.name,
            },
            {
              id: 'catalog_root',
              title: 'Voltar ao cardapio',
              description: 'Ver todas as categorias novamente',
            },
          ],
        },
      ],
      `Separei alguns parecidos com ${selectedProduct.name} para voce comparar.`,
      'Se quiser, toque em um item e eu detalho melhor.',
    );
  }

  private async tryMemoryDrivenCatalogResponse(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
    currentState?: ConversationState,
  ): Promise<WhatsappOutboundResponse | string | null> {
    if (!conversation) {
      return null;
    }

    if (currentState && !['idle', 'order_confirmed', 'order_completed'].includes(currentState)) {
      return null;
    }

    if (!this.supportsInteractiveListMessaging()) {
      return null;
    }

    const memory = this.getConversationIntelligenceMemory(conversation);
    if (
      !memory.last_catalog_product_id &&
      !memory.last_catalog_category_key
    ) {
      return null;
    }

    const products = await this.getCatalogProducts(tenantId);
    const groupedEntries = this.getCatalogCategoryEntries(products);

    if (memory.last_catalog_product_id && this.isCatalogSimilarFollowUpIntent(message)) {
      const selectedProduct = products.find(
        (product) => String(product.id) === String(memory.last_catalog_product_id),
      );
      if (selectedProduct) {
        return this.buildCatalogSimilarInteractiveResponse(selectedProduct, products);
      }
    }

    if (memory.last_catalog_category_key && this.isCatalogCategoryFollowUpIntent(message)) {
      const categoryEntry = groupedEntries.find(
        ([categoryName]) =>
          this.buildCatalogCategoryKey(categoryName) === memory.last_catalog_category_key,
      );
      if (categoryEntry?.[1]?.length) {
        return await this.buildCatalogCategoryInteractiveResponse(
          String(categoryEntry[0] || 'Categoria'),
          categoryEntry[1],
          1,
          conversation,
        );
      }
    }

    if (memory.last_catalog_product_id && this.isCatalogProductRecallIntent(message)) {
      const selectedProduct = products.find(
        (product) => String(product.id) === String(memory.last_catalog_product_id),
      );
      if (selectedProduct) {
        return await this.buildCatalogProductInteractiveResponse(
          selectedProduct,
          products,
          conversation,
        );
      }
    }

    return null;
  }

  private async tryBuildInteractiveCatalogResponse(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
    currentState?: ConversationState,
  ): Promise<WhatsappOutboundResponse | null> {
    if (!this.supportsInteractiveListMessaging()) {
      return null;
    }

    if (currentState && !['idle', 'order_confirmed', 'order_completed'].includes(currentState)) {
      return null;
    }

    const selection = this.parseCatalogSelection(message);
    const products = await this.getCatalogProducts(tenantId);
    const groupedEntries = this.getCatalogCategoryEntries(products);

    const buildRootResponse = (page = 1): WhatsappOutboundResponse | null => {
      const sections = this.buildCatalogRootSections(products, page);
      if (!sections.length) {
        return null;
      }

      const totalPages = Math.max(
        1,
        Math.ceil(groupedEntries.length / this.CATALOG_CATEGORY_PAGE_SIZE),
      );
      const safePage = Math.min(Math.max(1, page), totalPages);
      const description =
        totalPages > 1
          ? `Escolha uma categoria para navegar melhor pelo catalogo. Pagina ${safePage} de ${totalPages}.`
          : 'Escolha uma categoria para navegar melhor pelo catalogo. Depois eu te mostro os itens dessa secao.';

      return this.buildCatalogInteractiveResponse(
        'Cardapio da loja',
        description,
        'Abrir cardapio',
        sections,
        'Abri o cardapio interativo para voce. Escolha uma categoria na lista.',
        'Se preferir, voce tambem pode me pedir um produto do seu jeito.',
      );
    };

    if (selection?.type === 'root') {
      return buildRootResponse(1);
    }

    if (selection?.type === 'root_page') {
      return buildRootResponse(selection.page);
    }

    if (selection?.type === 'recommendation') {
      const syntheticMessage =
        selection.mode === 'gift'
          ? 'me indica algo para presente'
          : selection.mode === 'budget'
            ? 'quero algo mais em conta'
            : selection.mode === 'chocolate'
              ? 'quero algo mais chocolatudo'
              : 'quero um mimo individual';

      return (
        (await this.trySmartConciergeResponse(syntheticMessage, tenantId, conversation)) ||
        'Nao consegui montar uma recomendacao forte agora, mas posso abrir o cardapio para voce.'
      );
    }

    if (selection?.type === 'buy') {
      const selectedProduct = products.find(
        (product) => String(product.id) === selection.productId,
      );
      if (!selectedProduct) {
        return 'Nao encontrei esse item do catalogo agora. Se quiser, envie "cardapio" e eu abro a lista de novo.';
      }

      if (currentState && currentState === 'order_confirmed') {
        return 'Seu pedido atual ainda esta em andamento. Para eu nao misturar duas compras por engano, conclua essa jornada primeiro e depois eu monto o proximo item com voce.';
      }

      return await this.processOrder(
        `quero 1 ${selectedProduct.name}`,
        tenantId,
        conversation,
      );
    }

    if (selection?.type === 'similar') {
      const selectedProduct = products.find(
        (product) => String(product.id) === selection.productId,
      );
      if (!selectedProduct) {
        return 'Nao encontrei esse item do catalogo agora. Se quiser, envie "cardapio" e eu abro a lista de novo.';
      }

      await this.rememberConversationIntelligence(conversation, {
        last_catalog_product_id: String(selectedProduct.id),
        last_catalog_category_key: this.buildCatalogCategoryKey(
          String(selectedProduct.categoria?.name || 'Categoria'),
        ),
        last_catalog_category_name:
          String(selectedProduct.categoria?.name || 'Categoria').trim() || 'Categoria',
      });

      return this.buildCatalogSimilarInteractiveResponse(selectedProduct, products);
    }

    if (selection?.type === 'category' || selection?.type === 'category_page') {
      const categoryKey = selection.type === 'category' ? selection.key : selection.key;
      const categoryPage = selection.type === 'category_page' ? selection.page : 1;
      const categoryEntry = groupedEntries.find(
        ([categoryName]) => this.buildCatalogCategoryKey(categoryName) === categoryKey,
      );
      const categoryProducts = categoryEntry?.[1] || [];
      if (!categoryProducts.length) {
        return 'Nao encontrei essa categoria do cardapio agora. Se quiser, envie "cardapio" e eu abro a lista de novo.';
      }

      const categoryName = String(categoryEntry?.[0] || 'Categoria').trim() || 'Categoria';
      return await this.buildCatalogCategoryInteractiveResponse(
        categoryName,
        categoryProducts,
        categoryPage,
        conversation,
      );
    }

    if (selection?.type === 'product') {
      const selectedProduct = products.find(
        (product) => String(product.id) === selection.productId,
      );
      if (!selectedProduct) {
        return 'Nao encontrei esse item do cardapio agora. Se quiser, envie "cardapio" e eu abro a lista de novo.';
      }

      return await this.buildCatalogProductInteractiveResponse(
        selectedProduct,
        products,
        conversation,
      );
    }

    if (!this.isDirectCatalogRequest(message)) {
      return null;
    }

    return buildRootResponse(1);
  }

  private getPremiumPhonePrompt(): string {
    return [
      'TELEFONE DE CONTATO',
      '',
      'Antes de fechar, preciso do melhor numero para atualizar voce sobre o pedido.',
      'Pode ser celular ou telefone fixo, desde que venha com DDD.',
      'Pode enviar no formato:',
      '- (11) 98765-4321',
      '- 11987654321',
    ].join('\n');
  }

  private getPremiumNotesPrompt(): string {
    return [
      'OBSERVACOES DO PEDIDO',
      '',
      'Se quiser, me diga algum detalhe importante para a equipe.',
      'Exemplo: "sem acucar", "entregar na portaria" ou "caprichar na embalagem".',
      '',
      'Se nao houver observacoes, responda: "sem".',
    ].join('\n');
  }

  private getPremiumDeliveryChoicePrompt(customerName?: string): string {
    return [
      customerName ? `Perfeito, ${customerName}.` : 'Perfeito.',
      '',
      'Como voce prefere receber esse pedido?',
      '1. Entrega',
      '2. Retirada',
      '',
      'Responda com "1", "2", "entrega" ou "retirada".',
    ].join('\n');
  }

  private getPremiumDeliveryChoiceValidationMessage(customerName?: string): string {
    return [
      customerName ? `Perfeito, ${customerName}.` : 'Perfeito.',
      '',
      'Antes de seguir, eu preciso alinhar se vai ser entrega ou retirada para nao montar endereco errado.',
      'Responda so com uma destas opcoes:',
      '1. Entrega',
      '2. Retirada',
    ].join('\n');
  }

  private getPremiumCardPaymentFallbackMessage(): string {
    return [
      'No WhatsApp, eu consigo fechar este pedido com seguranca por *PIX* ou *dinheiro*.',
      '',
      'Para cartao, a equipe precisa concluir manualmente para nao gerar erro no pagamento.',
      'Se quiser seguir agora por aqui, responda: "pix" ou "dinheiro".',
    ].join('\n');
  }

  private getPremiumAddressPrompt(): string {
    return [
      'ENDERECO DE ENTREGA',
      '',
      'Me envie o endereco completo para a entrega sair sem atrito.',
      'Inclua rua, numero, complemento, bairro, cidade, estado e CEP.',
      '',
      'Exemplo: "Rua das Flores, 123, Apto 45, Centro, Sao Paulo, SP, 01234-567".',
    ].join('\n');
  }

  private getPremiumScheduleMessage(): string {
    return [
      'HORARIO DE ATENDIMENTO',
      '',
      this.HORARIO_FUNCIONAMENTO,
      '',
      'Se quiser, eu ja posso te ajudar a montar o pedido agora.',
    ].join('\n');
  }

  private getPremiumHelpMessage(): string {
    return [
      'COMO POSSO AJUDAR',
      '',
      'Voce pode falar comigo de forma natural ou usar atalhos como:',
      '- "cardapio" para ver a vitrine da loja',
      '- "preco de brigadeiro" para consultar um item',
      '- "estoque de bolo de chocolate" para ver disponibilidade',
      '- "quero 10 brigadeiros" para montar um pedido',
      '- "status do pedido" para acompanhar a compra',
      '- "reabrir pedido" para retomar um pagamento pendente',
      '',
      'Tambem posso recomendar produtos se voce disser algo como:',
      '"me indica algo para presente" ou "o que voce tem com chocolate?"',
    ].join('\n');
  }

  private getPremiumGreetingMessage(): string {
    return [
      'Ola! Sou o concierge da loja no WhatsApp.',
      '',
      'Posso te ajudar a descobrir produtos, montar o pedido, acompanhar a compra e retomar pagamento sem perder contexto.',
      '',
      'Se quiser um atalho, envie "ajuda".',
    ].join('\n');
  }

  private getPremiumFallbackMessage(): string {
    return [
      'Nao quero te deixar preso num menu engessado.',
      '',
      'Pode falar do seu jeito que eu tento puxar para o caminho certo.',
      'Se preferir um atalho, eu tambem consigo ajudar com coisas como:',
      '- "quero 10 brigadeiros"',
      '- "me indica algo para presente"',
      '- "preco de brownie"',
      '- "status do pedido"',
      '',
      'Se tiver dado algum problema, pode dizer algo como "o pix nao apareceu" ou "acho que voce nao entendeu".',
    ].join('\n');
  }

  private buildPremiumPendingOrderIntro(
    pendingOrder: PendingOrder,
    nextStep: string,
  ): string {
    return [
      'PEDIDO PREPARADO',
      '',
      this.formatPendingOrderSummaryPremium(pendingOrder).trim(),
      '',
      nextStep,
    ].join('\n');
  }

  private buildPremiumOrderConfirmationMessage(
    pendingOrder: PendingOrder,
    customerData?: CustomerData,
  ): string {
    const lines: string[] = ['REVISAO FINAL DO PEDIDO', ''];

    lines.push('Itens');
    pendingOrder.items.forEach((item: PendingOrderItem) => {
      lines.push(`- ${item.quantity}x ${item.produto_name} | R$ ${this.formatCurrency(Number(item.unit_price || 0))}`);
    });

    lines.push('');
    lines.push('Valores');
    lines.push(`- Subtotal: R$ ${this.formatCurrency(Number(pendingOrder.subtotal || 0))}`);
    if (pendingOrder.coupon_code) {
      lines.push(`- Cupom: ${String(pendingOrder.coupon_code).toUpperCase()}`);
    }
    if (Number(pendingOrder.discount_amount || 0) > 0) {
      lines.push(`- Desconto: R$ ${this.formatCurrency(Number(pendingOrder.discount_amount || 0))}`);
    }
    if (Number(pendingOrder.shipping_amount || 0) > 0) {
      lines.push(`- Frete: R$ ${this.formatCurrency(Number(pendingOrder.shipping_amount || 0))}`);
    }
    lines.push(`- Total: R$ ${this.formatCurrency(Number(pendingOrder.total_amount || 0))}`);

    if (customerData?.name || customerData?.phone || customerData?.notes || customerData?.delivery_type) {
      lines.push('');
      lines.push('Cliente');
      if (customerData?.name) lines.push(`- Nome: ${customerData.name}`);
      if (customerData?.phone) lines.push(`- Telefone: ${customerData.phone}`);
      if (customerData?.notes?.trim()) lines.push(`- Observacoes: ${customerData.notes.trim()}`);

      if (customerData?.delivery_type === 'delivery' && customerData.address) {
        const number = customerData.address.number ? `, ${customerData.address.number}` : '';
        const complement = customerData.address.complement ? `, ${customerData.address.complement}` : '';
        lines.push(
          `- Entrega: ${customerData.address.street}${number}${complement}, ${customerData.address.neighborhood}, ${customerData.address.city} - ${customerData.address.state}`,
        );
      } else if (customerData?.delivery_type === 'pickup') {
        lines.push('- Recebimento: retirada na loja');
      }
    }

    lines.push('');
    lines.push('Se estiver tudo certo, responda: "sim" ou "confirmar".');
    lines.push('Se quiser interromper, responda: "cancelar".');

    return lines.join('\n');
  }

  private formatPendingOrderSummaryPremium(pendingOrder: PendingOrder): string {
    const lines: string[] = [];
    pendingOrder.items.forEach((item: PendingOrderItem) => {
      lines.push(`${item.produto_name}`);
      lines.push(`- Quantidade: ${item.quantity} unidade(s)`);
      lines.push(`- Preco unitario: R$ ${this.formatCurrency(Number(item.unit_price || 0))}`);
      lines.push('');
    });
    lines.push(`Total do pedido: R$ ${this.formatCurrency(Number(pendingOrder.total_amount || 0))}`);
    return lines.join('\n');
  }

  private getProductSearchTokens(query: string): string[] {
    const stopWords = new Set([
      'de',
      'do',
      'da',
      'dos',
      'das',
      'com',
      'sem',
      'pra',
      'para',
      'o',
      'a',
      'os',
      'as',
      'um',
      'uma',
      'uns',
      'umas',
      'no',
      'na',
      'nos',
      'nas',
    ]);

    return this.normalizeForSearch(query)
      .split(/\s+/)
      .filter((token) => token.length >= 2 && !stopWords.has(token));
  }

  private productTokenMatchesQueryToken(queryToken: string, productTokens: string[], normalizedName: string): boolean {
    if (!queryToken) {
      return false;
    }

    if (normalizedName.includes(queryToken)) {
      return true;
    }

    return productTokens.some((token) => {
      return (
        token === queryToken ||
        token.startsWith(queryToken) ||
        queryToken.startsWith(token) ||
        this.calculateSimilarity(queryToken, token) >= 0.75
      );
    });
  }

  private isConfidentProductMatch(productName: string, product: ProductWithStock): boolean {
    const queryTokens = this.getProductSearchTokens(productName);
    if (!queryTokens.length) {
      return false;
    }

    const normalizedQuery = this.normalizeForSearch(productName);
    const normalizedName = this.normalizeForSearch(product.name);
    if (normalizedName === normalizedQuery) {
      return true;
    }

    const productTokens = normalizedName.split(/\s+/).filter(Boolean);
    const matchedTokens = queryTokens.filter((token) =>
      this.productTokenMatchesQueryToken(token, productTokens, normalizedName),
    );

    const importantTokens = queryTokens.filter(
      (token) => token.length >= 4 && !this.GENERIC_SEARCH_TOKENS.has(token),
    );
    const matchedImportantTokens = importantTokens.filter((token) =>
      this.productTokenMatchesQueryToken(token, productTokens, normalizedName),
    );

    if (importantTokens.length > 0 && matchedImportantTokens.length < importantTokens.length) {
      return false;
    }

    if (queryTokens.length === 1) {
      return matchedTokens.length === 1;
    }

    return matchedTokens.length >= Math.max(2, queryTokens.length - 1);
  }

  private normalizePendingOrderAdjustmentMessage(message: string): string {
    let normalized = this.normalizeIntentText(message).trim();

    const missingIndex = Math.max(
      normalized.lastIndexOf('faltou '),
      normalized.lastIndexOf('faltaram '),
    );
    if (missingIndex >= 0) {
      const afterMissing = normalized
        .slice(missingIndex)
        .replace(/^(?:faltou|faltaram)\s+/, '')
        .trim();
      if (afterMissing) {
        normalized = afterMissing;
      }
    }

    return normalized
      .replace(
        /^(?:corrige(?:\s+o\s+pedido)?|corrigir(?:\s+o\s+pedido)?|ajusta(?:\s+o\s+pedido)?|ajustar(?:\s+o\s+pedido)?|acrescenta|acrescentar|adiciona|adicionar|inclui|incluir|coloca\s+mais|bota\s+mais)\s+/,
        '',
      )
      .trim();
  }

  private isPendingOrderAdjustmentIntent(
    message: string,
    conversation?: TypedConversation,
    currentState?: ConversationState,
  ): boolean {
    if (!conversation?.context?.pending_order || !currentState) {
      return false;
    }

    if (!['collecting_name', 'collecting_address', 'collecting_phone', 'collecting_notes', 'confirming_order'].includes(currentState)) {
      return false;
    }

    const normalized = this.normalizeIntentText(message);
    if (!normalized) {
      return false;
    }

    if (
      this.isCancelIntent(normalized, conversation, currentState) ||
      this.looksLikeOrderStatusQuery(normalized, conversation) ||
      this.isReopenIntent(normalized) ||
      this.isPaymentMethodSelection(normalized)
    ) {
      return false;
    }

    if (
      this.looksLikeStandalonePhoneMessage(message) ||
      this.isAddressLikelyComplete(message) ||
      this.hasAddressKeyword(message) ||
      this.hasAddressFragmentSignal(message)
    ) {
      return false;
    }

    if (currentState === 'collecting_address') {
      const deliveryType =
        (conversation.context?.customer_data as CustomerData | undefined)?.delivery_type || null;
      if (!deliveryType) {
        return false;
      }

      if (/^\d{1,8}$/.test(this.sanitizeInput(message).trim())) {
        return false;
      }
    }

    if (currentState === 'collecting_phone') {
      const digitsOnly = this.extractPhoneDigitsCandidate(message);
      if (
        /^\d{1,11}$/.test(this.sanitizeInput(message).trim()) ||
        (digitsOnly.length > 0 && digitsOnly.length <= 11) ||
        this.hasAnyNormalizedPhrase(normalized, ['telefone', 'numero', 'celular', 'fixo', 'whatsapp', 'zap'])
      ) {
        return false;
      }
    }

    if (
      this.hasAnyNormalizedPhrase(normalized, [
        'faltou',
        'faltaram',
        'nao ta certo',
        'nao esta certo',
        'ta errado',
        'esta errado',
        'corrige',
        'corrigir',
        'ajusta',
        'ajustar',
        'acrescenta',
        'acrescentar',
        'adiciona',
        'adicionar',
        'inclui',
        'incluir',
        'coloca mais',
        'bota mais',
      ])
    ) {
      return true;
    }

    const normalizedAdjustment = this.normalizePendingOrderAdjustmentMessage(normalized);
    const multiItem = this.extractMultipleOrderInfos(normalizedAdjustment);
    if (multiItem && multiItem.length > 0) {
      return true;
    }

    const orderInfo = this.extractOrderInfo(normalizedAdjustment);
    return orderInfo.quantity !== null && !!orderInfo.productName;
  }

  private buildPendingOrderAdjustmentPrompt(): string {
    return [
      'Sem problema, vamos ajustar o pedido antes de fechar.',
      '',
      'Me diga exatamente o que precisa mudar.',
      '- "faltou 2 bolo no pote trufado de maracuja"',
      '- "adiciona 1 bala de brigadeiro"',
      '- "cancelar" se quiser interromper o pedido',
    ].join('\n');
  }

  private mergePendingOrderItems(
    existingItems: PendingOrderItem[],
    newItems: PendingOrderItem[],
  ): PendingOrderItem[] {
    const merged = [...existingItems.map((item) => ({ ...item }))];

    newItems.forEach((incomingItem) => {
      const existingIndex = merged.findIndex(
        (item) => item.produto_id === incomingItem.produto_id,
      );

      if (existingIndex >= 0) {
        merged[existingIndex] = {
          ...merged[existingIndex],
          quantity: Number(merged[existingIndex].quantity || 0) + Number(incomingItem.quantity || 0),
          unit_price: incomingItem.unit_price,
        };
        return;
      }

      merged.push({ ...incomingItem });
    });

    return merged;
  }

  private async tryAdjustPendingOrder(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
    currentState?: ConversationState,
  ): Promise<string | null> {
    if (!conversation) {
      return null;
    }

    const normalizedIntent = this.normalizeIntentText(message);
    const explicitAdjustmentIntent = this.hasAnyNormalizedPhrase(normalizedIntent, [
      'faltou',
      'faltaram',
      'nao ta certo',
      'nao esta certo',
      'ta errado',
      'esta errado',
      'corrige',
      'corrigir',
      'ajusta',
      'ajustar',
      'acrescenta',
      'acrescentar',
      'adiciona',
      'adicionar',
      'inclui',
      'incluir',
      'coloca mais',
      'bota mais',
    ]);

    if (
      !explicitAdjustmentIntent &&
      !this.isPendingOrderAdjustmentIntent(message, conversation, currentState)
    ) {
      return null;
    }

    let normalizedAdjustment = this.normalizePendingOrderAdjustmentMessage(message);
    if (explicitAdjustmentIntent && normalizedAdjustment === normalizedIntent) {
      const missingTail = normalizedIntent.match(/(?:faltou|faltaram)\s+(.+)$/)?.[1]?.trim();
      if (missingTail) {
        normalizedAdjustment = missingTail;
      }
    }

    const parsedItems =
      this.extractMultipleOrderInfos(normalizedAdjustment) ||
      (() => {
        const info = this.extractOrderInfo(normalizedAdjustment);
        if (info.quantity === null || !info.productName) {
          return null;
        }

        return [{ quantity: info.quantity, productName: info.productName }];
      })();

    if (!parsedItems || parsedItems.length === 0) {
      return this.buildPendingOrderAdjustmentPrompt();
    }

    const pendingOrder = conversation.context?.pending_order;
    if (!pendingOrder) {
      return null;
    }

    const produtosResult = await this.productsService.findAll(tenantId);
    const produtos = Array.isArray(produtosResult) ? produtosResult : produtosResult.data;

    const newItems: PendingOrderItem[] = [];
    for (const part of parsedItems) {
      const quantityValidation = this.validateQuantity(part.quantity);
      if (!quantityValidation.valid) {
        return quantityValidation.error || 'Quantidade invalida.';
      }

      const resultadoBusca = this.findProductByName(produtos, part.productName);
      if (!resultadoBusca.produto) {
        if (resultadoBusca.sugestoes?.length) {
          return this.buildSuggestionMessage(
            part.productName,
            resultadoBusca.sugestoes,
            `Nao ajustei o pedido porque "${part.productName}" ainda ficou ambigua.`,
          );
        }

        return `Ainda nao consegui identificar "${part.productName}" com seguranca. Me envie o nome completo do item.`;
      }

      newItems.push({
        produto_id: resultadoBusca.produto.id,
        produto_name: resultadoBusca.produto.name,
        quantity: part.quantity,
        unit_price: Number(resultadoBusca.produto.price || 0),
      });
    }

    const mergedItems = this.mergePendingOrderItems(pendingOrder.items || [], newItems);
    const productById = new Map(produtos.map((product) => [product.id, product]));

    for (const item of mergedItems) {
      const product = productById.get(item.produto_id);
      if (!product) {
        return `Nao encontrei mais o item "${item.produto_name}" no catalogo. Vamos revisar o pedido.`;
      }

      if (Number(product.available_stock || 0) < Number(item.quantity || 0)) {
        return [
          `Nao consegui ajustar *${item.produto_name}* com seguranca.`,
          `Disponivel agora: ${product.available_stock} unidade(s)`,
          `Pedido ficaria com: ${item.quantity} unidade(s)`,
          '',
          'Se quiser, me diga outra quantidade.',
        ].join('\n');
      }
    }

    const updatedPendingOrder: PendingOrder = {
      ...pendingOrder,
      items: mergedItems,
      subtotal: mergedItems.reduce(
        (sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0),
        0,
      ),
    };
    updatedPendingOrder.total_amount =
      Number(updatedPendingOrder.subtotal || 0) -
      Number(updatedPendingOrder.discount_amount || 0) +
      Number(updatedPendingOrder.shipping_amount || 0);

    const followUp = await this.applyPendingOrderAndProceedPremium(
      updatedPendingOrder,
      tenantId,
      conversation,
    );

    return ['Pedido ajustado com seguranca.', '', followUp].join('\n');
  }

  private extractCatalogQuery(message: string): string {
    return this.normalizeForSearch(message)
      .replace(
        /\b(preco|valor|quanto|custa|estoque|tem|disponivel|menu|cardapio|catalogo|catalogue|quais|qual|quero|pedido|recomenda|recomendar|indica|indicar|sugere|sugerir|algo|opcao|opcoes|para|com|de|do|da|dos|das|me|uma|um|uns|umas|por favor|favor)\b/g,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  private formatProductHeadline(product: ProductWithStock): string {
    const category = product.categoria?.name ? ` | ${product.categoria.name}` : '';
    return `${product.name} | R$ ${this.formatCurrency(Number(product.price || 0))}${category}`;
  }

  private buildProductInsightMessage(
    product: ProductWithStock,
    mode: 'price' | 'stock' | 'recommendation' | 'insight',
  ): string {
    const available = Number(product.available_stock || 0);
    const minStock = Number(product.min_stock || 0);
    const stockLine =
      available <= 0
        ? 'Disponibilidade: indisponivel no momento'
        : available <= Math.max(1, minStock)
          ? `Disponibilidade: ${available} unidade(s), estoque sensivel`
          : `Disponibilidade: ${available} unidade(s) prontas para venda`;

    const intro =
      mode === 'recommendation'
        ? 'Achei uma opcao que combina bem com o que voce pediu.'
        : mode === 'stock'
          ? 'Aqui esta a leitura mais util deste item agora.'
          : 'Aqui esta a leitura mais clara deste item.';

    return [
      intro,
      '',
      this.formatProductHeadline(product),
      stockLine,
      '',
      `Se quiser seguir, diga: "quero X ${product.name}".`,
    ].join('\n');
  }

  private buildSuggestionMessage(
    query: string,
    suggestions: ProductWithStock[],
    intro: string,
  ): string {
    return [
      intro,
      '',
      ...suggestions.slice(0, 4).map((product) => `- ${this.formatProductHeadline(product)}`),
      '',
      query
        ? `Se quiser, me diga o nome completo do item ou envie: "quero 1 ${suggestions[0].name}".`
        : 'Se quiser, me diga o nome completo do item que chamou sua atencao.',
    ].join('\n');
  }

  private async tryHandleCollectionStageDetour(
    message: string,
    tenantId: string,
    conversation: TypedConversation | undefined,
    currentState: ConversationState,
  ): Promise<string | null> {
    if (
      !conversation ||
      !['collecting_name', 'collecting_address', 'collecting_phone'].includes(currentState)
    ) {
      return null;
    }

    const sanitizedMessage = this.sanitizeInput((message || '').trim());
    if (!sanitizedMessage) {
      return null;
    }

    const normalized = this.normalizeIntentText(sanitizedMessage);
    const analysis = this.messageIntelligenceService.analyze(sanitizedMessage);
    const orderInfo = this.extractOrderInfo(sanitizedMessage);
    const directCatalogRequest = this.isDirectCatalogRequest(sanitizedMessage);
    const directPriceQuestion = this.isDirectPriceQuestion(sanitizedMessage);
    const directStockQuestion = this.isDirectStockQuestion(sanitizedMessage);

    if (currentState === 'collecting_name') {
      const extractedName = this.extractCustomerNameCandidate(sanitizedMessage);
      if (
        this.validateName(extractedName).valid &&
        !this.looksLikeStandalonePhoneMessage(sanitizedMessage) &&
        !this.hasAddressKeyword(sanitizedMessage) &&
        !this.isAddressLikelyComplete(sanitizedMessage)
      ) {
        return null;
      }
    }

    if (currentState === 'collecting_address') {
      if (['1', '2', 'entrega', 'retirada', 'buscar'].includes(normalized)) {
        return null;
      }

      if (
        this.isAddressLikelyComplete(sanitizedMessage) ||
        this.hasAddressKeyword(sanitizedMessage) ||
        this.getAddressDraftParts(conversation).length > 0 ||
        this.isAddressDraftWorthy(this.normalizeAddressCandidate(sanitizedMessage))
      ) {
        return null;
      }
    }

    if (currentState === 'collecting_phone' && this.looksLikeStandalonePhoneMessage(sanitizedMessage)) {
      return null;
    }

    if (
      currentState === 'collecting_phone' &&
      (
        /^\d{1,11}$/.test(sanitizedMessage) ||
        this.hasAnyNormalizedPhrase(normalized, ['telefone', 'numero', 'celular', 'fixo', 'whatsapp', 'zap'])
      )
    ) {
      return null;
    }

    const likelyProductQuery =
      orderInfo.productName ||
      this.extractCatalogQuery(sanitizedMessage) ||
      analysis.productCandidate;

    const looksLikeCatalogDetour =
      directCatalogRequest ||
      directPriceQuestion ||
      directStockQuestion ||
      this.isOrderIntent(sanitizedMessage) ||
      Boolean(likelyProductQuery);

    if (!looksLikeCatalogDetour) {
      if (analysis.flags.needsClarification) {
        return this.buildCollectionStageDetourMessage(
          'Nao consegui entender essa mensagem com seguranca e nao quero te conduzir para a etapa errada.',
          currentState,
          conversation,
        );
      }

      return null;
    }

    if (directCatalogRequest && !likelyProductQuery) {
      return this.buildCollectionStageDetourMessage(
        'Eu consigo abrir o catalogo, sim, mas primeiro preciso fechar a etapa atual sem me perder.',
        currentState,
        conversation,
      );
    }

    const produtosResult = await this.productsService.findAll(tenantId);
    const produtos = Array.isArray(produtosResult) ? produtosResult : produtosResult.data;

    if (!likelyProductQuery) {
      return this.buildCollectionStageDetourMessage(
        'Entendi que voce mudou o foco da conversa agora, mas ainda preciso fechar a etapa atual com seguranca.',
        currentState,
        conversation,
      );
    }

    const searchResult = this.findProductByName(produtos, likelyProductQuery);
    if (searchResult.produto) {
      await this.rememberConversationIntelligence(conversation, {
        last_product_name: searchResult.produto.name,
        last_product_names: [searchResult.produto.name],
        last_query: likelyProductQuery,
      });

      return this.buildCollectionStageDetourMessage(
        `Entendi que voce quis falar de *${searchResult.produto.name}*.`,
        currentState,
        conversation,
        ['Eu continuo com esse item em mente para nao me perder.'],
      );
    }

    const suggestions = (searchResult.sugestoes || []).slice(0, 3);
    if (suggestions.length > 0) {
      await this.rememberConversationIntelligence(conversation, {
        last_intent: 'suggestion',
        last_product_name: null,
        last_product_names: suggestions.map((product) => product.name),
        last_query: likelyProductQuery,
      });

      return this.buildCollectionStageDetourMessage(
        `Nao fechei "${likelyProductQuery}" com seguranca ainda.`,
        currentState,
        conversation,
        [
          'Acho que voce pode estar falando de algo nesta linha:',
          ...suggestions.map((product) => `- ${product.name}`),
        ],
      );
    }

    return this.buildCollectionStageDetourMessage(
      `Entendi que voce tentou falar de um produto agora, mas "${likelyProductQuery}" ainda nao fechou com seguranca no catalogo.`,
      currentState,
      conversation,
      ['Se quiser, depois eu te ajudo a encontrar o item certo sem chutar errado.'],
    );
  }

  private buildProductSalesDocument(product: ProductWithStock): string {
    return this.catalogSalesContextService.buildProductSearchDocument(product);
  }

  private isSupportAccessoryProduct(product: ProductWithStock): boolean {
    return (
      this.productOfferIntelligenceService.analyzeProduct(product, [product]).role === 'accessory'
    );
  }

  private getSalesQueryWords(query?: string | null): string[] {
    if (!query) {
      return [];
    }

    const stopWords = new Set([
      'de',
      'do',
      'da',
      'dos',
      'das',
      'com',
      'sem',
      'para',
      'pra',
      'pro',
      'um',
      'uma',
      'uns',
      'umas',
      'o',
      'a',
      'os',
      'as',
      'algo',
      'opcao',
      'opcoes',
      'melhor',
    ]);

    return this.normalizeForSearch(query)
      .split(/\s+/)
      .filter((word) => word.length >= 2 && !stopWords.has(word));
  }

  private dedupeProducts(products: ProductWithStock[]): ProductWithStock[] {
    const seen = new Set<string>();

    return products.filter((product) => {
      if (seen.has(product.id)) {
        return false;
      }

      seen.add(product.id);
      return true;
    });
  }

  private findMentionedSalesProducts(
    products: ProductWithStock[],
    message: string,
  ): ProductWithStock[] {
    const normalizedMessage = this.normalizeForSearch(message);
    const exactIncludes = products
      .map((product) => ({
        product,
        position: normalizedMessage.indexOf(this.normalizeForSearch(product.name)),
      }))
      .filter((item) => item.position >= 0)
      .sort((left, right) => left.position - right.position)
      .map((item) => item.product);

    if (exactIncludes.length >= 2) {
      return this.dedupeProducts(exactIncludes).slice(0, 3);
    }

    const segments = normalizedMessage
      .split(/\b(?:ou|vs|versus)\b|,/g)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length >= 3);

    const resolved = segments
      .map((segment) => this.findProductByName(products, segment).produto)
      .filter((product): product is ProductWithStock => Boolean(product));

    return this.dedupeProducts([...exactIncludes, ...resolved]).slice(0, 3);
  }

  private rankProductsForSalesConversation(
    products: ProductWithStock[],
    analysis: SalesConversationAnalysis,
    playbook: SalesPlaybookProfile,
    strategy: SalesConversationStrategy,
    catalogProfile: CatalogSalesProfile,
    referenceProduct?: ProductWithStock | null,
  ): RankedSalesProduct[] {
    const saleableProducts = products.filter((product) => product.is_active !== false);
    const inStockProducts = saleableProducts.filter((product) => Number(product.available_stock || 0) > 0);
    const priceBase = (inStockProducts.length ? inStockProducts : saleableProducts).map((product) =>
      Number(product.price || 0),
    );
    const minPrice = priceBase.length ? Math.min(...priceBase) : 0;
    const maxPrice = priceBase.length ? Math.max(...priceBase) : minPrice;
    const priceSpan = Math.max(1, maxPrice - minPrice);
    const queryWords = this.getSalesQueryWords(analysis.commercialQuery);

    return saleableProducts
      .map((product) => {
        const available = Number(product.available_stock || 0);
        const price = Number(product.price || 0);
        const normalizedName = this.normalizeForSearch(product.name);
        const searchDocument = this.buildProductSalesDocument(product);
        const accessoryLike = this.isSupportAccessoryProduct(product);
        const commercialSupport = Boolean(
          product.description?.trim() ||
            (typeof product.metadata === 'object' &&
              product.metadata !== null &&
              Object.keys(product.metadata).length > 0),
        );
        const reasons: string[] = [];
        const addReason = (reason: string) => {
          if (reason && !reasons.includes(reason)) {
            reasons.push(reason);
          }
        };

        let score = available > 0 ? 20 : -30;

        if (available > 0) {
          addReason('pronto para venda agora');
        }

        const catalogFit = this.catalogSalesContextService.scoreProduct(
          product,
          analysis,
          catalogProfile,
        );
        score += catalogFit.score;
        catalogFit.reasons.forEach(addReason);

        const playbookFit = this.salesPlaybookService.describeProductFit(playbook, product, analysis);
        score += playbookFit.score;
        playbookFit.reasons.forEach(addReason);

        const strategyFit = this.salesSegmentStrategyService.scoreProductForStrategy(
          product,
          strategy,
        );
        score += strategyFit.score;
        strategyFit.reasons.forEach(addReason);

        const offerFit = this.productOfferIntelligenceService.scoreProduct(
          product,
          saleableProducts,
          analysis,
          referenceProduct,
        );
        score += offerFit.score;
        offerFit.reasons.forEach(addReason);

        queryWords.forEach((word) => {
          if (normalizedName.includes(word)) {
            score += 14;
            addReason('combina com o que voce descreveu');
          } else if (searchDocument.includes(word)) {
            score += 7;
            addReason('faz sentido para esse contexto');
          }
        });

        const explicitlyAskedForAccessory =
          accessoryLike &&
          queryWords.some((word) => normalizedName.includes(word) || searchDocument.includes(word));

        if (
          accessoryLike &&
          !explicitlyAskedForAccessory &&
          ['recommendation', 'budget', 'objection'].includes(analysis.intent)
        ) {
          score -= 36;
        }

        const priceRatio = (price - minPrice) / priceSpan;
        if (analysis.pricePreference === 'budget') {
          score += Math.round((1 - priceRatio) * 16);
          addReason('segura melhor o orcamento');
        } else if (analysis.pricePreference === 'value') {
          score += Math.round((1 - priceRatio) * 10) + Math.min(available, 8);
          addReason('equilibra custo e disponibilidade');
        } else if (analysis.pricePreference === 'premium') {
          score += Math.round(priceRatio * 12);
          addReason('tem leitura mais premium');
        }

        if (analysis.budgetCeiling !== null) {
          if (price <= analysis.budgetCeiling) {
            score += 12;
            addReason(`fica dentro do teto de R$ ${this.formatCurrency(analysis.budgetCeiling)}`);
          } else {
            score -= Math.min(18, Math.round((price - analysis.budgetCeiling) * 2));
          }
        }

        if (referenceProduct) {
          if (
            referenceProduct.categoria?.name &&
            product.categoria?.name &&
            referenceProduct.categoria.name === product.categoria.name
          ) {
            score += 6;
          }

          if (analysis.intent === 'objection' && product.id === referenceProduct.id) {
            score -= 8;
          }

          if (
            (analysis.intent === 'objection' || analysis.intent === 'budget') &&
            price < Number(referenceProduct.price || 0)
          ) {
            score += 10;
            addReason(`entra abaixo do valor de ${referenceProduct.name}`);
          }
        }

        if (analysis.conversationDrivers.includes('urgency') && available > 0) {
          score += 7 + Math.min(available, 6);
          addReason('resolve mais rapido sem depender de reposicao');
        }

        if (analysis.conversationDrivers.includes('reassurance') && commercialSupport) {
          score += 7;
          addReason('fica mais seguro de indicar sem improviso');
        }

        if (analysis.conversationDrivers.includes('simplicity')) {
          score += Math.round((1 - priceRatio) * 8);
          addReason('segue uma linha mais simples de fechar');
        }

        if (
          analysis.useCaseTags.includes('gift') &&
          analysis.recipientHint &&
          /(caixa|box|kit|presente|premium|presenteavel)/.test(searchDocument)
        ) {
          score += 8;
          addReason(`tem boa leitura para presentear ${analysis.recipientHint}`);
        }

        if (analysis.decisionStage === 'closing' && available > 0) {
          score += 6;
          addReason('ja daria para fechar sem muita friccao');
        }

        score += Math.min(available, 10);
        return { product, score, reasons };
      })
      .sort((left, right) => right.score - left.score)
      .filter((item) => item.score > 0)
      .slice(0, 4);
  }

  private formatSalesRecommendationLine(item: RankedSalesProduct): string {
    const reasons = item.reasons.slice(0, 2).join(' e ');
    return `- ${this.formatProductHeadline(item.product)}${reasons ? ` | ${reasons}` : ''}`;
  }

  private prioritizePrimarySalesProducts(
    rankedProducts: RankedSalesProduct[],
    analysis: SalesConversationAnalysis,
  ): RankedSalesProduct[] {
    const explicitAccessoryQuery =
      analysis.commercialQuery &&
      /(cartao|recadinho|sacola|embalagem|laco|fitilho|vela|topper)/.test(
        this.normalizeForSearch(analysis.commercialQuery),
      );

    if (explicitAccessoryQuery) {
      return rankedProducts;
    }

    const coreProducts = rankedProducts.filter((item) => !this.isSupportAccessoryProduct(item.product));
    if (coreProducts.length < 2) {
      return rankedProducts;
    }

    return coreProducts.slice(0, 4);
  }

  private buildSalesNeedLine(strategy: SalesConversationStrategy): string | null {
    const detectedNeeds = strategy.detectedNeeds.slice(0, 2).map((need) => need.label);
    if (!detectedNeeds.length) {
      return null;
    }

    return `Aqui eu considerei principalmente ${this.joinNaturally(detectedNeeds)}.`;
  }

  private buildProductOfferReadingLine(
    product: ProductWithStock,
    catalog: ProductWithStock[],
  ): string | null {
    const profile = this.productOfferIntelligenceService.analyzeProduct(product, catalog);

    switch (profile.role) {
      case 'gift_ready':
        return `${product.name} entra mais como presente pronto para impressionar sem muito atrito.`;
      case 'sharing':
        return `${product.name} faz mais sentido quando a compra pede volume ou algo para dividir.`;
      case 'impulse':
        return `${product.name} funciona melhor como mimo individual ou decisao rapida.`;
      case 'accessory':
        return `${product.name} eu leio mais como complemento do que como estrela da recomendacao.`;
      default:
        return profile.tier === 'premium'
          ? `${product.name} segura uma leitura mais premium dentro do catalogo.`
          : null;
    }
  }

  private buildSalesRecommendationResponse(
    analysis: SalesConversationAnalysis,
    rankedProducts: RankedSalesProduct[],
    playbook: SalesPlaybookProfile,
    strategy: SalesConversationStrategy,
    catalogProfile: CatalogSalesProfile,
    verticalPack: SalesVerticalPackProfile,
    crossSellSuggestion: SalesVerticalCrossSellSuggestion | null,
    conversationPrelude: string[] = [],
    referenceProduct?: ProductWithStock | null,
  ): string {
    const intro = this.salesPlaybookService.buildRecommendationIntro(playbook, analysis);
    const close = this.salesPlaybookService.buildRecommendationClose(
      playbook,
      analysis,
      referenceProduct,
    );
    const conversationFocus = this.catalogSalesContextService.buildConversationFocusLine(
      catalogProfile,
      analysis,
    );
    const qualificationQuestion =
      this.catalogSalesContextService.buildDynamicQualificationQuestion(
        catalogProfile,
        analysis,
      );
    const reasoningLine = this.buildHumanSalesReasoning(analysis, strategy, catalogProfile);
    const needLine = this.buildSalesNeedLine(strategy);
    const crossSellLine = crossSellSuggestion
      ? `${crossSellSuggestion.prompt} ${crossSellSuggestion.product.name}, porque ${crossSellSuggestion.reason}.`
      : '';
    const offerReadingLine = this.buildProductOfferReadingLine(
      rankedProducts[0].product,
      rankedProducts.map((item) => item.product),
    );

    return [
      ...conversationPrelude,
      conversationPrelude.length ? '' : null,
      intro,
      '',
      reasoningLine,
      needLine,
      conversationFocus,
      offerReadingLine,
      '',
      'Estas sao as opcoes que eu colocaria na sua frente agora:',
      ...rankedProducts.slice(0, 3).map((item) => this.formatSalesRecommendationLine(item)),
      crossSellLine,
      '',
      close,
      this.salesVerticalPackService.buildClosingMove(verticalPack, analysis),
      qualificationQuestion,
      this.salesVerticalPackService.buildQualificationQuestion(verticalPack, strategy),
      this.salesSegmentStrategyService.buildRecommendationRefinement(strategy),
      `Exemplo: "quero 1 ${rankedProducts[0].product.name}" ou "compara ${rankedProducts[0].product.name} com outra opcao".`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildSalesComparisonResponse(
    comparedProducts: ProductWithStock[],
    analysis: SalesConversationAnalysis,
    playbook: SalesPlaybookProfile,
    strategy: SalesConversationStrategy,
    catalogProfile: CatalogSalesProfile,
    verticalPack: SalesVerticalPackProfile,
    conversationPrelude: string[] = [],
  ): string {
    const [left, right] = comparedProducts;
    const leftPrice = Number(left.price || 0);
    const rightPrice = Number(right.price || 0);
    const cheaper = leftPrice <= rightPrice ? left : right;
    const premium = leftPrice >= rightPrice ? left : right;
    const betterValue =
      leftPrice === rightPrice
        ? Number(left.available_stock || 0) >= Number(right.available_stock || 0)
          ? left
          : right
        : cheaper;
    const recommended =
      analysis.pricePreference === 'budget'
        ? cheaper
        : analysis.pricePreference === 'premium'
          ? premium
          : betterValue;
    const labels = this.salesPlaybookService.getComparisonLabels(playbook);
    const conversationFocus = this.catalogSalesContextService.buildConversationFocusLine(
      catalogProfile,
      analysis,
    );
    const qualificationQuestion =
      this.catalogSalesContextService.buildDynamicQualificationQuestion(
        catalogProfile,
        analysis,
      );
    const reasoningLine = this.buildHumanSalesReasoning(analysis, strategy, catalogProfile);
    const needLine = this.buildSalesNeedLine(strategy);
    const recommendedOfferReading = this.buildProductOfferReadingLine(
      recommended,
      comparedProducts,
    );

    return [
      ...conversationPrelude,
      conversationPrelude.length ? '' : null,
      'Vou te comparar do jeito mais util.',
      '',
      `1. ${this.formatProductHeadline(left)} | Estoque: ${left.available_stock} unidade(s)`,
      `2. ${this.formatProductHeadline(right)} | Estoque: ${right.available_stock} unidade(s)`,
      '',
      reasoningLine,
      needLine,
      conversationFocus,
      recommendedOfferReading,
      '',
      `Se a prioridade for economizar: ${cheaper.name}.`,
      `Se a prioridade for algo mais forte ou mais marcante: ${premium.name}.`,
      `Se a prioridade for equilibrio: ${betterValue.name}.`,
      '',
      `${labels.recommendationLead} ${recommended.name}.`,
      this.salesVerticalPackService.buildClosingMove(verticalPack, analysis),
      qualificationQuestion,
      `Se quiser seguir, envie: "quero 1 ${recommended.name}".`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildSalesBudgetMissResponse(
    analysis: SalesConversationAnalysis,
    playbook: SalesPlaybookProfile,
    strategy: SalesConversationStrategy,
    catalogProfile: CatalogSalesProfile,
    verticalPack: SalesVerticalPackProfile,
    closestProducts: RankedSalesProduct[],
    conversationPrelude: string[] = [],
  ): string {
    const conversationFocus = this.catalogSalesContextService.buildConversationFocusLine(
      catalogProfile,
      analysis,
    );
    const qualificationQuestion =
      this.catalogSalesContextService.buildDynamicQualificationQuestion(
        catalogProfile,
        analysis,
      );
    const reasoningLine = this.buildHumanSalesReasoning(analysis, strategy, catalogProfile);
    const needLine = this.buildSalesNeedLine(strategy);

    return [
      ...conversationPrelude,
      conversationPrelude.length ? '' : null,
      `Com esse teto de ate R$ ${this.formatCurrency(analysis.budgetCeiling || 0)}, eu nao encontrei algo realmente forte disponivel agora.`,
      reasoningLine,
      needLine,
      conversationFocus,
      '',
      'As opcoes mais proximas que eu analisaria agora seriam:',
      ...closestProducts.slice(0, 2).map((item) => this.formatSalesRecommendationLine(item)),
      '',
      this.salesPlaybookService.buildBudgetMissClose(playbook),
      this.salesVerticalPackService.buildClosingMove(verticalPack, analysis),
      qualificationQuestion,
      this.salesVerticalPackService.buildQualificationQuestion(verticalPack, strategy),
      this.salesSegmentStrategyService.buildRecommendationRefinement(strategy),
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildSalesConversationPrelude(
    conversationalAnalysis: ConversationalAnalysis,
    plan: ConversationPlan,
    salesAnalysis?: SalesConversationAnalysis,
  ): string[] {
    const lines: string[] = [];

    if (plan.mode === 'sales_consultative' || plan.mode === 'decision_coaching') {
      lines.push(plan.lead);
      lines.push(`Entendi que agora voce quer ${plan.customerGoal}.`);
      if (salesAnalysis?.customerGoalSummary) {
        lines.push(`Pelo que voce me disse, a busca aqui e ${salesAnalysis.customerGoalSummary}.`);
      }

      if (plan.mode === 'decision_coaching') {
        lines.push(
          'Eu vou te ajudar a decidir com criterio, sem te empurrar item e sem te deixar rodando em duvida.',
        );
      }

      switch (conversationalAnalysis.posture) {
        case 'urgent':
          lines.push(
            'Por isso, eu vou priorizar as opcoes mais certeiras sem te fazer rodar o catalogo inteiro.',
          );
          break;
        case 'reassurance':
          lines.push(
            'Eu vou te mostrar isso com criterio para voce nao decidir no escuro.',
          );
          break;
        case 'frustrated':
          lines.push(
            'Eu vou simplificar a leitura para voce bater o olho e entender o que realmente faz sentido.',
          );
          break;
        case 'hesitant':
          lines.push(
            'Eu vou manter poucas opcoes boas na mesa para ficar mais facil decidir sem pressao.',
          );
          break;
        case 'confused':
          lines.push(
            'Eu vou organizar isso do jeito mais claro possivel antes de sugerir qualquer item.',
          );
          break;
        default:
          break;
      }

      return lines;
    }

    switch (conversationalAnalysis.posture) {
      case 'urgent':
        return [
          'Entendi a pressa, entao eu vou direto nas opcoes com mais chance de encaixar bem agora.',
        ];
      case 'reassurance':
        return ['Vou te recomendar com criterio para voce nao escolher no escuro.'];
      case 'frustrated':
        return [
          'Entendi que isso precisa ficar mais claro, entao eu vou simplificar e te passar so o que faz sentido.',
        ];
      case 'hesitant':
        return ['Sem pressa, eu separo poucas opcoes boas para facilitar sua decisao.'];
      case 'confused':
        return ['Vou organizar isso de um jeito simples para voce entender rapido.'];
      default:
        return [];
    }
  }

  private pickRecommendationProducts(
    products: ProductWithStock[],
    query: string,
  ): ProductWithStock[] {
    const normalizedQuery = this.normalizeForSearch(query);
    const queryWords = normalizedQuery.split(/\s+/).filter((word) => word.length >= 2);

    const scored = products
      .map((product) => {
        const normalizedName = this.normalizeForSearch(product.name);
        const normalizedCategory = this.normalizeForSearch(product.categoria?.name || '');
        const available = Number(product.available_stock || 0);

        let score = available > 0 ? 20 : -20;
        queryWords.forEach((word) => {
          if (normalizedName.includes(word)) score += 14;
          if (normalizedCategory.includes(word)) score += 8;
        });

        if (normalizedQuery.includes('presente') || normalizedQuery.includes('gift')) {
          if (/(kit|caixa|combo|box)/.test(normalizedName)) score += 18;
        }

        if (normalizedQuery.includes('festa') || normalizedQuery.includes('anivers')) {
          if (/(bolo|torta|kit|combo)/.test(normalizedName)) score += 16;
        }

        if (normalizedQuery.includes('chocolate') && normalizedName.includes('chocolate')) {
          score += 18;
        }

        score += Math.min(available, 20);
        return { product, score };
      })
      .sort((left, right) => right.score - left.score);

    return scored
      .filter((item) => item.score > 0)
      .slice(0, 3)
      .map((item) => item.product);
  }

  private getIdleTrustBridge(analysis: ConversationalAnalysis): string {
    switch (analysis.topic) {
      case 'payment':
        return 'Se a sua duvida e sobre pagar com seguranca, eu te explico o passo certo antes de qualquer cobranca.';
      case 'delivery':
        return 'Se a sua preocupacao e entrega, eu te explico exatamente o que eu preciso para nao gerar erro de rota.';
      case 'order':
        return 'Se a sua preocupacao e o pedido, eu te resumo o contexto certo antes de te puxar para qualquer confirmacao.';
      case 'catalog':
        return 'Se a sua duvida e escolha de produto, eu consigo te orientar sem te empurrar nada no escuro.';
      default:
        return 'Eu nao vou te empurrar nada nem te deixar no escuro; posso te explicar primeiro e so depois seguir.';
    }
  }

  private getCollectionTrustLine(
    currentState: ConversationState,
    customerData?: CustomerData,
  ): string {
    switch (currentState) {
      case 'collecting_name':
        return 'Eu so preciso do nome para identificar corretamente quem vai receber, nao para travar voce num script.';
      case 'collecting_address':
        return customerData?.delivery_type
          ? 'Eu so vou usar esse endereco para a entrega sair certa, sem erro de rota nem bairro.'
          : 'Eu preciso alinhar primeiro se vai ser entrega ou retirada para nao te fazer repetir informacao depois.';
      case 'collecting_phone':
        return 'Eu so uso esse telefone para atualizar voce sobre pedido, entrega ou pagamento. Nao e para te jogar mensagem aleatoria.';
      case 'collecting_notes':
        return 'Essa observacao e opcional; ela so serve para eu alinhar um detalhe fino com a equipe antes de fechar.';
      case 'collecting_cash_change':
        return 'Esse dado so serve para o entregador ja sair com o troco certo e evitar transtorno na porta.';
      case 'confirming_order':
        return 'Eu prefiro revisar isso com voce agora para o pedido entrar certo de primeira, sem surpresa depois.';
      default:
        return 'Eu vou te conduzir com criterio para voce entender o que falta antes de seguir.';
    }
  }

  private getPostFlowTrustLine(
    currentState: ConversationState,
    analysis: ConversationalAnalysis,
  ): string {
    if (currentState === 'waiting_payment') {
      return analysis.topic === 'payment'
        ? 'Eu nao vou gerar outra cobranca nem mexer errado no pedido; primeiro eu te explico o ponto do pagamento.'
        : 'Eu nao vou mexer errado no pedido; primeiro eu te explico o que esta acontecendo e depois te puxo para o proximo passo.';
    }

    return 'Eu nao vou mexer errado em item, status ou entrega; primeiro eu te explico o contexto certo dessa compra.';
  }

  private async getPremiumCardapio(tenantId: string): Promise<string> {
    try {
      const products = await this.getCatalogProducts(tenantId);
      if (!products.length) {
        return 'CATALOGO DA LOJA\n\nAinda nao ha produtos publicados para este tenant.';
      }

      const grouped = new Map<string, ProductWithStock[]>();
      products.forEach((product) => {
        const category = product.categoria?.name || 'Destaques';
        const current = grouped.get(category) || [];
        current.push(product);
        grouped.set(category, current);
      });

      const lines: string[] = [
        'CATALOGO DA LOJA',
        '',
        `Temos ${products.length} produto(s) publicado(s) e ${products.filter((product) => Number(product.available_stock || 0) > 0).length} com estoque ativo agora.`,
        '',
      ];

      Array.from(grouped.entries())
        .slice(0, 4)
        .forEach(([category, items]) => {
          lines.push(category.toUpperCase());
          items.slice(0, 4).forEach((item) => {
            lines.push(`- ${item.name} | R$ ${this.formatCurrency(Number(item.price || 0))}`);
          });
          lines.push('');
        });

      lines.push('Se quiser, eu transformo qualquer item em pedido por aqui.');
      lines.push('Exemplo: "quero 10 brigadeiros".');

      return lines.join('\n');
    } catch (error) {
      this.logger.error('Error getting premium WhatsApp catalog', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { tenantId },
      });
      return 'Nao consegui abrir o catalogo agora. Tente novamente em instantes.';
    }
  }

  private async getPremiumPriceResponse(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    try {
      const products = await this.getCatalogProducts(tenantId);
      const query = this.extractCatalogQuery(message);

      if (query) {
        const result = this.findProductByName(products, query);
        if (result.produto) {
          await this.rememberConversationIntelligence(conversation, {
            last_intent: 'price',
            last_product_name: result.produto.name,
            last_product_names: [result.produto.name],
            last_quantity: null,
            last_query: query,
          });
          return this.buildProductInsightMessage(result.produto, 'price');
        }

        if (result.sugestoes?.length) {
          await this.rememberConversationIntelligence(conversation, {
            last_intent: 'price',
            last_product_name: null,
            last_product_names: result.sugestoes.map((product) => product.name),
            last_quantity: null,
            last_query: query,
          });
          return this.buildSuggestionMessage(
            query,
            result.sugestoes,
            `Nao encontrei um item exatamente como "${query}", mas achei estas opcoes proximas:`,
          );
        }
      }

      if (!products.length) {
        return 'Ainda nao ha produtos publicados para consultar preco.';
      }

      return [
        'REFERENCIA RAPIDA DE PRECOS',
        '',
        ...products
          .slice(0, 5)
          .map((product) => `- ${product.name}: R$ ${this.formatCurrency(Number(product.price || 0))}`),
        '',
        'Se quiser um item especifico, envie: "preco de brigadeiro".',
      ].join('\n');
    } catch (error) {
      this.logger.error('Error getting premium price response', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { tenantId, query: message?.substring(0, 80) },
      });
      return 'Nao consegui consultar o preco agora. Tente novamente em instantes.';
    }
  }

  private async getPremiumStockResponse(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    try {
      const products = await this.getCatalogProducts(tenantId);
      const query = this.extractCatalogQuery(message);

      if (query) {
        const result = this.findProductByName(products, query);
        if (result.produto) {
          await this.rememberConversationIntelligence(conversation, {
            last_intent: 'stock',
            last_product_name: result.produto.name,
            last_product_names: [result.produto.name],
            last_quantity: null,
            last_query: query,
          });
          return this.buildProductInsightMessage(result.produto, 'stock');
        }

        if (result.sugestoes?.length) {
          await this.rememberConversationIntelligence(conversation, {
            last_intent: 'stock',
            last_product_name: null,
            last_product_names: result.sugestoes.map((product) => product.name),
            last_quantity: null,
            last_query: query,
          });
          return this.buildSuggestionMessage(
            query,
            result.sugestoes,
            `Nao achei o item "${query}" do jeito que voce escreveu, mas estas opcoes parecem proximas:`,
          );
        }
      }

      const lowStock = products.filter((product) => {
        const available = Number(product.available_stock || 0);
        const minStock = Number(product.min_stock || 5);
        return available > 0 && available <= minStock;
      });

      if (lowStock.length) {
        return [
          'ESTOQUE SENSIVEL',
          '',
          ...lowStock.slice(0, 5).map((product) => `- ${product.name}: ${product.available_stock} unidade(s)`),
          '',
          'Se quiser checar um item especifico, envie: "estoque de brownie".',
        ].join('\n');
      }

      return 'Me diga o nome do item para eu verificar a disponibilidade. Exemplo: "estoque de brigadeiro".';
    } catch (error) {
      this.logger.error('Error getting premium stock response', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { tenantId, query: message?.substring(0, 80) },
      });
      return 'Nao consegui verificar o estoque agora. Tente novamente em instantes.';
    }
  }

  private async tryAIAssistedRouting(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
    currentState?: ConversationState,
  ): Promise<string | null> {
    if (currentState && !['idle', 'waiting_payment'].includes(currentState)) {
      return null;
    }

    const localAnalysis = this.messageIntelligenceService.analyze(message);
    if (localAnalysis.flags.needsClarification || localAnalysis.flags.lowSignal) {
      return null;
    }

    const intent = await this.openAIService.processMessage(message);

    if (intent.intent === 'cancelar' && conversation) {
      return await this.handleCancelIntent(tenantId, conversation, currentState);
    }

    if (intent.intent === 'fazer_pedido' && intent.product) {
      const quantity = intent.quantity || 1;
      return await this.processOrder(`quero ${quantity} ${intent.product}`, tenantId, conversation);
    }

    if (intent.intent === 'consultar' && intent.product) {
      return await this.getPremiumPriceResponse(`preco de ${intent.product}`, tenantId, conversation);
    }

    return null;
  }

  private async trySmartConciergeResponse(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string | null> {
    const analysis = this.salesIntelligenceService.analyze(message);
    if (analysis.intent === 'other') {
      return null;
    }

    const conversationalAnalysis = this.conversationalIntelligenceService.analyze(message);
    const currentState = conversation?.context?.state as ConversationState | undefined;
    const conversationPlan = this.conversationPlannerService.buildPlan({
      message,
      conversationalAnalysis,
      salesAnalysis: analysis,
      currentState,
      memory: this.getConversationIntelligenceMemory(conversation),
    });
    const conversationPrelude = this.buildSalesConversationPrelude(
      conversationalAnalysis,
      conversationPlan,
      analysis,
    );

    const products = await this.getCatalogProducts(tenantId);
    if (!products.length) {
      return 'Ainda nao ha produtos publicados para eu recomendar agora.';
    }
    const playbook = this.salesPlaybookService.inferPlaybook(products);
    const strategy = this.salesSegmentStrategyService.buildStrategy(playbook, analysis);
    const catalogProfile = this.catalogSalesContextService.buildProfile(products, playbook);
    const verticalPack = this.salesVerticalPackService.buildPack(playbook, products);

    const referencedProducts = this.findMentionedSalesProducts(products, message);

    if (analysis.intent === 'comparison') {
      const comparisonProducts =
        referencedProducts.length >= 2
          ? referencedProducts.slice(0, 2)
          : this.rankProductsForSalesConversation(
              products,
              analysis,
              playbook,
              strategy,
              catalogProfile,
            )
              .slice(0, 2)
              .map((item) => item.product);

      if (comparisonProducts.length >= 2) {
        await this.rememberConversationIntelligence(conversation, {
          last_intent: 'comparison',
          last_product_name: null,
          last_product_names: comparisonProducts.map((product) => product.name),
          last_quantity: null,
          last_query: analysis.commercialQuery || null,
          last_response_mode: conversationPlan.mode === 'none' ? null : conversationPlan.mode,
          last_customer_goal: conversationPlan.customerGoal || null,
        });

        return this.buildSalesComparisonResponse(
          comparisonProducts,
          analysis,
          playbook,
          strategy,
          catalogProfile,
          verticalPack,
          conversationPrelude,
        );
      }
    }

    const referenceProduct = referencedProducts[0] || null;
    const rankedProducts = this.prioritizePrimarySalesProducts(
      this.rankProductsForSalesConversation(
      products,
      analysis,
      playbook,
      strategy,
      catalogProfile,
      referenceProduct,
      ),
      analysis,
    );

    const budgetCeiling = analysis.budgetCeiling;
    if (
      analysis.intent === 'budget' &&
      budgetCeiling !== null &&
      !rankedProducts.some((item) => Number(item.product.price || 0) <= budgetCeiling)
    ) {
      if (!rankedProducts.length) {
        return 'Nao encontrei uma opcao segura dentro desse orcamento agora. Se quiser, me diga outra faixa de valor e eu recalculo com voce.';
      }

      return this.buildSalesBudgetMissResponse(
        analysis,
        playbook,
        strategy,
        catalogProfile,
        verticalPack,
        rankedProducts,
        conversationPrelude,
      );
    }

    if (!rankedProducts.length) {
      return 'Nao encontrei uma recomendacao forte com esse contexto, mas posso te mostrar o catalogo se voce enviar "cardapio".';
    }

    await this.rememberConversationIntelligence(conversation, {
      last_intent:
        analysis.intent === 'budget'
          ? 'budget'
          : analysis.intent === 'objection'
            ? 'objection'
            : 'recommendation',
      last_product_name: rankedProducts.length === 1 ? rankedProducts[0].product.name : null,
      last_product_names: rankedProducts.map((item) => item.product.name),
      last_quantity: null,
      last_query: analysis.commercialQuery || null,
      last_response_mode: conversationPlan.mode === 'none' ? null : conversationPlan.mode,
      last_customer_goal: conversationPlan.customerGoal || null,
    });

    const crossSellSuggestion = this.salesVerticalPackService.findCrossSellSuggestion(
      verticalPack,
      products,
      rankedProducts.map((item) => item.product),
    );

    return this.buildSalesRecommendationResponse(
      analysis,
      rankedProducts,
      playbook,
      strategy,
      catalogProfile,
      verticalPack,
      crossSellSuggestion,
      conversationPrelude,
      referenceProduct,
    );
  }

  private async applyPendingOrderAndProceedPremium(
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
    await this.rememberPendingOrderIntelligence(conversation, pendingOrder);

    const customerData = conversation?.context?.customer_data as CustomerData | undefined;

    if (customerData?.name) {
      if (!customerData.address && !customerData.delivery_type) {
        await this.conversationService.updateState(conversation.id, 'collecting_address');
        return this.buildPremiumPendingOrderIntro(
          pendingOrder,
          this.getPremiumDeliveryChoicePrompt(customerData.name),
        );
      }

      if (customerData.delivery_type === 'delivery' && !customerData.address) {
        await this.conversationService.updateState(conversation.id, 'collecting_address');
        return this.getPremiumAddressPrompt();
      }

      if (!customerData.phone) {
        await this.conversationService.updateState(conversation.id, 'collecting_phone');
        return this.getPremiumPhonePrompt();
      }

      if (customerData.notes === undefined) {
        await this.conversationService.updateState(conversation.id, 'collecting_notes');
        return this.getPremiumNotesPrompt();
      }

      await this.conversationService.updateState(conversation.id, 'confirming_order');
      return await this.showOrderConfirmationPremium(tenantId, conversation);
    }

    await this.conversationService.updateState(conversation.id, 'collecting_name');
    return this.buildPremiumPendingOrderIntro(
      pendingOrder,
      'Antes de fechar, me diga o nome completo de quem vai receber o pedido.',
    );
  }

  private async processCustomerNamePremium(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    if (!conversation) {
      return 'Nao consegui continuar a coleta agora. Tente novamente.';
    }

    const stateValidation = this.validateConversationState(conversation);
    if (!stateValidation.valid) {
      return `Nao consegui seguir: ${stateValidation.error}`;
    }

    const adjustmentDuringNameCollection = await this.tryAdjustPendingOrder(
      message,
      tenantId,
      conversation,
      'collecting_name',
    );
    if (adjustmentDuringNameCollection) {
      return adjustmentDuringNameCollection;
    }

    const semanticDetour = await this.tryHandleCollectionStageDetour(
      message,
      tenantId,
      conversation,
      'collecting_name',
    );
    if (semanticDetour) {
      return semanticDetour;
    }

    const sanitizedMessage = this.sanitizeInput(message.trim());
    if (this.looksLikeStandalonePhoneMessage(sanitizedMessage)) {
      return 'Recebi um telefone, mas antes preciso do nome completo de quem vai receber o pedido.';
    }

    if (
      this.isAddressLikelyComplete(sanitizedMessage) ||
      this.hasAddressKeyword(sanitizedMessage)
    ) {
      return 'Recebi um endereco, mas antes preciso do nome completo de quem vai receber o pedido.';
    }

    const normalizedIntent = this.normalizeIntentText(sanitizedMessage);
    if (
      ['1', '2', 'entrega', 'retirada', 'buscar'].includes(normalizedIntent) ||
      this.isPaymentMethodSelection(normalizedIntent)
    ) {
      return 'Antes de escolher entrega ou pagamento, preciso do nome completo de quem vai receber o pedido.';
    }

    const sanitizedName = this.extractCustomerNameCandidate(sanitizedMessage);
    const nameValidation = this.validateName(sanitizedName);
    if (!nameValidation.valid) {
      return `Nome invalido: ${nameValidation.error}`;
    }

    await this.conversationService.saveCustomerData(conversation.id, { name: sanitizedName });

    const pendingOrder = conversation.context?.pending_order;
    if (pendingOrder) {
      const orderValidation = this.validatePendingOrder(pendingOrder);
      if (!orderValidation.valid) {
        this.logger.error(`Invalid pending order: ${orderValidation.error}`, {
          conversationId: conversation.id,
          customerPhone: conversation.customer_phone,
        });
        await this.conversationService.clearPendingOrder(conversation.id);
        await this.conversationService.updateState(conversation.id, 'idle');
        return 'Encontrei um problema no pedido pendente. Vamos recomecar para ficar seguro.';
      }

      await this.conversationService.updateState(conversation.id, 'collecting_address');
      return this.getPremiumDeliveryChoicePrompt(sanitizedName);
    }

    await this.conversationService.updateState(conversation.id, 'idle');
    return `Nome salvo com sucesso, ${sanitizedName}.\n\nComo posso te ajudar agora?`;
  }

  private async processCustomerAddressPremium(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    if (!conversation) {
      return 'Nao consegui continuar a coleta agora. Tente novamente.';
    }

    const stateValidation = this.validateConversationState(conversation);
    if (!stateValidation.valid) {
      return `Nao consegui seguir: ${stateValidation.error}`;
    }

    const sanitizedMessage = this.sanitizeInput(message.trim());
    const lowerMessage = this.normalizeIntentText(sanitizedMessage);
    const customerData = conversation.context?.customer_data as CustomerData | undefined;
    const choosingDeliveryType = !customerData?.delivery_type;

    if (choosingDeliveryType) {
      const looksLikeDirectAddress =
        this.isAddressLikelyComplete(sanitizedMessage) ||
        this.hasAddressKeyword(sanitizedMessage) ||
        this.isAddressDraftWorthy(this.normalizeAddressCandidate(sanitizedMessage));

      if (
        lowerMessage !== '1' &&
        lowerMessage !== '2' &&
        !lowerMessage.includes('entrega') &&
        !lowerMessage.includes('retirada') &&
        !lowerMessage.includes('buscar') &&
        !looksLikeDirectAddress
      ) {
        return this.getPremiumDeliveryChoiceValidationMessage(customerData?.name);
      }
    }

    if (lowerMessage === '1' || lowerMessage.includes('entrega')) {
      await this.conversationService.saveCustomerData(conversation.id, { delivery_type: 'delivery' });
      await this.conversationService.updateContext(conversation.id, { address_draft_parts: null });
      const pendingOrder = conversation.context?.pending_order;
      if (pendingOrder) {
        pendingOrder.shipping_amount = this.getDefaultShippingAmount();
        pendingOrder.total_amount =
          Number(pendingOrder.subtotal || 0) -
          Number(pendingOrder.discount_amount || 0) +
          Number(pendingOrder.shipping_amount || 0);
        await this.conversationService.savePendingOrder(conversation.id, pendingOrder);
      }
      await this.conversationService.updateState(conversation.id, 'collecting_address');
      return this.getPremiumAddressPrompt();
    }

    if (lowerMessage === '2' || lowerMessage.includes('retirada') || lowerMessage.includes('buscar')) {
      await this.conversationService.saveCustomerData(conversation.id, { delivery_type: 'pickup' });
      await this.conversationService.updateContext(conversation.id, { address_draft_parts: null });
      const pendingOrder = conversation.context?.pending_order;
      if (pendingOrder) {
        pendingOrder.shipping_amount = 0;
        pendingOrder.total_amount =
          Number(pendingOrder.subtotal || 0) -
          Number(pendingOrder.discount_amount || 0) +
          Number(pendingOrder.shipping_amount || 0);
        await this.conversationService.savePendingOrder(conversation.id, pendingOrder);
      }
      if (!conversation.context?.customer_data?.phone) {
        await this.conversationService.updateState(conversation.id, 'collecting_phone');
        return this.getPremiumPhonePrompt();
      }
      await this.conversationService.updateState(conversation.id, 'collecting_notes');
      return this.getPremiumNotesPrompt();
    }

    const semanticDetour = await this.tryHandleCollectionStageDetour(
      message,
      tenantId,
      conversation,
      'collecting_address',
    );
    if (semanticDetour) {
      return semanticDetour;
    }

    if (this.looksLikeStandalonePhoneMessage(sanitizedMessage)) {
      return 'Recebi um telefone, mas nesta etapa preciso primeiro do endereco de entrega.';
    }

    const nameCandidate = this.extractCustomerNameCandidate(sanitizedMessage);
    if (
      this.getAddressDraftParts(conversation).length === 0 &&
      !/\d/.test(sanitizedMessage) &&
      !this.hasAddressKeyword(sanitizedMessage) &&
      this.validateName(nameCandidate).valid
    ) {
      return 'Agora preciso do endereco de entrega. Me envie rua, numero, bairro, cidade e estado.';
    }

    let addressCandidate = this.normalizeAddressCandidate(sanitizedMessage);
    let draftParts = this.getAddressDraftParts(conversation);
    const shouldUseDraft =
      draftParts.length > 0 || this.isAddressDraftWorthy(addressCandidate);

    if (shouldUseDraft) {
      draftParts = this.mergeAddressDraftParts(draftParts, addressCandidate);
      const draftText = this.buildAddressDraftText(draftParts);
      if (!this.isAddressLikelyComplete(draftText)) {
        await this.conversationService.updateContext(conversation.id, {
          address_draft_parts: draftParts,
        });
        return this.buildPremiumAddressDraftPrompt(draftText || addressCandidate);
      }

      addressCandidate = draftText;
    }

    const addressValidation = this.validateAddress(addressCandidate);
    if (!addressValidation.valid) {
      return `Endereco invalido: ${addressValidation.error}`;
    }

    const addressParts = this.parseAddressCandidate(addressCandidate);

    if (!addressParts) {
      if (!this.isAddressLikelyComplete(addressCandidate)) {
        await this.conversationService.updateContext(conversation.id, {
          address_draft_parts: this.mergeAddressDraftParts(draftParts, addressCandidate),
        });
        return this.buildPremiumAddressDraftPrompt(
          this.buildAddressDraftText(this.mergeAddressDraftParts(draftParts, addressCandidate)) ||
            addressCandidate,
        );
      }

      await this.conversationService.saveCustomerData(conversation.id, {
        delivery_type: 'delivery',
        address: {
          street: addressCandidate,
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
          Number(pendingOrder.subtotal || 0) -
          Number(pendingOrder.discount_amount || 0) +
          Number(pendingOrder.shipping_amount || 0);
        await this.conversationService.savePendingOrder(conversation.id, pendingOrder);
      }

      await this.conversationService.updateContext(conversation.id, { address_draft_parts: null });
      await this.conversationService.updateState(conversation.id, 'confirming_order');
      return await this.showOrderConfirmationPremium(tenantId, conversation);
    }

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
        Number(pendingOrder.subtotal || 0) -
        Number(pendingOrder.discount_amount || 0) +
        Number(pendingOrder.shipping_amount || 0);
      await this.conversationService.savePendingOrder(conversation.id, pendingOrder);
    }

    await this.conversationService.updateContext(conversation.id, { address_draft_parts: null });
    if (!conversation.context?.customer_data?.phone) {
      await this.conversationService.updateState(conversation.id, 'collecting_phone');
      return this.getPremiumPhonePrompt();
    }

    await this.conversationService.updateState(conversation.id, 'collecting_notes');
    return this.getPremiumNotesPrompt();
  }

  private async processCustomerNotesPremium(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    if (!conversation) {
      return 'Nao consegui continuar a coleta agora. Tente novamente.';
    }

    const stateValidation = this.validateConversationState(conversation);
    if (!stateValidation.valid) {
      return `Nao consegui seguir: ${stateValidation.error}`;
    }

    const sanitizedMessage = this.sanitizeInput(message.trim());
    const lowerMessage = sanitizedMessage.toLowerCase().trim();
    const wantsPaymentShortcut = this.isPaymentMethodSelection(sanitizedMessage);

    const noNotes =
      !lowerMessage ||
      lowerMessage === 'sem' ||
      lowerMessage === 'nao' ||
      lowerMessage === 'não' ||
      lowerMessage === 'nenhuma' ||
      lowerMessage === 'nenhum' ||
      lowerMessage === 'sim' ||
      lowerMessage === 'ok' ||
      wantsPaymentShortcut;

    if (!noNotes && sanitizedMessage.length > this.MAX_NOTES_LENGTH) {
      return `As observacoes devem ter no maximo ${this.MAX_NOTES_LENGTH} caracteres.`;
    }

    await this.conversationService.saveCustomerData(conversation.id, {
      notes: noNotes ? '' : sanitizedMessage,
    });

    await this.conversationService.updateState(conversation.id, 'confirming_order');

    if (wantsPaymentShortcut) {
      const fastTrackConversation = {
        ...conversation,
        context: {
          ...(conversation.context || {}),
          state: 'confirming_order',
          customer_data: {
            ...((conversation.context?.customer_data as CustomerData | undefined) || {}),
            notes: '',
          },
        },
      } as TypedConversation;

      return await this.processOrderConfirmationPremium(sanitizedMessage, tenantId, fastTrackConversation);
    }

    return await this.showOrderConfirmationPremium(tenantId, conversation);
  }

  private async showOrderConfirmationPremium(
    _tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    if (!conversation) {
      return 'Nao consegui montar a revisao final agora. Tente novamente.';
    }

    const refreshed = await this.conversationService.findById(conversation.id);
    const activeConversation = refreshed ? toTypedConversation(refreshed) : conversation;
    const pendingOrder = activeConversation.context?.pending_order;
    const customerData = activeConversation.context?.customer_data as CustomerData | undefined;

    if (!pendingOrder) {
      return 'Nao encontrei um pedido pendente para revisar. Vamos montar um novo?';
    }

    if (customerData?.delivery_type === 'pickup' && !customerData.phone) {
      await this.conversationService.updateState(conversation.id, 'collecting_phone');
      return this.getPremiumPhonePrompt();
    }

    return this.buildPremiumOrderConfirmationMessage(pendingOrder, customerData);
  }

  private async processOrderConfirmationPremium(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
  ): Promise<string> {
    if (!conversation) {
      return 'Nao consegui continuar a confirmacao agora. Tente novamente.';
    }

    const stateValidation = this.validateConversationState(conversation);
    if (!stateValidation.valid) {
      return `Nao consegui seguir: ${stateValidation.error}`;
    }

    const sanitizedMessage = this.sanitizeInput(message.trim());
    const lowerMessage = sanitizedMessage.toLowerCase().trim();
    const wantsImmediatePayment = this.isPaymentMethodSelection(sanitizedMessage);

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

    const adjustmentDuringConfirmation = await this.tryAdjustPendingOrder(
      message,
      tenantId,
      conversation,
      'confirming_order',
    );
    if (adjustmentDuringConfirmation) {
      return adjustmentDuringConfirmation;
    }

    if (
      this.hasAnyNormalizedPhrase(lowerMessage, [
        'nao ta certo',
        'nao esta certo',
        'ta errado',
        'esta errado',
        'precisa corrigir',
        'precisa ajustar',
      ])
    ) {
      return this.buildPendingOrderAdjustmentPrompt();
    }

    if (
      this.isCancelIntent(lowerMessage, conversation, 'confirming_order') ||
      (lowerMessage.includes('nao') && !lowerMessage.includes('sim')) ||
      lowerMessage.includes('não')
    ) {
      await this.conversationService.clearPendingOrder(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      return 'Pedido cancelado.\n\nSe quiser recomecar, eu monto um novo com voce por aqui.';
    }

    if (
      !wantsImmediatePayment &&
      !lowerMessage.includes('sim') &&
      !lowerMessage.includes('confirmar') &&
      !lowerMessage.includes('ok')
    ) {
      return 'Para seguir, responda "sim" ou "confirmar". Se quiser interromper, responda "cancelar".';
    }

    const pendingOrder = conversation.context?.pending_order;
    const customerData = conversation.context?.customer_data as CustomerData | undefined;

    if (!pendingOrder) {
      return 'Nao encontrei o pedido pendente. Vamos recomecar com seguranca.';
    }

    const orderValidation = this.validatePendingOrder(pendingOrder);
    if (!orderValidation.valid) {
      this.logger.error(`Invalid pending order: ${orderValidation.error}`, {
        conversationId: conversation.id,
        customerPhone: conversation.customer_phone,
      });
      await this.conversationService.clearPendingOrder(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      return 'Encontrei um problema no pedido pendente. Vamos montar um novo para garantir consistencia.';
    }

    if (!customerData?.name) {
      return 'Preciso do nome do cliente antes de fechar. Vamos continuar a coleta.';
    }

    if (!customerData?.phone) {
      await this.conversationService.updateState(conversation.id, 'collecting_phone');
      return this.getPremiumPhonePrompt();
    }

    const nameValidation = this.validateName(customerData.name);
    if (!nameValidation.valid) {
      return `Nome invalido: ${nameValidation.error}.`;
    }

    if (customerData.delivery_type === 'delivery' && customerData.address) {
      const addressString = `${customerData.address.street}, ${customerData.address.number}, ${customerData.address.neighborhood}, ${customerData.address.city}, ${customerData.address.state}`;
      const addressValidation = this.validateAddress(addressString);
      if (!addressValidation.valid) {
        return `Endereco invalido: ${addressValidation.error}.`;
      }
    }

    try {
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
                zipcode:
                  (customerData.address as { zipcode?: string; zipCode?: string }).zipcode ||
                  (customerData.address as { zipcode?: string; zipCode?: string }).zipCode ||
                  '',
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

      await this.conversationService.clearPendingOrder(conversation.id);
      await this.conversationService.setPedidoId(conversation.id, pedido.id);
      await this.conversationService.updateState(conversation.id, 'waiting_payment');

      if (wantsImmediatePayment) {
        const paymentConversation = {
          ...conversation,
          pedido_id: pedido.id,
          context: {
            ...(conversation.context || {}),
            pedido_id: pedido.id,
            state: 'waiting_payment',
          },
        } as TypedConversation;

        const paymentResponse = await this.processPaymentSelection(sanitizedMessage, tenantId, paymentConversation);
        return `Pedido *${pedido.order_no}* confirmado.\n\n${paymentResponse}`;
      }

      return this.buildOrderCreatedMessage(pedido);
    } catch (error) {
      this.logger.error('Error creating confirmed premium order', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          tenantId,
          customerPhone: conversation?.customer_phone,
          pendingOrder,
        },
      });

      return 'Nao consegui concluir o pedido agora. Tente novamente em instantes.';
    }
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
    if (/^\d+$/.test(text)) return null;
    const upper = text.toUpperCase();
    const reserved = new Set([
      'SIM',
      'NAO',
      'SEM',
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
    const normalized = this.normalizeForSearch(message).toUpperCase();
    const directMatch = normalized.match(/\bPED-\d{8}-[A-Z0-9]{3,}\b/);
    if (directMatch) {
      return directMatch[0];
    }

    const flexibleMatch = normalized.match(/\bPED[\s-]?(\d{8})[\s-]?([A-Z0-9]{3,})\b/);
    if (!flexibleMatch) {
      return null;
    }

    return `PED-${flexibleMatch[1]}-${flexibleMatch[2]}`;
  }

  private isCancelIntent(
    lowerMessage: string,
    conversation?: TypedConversation,
    currentState?: ConversationState,
  ): boolean {
    const analysis = this.messageIntelligenceService.analyze(lowerMessage);
    if (!analysis.normalizedText) return false;

    if (analysis.flags.explicitCancel || analysis.scores.cancel >= 0.88) {
      return true;
    }

    if (
      !this.hasActiveOrderContext(conversation, currentState) &&
      !this.extractOrderNo(analysis.normalizedText)
    ) {
      return false;
    }

    return analysis.flags.contextualCancel || analysis.scores.cancel >= 0.72;
  }

  private isReopenIntent(lowerMessage: string): boolean {
    const analysis = this.messageIntelligenceService.analyze(lowerMessage);
    if (analysis.scores.reopen >= 0.72) {
      return true;
    }

    return this.hasAnyNormalizedPhrase(analysis.normalizedText, [
      'reabri pedid',
      'reabri pedido',
      'reabrir pedid',
      'reabre pedid',
      'continuar pedid',
      'retomar pedid',
    ]);
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

  private isAmbiguousFlowControlIntent(
    lowerMessage: string,
    conversation?: TypedConversation,
    currentState?: ConversationState,
  ): boolean {
    const normalized = this.normalizeIntentText(lowerMessage);
    if (!normalized || !this.hasActiveOrderContext(conversation, currentState)) {
      return false;
    }

    const hasCancel = this.isCancelIntent(normalized, conversation, currentState);
    const hasResume = this.isReopenIntent(normalized);

    if (hasCancel && hasResume) {
      return true;
    }

    return this.hasAnyNormalizedPhrase(normalized, [
      'nao cancela',
      'cancela nao',
      'cancelar nao',
      'nao cancelar',
      'nao desiste',
      'desiste nao',
      'desistir nao',
    ]);
  }

  private getPremiumFlowControlClarificationMessage(): string {
    return [
      'Sua mensagem mistura cancelar e continuar o pedido.',
      '',
      'Para eu agir sem erro, responda com uma opcao por vez:',
      '- "cancelar pedido"',
      '- "continuar pedido"',
      '- "status do pedido"',
    ].join('\n');
  }

  private getPaymentOptionsMessage(total: number): string {
    const totalAmount = Number(total || 0);
    const pixAmount = totalAmount > 0 ? totalAmount * 0.95 : 0;
    return (
      `💳 *ESCOLHA A FORMA DE PAGAMENTO:*\n\n` +
      `1️⃣ *PIX* - Desconto de 5% (R$ ${this.formatCurrency(pixAmount)})\n` +
      `2️⃣ *Dinheiro*\n\n` +
      `💬 Digite o número ou o nome do método de pagamento.\n` +
      `Exemplo: "1", "pix", "dinheiro"`
    );
  }

  private looksLikeOrderStatusQuery(
    lowerMessage: string,
    conversation?: TypedConversation,
  ): boolean {
    const analysis = this.messageIntelligenceService.analyze(lowerMessage);
    const lm = analysis.normalizedText;
    if (!lm) return false;
    const currentState = conversation?.context?.state as ConversationState | undefined;
    if (this.isCancelIntent(lm, conversation, currentState)) return false;
    if (analysis.flags.hasOrderCode || this.extractOrderNo(lm)) return true;
    if (analysis.scores.status >= 0.72) return true;

    if (this.hasAnyNormalizedPhrase(lm, [
      'meu pedido',
      'status do pedido',
      'status pedido',
      'acompanhar pedido',
      'acompanha pedido',
      'rastrear pedido',
      'rastreia pedido',
      'cade meu pedido',
      'cade o pedido',
      'onde ta meu pedido',
      'onde ta o pedido',
      'aonde ta meu pedido',
      'como ta meu pedido',
      'qual status do pedido',
      'quando chega meu pedido',
      'quando chega minha entrega',
      'onde ta minha encomenda',
      'cade minha encomenda',
      'cade o motoboy',
      'onde ta o motoboy',
      'cade o entregador',
      'onde ta o entregador',
      'ja saiu com o motoboy',
      'ja saiu com o entregador',
      'andamento do pedido',
      'atualizacao do pedido',
      'atualizacao da entrega',
      'pedido saiu',
      'ja saiu meu pedido',
      'saiu para entrega',
      'chega que horas',
    ])) {
      return true;
    }

    const hasOrderKeyword = ['pedido', 'encomenda', 'entrega'].some((keyword) =>
      lm.includes(keyword),
    );
    const hasStatusSignal = this.hasAnyNormalizedPhrase(lm, [
      'status',
      'acompanhar',
      'acompanha',
      'rastrear',
      'rastreia',
      'cade',
      'onde ta',
      'aonde ta',
      'como ta',
      'quando chega',
      'demora',
      'andamento',
      'atualizacao',
      'ja saiu',
      'saiu',
    ]);

    if (hasOrderKeyword && hasStatusSignal) {
      return true;
    }

    if (this.hasActiveOrderContext(conversation, currentState)) {
      return this.hasAnyNormalizedPhrase(lm, [
        'cade',
        'onde ta',
        'aonde ta',
        'como ta',
        'quando chega',
        'demora',
        'ja saiu',
        'saiu',
        'motoboy',
        'entregador',
        'chega que horas',
        'ta pronto',
        'ficou pronto',
        'status',
      ]);
    }

    return false;
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

  private async handlePremiumOrderStatusQuery(
    tenantId: string,
    conversation: TypedConversation | undefined,
    orderNo: string | null,
  ): Promise<string> {
    try {
      let pedido: Pedido | null = null;

      if (orderNo) {
        pedido = await this.ordersService.findByOrderNo(orderNo, tenantId);
      }

      if (!pedido) {
        const pedidoId = conversation?.pedido_id || conversation?.context?.pedido_id;
        if (pedidoId) {
          pedido = await this.ordersService.findOne(pedidoId, tenantId);
        }
      }

      if (!pedido && conversation?.customer_phone) {
        pedido = await this.ordersService.findLatestByCustomerPhone(
          tenantId,
          conversation.customer_phone,
        );
      }

      if (!pedido) {
        return [
          'ACOMPANHAR PEDIDO',
          '',
          'Me envie o codigo do pedido (ex.: *PED-20260108-001*).',
          'Se a compra foi finalizada aqui, eu tambem consigo localizar pelo historico desta conversa.',
          '',
          `Portal de acompanhamento: ${this.getOrdersPortalUrl()}`,
        ].join('\n');
      }

      const itemsPreview = this.buildOrderItemsPreview(pedido);
      const action = this.getOrderStatusAction(pedido, pedido.status);

      return [
        this.getGreetingLine(pedido.customer_name),
        '',
        'ACOMPANHAMENTO DO PEDIDO',
        '',
        `Pedido: *${pedido.order_no}*`,
        `Status atual: *${this.getStatusLabel(pedido.status)}*`,
        `Recebimento: ${this.getDeliveryTypeLabel(pedido.delivery_type)}`,
        `Total: R$ ${this.formatCurrency(Number(pedido.total_amount || 0))}`,
        itemsPreview ? '' : '',
        itemsPreview,
        '',
        this.getNextStepSummary(pedido, pedido.status),
        action || '',
        '',
        `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
      ]
        .filter(Boolean)
        .join('\n');
    } catch (error) {
      this.logger.error('Error handling premium order status query', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { tenantId, orderNo, conversationId: conversation?.id },
      });
      return 'Nao consegui buscar o status agora. Tente novamente em instantes.';
    }
  }

  private async handlePremiumReopenIntent(
    tenantId: string,
    conversation: TypedConversation | undefined,
  ): Promise<string> {
    if (!conversation) {
      return 'Nao encontrei um pedido para retomar.';
    }

    const pedidoId = conversation.pedido_id || conversation.context?.pedido_id;
    const currentState = conversation.context?.state as ConversationState | undefined;
    let pedido: Pedido | null = null;

    const collectingStates = new Set<ConversationState>([
      'collecting_order',
      'collecting_name',
      'collecting_address',
      'collecting_phone',
      'collecting_notes',
      'collecting_cash_change',
      'confirming_order',
      'confirming_stock_adjustment',
    ]);

    if (currentState && collectingStates.has(currentState)) {
      const pendingOrder = conversation.context?.pending_order as PendingOrder | undefined;
      if (currentState === 'collecting_name' && pendingOrder && this.validatePendingOrder(pendingOrder).valid) {
        return [
          'Vamos continuar de onde paramos.',
          '',
          this.buildPremiumPendingOrderIntro(
            pendingOrder,
            'Antes de fechar, me diga o nome completo de quem vai receber o pedido.',
          ),
        ].join('\n');
      }

      if (currentState === 'collecting_address' && pendingOrder && this.validatePendingOrder(pendingOrder).valid) {
        const customerData = conversation.context?.customer_data as CustomerData | undefined;
        const draftText = this.buildAddressDraftText(this.getAddressDraftParts(conversation));

        if (!customerData?.delivery_type) {
          return [
            'Vamos continuar de onde paramos.',
            '',
            this.buildPremiumPendingOrderIntro(
              pendingOrder,
              this.getPremiumDeliveryChoicePrompt(customerData?.name),
            ),
          ].join('\n');
        }

        if (customerData.delivery_type === 'delivery' && !customerData.address) {
          return [
            'Vamos continuar de onde paramos.',
            '',
            draftText ? this.buildPremiumAddressDraftPrompt(draftText) : this.getPremiumAddressPrompt(),
          ].join('\n');
        }
      }

      if (currentState === 'collecting_phone') {
        return ['Vamos continuar de onde paramos.', '', this.getPremiumPhonePrompt()].join('\n');
      }

      if (currentState === 'collecting_notes') {
        return ['Vamos continuar de onde paramos.', '', this.getPremiumNotesPrompt()].join('\n');
      }

      if (currentState === 'confirming_order' && pendingOrder && this.validatePendingOrder(pendingOrder).valid) {
        return ['Vamos continuar de onde paramos.', '', await this.showOrderConfirmationPremium(tenantId, conversation)].join('\n');
      }
    }

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
      const latest = await this.ordersService.findLatestByCustomerPhone(
        tenantId,
        conversation.customer_phone,
      );

      if (latest?.status === PedidoStatus.CANCELADO) {
        await this.conversationService.clearPedido(conversation.id);
        await this.conversationService.updateState(conversation.id, 'idle');
        return [
          `O pedido *${latest.order_no}* ja foi cancelado e nao pode ser reativado automaticamente.`,
          'Se quiser, eu monto um novo pedido do zero sem reaproveitar nada por engano.',
          `Acompanhamento: ${this.buildTrackingUrl(latest.order_no)}`,
        ].join('\n');
      }

      await this.conversationService.clearPedido(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      return [
        'Nao encontrei um pedido pendente para retomar.',
        '',
        'Se quiser, eu monto um novo pedido por aqui sem reaproveitar nada por engano.',
        'Exemplo: "Quero X [produto]".',
      ].join('\n');
    }

    await this.conversationService.setPedidoId(conversation.id, pedido.id);
    await this.conversationService.updateState(conversation.id, 'waiting_payment');

    return [
      this.getGreetingLine(pedido.customer_name),
      '',
      `Pedido *${pedido.order_no}* retomado.`,
      `Recebimento: ${this.getDeliveryTypeLabel(pedido.delivery_type)}`,
      `Total: R$ ${this.formatCurrency(Number(pedido.total_amount || 0))}`,
      '',
      'Seu pedido continua preservado e voce pode concluir o pagamento agora.',
      this.getNextStepSummary(pedido, PedidoStatus.PENDENTE_PAGAMENTO),
      '',
      this.getPremiumPaymentOptionsMessage(Number(pedido.total_amount || 0)),
      '',
      `Acompanhamento completo: ${this.buildTrackingUrl(pedido.order_no)}`,
    ].join('\n');
  }

  private async handlePremiumCancelIntent(
    tenantId: string,
    conversation: TypedConversation | undefined,
    currentState?: ConversationState,
    orderNo?: string | null,
  ): Promise<string> {
    if (!conversation) {
      if (orderNo) {
        const pedido = await this.resolveRelevantOrder(tenantId, undefined, orderNo);
        if (pedido) {
          return [
            `Recebi o codigo *${pedido.order_no}*.`,
            'Por seguranca, eu nao cancelo pedido apenas pelo codigo em uma conversa sem contexto confirmado.',
            pedido.status === PedidoStatus.PENDENTE_PAGAMENTO
              ? 'Se essa compra foi iniciada neste mesmo numero, retome o pedido por aqui ou use o portal de acompanhamento.'
              : 'Para qualquer cancelamento depois da confirmacao, fale com o atendimento humano.',
            `Acompanhamento: ${this.buildTrackingUrl(pedido.order_no)}`,
          ].join('\n');
        }
      }

      return 'Nao encontrei um pedido em andamento para cancelar.\n\nSe quiser, eu posso montar um novo pedido com voce.';
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
      return 'Pedido interrompido com sucesso.\n\nQuando quiser, eu monto outro com voce do zero.';
    }

    let pedido: Pedido | null = null;

    if (orderNo) {
      pedido = await this.ordersService.findByOrderNo(orderNo, tenantId);
    }

    if (!pedido) {
      const pedidoId = conversation.pedido_id || conversation.context?.pedido_id;
      if (pedidoId) {
        pedido = await this.ordersService.findOne(pedidoId, tenantId);
      }
    }

    if (!pedido && conversation.customer_phone) {
      pedido = await this.ordersService.findLatestByCustomerPhone(
        tenantId,
        conversation.customer_phone,
      );
    }

    if (!pedido) {
      await this.conversationService.clearPendingOrder(conversation.id);
      await this.conversationService.clearCustomerData(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      return 'Nao encontrei um pedido pendente para cancelar.\n\nSe quiser, posso te ajudar a montar um novo agora.';
    }

    if (pedido.status === PedidoStatus.PENDENTE_PAGAMENTO) {
      await this.ordersService.updateStatus(pedido.id, PedidoStatus.CANCELADO, tenantId);
      await this.conversationService.clearPendingOrder(conversation.id);
      await this.conversationService.clearPedido(conversation.id);
      await this.conversationService.clearCustomerData(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      return [
        `Pedido *${pedido.order_no}* cancelado.`,
        '',
        'Se quiser recomecar, me diga o produto que voce deseja.',
        `Acompanhamento: ${this.buildTrackingUrl(pedido.order_no)}`,
      ].join('\n');
    }

    if (pedido.status === PedidoStatus.CANCELADO) {
      await this.conversationService.clearPedido(conversation.id);
      await this.conversationService.updateState(conversation.id, 'idle');
      return `Pedido *${pedido.order_no}* ja estava cancelado.\n\nSe quiser, podemos montar outro em seguida.`;
    }

    return [
      `Pedido *${pedido.order_no}* ja esta em *${this.getStatusLabel(pedido.status)}*.`,
      'Depois da confirmacao, o cancelamento precisa passar pelo atendimento humano para evitar erro operacional.',
      `Acompanhe aqui: ${this.buildTrackingUrl(pedido.order_no)}`,
    ].join('\n');
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

    return await this.applyPendingOrderAndProceedPremium(pendingOrder, tenantId, conversation);
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
      return { valid: false, error: 'Quantidade deve ser um numero inteiro' };
    }

    if (quantity < this.MIN_QUANTITY) {
      return { valid: false, error: `Quantidade minima e ${this.MIN_QUANTITY}` };
    }

    if (quantity > this.MAX_QUANTITY) {
      return { valid: false, error: `Quantidade maxima e ${this.MAX_QUANTITY}` };
    }

    return { valid: true };
  }

  /**
   * ✅ NOVO: Valida nome
   */
  private validateName(name: string): { valid: boolean; error?: string } {
    const sanitized = this.sanitizeInput(name);

    if (sanitized.length < this.MIN_NAME_LENGTH) {
      return { valid: false, error: `Nome deve ter no minimo ${this.MIN_NAME_LENGTH} caracteres` };
    }

    if (sanitized.length > this.MAX_NAME_LENGTH) {
      return { valid: false, error: `Nome deve ter no maximo ${this.MAX_NAME_LENGTH} caracteres` };
    }

    // Validar caracteres permitidos (letras, espaços, acentos, hífen)
    if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(sanitized)) {
      return { valid: false, error: 'Nome contem caracteres invalidos' };
    }

    const normalized = sanitized
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    const reservedNames = new Set([
      'sim',
      'ok',
      'pix',
      'credito',
      'debito',
      'dinheiro',
      'entrega',
      'retirada',
      'cancelar',
      'ajuda',
      'cardapio',
      'menu',
      'status',
      'pedido',
      'quero',
      'comprar',
      'pedir',
      'preco',
      'valor',
      'estoque',
      'sem',
      'nao',
    ]);

    if (reservedNames.has(normalized)) {
      return { valid: false, error: 'Preciso do nome da pessoa, nao de um comando' };
    }

    return { valid: true };
  }

  /**
   * ✅ NOVO: Valida endereço
   */
  private validateAddress(address: string): { valid: boolean; error?: string } {
    const sanitized = this.sanitizeInput(address);

    if (sanitized.length < this.MIN_ADDRESS_LENGTH) {
      return { valid: false, error: `Endereco deve ter no minimo ${this.MIN_ADDRESS_LENGTH} caracteres` };
    }

    if (sanitized.length > this.MAX_ADDRESS_LENGTH) {
      return { valid: false, error: `Endereco deve ter no maximo ${this.MAX_ADDRESS_LENGTH} caracteres` };
    }

    return { valid: true };
  }

  /**
   * ✅ NOVO: Valida telefone
   */
  private validatePhone(phone: string): { valid: boolean; error?: string } {
    const digitsOnly = phone.replace(/\D/g, '');

    if (digitsOnly.length < 10 || digitsOnly.length > 11) {
      return { valid: false, error: 'Telefone deve ter 10 ou 11 digitos (com DDD)' };
    }

    return { valid: true };
  }

  /**
   * ✅ NOVO: Valida preço
   */
  private validatePrice(price: number): { valid: boolean; error?: string } {
    if (typeof price !== 'number' || isNaN(price)) {
      return { valid: false, error: 'Preco deve ser um numero valido' };
    }

    if (price <= 0) {
      return { valid: false, error: 'Preco deve ser maior que zero' };
    }

    if (price > this.MAX_PRICE) {
      return { valid: false, error: `Preco maximo e R$ ${this.MAX_PRICE.toLocaleString('pt-BR')}` };
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

  async processIncomingMessage(message: WhatsappMessage): Promise<WhatsappOutboundResponse> {
    this.logger.log(`Processing message from ${message.from}: ${message.body}`);

    try {
      if (this.isGroupOrBroadcastMessage(message)) {
        this.logger.warn('Ignoring WhatsApp group/broadcast message', {
          from: message.from,
          messageId: message.messageId,
          sourceJid: this.readMetadataString(message, 'sourceJid'),
        });
        return '';
      }
      // ⚠️ CRÍTICO: tenantId deve vir obrigatoriamente, nunca usar default hardcoded
      if (!message.tenantId) {
        this.logger.error('Tenant ID missing from WhatsApp message', { from: message.from });
        throw new BadRequestException('Tenant ID é obrigatório para processar mensagens WhatsApp');
      }
      const tenantId = message.tenantId;
      const tenant = await this.tenantsService.findOneById(tenantId);

      const normalizedBody = this.normalizeIncomingMessageBody(message);
      const sanitizedBody = this.sanitizeInput(normalizedBody);
      if (!sanitizedBody) {
        return '❌ Mensagem vazia ou inválida. Por favor, envie uma mensagem válida.';
      }

      if (message.body && message.body.length > this.MAX_MESSAGE_LENGTH) {
        this.logger.warn(`Message too long: ${message.body.length} characters`, { from: message.from });
        return `❌ Mensagem muito longa. Por favor, envie uma mensagem com no máximo ${this.MAX_MESSAGE_LENGTH} caracteres.`;
      }

      const controlResponse = await this.tryHandleBotControlCommand(tenant, {
        ...message,
        body: sanitizedBody,
      });
      if (controlResponse !== null) {
        this.logger.log(`Administrative bot-control command handled for ${message.from}`);
        return controlResponse;
      }

      if (!this.isBotEnabled(tenant)) {
        return '';
      }

      try {
        return await this.cacheService.withConversationLock(
          tenantId,
          message.from,
          async () => {

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

      const replayGuard = this.shouldReplayPreviousResponse(
        message,
        sanitizedBody,
        typedConversation,
      );
      if (replayGuard.replay) {
        this.logger.log(`Replaying previous WhatsApp response for ${message.from}`, {
          messageId: message.messageId,
        });
        return replayGuard.response || this.getPremiumFallbackMessage();
      }

      const duplicateGuard = this.shouldSuppressRepeatedInbound(
        sanitizedBody,
        typedConversation,
      );

      // Salvar mensagem recebida (sanitizada)
      await this.conversationService.saveMessage(
        conversation.id,
        'inbound',
        sanitizedBody,
        message.messageType || 'text',
        this.buildInboundMessageMetadata(message),
      );

      if (duplicateGuard.suppress) {
        const duplicateResponse = this.buildDuplicateProtectionMessage(
          typedConversation,
          duplicateGuard.repeatCount,
        );

        await this.conversationService.updateContext(conversation.id, {
          last_inbound_signature: this.buildInboundSignature(sanitizedBody),
          last_inbound_at: new Date().toISOString(),
          last_inbound_repeat_count: duplicateGuard.repeatCount,
          last_outbound_preview: this.buildResponsePreview(
            duplicateResponse,
          ),
          last_processed_event_key: replayGuard.eventKey,
          last_processed_event_at: new Date().toISOString(),
          last_processed_response: duplicateResponse,
          last_processed_response_payload: this.serializeOutboundResponse(duplicateResponse),
        });

        await this.conversationService.saveMessage(
          conversation.id,
          'outbound',
          duplicateResponse,
        );

        this.logger.log(`Response: ${duplicateResponse}`);
        return duplicateResponse;
      }

      const currentState = typedConversation.context?.state as ConversationState | undefined;
      const response =
        (await this.tryBuildInteractiveCatalogResponse(
          sanitizedBody,
          tenantId,
          typedConversation,
          currentState,
        )) ||
        (await this.tryMemoryDrivenCatalogResponse(
          sanitizedBody,
          tenantId,
          typedConversation,
          currentState,
        )) ||
        (await this.generateResponse(
          sanitizedBody,
          tenantId,
          typedConversation,
        ));
      const outboundPreview = this.getOutboundPreview(response);

      // Salvar mensagem enviada
      await this.conversationService.saveMessage(
        conversation.id,
        'outbound',
        outboundPreview,
        this.getOutboundMessageType(response),
        this.buildOutboundMessageMetadata(response),
      );

      const nextAbuseCount = this.containsAbusiveLanguage(sanitizedBody)
        ? Number(typedConversation.context?.abuse_count || 0) + 1
        : 0;

      await this.conversationService.updateContext(conversation.id, {
        last_inbound_signature: this.buildInboundSignature(sanitizedBody),
        last_inbound_at: new Date().toISOString(),
        last_inbound_repeat_count: 0,
        last_outbound_preview: this.buildResponsePreview(outboundPreview),
        abuse_count: nextAbuseCount,
        last_processed_event_key: replayGuard.eventKey,
        last_processed_event_at: new Date().toISOString(),
        last_processed_response: outboundPreview,
        last_processed_response_payload: this.serializeOutboundResponse(response),
      });

      this.logger.log(`Response: ${outboundPreview}`);
      return response;
          },
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'CONVERSATION_LOCK_TIMEOUT') {
          this.logger.warn('Timed out waiting for WhatsApp conversation lock', {
            from: message.from,
            tenantId,
          });
          return 'Estou finalizando sua mensagem anterior. Me envie a proxima instrucao em alguns segundos.';
        }

        throw error;
      }
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
    const lowerMessage = this.normalizeIntentText(message);
    const conversationalAnalysis = this.conversationalIntelligenceService.analyze(message);

    // ✅ NOVO: Verificar estado da conversa PRIMEIRO (antes de qualquer outra coisa)
    const currentState = conversation?.context?.state as ConversationState | undefined;
    const shouldPrioritizeConversationalRecap =
      conversationalAnalysis.intent === 'recap' && (!!conversation || !!currentState);

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
    const mixedStatusAndPostFlowMutation = this.isMixedStatusAndMutationIntent(
      lowerMessage,
      conversation,
      currentState,
    );
    if (mixedStatusAndPostFlowMutation) {
      const pedido = await this.resolveRelevantOrder(tenantId, conversation, orderNo);
      if (pedido) {
        return this.buildPostOrderStatusAndChangeGuardMessage(pedido, currentState);
      }
    }

    if (this.isMixedStatusAndFreshOrderIntent(lowerMessage, conversation)) {
      return this.getMixedIntentClarificationMessage();
    }

    if (this.isAmbiguousFlowControlIntent(lowerMessage, conversation, currentState)) {
      return this.getPremiumFlowControlClarificationMessage();
    }

    if (this.isAmbiguousChoiceOrderIntent(lowerMessage)) {
      return this.getPremiumOrderChoiceClarificationMessage();
    }

    if (this.isReopenIntent(lowerMessage)) {
      return await this.handlePremiumReopenIntent(tenantId, conversation);
    }

    if (
      !shouldPrioritizeConversationalRecap &&
      this.looksLikeOrderStatusQuery(lowerMessage, conversation)
    ) {
      return await this.handlePremiumOrderStatusQuery(tenantId, conversation, orderNo);
    }

    if (this.isCancelIntent(lowerMessage, conversation, currentState)) {
      return await this.handlePremiumCancelIntent(tenantId, conversation, currentState, orderNo);
    }

    if (this.isRepeatOrderIntent(lowerMessage)) {
      return await this.handleRepeatOrderIntent(tenantId, conversation);
    }

    const pendingOrderAdjustment = await this.tryAdjustPendingOrder(
      message,
      tenantId,
      conversation,
      currentState,
    );
    if (pendingOrderAdjustment) {
      return pendingOrderAdjustment;
    }

    const conversationalSupport = await this.tryConversationalSupportResponse(
      message,
      tenantId,
      conversation,
      currentState,
    );
    if (conversationalSupport) {
      return conversationalSupport;
    }

    if (currentState === 'confirming_stock_adjustment') {
      return await this.processStockAdjustment(message, tenantId, conversation);
    }

    if (currentState === 'collecting_cash_change') {
      return await this.processCashChange(message, tenantId, conversation);
    }
    
    // Se está coletando dados do cliente, processar isso primeiro
    if (currentState === 'collecting_name') {
      return await this.processCustomerNamePremium(message, tenantId, conversation);
    }
    
    if (currentState === 'collecting_address') {
      return await this.processCustomerAddressPremium(message, tenantId, conversation);
    }
    
    if (currentState === 'collecting_phone') {
      const semanticDetour = await this.tryHandleCollectionStageDetour(
        message,
        tenantId,
        conversation,
        'collecting_phone',
      );
      if (semanticDetour) {
        return semanticDetour;
      }

      if (this.isAddressLikelyComplete(message) || this.hasAddressKeyword(message)) {
        return 'Recebi um endereco, mas agora preciso do telefone de contato com DDD para seguir.';
      }

      const extractedName = this.extractCustomerNameCandidate(message);
      if (
        !/\d/.test(message) &&
        !this.hasAddressKeyword(message) &&
        !this.hasAnyNormalizedPhrase(this.normalizeIntentText(message), [
          'telefone',
          'numero',
          'celular',
          'fixo',
          'whatsapp',
          'zap',
        ]) &&
        this.validateName(extractedName).valid
      ) {
        return 'Nome certo. Agora preciso do telefone de contato com DDD para seguir.';
      }

      if (['sim', 'ok', 'sem'].includes(lowerMessage)) {
        return 'Antes de seguir, preciso do telefone de contato com DDD. Exemplo: 11987654321.';
      }

      return await this.processCustomerPhone(message, tenantId, conversation);
    }

    if (currentState === 'collecting_notes') {
      return await this.processCustomerNotesPremium(message, tenantId, conversation);
    }
    
    if (currentState === 'confirming_order') {
      return await this.processOrderConfirmationPremium(message, tenantId, conversation);
    }

    // IMPORTANTE: Verificar seleção de método de pagamento
    const contextualResponse = await this.tryContextualMessageResolution(
      message,
      tenantId,
      conversation,
      currentState,
    );
    if (contextualResponse) {
      return contextualResponse;
    }

    const isPaymentSelection = this.isPaymentMethodSelection(message);
    if (isPaymentSelection) {
      const pedidoAtivo = await this.resolveRelevantOrder(tenantId, conversation, orderNo);

      if (pedidoAtivo && pedidoAtivo.status !== PedidoStatus.PENDENTE_PAGAMENTO) {
        return this.buildPaymentStageGuardMessage(pedidoAtivo);
      }

      const waitingPaymentContext =
        currentState === 'waiting_payment' ||
        conversation?.context?.waiting_payment === true ||
        pedidoAtivo?.status === PedidoStatus.PENDENTE_PAGAMENTO;

      if (waitingPaymentContext) {
        const paymentConversation =
          conversation && pedidoAtivo && !conversation.pedido_id && !conversation.context?.pedido_id
            ? ({
                ...conversation,
                pedido_id: pedidoAtivo.id,
                context: {
                  ...(conversation.context || {}),
                  pedido_id: pedidoAtivo.id,
                  waiting_payment: true,
                  state: 'waiting_payment',
                },
              } as TypedConversation)
            : conversation;

        return await this.processPaymentSelection(message, tenantId, paymentConversation);
      }

      return 'Nao encontrei um pedido pendente para pagamento.\n\nMe diga o produto que voce quer para eu montar um novo pedido com seguranca.';
    }
    if (isPaymentSelection && !conversation && currentState === 'collecting_order') {
      return '❌ Não encontrei um pedido pendente para pagamento.\n\n' +
        '💬 Faça um pedido primeiro digitando: "Quero X [produto]"';
    }

    const stageRecoveryMessage = await this.tryHandleOutOfOrderStageReply(
      message,
      tenantId,
      conversation,
      currentState,
      orderNo,
    );
    if (stageRecoveryMessage) {
      return stageRecoveryMessage;
    }

    if (
      this.containsAbusiveLanguage(lowerMessage) &&
      !conversationalAnalysis.signals.issue &&
      !conversationalAnalysis.signals.clarification &&
      !this.hasActionableIntent(lowerMessage, conversation, currentState)
    ) {
      return this.getPremiumBoundaryMessage(
        Number(conversation?.context?.abuse_count || 0) + 1,
      );
    }

    const shouldResolvePostFlowOrder =
      !!currentState && ['waiting_payment', 'order_confirmed', 'order_completed'].includes(currentState);
    const postFlowOrder = shouldResolvePostFlowOrder
      ? await this.resolveRelevantOrder(tenantId, conversation, orderNo)
      : null;

    if (postFlowOrder && this.isPaymentProofIntent(lowerMessage)) {
      return this.buildPaymentProofGuidanceMessage(postFlowOrder);
    }

    if (postFlowOrder && this.shouldGuardPostFlowMutation(lowerMessage, currentState)) {
      return this.buildPostOrderChangeGuardMessage(postFlowOrder, currentState);
    }

    if (postFlowOrder && this.isPostOrderChangeIntent(lowerMessage)) {
      return this.buildPostOrderChangeGuardMessage(postFlowOrder, currentState);
    }

    if (postFlowOrder && this.isPostOrderCourtesyIntent(lowerMessage)) {
      return this.buildPostOrderCourtesyMessage(postFlowOrder, currentState);
    }

    const isIdleLikeState =
      !currentState ||
      currentState === 'idle' ||
      currentState === 'order_confirmed' ||
      currentState === 'order_completed';
    const normalizedIntent = this.normalizeIntentText(lowerMessage);
    if (
      isIdleLikeState &&
      this.hasAnyNormalizedPhrase(normalizedIntent, [
        'nao quero',
        'nao quero mais',
        'nao vou querer',
        'nao vou mais querer',
        'quero desistir',
        'deixa pra la',
        'deixa para la',
      ])
    ) {
      return this.getPremiumSoftResetMessage();
    }
    if (isIdleLikeState && this.isOutOfFlowStopIntent(lowerMessage)) {
      return this.getPremiumSoftResetMessage();
    }
    if (isIdleLikeState && this.isLooseReplyWithoutContext(lowerMessage)) {
      return this.getPremiumContextRecoveryMessage();
    }

    if (this.isBareOrderIntent(lowerMessage)) {
      return this.getPremiumOrderNudgeMessage();
    }

    if (this.shouldUseNonCommercialRecovery(message, conversation, currentState)) {
      return this.getPremiumNonCommercialRecoveryMessage();
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
    if (this.isDirectCatalogRequest(message)) {
      return await this.getPremiumCardapio(tenantId);
    }

    // Comando: Preço de [produto]
    if (this.isDirectPriceQuestion(message)) {
      return await this.getPremiumPriceResponse(message, tenantId, conversation);
    }

    // Comando: Estoque de [produto]
    if (this.isDirectStockQuestion(message)) {
      return await this.getPremiumStockResponse(message, tenantId, conversation);
    }

    // Comando: Horário
    if (this.isDirectScheduleQuestion(message)) {
      return this.getPremiumScheduleMessage();
    }

    // Comando: Ajuda
    if (this.isDirectHelpRequest(message)) {
      return this.getPremiumHelpMessage();
    }

    // Saudação
    if (this.isDirectGreeting(message)) {
      return this.getPremiumGreetingMessage();
    }

    // Resposta padrão
    const conciergeResponse = await this.trySmartConciergeResponse(message, tenantId, conversation);
    if (conciergeResponse) {
      return conciergeResponse;
    }

    const aiRouted = await this.tryAIAssistedRouting(message, tenantId, conversation, currentState);
    if (aiRouted) {
      return aiRouted;
    }

    const finalAnalysis = this.messageIntelligenceService.analyze(message);
    if (finalAnalysis.flags.needsClarification) {
      return this.buildSemanticClarificationMessage(message, currentState);
    }

    return this.getPremiumFallbackMessage();
  }

  private async tryContextualMessageResolution(
    message: string,
    tenantId: string,
    conversation?: TypedConversation,
    currentState?: ConversationState,
  ): Promise<string | null> {
    if (!conversation) {
      return null;
    }

    if (currentState && !['idle', 'order_confirmed', 'order_completed'].includes(currentState)) {
      return null;
    }

    const salesAnalysis = this.salesIntelligenceService.analyze(message);
    if (salesAnalysis.intent !== 'other') {
      return null;
    }

    const contextSnapshot = this.buildMessageContextSnapshot(conversation);
    const hasReferenceContext =
      !!contextSnapshot.lastProductName || !!contextSnapshot.lastProductNames?.length;

    if (!hasReferenceContext) {
      return null;
    }

    const contextualAnalysis = this.messageIntelligenceService.analyzeWithContext(
      message,
      contextSnapshot,
    );

    if (
      !contextualAnalysis.references.contextualFollowUp ||
      !contextualAnalysis.contextualProductCandidate
    ) {
      return null;
    }

    if (contextualAnalysis.contextualIntent === 'consultar') {
      if (contextSnapshot.lastIntent === 'stock') {
        return await this.getPremiumStockResponse(
          `estoque de ${contextualAnalysis.contextualProductCandidate}`,
          tenantId,
          conversation,
        );
      }

      return await this.getPremiumPriceResponse(
        `preco de ${contextualAnalysis.contextualProductCandidate}`,
        tenantId,
        conversation,
      );
    }

    if (contextualAnalysis.contextualIntent !== 'fazer_pedido') {
      return null;
    }

    const fallbackQuantity =
      contextualAnalysis.references.selectedSuggestionIndex !== null ? 1 : null;
    const syntheticQuantity = contextualAnalysis.contextualQuantity ?? fallbackQuantity;
    const syntheticMessage = syntheticQuantity
      ? `quero ${syntheticQuantity} ${contextualAnalysis.contextualProductCandidate}`
      : `quero ${contextualAnalysis.contextualProductCandidate}`;

    return await this.processOrder(syntheticMessage, tenantId, conversation);
  }

  private getMultiItemQuantityLeadPattern(): string {
    return [
      '\\d+',
      'meia\\s+duzia',
      'uma\\s+duzia',
      'duas\\s+duzias?',
      'tres\\s+duzias?',
      'um',
      'uma',
      'dois',
      'duas',
      'tres',
      'quatro',
      'cinco',
      'seis',
      'sete',
      'oito',
      'nove',
      'dez',
      'onze',
      'doze',
    ].join('|');
  }

  private splitMultiItemOrderParts(message: string): string[] {
    const normalized = this.applyCommonChatNormalizations(
      (message || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase(),
    )
      .replace(/[?!;:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) {
      return [];
    }

    const quantityLead = this.getMultiItemQuantityLeadPattern();
    return normalized
      .split(
        new RegExp(
          `\\s*(?:,|\\+|\\be\\b|\\bmais\\b)\\s*(?=(?:${quantityLead})\\b)`,
          'gi',
        ),
      )
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private looksLikeMultiItemOrder(message: string): boolean {
    const parts = this.splitMultiItemOrderParts(message);
    if (parts.length < 2) {
      return false;
    }

    const parsedParts = parts.filter((part) => {
      const info = this.extractOrderInfo(part);
      return info.quantity !== null && !!info.productName;
    });

    return parsedParts.length >= 2;
  }

  private isBareOrderIntent(lowerMessage: string): boolean {
    const normalized = this.normalizeForSearch(lowerMessage)
      .replace(/[?!.,;:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return false;
    }

    const bareOrderPhrases = new Set([
      'quero',
      'pedido',
      'pedir',
      'comprar',
      'preciso',
      'quero pedir',
      'quero comprar',
      'vou querer',
      'me manda',
      'manda',
      'gostaria de',
      'quero fazer um pedido',
    ]);

    return bareOrderPhrases.has(normalized);
  }

  private getPremiumOrderNudgeMessage(): string {
    return [
      'Eu monto o pedido inteiro por aqui.',
      '',
      'Me envie quantidade + produto para eu seguir sem erro.',
      'Exemplos:',
      '- "quero 6 brigadeiros"',
      '- "1 bolo de chocolate"',
      '- "me mostra o cardapio"',
    ].join('\n');
  }

  private isLooseReplyWithoutContext(lowerMessage: string): boolean {
    const analysis = this.messageIntelligenceService.analyze(lowerMessage);
    const normalized = this.normalizeIntentText(lowerMessage);

    if (!normalized) {
      return false;
    }

    if (
      analysis.primaryIntent === 'fazer_pedido' ||
      analysis.scores.order >= 0.6 ||
      (analysis.quantity !== null && !!analysis.productCandidate)
    ) {
      return false;
    }

    if (/^\d{10,11}$/.test(normalized)) {
      return true;
    }

    if (this.looksLikeCollectionFragmentWithoutContext(normalized)) {
      return true;
    }

    const looseReplies = new Set([
      'sim',
      'ok',
      'nao',
      'retirada',
      'entrega',
      'pix',
      'credito',
      'debito',
      'dinheiro',
      'cartao',
      'boleto',
      '1',
      '2',
      '3',
      '4',
    ]);

    return looseReplies.has(normalized);
  }

  private buildSemanticClarificationMessage(
    message: string,
    currentState?: ConversationState,
  ): string {
    const analysis = this.messageIntelligenceService.analyze(message);
    const candidate =
      analysis.productCandidate || this.extractCatalogQuery(message) || null;
    const shouldMentionCandidate =
      Boolean(candidate) &&
      !analysis.flags.lowSignal &&
      String(candidate).trim().length >= 4 &&
      (analysis.quantity !== null ||
        analysis.scores.order >= 0.55 ||
        analysis.scores.status >= 0.55 ||
        analysis.scores.payment >= 0.55);
    const stageLabel =
      currentState && currentState !== 'idle'
        ? this.getConversationStageLabel(currentState)
        : null;

    const lines = ['Quero te entender sem adivinhar coisa errada.'];

    if (shouldMentionCandidate) {
      lines.push(`A parte mais forte que eu captei foi: *${candidate}*.`);
    }

    if (stageLabel) {
      lines.push(`Neste momento a conversa esta em: *${stageLabel}*.`);
    }

    lines.push('');
    lines.push('Me diga em uma frase o que voce quer agora, do jeito mais direto possivel.');

    lines.push('Exemplos:');
    lines.push('- "quero 2 brigadeiros"');
    lines.push('- "preco da banoffe"');
    lines.push('- "acho que voce nao entendeu o pedido"');

    return lines.join('\n');
  }

  private getPremiumContextRecoveryMessage(): string {
    return [
      'Ainda nao tenho um pedido em andamento com esse contexto.',
      '',
      'Se quiser comprar, me envie quantidade + produto.',
      'Exemplos:',
      '- "quero 2 brigadeiros"',
      '- "1 bolo de chocolate"',
      '- "cardapio"',
    ].join('\n');
  }

  private getPremiumSoftResetMessage(): string {
    return [
      'Sem problema, vou parar por aqui.',
      '',
      'Quando quiser retomar, eu monto um novo pedido com voce sem perder tempo.',
      'Se preferir, envie "cardapio" para ver os itens ou "ajuda" para ver os atalhos.',
    ].join('\n');
  }

  private getPremiumNonCommercialRecoveryMessage(): string {
    return [
      'Calma, acho que eu puxei a conversa para o lado errado.',
      '',
      'Essa mensagem nao parece um pedido da loja, entao eu prefiro nao inventar item, preco ou quantidade.',
      'Se voce quiser comprar, me diga o produto do seu jeito ou envie "cardapio".',
      'Se era outro assunto, pode me explicar em uma frase que eu tento te entender sem forcar um pedido.',
    ].join('\n');
  }

  private isLikelyNonCommercialMessage(message: string): boolean {
    const normalized = this.normalizeIntentText(message);
    if (!normalized) {
      return false;
    }

    const emotionalOrRejectivePhrases = [
      'meu deus',
      'mds',
      'socorro',
      'credo',
      'aff',
      'affs',
      'oxe',
      'eita',
      'que isso',
      'para com isso',
      'tira isso',
      'pelo amor de deus',
    ];

    if (this.hasAnyNormalizedPhrase(normalized, emotionalOrRejectivePhrases)) {
      return true;
    }

    return /^(vou|to|estou|fui)\s+(fazer|comer|cozinhar|dormir|sair|trabalhar|estudar)\b/.test(
      normalized,
    );
  }

  private isOutOfFlowStopIntent(message: string): boolean {
    const normalized = this.normalizeIntentText(message);
    if (!normalized) {
      return false;
    }

    const explicitStopPhrases = [
      'tira isso',
      'para com isso',
      'pare com isso',
      'deixa isso',
      'deixa quieto',
      'para ai',
      'pare ai',
    ];

    if (this.hasAnyNormalizedPhrase(normalized, explicitStopPhrases)) {
      return true;
    }

    return /^(para|pare|chega)\b/.test(normalized);
  }

  private shouldUseNonCommercialRecovery(
    message: string,
    conversation?: TypedConversation,
    currentState?: ConversationState,
  ): boolean {
    if (currentState && !['idle', 'order_confirmed', 'order_completed'].includes(currentState)) {
      return false;
    }

    const normalized = this.normalizeIntentText(message);
    if (!normalized) {
      return false;
    }

    if (
      this.isDirectCatalogRequest(normalized) ||
      this.isDirectPriceQuestion(normalized) ||
      this.isDirectStockQuestion(normalized) ||
      this.isDirectScheduleQuestion(normalized) ||
      this.isDirectHelpRequest(normalized) ||
      this.isDirectGreeting(normalized) ||
      this.isPaymentMethodSelection(normalized) ||
      this.isCancelIntent(normalized, conversation, currentState) ||
      this.looksLikeOrderStatusQuery(normalized, conversation) ||
      this.isReopenIntent(normalized) ||
      this.isRepeatOrderIntent(normalized) ||
      this.isBareOrderIntent(normalized) ||
      this.isOrderIntent(normalized) ||
      this.looksLikeMultiItemOrder(normalized)
    ) {
      return false;
    }

    return this.isLikelyNonCommercialMessage(normalized);
  }

  private isOrderIntent(lowerMessage: string): boolean {
    const analysis = this.messageIntelligenceService.analyze(lowerMessage);
    const salesAnalysis = this.salesIntelligenceService.analyze(lowerMessage);
    const normalized = this.normalizeForSearch(lowerMessage);

    if (this.isBareOrderIntent(normalized)) {
      return false;
    }

    if (analysis.flags.negativeOrder) {
      return false;
    }

    if (
      this.isDirectPriceQuestion(normalized) ||
      this.isDirectStockQuestion(normalized) ||
      this.isDirectScheduleQuestion(normalized)
    ) {
      return false;
    }

    const extractedOrder = this.extractOrderInfo(normalized);
    if (extractedOrder.quantity !== null && !!extractedOrder.productName) {
      return true;
    }

    if (salesAnalysis.intent !== 'other') {
      return false;
    }

    if (
      analysis.primaryIntent === 'fazer_pedido' &&
      analysis.scores.order >= 0.72 &&
      !analysis.flags.uncertainChoice
    ) {
      return true;
    }

    const palavrasPedido = [
      'quero', 'preciso', 'comprar', 'pedir', 'vou querer', 'gostaria de',
      'desejo', 'vou comprar', 'preciso de', 'queria', 'ia querer',
      'me manda', 'manda', 'manda ai', 'manda pra mim', 'me ve', 'separa', 'separa pra mim',
      'separar', 'separar pra mim', 'separar para mim',
      'pode ser', 'faz', 'me faz', 'faz pra mim', 'bota', 'coloca', 'traz', 'traz pra mim',
      'pode me enviar', 'tem como', 'dá pra', 'dá pra fazer', 'dá pra me enviar',
      'seria possível', 'poderia', 'pode me mandar', 'me envia', 'envia',
      'vou pedir', 'quero comprar', 'preciso comprar', 'quero pedir', 'quero levar', 'quero pegar',
      'preciso pedir', 'quero encomendar', 'preciso encomendar',
      'quero fazer pedido', 'preciso fazer pedido', 'quero fazer um pedido',
      'preciso fazer um pedido', 'quero fazer uma encomenda', 'preciso fazer uma encomenda',
      'quero fazer encomenda', 'preciso fazer encomenda', 'quero fazer', 'preciso fazer',
    ];

    return (
      palavrasPedido.some((palavra) => normalized.includes(this.normalizeForSearch(palavra))) &&
      Boolean(analysis.productCandidate)
    );
  }

  private isDirectCatalogRequest(message: string): boolean {
    const normalized = this.normalizeIntentText(message);
    return /\b(cardapio|catalogo|catalogue|menu)\b/.test(normalized);
  }

  private isDirectPriceQuestion(message: string): boolean {
    const normalized = this.normalizeIntentText(message);
    return /\b(preco|valor|quanto custa|qual o valor|quanto sai|quanto fica)\b/.test(normalized);
  }

  private isDirectStockQuestion(message: string): boolean {
    const normalized = this.normalizeIntentText(message);
    return (
      /\b(estoque|disponivel|disponibilidade)\b/.test(normalized) ||
      /\b(tem|ainda tem|restou|sobrou)\b.*\b(estoque|disponivel)\b/.test(normalized)
    );
  }

  private isDirectScheduleQuestion(message: string): boolean {
    const normalized = this.normalizeIntentText(message);
    return /\b(horario|funciona|aberto|fecha|abre)\b/.test(normalized);
  }

  private isDirectHelpRequest(message: string): boolean {
    const normalized = this.normalizeIntentText(message);
    if (!normalized) {
      return false;
    }

    return /^(ajuda|help|comandos)$/.test(normalized);
  }

  private isDirectGreeting(message: string): boolean {
    const normalized = this.normalizeIntentText(message);
    if (!normalized) {
      return false;
    }

    if (
      /\b(quero|preciso|preco|valor|estoque|pedido|indica|recomenda|sugere|compar|barato|caro|produto|item)\b/.test(
        normalized,
      )
    ) {
      return false;
    }

    return /^(oi|ola|bom dia|boa tarde|boa noite)(?:\s+tudo bem)?$/.test(normalized);
  }

  private extractMultipleOrderInfos(
    message: string,
  ): Array<{ quantity: number; productName: string }> | null {
    const parts = this.splitMultiItemOrderParts(message);

    if (parts.length < 2) return null;

    const parsed: Array<{ quantity: number; productName: string }> = [];
    for (const part of parts) {
      const info = this.extractOrderInfo(part);
      if (info.quantity === null || !info.productName) {
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

      if (!resultadoBusca.produto && resultadoBusca.sugestoes?.length) {
        let msgSug = `Nao encontrei exatamente "${part.productName}" com seguranca. Talvez seja:\n\n`;
        resultadoBusca.sugestoes.forEach((p, index) => {
          msgSug += `${index + 1}. *${p.name}*\n`;
        });
        msgSug += '\nDigite o nome completo do produto para eu nao errar o pedido.';
        return msgSug;
      }

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

    return await this.applyPendingOrderAndProceedPremium(pendingOrder, tenantId, conversation);
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
    await this.rememberPendingOrderIntelligence(conversation, pendingOrder);

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
        return this.getPremiumPhonePrompt();
      }

      if (customerData.notes === undefined) {
        await this.conversationService.updateState(conversation.id, 'collecting_notes');
        return this.getPremiumNotesPrompt();
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

      const hasQuantity = orderInfo.quantity !== null;
      const hasProduct = !!orderInfo.productName;

      if (!hasQuantity && hasProduct) {
        const produtosSemQuantidadeResult = await this.productsService.findAll(tenantId);
        const produtosSemQuantidade = Array.isArray(produtosSemQuantidadeResult)
          ? produtosSemQuantidadeResult
          : produtosSemQuantidadeResult.data;
        const resultadoBuscaSemQuantidade = this.findProductByName(
          produtosSemQuantidade,
          orderInfo.productName as string,
        );

        if (!resultadoBuscaSemQuantidade.produto && !resultadoBuscaSemQuantidade.sugestoes?.length) {
          return this.getPremiumNonCommercialRecoveryMessage();
        }

        if (!resultadoBuscaSemQuantidade.produto && resultadoBuscaSemQuantidade.sugestoes?.length) {
          return this.buildSuggestionMessage(
            orderInfo.productName as string,
            resultadoBuscaSemQuantidade.sugestoes,
            `Nao fechei "${orderInfo.productName}" com seguranca, mas estas opcoes parecem proximas:`,
          );
        }
      }

      if (hasQuantity && orderInfo.quantity !== null) {
        const quantityValidation = this.validateQuantity(orderInfo.quantity);
        if (!quantityValidation.valid) {
          return `❌ ${quantityValidation.error}.\n\n` +
            'Exemplo de pedido valido:\n' +
            '- "quero 6 brigadeiros"\n' +
            '- "1 bolo de chocolate"';
        }
      }
      
      // Se não tem quantidade, perguntar ao usuário
      if (!hasQuantity && hasProduct) {
        return `❓ Quantos *${orderInfo.productName}* você gostaria?\n\n` +
               '💬 Digite a quantidade, por exemplo:\n' +
               '*"5 brigadeiros"* ou *"uma dúzia"*';
      }
      
      // Se não tem produto, mas tem quantidade, perguntar qual produto
      if (hasQuantity && !hasProduct) {
        return `❓ Qual produto você gostaria de ${orderInfo.quantity} unidades?\n\n` +
               '💬 Digite *"cardápio"* para ver nossos produtos disponíveis.';
      }
      
      // Se não tem nem quantidade nem produto
      if (!hasQuantity || !hasProduct) {
        return this.getPremiumOrderNudgeMessage();
      }

      // A partir daqui, temos certeza que quantity e productName não são null
      const quantity = orderInfo.quantity as number;
      const productName = orderInfo.productName as string;

      // Buscar produto (sem paginação para WhatsApp - retorna array)
      const produtosResult = await this.productsService.findAll(tenantId);
      const produtos = Array.isArray(produtosResult) ? produtosResult : produtosResult.data;
      const resultadoBusca = this.findProductByName(produtos, productName);
      
      this.logger.debug(`Product search: found=${!!resultadoBusca.produto}, searched="${productName}", suggestions=${resultadoBusca.sugestoes?.length || 0}`);

      if (!resultadoBusca.produto && resultadoBusca.sugestoes?.length) {
        await this.rememberConversationIntelligence(conversation, {
          last_intent: 'suggestion',
          last_product_name: null,
          last_product_names: resultadoBusca.sugestoes.map((product) => product.name),
          last_quantity: quantity,
          last_query: productName,
        });
        return this.buildSuggestionMessage(
          productName,
          resultadoBusca.sugestoes,
          `Nao encontrei exatamente "${productName}" com seguranca, mas estas sao as opcoes mais proximas que eu achei:`,
        );
      }

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
          await this.rememberConversationIntelligence(conversation, {
            last_intent: 'suggestion',
            last_product_name: null,
            last_product_names: resultadoBusca.sugestoes.map((product) => product.name),
            last_quantity: quantity,
            last_query: productName,
          });
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
        const produtosSimilares = this.findSmartSimilarProducts(produtos, productName);
        
        if (produtosSimilares.length > 0) {
          let mensagem = `❓ Não encontrei "${productName}". Você quis dizer:\n\n`;
          await this.rememberConversationIntelligence(conversation, {
            last_intent: 'suggestion',
            last_product_name: null,
            last_product_names: produtosSimilares.map((product) => product.name),
            last_quantity: quantity,
            last_query: productName,
          });
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
        return [
          'No momento esse item ficou sem estoque.',
          '',
          `Produto: *${produto.name}*`,
          `Quantidade pedida: ${quantity} unidade(s)`,
          'Disponivel agora: 0 unidade(s)',
          '',
          'Se quiser, eu posso te mostrar o cardapio para escolher outra opcao.',
        ].join('\n');
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

      return [
        'Estoque insuficiente neste momento.',
        '',
        `Produto: *${produto.name}*`,
        `Quantidade pedida: ${quantity} unidade(s)`,
        `Disponivel agora: ${produto.available_stock} unidade(s)`,
        '',
        `Posso ajustar para *${produto.available_stock}* unidade(s)?`,
        `Responda *"sim"* para confirmar ou envie outra quantidade de 1 a ${produto.available_stock}.`,
      ].join('\n');
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

    return await this.applyPendingOrderAndProceedPremium(pendingOrder, tenantId, conversation);
  }

  private extractOrderInfo(message: string): { quantity: number | null; productName: string | null } {
    const lowerMessage = this.normalizeForSearch(message);
    
    // ============================================
    // ETAPA 1: EXTRAIR QUANTIDADE (múltiplas formas)
    // ============================================
    let quantity: number | null = null;
    const hasExplicitNegative = /(^|\s)-\d+/.test(lowerMessage);
    
    // 1.1. Expressões de quantidade PRIMEIRO (dúzia, meia dúzia, quilo, etc.)
    // IMPORTANTE: Verificar ANTES de números por extenso para evitar conflitos
    if (lowerMessage.includes('meia duzia') || lowerMessage.includes('meia dúzia') || lowerMessage.includes('meia dz')) {
      quantity = 6;
    } else if (lowerMessage.includes('duzia') || lowerMessage.includes('dúzia')) {
      // Verificar se tem número antes de "dúzia" (duas dúzias, três dúzias, etc.)
      const duziaMatch = lowerMessage.match(/(\d+)\s*(duzia|dúzia|dz)/);
      if (duziaMatch) {
        quantity = parseInt(duziaMatch[1]) * 12;
      } else if (lowerMessage.includes('uma duzia') || lowerMessage.includes('uma dúzia') || lowerMessage.includes('uma dz')) {
        quantity = 12;
      } else if (lowerMessage.includes('duas duzias') || lowerMessage.includes('duas dúzias') || lowerMessage.includes('duas dz')) {
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
      const quantityMatch = lowerMessage.match(/-?\d+/);
      if (quantityMatch) {
        quantity = parseInt(quantityMatch[0]);
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

    // Remover vícios de fala, interjeições e xingamentos no começo para não poluir o produto
    productName = productName.replace(
      /^((ai|ei|hey|opa|oie?|oh|mano|amigo|amiga|moca|moça|porra|caralho|caraio|cacete|merda|lixo|idiota)\s+)+/i,
      '',
    );
    productName = productName.replace(
      /^((oi+|ola+|bom dia|boa tarde|boa noite|entao|tipo|assim|queria ver se tem como|queria ver se|eu queria|deixa eu ver|deixa eu|sera que tem como|sera que da pra|ve se tem como|ve se|consegue separar pra mim|consegue separar|consegue|voce consegue|voces conseguem|pode separar pra mim|pode separar)\s+)+/i,
      '',
    );

    // Lista completa de palavras/frases de ação
    const acoes = [
      'quero', 'preciso', 'comprar', 'pedir', 'vou querer', 'gostaria de',
      'desejo', 'vou comprar', 'preciso de', 'queria', 'ia querer',
      'me manda', 'manda', 'manda ai', 'manda pra mim', 'me ve', 'separa', 'separa pra mim',
      'separar', 'separar pra mim', 'separar para mim',
      'pode ser', 'faz', 'me faz', 'faz pra mim', 'bota', 'coloca', 'traz', 'traz pra mim',
      'pode me enviar', 'tem como', 'dá pra', 'dá pra fazer', 'dá pra me enviar',
      'seria possível', 'poderia', 'pode me mandar', 'me envia', 'envia',
      'vou pedir', 'vou comprar', 'quero comprar', 'preciso comprar', 'quero levar', 'quero pegar',
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
    productName = productName.replace(/\b(dz|duzia|dúzia|meia duzia|meia dúzia|meia dz|quilo|kg|kilo|gramas?|g)\b/gi, '');
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
    productName = productName.replace(/\b(para|pra|pro|pras|pros|com|sem|em|na|no|nas|nos)\b/gi, '');
    productName = productName.replace(/\b(pix|cartao|cartão|credito|crédito|debito|débito|dinheiro|boleto|retirada|retirar|entrega|entregar|buscar|pegar|agora|hoje|amanha|amanhã|rapidinho|urgente|favor|ai|ta)\b/gi, '');
    
    productName = productName.replace(/\b(viagem|delivery)\b/gi, '');

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

    const meaninglessNames = new Set([
      'quero',
      'pedido',
      'pedir',
      'comprar',
      'produto',
      'produtos',
      'algo',
      'alguma coisa',
      'coisa',
    ]);

    if (meaninglessNames.has(productName)) {
      productName = '';
    }

    if (hasExplicitNegative && typeof quantity === 'number' && quantity > 0) {
      quantity = -quantity;
    }
    
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
      return this.normalizeCatalogSearchText(str);
    };

    const pickBestProduct = (
      candidates: ProductWithStock[],
      queryNormalized?: string,
    ): ProductWithStock | null => {
      if (!candidates.length) return null;

      return candidates.reduce((best, current) => {
        const bestStock = Number(best.available_stock || 0);
        const currentStock = Number(current.available_stock || 0);
        const bestInStock = bestStock > 0;
        const currentInStock = currentStock > 0;
        const bestCategoryMatch = !!(
          queryNormalized &&
          best.categoria?.name &&
          queryNormalized.includes(normalize(best.categoria.name))
        );
        const currentCategoryMatch = !!(
          queryNormalized &&
          current.categoria?.name &&
          queryNormalized.includes(normalize(current.categoria.name))
        );

        if (bestInStock !== currentInStock) {
          return currentInStock ? current : best;
        }

        if (bestCategoryMatch !== currentCategoryMatch) {
          return currentCategoryMatch ? current : best;
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
    const skuMatches = produtos.filter(
      (p) => p.sku && normalize(p.sku).trim() === queryNormalized,
    );
    const skuMatch = pickBestProduct(skuMatches, queryNormalized);
    if (skuMatch) {
      return { produto: skuMatch };
    }

    const exactMatches = produtos.filter((p) => normalize(p.name).trim() === queryNormalized);
    const exact = pickBestProduct(exactMatches, queryNormalized);
    if (exact) {
      return { produto: exact };
    }

    // 2) Fallback: tokenizacao (mantem tokens numericos mesmo com 1 char)
    const stopWords = new Set(['de', 'do', 'da', 'dos', 'das', 'com', 'sem', 'pra', 'para', 'o', 'a', 'os', 'as', 'um', 'uma']);
    const palavras = productName
      .toLowerCase()
      .split(/\s+/)
      .filter((p) => (p.length >= 2 || /^\d+$/.test(p)) && !stopWords.has(normalize(p)));

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
      queryNormalized,
    );

    // Estrategia 2: Buscar por nome completo (query completa)
    if (!produto) {
      const queryCompleta = palavras.join(' ');
      produto = pickBestProduct(
        produtos.filter((p) => {
          const nomeNormalizado = normalize(p.name);
          return nomeNormalizado.includes(normalize(queryCompleta));
        }),
        queryNormalized,
      );
    }

    // Estrategia 3: Buscar por qualquer palavra (se nao encontrou)
    if (!produto && palavras.length === 1) {
      produto = pickBestProduct(
        produtos.filter((p) => {
          const nomeNormalizado = normalize(p.name);
          return palavras.some((palavra) => {
            const palavraNormalizada = normalize(palavra);
            return nomeNormalizado.includes(palavraNormalizada);
          });
        }),
        queryNormalized,
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
        queryNormalized,
      );
    }

    if (!produto && queryNormalized.length >= 5) {
      const prefixMatches = produtos.filter((p) => {
        const normalizedName = normalize(p.name);
        const tokens = normalizedName
          .split(/\s+/)
          .filter((token) => token.length >= 3 && !stopWords.has(token));

        return (
          normalizedName.startsWith(queryNormalized) ||
          tokens.some((token) => token.startsWith(queryNormalized))
        );
      });

      if (prefixMatches.length === 1) {
        produto = prefixMatches[0];
      } else if (prefixMatches.length > 1 && palavras.length === 1) {
        return {
          produto: null,
          sugestoes: prefixMatches.slice(0, 5),
        };
      }
    }

    // Estrategia 5: Busca por similaridade (erros de digitacao comuns)
    if (!produto) {
      const allowDirectFuzzyMatch =
        queryNormalized.length >= 7 || palavras.length >= 2;

      if (allowDirectFuzzyMatch) {
        const strongFuzzyMatches = produtos
          .map((product) => {
            const normalizedName = normalize(product.name);
            const tokens = normalizedName
              .split(/\s+/)
              .filter((token) => token.length >= 3 && !stopWords.has(token));
            const fullScore = this.calculateSimilarity(queryNormalized, normalizedName);
            const tokenScore = tokens.reduce((best, token) => {
              return Math.max(best, this.calculateSimilarity(queryNormalized, token));
            }, 0);

            return {
              product,
              score: Math.max(fullScore, tokenScore),
            };
          })
          .filter((item) => item.score >= 0.78)
          .sort((left, right) => right.score - left.score);

        const best = strongFuzzyMatches[0];
        const second = strongFuzzyMatches[1];
        if (best && (!second || best.score - second.score >= 0.08)) {
          produto = best.product;
        }
      }
    }

    // Estrategia 6: Busca por similaridade (erros de digitacao comuns)
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
            queryNormalized,
          );
          if (produto) break;
        }
      }
    }

    const broadMatches = produtos.filter((product) => {
      return normalize(product.name).includes(queryNormalized);
    });
    const ambiguousSingleWordQuery =
      palavras.length === 1 &&
      queryNormalized.length < 8 &&
      broadMatches.length > 1;

    if (produto && !this.isConfidentProductMatch(productName, produto)) {
      produto = null;
    }

    if (produto && ambiguousSingleWordQuery) {
      return {
        produto: null,
        sugestoes: broadMatches.slice(0, 5),
      };
    }

    // Se encontrou produto, retornar
    if (produto) {
      return { produto };
    }

    // Se nao encontrou, buscar produtos similares (para sugestoes)
    const sugestoes = this.findSmartSimilarProducts(produtos, productName);

    return { produto: null, sugestoes: sugestoes.length > 0 ? sugestoes : undefined };
  }

  private findSimilarProducts(produtos: ProductWithStock[], productName: string, maxResults: number = 5): ProductWithStock[] {
    if (!productName || productName.length < 2) return [];

    const normalize = (str: string) => {
      return this.normalizeCatalogSearchText(str);
    };

    const queryNormalized = normalize(productName);
    const stopWords = new Set(['de', 'do', 'da', 'dos', 'das', 'com', 'sem', 'pra', 'para', 'o', 'a', 'os', 'as', 'um', 'uma']);
    const palavras = queryNormalized
      .split(/\s+/)
      .filter((p) => p.length >= 2 && !stopWords.has(p));
    
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

  private findSmartSimilarProducts(
    produtos: ProductWithStock[],
    productName: string,
    maxResults: number = 5,
  ): ProductWithStock[] {
    if (!productName || productName.length < 2) {
      return [];
    }

    const normalize = (value: string) => this.normalizeCatalogSearchText(value);
    const stopWords = new Set([
      'de',
      'do',
      'da',
      'dos',
      'das',
      'com',
      'sem',
      'pra',
      'para',
      'o',
      'a',
      'os',
      'as',
      'um',
      'uma',
    ]);

    const queryNormalized = normalize(productName);
    const queryWords = queryNormalized
      .split(/\s+/)
      .filter((word) => word.length >= 2 && !stopWords.has(word));

    if (!queryWords.length) {
      return [];
    }

    return this.dedupeProducts(
      produtos
        .map((product) => {
          const normalizedName = normalize(product.name);
          const normalizedCategory = normalize(product.categoria?.name || '');
          const searchDocument = normalize(this.buildProductSalesDocument(product));
          const tokenPool = [...normalizedName.split(/\s+/), ...normalizedCategory.split(/\s+/)].filter(Boolean);

          let score = 0;
          if (normalizedName === queryNormalized) {
            score += 90;
          } else if (normalizedName.includes(queryNormalized)) {
            score += 34;
          } else if (searchDocument.includes(queryNormalized)) {
            score += 18;
          }

          queryWords.forEach((word) => {
            if (normalizedName.includes(word)) {
              score += 14;
            } else if (normalizedCategory.includes(word)) {
              score += 10;
            } else if (searchDocument.includes(word)) {
              score += 6;
            }

            const tokenSimilarity = tokenPool.reduce((best, token) => {
              return Math.max(best, this.calculateSimilarity(word, token));
            }, 0);

            if (tokenSimilarity >= 0.82) {
              score += 7;
            } else if (tokenSimilarity >= 0.72) {
              score += 4;
            }
          });

          const wholeSimilarity = Math.max(
            this.calculateSimilarity(queryNormalized, normalizedName),
            this.calculateSimilarity(queryNormalized, normalizedCategory),
          );
          score += wholeSimilarity * 12;

          if (queryWords.length >= 2 && queryWords.every((word) => searchDocument.includes(word))) {
            score += 12;
          }

          if (Number(product.available_stock || 0) > 0) {
            score += 1;
          }

          return { product, score };
        })
        .filter((item) => item.score >= 10)
        .sort((left, right) => right.score - left.score)
        .slice(0, maxResults)
        .map((item) => item.product),
    );
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const left = this.normalizeCatalogSearchText(str1);
    const right = this.normalizeCatalogSearchText(str2);

    if (!left || !right) {
      return 0;
    }

    const tokens = right.split(/\s+/).filter(Boolean);
    const candidates = tokens.length ? [right, ...tokens] : [right];

    return candidates.reduce((best, candidate) => {
      const distance = this.calculateLevenshteinDistance(left, candidate);
      const maxLength = Math.max(left.length, candidate.length);
      const similarity = maxLength > 0 ? 1 - distance / maxLength : 0;
      return Math.max(best, similarity);
    }, 0);
  }

  private calculateLevenshteinDistance(left: string, right: string): number {
    if (left === right) {
      return 0;
    }

    if (!left.length) {
      return right.length;
    }

    if (!right.length) {
      return left.length;
    }

    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

    for (let row = 1; row <= left.length; row += 1) {
      let diagonal = previous[0];
      previous[0] = row;

      for (let column = 1; column <= right.length; column += 1) {
        const current = previous[column];
        const cost = left[row - 1] === right[column - 1] ? 0 : 1;
        previous[column] = Math.min(
          previous[column] + 1,
          previous[column - 1] + 1,
          diagonal + cost,
        );
        diagonal = current;
      }
    }

    return previous[right.length];
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

  private resolvePaymentMethodSelection(message: string): MetodoPagamento | null {
    const normalized = this.normalizeIntentText(message);
    if (!normalized) {
      return null;
    }

    const extractedOrder = this.extractOrderInfo(normalized);
    if (
      this.looksLikeMultiItemOrder(normalized) ||
      (extractedOrder.quantity !== null && !!extractedOrder.productName)
    ) {
      return null;
    }

    if (/^[1-4]$/.test(normalized)) {
      return (
        {
          '1': MetodoPagamento.PIX,
          '2': MetodoPagamento.DINHEIRO,
          '3': MetodoPagamento.DEBITO,
          '4': MetodoPagamento.DINHEIRO,
        } as Record<string, MetodoPagamento>
      )[normalized];
    }

    const reduced = normalized
      .replace(/\b(quero pagar|pagar|pagamento|pago|prefiro|pode ser|vai ser|seria|por favor|pfv|pf|agora|via|no|na|em)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (['pix'].includes(reduced)) return MetodoPagamento.PIX;
    if (['cartao credito', 'credito', 'cartao de credito'].includes(reduced)) return MetodoPagamento.CREDITO;
    if (['cartao debito', 'debito', 'cartao de debito'].includes(reduced)) return MetodoPagamento.DEBITO;
    if (['dinheiro'].includes(reduced)) return MetodoPagamento.DINHEIRO;
    if (['boleto'].includes(reduced)) return MetodoPagamento.BOLETO;

    return null;
  }

  /**
   * Verifica se a mensagem é uma seleção de método de pagamento
   */
  private isPaymentMethodSelection(message: string): boolean {
    return this.resolvePaymentMethodSelection(message) !== null;
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
      const metodo = this.resolvePaymentMethodSelection(message);

      if (!metodo) {
        return '❌ Método de pagamento não reconhecido.\n\n' +
               '💬 Digite:\n' +
               '*1* ou *PIX*\n' +
               '*2* ou *Dinheiro*';
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

      if (!pedidoPendente) {
        return '❌ Pedido não está pendente de pagamento.\n\n' +
               '💬 Faça um pedido primeiro digitando: "Quero X [produto]"';
      }

      if (pedidoPendente.status !== PedidoStatus.PENDENTE_PAGAMENTO) {
        return this.buildPaymentStageGuardMessage(pedidoPendente);
      }

      if ([MetodoPagamento.CREDITO, MetodoPagamento.DEBITO].includes(metodo)) {
        return this.getPremiumCardPaymentFallbackMessage();
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
        return this.enrichPaymentMessage(
          paymentResult.message || 'Pagamento Pix processado',
          pedidoPendente,
          metodo,
        );
      }

      return this.enrichPaymentMessage(
        paymentResult.message || 'Pagamento processado com sucesso!',
        pedidoPendente,
        metodo,
      );
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
        '*1* PIX\n*2* Dinheiro';
    }

    const pedidoId = conversation.pedido_id || conversation.context?.pedido_id;
    if (!pedidoId) {
      await this.conversationService.updateState(conversation.id, 'waiting_payment');
      return '❌ Não encontrei um pedido pendente para pagamento.\n\n' +
        '💬 Faça um pedido primeiro digitando: "Quero X [produto]"';
    }

    const pedidoPendente = await this.ordersService.findOne(pedidoId, tenantId);
    if (!pedidoPendente) {
      await this.conversationService.updateState(conversation.id, 'waiting_payment');
      return '❌ Pedido não está pendente de pagamento.\n\n' +
        '💬 Faça um pedido primeiro digitando: "Quero X [produto]"';
    }

    if (pedidoPendente.status !== PedidoStatus.PENDENTE_PAGAMENTO) {
      await this.conversationService.updateState(conversation.id, 'waiting_payment');
      return this.buildPaymentStageGuardMessage(pedidoPendente);
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

      const maxReasonableChangeFor = Math.max(totalAmount * 5, 500);
      if (parsed > maxReasonableChangeFor) {
        return [
          'Esse valor para troco ficou alto demais para eu assumir com seguranca por aqui.',
          `Total do pedido: R$ ${this.formatCurrency(totalAmount)}`,
          '',
          'Me diga um valor mais proximo do que voce realmente vai pagar.',
          'Exemplos: "50", "100" ou "sem".',
        ].join('\n');
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
        this.enrichPaymentMessage(
          paymentResult.message || 'Pagamento processado com sucesso!',
          pedidoPendente,
          MetodoPagamento.DINHEIRO,
        ) +
        `\n\n💵 Troco para: R$ ${this.formatCurrency(changeFor)}` +
        `\n🧾 Troco: R$ ${this.formatCurrency(changeAmount)}`
      );
    }

    return this.enrichPaymentMessage(
      paymentResult.message || 'Pagamento processado com sucesso!',
      pedidoPendente,
      MetodoPagamento.DINHEIRO,
    ) +
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
      return 'Pedido interrompido.\n\nQuando quiser, eu monto outro pedido com voce.';
    }

    let chosenQty: number | null = null;

    if (lowerMessage.includes('sim') || lowerMessage.includes('confirmar') || lowerMessage === 'ok') {
      chosenQty = adjustment.available_qty;
    } else if (/^\d+$/.test(lowerMessage)) {
      chosenQty = Number(lowerMessage);
    }

    if (!chosenQty || chosenQty <= 0 || chosenQty > adjustment.available_qty) {
      return [
        'Quantidade invalida.',
        '',
        `Disponivel agora: ${adjustment.available_qty} unidade(s).`,
        `Envie um numero de 1 a ${adjustment.available_qty} ou responda *"cancelar"*.`,
      ].join('\n');
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
    return await this.applyPendingOrderAndProceedPremium(pendingOrder, tenantId, conversation);
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
        return this.getPremiumPhonePrompt();
      }
      await this.conversationService.updateState(conversation.id, 'collecting_notes');
      return this.getPremiumNotesPrompt();
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
      return this.getPremiumPhonePrompt();
    }

    await this.conversationService.updateState(conversation.id, 'collecting_notes');
    return this.getPremiumNotesPrompt();
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
    const complementKeywords = new Set([
      'apto',
      'apartamento',
      'bloco',
      'bl',
      'casa',
      'fundos',
      'sala',
      'sl',
      'cj',
      'conjunto',
      'loja',
      'andar',
      'cobertura',
      'cob',
      'quadra',
      'qd',
      'lote',
      'lt',
    ]);

    let state = '';
    if (parts.length > 0) {
      const last = parts[parts.length - 1];
      const detectedState = this.extractStateCodeFromText(last);
      if (detectedState) {
        state = detectedState;
        const normalizedLast = this.normalizeIntentText(last);
        const stateName = Object.entries(this.BRAZIL_STATE_NAME_TO_CODE).find(
          ([name, code]) => code === detectedState && normalizedLast.includes(name),
        )?.[0];
        const strippedLast = last
          .replace(new RegExp(`\\b${detectedState}\\b`, 'i'), ' ')
          .replace(/[.,-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (!strippedLast || strippedLast === last || (stateName && this.normalizeIntentText(strippedLast) === stateName)) {
          parts.pop();
        } else {
          parts[parts.length - 1] = strippedLast;
        }
      }
    }

    if (parts.length === 4 && complementKeywords.has(this.normalizeIntentText(parts[2]))) {
      return null;
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
    const normalizedMessage = this.normalizeIntentText(sanitizedMessage);
    const phone = sanitizedMessage.replace(/\D/g, ''); // Remove tudo que não é dígito

    if (
      !phone &&
      this.hasAnyNormalizedPhrase(normalizedMessage, [
        'telefone',
        'numero',
        'celular',
        'fixo',
        'whatsapp',
        'zap',
      ])
    ) {
      return [
        'Pode ser celular ou telefone fixo, sem problema.',
        '',
        'Eu so preciso do numero com DDD para a equipe conseguir te atualizar se necessario.',
        'Exemplo: 11987654321',
      ].join('\n');
    }
    
    const phoneValidation = this.validatePhone(phone);
    if (!phoneValidation.valid) {
      return [
        'Ainda nao consegui fechar o telefone com seguranca.',
        phoneValidation.error || 'Telefone invalido.',
        '',
        'Pode ser celular ou telefone fixo, mas preciso do numero com DDD.',
        'Exemplo: (11) 98765-4321 ou 11987654321',
      ].join('\n');
    }

    // Formatar telefone
    const formattedPhone = `+55${phone}`;

    // Salvar telefone
    await this.conversationService.saveCustomerData(conversation.id, { phone: formattedPhone });

    await this.conversationService.updateState(conversation.id, 'collecting_notes');
    return this.getPremiumNotesPrompt();
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
        return this.getPremiumPhonePrompt();
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
      return this.getPremiumPhonePrompt();
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

      return this.buildOrderCreatedMessage(pedido);
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

  async sendOutboundResponse(
    to: string,
    response: WhatsappOutboundResponse,
  ): Promise<void> {
    if (this.isInteractiveListResponse(response)) {
      await this.notificationsService.sendWhatsAppMessage({
        to,
        message: response.previewText,
        interactiveList: {
          title: response.list.title,
          description: response.list.description,
          buttonText: response.list.buttonText,
          footerText: response.list.footerText,
          sections: response.list.sections.map((section) => ({
            title: section.title,
            rows: section.rows.map((row) => ({
              id: row.id,
              title: row.title,
              description: row.description,
            })),
          })),
        },
        metadata: {
          source: 'whatsapp_service',
          interactiveType: 'list',
        },
      });
      return;
    }

    await this.sendMessage(to, response);
  }
}
