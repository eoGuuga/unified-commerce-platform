import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappConversation } from '../../database/entities/WhatsappConversation.entity';
import { Pedido, PedidoStatus } from '../../database/entities/Pedido.entity';
import { Pagamento, PagamentoStatus } from '../../database/entities/Pagamento.entity';
import { ConversationService } from '../whatsapp/services/conversation.service';

export interface NotificationMessage {
  to: string; // Número do WhatsApp
  message: string;
  imageUrl?: string; // Para QR Code Pix
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(WhatsappConversation)
    private conversationRepository: Repository<WhatsappConversation>,
    private conversationService: ConversationService,
  ) {}

  /**
   * Notifica cliente sobre confirmação de pagamento
   */
  async notifyPaymentConfirmed(
    tenantId: string,
    pagamento: Pagamento,
    pedido: Pedido,
  ): Promise<void> {
    this.logger.log(`Notifying payment confirmation for order ${pedido.order_no}`);

    // Buscar conversa associada ao pedido
    const conversation = await this.conversationRepository.findOne({
      where: {
        tenant_id: tenantId,
        pedido_id: pedido.id,
      },
    });

    if (!conversation) {
      this.logger.warn(`No conversation found for order ${pedido.order_no}`);
      return;
    }

    const message = this.generatePaymentConfirmedMessage(pedido, pagamento);

    // Salvar mensagem na conversa
    await this.conversationService.saveMessage(
      conversation.id,
      'outbound',
      message,
    );

    // Enviar via WhatsApp (mock para desenvolvimento)
    await this.sendWhatsAppMessage({
      to: conversation.customer_phone,
      message,
      metadata: {
        type: 'payment_confirmed',
        pedido_id: pedido.id,
        pagamento_id: pagamento.id,
      },
    });

    // Atualizar status da conversa
    conversation.status = 'order_placed';
    await this.conversationRepository.save(conversation);

    this.logger.log(`Payment confirmation sent to ${conversation.customer_phone}`);
  }

  /**
   * Notifica cliente sobre mudança de status do pedido
   */
  async notifyOrderStatusChange(
    tenantId: string,
    pedido: Pedido,
    oldStatus: PedidoStatus,
    newStatus: PedidoStatus,
  ): Promise<void> {
    this.logger.log(
      `Notifying order status change: ${oldStatus} → ${newStatus} for order ${pedido.order_no}`,
    );

    // Buscar conversa associada ao pedido
    const conversation = await this.conversationRepository.findOne({
      where: {
        tenant_id: tenantId,
        pedido_id: pedido.id,
      },
    });

    if (!conversation) {
      this.logger.warn(`No conversation found for order ${pedido.order_no}`);
      return;
    }

    const message = this.generateOrderStatusChangeMessage(pedido, oldStatus, newStatus);

    // Salvar mensagem na conversa
    await this.conversationService.saveMessage(
      conversation.id,
      'outbound',
      message,
    );

    // Enviar via WhatsApp
    await this.sendWhatsAppMessage({
      to: conversation.customer_phone,
      message,
      metadata: {
        type: 'order_status_change',
        pedido_id: pedido.id,
        old_status: oldStatus,
        new_status: newStatus,
      },
    });

    this.logger.log(`Order status notification sent to ${conversation.customer_phone}`);
  }

  /**
   * Notifica cliente sobre pagamento pendente (lembrete)
   */
  async notifyPaymentPending(
    tenantId: string,
    pedido: Pedido,
    pagamento: Pagamento,
  ): Promise<void> {
    this.logger.log(`Notifying payment pending for order ${pedido.order_no}`);

    const conversation = await this.conversationRepository.findOne({
      where: {
        tenant_id: tenantId,
        pedido_id: pedido.id,
      },
    });

    if (!conversation) {
      return;
    }

    let message = '';
    let imageUrl: string | undefined;

    if (pagamento.method === 'pix' && pagamento.metadata?.pix_qr_code) {
      message = this.generatePixReminderMessage(pedido, pagamento);
      imageUrl = pagamento.metadata.pix_qr_code;
    } else {
      message = this.generatePaymentReminderMessage(pedido, pagamento);
    }

    await this.conversationService.saveMessage(conversation.id, 'outbound', message);

    await this.sendWhatsAppMessage({
      to: conversation.customer_phone,
      message,
      imageUrl,
      metadata: {
        type: 'payment_reminder',
        pedido_id: pedido.id,
        pagamento_id: pagamento.id,
      },
    });
  }

  /**
   * Gera mensagem de confirmação de pagamento
   */
  private generatePaymentConfirmedMessage(
    pedido: Pedido,
    pagamento: Pagamento,
  ): string {
    const metodoPagamento = {
      pix: 'PIX',
      credito: 'Cartão de Crédito',
      debito: 'Cartão de Débito',
      dinheiro: 'Dinheiro',
      boleto: 'Boleto',
    }[pagamento.method] || pagamento.method;

    return `✅ *PAGAMENTO CONFIRMADO!*\n\n` +
      `📦 Pedido: *${pedido.order_no}*\n` +
      `💳 Método: ${metodoPagamento}\n` +
      `💰 Valor: R$ ${pagamento.amount.toFixed(2).replace('.', ',')}\n\n` +
      `🎉 Seu pedido foi confirmado e está sendo preparado!\n\n` +
      `Você receberá atualizações sobre o status do seu pedido.`;
  }

  /**
   * Gera mensagem de mudança de status do pedido
   */
  private generateOrderStatusChangeMessage(
    pedido: Pedido,
    oldStatus: PedidoStatus,
    newStatus: PedidoStatus,
  ): string {
    const statusMessages: Record<PedidoStatus, string> = {
      [PedidoStatus.PENDENTE_PAGAMENTO]: '⏳ Aguardando Pagamento',
      [PedidoStatus.CONFIRMADO]: '✅ Pedido Confirmado',
      [PedidoStatus.EM_PRODUCAO]: '👨‍🍳 Em Produção',
      [PedidoStatus.PRONTO]: '🎉 Pedido Pronto!',
      [PedidoStatus.EM_TRANSITO]: '🚚 Em Trânsito',
      [PedidoStatus.ENTREGUE]: '✅ Pedido Entregue',
      [PedidoStatus.CANCELADO]: '❌ Pedido Cancelado',
    };

    const statusMessage = statusMessages[newStatus] || newStatus;

    let message = `📦 *ATUALIZAÇÃO DO PEDIDO*\n\n` +
      `Pedido: *${pedido.order_no}*\n` +
      `Status: ${statusMessage}\n\n`;

    // Mensagens específicas por status
    switch (newStatus) {
      case PedidoStatus.EM_PRODUCAO:
        message += `👨‍🍳 Seu pedido está sendo preparado com muito carinho!\n` +
          `Você receberá uma notificação quando estiver pronto.`;
        break;

      case PedidoStatus.PRONTO:
        message += `🎉 Seu pedido está pronto para retirada/entrega!\n\n` +
          `💬 Entre em contato conosco para combinar a retirada ou entrega.`;
        break;

      case PedidoStatus.EM_TRANSITO:
        message += `🚚 Seu pedido saiu para entrega!\n` +
          `Acompanhe pelo código de rastreamento.`;
        break;

      case PedidoStatus.ENTREGUE:
        message += `✅ Seu pedido foi entregue!\n\n` +
          `Obrigado pela preferência! 💙\n` +
          `Esperamos que tenha gostado!`;
        break;

      case PedidoStatus.CANCELADO:
        message += `❌ Seu pedido foi cancelado.\n\n` +
          `Se você não solicitou o cancelamento, entre em contato conosco.`;
        break;

      default:
        message += `Você receberá atualizações sobre o status do seu pedido.`;
    }

    return message;
  }

  /**
   * Gera mensagem de lembrete de pagamento Pix
   */
  private generatePixReminderMessage(
    pedido: Pedido,
    pagamento: Pagamento,
  ): string {
    return `⏰ *LEMBRETE: PAGAMENTO PENDENTE*\n\n` +
      `📦 Pedido: *${pedido.order_no}*\n` +
      `💵 Valor: R$ ${pagamento.amount.toFixed(2).replace('.', ',')}\n\n` +
      `📱 *Escaneie o QR Code acima ou copie a chave Pix:*\n\n` +
      `\`\`\`${pagamento.metadata?.pix_copy_paste || ''}\`\`\`\n\n` +
      `⏰ Após o pagamento, seu pedido será confirmado automaticamente!`;
  }

  /**
   * Gera mensagem de lembrete de pagamento (outros métodos)
   */
  private generatePaymentReminderMessage(
    pedido: Pedido,
    pagamento: Pagamento,
  ): string {
    const metodoPagamento = {
      pix: 'PIX',
      credito: 'Cartão de Crédito',
      debito: 'Cartão de Débito',
      dinheiro: 'Dinheiro',
      boleto: 'Boleto',
    }[pagamento.method] || pagamento.method;

    return `⏰ *LEMBRETE: PAGAMENTO PENDENTE*\n\n` +
      `📦 Pedido: *${pedido.order_no}*\n` +
      `💵 Valor: R$ ${pagamento.amount.toFixed(2).replace('.', ',')}\n` +
      `💳 Método: ${metodoPagamento}\n\n` +
      `⏰ Aguardando confirmação do pagamento...`;
  }

  /**
   * Envia mensagem via WhatsApp (mock para desenvolvimento)
   */
  private async sendWhatsAppMessage(notification: NotificationMessage): Promise<void> {
    this.logger.log(
      `[MOCK] Would send WhatsApp message to ${notification.to}: ${notification.message.substring(0, 50)}...`,
    );

    // TODO: Em produção, integrar com Twilio/Evolution API
    // Por enquanto, apenas loga a mensagem
    if (notification.imageUrl) {
      this.logger.log(`[MOCK] Would send image: ${notification.imageUrl.substring(0, 50)}...`);
    }

    // Em produção:
    // await this.whatsappProvider.sendMessage(notification.to, notification.message);
    // if (notification.imageUrl) {
    //   await this.whatsappProvider.sendImage(notification.to, notification.imageUrl);
    // }
  }
}
