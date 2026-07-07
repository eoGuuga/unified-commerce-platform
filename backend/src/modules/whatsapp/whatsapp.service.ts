import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantsService } from '../tenants/tenants.service';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CouponsService } from '../coupons/coupons.service';
import { AvailabilityService } from '../availability/availability.service';
import { DbContextService } from '../common/services/db-context.service';
import { CanalVenda, Pedido } from '../../database/entities/Pedido.entity';

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
import { InteractiveMessageService } from './services/interactive-message.service';

// Providers de envio (WhatsApp real)
import { EvolutionApiProvider } from './providers/evolution-api.provider';
import { MockWhatsappProvider } from './providers/mock-whatsapp.provider';
import { IWhatsappProvider } from './providers/whatsapp-provider.interface';
import { WhatsappSender } from './config/whatsapp-sender.service';

import { TypedConversation, ConversationState, CustomerData, PendingOrder } from './types/whatsapp.types';
import { MetodoPagamento } from '../../database/entities/Pagamento.entity';
import { BusinessHours, describeBusinessHours } from './utils/business-hours';

export type WhatsAppOutboundResponse =
  | string
  | { kind: 'interactive_list'; previewText: string; list: any }
  | { kind: 'interactive_with_buttons'; previewText: string; cartContent: string; buttons: Array<{ id: string; title: string }> }
  | { kind: 'interactive_order'; previewText: string; orderId: string; items: string; subtotal: number; shipping: number; total: number; buttons: Array<{ id: string; title: string }> }
  | { kind: 'interactive_product'; previewText: string; product: any; buttons: Array<{ id: string; title: string }> }
  | { kind: 'interactive_welcome'; previewText: string; greeting: string; message: string; options: Array<{ id: string; title: string }> };

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

/** Endereco de entrega montado a partir da coleta (campos do delivery_address). */
interface DeliveryAddressParts {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
}

/** Estagios da FSM de checkout (S2a entrega + S2b retirada). */
type CheckoutStage =
  | 'ask_fulfillment'
  | 'collecting_name'
  | 'collecting_phone'
  | 'collecting_address'
  | 'confirming_address'
  | 'selecting_pickup_slot';

/**
 * Slot de retirada oferecido ao cliente. label e amigavel em PT (fuso da loja),
 * scheduled_at e o instante (ISO) correspondente. Guardado no checkout para mapear
 * a escolha numerica do cliente de volta ao instante.
 */
interface PickupSlot {
  label: string;
  scheduled_at: string; // ISO
}

/**
 * Estado da coleta de checkout, guardado em conversation.context.checkout.
 * INVARIANTE (D2): so com stage 'confirming_address' + confirmacao o pedido nasce.
 */
interface CheckoutContext {
  stage: CheckoutStage;
  delivery_type?: 'delivery' | 'pickup';
  customer_name?: string;
  customer_phone?: string; // telefone do contato (numero do WhatsApp)
  contact_phone?: string; // telefone informado pelo cliente na coleta
  delivery_address?: DeliveryAddressParts;
  scheduled_at?: string; // horario de retirada agendado (ISO), so para pickup
  pickup_slots?: PickupSlot[]; // opcoes de retirada oferecidas ao cliente (pickup)
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
    private readonly interactiveMessages: InteractiveMessageService,
    private readonly db: DbContextService,

    // Providers de envio
    private readonly evolutionProvider: EvolutionApiProvider,
    private readonly mockProvider: MockWhatsappProvider,

    // Envio tenant-aware (R2): resolve provider/credencial por tenant
    private readonly whatsappSender: WhatsappSender,

