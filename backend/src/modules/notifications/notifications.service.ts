import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappConversation } from '../../database/entities/WhatsappConversation.entity';
import { WhatsappMessage } from '../../database/entities/WhatsappMessage.entity';
import { Pedido, PedidoStatus, CanalVenda } from '../../database/entities/Pedido.entity';
import { Pagamento, MetodoPagamento } from '../../database/entities/Pagamento.entity';
import { DbContextService } from '../common/services/db-context.service';

export interface NotificationMessage {
  to: string; // numero do WhatsApp
  message: string;
  imageUrl?: string; // Para QR Code Pix
  interactiveList?: {
    title: string;
    description: string;
    buttonText: string;
    footerText?: string;
    sections: Array<{
      title: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  };
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly db: DbContextService,
    private readonly configService: ConfigService,
  ) {}

  async notifyPaymentConfirmed(
    tenantId: string,
    pagamento: Pagamento,
    pedido: Pedido,
  ): Promise<void> {
    this.logger.log(`Notifying payment confirmation for order ${pedido.order_no}`);

    const conversationRepository = this.db.getRepository(WhatsappConversation);
    const conversation = await this.findConversationByOrder(tenantId, pedido.id);
    const trackingUrl = this.buildTrackingUrl(pedido.order_no);
    const message = this.generatePaymentConfirmedMessage(pedido, pagamento, trackingUrl);

    const whatsappSent = await this.sendWhatsappIfPossible(conversation, {
      message,
      metadata: {
        type: 'payment_confirmed',
        pedido_id: pedido.id,
        pagamento_id: pagamento.id,
      },
    });

    const emailSent = await this.sendOrderEmailIfPossible(
      pedido,
      `Pagamento confirmado - Pedido ${pedido.order_no}`,
      this.buildOrderEmailHtml({
        eyebrow: 'pagamento confirmado',
        title: 'Pagamento aprovado. Seu pedido entrou na trilha certa.',
        intro:
          'O pagamento foi reconhecido e a equipe ja pode seguir com a preparacao sem atrito.',
        pedido,
        payment: pagamento,
        accentColor: '#10b981',
        noteTitle: 'O que acontece agora',
        noteBody: this.getNextStepSummary(pedido, PedidoStatus.CONFIRMADO),
        bulletPoints: this.getStatusActionItems(pedido, PedidoStatus.CONFIRMADO),
        ctaLabel: 'Acompanhar pedido',
        ctaUrl: trackingUrl,
      }),
      'payment_confirmed',
    );

    if (!whatsappSent && !emailSent) {
      this.logger.warn(`No delivery channel available for payment confirmation of ${pedido.order_no}`);
    }

    if (conversation) {
      conversation.status = 'order_placed';
      conversation.context = {
        ...(conversation.context || {}),
        state: 'order_confirmed',
        waiting_payment: false,
      };
      await conversationRepository.save(conversation);
    }
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

    const conversationRepository = this.db.getRepository(WhatsappConversation);
    const conversation = await this.findConversationByOrder(tenantId, pedido.id);
    const trackingUrl = this.buildTrackingUrl(pedido.order_no);
    const message = this.generateOrderStatusChangeMessage(
      pedido,
      oldStatus,
      newStatus,
      trackingUrl,
    );
    const statusMeta = this.getStatusMeta(newStatus);

    const whatsappSent = await this.sendWhatsappIfPossible(conversation, {
      message,
      metadata: {
        type: 'order_status_change',
        pedido_id: pedido.id,
        old_status: oldStatus,
        new_status: newStatus,
      },
    });

    const emailSent = await this.sendOrderEmailIfPossible(
      pedido,
      `${statusMeta.label} - Pedido ${pedido.order_no}`,
      this.buildOrderEmailHtml({
        eyebrow: 'status atualizado',
        title: statusMeta.emailTitle,
        intro: statusMeta.emailIntro,
        pedido,
        accentColor: statusMeta.accentColor,
        noteTitle: 'Proximo movimento esperado',
        noteBody: this.getNextStepSummary(pedido, newStatus),
        bulletPoints: this.getStatusActionItems(pedido, newStatus),
        ctaLabel: 'Ver acompanhamento completo',
        ctaUrl: trackingUrl,
      }),
      'order_status_change',
    );

    if (!whatsappSent && !emailSent) {
      this.logger.warn(`No delivery channel available for status update of ${pedido.order_no}`);
    }

    if (conversation && newStatus === PedidoStatus.ENTREGUE) {
      conversation.context = {
        ...(conversation.context || {}),
        state: 'order_completed',
      };
      await conversationRepository.save(conversation);
    }
  }

