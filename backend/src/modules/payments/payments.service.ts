/**
 * ATENCAO: Integracao de pagamentos.
 *
 * Providers suportados:
 * - mercadopago (recomendado para BR)
 * - mock (apenas desenvolvimento)
 */
import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Pagamento, PagamentoStatus, MetodoPagamento } from '../../database/entities/Pagamento.entity';
import { Pedido, PedidoStatus } from '../../database/entities/Pedido.entity';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import * as QRCode from 'qrcode';
import { DbContextService } from '../common/services/db-context.service';
import { MercadoPagoProvider } from './providers/mercadopago.provider';

export interface CreatePaymentDto {
  pedido_id: string;
  method: MetodoPagamento;
  amount: number;
  payerEmail?: string;
  cardToken?: string;
  installments?: number;
}

export interface PaymentResult {
  pagamento: Pagamento;
  qr_code?: string; // Base64 do QR Code (para Pix)
  qr_code_url?: string; // URL do QR Code
  copy_paste?: string; // Chave Pix para copiar e colar
  message?: string; // Mensagem para o cliente
}

interface PaymentContext {
  payerEmail?: string;
  cardToken?: string;
  installments?: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Pagamento)
    private pagamentosRepository: Repository<Pagamento>,
    @InjectRepository(Pedido)
    private pedidosRepository: Repository<Pedido>,
    private configService: ConfigService,
    private readonly db: DbContextService,
    private readonly mercadoPagoProvider: MercadoPagoProvider,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Cria um pagamento para um pedido.
   */
  async createPayment(
    tenantId: string,
    createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentResult> {
    this.logger.log(
      `Creating payment for order ${createPaymentDto.pedido_id}, method: ${createPaymentDto.method}`,
    );

    const pedido = await this.db.getRepository(Pedido).findOne({
      where: { id: createPaymentDto.pedido_id, tenant_id: tenantId },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido nao encontrado');
    }

    if (pedido.status !== PedidoStatus.PENDENTE_PAGAMENTO) {
      throw new BadRequestException(
        `Pedido nao esta pendente de pagamento. Status atual: ${pedido.status}`,
      );
    }

    const existingPagamento = await this.db.getRepository(Pagamento).findOne({
      where: {
        tenant_id: tenantId,
        pedido_id: createPaymentDto.pedido_id,
        method: createPaymentDto.method,
        status: In([PagamentoStatus.PENDING, PagamentoStatus.PROCESSING]),
      },
      order: { created_at: 'DESC' },
    });

    if (existingPagamento) {
      this.logger.warn(
        `Reusing existing payment ${existingPagamento.id} for order ${createPaymentDto.pedido_id} (${createPaymentDto.method})`,
      );
      return this.buildPaymentResult(existingPagamento, pedido);
    }

    const totalAmount = Number(pedido.total_amount);
    if (createPaymentDto.amount !== totalAmount) {
      const diff = Math.abs(createPaymentDto.amount - totalAmount);
      if (diff > 0.01) {
        throw new BadRequestException(
          `Valor do pagamento (R$ ${createPaymentDto.amount.toFixed(2)}) nao confere com o total do pedido (R$ ${totalAmount.toFixed(2)})`,
        );
      }
    }

    let valorFinal = createPaymentDto.amount;
    if (createPaymentDto.method === MetodoPagamento.PIX) {
      valorFinal = createPaymentDto.amount * 0.95;
      this.logger.log(`Pix discount applied: R$ ${createPaymentDto.amount} -> R$ ${valorFinal.toFixed(2)}`);
    }

    const pagamentoRepo = this.db.getRepository(Pagamento);
    const pagamento = pagamentoRepo.create({
      tenant_id: tenantId,
      pedido_id: createPaymentDto.pedido_id,
      method: createPaymentDto.method,
      amount: valorFinal,
      status: PagamentoStatus.PENDING,
      metadata: {},
    });

    await pagamentoRepo.save(pagamento);

    const paymentContext: PaymentContext = {
      payerEmail: createPaymentDto.payerEmail,
      cardToken: createPaymentDto.cardToken,
      installments: createPaymentDto.installments,
    };

    const result = await this.processPayment(pagamento, pedido, paymentContext);

    this.logger.log(`Payment created: ${pagamento.id}, status: ${pagamento.status}`);

    return result;
  }

  private getPaymentProvider(): string {
    return (this.configService.get<string>('PAYMENT_PROVIDER') || 'mock').toLowerCase();
  }

  /**
   * Monta o resultado do pagamento a partir do registro existente (reuso).
   */
  private buildPaymentResult(pagamento: Pagamento, pedido: Pedido): PaymentResult {
    if (pagamento.method === MetodoPagamento.PIX) {
      const pixData = String(pagamento.metadata?.pix_copy_paste || '');
      return {
        pagamento,
        qr_code: typeof pagamento.metadata?.pix_qr_code === 'string' ? pagamento.metadata.pix_qr_code : undefined,
        qr_code_url: typeof pagamento.metadata?.pix_qr_code_url === 'string' ? pagamento.metadata.pix_qr_code_url : undefined,
        copy_paste: pixData || undefined,
        message: pixData ? this.generatePixMessage(pedido, pagamento, pixData) : undefined,
      };
    }

    if (pagamento.method === MetodoPagamento.BOLETO) {
      const boletoUrl = String(pagamento.metadata?.boleto_url || '');
      const boletoBarcode = String(pagamento.metadata?.boleto_barcode || '');
      const message =
        boletoUrl || boletoBarcode
          ? `BOLETO BANCARIO\n\n` +
            `Pedido: ${pedido.order_no}\n` +
            `Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n\n` +
            (boletoBarcode ? `Codigo de barras:\n${boletoBarcode}\n\n` : '') +
            (boletoUrl ? `Link do boleto:\n${boletoUrl}\n\n` : '') +
            `Apos o pagamento, seu pedido sera confirmado automaticamente.`
          : undefined;

      return {
        pagamento,
        message,
      };
    }

    if (pagamento.method === MetodoPagamento.DINHEIRO) {
      return {
        pagamento,
        message:
          `PAGAMENTO EM DINHEIRO\n\n` +
          `Pedido: ${pedido.order_no}\n` +
          `Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n\n` +
          `Aguarde a confirmacao do pagamento pela loja.`,
      };
    }

    if (pagamento.method === MetodoPagamento.CREDITO || pagamento.method === MetodoPagamento.DEBITO) {
      return {
        pagamento,
        message:
          `PAGAMENTO COM CARTAO\n\n` +
          `Pedido: ${pedido.order_no}\n` +
          `Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n` +
          `Metodo: ${pagamento.method === MetodoPagamento.CREDITO ? 'Credito' : 'Debito'}\n\n` +
          `Status: ${pagamento.status}\n` +
          `Voce recebera uma notificacao quando o pagamento for confirmado.`,
      };
    }

    return { pagamento };
  }

  private async processPayment(
    pagamento: Pagamento,
    pedido: Pedido,
    context: PaymentContext,
  ): Promise<PaymentResult> {
    switch (pagamento.method) {
      case MetodoPagamento.PIX:
        return await this.processPixPayment(pagamento, pedido, context);

      case MetodoPagamento.DINHEIRO:
        return await this.processCashPayment(pagamento, pedido);

      case MetodoPagamento.CREDITO:
      case MetodoPagamento.DEBITO:
        return await this.processCardPayment(pagamento, pedido, context);

      case MetodoPagamento.BOLETO:
        return await this.processBoletoPayment(pagamento, pedido, context);

      default:
        throw new BadRequestException(`Metodo de pagamento nao suportado: ${pagamento.method}`);
    }
  }

  private async processPixPayment(
    pagamento: Pagamento,
    pedido: Pedido,
    context: PaymentContext,
  ): Promise<PaymentResult> {
    this.logger.log(`Processing Pix payment for order ${pedido.order_no}`);

    const provider = this.getPaymentProvider();

    if (provider === 'mercadopago') {
      if (!this.mercadoPagoProvider.isConfigured()) {
        throw new BadRequestException('Mercado Pago nao configurado');
      }

      const pixResult = await this.mercadoPagoProvider.createPixPayment(
        Number(pagamento.amount),
        `Pedido ${pedido.order_no}`,
        pedido.order_no,
        context.payerEmail,
      );

      const qrCodeDataUrl = pixResult.qr_code_base64
        ? `data:image/png;base64,${pixResult.qr_code_base64}`
        : pixResult.qr_code;

      pagamento.status = PagamentoStatus.PENDING;
      pagamento.transaction_id = pixResult.transaction_id;
      pagamento.metadata = {
        provider: 'mercadopago',
        pix_qr_code: qrCodeDataUrl,
        pix_qr_code_url: undefined,
        pix_copy_paste: pixResult.copy_paste,
      };

      await this.db.getRepository(Pagamento).save(pagamento);

      return {
        pagamento,
        qr_code: qrCodeDataUrl,
        copy_paste: pixResult.copy_paste,
        message: this.generatePixMessage(pedido, pagamento, pixResult.copy_paste),
      };
    }

    // Mock (desenvolvimento).
    const pixData = this.generatePixData(pedido, pagamento);

    let qrCodeBase64: string | undefined;
    let qrCodeUrl: string | undefined;

    try {
      qrCodeBase64 = await QRCode.toDataURL(pixData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
      });
    } catch (error) {
      this.logger.error('Error generating QR Code for Pix payment', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          tenantId: pagamento?.tenant_id,
          pedidoId: pagamento?.pedido_id,
          pagamentoId: pagamento?.id,
          method: pagamento?.method,
        },
      });
    }

    pagamento.metadata = {
      pix_qr_code: qrCodeBase64,
      pix_qr_code_url: qrCodeUrl,
      pix_copy_paste: pixData,
    };

    await this.db.getRepository(Pagamento).save(pagamento);

    return {
      pagamento,
      qr_code: qrCodeBase64,
      qr_code_url: qrCodeUrl,
      copy_paste: pixData,
      message: this.generatePixMessage(pedido, pagamento, pixData),
    };
  }

  private generatePixData(pedido: Pedido, pagamento: Pagamento): string {
    const chavePix = this.configService.get<string>('PIX_KEY') || 'mock-chave-pix-123456789';
    const valor = Number(pagamento.amount).toFixed(2);
    const descricao = `Pedido ${pedido.order_no}`;
    const merchantName = this.configService.get<string>('MERCHANT_NAME') || 'Loja';

    const payloadFormatIndicator = '01' + '02' + '01';
    const merchantAccountInfo = '26' + String(chavePix.length + 4).padStart(2, '0') + '01' + String(chavePix.length).padStart(2, '0') + chavePix;
    const merchantCategoryCode = '52' + '04' + '0000';
    const transactionCurrency = '53' + '03' + '986';
    const transactionAmount = '54' + String(valor.length + 2).padStart(2, '0') + valor;
    const countryCode = '58' + '02' + 'BR';
    const merchantNameField = '59' + String(merchantName.length).padStart(2, '0') + merchantName;
    const merchantCity = '60' + '09' + 'SAO PAULO';
    const additionalDataField = '62' + String(descricao.length + 5).padStart(2, '0') + '05' + String(descricao.length).padStart(2, '0') + descricao;

    const payload = payloadFormatIndicator + merchantAccountInfo + merchantCategoryCode +
                    transactionCurrency + transactionAmount + countryCode + merchantNameField +
                    merchantCity + additionalDataField;
    const crc = '6304';

    return payload + crc;
  }

  private generatePixMessage(
    pedido: Pedido,
    pagamento: Pagamento,
    pixData: string,
  ): string {
    const totalAmount = Number(pedido.total_amount);
    const paymentAmount = Number(pagamento.amount);
    const desconto = totalAmount - paymentAmount;
    const mensagem = `PAGAMENTO PIX\n\n` +
      `Pedido: ${pedido.order_no}\n` +
      `Valor original: R$ ${totalAmount.toFixed(2).replace('.', ',')}\n` +
      (desconto > 0 ? `Desconto Pix (5%): R$ ${desconto.toFixed(2).replace('.', ',')}\n` : '') +
      `Valor a pagar: R$ ${paymentAmount.toFixed(2).replace('.', ',')}\n\n` +
      `Copie a chave Pix:\n\n` +
      `${pixData}\n\n` +
      `Apos o pagamento, seu pedido sera confirmado automaticamente.`;

    return mensagem;
  }

  private async processCashPayment(
    pagamento: Pagamento,
    pedido: Pedido,
  ): Promise<PaymentResult> {
    this.logger.log(`Processing cash payment for order ${pedido.order_no}`);

    pagamento.status = PagamentoStatus.PENDING;
    pagamento.metadata = {
      requires_manual_confirmation: true,
    };

    await this.db.getRepository(Pagamento).save(pagamento);

    return {
      pagamento,
      message: `PAGAMENTO EM DINHEIRO\n\n` +
        `Pedido: ${pedido.order_no}\n` +
        `Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n\n` +
        `Aguarde a confirmacao do pagamento pela loja.\n` +
        `Voce recebera uma notificacao quando o pagamento for confirmado.`,
    };
  }

  private async processCardPayment(
    pagamento: Pagamento,
    pedido: Pedido,
    context: PaymentContext,
  ): Promise<PaymentResult> {
    this.logger.log(`Processing card payment for order ${pedido.order_no}`);

    const provider = this.getPaymentProvider();

    if (provider === 'mock') {
      pagamento.status = PagamentoStatus.PROCESSING;
      pagamento.metadata = {
        provider: 'mock',
        simulated: true,
      };

      await this.db.getRepository(Pagamento).save(pagamento);

      setTimeout(async () => {
        await this.confirmPayment(pagamento.id, pagamento.tenant_id);
      }, 2000);

      return {
        pagamento,
        message: `PAGAMENTO COM CARTAO\n\n` +
          `Pedido: ${pedido.order_no}\n` +
          `Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n` +
          `Metodo: ${pagamento.method === MetodoPagamento.CREDITO ? 'Credito' : 'Debito'}\n\n` +
          `Processando pagamento...\n` +
          `Voce recebera uma notificacao quando o pagamento for confirmado.`,
      };
    }

    if (provider === 'mercadopago') {
      if (!this.mercadoPagoProvider.isConfigured()) {
        throw new BadRequestException('Mercado Pago nao configurado');
      }

      if (!context.cardToken) {
        throw new BadRequestException('cardToken e obrigatorio para pagamento com cartao');
      }

      const cardResult = await this.mercadoPagoProvider.createCardPayment(
        Number(pagamento.amount),
        `Pedido ${pedido.order_no}`,
        pedido.order_no,
        context.cardToken,
        context.installments || 1,
        context.payerEmail,
      );

      const status = (cardResult.status || '').toLowerCase();
      let mappedStatus = PagamentoStatus.PENDING;
      if (status === 'approved') {
        mappedStatus = PagamentoStatus.PROCESSING;
      } else if (status === 'in_process') {
        mappedStatus = PagamentoStatus.PROCESSING;
      } else if (status === 'rejected' || status === 'cancelled') {
        mappedStatus = PagamentoStatus.FAILED;
      }

      pagamento.status = mappedStatus;
      pagamento.transaction_id = cardResult.transaction_id;
      pagamento.metadata = {
        provider: 'mercadopago',
        status: cardResult.status,
        status_detail: cardResult.status_detail,
        payment_method_id: cardResult.payment_method_id,
      };

      await this.db.getRepository(Pagamento).save(pagamento);

      if (status === 'approved') {
        await this.confirmPayment(pagamento.id, pagamento.tenant_id);
      }

      return {
        pagamento,
        message: `PAGAMENTO COM CARTAO\n\n` +
          `Pedido: ${pedido.order_no}\n` +
          `Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n` +
          `Status: ${cardResult.status}\n` +
          `Voce recebera uma notificacao quando o pagamento for confirmado.`,
      };
    }

    throw new BadRequestException('Integracao com gateway de pagamento nao configurada');
  }

  private async processBoletoPayment(
    pagamento: Pagamento,
    pedido: Pedido,
    context: PaymentContext,
  ): Promise<PaymentResult> {
    this.logger.log(`Processing boleto payment for order ${pedido.order_no}`);

    const provider = this.getPaymentProvider();

    if (provider === 'mercadopago') {
      if (!this.mercadoPagoProvider.isConfigured()) {
        throw new BadRequestException('Mercado Pago nao configurado');
      }

      const boletoResult = await this.mercadoPagoProvider.createBoletoPayment(
        Number(pagamento.amount),
        `Pedido ${pedido.order_no}`,
        pedido.order_no,
        undefined,
        context.payerEmail,
      );

      pagamento.status = PagamentoStatus.PENDING;
      pagamento.transaction_id = boletoResult.transaction_id;
      pagamento.metadata = {
        provider: 'mercadopago',
        boleto_url: boletoResult.external_resource_url,
        boleto_barcode: boletoResult.barcode,
        boleto_expiration: boletoResult.date_of_expiration,
      };

      await this.db.getRepository(Pagamento).save(pagamento);

      return {
        pagamento,
        message: `BOLETO BANCARIO\n\n` +
          `Pedido: ${pedido.order_no}\n` +
          `Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n\n` +
          `Codigo de barras:\n${boletoResult.barcode}\n\n` +
          `Link do boleto:\n${boletoResult.external_resource_url}\n\n` +
          `Vencimento: ${boletoResult.date_of_expiration}\n\n` +
          `Apos o pagamento, seu pedido sera confirmado automaticamente.`,
      };
    }

    const boletoUrl = `https://example.com/boleto/${pagamento.id}`;
    const boletoBarcode = '34191.09008 01234.567890 12345.678901 2 12345678901234';

    pagamento.metadata = {
      boleto_url: boletoUrl,
      boleto_barcode: boletoBarcode,
    };

    await this.db.getRepository(Pagamento).save(pagamento);

    return {
      pagamento,
      message: `BOLETO BANCARIO\n\n` +
        `Pedido: ${pedido.order_no}\n` +
        `Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n\n` +
        `Codigo de barras:\n${boletoBarcode}\n\n` +
        `Link do boleto:\n${boletoUrl}\n\n` +
        `Vencimento: ${new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}\n\n` +
        `Apos o pagamento, seu pedido sera confirmado automaticamente.`,
    };
  }

  async confirmPayment(pagamentoId: string, tenantId: string): Promise<Pagamento> {
    const pagamento = await this.db.getRepository(Pagamento).findOne({
      where: { id: pagamentoId, tenant_id: tenantId },
      relations: ['pedido'],
    });

    if (!pagamento) {
      throw new NotFoundException('Pagamento nao encontrado');
    }

    if (pagamento.status === PagamentoStatus.PAID) {
      this.logger.warn(`Payment ${pagamentoId} already confirmed`);
      return pagamento;
    }

    pagamento.status = PagamentoStatus.PAID;
    await this.db.getRepository(Pagamento).save(pagamento);

    const pedido = pagamento.pedido;
    const oldStatus = pedido.status;

    if (pedido.status === PedidoStatus.PENDENTE_PAGAMENTO) {
      pedido.status = PedidoStatus.CONFIRMADO;
      await this.db.getRepository(Pedido).save(pedido);
      this.logger.log(`Order ${pedido.order_no} confirmed after payment`);

      try {
        await this.notificationsService.notifyPaymentConfirmed(
          pagamento.tenant_id,
          pagamento,
          pedido,
        );
      } catch (error) {
        this.logger.error('Error sending payment confirmation notification', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            tenantId: pagamento.tenant_id,
            pagamentoId: pagamento.id,
            pedidoId: pagamento.pedido_id,
            status: pagamento.status,
          },
        });
      }

      try {
        await this.notificationsService.notifyOrderStatusChange(
          pagamento.tenant_id,
          pedido,
          oldStatus,
          PedidoStatus.CONFIRMADO,
        );
      } catch (error) {
        this.logger.error('Error sending order status change notification', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            tenantId: pagamento.tenant_id,
            pedidoId: pagamento.pedido_id,
            oldStatus,
            newStatus: PedidoStatus.CONFIRMADO,
          },
        });
      }
    }

    return pagamento;
  }

  async findById(pagamentoId: string, tenantId: string): Promise<Pagamento> {
    const pagamento = await this.db.getRepository(Pagamento).findOne({
      where: { id: pagamentoId, tenant_id: tenantId },
      relations: ['pedido'],
    });

    if (!pagamento) {
      throw new NotFoundException('Pagamento nao encontrado');
    }

    return pagamento;
  }

  async findByPedido(pedidoId: string, tenantId: string): Promise<Pagamento[]> {
    return await this.db.getRepository(Pagamento).find({
      where: { pedido_id: pedidoId, tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
  }
}
