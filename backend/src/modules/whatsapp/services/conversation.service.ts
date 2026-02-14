import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { In, LessThan } from 'typeorm';
import { WhatsappConversation } from '../../../database/entities/WhatsappConversation.entity';
import { WhatsappMessage } from '../../../database/entities/WhatsappMessage.entity';
import { DbContextService } from '../../common/services/db-context.service';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly db: DbContextService,
    private readonly config: ConfigService,
  ) {}

  private getConversationTtlHours(): number {
    const raw = (this.config.get<string>('WHATSAPP_CONVERSATION_TTL_HOURS') || '').trim();
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return 12;
  }

  private getActiveGraceMinutes(): number {
    const raw = (this.config.get<string>('WHATSAPP_ACTIVE_GRACE_MINUTES') || '').trim();
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return 30;
  }

  private isCollectingState(state?: string): boolean {
    return [
      'collecting_order',
      'collecting_name',
      'collecting_address',
      'collecting_phone',
      'collecting_notes',
      'collecting_cash_change',
      'confirming_order',
      'confirming_stock_adjustment',
    ].includes(state || '');
  }

  private async finalizeStaleConversations(
    tenantId: string,
    customerPhone: string,
  ): Promise<void> {
    const conversationRepository = this.db.getRepository(WhatsappConversation);
    const ttlHours = this.getConversationTtlHours();
    const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);

    await conversationRepository.update(
      {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        status: In(['active', 'waiting_payment']),
        last_message_at: LessThan(cutoff),
      },
      { status: 'completed' },
    );
  }

  /**
   * Busca ou cria uma conversa
   */
  async getOrCreateConversation(
    tenantId: string,
    customerPhone: string,
    customerName?: string,
  ): Promise<WhatsappConversation> {
    const conversationRepository = this.db.getRepository(WhatsappConversation);

    await this.finalizeStaleConversations(tenantId, customerPhone);

    const waitingPaymentConversation = await conversationRepository.findOne({
      where: {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        status: 'waiting_payment',
      },
      order: { last_message_at: 'DESC' },
    });

    const activeConversation = await conversationRepository.findOne({
      where: {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        status: 'active',
      },
      order: { last_message_at: 'DESC' },
    });

    const now = Date.now();
    const activeState = activeConversation?.context?.state as string | undefined;
    const activeAgeMs = activeConversation?.last_message_at
      ? now - new Date(activeConversation.last_message_at).getTime()
      : Number.POSITIVE_INFINITY;
    const activeGraceMs = this.getActiveGraceMinutes() * 60 * 1000;

    const preferActive =
      !!activeConversation &&
      this.isCollectingState(activeState) &&
      activeAgeMs <= activeGraceMs;

    let conversation = preferActive
      ? activeConversation
      : waitingPaymentConversation || activeConversation || null;

    if (!conversation) {
      conversation = conversationRepository.create({
        tenant_id: tenantId,
        customer_phone: customerPhone,
        customer_name: customerName,
        status: 'active',
        context: {},
        last_message_at: new Date(),
      });
      conversation = await conversationRepository.save(conversation);
      this.logger.log(`Created new conversation ${conversation.id} for ${customerPhone}`);
    } else {
      // Atualizar timestamp
      conversation.last_message_at = new Date();
      await conversationRepository.save(conversation);
    }

    return conversation;
  }

  /**
   * Atualiza o contexto da conversa
   */
  async updateContext(
    conversationId: string,
    contextUpdates: Record<string, any>,
  ): Promise<void> {
    const conversationRepository = this.db.getRepository(WhatsappConversation);
    const conversation = await conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      this.logger.warn(`Conversation ${conversationId} not found`);
      return;
    }

    conversation.context = {
      ...conversation.context,
      ...contextUpdates,
    };

    await conversationRepository.save(conversation);
  }

  /**
   * Define o pedido_id na conversa
   */
  async setPedidoId(conversationId: string, pedidoId: string): Promise<void> {
    const conversationRepository = this.db.getRepository(WhatsappConversation);
    const conversation = await conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      this.logger.warn(`Conversation ${conversationId} not found`);
      return;
    }

    conversation.pedido_id = pedidoId;
    conversation.status = 'waiting_payment';
    conversation.context = {
      ...conversation.context,
      pedido_id: pedidoId,
      waiting_payment: true,
    };

    await conversationRepository.save(conversation);
  }

  /**
   * Atualiza o estado da conversa
   */
  async updateState(
    conversationId: string,
    state: string,
  ): Promise<void> {
    const conversationRepository = this.db.getRepository(WhatsappConversation);
    const conversation = await conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      this.logger.warn(`Conversation ${conversationId} not found`);
      return;
    }

    conversation.context = {
      ...conversation.context,
      state,
    };

    await conversationRepository.save(conversation);
  }

  /**
   * Salva dados do cliente no contexto
   */
  async saveCustomerData(
    conversationId: string,
    customerData: Record<string, any>,
  ): Promise<void> {
    const conversationRepository = this.db.getRepository(WhatsappConversation);
    const conversation = await conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      this.logger.warn(`Conversation ${conversationId} not found`);
      return;
    }

    // Atualizar customer_name se fornecido
    if (customerData.name) {
      conversation.customer_name = customerData.name;
    }

    conversation.context = {
      ...conversation.context,
      customer_data: {
        ...(conversation.context?.customer_data || {}),
        ...customerData,
      },
    };

    await conversationRepository.save(conversation);
  }

  /**
   * Salva pedido pendente no contexto (antes de confirmar)
   */
  async savePendingOrder(
    conversationId: string,
    pendingOrder: Record<string, any>,
  ): Promise<void> {
    const conversationRepository = this.db.getRepository(WhatsappConversation);
    const conversation = await conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      this.logger.warn(`Conversation ${conversationId} not found`);
      return;
    }

    conversation.context = {
      ...conversation.context,
      pending_order: pendingOrder,
    };

    await conversationRepository.save(conversation);
  }

  /**
   * Limpa o contexto de pedido pendente (após confirmar)
   */
  async clearPendingOrder(conversationId: string): Promise<void> {
    const conversationRepository = this.db.getRepository(WhatsappConversation);
    const conversation = await conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      this.logger.warn(`Conversation ${conversationId} not found`);
      return;
    }

    const {
      pending_order: _pending_order,
      stock_adjustment: _stock_adjustment,
      order_attempt_id: _order_attempt_id,
      ...restContext
    } = conversation.context || {};
    conversation.context = restContext;

    await conversationRepository.save(conversation);
  }

  /**
   * Limpa dados do cliente para iniciar novo pedido
   */
  async clearCustomerData(conversationId: string): Promise<void> {
    const conversationRepository = this.db.getRepository(WhatsappConversation);
    const conversation = await conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      this.logger.warn(`Conversation ${conversationId} not found`);
      return;
    }

    const {
      customer_data: _customer_data,
      ...restContext
    } = conversation.context || {};

    conversation.customer_name = null as unknown as string;
    conversation.context = restContext;

    await conversationRepository.save(conversation);
  }

  /**
   * Limpa pedido associado e contexto de pagamento
   */
  async clearPedido(conversationId: string): Promise<void> {
    const conversationRepository = this.db.getRepository(WhatsappConversation);
    const conversation = await conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      this.logger.warn(`Conversation ${conversationId} not found`);
      return;
    }

    const {
      pedido_id: _pedido_id,
      waiting_payment: _waiting_payment,
      order_attempt_id: _order_attempt_id,
      ...restContext
    } = conversation.context || {};

    conversation.pedido_id = null as unknown as string;
    conversation.status = 'active';
    conversation.context = restContext;

    await conversationRepository.save(conversation);
  }

  /**
   * Salva uma mensagem na conversa
   */
  async saveMessage(
    conversationId: string,
    direction: 'inbound' | 'outbound',
    body: string,
    messageType: 'text' | 'image' | 'document' = 'text',
  ): Promise<WhatsappMessage> {
    const messageRepository = this.db.getRepository(WhatsappMessage);
    const message = messageRepository.create({
      conversation_id: conversationId,
      direction,
      body,
      message_type: messageType,
    });

    return await messageRepository.save(message);
  }

  /**
   * Busca conversa por ID
   */
  async findById(conversationId: string): Promise<WhatsappConversation | null> {
    return await this.db.getRepository(WhatsappConversation).findOne({
      where: { id: conversationId },
      relations: ['pedido'],
    });
  }
}
