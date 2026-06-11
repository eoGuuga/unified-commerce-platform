import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationService } from './conversation.service';
import { CartService } from './cart.service';
import { WhatsAppErrorHandler } from './error-handler.service';
import {
  ConversationState,
  CustomerData,
  ConversationContext,
  TypedConversation,
} from '../types/whatsapp.types';

export interface StageContext {
  currentState: ConversationState;
  previousState?: ConversationState;
  enteredAt: Date;
  messageCount: number;
  lastMessageAt?: Date;
}

export interface ConversationSession {
  conversation: TypedConversation;
  stage: StageContext;
  cart?: any;
  customerData?: CustomerData;
  metadata: Record<string, any>;
}

export interface StateTransitionResult {
  newState: ConversationState;
  response: string;
  context: Partial<ConversationContext>;
}

const STATE_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  idle: ['collecting_order'],
  collecting_order: [
    'collecting_name',
    'collecting_address',
    'collecting_phone',
    'collecting_notes',
    'confirming_order',
  ],
  collecting_name: ['collecting_address', 'collecting_phone', 'collecting_notes', 'confirming_order'],
  collecting_address: ['collecting_phone', 'collecting_notes', 'confirming_order'],
  collecting_phone: ['collecting_notes', 'confirming_order'],
  collecting_notes: ['confirming_order'],
  collecting_cash_change: ['confirming_order'],
  confirming_order: ['waiting_payment', 'collecting_order'],
  confirming_stock_adjustment: ['waiting_payment', 'collecting_order'],
  waiting_payment: ['order_confirmed', 'order_completed'],
  order_confirmed: ['order_completed', 'idle'],
  order_completed: ['idle'],
};

const DEFAULT_TIMEOUT_MINUTES = 30;

@Injectable()
export class ConversationManagerService {
  private readonly logger = new Logger(ConversationManagerService.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly cartService: CartService,
    private readonly errorHandler: WhatsAppErrorHandler,
    private readonly config: ConfigService,
  ) {}

  /**
   * Obtém ou cria uma sessão de conversa
   */
  async getOrCreateSession(
    tenantId: string,
    customerPhone: string,
    customerName?: string,
  ): Promise<ConversationSession> {
    // Buscar conversa existente
    const conversation = await this.conversationService.getOrCreateConversation(
      tenantId,
      customerPhone,
      customerName,
    );

    // Buscar carrinho
    const cart = await this.cartService.getOrCreateCart(tenantId, customerPhone);

    // Construir contexto de estágio
    const stage = this.buildStageContext(conversation);

    return {
      conversation,
      stage,
      cart,
      customerData: conversation.context?.customer_data as CustomerData | undefined,
      metadata: conversation.metadata || {},
    };
  }

  /**
   * Transiciona para novo estado
   */
  async transitionTo(
    session: ConversationSession,
    newState: ConversationState,
    contextUpdates?: Partial<ConversationContext>,
  ): Promise<StateTransitionResult> {
    const oldState = session.stage.currentState;

    // Validar transição
    if (!this.isValidTransition(oldState, newState)) {
      this.logger.warn(`Invalid state transition: ${oldState} -> ${newState}`, {
        conversationId: session.conversation.id,
      });

      return {
        newState: oldState,
        response: `Não posso fazer isso agora. Estamos na etapa "${this.getStateLabel(oldState)}".`,
        context: {},
      };
    }

    // Atualizar contexto
    const updates: Record<string, any> = {
      state: newState,
      ...contextUpdates,
    };

    // Salvar no banco
    await this.conversationService.updateContext(session.conversation.id, updates);

    // Atualizar sessão
    session.stage = {
      currentState: newState,
      previousState: oldState,
      enteredAt: new Date(),
      messageCount: 0,
      lastMessageAt: new Date(),
    };
    session.conversation.context = {
      ...session.conversation.context,
      ...updates,
    };

    // Gerar resposta de transição
    const response = this.generateStateTransitionMessage(oldState, newState, session);

    this.logger.log('State transition', {
      conversationId: session.conversation.id,
      from: oldState,
      to: newState,
    });

    return {
      newState,
      response,
      context: updates as Partial<ConversationContext>,
    };
  }

