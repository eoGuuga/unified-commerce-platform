import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappConversation } from '../../../database/entities/WhatsappConversation.entity';
import { WhatsappMessage } from '../../../database/entities/WhatsappMessage.entity';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(WhatsappConversation)
    private conversationRepository: Repository<WhatsappConversation>,
    @InjectRepository(WhatsappMessage)
    private messageRepository: Repository<WhatsappMessage>,
  ) {}

  /**
   * Busca ou cria uma conversa
   */
  async getOrCreateConversation(
    tenantId: string,
    customerPhone: string,
    customerName?: string,
  ): Promise<WhatsappConversation> {
    let conversation = await this.conversationRepository.findOne({
      where: {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        status: 'active',
      },
      order: { last_message_at: 'DESC' },
    });

    if (!conversation) {
      conversation = this.conversationRepository.create({
        tenant_id: tenantId,
        customer_phone: customerPhone,
        customer_name: customerName,
        status: 'active',
        context: {},
        last_message_at: new Date(),
      });
      conversation = await this.conversationRepository.save(conversation);
      this.logger.log(`Created new conversation ${conversation.id} for ${customerPhone}`);
    } else {
      // Atualizar timestamp
      conversation.last_message_at = new Date();
      await this.conversationRepository.save(conversation);
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
    const conversation = await this.conversationRepository.findOne({
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

    await this.conversationRepository.save(conversation);
  }

  /**
   * Define o pedido_id na conversa
   */
  async setPedidoId(conversationId: string, pedidoId: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
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

    await this.conversationRepository.save(conversation);
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
    const message = this.messageRepository.create({
      conversation_id: conversationId,
      direction,
      body,
      message_type: messageType,
    });

    return await this.messageRepository.save(message);
  }

  /**
   * Busca conversa por ID
   */
  async findById(conversationId: string): Promise<WhatsappConversation | null> {
    return await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['pedido'],
    });
  }
}
