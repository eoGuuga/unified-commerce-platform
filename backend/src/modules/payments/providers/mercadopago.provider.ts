import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { createHmac, timingSafeEqual } from 'crypto';

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

export interface MercadoPagoPaymentDetails {
  status: string;
  status_detail: string;
  metadata: Record<string, unknown>;
  external_reference?: string;
  payment_method_id?: string;
}

/**
 * Payload enviado para a API do Mercado Pago em payment.create().
 * Modelado a partir do tipo PaymentCreateRequest do SDK, com apenas
 * os campos que o provider usa de fato.
 */
export interface MercadoPagoPaymentBody {
  transaction_amount: number;
  description: string;
  payment_method_id: string;
  payer: { email: string };
  external_reference: string;
  notification_url?: string;
  metadata?: Record<string, unknown>;
  token?: string;
  installments?: number;
  date_of_expiration?: string;
}

/**
 * Subset do response do Mercado Pago que o provider consome.
 * SDK retorna muito mais campos; esses sao os que usamos.
 */
export interface MercadoPagoPaymentResponse {
  id?: number | string;
  status?: string;
  status_detail?: string;
  payment_method_id?: string;
  external_reference?: string;
  metadata?: Record<string, unknown>;
  external_resource_url?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
    };
  };
  transaction_details?: {
    external_resource_url?: string;
    financial_institution?: string;
  };
}

@Injectable()
export class MercadoPagoProvider {
  private readonly logger = new Logger(MercadoPagoProvider.name);
  private client: MercadoPagoConfig | null = null;
  private accessToken: string;
  private readonly isProd = process.env.NODE_ENV === 'production';

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

  isConfigured(): boolean {
    return !!this.client && !!this.accessToken;
  }

  async createPixPayment(
    amount: number,
    description: string,
    externalReference: string,
    payerEmail?: string,
    metadata?: Record<string, any>,
  ): Promise<MercadoPagoPixResult> {
    if (!this.isConfigured()) {
      throw new Error('Mercado Pago nao esta configurado');
    }

    try {
      const payment = new Payment(this.client!);

      const paymentData: MercadoPagoPaymentBody = {
        transaction_amount: amount,
        description: description,
        payment_method_id: 'pix',
        payer: {
          email: payerEmail || 'customer@example.com',
        },
        external_reference: externalReference,
        notification_url: this.configService.get<string>('MERCADOPAGO_WEBHOOK_URL') || undefined,
        ...(metadata ? { metadata } : {}),
      };

      const result = (await payment.create({ body: paymentData })) as MercadoPagoPaymentResponse;

      if (!result.point_of_interaction?.transaction_data) {
        throw new Error('Resposta do Mercado Pago invalida para Pix');
      }

      const transactionData = result.point_of_interaction.transaction_data;

      return {
        qr_code: transactionData.qr_code || '',
        qr_code_base64: transactionData.qr_code_base64 || '',
        copy_paste: transactionData.qr_code || '',
        transaction_id: String(result.id || ''),
      };
    } catch (error) {
      const err = error as Error;
      const payload = {
        error: err?.message,
        stack: err?.stack,
      };
      if (this.isProd) {
        this.logger.error('Erro ao criar pagamento Pix no Mercado Pago', payload);
      } else {
        this.logger.warn('Erro ao criar pagamento Pix no Mercado Pago', payload);
      }
      throw error;
    }
  }

  async createCardPayment(
    amount: number,
    description: string,
    externalReference: string,
    token: string,
    installments: number = 1,
    payerEmail?: string,
    metadata?: Record<string, any>,
  ): Promise<MercadoPagoCardResult> {
    if (!this.isConfigured()) {
      throw new Error('Mercado Pago nao esta configurado');
    }

    try {
      const payment = new Payment(this.client!);

      const paymentData: MercadoPagoPaymentBody = {
        transaction_amount: amount,
        description: description,
        payment_method_id: 'credit_card',
        token: token,
        installments: installments,
        payer: {
          email: payerEmail || 'customer@example.com',
        },
        external_reference: externalReference,
        notification_url: this.configService.get<string>('MERCADOPAGO_WEBHOOK_URL') || undefined,
        ...(metadata ? { metadata } : {}),
      };

      const result = (await payment.create({ body: paymentData })) as MercadoPagoPaymentResponse;

      return {
        transaction_id: String(result.id || ''),
        status: result.status || 'pending',
        status_detail: result.status_detail || '',
        payment_method_id: result.payment_method_id || 'credit_card',
      };
    } catch (error) {
      const err = error as Error;
      const payload = {
        error: err?.message,
        stack: err?.stack,
      };
      if (this.isProd) {
        this.logger.error('Erro ao criar pagamento com cartao no Mercado Pago', payload);
      } else {
        this.logger.warn('Erro ao criar pagamento com cartao no Mercado Pago', payload);
      }
      throw error;
    }
  }

