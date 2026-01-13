import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappConversation } from '../../database/entities/WhatsappConversation.entity';
import { WhatsappMessage } from '../../database/entities/WhatsappMessage.entity';
import { Pedido, PedidoStatus } from '../../database/entities/Pedido.entity';
import { Pagamento } from '../../database/entities/Pagamento.entity';

export interface NotificationMessage {
  to: string; // numero do WhatsApp
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
    @InjectRepository(WhatsappMessage)
    private messageRepository: Repository<WhatsappMessage>,
  ) {}

  async notifyPaymentConfirmed(
    tenantId: string,
    pagamento: Pagamento,
    pedido: Pedido,
  ): Promise<void> {
    this.logger.log(`Notifying payment confirmation for order ${pedido.order_no}`);

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

    const whatsappMessage = this.messageRepository.create({
      conversation_id: conversation.id,
      direction: 'outbound',
      body: message,
      message_type: 'text',
    });
    await this.messageRepository.save(whatsappMessage);

    await this.sendWhatsAppMessage({
      to: conversation.customer_phone,
      message,
      metadata: {
        type: 'payment_confirmed',
        pedido_id: pedido.id,
        pagamento_id: pagamento.id,
      },
    });

    conversation.status = 'order_placed';
    await this.conversationRepository.save(conversation);

    this.logger.log(`Payment confirmation sent to ${conversation.customer_phone}`);
  }

  async notifyOrderStatusChange(
    tenantId: string,
    pedido: Pedido,
    oldStatus: PedidoStatus | null,
    newStatus: PedidoStatus,
  ): Promise<void> {
    this.logger.log(
      `Notifying order status change: ${oldStatus || 'NEW'} -> ${newStatus} for order ${pedido.order_no}`,
    );

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

    const whatsappMessage = this.messageRepository.create({
      conversation_id: conversation.id,
      direction: 'outbound',
      body: message,
      message_type: 'text',
    });
    await this.messageRepository.save(whatsappMessage);

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

    const whatsappMessage = this.messageRepository.create({
      conversation_id: conversation.id,
      direction: 'outbound',
      body: message,
      message_type: 'text',
    });
    await this.messageRepository.save(whatsappMessage);

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

  private generatePaymentConfirmedMessage(
    pedido: Pedido,
    pagamento: Pagamento,
  ): string {
    const metodoPagamento = {
      pix: 'PIX',
      credito: 'Cartao de Credito',
      debito: 'Cartao de Debito',
      dinheiro: 'Dinheiro',
      boleto: 'Boleto',
    }[pagamento.method] || pagamento.method;

    return `PAGAMENTO CONFIRMADO!\n\n` +
      `Pedido: ${pedido.order_no}\n` +
      `Metodo: ${metodoPagamento}\n` +
      `Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n\n` +
      `Seu pedido foi confirmado e esta sendo preparado!\n\n` +
      `Voce recebera atualizacoes sobre o status do seu pedido.`;
  }

  private generateOrderStatusChangeMessage(
    pedido: Pedido,
    oldStatus: PedidoStatus | null,
    newStatus: PedidoStatus,
  ): string {
    const statusMessages: Record<PedidoStatus, string> = {
      [PedidoStatus.PENDENTE_PAGAMENTO]: 'Aguardando Pagamento',
      [PedidoStatus.CONFIRMADO]: 'Pedido Confirmado',
      [PedidoStatus.EM_PRODUCAO]: 'Em Producao',
      [PedidoStatus.PRONTO]: 'Pedido Pronto',
      [PedidoStatus.EM_TRANSITO]: 'Em Transito',
      [PedidoStatus.ENTREGUE]: 'Pedido Entregue',
      [PedidoStatus.CANCELADO]: 'Pedido Cancelado',
    };

    const statusMessage = statusMessages[newStatus] || newStatus;

    if (oldStatus === null || oldStatus === undefined) {
      return `PEDIDO CRIADO COM SUCESSO!\n\n` +
        `Pedido: ${pedido.order_no}\n` +
        `Total: R$ ${Number(pedido.total_amount).toFixed(2).replace('.', ',')}\n\n` +
        `Aguardando pagamento...\n\n` +
        `Voce recebera instrucoes de pagamento em breve!`;
    }

    let message = `ATUALIZACAO DO PEDIDO\n\n` +
      `Pedido: ${pedido.order_no}\n` +
      `Status: ${statusMessage}\n\n`;

    switch (newStatus) {
      case PedidoStatus.EM_PRODUCAO:
        message += `Seu pedido esta sendo preparado com carinho!\n` +
          `Voce recebera uma notificacao quando estiver pronto.`;
        break;

      case PedidoStatus.PRONTO:
        message += `Seu pedido esta pronto para retirada/entrega!\n\n` +
          `Entre em contato para combinar a retirada ou entrega.`;
        break;

      case PedidoStatus.EM_TRANSITO:
        message += `Seu pedido saiu para entrega!\n` +
          `Acompanhe pelo codigo de rastreamento.`;
        break;

      case PedidoStatus.ENTREGUE:
        message += `Seu pedido foi entregue!\n\n` +
          `Obrigado pela preferencia!`;
        break;

      case PedidoStatus.CANCELADO:
        message += `Seu pedido foi cancelado.\n\n` +
          `Se voce nao solicitou o cancelamento, entre em contato conosco.`;
        break;

      default:
        message += `Voce recebera atualizacoes sobre o status do seu pedido.`;
    }

    return message;
  }

  private generatePixReminderMessage(
    pedido: Pedido,
    pagamento: Pagamento,
  ): string {
    return `LEMBRETE: PAGAMENTO PENDENTE\n\n` +
      `Pedido: ${pedido.order_no}\n` +
      `Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n\n` +
      `Copie a chave Pix:\n\n` +
      `${pagamento.metadata?.pix_copy_paste || ''}\n\n` +
      `Apos o pagamento, seu pedido sera confirmado automaticamente.`;
  }

  private generatePaymentReminderMessage(
    pedido: Pedido,
    pagamento: Pagamento,
  ): string {
    const metodoPagamento = {
      pix: 'PIX',
      credito: 'Cartao de Credito',
      debito: 'Cartao de Debito',
      dinheiro: 'Dinheiro',
      boleto: 'Boleto',
    }[pagamento.method] || pagamento.method;

    return `LEMBRETE: PAGAMENTO PENDENTE\n\n` +
      `Pedido: ${pedido.order_no}\n` +
      `Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n` +
      `Metodo: ${metodoPagamento}\n\n` +
      `Aguardando confirmacao do pagamento...`;
  }

  private async sendWhatsAppMessage(notification: NotificationMessage): Promise<void> {
    const provider = (process.env.WHATSAPP_PROVIDER || 'mock').toLowerCase();

    if (provider === 'mock') {
      this.logger.log(
        `[MOCK] Would send WhatsApp message to ${notification.to}: ${notification.message.substring(0, 50)}...`,
      );
      if (notification.imageUrl) {
        this.logger.log(`[MOCK] Would send image: ${notification.imageUrl.substring(0, 50)}...`);
      }
      return;
    }

    if (provider === 'twilio') {
      const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
      const authToken = process.env.TWILIO_AUTH_TOKEN || '';
      const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || '';

      if (!accountSid || !authToken || !fromNumber) {
        throw new Error('Twilio nao configurado (TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_NUMBER)');
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const params = new URLSearchParams();
      params.set('From', fromNumber);
      params.set('To', `whatsapp:${notification.to}`);
      params.set('Body', notification.message);

      if (notification.imageUrl && !notification.imageUrl.startsWith('data:')) {
        params.set('MediaUrl', notification.imageUrl);
      }

      const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Twilio error: ${response.status} ${text}`);
      }

      return;
    }

    if (provider === 'evolution') {
      const apiUrl = process.env.EVOLUTION_API_URL || '';
      const apiKey = process.env.EVOLUTION_API_KEY || '';
      const instance = process.env.EVOLUTION_INSTANCE || 'default';

      if (!apiUrl || !apiKey) {
        throw new Error('Evolution API nao configurada (EVOLUTION_API_URL/EVOLUTION_API_KEY)');
      }

      const canSendMedia = notification.imageUrl && !notification.imageUrl.startsWith('data:');
      const endpoint = canSendMedia
        ? `${apiUrl}/message/sendMedia/${instance}`
        : `${apiUrl}/message/sendText/${instance}`;

      const payload = canSendMedia
        ? {
            number: notification.to,
            mediatype: 'image',
            media: notification.imageUrl,
            caption: notification.message,
          }
        : {
            number: notification.to,
            text: notification.message,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Evolution API error: ${response.status} ${text}`);
      }

      return;
    }

    this.logger.warn(`WhatsApp provider "${provider}" configurado mas nao implementado.`);
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const provider = (process.env.EMAIL_PROVIDER || 'mock').toLowerCase();

    if (provider === 'mock') {
      this.logger.log(`[MOCK] Would send email to ${to}: ${subject}`);
      return;
    }

    if (provider === 'resend') {
      const apiKey = process.env.RESEND_API_KEY || '';
      const from = process.env.EMAIL_FROM || '';
      if (!apiKey || !from) {
        throw new Error('Resend nao configurado (RESEND_API_KEY/EMAIL_FROM)');
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Resend error: ${response.status} ${text}`);
      }

      return;
    }

    this.logger.warn(`Email provider "${provider}" configurado mas nao implementado.`);
  }
}
