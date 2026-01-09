import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappConversation } from '../../database/entities/WhatsappConversation.entity';
import { WhatsappMessage } from '../../database/entities/WhatsappMessage.entity';
import { Pedido, PedidoStatus } from '../../database/entities/Pedido.entity';
import { Pagamento } from '../../database/entities/Pagamento.entity';
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
    @InjectRepository(WhatsappMessage)
    private messageRepository: Repository<WhatsappMessage>,
    @Inject(forwardRef(() => ConversationService))
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
    const whatsappMessage = this.messageRepository.create({
      conversation_id: conversation.id,
      direction: 'outbound',
      body: message,
      message_type: 'text',
    });
    await this.messageRepository.save(whatsappMessage);

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
    oldStatus: PedidoStatus | null,
    newStatus: PedidoStatus,
  ): Promise<void> {
    this.logger.log(
      `Notifying order status change: ${oldStatus || 'NEW'} → ${newStatus} for order ${pedido.order_no}`,
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
    const whatsappMessage = this.messageRepository.create({
      conversation_id: conversation.id,
      direction: 'outbound',
      body: message,
      message_type: 'text',
    });
    await this.messageRepository.save(whatsappMessage);

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
      `💰 Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n\n` +
      `🎉 Seu pedido foi confirmado e está sendo preparado!\n\n` +
      `Você receberá atualizações sobre o status do seu pedido.`;
  }

  /**
   * Gera mensagem de mudança de status do pedido
   */
  private generateOrderStatusChangeMessage(
    pedido: Pedido,
    oldStatus: PedidoStatus | null,
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

    // ✅ NOVO: Se é criação de pedido (oldStatus é null), mensagem especial
    if (oldStatus === null || oldStatus === undefined) {
      return `🎉 *PEDIDO CRIADO COM SUCESSO!*\n\n` +
        `📦 Pedido: *${pedido.order_no}*\n` +
        `💰 Total: R$ ${Number(pedido.total_amount).toFixed(2).replace('.', ',')}\n\n` +
        `⏳ Aguardando pagamento...\n\n` +
        `💬 Você receberá instruções de pagamento em breve!`;
    }

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
      `💵 Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n\n` +
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
      `💵 Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n` +
      `💳 Método: ${metodoPagamento}\n\n` +
      `⏰ Aguardando confirmação do pagamento...`;
  }

  /**
   * Envia mensagem via WhatsApp
   * ⚠️ MOCK: Em produção, integrar com Twilio/Evolution API
   * 
   * IMPLEMENTAÇÃO NECESSÁRIA:
   * 
   * 1. Instalar SDK do provider:
   *    npm install twilio
   *    # OU
   *    npm install @evolution-api/evolution-api
   * 
   * 2. Configurar variáveis de ambiente:
   *    - WHATSAPP_PROVIDER=twilio|evolution
   *    - TWILIO_ACCOUNT_SID=... (se Twilio)
   *    - TWILIO_AUTH_TOKEN=... (se Twilio)
   *    - TWILIO_WHATSAPP_NUMBER=whatsapp:+5511999999999
   *    - EVOLUTION_API_URL=... (se Evolution API)
   *    - EVOLUTION_API_KEY=... (se Evolution API)
   * 
   * 3. Exemplo Twilio:
   *    import twilio from 'twilio';
   *    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
   *    await client.messages.create({
   *      from: TWILIO_WHATSAPP_NUMBER,
   *      to: `whatsapp:${notification.to}`,
   *      body: notification.message,
   *    });
   * 
   * 4. Exemplo Evolution API:
   *    await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
   *      method: 'POST',
   *      headers: { 'apikey': EVOLUTION_API_KEY },
   *      body: JSON.stringify({
   *        number: notification.to,
   *        text: notification.message,
   *      }),
   *    });
   */
  private async sendWhatsAppMessage(notification: NotificationMessage): Promise<void> {
    const provider = process.env.WHATSAPP_PROVIDER || 'mock';
    
    if (provider === 'mock') {
      this.logger.log(
        `[MOCK] Would send WhatsApp message to ${notification.to}: ${notification.message.substring(0, 50)}...`,
      );

      // TODO: Em produção, integrar com Twilio/Evolution API
      // Por enquanto, apenas loga a mensagem
      if (notification.imageUrl) {
        this.logger.log(`[MOCK] Would send image: ${notification.imageUrl.substring(0, 50)}...`);
      }
      return;
    }

    // ⚠️ IMPLEMENTAR: Integração real com provider escolhido
    // Ver comentários acima para exemplos
    this.logger.warn(
      `[TODO] WhatsApp provider "${provider}" configurado mas não implementado. Usando mock.`,
    );
  }

  /**
   * Envia email (não implementado - usar para confirmações de pedido)
   * ⚠️ MOCK: Em produção, integrar com Nodemailer/SendGrid
   * 
   * IMPLEMENTAÇÃO NECESSÁRIA:
   * 
   * 1. Instalar Nodemailer:
   *    npm install nodemailer
   *    npm install @types/nodemailer --save-dev
   * 
   * 2. Configurar variáveis de ambiente:
   *    - EMAIL_PROVIDER=nodemailer|sendgrid
   *    - SMTP_HOST=smtp.gmail.com (se Gmail)
   *    - SMTP_PORT=587
   *    - SMTP_USER=seu-email@gmail.com
   *    - SMTP_PASS=sua-senha-app
   *    - EMAIL_FROM=noreply@suaempresa.com
   * 
   * 3. Exemplo Nodemailer:
   *    import nodemailer from 'nodemailer';
   *    const transporter = nodemailer.createTransport({
   *      host: SMTP_HOST,
   *      port: SMTP_PORT,
   *      secure: false,
   *      auth: { user: SMTP_USER, pass: SMTP_PASS },
   *    });
   *    await transporter.sendMail({
   *      from: EMAIL_FROM,
   *      to: to,
   *      subject: subject,
   *      html: html,
   *    });
   */
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const provider = process.env.EMAIL_PROVIDER || 'mock';
    
    if (provider === 'mock') {
      this.logger.log(`[MOCK] Would send email to ${to}: ${subject}`);
      return;
    }

    // ⚠️ IMPLEMENTAR: Integração real com Nodemailer/SendGrid
    // Ver comentários acima para exemplos
    this.logger.warn(
      `[TODO] Email provider "${provider}" configurado mas não implementado. Usando mock.`,
    );
  }
}