  async notifyPaymentPending(
    tenantId: string,
    pedido: Pedido,
    pagamento: Pagamento,
  ): Promise<void> {
    this.logger.log(`Notifying payment pending for order ${pedido.order_no}`);

    const conversation = await this.findConversationByOrder(tenantId, pedido.id);
    const trackingUrl = this.buildTrackingUrl(pedido.order_no);

    let message = '';
    let imageUrl: string | undefined;
    let codeLabel: string | undefined;
    let codeValue: string | undefined;

    if (pagamento.method === 'pix' && pagamento.metadata?.pix_qr_code) {
      message = this.generatePixReminderMessage(pedido, pagamento, trackingUrl);
      imageUrl = pagamento.metadata.pix_qr_code;
      codeLabel = 'Pix copia e cola';
      codeValue =
        typeof pagamento.metadata?.pix_copy_paste === 'string'
          ? pagamento.metadata.pix_copy_paste
          : undefined;
    } else {
      message = this.generatePaymentReminderMessage(pedido, pagamento, trackingUrl);
    }

    const whatsappSent = await this.sendWhatsappIfPossible(conversation, {
      message,
      imageUrl,
      metadata: {
        type: 'payment_reminder',
        pedido_id: pedido.id,
        pagamento_id: pagamento.id,
      },
    });

    const emailSent = await this.sendOrderEmailIfPossible(
      pedido,
      `Pagamento pendente - Pedido ${pedido.order_no}`,
      this.buildOrderEmailHtml({
        eyebrow: 'pagamento pendente',
        title:
          pagamento.method === MetodoPagamento.PIX
            ? 'Seu pagamento ainda pode ser retomado sem perder o contexto.'
            : 'O pedido ja foi recebido e aguarda a confirmacao do pagamento.',
        intro:
          pagamento.method === MetodoPagamento.PIX
            ? 'O acompanhamento guarda o mesmo contexto do checkout para voce concluir com mais tranquilidade.'
            : 'Assim que o pagamento entrar, o pedido segue automaticamente para a operacao.',
        pedido,
        payment: pagamento,
        accentColor: '#f59e0b',
        noteTitle: 'Como destravar a operacao',
        noteBody: this.getNextStepSummary(pedido, PedidoStatus.PENDENTE_PAGAMENTO),
        bulletPoints: this.getStatusActionItems(pedido, PedidoStatus.PENDENTE_PAGAMENTO),
        codeLabel,
        codeValue,
        ctaLabel: 'Retomar acompanhamento',
        ctaUrl: trackingUrl,
      }),
      'payment_pending',
    );

    if (!whatsappSent && !emailSent) {
      this.logger.warn(`No delivery channel available for payment reminder of ${pedido.order_no}`);
    }
  }

  private generatePaymentConfirmedMessage(
    pedido: Pedido,
    pagamento: Pagamento,
    trackingUrl: string,
  ): string {
    return [
      this.getGreetingLine(pedido.customer_name),
      '',
      'PAGAMENTO CONFIRMADO',
      '',
      `Pedido: ${pedido.order_no}`,
      `Metodo: ${this.getPaymentMethodLabel(pagamento.method)}`,
      `Valor: ${this.formatCurrency(Number(pagamento.amount))}`,
      `Recebimento: ${this.getDeliveryTypeLabel(pedido.delivery_type)}`,
      '',
      'Seu pagamento foi reconhecido e a operacao ja pode seguir.',
      this.getNextStepSummary(pedido, PedidoStatus.CONFIRMADO),
      '',
      `Acompanhe seu pedido: ${trackingUrl}`,
    ].join('\n');
  }