    // Camada 2: exceçoes por-data (gate da retirada). Importado do AvailabilityModule
    // (unidirecional — availability NAO importa whatsapp, sem ciclo).
    private readonly availabilityService: AvailabilityService,
  ) {}

  /**
   * Seleciona o provider de envio de mensagens.
   * Usa Evolution API quando configurada (WHATSAPP_PROVIDER=evolution e credenciais presentes);
   * caso contrario cai no MockProvider (apenas registra, nao envia de verdade).
   * Fail-safe: nunca lanca — se a Evolution nao estiver pronta, degrada para mock.
   */
  private getOutboundProvider(): IWhatsappProvider {
    const providerName = (this.config.get<string>('WHATSAPP_PROVIDER') || '').toLowerCase();
    if (providerName === 'evolution' && this.evolutionProvider.isConfigured()) {
      return this.evolutionProvider;
    }
    return this.mockProvider;
  }

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

      // 5.1 ANTES de tudo: verificar timeout de conversa (5 minutos de inatividade)
      const TIMEOUT_MINUTES = 5;
      const conversationRepo = (this.conversationService as any)['db'].getRepository('WhatsappConversation');
      let conversationForTimeout = await conversationRepo.findOne({
        where: {
          tenant_id: message.tenantId,
          customer_phone: message.from,
          status: 'active',
        },
        order: { last_message_at: 'DESC' },
      });

      if (conversationForTimeout) {
        const lastMessageTime = conversationForTimeout.last_message_at;
        const currentState = conversationForTimeout.context?.state;
        const minutesSinceLastMessage = lastMessageTime
          ? (new Date().getTime() - new Date(lastMessageTime).getTime()) / (1000 * 60)
          : 999;

        if (minutesSinceLastMessage > TIMEOUT_MINUTES && currentState && currentState !== 'idle') {
          // Conversa expirou - reiniciar com mensagem amigável
          await this.conversationService.updateContext(conversationForTimeout.id, {
            state: 'idle',
            customer_data: conversationForTimeout.context?.customer_data,
          });

          return [
            '👋 *Que bom que você voltou!*',
            '',
            'Parece que faz um tempinho... Mas estamos aqui para ajudar! 😊',
            '',
            'O que você gostaria de fazer?',
            '',
            '• "ver produtos" - ver o cardápio',
            '• "carrinho" - ver seu carrinho',
            '• Ou me diga o que precisa!',
          ].join('\n');
        }
      }

      // 6. Obter ou criar conversa (agora sem conflitar com timeout)
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
   * Suporta mensagens de texto, botões interativos e listas
   */
  async sendOutboundResponse(
    to: string,
    response: WhatsAppOutboundResponse,
    tenantId?: string,
  ): Promise<void> {
    try {
      const { body, buttons } = this.flattenOutboundResponse(response);

      if (!body.trim()) {
        return;
      }

      // R2: com tenantId, envia pelo canal DO TENANT (provider/credencial proprios).
      // O WhatsappSender resolve a config e ja degrada interativo -> texto internamente.
      if (tenantId) {
        if (buttons.length > 0) {
          await this.whatsappSender.sendButtons(tenantId, to, body, buttons);
        } else {
          await this.whatsappSender.sendText(tenantId, to, body);
        }
        return;
      }

      // Fallback legado (sem tenantId): provider global. Mantido para compatibilidade.
      const provider = this.getOutboundProvider();
      if (buttons.length > 0) {
        try {
          await provider.sendInteractiveButtons({ to, body, buttons });
          return;
        } catch (interactiveError) {
          this.logger.warn('Falha ao enviar interativo, degradando para texto', {
            to,
            error: interactiveError instanceof Error ? interactiveError.message : interactiveError,
          });
        }
      }
      await provider.sendMessage({ to, body });
    } catch (error) {
      this.logger.error('Failed to send outbound response', {
        error: error instanceof Error ? error.message : error,
        to,
      });
    }
  }

  /**
   * Converte qualquer tipo de WhatsAppOutboundResponse em { body, buttons } enviavel.
   * Para tipos interativos, monta o corpo textual completo (preview + conteudo) para que,
   * mesmo sem suporte a botoes, o cliente receba a informacao toda em texto.
   */
  private flattenOutboundResponse(
    response: WhatsAppOutboundResponse,
  ): { body: string; buttons: Array<{ id: string; title: string }> } {
    if (typeof response === 'string') {
      return { body: response, buttons: [] };
    }

    switch (response.kind) {
      case 'interactive_with_buttons':
        return {
          body: response.cartContent || response.previewText,
          buttons: response.buttons || [],
        };

      case 'interactive_order': {
        const lines = [
          response.previewText,
          response.items,
          '',
          `Subtotal: R$ ${response.subtotal.toFixed(2)}`,
          `Frete: R$ ${response.shipping.toFixed(2)}`,
          `Total: R$ ${response.total.toFixed(2)}`,
        ].filter((l) => l !== undefined && l !== null);
        return { body: lines.join('\n'), buttons: response.buttons || [] };
      }

      case 'interactive_product':
        return {
          body: response.previewText,
          buttons: response.buttons || [],
        };

      case 'interactive_welcome': {
        const lines = [response.greeting, response.message].filter(Boolean);
        return { body: lines.join('\n\n') || response.previewText, buttons: response.options || [] };
      }

      case 'interactive_list': {
        // Lista textual: cabecalho + itens de cada secao (botoes nativos de lista nao suportados aqui)
        const sections = response.list?.sections || [];
        const sectionLines: string[] = [];
        for (const section of sections) {
          if (section?.title) sectionLines.push(`*${section.title}*`);
          for (const row of section?.rows || []) {
            const desc = row?.description ? ` - ${row.description}` : '';
            sectionLines.push(`• ${row?.title || ''}${desc}`);
          }
        }
        const body = [response.previewText, '', ...sectionLines].join('\n').trim();
        return { body, buttons: [] };
      }

      default:
        return { body: (response as any).previewText || '', buttons: [] };
    }
  }

  // ============== INTENT DETECTION ==============

  private detectIntent(
    message: string,
    conversation: TypedConversation,
  ): 'greeting' | 'catalog' | 'cart' | 'order_status' | 'order_adjust' | 'payment' | 'help' | 'collection' | 'fallback' {
    const lower = message.toLowerCase().trim();
    const currentState = conversation.context?.state as ConversationState | undefined;

    // PRECEDENCIA DA FSM DE CHECKOUT (S2a): se ha um checkout ativo (context.checkout.stage
    // setado), a mensagem do cliente pertence a coleta e DEVE ir para handleCollectionStage
    // (-> handleCheckoutStage), nao para os handlers de palavra-chave. Sem isso, respostas
    // que o proprio bot pede — "entrega" (casaria isOrderStatusIntent) ou "confirmar"
    // (casaria isCartCommand) — sequestrariam o fluxo e prenderiam/resetariam a FSM.
    // O escape explicito ("cancelar"/"sair") e tratado DENTRO da FSM (handleCheckoutStage),
    // que limpa o context.checkout de forma limpa antes de qualquer outra coisa.
    const activeCheckout = conversation.context?.checkout as CheckoutContext | undefined;
    if (activeCheckout?.stage) {
      return 'collection';
    }

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
      return this.handleCheckout(tenantId, customerPhone, conversation);
    }

    // Verificar intenção de remover item
    if (lower.includes('remover') || lower.includes('tirar') || lower.includes('excluir')) {
      const productName = lower
        .replace(/remover\s*/gi, '')
        .replace(/tirar\s*/gi, '')
        .replace(/excluir\s*/gi, '')
        .trim();

      if (productName) {
        try {
          const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);
          if (cart.items.length === 0) {
            return '🛒 Seu carrinho está vazio!';
          }

          const item = cart.items.find(i =>
            i.produto_name.toLowerCase().includes(productName.toLowerCase())
          );

          if (item) {
            await this.cartService.removeItem(cart.id, item.produto_id);
            return `✅ Removido "${item.produto_name}" do carrinho!`;
          }
          return `😕 Não encontrei "${productName}" no seu carrinho.`;
        } catch (error) {
          this.logger.error('Error removing from cart', { error });
          return '😕 Erro ao remover item. Tente novamente.';
        }
      }
    }

    // Verificar intenção de limpar carrinho
    if (lower.includes('limpar') || lower.includes('esvaziar') || lower === 'clear') {
      try {
        const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);
        if (cart.items.length === 0) {
          return '🛒 Seu carrinho já está vazio!';
        }

        await this.cartService.clearCart(cart.id);
        return '🧹 Carrinho esvaziado! Quer adicionar algo novo?';
      } catch (error) {
        this.logger.error('Error clearing cart', { error });
        return '😕 Erro ao limpar carrinho. Tente novamente.';
      }
    }

    // Verificar intenção de ver preço
    if (lower.includes('quanto') || lower.includes('preço') || lower.includes('valor')) {
      const productName = lower
        .replace(/quanto[cs]?/gi, '')
        .replace(/custa/gi, '')
        .replace(/preço/gi, '')
        .replace(/valor/gi, '')
        .replace(/do[s]?\s*/gi, '')
        .replace(/da[s]?\s*/gi, '')
        .trim();

      if (productName && productName.length > 2) {
        const products = await this.productsService.search(tenantId, productName);
        if (products.length > 0) {
          const product = products[0];
          return `💰 *${product.name}*\n\nPreço: R$ ${Number(product.price).toFixed(2)}\n\nQuer adicionar ao carrinho?`;
        }
      }
    }

    // Verificar intenção de disponibilidade ("tem", "tem disponível")
    if (lower.includes('tem') || lower.includes('disponível') || lower.includes('disponivel')) {
      const productName = lower
        .replace(/tem\s*/gi, '')
        .replace(/dispon[íi]vel/gi, '')
        .replace(/voc[êe]\s*/gi, '')
        .trim();

      if (productName && productName.length > 2) {
        const products = await this.productsService.search(tenantId, productName);
        if (products.length > 0) {
          const product = products[0];
          return `✅ Sim! Temos *${product.name}* disponível por R$ ${Number(product.price).toFixed(2)}!\n\nQuer adicionar ao carrinho?`;
        }
        return `😕 Não encontramos "${productName}" no momento. Que tal ver nosso cardápio?`;
      }
    }

    // Verificar se é intenção de adicionar produto
    const addKeywords = [
      'adicionar', 'colocar', 'add', 'comprar',
      'quero', 'queria', 'preciso', 'me vê', 'me vê',
      'pedir', 'pegar', 'levar', 'bora', 'manda'
    ];
    const isAddIntent = addKeywords.some(k => lower.includes(k));

    if (isAddIntent) {
      try {
        // Extrair nome do produto da mensagem
        let productName = lower
          .replace(/adicionar\s*/gi, '')
          .replace(/colocar\s*/gi, '')
          .replace(/add\s*/gi, '')
          .replace(/comprar\s*/gi, '')
          .replace(/^quero\s*/gi, '')
          .replace(/^queria\s*/gi, '')
          .replace(/^preciso\s*(de\s*)?/gi, '')
          .replace(/me\s+v[êe]\s*/gi, '')
          .replace(/^pedir\s*/gi, '')
          .replace(/^pegar\s*/gi, '')
          .replace(/^levar\s*/gi, '')
          .replace(/^bora\s*(pegar\s*|levar\s*|um\s*)?/gi, '')
          .replace(/^manda\s*(um\s*)?/gi, '')
          .replace(/\bum\s+/gi, '')
          .replace(/^um\s+/gi, '')
          .replace(/^esse\s+/gi, '')
          .replace(/^este\s+/gi, '')
          .replace(/^aquele\s+/gi, '')
          .trim();

        // Se productName está vazio ou muito curto, usar mensagem original limpa
        if (!productName || productName.length < 2) {
          productName = lower
            .replace(/^quero\s*/gi, '')
            .replace(/^queria\s*/gi, '')
            .replace(/^preciso\s*de\s*/gi, '')
            .replace(/^bora\s*/gi, '')
            .replace(/^manda\s*/gi, '')
            .replace(/\bum\s*/gi, '')
            .trim();
        }

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
            return `✅ Adicionado 1x ${product.name} - R$ ${Number(product.price).toFixed(2)} ao seu carrinho!\n\nDigite "carrinho" para ver ou "finalizar" para confirmar.`;
          } else {
            return `😕 Não encontrei "${productName}". Digite "ver produtos" para ver o cardápio!`;
          }
        } else {
        }
      } catch (error) {
        this.logger.error('Error adding product to cart', { error });
      }
    }

    // Se chegou até aqui, chamar handleCartCommand como fallback
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

  /**
   * Inicio do checkout (S2a). NAO cria mais o pedido direto: valida o carrinho
   * e INICIA a coleta de cumprimento, perguntando "Entrega ou retirada?".
   *
   * O estagio fica gravado em conversation.context.checkout.stage. Tambem
   * marcamos context.state como estado de coleta para que o detectIntent roteie
   * as proximas mensagens para handleCollectionStage.
   */
  private async handleCheckout(
    tenantId: string,
    customerPhone: string,
    conversation: TypedConversation,
  ): Promise<WhatsAppOutboundResponse> {
    try {
      const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);

      if (cart.items.length === 0) {
        return '🛒 Seu carrinho está vazio! Adicione itens primeiro.';
      }

      // Inicia a FSM de checkout. Guarda o telefone do contato para usar no pedido.
      const checkout: CheckoutContext = {
        stage: 'ask_fulfillment',
        customer_phone: customerPhone,
      };
      await this.conversationService.updateContext(conversation.id, {
        state: 'collecting_order',
        checkout,
      });
      // Reflete localmente (o objeto em memoria pode ser reutilizado no mesmo turno).
      conversation.context = { ...conversation.context, state: 'collecting_order', checkout };

      return [
        '🧾 *Vamos finalizar seu pedido!*',
        '',
        'Você prefere *entrega* ou *retirada*?',
        '',
        'Responda *entrega* ou *retirada*.',
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

  /**
   * Conduz a FSM de checkout (entrega) a partir do contexto.
   * Estagios: ask_fulfillment -> collecting_name -> collecting_phone ->
   *           collecting_address -> confirming_address -> (cria pedido + PIX).
   *
   * INVARIANTE CRITICA (D2): o pedido SO e criado no estagio confirming_address
   * APOS o cliente responder "sim/confirmar". Qualquer rejeicao volta para
   * collecting_address e NAO cria pedido.
   *
   * Retorna null se a mensagem nao pertence ao fluxo de checkout (deixa o
   * chamador cair na coleta legada).
   */
  private async handleCheckoutStage(
    tenantId: string,
    message: string,
    conversation: TypedConversation,
  ): Promise<WhatsAppOutboundResponse | null> {
    const checkout = conversation.context?.checkout as CheckoutContext | undefined;
    if (!checkout?.stage) {
      return null;
    }

    const text = (message || '').trim();
    const lower = text.toLowerCase();

    // Escape limpo: o cliente pode abandonar a coleta a qualquer estagio com
    // "cancelar"/"sair". Encerra a FSM (state idle, checkout null) sem criar pedido.
    if (lower === 'cancelar' || lower === 'sair' || lower === 'cancela') {
      await this.conversationService.updateContext(conversation.id, {
        state: 'idle',
        checkout: null,
      });
      conversation.context = { ...conversation.context, state: 'idle', checkout: undefined };
      return 'Tudo bem, cancelei a finalização. 🙂 Seus itens continuam no carrinho. É só dizer *finalizar* quando quiser.';
    }

    const persist = async (updates: Partial<CheckoutContext>, extra?: Record<string, any>) => {
      const next: CheckoutContext = { ...checkout, ...updates };
      await this.conversationService.updateContext(conversation.id, { checkout: next, ...(extra || {}) });
      conversation.context = { ...conversation.context, checkout: next, ...(extra || {}) };
      return next;
    };

    switch (checkout.stage) {
      case 'ask_fulfillment': {
        if (lower.includes('retir')) {
          // Branch RETIRADA (S2b). DEFAULT RESTRITIVO: a retirada SO e oferecida se
          // o tenant tem settings.business_hours configurado. Sem isso, NAO adivinhamos
          // um horario padrao — caimos no fallback honesto "so entrega" e encerramos a
          // FSM para nao prender o cliente num estado morto.
          const businessHours = await this.getBusinessHours(tenantId);
          if (!businessHours) {
            await this.conversationService.updateContext(conversation.id, {
              state: 'idle',
              checkout: null,
            });
            conversation.context = { ...conversation.context, state: 'idle', checkout: undefined };
            return 'No momento estamos fazendo só entregas por aqui. 🙏';
          }
          await persist({ stage: 'collecting_name', delivery_type: 'pickup' });
          return 'Perfeito, retirada! 🛍️\n\nQual é o seu *nome*?';
        }
        if (lower.includes('entreg')) {
          await persist({ stage: 'collecting_name', delivery_type: 'delivery' });
          return 'Perfeito, entrega! 🛵\n\nQual é o seu *nome*?';
        }
        return 'Não entendi. Você prefere *entrega* ou *retirada*?';
      }

      case 'collecting_name': {
        await persist({ stage: 'collecting_phone', customer_name: text });
        return 'Obrigado! Qual é o melhor *telefone* para contato?';
      }

      case 'collecting_phone': {
        // O proximo estagio depende do tipo de cumprimento: entrega coleta endereco,
        // retirada coleta o horario de retirada.
        if (checkout.delivery_type === 'pickup') {
          const businessHours = await this.getBusinessHours(tenantId);
          if (!businessHours) {
            // Defesa: business_hours sumiu no meio do fluxo. Encerra honesto.
            await this.conversationService.updateContext(conversation.id, {
              state: 'idle',
              checkout: null,
            });
            conversation.context = { ...conversation.context, state: 'idle', checkout: undefined };
            return 'No momento estamos fazendo só entregas por aqui. 🙏';
          }
          // CAMADA 2: carrega as exceçoes por-data da janela de lookahead e monta a
          // Map (chave = data civil "YYYY-MM-DD" da exceçao). O I/O mora AQUI, no
          // caller; generatePickupSlots continua PURO (recebe a Map por parametro).
          const now = new Date();
          const lookaheadDays = 7;
          const to = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);
          const exceptionRows = await this.availabilityService.findByDateRange(
            tenantId,
            now,
            to,
          );
          const exceptions = new Map<
            string,
            { kind: 'closed' | 'custom_hours'; open?: string | null; close?: string | null }
          >(
            exceptionRows.map((e) => [
              e.date,
              { kind: e.kind, open: e.open, close: e.close },
            ]),
          );
          const slots = this.generatePickupSlots(
            businessHours,
            now,
            { lookaheadDays },
            exceptions,
          );
          if (slots.length === 0) {
            // Sem nenhum horario disponivel em breve: encerra honesto, sem criar pedido.
            await this.conversationService.updateContext(conversation.id, {
              state: 'idle',
              checkout: null,
            });
            conversation.context = { ...conversation.context, state: 'idle', checkout: undefined };
            // CAMADA 2 — A MENSAGEM NAO PODE MENTIR: a lista-vazia tem causas distintas.
            // Se a causa REAL e a exceçao `closed` de HOJE (dayOffset===0, data civil
            // atual no fuso da loja — a MESMA chave zero-padded que o gate usa), damos
            // a mensagem especifica de fechamento. `custom_hours` (que gera slots) e as
            // outras causas ("sem business_hours" / "fora do horario agora") NAO caem
            // aqui: `custom_hours` nao esvazia a lista, e "sem business_hours" ja
            // encerrou antes (~L947/L975).
            const t = this.localDateParts(now, businessHours.tz);
            const hojeKey = `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
            if (exceptions.get(hojeKey)?.kind === 'closed') {
              return 'Hoje a loja está fechada 🙏 Volte em breve!';
            }
            return 'Não há horários disponíveis para retirada em breve. 🙏 Tente novamente mais tarde.';
          }
          const pickupSlots: PickupSlot[] = slots.map((s) => ({
            label: s.label,
            scheduled_at: s.scheduledAt.toISOString(),
          }));
          await persist({
            stage: 'selecting_pickup_slot',
            contact_phone: text,
            pickup_slots: pickupSlots,
          });
          return this.formatPickupSlotsMessage(pickupSlots);
        }
        await persist({ stage: 'collecting_address', contact_phone: text });
        return [
          '📍 Agora me passe o *endereço de entrega* numa mensagem só, neste formato:',
          '',
          '*Rua, número, bairro, cidade, UF, CEP*',
          '',
          'Ex.: Rua das Flores, 123, Centro, São Paulo, SP, 01001-000',
        ].join('\n');
      }

      case 'selecting_pickup_slot': {
        const businessHours = await this.getBusinessHours(tenantId);
        if (!businessHours) {
          // Defesa: business_hours sumiu no meio do fluxo. Encerra honesto.
          await this.conversationService.updateContext(conversation.id, {
            state: 'idle',
            checkout: null,
          });
          conversation.context = { ...conversation.context, state: 'idle', checkout: undefined };
          return 'No momento estamos fazendo só entregas por aqui. 🙏';
        }

        const slots = checkout.pickup_slots || [];
        // O cliente responde o NUMERO da opcao. Sem parsing de linguagem natural.
        const choice = Number.parseInt(text, 10);
        const isValidChoice =
          /^\d+$/.test(text) && choice >= 1 && choice <= slots.length;
        if (!isValidChoice) {
          // Escolha invalida (fora da lista ou texto): re-mostra a lista. NAO cria pedido.
          return [
            '😕 Não entendi. Responda com o *número* da opção desejada.',
            '',
            this.formatPickupSlotsMessage(slots),
          ].join('\n');
        }

        const slot = slots[choice - 1];
        const scheduledAt = new Date(slot.scheduled_at);
        // CAMADA 2: carrega as exceçoes por-data (mesmo padrao do gate) para o backstop
        // TAMBEM consultar exceçoes antes de confirmar. O I/O mora AQUI, no caller;
        // isWithinBusinessHours continua PURO (recebe a Map por parametro). Cobrimos do
        // AGORA ate a data do slot (a mais distante que precisamos), com folga de 1 dia.
        const nowConfirm = new Date();
        const toConfirm = new Date(
          Math.max(scheduledAt.getTime(), nowConfirm.getTime()) + 24 * 60 * 60 * 1000,
        );
        const excRows = await this.availabilityService.findByDateRange(
          tenantId,
          nowConfirm,
          toConfirm,
        );
        const excMap = new Map<
          string,
          { kind: 'closed' | 'custom_hours'; open?: string | null; close?: string | null }
        >(
          excRows.map((e) => [e.date, { kind: e.kind, open: e.open, close: e.close }]),
        );
        // BACKSTOP (defesa-em-profundidade): por construcao o slot ja esta dentro do
        // funcionamento (o gate ja filtra exceçoes na oferta), mas revalidamos antes de
        // criar o pedido — inclusive contra exceçoes — (cinto-e-suspensorio).
        if (!this.isWithinBusinessHours(scheduledAt, businessHours, excMap)) {
          return [
            `😕 Esse horário está fora do nosso funcionamento (${this.describeBusinessHours(businessHours)}).`,
            '',
            this.formatPickupSlotsMessage(slots),
          ].join('\n');
        }
        // Slot valido: cria o pedido pickup.
        await persist({ scheduled_at: scheduledAt.toISOString() });
        return this.finalizePickupCheckout(tenantId, conversation, {
          ...checkout,
          scheduled_at: scheduledAt.toISOString(),
        });
      }

      case 'collecting_address': {
        const parsed = this.parseDeliveryAddress(text);
        if (!parsed) {
          return [
            '😕 Não consegui entender o endereço. Por favor, envie numa mensagem só:',
            '',
            '*Rua, número, bairro, cidade, UF, CEP*',
          ].join('\n');
        }
        await persist({ stage: 'confirming_address', delivery_address: parsed });
        return [
          '📦 *Confirma este endereço de entrega?*',
          '',
          this.formatDeliveryAddress(parsed),
          '',
          'Responda *sim* para confirmar ou *não* para corrigir.',
        ].join('\n');
      }

      case 'confirming_address': {
        const confirmed =
          lower.includes('sim') || lower.includes('confirm') || lower === 'ok' || lower.includes('isso');
        if (!confirmed) {
          // Rejeicao: volta para a coleta de endereco. NAO cria pedido.
          await persist({ stage: 'collecting_address', delivery_address: undefined });
          return [
            'Sem problema! Vamos corrigir. 🙂',
            '',
            'Me passe o *endereço de entrega* de novo:',
            '',
            '*Rua, número, bairro, cidade, UF, CEP*',
          ].join('\n');
        }
        // Confirmado: SO AGORA criamos o pedido e seguimos pro PIX.
        return this.finalizeDeliveryCheckout(tenantId, conversation, checkout);
      }

      default:
        return null;
    }
  }

  /**
   * Faz o parsing do endereco de entrega informado numa unica mensagem.
   * Formato esperado: "Rua, número, bairro, cidade, UF, CEP".
   * Retorna null se nao houver campos suficientes.
   */
  private parseDeliveryAddress(message: string): DeliveryAddressParts | null {
    const parts = (message || '')
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Minimo: rua, numero, bairro, cidade, UF, CEP = 6 campos.
    if (parts.length < 6) {
      return null;
    }

    const [street, number, neighborhood, city, state, zipcode] = parts;
    if (!street || !number || !neighborhood || !city || !state || !zipcode) {
      return null;
    }

    return {
      street,
      number,
      neighborhood,
      city,
      state: state.toUpperCase().slice(0, 2),
      zipcode,
    };
  }

  /** Monta o endereco para exibir de volta ao cliente. */
  private formatDeliveryAddress(a: DeliveryAddressParts): string {
    const linhas = [
      `${a.street}, ${a.number}`,
      a.complement ? a.complement : null,
      `${a.neighborhood} — ${a.city}/${a.state}`,
      `CEP ${a.zipcode}`,
    ].filter(Boolean) as string[];
    return linhas.join('\n');
  }

  /**
   * Cria o pedido (PENDENTE_PAGAMENTO) apos a confirmacao do endereco e segue
   * para o PIX como hoje. A mensagem/imagem do PIX em si e a Task 3 — aqui so
   * garantimos que o pedido nasce com os dados certos.
   */
  private async finalizeDeliveryCheckout(
    tenantId: string,
    conversation: TypedConversation,
    checkout: CheckoutContext,
  ): Promise<WhatsAppOutboundResponse> {
    const customerPhone = checkout.customer_phone || conversation.customer_phone || '';
    try {
      const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);
      if (cart.items.length === 0) {
        await this.conversationService.updateContext(conversation.id, { state: 'idle', checkout: null });
        conversation.context = { ...conversation.context, state: 'idle', checkout: undefined };
        return '🛒 Seu carrinho está vazio! Adicione itens primeiro.';
      }

      const order = await this.ordersService.create(
        {
          channel: CanalVenda.WHATSAPP,
          customer_phone: customerPhone,
          customer_name: checkout.customer_name,
          delivery_type: 'delivery',
          delivery_address: checkout.delivery_address as any,
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

      // Criar pagamento PIX (S3): envia a IMAGEM do QR + copia-e-cola em texto,
      // exibe o VALOR COBRADO (95%, o pagamento.amount), e em falha segue o
      // caminho honesto (payment_issue=true + aviso ao lojista).
      let pixMessage = '';
      // Formatador BRL do sistema (mesmo de generatePixMessage): R$ 95,00.
      const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
      try {
        const paymentResult = await this.paymentsService.createPayment(tenantId, {
          pedido_id: order.id,
          method: MetodoPagamento.PIX,
          amount: Number(order.total_amount),
          metadata: { customerPhone, orderId: order.id },
        });

        // VALOR EXIBIDO = VALOR COBRADO (Ajuste 2): o pagamento.amount ja vem com o
        // desconto PIX (95%) aplicado pelo createPayment. NUNCA order.total_amount.
        const valorCobrado = Number(paymentResult.pagamento?.amount);
        const copyPaste = paymentResult.copy_paste || 'Chave PIX';

        const totalCheio = Number(order.total_amount);
        const linhasPix = ['', '', '📱 *Pagamento PIX*'];
        if (Number.isFinite(valorCobrado) && valorCobrado > 0) {
          if (Number.isFinite(totalCheio) && totalCheio > valorCobrado) {
            // Desconto PIX EXPLICITO como argumento de venda: o cliente VE que
            // economiza pagando no PIX (incentivo concreto num ticket baixo).
            const economia = Number((totalCheio - valorCobrado).toFixed(2));
            linhasPix.push(
              '',
              `De ${brl(totalCheio)} por *${brl(valorCobrado)}* no PIX`,
              `💚 Você economiza ${brl(economia)} pagando com PIX!`,
            );
          } else {
            linhasPix.push('', `Valor a pagar no PIX: *${brl(valorCobrado)}*`);
          }
        }
        linhasPix.push('', 'Escaneie o QR Code enviado ou copie a chave:', '', `\`${copyPaste}\``);
        pixMessage = linhasPix.join('\n');

        // Envia a IMAGEM do QR (data-URL base64) ALEM da copia-e-cola no texto.
        // Best-effort: o sendImage ja degrada pra texto, e a copia-e-cola e o
        // caminho garantido — nunca bloquear o checkout nisso.
        if (paymentResult.qr_code) {
          try {
            await this.whatsappSender.sendImage(
              tenantId,
              customerPhone,
              paymentResult.qr_code,
              'QR Code do seu pagamento PIX',
            );
          } catch (imageError) {
            this.logger.warn('Falha ao enviar imagem do QR PIX (segue com copia-e-cola)', {
              error: imageError instanceof Error ? imageError.message : String(imageError),
              tenantId,
              orderId: order.id,
            });
          }
        }
      } catch (paymentError) {
        // Caminho de falha HONESTO: nada de "aguarde o link". Marca o estado
        // tipado payment_issue=true (consultavel) e avisa o lojista diretamente.
        this.logger.error('Erro ao gerar pagamento PIX', {
          error: paymentError instanceof Error ? paymentError.message : String(paymentError),
          tenantId,
          orderId: order.id,
        });

        try {
          const pedidoRepo = this.db.getRepository(Pedido);
          order.payment_issue = true;
          await pedidoRepo.save(order);
        } catch (saveError) {
          this.logger.error('Falha ao marcar payment_issue no pedido', {
            error: saveError instanceof Error ? saveError.message : String(saveError),
            tenantId,
            orderId: order.id,
          });
        }

        // Aviso ao lojista — best-effort/nao-fatal (a propria funcao nao lanca).
        await this.notificationsService.notifyMerchantPaymentIssue(tenantId, order);

        pixMessage =
          '\n\n⚠️ Tivemos um problema ao gerar o pagamento PIX agora. ' +
          'Seu pedido está reservado e nossa equipe já foi avisada para entrar em contato e concluir com você.';
      }

      await this.cartService.markAsConverted(cart.id);

      // Encerra a FSM de checkout.
      await this.conversationService.updateContext(conversation.id, {
        state: 'waiting_payment',
        checkout: null,
        pedido_id: order.id,
      });
      conversation.context = {
        ...conversation.context,
        state: 'waiting_payment',
        checkout: undefined,
        pedido_id: order.id,
      };

      const itemsList = cart.items.map((item: any, i: number) =>
        `${i + 1}. ${item.produto_name} x${item.quantity}`
      ).join('\n');

      return [
        `✅ *Pedido #${order.id.substring(0, 8).toUpperCase()} confirmado!*`,
        '',
        `📦 *Resumo:*`,
        itemsList,
        '',
        `📍 *Entrega em:*`,
        this.formatDeliveryAddress(checkout.delivery_address as DeliveryAddressParts),
        '',
        `💰 *Total: R$ ${Number(order.total_amount).toFixed(2)}*`,
        pixMessage,
      ].join('\n');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error finalizing delivery checkout', {
        error: err.message,
        tenantId,
        customerPhone,
      });
      return '😕 Houve um erro ao finalizar seu pedido. Tente novamente.';
    }
  }

  /**
   * Le o horario de funcionamento do tenant de settings.business_hours.
   * DEFAULT RESTRITIVO: retorna null se ausente ou malformado — NUNCA adivinha um
   * horario padrao. Sem business_hours explicito, a retirada nao e oferecida.
   */
  private async getBusinessHours(tenantId: string): Promise<BusinessHours | null> {
    try {
      const tenant = await this.tenantsService.findOneById(tenantId);
      const bh = tenant?.settings?.business_hours;
      // Valida o SHAPE POR-DIA: { tz, days: { "0".."6": { open, close } } }.
      // Fail-closed: qualquer campo ausente/malformado -> null (sem retirada).
      if (
        !bh ||
        typeof bh.tz !== 'string' ||
        bh.tz.length === 0 ||
        !bh.days ||
        typeof bh.days !== 'object' ||
        Array.isArray(bh.days)
      ) {
        return null;
      }
      const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
      const entries = Object.entries(bh.days as Record<string, unknown>);
      const validDays = entries.filter(([dow, dh]) => {
        if (!/^[0-6]$/.test(dow)) return false;
        const d = dh as { open?: unknown; close?: unknown };
        return (
          !!d &&
          typeof d.open === 'string' &&
          typeof d.close === 'string' &&
          hhmm.test(d.open) &&
          hhmm.test(d.close)
        );
      });
      // Pelo menos um dia valido; nenhuma chave invalida (fail-closed).
      if (validDays.length === 0 || validDays.length !== entries.length) {
        return null;
      }
      return bh as BusinessHours;
    } catch (error) {
      this.logger.warn('Falha ao ler business_hours do tenant', {
        error: error instanceof Error ? error.message : String(error),
        tenantId,
      });
      return null;
    }
  }

  /** Descreve o horario de funcionamento em texto para o cliente (via util compartilhado). */
  private describeBusinessHours(bh: BusinessHours): string {
    return describeBusinessHours(bh);
  }

  /**
   * Gera as OPCOES de horario de retirada a partir do business_hours, em vez de
   * pedir ao cliente que digite uma data (que um cliente de WhatsApp nao faz).
   * Funcao PURA e deterministica: recebe `now` por parametro (nunca chama new Date()
   * internamente), para ser testavel.
   *
   * Regras:
   *  - Trabalha SEMPRE no fuso da loja (businessHours.tz) via Intl. O scheduled_at
   *    resultante e um Date (instante UTC) correto.
   *  - Passos de 1 HORA, de `open` (inclusive) ate `close` (inclusive).
   *  - NUNCA oferece slot no passado: descarta qualquer instante <= now.
   *  - Cap de `maxSlots` (default 8), do mais proximo ao mais distante.
   *  - Varre ate `lookaheadDays` (default 7) dias a frente, pulando dias fora de `days`.
   */
  private generatePickupSlots(
    businessHours: BusinessHours,
    now: Date,
    opts?: { maxSlots?: number; lookaheadDays?: number },
    exceptions?: Map<
      string,
      { kind: 'closed' | 'custom_hours'; open?: string | null; close?: string | null }
    >,
  ): Array<{ label: string; scheduledAt: Date }> {
    const maxSlots = opts?.maxSlots ?? 8;
    const lookaheadDays = opts?.lookaheadDays ?? 7;
    const tz = businessHours.tz;

    const parseHHMM = (hhmm: string): { hour: number; minute: number } => {
      const [h, m] = hhmm.split(':').map(Number);
      return { hour: h, minute: m };
    };

    // Componentes da data "hoje" NO FUSO da loja, a partir do instante `now`.
    const todayParts = this.localDateParts(now, tz);

    const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const slots: Array<{ label: string; scheduledAt: Date }> = [];

    for (let dayOffset = 0; dayOffset <= lookaheadDays && slots.length < maxSlots; dayOffset++) {
      // Data civil (ano/mes/dia local) deste dia, deslocando a partir de hoje.
      // Usamos Date.UTC sobre os componentes locais so para aritmetica de calendario
      // (somar dias); a hora UTC aqui e irrelevante.
      const civil = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day));
      civil.setUTCDate(civil.getUTCDate() + dayOffset);
      const y = civil.getUTCFullYear();
      const mo = civil.getUTCMonth() + 1;
      const d = civil.getUTCDate();
      // Dia da semana (0=dom..6=sab) desta data civil.
      const dow = civil.getUTCDay();
      // Chave da data civil "YYYY-MM-DD" (zero-padded), a MESMA do AvailabilityService.
      const dateKey = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      // CAMADA 2 (gate por-data, PURO): a exceçao vem por parametro (sem I/O aqui).
      //  - `closed` -> zero slots nesse dia (pula).
      //  - `custom_hours` -> usa a janela da exceçao no lugar do recorrente.
      //  - sem exceçao -> faixa recorrente (Camada 1, intacta).
      const exc = exceptions?.get(dateKey);
      if (exc?.kind === 'closed') {
        continue;
      }
      // Faixa PROPRIA do dia (shape por-dia); dia AUSENTE = fechado -> pula.
      const dh =
        exc?.kind === 'custom_hours'
          ? { open: exc.open!, close: exc.close! }
          : businessHours.days[String(dow)];
      if (!dh) {
        continue;
      }
      const open = parseHHMM(dh.open);
      const close = parseHHMM(dh.close);
      const openMin = open.hour * 60 + open.minute;
      const closeMin = close.hour * 60 + close.minute;

      for (let min = openMin; min <= closeMin && slots.length < maxSlots; min += 60) {
        const hour = Math.floor(min / 60);
        const minute = min % 60;
        // Converte o "wall clock" local (y-mo-d hour:minute no fuso da loja) no instante UTC.
        const scheduledAt = this.localWallClockToInstant(y, mo, d, hour, minute, tz);
        if (scheduledAt.getTime() <= now.getTime()) {
          continue; // slot no passado (ou agora) — nunca oferece.
        }
        const label = this.pickupSlotLabel(dayOffset, nomes[dow], hour, minute);
        slots.push({ label, scheduledAt });
      }
    }

    return slots;
  }

  /** Componentes civis (ano/mes/dia) de um instante visto NO fuso da loja. */
  private localDateParts(date: Date, tz: string): { year: number; month: number; day: number } {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const parts = dtf.formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return { year: get('year'), month: get('month'), day: get('day') };
  }

  /**
   * Converte um "wall clock" local (componentes no fuso `tz`) no instante UTC correto.
   * Usa o offset do fuso para aquela data (respeita horario de verao).
   */
  private localWallClockToInstant(
    year: number, month: number, day: number, hour: number, minute: number, tz: string,
  ): Date {
    const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    const offsetMin = this.tzOffsetMinutes(new Date(asUtc), tz);
    // wall-clock local = UTC + offset  =>  UTC = wall-clock - offset.
    return new Date(asUtc - offsetMin * 60 * 1000);
  }

  /** Label amigavel em PT para um slot (ex.: "Hoje 16h", "Amanhã 10h", "Sex 14h"). */
  private pickupSlotLabel(dayOffset: number, weekdayName: string, hour: number, minute: number): string {
    const hh = minute === 0 ? `${hour}h` : `${hour}h${String(minute).padStart(2, '0')}`;
    let prefix: string;
    if (dayOffset === 0) prefix = 'Hoje';
    else if (dayOffset === 1) prefix = 'Amanhã';
    else prefix = weekdayName;
    return `${prefix} ${hh}`;
  }

  /** Monta a mensagem numerada de opcoes de retirada. */
  private formatPickupSlotsMessage(slots: PickupSlot[]): string {
    const linhas = slots.map((s, i) => `${i + 1}) ${s.label}`);
    return [
      '🕐 *Quando quer retirar?*',
      '',
      'Responda com o *número* da opção:',
      '',
      ...linhas,
    ].join('\n');
  }

  /**
   * Offset (em minutos) do fuso `tz` para o instante `date`. Positivo a leste de UTC,
   * negativo a oeste (America/Sao_Paulo = -180). Calculado via Intl.DateTimeFormat,
   * que respeita historico/horario de verao do fuso — nunca um -03:00 hardcoded.
   */
  private tzOffsetMinutes(date: Date, tz: string): number {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const parts = dtf.formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    let hour = get('hour');
    if (hour === 24) hour = 0; // Intl pode emitir 24 a meia-noite
    // O instante `date` (UTC) visto NO fuso tz tem estes componentes locais.
    const asUtcOfLocal = Date.UTC(
      get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'),
    );
    // offset = (horario local) - (horario UTC do mesmo instante).
    return Math.round((asUtcOfLocal - date.getTime()) / 60000);
  }

  /**
   * Valida se `scheduledAt` cai DENTRO do horario de funcionamento da loja.
   *
   * PONTO DE LUPA (FUSO): a comparacao e feita NO FUSO DA LOJA (businessHours.tz),
   * NUNCA em UTC. Convertemos o instante `scheduledAt` para o horario local da loja
   * (dia da semana + hora:minuto locais) ANTES de comparar contra open/close e days.
   * Ex.: 16:00 em America/Sao_Paulo (= 19:00 UTC) deve ser ACEITO contra 09-18 local —
   * comparar a hora UTC (19h) contra "fecha 18h" rejeitaria errado.
   */
  private isWithinBusinessHours(
    scheduledAt: Date,
    businessHours: BusinessHours,
    exceptions?: Map<
      string,
      { kind: 'closed' | 'custom_hours'; open?: string | null; close?: string | null }
    >,
  ): boolean {
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return false;
    }
    // Extrai os componentes LOCAIS (no fuso da loja) do instante agendado.
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: businessHours.tz,
      weekday: 'short',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    });
    const parts = dtf.formatToParts(scheduledAt);
    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value || '';
    let hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value);
    if (hour === 24) hour = 0;

    const weekdayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const dow = weekdayMap[weekdayStr];
    if (dow === undefined) {
      return false;
    }
    // CAMADA 2 (backstop por-data, PURO): a exceçao vem por parametro (sem I/O aqui).
    // Chave = data civil "YYYY-MM-DD" do slot NO FUSO da loja — a MESMA do gate.
    //  - `closed` -> recusa confirmar (nunca cria pedido em data fechada).
    //  - `custom_hours` -> valida contra a janela da EXCEÇAO (nao o recorrente).
    //  - sem exceçao -> faixa recorrente (Camada 1, intacta) abaixo.
    const civil = this.localDateParts(scheduledAt, businessHours.tz);
    const dateKey = `${civil.year}-${String(civil.month).padStart(2, '0')}-${String(civil.day).padStart(2, '0')}`;
    const exc = exceptions?.get(dateKey);
    if (exc?.kind === 'closed') {
      return false;
    }
    // Faixa PROPRIA do dia: exceçao `custom_hours` sobrepoe; senao o recorrente
    // (shape por-dia; dia AUSENTE = fechado -> recusa).
    const dh =
      exc?.kind === 'custom_hours'
        ? { open: exc.open!, close: exc.close! }
        : businessHours.days[String(dow)];
    if (!dh) {
      return false;
    }

    const toMinutes = (hhmm: string): number => {
      const [hh, mm] = hhmm.split(':').map(Number);
      return hh * 60 + mm;
    };
    const localMin = hour * 60 + minute;
    const openMin = toMinutes(dh.open);
    const closeMin = toMinutes(dh.close);
    // [open, close]: inclui o horario de abertura e o de fechamento.
    return localMin >= openMin && localMin <= closeMin;
  }

  /**
   * Cria o pedido de RETIRADA (pickup) com scheduled_at e segue para o PIX.
   * Espelha finalizeDeliveryCheckout, mas com delivery_type='pickup' e sem endereco.
   */
  private async finalizePickupCheckout(
    tenantId: string,
    conversation: TypedConversation,
    checkout: CheckoutContext,
  ): Promise<WhatsAppOutboundResponse> {
    const customerPhone = checkout.customer_phone || conversation.customer_phone || '';
    try {
      const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);
      if (cart.items.length === 0) {
        await this.conversationService.updateContext(conversation.id, { state: 'idle', checkout: null });
        conversation.context = { ...conversation.context, state: 'idle', checkout: undefined };
        return '🛒 Seu carrinho está vazio! Adicione itens primeiro.';
      }

      const scheduledAt = checkout.scheduled_at ? new Date(checkout.scheduled_at) : undefined;

      const order = await this.ordersService.create(
        {
          channel: CanalVenda.WHATSAPP,
          customer_phone: customerPhone,
          customer_name: checkout.customer_name,
          delivery_type: 'pickup',
          scheduled_at: scheduledAt,
          items: cart.items.map((item: any) => ({
            produto_id: item.produto_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
          shipping_amount: 0,
          discount_amount: Number(cart.discount_amount) || 0,
          coupon_code: cart.coupon_code,
        },
        tenantId,
      );

      // Criar pagamento PIX (mesmo caminho da entrega): imagem do QR + copia-e-cola,
      // valor cobrado (95%), e falha honesta com payment_issue + aviso ao lojista.
      let pixMessage = '';
      const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
      try {
        const paymentResult = await this.paymentsService.createPayment(tenantId, {
          pedido_id: order.id,
          method: MetodoPagamento.PIX,
          amount: Number(order.total_amount),
          metadata: { customerPhone, orderId: order.id },
        });

        const valorCobrado = Number(paymentResult.pagamento?.amount);
        const copyPaste = paymentResult.copy_paste || 'Chave PIX';
        const totalCheio = Number(order.total_amount);
        const linhasPix = ['', '', '📱 *Pagamento PIX*'];
        if (Number.isFinite(valorCobrado) && valorCobrado > 0) {
          if (Number.isFinite(totalCheio) && totalCheio > valorCobrado) {
            const economia = Number((totalCheio - valorCobrado).toFixed(2));
            linhasPix.push(
              '',
              `De ${brl(totalCheio)} por *${brl(valorCobrado)}* no PIX`,
              `💚 Você economiza ${brl(economia)} pagando com PIX!`,
            );
          } else {
            linhasPix.push('', `Valor a pagar no PIX: *${brl(valorCobrado)}*`);
          }
        }
        linhasPix.push('', 'Escaneie o QR Code enviado ou copie a chave:', '', `\`${copyPaste}\``);
        pixMessage = linhasPix.join('\n');

        if (paymentResult.qr_code) {
          try {
            await this.whatsappSender.sendImage(
              tenantId,
              customerPhone,
              paymentResult.qr_code,
              'QR Code do seu pagamento PIX',
            );
          } catch (imageError) {
            this.logger.warn('Falha ao enviar imagem do QR PIX (segue com copia-e-cola)', {
              error: imageError instanceof Error ? imageError.message : String(imageError),
              tenantId,
              orderId: order.id,
            });
          }
        }
      } catch (paymentError) {
        this.logger.error('Erro ao gerar pagamento PIX (pickup)', {
          error: paymentError instanceof Error ? paymentError.message : String(paymentError),
          tenantId,
          orderId: order.id,
        });
        try {
          const pedidoRepo = this.db.getRepository(Pedido);
          order.payment_issue = true;
          await pedidoRepo.save(order);
        } catch (saveError) {
          this.logger.error('Falha ao marcar payment_issue no pedido (pickup)', {
            error: saveError instanceof Error ? saveError.message : String(saveError),
            tenantId,
            orderId: order.id,
          });
        }
        await this.notificationsService.notifyMerchantPaymentIssue(tenantId, order);
        pixMessage =
          '\n\n⚠️ Tivemos um problema ao gerar o pagamento PIX agora. ' +
          'Seu pedido está reservado e nossa equipe já foi avisada para entrar em contato e concluir com você.';
      }

      await this.cartService.markAsConverted(cart.id);

      await this.conversationService.updateContext(conversation.id, {
        state: 'waiting_payment',
        checkout: null,
        pedido_id: order.id,
      });
      conversation.context = {
        ...conversation.context,
        state: 'waiting_payment',
        checkout: undefined,
        pedido_id: order.id,
      };

      const itemsList = cart.items.map((item: any, i: number) =>
        `${i + 1}. ${item.produto_name} x${item.quantity}`
      ).join('\n');

      const businessHours = await this.getBusinessHours(tenantId);
      const horarioStr = scheduledAt
        ? scheduledAt.toLocaleString('pt-BR', {
            timeZone: businessHours?.tz || 'America/Sao_Paulo',
            dateStyle: 'short',
            timeStyle: 'short',
          })
        : '';

      return [
        `✅ *Pedido #${order.id.substring(0, 8).toUpperCase()} confirmado!*`,
        '',
        `📦 *Resumo:*`,
        itemsList,
        '',
        `🛍️ *Retirada agendada para:*`,
        horarioStr,
        '',
        `💰 *Total: R$ ${Number(order.total_amount).toFixed(2)}*`,
        pixMessage,
      ].join('\n');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error finalizing pickup checkout', {
        error: err.message,
        tenantId,
        customerPhone,
      });
      return '😕 Houve um erro ao finalizar seu pedido. Tente novamente.';
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
    // FSM de checkout (S2a) tem prioridade: se ha um checkout em andamento,
    // ela conduz a coleta de entrega com confirmacao antes de criar o pedido.
    const checkoutResponse = await this.handleCheckoutStage(tenantId, message, conversation);
    if (checkoutResponse !== null) {
      return checkoutResponse;
    }

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
    const lower = message.toLowerCase().trim();

    // Verificar se é intenção de comprar/querer produto
    const buyKeywords = ['quero', 'queria', 'preciso', 'me vê', 'me vê', 'pedir', 'pegar', 'levar', 'bora', 'manda'];
    const hasBuyIntent = buyKeywords.some(k => lower.includes(k));

    // Verificar se menciona produto do cardápio
    const productKeywords = ['brigadeiro', 'bolo', 'torta', 'doce', 'brigadeiro', 'sobremesa', 'caixa'];
    const hasProductMention = productKeywords.some(k => lower.includes(k));

    // Verificar se pergunta sobre disponibilidade ("tem", "tem disponível")
    const hasAvailabilityIntent = lower.includes('tem ') || lower.includes('tem?') || lower.includes('vocês têm');

    // Verificar se pergunta sobre preço ("quanto", "preço", "valor")
    const hasPriceIntent = lower.includes('quanto') || lower.includes('preço') || lower.includes('valor') || lower.includes('custa');

    // Se tem intent de preço, buscar produto
    if (hasPriceIntent && hasProductMention) {
      try {
        const productName = lower
          .replace(/quanto[cs]?/gi, '')
          .replace(/custa/gi, '')
          .replace(/preço/gi, '')
          .replace(/valor/gi, '')
          .replace(/do[s]?\s*/gi, '')
          .replace(/da[s]?\s*/gi, '')
          .replace(/tá\s*/gi, '')
          .trim();

        const products = await this.productsService.search(tenantId, productName);
        if (products.length > 0) {
          const product = products[0];
          return `💰 *${product.name}*\n\nPreço: R$ ${Number(product.price).toFixed(2)}\n\nQuer adicionar ao carrinho? Digite "adicionar ${product.name.split(' ')[0]}"`;
        }
      } catch (error) {
        this.logger.error('Error in price intent', { error });
      }
    }

    // Se tem intent de disponibilidade, buscar produto
    if (hasAvailabilityIntent && hasProductMention) {
      try {
        const productName = lower
          .replace(/tem\s*/gi, '')
          .replace(/vocês\s*têm\s*/gi, '')
          .replace(/dispon[íi]vel/gi, '')
          .trim();

        if (productName && productName.length > 2) {
          const products = await this.productsService.search(tenantId, productName);
          if (products.length > 0) {
            const product = products[0];
            return `✅ Sim! Temos *${product.name}* disponível por R$ ${Number(product.price).toFixed(2)}!\n\nQuer adicionar ao carrinho?`;
          }
          return `😕 Não encontramos "${productName}" no momento. Que tal ver nosso cardápio? Digite "ver produtos"`;
        }
      } catch (error) {
        this.logger.error('Error in availability intent', { error });
      }
    }

    // Se tem intent de comprar, adicionar ao carrinho
    if (hasBuyIntent && hasProductMention) {
      try {
        // Extrair nome do produto
        let productName = lower
          .replace(/quero\s*/gi, '')
          .replace(/queria\s*/gi, '')
          .replace(/preciso\s*/gi, '')
          .replace(/me\s+v[êe]\s*/gi, '')
          .replace(/pedir\s*/gi, '')
          .replace(/pegar\s*/gi, '')
          .replace(/levar\s*/gi, '')
          .replace(/bora\s*/gi, '')
          .replace(/manda\s*/gi, '')
          .trim();

        // Se não extraiu nada, usar a mensagem inteira
        if (!productName || productName.length < 2) {
          productName = lower;
        }

        const products = await this.productsService.search(tenantId, productName);
        if (products.length > 0) {
          const product = products[0];
          await this.cartService.addItem({
            tenantId,
            customerPhone: conversation.customer_phone,
            produtoId: product.id,
            produtoName: product.name,
            quantity: 1,
            unitPrice: Number(product.price),
          });
          return `✅ Adicionado 1x ${product.name} - R$ ${Number(product.price).toFixed(2)} ao carrinho!\n\nDigite "carrinho" para ver ou "finalizar" para confirmar.`;
        }
      } catch (error) {
        this.logger.error('Error in buy intent fallback', { error });
      }
    }

    // Tentar encontrar produto se a mensagem parecer ser sobre um
    if (this.isProductIntent(message) || lower.length > 3) {
      try {
        // Primeiro tenta extrair o nome do produto da mensagem
        const searchTerms = [
          'brigadeiro', 'bolo', 'torta', 'doce', 'sobremesa', 'caixa',
          'brigadeiros', 'doces', 'sobremesas'
        ];

        let searchTerm = message.toLowerCase();
        for (const term of searchTerms) {
          if (searchTerm.includes(term)) {
            // Encontrou um termo de produto, buscar produtos
            const products = await this.productsService.search(tenantId, term);
            if (products.length > 0) {
              const product = products[0];

              // Se tem intenção de compra, adicionar direto
              const buyKeywords = ['quero', 'queria', 'preciso', 'me vê', 'pedir', 'pegar', 'levar', 'bora', 'manda'];
              const hasBuyIntent = buyKeywords.some(k => lower.includes(k));

              if (hasBuyIntent) {
                await this.cartService.addItem({
                  tenantId,
                  customerPhone: conversation.customer_phone,
                  produtoId: product.id,
                  produtoName: product.name,
                  quantity: 1,
                  unitPrice: Number(product.price),
                });
                return `✅ Adicionado 1x ${product.name} - R$ ${Number(product.price).toFixed(2)} ao carrinho!\n\nDigite "carrinho" para ver ou "finalizar" para confirmar.`;
              }

              return [
                `🍫 *${product.name}* - R$ ${Number(product.price).toFixed(2)}`,
                '',
                product.description || '',
                '',
                'Digite "adicionar ' + product.name.split(' ')[0] + '" para colocar no carrinho!',
              ].join('\n');
            }
          }
        }
      } catch (e) {
        // Continua para fallback
      }
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
      this.logger.warn('LLM fallback failed', { error });

      // Resposta amigável quando não entende
      const suggestions = [
        '🛒 Digite "ver produtos" para ver o cardápio',
        '❓ Digite "ajuda" para ver todos os comandos',
        '🛍️ Ou me diga o que você quer!',
      ];

      return [
        '🤔 Não entendi bem...',
        '',
        suggestions[Math.floor(Math.random() * suggestions.length)],
      ].join('\n');
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

  /**
   * Retorna métricas do bot para um tenant
   */
  async getAnalytics(tenantId: string, startDate: Date): Promise<any> {
    try {
      // Buscar métricas básicas do banco
      const repo = this.analytics['db'].getRepository('WhatsappMessageMetrics');
      const totalMessages = await repo.count({
        where: {
          tenant_id: tenantId,
          created_at: startDate as any,
        },
      });

      // Buscar pedidos do período
      const ordersRepo = this.ordersService['pedidosRepository'];
      const totalOrders = await ordersRepo?.count({
        where: {
          tenant_id: tenantId,
          created_at: startDate as any,
        },
      }) || 0;

      // Buscar carrinhos (no contexto RLS do tenant, via CartService)
      const cartCounts = await this.cartService.countCartsByTenant(tenantId);
      const totalCarts = cartCounts.total;
      const convertedCarts = cartCounts.converted;

      return {
        period: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
        },
        conversations: {
          total_messages: totalMessages || 0,
          unique_customers: 0,
        },
        sales: {
          total_orders: totalOrders || 0,
          total_carts: totalCarts || 0,
          converted_carts: convertedCarts || 0,
          conversion_rate: totalCarts > 0 ? ((convertedCarts / totalCarts) * 100).toFixed(2) + '%' : '0%',
        },
        status: 'analytics_enabled',
      };
    } catch (error) {
      this.logger.error('Error fetching analytics', { error, tenantId });
      return {
        error: 'Failed to fetch analytics',
        period: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
        },
      };
    }
  }

  // ============== INTERACTIVE MESSAGES (WhatsApp Business API) ==============

  /**
   * Cria mensagem interativa de carrinho com botões
   */
  async createInteractiveCartMessage(
    tenantId: string,
    customerPhone: string,
  ): Promise<WhatsAppOutboundResponse> {
    const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);

    if (cart.items.length === 0) {
      return this.responseBuilder.buildEmptyCartResponse();
    }

    // Calcular totais
    const subtotal = cart.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const shipping = 10; // Frete fixo por enquanto
    const total = subtotal + shipping;

    // Criar conteúdo do carrinho em texto
    const cartItems = cart.items.map((item, idx) =>
      `${idx + 1}. ${item.produto_name}\n   Qtd: ${item.quantity} × R$ ${item.unit_price.toFixed(2)} = R$ ${(item.unit_price * item.quantity).toFixed(2)}`
    ).join('\n');

    const cartContent = [
      '🛒 *Seu Carrinho:*',
      '',
      cartItems,
      '',
      `📦 Subtotal: R$ ${subtotal.toFixed(2)}`,
      `🚚 Frete: R$ ${shipping.toFixed(2)}`,
      '',
      `💰 *TOTAL: R$ ${total.toFixed(2)}*`,
    ].join('\n');

    // Retornar com botões interativos
    return {
      kind: 'interactive_with_buttons',
      previewText: '🛒 Seu carrinho',
      cartContent,
      buttons: [
        { id: 'add_more', title: '➕ Adicionar mais' },
        { id: 'finalize', title: '✅ Finalizar' },
        { id: 'clear', title: '🗑️ Limpar' },
      ],
    };
  }

  /**
   * Cria mensagem de confirmação de pedido com estrutura profissional
   */
  createOrderConfirmationMessage(
    orderId: string,
    items: Array<{ name: string; quantity: number; price: number }>,
    subtotal: number,
    shipping: number,
    total: number,
  ): WhatsAppOutboundResponse {
    // Criar mensagem estruturada com botões
    const itemsText = items.map(item =>
      `• ${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}`
    ).join('\n');

    return {
      kind: 'interactive_order',
      previewText: `Pedido #${orderId} confirmado!`,
      orderId,
      items: itemsText,
      subtotal,
      shipping,
      total,
      buttons: [
        { id: `pay_${orderId}`, title: '💳 Pagar com PIX' },
        { id: `status_${orderId}`, title: '📦 Status' },
        { id: 'help', title: '❓ Ajuda' },
      ],
    };
  }

  /**
   * Cria mensagem de produto com botões de ação
   */
  createProductMessage(
    product: {
      id: string;
      name: string;
      price: number;
      description?: string;
    },
    tenantId: string,
  ): WhatsAppOutboundResponse {
    return {
      kind: 'interactive_product',
      previewText: `${product.name} - R$ ${product.price.toFixed(2)}`,
      product,
      buttons: [
        { id: `add_${product.id}`, title: '🛒 Adicionar' },
        { id: `details_${product.id}`, title: '📝 Detalhes' },
        { id: 'catalog', title: '📋 Cardápio' },
      ],
    };
  }

  /**
   * Cria lista interativa de produtos com preços visíveis
   */
  async createProductListMessage(
    tenantId: string,
    searchTerm?: string,
  ): Promise<WhatsAppOutboundResponse> {
    let products: any[] = [];

    if (searchTerm) {
      products = await this.productsService.search(tenantId, searchTerm);
    } else {
      const result: any = await this.productsService.findAll(tenantId, { limit: 10 });
      if (result && result.data) {
        products = result.data;
      } else if (Array.isArray(result)) {
        products = result;
      }
    }

    if (!products || products.length === 0) {
      return '😕 Não encontramos produtos no momento. Tente novamente mais tarde!';
    }

    // Criar seções de produtos
    const sections = [{
      title: '🍫 Nossos Produtos',
      rows: products.map((p) => ({
        id: `prod_${p.id}`,
        title: p.name,
        description: `R$ ${Number(p.price).toFixed(2)}`,
      })),
    }];

    return {
      kind: 'interactive_list',
      previewText: '📋 Cardápio',
      list: {
        title: '📋 Cardápio',
        description: 'Escolha um produto:',
        buttonText: 'Ver opções',
        sections,
      },
    };
  }

  /**
   * Cria mensagem de boas-vindas com menu rápido
   */
  createWelcomeMessage(): WhatsAppOutboundResponse {
    return {
      kind: 'interactive_welcome',
      previewText: 'Olá! Como posso ajudar?',
      greeting: 'Olá! 👋 Bem-vindo(a)!',
      message: 'Sou seu assistente virtual e posso te ajudar com:',
      options: [
        { id: 'catalog', title: '📋 Ver cardápio' },
        { id: 'cart', title: '🛒 Meu carrinho' },
        { id: 'help', title: '❓ Ajuda' },
      ],
    };
  }

  /**
   * Processa clique em botão interativo
   */
  async processInteractiveButton(
    buttonId: string,
    tenantId: string,
    customerPhone: string,
  ): Promise<WhatsAppOutboundResponse> {
    const [action, ...rest] = buttonId.split('_');
    const value = rest.join('_');

    switch (action) {
      case 'add':
        // Adicionar produto ao carrinho
        const products = await this.productsService.search(tenantId, value);
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
          return `✅ Adicionado 1x ${product.name} - R$ ${Number(product.price).toFixed(2)} ao carrinho!`;
        }
        return '😕 Produto não encontrado.';

      case 'finalize': {
        // Carrega a conversa para a FSM de checkout guardar/ler o estagio.
        const conversation = await this.conversationService.getOrCreateConversation(
          tenantId,
          customerPhone,
        );
        return this.handleCheckout(tenantId, customerPhone, conversation as TypedConversation);
      }

      case 'clear':
        const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);
        if (cart.items.length === 0) {
          return '🛒 Seu carrinho já está vazio!';
        }
        await this.cartService.clearCart(cart.id);
        return '🧹 Carrinho esvaziado! Quer adicionar algo novo?';

      case 'add_more':
        return this.createProductListMessage(tenantId);

      case 'catalog':
        return this.createProductListMessage(tenantId);

      case 'cart':
        const cartMsg2 = await this.cartService.getOrCreateCart(tenantId, customerPhone);
        if (cartMsg2.items.length === 0) {
          return '🛒 Seu carrinho está vazio!';
        }
        const items = cartMsg2.items.map((item: any, idx: number) =>
          `${idx + 1}. ${item.produto_name}\n   Qtd: ${item.quantity} × R$ ${item.unit_price.toFixed(2)}`
        ).join('\n');
        return [
          '🛒 *Seu Carrinho:*',
          '',
          items,
          '',
          'Digite "finalizar" para confirmar ou "limpar" para esvaziar.',
        ].join('\n');

      case 'pay':
        return '💳 Para pagar, finalize seu pedido e escolha a forma de pagamento!';

      case 'status':
        return '📦 Para acompanhar seu pedido, me diga o número do pedido!';

      case 'help':
        return this.responseBuilder.buildHelpMessage();

      case 'details':
        const detailProducts = await this.productsService.search(tenantId, value);
        if (detailProducts.length > 0) {
          const product = detailProducts[0];
          return [
            `🍫 *${product.name}*`,
            '',
            `💰 *Preço: R$ ${Number(product.price).toFixed(2)}*`,
            '',
            product.description || 'Delicioso!',
            '',
            'Digite "adicionar ' + product.name.split(' ')[0] + '" para comprar!',
          ].join('\n');
        }
        return '😕 Produto não encontrado.';

      default:
        return '❌ Opção não reconhecida. Digite "ajuda" para ver os comandos.';
    }
  }
}

// Alias para compatibilidade com código legacy
export const WhatsappService = WhatsAppService;