  /**
   * Processa mensagem e determina próxima ação
   */
  async processMessage(
    session: ConversationSession,
    message: string,
  ): Promise<StateTransitionResult> {
    const currentState = session.stage.currentState;

    // Verificar timeout
    if (this.isSessionExpired(session)) {
      return await this.handleSessionTimeout(session);
    }

    // Processar baseado no estado atual
    switch (currentState) {
      case 'idle':
        return this.handleIdleState(session, message);

      case 'collecting_order':
        return this.handleCollectingOrder(session, message);

      case 'collecting_name':
        return this.handleCollectingName(session, message);

      case 'collecting_address':
        return this.handleCollectingAddress(session, message);

      case 'collecting_phone':
        return this.handleCollectingPhone(session, message);

      case 'collecting_notes':
        return this.handleCollectingNotes(session, message);

      case 'confirming_order':
        return this.handleConfirmingOrder(session, message);

      case 'waiting_payment':
        return this.handleWaitingPayment(session, message);

      case 'order_confirmed':
      case 'order_completed':
        return this.handleCompletedState(session, message);

      default:
        return {
          newState: currentState,
          response: 'Entendi. Pode me dar mais detalhes?',
          context: {},
        };
    }
  }

  /**
   * Atualiza dados do cliente na sessão
   */
  async updateCustomerData(
    session: ConversationSession,
    data: Partial<CustomerData>,
  ): Promise<void> {
    const currentData = session.customerData || {};
    const updatedData = { ...currentData, ...data };

    session.customerData = updatedData;

    await this.conversationService.saveCustomerData(session.conversation.id, updatedData);

    session.conversation.context = {
      ...session.conversation.context,
      customer_data: updatedData,
    };
  }

  /**
   * Abandona sessão e limpa contexto
   */
  async abandonSession(session: ConversationSession, reason?: string): Promise<void> {
    this.logger.log('Abandoning session', {
      conversationId: session.conversation.id,
      reason,
      lastState: session.stage.currentState,
      duration: Date.now() - session.stage.enteredAt.getTime(),
    });

    // Limpar carrinho
    if (session.cart?.id) {
      await this.cartService.clearCart(session.cart.id);
    }

    // Limpar contexto
    await this.conversationService.clearPendingOrder(session.conversation.id);
    await this.conversationService.clearCustomerData(session.conversation.id);

    // Marcar como abandonada
    await this.conversationService.updateContext(session.conversation.id, {
      state: 'idle',
      abandonment_reason: reason,
      abandoned_at: new Date().toISOString(),
    });
  }

  /**
   * Completa sessão com sucesso
   */
  async completeSession(
    session: ConversationSession,
    pedidoId: string,
  ): Promise<void> {
    this.logger.log('Completing session', {
      conversationId: session.conversation.id,
      pedidoId,
    });

    await this.conversationService.setPedidoId(session.conversation.id, pedidoId);

    // Marcar carrinho como convertido
    if (session.cart?.id) {
      await this.cartService.markAsConverted(session.cart.id);
    }
  }

  /**
   * Verifica se sessão está expirada
   */
  isSessionExpired(session: ConversationSession): boolean {
    const timeoutMinutes = this.getTimeoutMinutes();
    const lastMessage = session.stage.lastMessageAt || session.conversation.last_message_at;
    const ageMs = Date.now() - new Date(lastMessage).getTime();
    const timeoutMs = timeoutMinutes * 60 * 1000;

    return ageMs > timeoutMs;
  }

  /**
   * Retorna informações resumidas da sessão
   */
  getSessionSummary(session: ConversationSession): string {
    const lines: string[] = [];

    lines.push(`📍 Estado: ${this.getStateLabel(session.stage.currentState)}`);
    lines.push(`⏱️ Na etapa desde: ${this.formatTime(session.stage.enteredAt)}`);

    if (session.cart && session.cart.items.length > 0) {
      lines.push(`🛒 Carrinho: ${session.cart.items.length} itens (R$ ${session.cart.total_amount.toFixed(2)})`);
    }

    if (session.customerData?.name) {
      lines.push(`👤 Cliente: ${session.customerData.name}`);
    }

    if (session.customerData?.address) {
      lines.push(`📍 Endereço: ${session.customerData.address.street}, ${session.customerData.address.number}`);
    }

    return lines.join('\n');
  }

