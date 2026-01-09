import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Payment } from 'mercadopago';

export interface MercadoPagoPixResult {
  qr_code: string;
  qr_code_base64: string;
  copy_paste: string;
  transaction_id: string;
}

export interface MercadoPagoCardResult {
  transaction_id: string;
  status: string;
  status_detail: string;
  payment_method_id: string;
}

export interface MercadoPagoBoletoResult {
  transaction_id: string;
  barcode: string;
  external_resource_url: string;
  date_of_expiration: string;
}

@Injectable()
export class MercadoPagoProvider {
  private readonly logger = new Logger(MercadoPagoProvider.name);
  private client: MercadoPagoConfig | null = null;
  private accessToken: string;

  constructor(private configService: ConfigService) {
    this.accessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN') || '';
    
    if (this.accessToken) {
      this.client = new MercadoPagoConfig({
        accessToken: this.accessToken,
        options: {
          timeout: 5000,
          idempotencyKey: undefined,
        },
      });
      this.logger.log('Mercado Pago client initialized');
    } else {
      this.logger.warn('MERCADOPAGO_ACCESS_TOKEN not configured - Mercado Pago integration disabled');
    }
  }

  /**
   * Verifica se o provider está configurado
   */
  isConfigured(): boolean {
    return !!this.client && !!this.accessToken;
  }

  /**
   * Cria pagamento Pix via Mercado Pago
   */
  async createPixPayment(
    amount: number,
    description: string,
    externalReference: string,
  ): Promise<MercadoPagoPixResult> {
    if (!this.isConfigured()) {
      throw new Error('Mercado Pago não está configurado');
    }

    try {
      const payment = new Payment(this.client!);

      const paymentData: any = {
        transaction_amount: amount,
        description: description,
        payment_method_id: 'pix',
        payer: {
          email: 'customer@example.com', // Em produção, obter do pedido/usuário
        },
        external_reference: externalReference,
        notification_url: this.configService.get<string>('MERCADOPAGO_WEBHOOK_URL') || undefined,
      };

      const result = await payment.create({ body: paymentData });

      if (!result.point_of_interaction?.transaction_data) {
        throw new Error('Resposta do Mercado Pago inválida para Pix');
      }

      const transactionData = result.point_of_interaction.transaction_data;

      return {
        qr_code: transactionData.qr_code || '',
        qr_code_base64: transactionData.qr_code_base64 || '',
        copy_paste: transactionData.qr_code || '',
        transaction_id: String(result.id || ''),
      };
    } catch (error: any) {
      this.logger.error('Erro ao criar pagamento Pix no Mercado Pago', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Cria pagamento com cartão via Mercado Pago
   */
  async createCardPayment(
    amount: number,
    description: string,
    externalReference: string,
    token: string, // Token do cartão (gerado no frontend)
    installments: number = 1,
  ): Promise<MercadoPagoCardResult> {
    if (!this.isConfigured()) {
      throw new Error('Mercado Pago não está configurado');
    }

    try {
      const payment = new Payment(this.client!);

      const paymentData: any = {
        transaction_amount: amount,
        description: description,
        payment_method_id: 'credit_card',
        token: token,
        installments: installments,
        payer: {
          email: 'customer@example.com', // Em produção, obter do pedido/usuário
        },
        external_reference: externalReference,
        notification_url: this.configService.get<string>('MERCADOPAGO_WEBHOOK_URL') || undefined,
      };

      const result = await payment.create({ body: paymentData });

      return {
        transaction_id: String(result.id || ''),
        status: result.status || 'pending',
        status_detail: result.status_detail || '',
        payment_method_id: result.payment_method_id || 'credit_card',
      };
    } catch (error: any) {
      this.logger.error('Erro ao criar pagamento com cartão no Mercado Pago', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Cria pagamento com boleto via Mercado Pago
   */
  async createBoletoPayment(
    amount: number,
    description: string,
    externalReference: string,
    expirationDate?: string,
  ): Promise<MercadoPagoBoletoResult> {
    if (!this.isConfigured()) {
      throw new Error('Mercado Pago não está configurado');
    }

    try {
      const payment = new Payment(this.client!);

      // Data de vencimento padrão: 3 dias
      const expireDate = expirationDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const paymentData: any = {
        transaction_amount: amount,
        description: description,
        payment_method_id: 'bolbradesco', // ou 'pec' para PEC
        payer: {
          email: 'customer@example.com', // Em produção, obter do pedido/usuário
        },
        external_reference: externalReference,
        date_of_expiration: expireDate,
        notification_url: this.configService.get<string>('MERCADOPAGO_WEBHOOK_URL') || undefined,
      };

      const result = await payment.create({ body: paymentData });

      // Boleto: buscar dados do boleto na resposta
      const barcode = (result as any).transaction_details?.external_resource_url || 
                     (result as any).transaction_details?.financial_institution || 
                     '';

      return {
        transaction_id: String(result.id || ''),
        barcode: barcode,
        external_resource_url: (result as any).transaction_details?.external_resource_url || 
                              (result as any).external_resource_url || 
                              '',
        date_of_expiration: expireDate,
      };
    } catch (error: any) {
      this.logger.error('Erro ao criar pagamento com boleto no Mercado Pago', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Busca status de um pagamento
   */
  async getPaymentStatus(paymentId: string): Promise<{ status: string; status_detail: string }> {
    if (!this.isConfigured()) {
      throw new Error('Mercado Pago não está configurado');
    }

    try {
      const payment = new Payment(this.client!);
      const result = await payment.get({ id: paymentId });

      return {
        status: result.status || 'pending',
        status_detail: result.status_detail || '',
      };
    } catch (error: any) {
      this.logger.error('Erro ao buscar status do pagamento no Mercado Pago', {
        error: error.message,
        paymentId,
      });
      throw error;
    }
  }

  /**
   * Valida assinatura do webhook
   */
  validateWebhookSignature(
    dataId: string,
    requestId: string,
    signature: string,
  ): boolean {
    // Implementar validação de assinatura do webhook
    // Ver: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
    // Por enquanto, retorna true (em produção, validar corretamente)
    return true;
  }
}