  private generateOrderStatusChangeMessage(
    pedido: Pedido,
    oldStatus: PedidoStatus | null,
    newStatus: PedidoStatus,
    trackingUrl: string,
  ): string {
    const statusMeta = this.getStatusMeta(newStatus);

    if (oldStatus === null || oldStatus === undefined) {
      return [
        this.getGreetingLine(pedido.customer_name),
        '',
        'PEDIDO RECEBIDO',
        '',
        `Pedido: ${pedido.order_no}`,
        `Total: ${this.formatCurrency(Number(pedido.total_amount))}`,
        `Recebimento: ${this.getDeliveryTypeLabel(pedido.delivery_type)}`,
        '',
        'Sua compra entrou no fluxo certo.',
        this.getNextStepSummary(pedido, PedidoStatus.PENDENTE_PAGAMENTO),
        '',
        `Acompanhe: ${trackingUrl}`,
      ].join('\n');
    }

    return [
      this.getGreetingLine(pedido.customer_name),
      '',
      'ATUALIZACAO DO PEDIDO',
      '',
      `Pedido: ${pedido.order_no}`,
      `Status atual: ${statusMeta.label}`,
      `Recebimento: ${this.getDeliveryTypeLabel(pedido.delivery_type)}`,
      '',
      statusMeta.whatsappBody,
      this.getNextStepSummary(pedido, newStatus),
      '',
      `Acompanhe: ${trackingUrl}`,
    ].join('\n');
  }