  // ============== HANDLERS DE ESTADO ==============

  private async handleIdleState(
    session: ConversationSession,
    message: string,
  ): Promise<StateTransitionResult> {
    // Verificar se é comando de carrinho
    if (this.isCartCommand(message)) {
      // Permanece em idle, mas notifica que carrinho está ativo
      return {
        newState: 'collecting_order',
        response: 'Ótimo! Vamos às compras. O que você gostaria?',
        context: { state: 'collecting_order' },
      };
    }

    // Verificar se é saudação
    if (this.isGreeting(message)) {
      return {
        newState: 'idle',
        response: 'Olá! Bem-vindo(a)! Como posso ajudar? 😊',
        context: {},
      };
    }

    // Verificar se é pergunta sobre pedido
    if (this.isOrderStatusQuery(message)) {
      // TODO: Implementar busca de pedido
      return {
        newState: 'idle',
        response: 'Posso verificar o status do seu pedido. Qual é o número?',
        context: {},
      };
    }

    // Iniciar coleta de pedido
    return await this.transitionTo(session, 'collecting_order');
  }

  private async handleCollectingOrder(
    session: ConversationSession,
    message: string,
  ): Promise<StateTransitionResult> {
    // Parse mensagem para identificar produtos
    const parsed = this.parseProductFromMessage(message);

    if (!parsed.productName) {
      return {
        newState: 'collecting_order',
        response: 'Não entendi qual produto. Quer ver o cardápio?',
        context: {},
      };
    }

    // Adicionar ao carrinho
    try {
      await this.cartService.addItem({
        tenantId: session.conversation.tenant_id,
        customerPhone: session.conversation.customer_phone,
        produtoId: parsed.productId || 'unknown',
        produtoName: parsed.productName,
        quantity: parsed.quantity,
        unitPrice: parsed.price || 0,
      });

      const cart = await this.cartService.getOrCreateCart(
        session.conversation.tenant_id,
        session.conversation.customer_phone,
      );

      // Verificar se há mais produtos ou transicionar
      if (this.hasMoreProductsIntent(message)) {
        return {
          newState: 'collecting_order',
          response: `Adicionado! Algo mais? Seu carrinho:\n${this.cartService.generateSummary(cart)}`,
          context: {},
        };
      }

      // Pedir confirmação ou mais info
      return await this.transitionTo(session, 'collecting_name', {
        pending_order: cart,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const context = { tenantId: session.conversation.tenant_id, customerPhone: session.conversation.customer_phone };
      const fallback = this.errorHandler.handleError(err, context);

      return {
        newState: 'collecting_order',
        response: fallback.message,
        context: {},
      };
    }
  }

  private async handleCollectingName(
    session: ConversationSession,
    message: string,
  ): Promise<StateTransitionResult> {
    const name = this.extractName(message);

    if (!name || !this.isValidName(name)) {
      return {
        newState: 'collecting_name',
        response: 'Qual é o seu nome? (para o pedido)',
        context: {},
      };
    }

    await this.updateCustomerData(session, { name });

    return await this.transitionTo(session, 'collecting_address');
  }

  private async handleCollectingAddress(
    session: ConversationSession,
    message: string,
  ): Promise<StateTransitionResult> {
    const deliveryType = this.detectDeliveryType(message);

    if (deliveryType === 'pickup') {
      await this.updateCustomerData(session, { delivery_type: 'pickup' });
      return await this.transitionTo(session, 'confirming_order');
    }

    // Coletar endereço
    const address = this.extractAddress(message);

    if (!address) {
      return {
        newState: 'collecting_address',
        response: 'Qual é o endereço de entrega? (rua, número, bairro, cidade)',
        context: {},
      };
    }

    await this.updateCustomerData(session, { address, delivery_type: 'delivery' });

    return await this.transitionTo(session, 'collecting_phone');
  }

  private async handleCollectingPhone(
    session: ConversationSession,
    message: string,
  ): Promise<StateTransitionResult> {
    const phone = this.extractPhone(message);

    if (!phone || !this.isValidPhone(phone)) {
      return {
        newState: 'collecting_phone',
        response: 'Qual é o seu telefone para contato?',
        context: {},
      };
    }

    await this.updateCustomerData(session, { phone });

    return await this.transitionTo(session, 'confirming_order');
  }

  private async handleCollectingNotes(
    session: ConversationSession,
    message: string,
  ): Promise<StateTransitionResult> {
    await this.updateCustomerData(session, { notes: message });

    return await this.transitionTo(session, 'confirming_order');
  }

  private async handleConfirmingOrder(
    session: ConversationSession,
    message: string,
  ): Promise<StateTransitionResult> {
    const normalized = message.toLowerCase().trim();

    // Confirmar
    if (this.isConfirmation(normalized)) {
      return await this.transitionTo(session, 'waiting_payment');
    }

    // Cancelar
    if (this.isCancellation(normalized)) {
      await this.abandonSession(session, 'user_cancelled');
      return {
        newState: 'idle',
        response: 'Pedido cancelado. Quando quiser fazer um novo pedido, é só chamar!',
        context: { state: 'idle' },
      };
    }

    // Modificar
    if (this.isModification(normalized)) {
      return await this.transitionTo(session, 'collecting_order');
    }

    // Solicitar resumo
    if (normalized.includes('resumo') || normalized.includes('ver')) {
      const cart = await this.cartService.getOrCreateCart(
        session.conversation.tenant_id,
        session.conversation.customer_phone,
      );
      return {
        newState: 'confirming_order',
        response: this.cartService.generateSummary(cart),
        context: {},
      };
    }

    return {
      newState: 'confirming_order',
      response: 'Confirma o pedido? (sim/não) ou diga o que quer modificar.',
      context: {},
    };
  }

  private async handleWaitingPayment(
    session: ConversationSession,
    message: string,
  ): Promise<StateTransitionResult> {
    const normalized = message.toLowerCase().trim();

    // Selecionar forma de pagamento
    if (this.isPaymentMethod(normalized)) {
      // TODO: Processar pagamento
      return {
        newState: 'waiting_payment',
        response: 'Processando pagamento...',
        context: {},
      };
    }

    return {
      newState: 'waiting_payment',
      response: 'Como prefere pagar? (PIX, cartão ou dinheiro)',
      context: {},
    };
  }

  private async handleCompletedState(
    session: ConversationSession,
    message: string,
  ): Promise<StateTransitionResult> {
    // Verificar se quer fazer novo pedido
    if (this.isNewOrderIntent(message)) {
      return await this.transitionTo(session, 'idle');
    }

    return {
      newState: session.stage.currentState,
      response: 'Seu pedido está em andamento! Posso ajudar com mais alguma coisa?',
      context: {},
    };
  }

  private async handleSessionTimeout(
    session: ConversationSession,
  ): Promise<StateTransitionResult> {
    this.logger.log('Session timed out', {
      conversationId: session.conversation.id,
      lastState: session.stage.currentState,
    });

    await this.abandonSession(session, 'timeout');

    return {
      newState: 'idle',
      response: 'Sua sessão expirou. Quando quiser fazer um pedido, é só chamar! 😊',
      context: { state: 'idle' },
    };
  }

  // ============== MÉTODOS PRIVADOS ==============

  private buildStageContext(conversation: any): StageContext {
    const state = (conversation?.context?.state as ConversationState) || 'idle';
    return {
      currentState: state,
      enteredAt: conversation?.started_at ? new Date(conversation.started_at) : new Date(),
      messageCount: 0,
      lastMessageAt: conversation?.last_message_at ? new Date(conversation.last_message_at) : undefined,
    };
  }

  private isValidTransition(from: ConversationState, to: ConversationState): boolean {
    const allowed = STATE_TRANSITIONS[from] || [];
    return allowed.includes(to) || from === to;
  }

  private getStateLabel(state: ConversationState): string {
    const labels: Record<ConversationState, string> = {
      idle: 'Início',
      collecting_order: 'Escolhendo produtos',
      collecting_name: 'Seu nome',
      collecting_address: 'Endereço',
      collecting_phone: 'Telefone',
      collecting_notes: 'Observações',
      collecting_cash_change: 'Troco',
      confirming_order: 'Confirmando pedido',
      confirming_stock_adjustment: 'Ajuste de quantidade',
      waiting_payment: 'Pagamento',
      order_confirmed: 'Pedido confirmado',
      order_completed: 'Pedido completo',
    };
    return labels[state] || state;
  }

  private generateStateTransitionMessage(
    from: ConversationState,
    to: ConversationState,
    session: ConversationSession,
  ): string {
    const messages: Record<string, string> = {
      'collecting_order->collecting_name': 'Ótima escolha! Agora, qual é o seu nome para o pedido?',
      'collecting_name->collecting_address': `Prazer, ${session.customerData?.name || 'você'}! O endereço de entrega é o mesmo do cadastro?`,
      'collecting_address->collecting_phone': 'Perfeito! Qual é o telefone para contato?',
      'collecting_phone->confirming_order': 'Tudo certo! Vamos ver seu pedido:',
    };

    const key = `${from}->${to}`;
    return messages[key] || 'Pode continuar...';
  }

  private isCartCommand(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('carrinho') ||
      lower.includes('comprar') ||
      lower.includes('pedir') ||
      lower.includes('quero') ||
      lower.includes('manda');
  }

  private isGreeting(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.startsWith('oi') ||
      lower.startsWith('olá') ||
      lower.startsWith('ola') ||
      lower.startsWith('bom dia') ||
      lower.startsWith('boa tarde') ||
      lower.startsWith('boa noite') ||
      lower.startsWith('hey');
  }

  private isOrderStatusQuery(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('status') ||
      lower.includes('pedido') && (lower.includes('onde') || lower.includes('quando') || lower.includes('rastreio'));
  }

  private isConfirmation(message: string): boolean {
    return message === 'sim' || message === 's' || message === 'confirmo' || message === 'confirma' || message === 'ok';
  }

  private isCancellation(message: string): boolean {
    return message === 'não' || message === 'nao' || message === 'n' || message === 'cancela' || message === 'cancelar';
  }

  private isModification(message: string): boolean {
    return message.includes('modificar') || message.includes('alterar') || message.includes('mudar') || message.includes('trocar');
  }

  private isNewOrderIntent(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('novo pedido') || lower.includes('outro') || lower.includes('mais');
  }

  private isPaymentMethod(message: string): boolean {
    return message.includes('pix') || message.includes('cartão') || message.includes('cartao') || message.includes('dinheiro');
  }

  private hasMoreProductsIntent(message: string): boolean {
    const lower = message.toLowerCase();
    return lower.includes('mais') || lower.includes('também') || lower.includes('tambem') || lower.includes('e');
  }

  private parseProductFromMessage(message: string): { productName?: string; productId?: string; quantity: number; price?: number } {
    // TODO: Implementar parser mais robusto com IA
    const match = message.match(/(\d+)?\s*(.+)/);
    return {
      productName: match ? match[2].trim() : undefined,
      quantity: match && match[1] ? parseInt(match[1], 10) : 1,
    };
  }

  private extractName(message: string): string | undefined {
    // TODO: Implementar extração de nome
    return message.trim();
  }

  private isValidName(name: string): boolean {
    return name.length >= 2 && name.length <= 100;
  }

  private detectDeliveryType(message: string): 'delivery' | 'pickup' | 'unknown' {
    const lower = message.toLowerCase();
    if (lower.includes('retirada') || lower.includes('buscar') || lower.includes('pegar')) {
      return 'pickup';
    }
    if (lower.includes('entrega') || lower.includes('endereço')) {
      return 'delivery';
    }
    return 'unknown';
  }

  private extractAddress(message: string): any | undefined {
    // TODO: Implementar extração de endereço com parser
    return undefined;
  }

  private extractPhone(message: string): string | undefined {
    const match = message.match(/\d{10,11}/);
    return match ? match[0] : undefined;
  }

  private isValidPhone(phone: string): boolean {
    return phone.length >= 10 && phone.length <= 11;
  }

  private getTimeoutMinutes(): number {
    const raw = this.config.get<string>('WHATSAPP_SESSION_TIMEOUT_MINUTES') || '';
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MINUTES;
  }

  private formatTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h`;
    return `${Math.floor(diffHour / 24)}d`;
  }
}