  async createBoletoPayment(
    amount: number,
    description: string,
    externalReference: string,
    expirationDate?: string,
    payerEmail?: string,
    metadata?: Record<string, any>,
  ): Promise<MercadoPagoBoletoResult> {
    if (!this.isConfigured()) {
      throw new Error('Mercado Pago nao esta configurado');
    }

    try {
      const payment = new Payment(this.client!);

      const expireDate = expirationDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const paymentData: MercadoPagoPaymentBody = {
        transaction_amount: amount,
        description: description,
        payment_method_id: 'bolbradesco',
        payer: {
          email: payerEmail || 'customer@example.com',
        },
        external_reference: externalReference,
        date_of_expiration: expireDate,
        notification_url: this.configService.get<string>('MERCADOPAGO_WEBHOOK_URL') || undefined,
        ...(metadata ? { metadata } : {}),
      };

      const result = (await payment.create({ body: paymentData })) as MercadoPagoPaymentResponse;

      const barcode = result.transaction_details?.external_resource_url ||
                     result.transaction_details?.financial_institution ||
                     '';

      return {
        transaction_id: String(result.id || ''),
        barcode: barcode,
        external_resource_url: result.transaction_details?.external_resource_url ||
                              result.external_resource_url ||
                              '',
        date_of_expiration: expireDate,
      };
    } catch (error) {
      const err = error as Error;
      const payload = {
        error: err?.message,
        stack: err?.stack,
      };
      if (this.isProd) {
        this.logger.error('Erro ao criar pagamento com boleto no Mercado Pago', payload);
      } else {
        this.logger.warn('Erro ao criar pagamento com boleto no Mercado Pago', payload);
      }
      throw error;
    }
  }

  async getPaymentDetails(paymentId: string): Promise<MercadoPagoPaymentDetails> {
    if (!this.isConfigured()) {
      throw new Error('Mercado Pago nao esta configurado');
    }

    try {
      const payment = new Payment(this.client!);
      const result = (await payment.get({ id: paymentId })) as MercadoPagoPaymentResponse;

      return {
        status: result.status || 'pending',
        status_detail: result.status_detail || '',
        metadata: result.metadata || {},
        external_reference: result.external_reference || undefined,
        payment_method_id: result.payment_method_id || undefined,
      };
    } catch (error) {
      const err = error as Error;
      const payload = {
        error: err?.message,
        paymentId,
      };
      if (this.isProd) {
        this.logger.error('Erro ao buscar status do pagamento no Mercado Pago', payload);
      } else {
        this.logger.warn('Erro ao buscar status do pagamento no Mercado Pago', payload);
      }
      throw error;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<{ status: string; status_detail: string }> {
    const details = await this.getPaymentDetails(paymentId);
    return {
      status: details.status,
      status_detail: details.status_detail,
    };
  }

  validateWebhookSignature(
    dataId: string,
    requestId: string,
    signature: string,
  ): boolean {
    const secret = this.configService.get<string>('MERCADOPAGO_WEBHOOK_SECRET') || '';
    if (!secret) {
      return true;
    }

    if (!signature || !dataId || !requestId) {
      return false;
    }

    const parts = signature.split(',').map((part) => part.trim());
    const tsPart = parts.find((part) => part.startsWith('ts='));
    const v1Part = parts.find((part) => part.startsWith('v1='));
    if (!tsPart || !v1Part) {
      return false;
    }

    const ts = tsPart.slice(3);
    const v1 = v1Part.slice(3);
    if (!ts || !v1) {
      return false;
    }

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');

    try {
      return timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}
