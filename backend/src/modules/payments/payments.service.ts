/**
 * ⚠️ ATENÇÃO: INTEGRAÇÃO DE PAGAMENTOS
 * 
 * Este serviço atualmente usa MOCKS para desenvolvimento.
 * ANTES DE IR PARA PRODUÇÃO, você DEVE integrar com um gateway de pagamento real:
 * 
 * OPÇÕES RECOMENDADAS:
 * 
 * 1. STRIPE (Internacional)
 *    - Documentação: https://stripe.com/docs/payments
 *    - SDK: @stripe/stripe-js
 *    - Suporta: Cartão, Pix (Brasil), Boleto (Brasil)
 *    - Taxa: ~3.9% + R$ 0.40 por transação
 * 
 * 2. MERCADO PAGO (Brasil)
 *    - Documentação: https://www.mercadopago.com.br/developers/pt/docs
 *    - SDK: mercadopago
 *    - Suporta: Cartão, Pix, Boleto, PEC
 *    - Taxa: ~4.99% por transação
 * 
 * 3. GERENCIANET / EFI (Brasil)
 *    - Documentação: https://dev.gerencianet.com.br/
 *    - SDK: @gerencianet/gn-api-sdk-typescript
 *    - Suporta: Pix, Boleto, Cartão
 *    - Taxa: ~2.99% por transação
 * 
 * IMPLEMENTAÇÃO NECESSÁRIA:
 * 
 * 1. Instalar SDK do provider escolhido
 * 2. Configurar variáveis de ambiente:
 *    - PAYMENT_PROVIDER=stripe|mercadopago|gerencianet
 *    - STRIPE_SECRET_KEY=sk_... (se Stripe)
 *    - MERCADOPAGO_ACCESS_TOKEN=... (se Mercado Pago)
 *    - GERENCIANET_CLIENT_ID=... (se Gerencianet)
 *    - GERENCIANET_CLIENT_SECRET=... (se Gerencianet)
 * 
 * 3. Substituir métodos mock:
 *    - processPixPayment() - usar API real para gerar QR Code
 *    - processCardPayment() - usar SDK para processar cartão
 *    - processBoletoPayment() - usar API real para gerar boleto
 * 
 * 4. Implementar webhooks:
 *    - Criar endpoint POST /payments/webhook/:provider
 *    - Validar assinatura do webhook
 *    - Atualizar status do pagamento automaticamente
 * 
 * 5. Testes:
 *    - Usar ambiente sandbox/test do provider
 *    - Testar todos os métodos de pagamento
 *    - Testar webhooks de confirmação
 * 
 * ⚠️ NUNCA use este código em produção sem integração real!
 * Usar mocks em produção resultará em produtos entregues de graça.
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
    private readonly db: DbContextService,
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
    const pedido = await this.db.getRepository(Pedido).findOne({
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

    // ✅ IDEMPOTÊNCIA (Pagamento): se já existe um pagamento pendente/processando
    // para este pedido + método, reutilizar (evita criação duplicada via chat/webhook).
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

    // Processar pagamento conforme método
    const result = await this.processPayment(pagamento, pedido);

    this.logger.log(`Payment created: ${pagamento.id}, status: ${pagamento.status}`);

    return result;
  }

  /**
   * Monta o resultado do pagamento a partir do registro existente (reuso).
   * Importante para Pix/Boleto: devolver copy/paste e links já gerados.
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
          ? `📄 *BOLETO BANCÁRIO*\n\n` +
            `📦 Pedido: *${pedido.order_no}*\n` +
            `💰 Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n\n` +
            (boletoBarcode ? `📄 Código de barras:\n\`\`\`${boletoBarcode}\`\`\`\n\n` : '') +
            (boletoUrl ? `🔗 Link do boleto:\n${boletoUrl}\n\n` : '') +
            `⏳ Após o pagamento, seu pedido será confirmado automaticamente!`
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
          `💵 *PAGAMENTO EM DINHEIRO*\n\n` +
          `📦 Pedido: *${pedido.order_no}*\n` +
          `💰 Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n\n` +
          `⏳ Aguarde a confirmação do pagamento pela loja.`,
      };
    }

    if (pagamento.method === MetodoPagamento.CREDITO || pagamento.method === MetodoPagamento.DEBITO) {
      return {
        pagamento,
        message:
          `💳 *PAGAMENTO COM CARTÃO*\n\n` +
          `📦 Pedido: *${pedido.order_no}*\n` +
          `💰 Valor: R$ ${Number(pagamento.amount).toFixed(2).replace('.', ',')}\n` +
          `💳 Método: ${pagamento.method === MetodoPagamento.CREDITO ? 'Crédito' : 'Débito'}\n\n` +
          `⏳ Status: ${pagamento.status}\n` +
          `Você receberá uma notificação quando o pagamento for confirmado.`,
      };
    }

    return { pagamento };
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
   * ⚠️ MOCK: Em produção, usar API real (GerenciaNet, Stripe, Mercado Pago)
   */
  private async processPixPayment(
    pagamento: Pagamento,
    pedido: Pedido,
  ): Promise<PaymentResult> {
    this.logger.log(`Processing Pix payment for order ${pedido.order_no}`);

    // ⚠️ MOCK: Gerar QR Code Pix (mock para desenvolvimento)
    // Em produção, usar API real:
    // - GerenciaNet: gn.pix.createCharge()
    // - Stripe: stripe.paymentIntents.create() com payment_method_types: ['pix']
    // - Mercado Pago: mercadopago.payment.create()
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

    await this.db.getRepository(Pagamento).save(pagamento);

    return {
      pagamento,
      qr_code: qrCodeBase64,
      qr_code_url: qrCodeUrl,
      copy_paste: pixData,
      message: this.generatePixMessage(pedido, pagamento, pixData),
    };
  }

  /**
   * Gera dados Pix (MOCK - em produção usar API real como GerenciaNet)
   * Formato EMC (EMV Code) simplificado para desenvolvimento
   * 
   * ⚠️ ATENÇÃO: Este método é apenas para desenvolvimento!
   * Em produção, use a API do provider escolhido:
   * - GerenciaNet: gn.pix.createCharge()
   * - Stripe: stripe.paymentIntents.create()
   * - Mercado Pago: mercadopago.payment.create()
   */
  private generatePixData(pedido: Pedido, pagamento: Pagamento): string {
    // ⚠️ MOCK: Em produção, usar API real (GerenciaNet, Stripe, etc)
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

    await this.db.getRepository(Pagamento).save(pagamento);

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
   * ⚠️ MOCK: Em produção, integrar com Stripe/GerenciaNet/Mercado Pago
   */
  private async processCardPayment(
    pagamento: Pagamento,
    pedido: Pedido,
  ): Promise<PaymentResult> {
    this.logger.log(`Processing card payment for order ${pedido.order_no}`);

    // ⚠️ MOCK: Em produção, integrar com Stripe/GerenciaNet/Mercado Pago
    // Exemplo Stripe:
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: Math.round(pagamento.amount * 100), // centavos
    //   currency: 'brl',
    //   metadata: { pedido_id: pedido.id, tenant_id: pagamento.tenant_id },
    // });
    const provider = this.configService.get<string>('PAYMENT_PROVIDER') || 'mock';

    if (provider === 'mock') {
      // Simular processamento
      pagamento.status = PagamentoStatus.PROCESSING;
      pagamento.metadata = {
        provider: 'mock',
        simulated: true,
      };

      await this.db.getRepository(Pagamento).save(pagamento);

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
   * ⚠️ MOCK: Em produção, gerar boleto real via GerenciaNet/Mercado Pago
   */
  private async processBoletoPayment(
    pagamento: Pagamento,
    pedido: Pedido,
  ): Promise<PaymentResult> {
    this.logger.log(`Processing boleto payment for order ${pedido.order_no}`);

    // ⚠️ MOCK: Em produção, gerar boleto real via GerenciaNet/Mercado Pago
    // Exemplo GerenciaNet:
    // const charge = await gn.charge.create({
    //   items: [{ name: `Pedido ${pedido.order_no}`, value: pagamento.amount, amount: 1 }],
    //   payment: { banking_billet: { expire_at: '2024-12-31' } },
    // });
    const boletoUrl = `https://example.com/boleto/${pagamento.id}`;
    const boletoBarcode = '34191.09008 01234.567890 12345.678901 2 12345678901234';

    pagamento.metadata = {
      boleto_url: boletoUrl,
      boleto_barcode: boletoBarcode,
    };

    await this.db.getRepository(Pagamento).save(pagamento);

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
    const pagamento = await this.db.getRepository(Pagamento).findOne({
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
    await this.db.getRepository(Pagamento).save(pagamento);

    // Atualizar status do pedido
    const pedido = pagamento.pedido;
    const oldStatus = pedido.status;
    
    if (pedido.status === PedidoStatus.PENDENTE_PAGAMENTO) {
      pedido.status = PedidoStatus.CONFIRMADO;
      await this.db.getRepository(Pedido).save(pedido);
      this.logger.log(`Order ${pedido.order_no} confirmed after payment`);

      // ✅ Notificar cliente sobre confirmação de pagamento
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

      // ✅ NOVO: Notificar também sobre mudança de status do pedido
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
        // Não falhar a confirmação se a notificação falhar
      }
    }

    return pagamento;
  }

  /**
   * Busca pagamento por ID
   */
  async findById(pagamentoId: string, tenantId: string): Promise<Pagamento> {
    const pagamento = await this.db.getRepository(Pagamento).findOne({
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
    return await this.db.getRepository(Pagamento).find({
      where: { pedido_id: pedidoId, tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
  }
}