  private generatePixReminderMessage(
    pedido: Pedido,
    pagamento: Pagamento,
    trackingUrl: string,
  ): string {
    const copyPaste =
      typeof pagamento.metadata?.pix_copy_paste === 'string'
        ? pagamento.metadata.pix_copy_paste
        : '';

    return [
      this.getGreetingLine(pedido.customer_name),
      '',
      'PAGAMENTO PENDENTE',
      '',
      `Pedido: ${pedido.order_no}`,
      `Valor: ${this.formatCurrency(Number(pagamento.amount))}`,
      `Recebimento: ${this.getDeliveryTypeLabel(pedido.delivery_type)}`,
      '',
      'Seu Pix ainda pode ser concluido usando o mesmo contexto da compra.',
      copyPaste ? 'Pix copia e cola:' : '',
      copyPaste,
      '',
      this.getNextStepSummary(pedido, PedidoStatus.PENDENTE_PAGAMENTO),
      '',
      `Retome o acompanhamento: ${trackingUrl}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private generatePaymentReminderMessage(
    pedido: Pedido,
    pagamento: Pagamento,
    trackingUrl: string,
  ): string {
    return [
      this.getGreetingLine(pedido.customer_name),
      '',
      'PAGAMENTO PENDENTE',
      '',
      `Pedido: ${pedido.order_no}`,
      `Valor: ${this.formatCurrency(Number(pagamento.amount))}`,
      `Metodo: ${this.getPaymentMethodLabel(pagamento.method)}`,
      '',
      'O pedido ja foi recebido e aguarda a confirmacao do pagamento.',
      this.getNextStepSummary(pedido, PedidoStatus.PENDENTE_PAGAMENTO),
      '',
      `Acompanhe: ${trackingUrl}`,
    ].join('\n');
  }

  private async findConversationByOrder(
    tenantId: string,
    pedidoId: string,
  ): Promise<WhatsappConversation | null> {
    return await this.db.getRepository(WhatsappConversation).findOne({
      where: {
        tenant_id: tenantId,
        pedido_id: pedidoId,
      },
    });
  }

  private async sendWhatsappIfPossible(
    conversation: WhatsappConversation | null,
    notification: Omit<NotificationMessage, 'to'>,
  ): Promise<boolean> {
    if (!conversation) {
      return false;
    }

    try {
      const messageRepository = this.db.getRepository(WhatsappMessage);
      const whatsappMessage = messageRepository.create({
        conversation_id: conversation.id,
        direction: 'outbound',
        body: notification.message,
        message_type: notification.imageUrl ? 'image' : 'text',
      });
      await messageRepository.save(whatsappMessage);

      await this.sendWhatsAppMessage({
        ...notification,
        to: conversation.customer_phone,
      });

      this.logger.log(`WhatsApp notification sent to ${conversation.customer_phone}`);
      return true;
    } catch (error) {
      this.logger.error('Error sending WhatsApp notification', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          conversationId: conversation.id,
          pedidoId: conversation.pedido_id,
        },
      });
      return false;
    }
  }

  private async sendOrderEmailIfPossible(
    pedido: Pedido,
    subject: string,
    html: string,
    context: string,
  ): Promise<boolean> {
    const email = (pedido.customer_email || '').trim();
    if (!email) {
      return false;
    }

    try {
      await this.sendEmail(email, subject, html);
      this.logger.log(`Email notification sent to ${email} (${context})`);
      return true;
    } catch (error) {
      this.logger.error('Error sending email notification', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          pedidoId: pedido.id,
          orderNo: pedido.order_no,
          email,
          type: context,
        },
      });
      return false;
    }
  }

  private buildOrderEmailHtml(options: {
    eyebrow: string;
    title: string;
    intro: string;
    pedido: Pedido;
    accentColor: string;
    payment?: Pagamento;
    noteTitle?: string;
    noteBody?: string;
    bulletPoints?: string[];
    codeLabel?: string;
    codeValue?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  }): string {
    const trackingUrl = options.ctaUrl || this.buildTrackingUrl(options.pedido.order_no);
    const rows = [
      ['Pedido', options.pedido.order_no],
      ['Status', this.getStatusMeta(options.pedido.status).label],
      ['Recebimento', this.getDeliveryTypeLabel(options.pedido.delivery_type)],
      ['Canal', this.getChannelLabel(options.pedido.channel)],
      ['Total', this.formatCurrency(Number(options.pedido.total_amount))],
    ];

    const paymentHtml = options.payment
      ? `
        <div style="margin-top:20px;border:1px solid #e2e8f0;border-radius:20px;padding:18px;background:#f8fafc;">
          <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;">pagamento</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;color:#0f172a;">
            <tr>
              <td style="padding:6px 0;color:#64748b;">Metodo</td>
              <td align="right" style="padding:6px 0;font-weight:600;">${this.escapeHtml(this.getPaymentMethodLabel(options.payment.method))}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#64748b;">Valor</td>
              <td align="right" style="padding:6px 0;font-weight:600;">${this.escapeHtml(this.formatCurrency(Number(options.payment.amount)))}</td>
            </tr>
          </table>
        </div>
      `
      : '';

    const noteHtml =
      options.noteTitle || options.noteBody
        ? `
          <div style="margin-top:20px;border:1px solid #e2e8f0;border-radius:20px;padding:20px;background:#ffffff;">
            ${options.noteTitle ? `<p style="margin:0 0 10px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;">${this.escapeHtml(options.noteTitle)}</p>` : ''}
            ${options.noteBody ? `<p style="margin:0;font-size:15px;line-height:1.75;color:#334155;">${this.escapeHtml(options.noteBody)}</p>` : ''}
          </div>
        `
        : '';

    const bulletHtml = options.bulletPoints?.length
      ? `
          <div style="margin-top:20px;border:1px solid #e2e8f0;border-radius:20px;padding:20px;background:#ffffff;">
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;">detalhes que importam</p>
            ${options.bulletPoints
              .map(
                (bullet) => `
                  <div style="margin-top:10px;border-radius:16px;background:#f8fafc;padding:14px 16px;font-size:14px;line-height:1.7;color:#334155;">
                    ${this.escapeHtml(bullet)}
                  </div>
                `,
              )
              .join('')}
          </div>
        `
      : '';

    const codeHtml =
      options.codeLabel && options.codeValue
        ? `
          <div style="margin-top:20px;border:1px solid #e2e8f0;border-radius:20px;padding:20px;background:#ffffff;">
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;">${this.escapeHtml(options.codeLabel)}</p>
            <div style="border-radius:16px;background:#0f172a;padding:16px;font-family:'Courier New',monospace;font-size:13px;line-height:1.6;color:#e2e8f0;word-break:break-word;">
              ${this.escapeHtml(options.codeValue)}
            </div>
          </div>
        `
        : '';

    return `
      <div style="margin:0;padding:32px 16px;background:#e2e8f0;font-family:Segoe UI,Arial,sans-serif;">
        <div style="max-width:640px;margin:0 auto;border-radius:28px;overflow:hidden;background:#ffffff;border:1px solid rgba(15,23,42,0.08);box-shadow:0 32px 80px rgba(15,23,42,0.14);">
          <div style="padding:32px;background:linear-gradient(135deg, ${options.accentColor} 0%, #0f172a 78%);color:#ffffff;">
            <p style="margin:0;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;opacity:0.78;">${this.escapeHtml(options.eyebrow)}</p>
            <h1 style="margin:18px 0 0;font-size:30px;line-height:1.2;font-weight:700;">${this.escapeHtml(options.title)}</h1>
            <p style="margin:16px 0 0;font-size:15px;line-height:1.8;max-width:520px;color:rgba(255,255,255,0.86);">${this.escapeHtml(options.intro)}</p>
          </div>
          <div style="padding:32px;">
            <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#334155;">${this.escapeHtml(this.getGreetingLine(options.pedido.customer_name))}</p>
            <div style="border:1px solid #e2e8f0;border-radius:22px;padding:20px;background:#f8fafc;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;color:#0f172a;">
                ${rows
                  .map(
                    ([label, value]) => `
                      <tr>
                        <td style="padding:8px 0;color:#64748b;">${this.escapeHtml(label)}</td>
                        <td align="right" style="padding:8px 0;font-weight:600;">${this.escapeHtml(value)}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </table>
            </div>
            ${paymentHtml}
            ${noteHtml}
            ${bulletHtml}
            ${codeHtml}
            <div style="margin-top:24px;">
              <a href="${this.escapeHtml(trackingUrl)}" style="display:inline-block;border-radius:18px;background:#0f172a;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                ${this.escapeHtml(options.ctaLabel || 'Acompanhar pedido')}
              </a>
            </div>
            <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#64748b;">
              Se preferir, use este link diretamente: <a href="${this.escapeHtml(trackingUrl)}" style="color:#0f172a;">${this.escapeHtml(trackingUrl)}</a>
            </p>
            <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#64748b;">
              ${this.escapeHtml(this.getStoreName())} segue usando esse acompanhamento como referencia oficial da compra.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  private getStatusMeta(status: PedidoStatus): {
    label: string;
    whatsappBody: string;
    emailTitle: string;
    emailIntro: string;
    accentColor: string;
  } {
    const meta: Record<
      PedidoStatus,
      {
        label: string;
        whatsappBody: string;
        emailTitle: string;
        emailIntro: string;
        accentColor: string;
      }
    > = {
      [PedidoStatus.PENDENTE_PAGAMENTO]: {
        label: 'Pagamento pendente',
        whatsappBody: 'O pedido ja foi recebido e aguarda a confirmacao do pagamento.',
        emailTitle: 'Seu pedido ja esta registrado e aguarda o pagamento.',
        emailIntro:
          'Assim que a confirmacao entrar, a operacao segue automaticamente para a preparacao.',
        accentColor: '#f59e0b',
      },
      [PedidoStatus.CONFIRMADO]: {
        label: 'Confirmado',
        whatsappBody: 'Seu pedido esta confirmado e a operacao ja pode avancar.',
        emailTitle: 'Pagamento confirmado e pedido em curso.',
        emailIntro:
          'A compra esta segura e a equipe ja pode seguir para a etapa seguinte com mais fluidez.',
        accentColor: '#0ea5e9',
      },
      [PedidoStatus.EM_PRODUCAO]: {
        label: 'Em preparacao',
        whatsappBody: 'A equipe ja esta cuidando do seu pedido com prioridade.',
        emailTitle: 'Seu pedido entrou em preparacao.',
        emailIntro:
          'A separacao ou producao ja esta em andamento, com a mesma leitura clara do acompanhamento premium.',
        accentColor: '#06b6d4',
      },
      [PedidoStatus.PRONTO]: {
        label: 'Pronto',
        whatsappBody: 'Seu pedido concluiu a preparacao e aguarda o ultimo movimento.',
        emailTitle: 'Seu pedido esta pronto.',
        emailIntro:
          'Tudo foi preparado e a compra avancou para o ponto em que retirada ou expedicao pode acontecer.',
        accentColor: '#10b981',
      },
      [PedidoStatus.EM_TRANSITO]: {
        label: 'Em transito',
        whatsappBody: 'Seu pedido ja saiu e segue para a etapa final da jornada.',
        emailTitle: 'Seu pedido ja esta em rota.',
        emailIntro:
          'A compra deixou a base e agora segue para a entrega, mantendo o mesmo acompanhamento de ponta a ponta.',
        accentColor: '#8b5cf6',
      },
      [PedidoStatus.ENTREGUE]: {
        label: 'Entregue',
        whatsappBody: 'Seu pedido foi concluido com sucesso. Obrigado pela preferencia.',
        emailTitle: 'Seu pedido foi entregue.',
        emailIntro:
          'A jornada foi concluida e este acompanhamento continua servindo como registro elegante da compra.',
        accentColor: '#16a34a',
      },
      [PedidoStatus.CANCELADO]: {
        label: 'Cancelado',
        whatsappBody:
          'Este pedido foi encerrado. Se voce nao solicitou isso, entre em contato com a equipe.',
        emailTitle: 'Este pedido foi cancelado.',
        emailIntro:
          'O fluxo foi interrompido e mantivemos o registro claro para facilitar qualquer retomada ou suporte.',
        accentColor: '#ef4444',
      },
    };

    return meta[status];
  }

  private getNextStepSummary(pedido: Pedido, status: PedidoStatus): string {
    switch (status) {
      case PedidoStatus.PENDENTE_PAGAMENTO:
        return pedido.delivery_type === 'pickup'
          ? 'Conclua o pagamento para liberar a preparacao e acompanhar quando a retirada ficar pronta.'
          : 'Conclua o pagamento para liberar a preparacao e acompanhar quando a entrega avancar.';
      case PedidoStatus.CONFIRMADO:
        return pedido.delivery_type === 'pickup'
          ? 'Agora a equipe segue para deixar tudo pronto para uma retirada rapida e segura.'
          : 'Agora a equipe segue para a preparacao e depois para a expedicao do pedido.';
      case PedidoStatus.EM_PRODUCAO:
        return pedido.delivery_type === 'pickup'
          ? 'A proxima atualizacao importante sera quando o pedido estiver pronto para retirada.'
          : 'A proxima atualizacao importante sera quando o pedido estiver pronto para envio.';
      case PedidoStatus.PRONTO:
        return pedido.delivery_type === 'pickup'
          ? 'Tenha o codigo do pedido em maos para agilizar a retirada.'
          : 'A proxima atualizacao esperada e a saida do pedido para entrega.';
      case PedidoStatus.EM_TRANSITO:
        return 'A proxima atualizacao esperada e a conclusao da entrega.';
      case PedidoStatus.ENTREGUE:
        return 'Esse acompanhamento continua servindo como comprovante e referencia da compra.';
      case PedidoStatus.CANCELADO:
        return 'Se precisar retomar a compra, o codigo do pedido ajuda a equipe a continuar sem retrabalho.';
    }
  }

  private getStatusActionItems(pedido: Pedido, status: PedidoStatus): string[] {
    switch (status) {
      case PedidoStatus.PENDENTE_PAGAMENTO:
        return [
          'O codigo do pedido continua sendo a referencia principal da compra.',
          pedido.delivery_type === 'pickup'
            ? 'Depois do pagamento, a retirada passa a aparecer claramente neste acompanhamento.'
            : 'Depois do pagamento, a preparacao e a entrega passam a evoluir neste acompanhamento.',
          'Voce pode reabrir o acompanhamento a qualquer momento com email ou telefone da compra.',
        ];
      case PedidoStatus.CONFIRMADO:
        return [
          'A compra ja esta segura e a operacao foi liberada para a equipe.',
          pedido.delivery_type === 'pickup'
            ? 'O ponto de virada agora e o status pronto para retirada.'
            : 'O ponto de virada agora e o status pronto para envio.',
          'O link de acompanhamento pode ser compartilhado com quem tambem precisa acompanhar.',
        ];
      case PedidoStatus.EM_PRODUCAO:
        return [
          'Essa e a etapa em que separacao, conferencia ou producao acontecem.',
          'O status muda automaticamente quando o ultimo movimento operacional for registrado.',
          'O codigo do pedido continua sendo o atalho mais rapido para atendimento.',
        ];
      case PedidoStatus.PRONTO:
        return pedido.delivery_type === 'pickup'
          ? [
              'Leve o codigo do pedido para uma retirada mais rapida.',
              'Este acompanhamento pode ser compartilhado com quem vai buscar.',
              'O resumo da compra segue disponivel como comprovante.',
            ]
          : [
              'O pedido concluiu a preparacao e aguarda a expedicao.',
              'A proxima leitura importante sera a saida para entrega.',
              'O acompanhamento continua valido ate a conclusao da jornada.',
            ];
      case PedidoStatus.EM_TRANSITO:
        return [
          'A compra ja deixou a base e avanca para a ultima etapa.',
          'O acompanhamento continua sendo a referencia oficial do andamento.',
          'O resumo da compra continua pronto para consulta e compartilhamento.',
        ];
      case PedidoStatus.ENTREGUE:
        return [
          'A jornada foi concluida e o pedido segue registrado com clareza.',
          'O link de acompanhamento ainda funciona como referencia da compra.',
          'Se precisar de suporte depois, o codigo do pedido acelera o atendimento.',
        ];
      case PedidoStatus.CANCELADO:
        return [
          'O pedido foi encerrado e o historico continua preservado.',
          'Guarde o codigo do pedido para facilitar qualquer retomada ou suporte.',
          'Se voce nao solicitou o cancelamento, fale com a equipe.',
        ];
    }
  }

  private buildTrackingUrl(orderNo: string): string {
    const frontendUrl = (this.configService.get<string>('FRONTEND_URL') || '').trim();
    const baseUrl =
      frontendUrl ||
      (process.env.NODE_ENV === 'production'
        ? 'https://gtsofthub.com.br'
        : 'http://localhost:3000');

    return `${baseUrl.replace(/\/+$/, '')}/pedido?order=${encodeURIComponent(orderNo)}`;
  }

  private getStoreName(): string {
    return (this.configService.get<string>('MERCHANT_NAME') || '').trim() || 'GTSoftHub';
  }

  private getGreetingLine(customerName?: string): string {
    return customerName?.trim() ? `Ola, ${customerName.trim()}!` : 'Ola!';
  }

  private getPaymentMethodLabel(method: MetodoPagamento): string {
    const labels: Record<MetodoPagamento, string> = {
      [MetodoPagamento.PIX]: 'Pix',
      [MetodoPagamento.CREDITO]: 'Cartao de credito',
      [MetodoPagamento.DEBITO]: 'Cartao de debito',
      [MetodoPagamento.DINHEIRO]: 'Dinheiro',
      [MetodoPagamento.BOLETO]: 'Boleto',
    };

    return labels[method] || method;
  }

  private getDeliveryTypeLabel(deliveryType?: string | null): string {
    return deliveryType === 'delivery' ? 'Entrega' : 'Retirada';
  }

  private getChannelLabel(channel?: CanalVenda | null): string {
    const labels: Record<CanalVenda, string> = {
      [CanalVenda.ECOMMERCE]: 'Loja online',
      [CanalVenda.PDV]: 'PDV',
      [CanalVenda.WHATSAPP]: 'WhatsApp',
    };

    return channel ? labels[channel] || channel : 'Nao informado';
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async sendWhatsAppMessage(notification: NotificationMessage): Promise<void> {
    const provider = (process.env.WHATSAPP_PROVIDER || 'mock').toLowerCase();

    if (provider === 'mock') {
      this.logger.log(
        `[MOCK] Would send WhatsApp message to ${notification.to}: ${notification.message.substring(0, 50)}...`,
      );
      if (notification.imageUrl) {
        this.logger.log(`[MOCK] Would send image: ${notification.imageUrl.substring(0, 50)}...`);
      }
      if (notification.interactiveList) {
        this.logger.log(
          `[MOCK] Would send interactive list to ${notification.to}: ${notification.interactiveList.title}`,
        );
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
      const canSendList = Boolean(notification.interactiveList);
      const endpoint = canSendMedia
        ? `${apiUrl}/message/sendMedia/${instance}`
        : canSendList
          ? `${apiUrl}/message/sendList/${instance}`
          : `${apiUrl}/message/sendText/${instance}`;

      const payload = canSendMedia
        ? {
            number: notification.to,
            mediatype: 'image',
            media: notification.imageUrl,
            caption: notification.message,
          }
        : canSendList
          ? {
              number: notification.to,
              title: notification.interactiveList?.title,
              description: notification.interactiveList?.description,
              buttonText: notification.interactiveList?.buttonText,
              footerText: notification.interactiveList?.footerText || '',
              values: (notification.interactiveList?.sections || []).map((section) => ({
                title: section.title,
                rows: section.rows.map((row) => ({
                  title: row.title,
                  description: row.description || '',
                  rowId: row.id,
                })),
              })),
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
