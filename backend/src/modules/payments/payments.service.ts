import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pagamento, PagamentoStatus, MetodoPagamento } from '../../database/entities/Pagamento.entity';
import { Pedido, PedidoStatus } from '../../database/entities/Pedido.entity';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import * as QRCode from 'qrcode';

export interface CreatePaymentDto {
  pedido_id: string;
  method: MetodoPagamento;
  amount: number;
}

export interface PaymentResult {
  pagamento: Pagamento;
  qr_code?: string; // Base64 do QR Code (para Pix)
  qr_code_url?: string; // URL do QR Code
  copy_paste?: string; // Chave Pix para copiar e colar
  message?: string; // Mensagem para o cliente
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
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Cria um pagamento para um pedido
   */
  async createPayment(
    tenantId: string,
    createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentResult> {
    this.logger.log(
      `Creating payment for order ${createPaymentDto.pedido_id}, method: ${createPaymentDto.method}`,
    );

    // Buscar pedido
    const pedido = await this.pedidosRepository.findOne({
      where: { id: createPaymentDto.pedido_id, tenant_id: tenantId },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }

    // Validar que pedido está pendente de pagamento
    if (pedido.status !== PedidoStatus.PENDENTE_PAGAMENTO) {
      throw new BadRequestException(
        `Pedido não está pendente de pagamento. Status atual: ${pedido.status}`,
      );
    }

    // Validar valor (converter para número para garantir comparação correta)
    const totalAmount = Number(pedido.total_amount);
    if (createPaymentDto.amount !== totalAmount) {
      // Permitir pequena diferença de arredondamento (0.01)
      const diff = Math.abs(createPaymentDto.amount - totalAmount);
      if (diff > 0.01) {
        throw new BadRequestException(
          `Valor do pagamento (R$ ${createPaymentDto.amount.toFixed(2)}) não confere com o total do pedido (R$ ${totalAmount.toFixed(2)})`,
        );
      }
    }

    // Aplicar desconto Pix (5%)
    let valorFinal = createPaymentDto.amount;
    if (createPaymentDto.method === MetodoPagamento.PIX) {
      valorFinal = createPaymentDto.amount * 0.95; // 5% desconto
      this.logger.log(`Pix discount applied: R$ ${createPaymentDto.amount} -> R$ ${valorFinal.toFixed(2)}`);
    }

    // Criar pagamento
    const pagamento = this.pagamentosRepository.create({
      tenant_id: tenantId,
      pedido_id: createPaymentDto.pedido_id,
      method: createPaymentDto.method,
      amount: valorFinal,
      status: PagamentoStatus.PENDING,
      metadata: {},
    });

    await this.pagamentosRepository.save(pagamento);

    // Processar pagamento conforme método
    const result = await this.processPayment(pagamento, pedido);

    this.logger.log(`Payment created: ${pagamento.id}, status: ${pagamento.status}`);

    return result;
  }

  /**
   * Processa o pagamento conforme o método escolhido
   */
  private async processPayment(
    pagamento: Pagamento,
    pedido: Pedido,
  ): Promise<PaymentResult> {
    switch (pagamento.method) {
      case MetodoPagamento.PIX:
        return await this.processPixPayment(pagamento, pedido);

      case MetodoPagamento.DINHEIRO:
        return await this.processCashPayment(pagamento, pedido);

      case MetodoPagamento.CREDITO:
      case MetodoPagamento.DEBITO:
        return await this.processCardPayment(pagamento, pedido);

      case MetodoPagamento.BOLETO:
        return await this.processBoletoPayment(pagamento, pedido);

      default:
        throw new BadRequestException(`Método de pagamento não suportado: ${pagamento.method}`);
    }
  }

  /**
   * Processa pagamento Pix
   */
  private async processPixPayment(
    pagamento: Pagamento,
    pedido: Pedido,
  ): Promise<PaymentResult> {
    this.logger.log(`Processing Pix payment for order ${pedido.order_no}`);

    // Gerar QR Code Pix (mock para desenvolvimento)
    const pixData = this.generatePixData(pedido, pagamento);
    
    // Gerar QR Code em base64
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

    // Atualizar metadata do pagamento
    pagamento.metadata = {
      pix_qr_code: qrCodeBase64,
      pix_qr_code_url: qrCodeUrl,
      pix_copy_paste: pixData,
    };

    await this.pagamentosRepository.save(pagamento);

    return {
      pagamento,
      qr_code: qrCodeBase64,
      qr_code_url: qrCodeUrl,
      copy_paste: pixData,
      message: this.generatePixMessage(pedido, pagamento, pixData),
    };
  }

  /**
   * Gera dados Pix (mock - em produção usar API real como GerenciaNet)
   * Formato EMC (EMV Code) simplificado para desenvolvimento
   */
  private generatePixData(pedido: Pedido, pagamento: Pagamento): string {
    // Mock: Em produção, usar API real (GerenciaNet, Stripe, etc)
    const chavePix = this.configService.get<string>('PIX_KEY') || 'mock-chave-pix-123456789';
    const valor = Number(pagamento.amount).toFixed(2);
    const descricao = `Pedido ${pedido.order_no}`;
    const merchantName = this.configService.get<string>('MERCHANT_NAME') || 'Loja';

    // Formato EMC (EMV Code) simplificado para desenvolvimento
    // Em produção, usar biblioteca especializada ou API do GerenciaNet
    // Estrutura: [ID][Tamanho][Valor]
    const payloadFormatIndicator = '01' + '02' + '01'; // Payload Format Indicator
    const merchantAccountInfo = '26' + String(chavePix.length + 4).padStart(2, '0') + '01' + String(chavePix.length).padStart(2, '0') + chavePix;
    const merchantCategoryCode = '52' + '04' + '0000'; // MCC genérico
    const transactionCurrency = '53' + '03' + '986'; // BRL
    const transactionAmount = '54' + String(valor.length + 2).padStart(2, '0') + valor;
    const countryCode = '58' + '02' + 'BR';
    const merchantNameField = '59' + String(merchantName.length).padStart(2, '0') + merchantName;
    const merchantCity = '60' + '09' + 'SAO PAULO';
    const additionalDataField = '62' + String(descricao.length + 5).padStart(2, '0') + '05' + String(descricao.length).padStart(2, '0') + descricao;
    
    // CRC16 (simplificado - em produção calcular corretamente)
    const payload = payloadFormatIndicator + merchantAccountInfo + merchantCategoryCode + 
                    transactionCurrency + transactionAmount + countryCode + merchantNameField + 
                    merchantCity + additionalDataField;
    const crc = '6304'; // CRC16 simplificado (em produção calcular)

    return payload + crc;
  }

  /**
   * Gera mensagem para cliente sobre pagamento Pix
   */
  private generatePixMessage(
    pedido: Pedido,
    pagamento: Pagamento,
    pixData: string,
  ): string {
    const totalAmount = Number(pedido.total_amount);
    const paymentAmount = Number(pagamento.amount);
    const desconto = totalAmount - paymentAmount;
    const mensagem = `💳 *PAGAMENTO PIX*\n\n` +
      `📦 Pedido: *${pedido.order_no}*\n` +
      `💰 Valor original: R$ ${totalAmount.toFixed(2).replace('.', ',')}\n` +
      (desconto > 0 ? `🎁 Desconto Pix (5%): R$ ${desconto.toFixed(2).replace('.', ',')}\n` : '') +
      `💵 *Valor a pagar: R$ ${paymentAmount.toFixed(2).replace('.', ',')}*\n\n` +
      `📱 *Escaneie o QR Code acima ou copie a chave Pix:*\n\n` +
      `\`\`\`${pixData}\`\`\`\n\n` +
      `⏰ Após o pagamento, seu pedido será confirmado automaticamente!`;

    return mensagem;
  }

  /**
   * Processa pagamento em dinheiro
   */
  private async processCashPayment(
    pagamento: Pagamento,
    pedido: Pedido,
  ): Promise<PaymentResult> {
    this.logger.log(`Processing cash payment for order ${pedido.order_no}`);

    // Pagamento em dinheiro requer confirmação manual
    pagamento.status = PagamentoStatus.PENDING;
    pagamento.metadata = {
      requires_manual_confirmation: true,
    };

    await this.pagamentosRepository.save(pagamento);

    return {
      pagamento,
      message: `💵 *PAGAMENTO EM DINHEIRO*\n\n` +
        `📦 Pedido: *${pedido.order_no}*\n` +
        `💰 Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n\n` +
        `⏳ Aguarde a confirmação do pagamento pela loja.\n` +
        `Você receberá uma notificação quando o pagamento for confirmado.`,
    };
  }

  /**
   * Processa pagamento com cartão
   */
  private async processCardPayment(
    pagamento: Pagamento,
    pedido: Pedido,
  ): Promise<PaymentResult> {
    this.logger.log(`Processing card payment for order ${pedido.order_no}`);

    // Mock: Em produção, integrar com Stripe/GerenciaNet
    const provider = this.configService.get<string>('PAYMENT_PROVIDER') || 'mock';

    if (provider === 'mock') {
      // Simular processamento
      pagamento.status = PagamentoStatus.PROCESSING;
      pagamento.metadata = {
        provider: 'mock',
        simulated: true,
      };

      await this.pagamentosRepository.save(pagamento);

      // Simular confirmação após 2 segundos (em produção seria via webhook)
      setTimeout(async () => {
        await this.confirmPayment(pagamento.id, pagamento.tenant_id);
      }, 2000);

      return {
        pagamento,
        message: `💳 *PAGAMENTO COM CARTÃO*\n\n` +
          `📦 Pedido: *${pedido.order_no}*\n` +
          `💰 Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n` +
          `💳 Método: ${pagamento.method === MetodoPagamento.CREDITO ? 'Crédito' : 'Débito'}\n\n` +
          `⏳ Processando pagamento...\n` +
          `Você receberá uma notificação quando o pagamento for confirmado.`,
      };
    }

    // TODO: Integração real com Stripe/GerenciaNet
    throw new BadRequestException('Integração com gateway de pagamento não configurada');
  }

  /**
   * Processa pagamento com boleto
   */
  private async processBoletoPayment(
    pagamento: Pagamento,
    pedido: Pedido,
  ): Promise<PaymentResult> {
    this.logger.log(`Processing boleto payment for order ${pedido.order_no}`);

    // Mock: Em produção, gerar boleto real
    const boletoUrl = `https://example.com/boleto/${pagamento.id}`;
    const boletoBarcode = '34191.09008 01234.567890 12345.678901 2 12345678901234';

    pagamento.metadata = {
      boleto_url: boletoUrl,
      boleto_barcode: boletoBarcode,
    };

    await this.pagamentosRepository.save(pagamento);

    return {
      pagamento,
      message: `📄 *BOLETO BANCÁRIO*\n\n` +
        `📦 Pedido: *${pedido.order_no}*\n` +
        `💰 Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n\n` +
        `📄 Código de barras:\n` +
        `\`\`\`${boletoBarcode}\`\`\`\n\n` +
        `🔗 Acesse o link para imprimir o boleto:\n` +
        `${boletoUrl}\n\n` +
        `⏰ Vencimento: ${new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}\n\n` +
        `⏳ Após o pagamento, seu pedido será confirmado automaticamente!`,
    };
  }

  /**
   * Confirma um pagamento (chamado via webhook ou manualmente)
   */
  async confirmPayment(pagamentoId: string, tenantId: string): Promise<Pagamento> {
    const pagamento = await this.pagamentosRepository.findOne({
      where: { id: pagamentoId, tenant_id: tenantId },
      relations: ['pedido'],
    });

    if (!pagamento) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    if (pagamento.status === PagamentoStatus.PAID) {
      this.logger.warn(`Payment ${pagamentoId} already confirmed`);
      return pagamento;
    }

    // Atualizar status do pagamento
    pagamento.status = PagamentoStatus.PAID;
    await this.pagamentosRepository.save(pagamento);

    // Atualizar status do pedido
    const pedido = pagamento.pedido;
    const oldStatus = pedido.status;
    
    if (pedido.status === PedidoStatus.PENDENTE_PAGAMENTO) {
      pedido.status = PedidoStatus.CONFIRMADO;
      await this.pedidosRepository.save(pedido);
      this.logger.log(`Order ${pedido.order_no} confirmed after payment`);

      // Notificar cliente sobre confirmação de pagamento
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
        // Não falhar a confirmação se a notificação falhar
      }
    }

    return pagamento;
  }

  /**
   * Busca pagamento por ID
   */
  async findById(pagamentoId: string, tenantId: string): Promise<Pagamento> {
    const pagamento = await this.pagamentosRepository.findOne({
      where: { id: pagamentoId, tenant_id: tenantId },
      relations: ['pedido'],
    });

    if (!pagamento) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    return pagamento;
  }

  /**
   * Busca pagamentos de um pedido
   */
  async findByPedido(pedidoId: string, tenantId: string): Promise<Pagamento[]> {
    return await this.pagamentosRepository.find({
      where: { pedido_id: pedidoId, tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
  }
}
