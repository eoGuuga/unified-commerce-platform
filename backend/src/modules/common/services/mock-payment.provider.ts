import { Injectable, Logger } from '@nestjs/common';

export interface CreatePaymentIntentDto {
  amount: number; // em centavos
  currency?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntent {
  id: string;
  client_secret: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'succeeded' | 'canceled';
  amount: number;
  currency: string;
}

export interface PixQRCode {
  qr_code: string;
  qr_code_image: string; // Base64 ou URL
  expires_at: Date;
}

/**
 * Mock Payment Provider - Para desenvolvimento sem custo
 * 
 * Simula processamento de pagamentos (Stripe/Pix)
 * Útil para desenvolvimento e testes locais
 */
@Injectable()
export class MockPaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);
  
  private paymentIntents: Map<string, PaymentIntent> = new Map();

  /**
   * Cria um Payment Intent (simulado)
   */
  async createPaymentIntent(dto: CreatePaymentIntentDto): Promise<PaymentIntent> {
    const paymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const paymentIntent: PaymentIntent = {
      id: paymentIntentId,
      client_secret: `mock_secret_${paymentIntentId}`,
      status: 'requires_payment_method',
      amount: dto.amount,
      currency: dto.currency || 'BRL',
    };

    this.paymentIntents.set(paymentIntentId, paymentIntent);

    this.logger.log(
      `[MOCK] Payment Intent created: ${paymentIntentId} (R$ ${(dto.amount / 100).toFixed(2)})`
    );

    return paymentIntent;
  }

  /**
   * Confirma um pagamento (simulado - sempre sucesso)
   */
  async confirmPayment(paymentIntentId: string): Promise<PaymentIntent> {
    const paymentIntent = this.paymentIntents.get(paymentIntentId);

    if (!paymentIntent) {
      throw new Error(`Payment Intent not found: ${paymentIntentId}`);
    }

    // Simula delay de processamento
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock sempre confirma com sucesso
    const confirmed: PaymentIntent = {
      ...paymentIntent,
      status: 'succeeded',
    };

    this.paymentIntents.set(paymentIntentId, confirmed);

    this.logger.log(
      `[MOCK] Payment confirmed: ${paymentIntentId} (R$ ${(paymentIntent.amount / 100).toFixed(2)})`
    );

    return confirmed;
  }

  /**
   * Cancela um pagamento (simulado)
   */
  async cancelPayment(paymentIntentId: string): Promise<PaymentIntent> {
    const paymentIntent = this.paymentIntents.get(paymentIntentId);

    if (!paymentIntent) {
      throw new Error(`Payment Intent not found: ${paymentIntentId}`);
    }

    const canceled: PaymentIntent = {
      ...paymentIntent,
      status: 'canceled',
    };

    this.paymentIntents.set(paymentIntentId, canceled);

    this.logger.log(`[MOCK] Payment canceled: ${paymentIntentId}`);

    return canceled;
  }

  /**
   * Gera QR Code Pix (simulado)
   */
  async generatePixQRCode(amount: number, description?: string): Promise<PixQRCode> {
    const txid = `MOCK${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // QR Code Pix simulado (EMV format)
    const qrCode = `00020126360014BR.GOV.BCB.PIX0114${txid}520400005303986540${(amount / 100).toFixed(2)}5802BR5909MOCK STORE6009SAO PAULO62070503***6304${this.generateCRC16(`00020126360014BR.GOV.BCB.PIX0114${txid}520400005303986540${(amount / 100).toFixed(2)}5802BR5909MOCK STORE6009SAO PAULO62070503***`)}`;
    
    // QR Code image simulado (base64 de imagem vazia)
    const qrCodeImage = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;

    this.logger.log(
      `[MOCK] Pix QR Code generated: R$ ${(amount / 100).toFixed(2)} (TXID: ${txid})`
    );

    return {
      qr_code: qrCode,
      qr_code_image: qrCodeImage,
      expires_at: new Date(Date.now() + 3600000), // 1 hora
    };
  }

  /**
   * Verifica status de um pagamento
   */
  async getPaymentStatus(paymentIntentId: string): Promise<PaymentIntent | null> {
    return this.paymentIntents.get(paymentIntentId) || null;
  }

  /**
   * Gera CRC16 para QR Code Pix (simplificado)
   */
  private generateCRC16(data: string): string {
    // Implementação simplificada (em produção, usar biblioteca)
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ 0x1021;
        } else {
          crc <<= 1;
        }
      }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  }

  /**
   * Limpa histórico de pagamentos (para testes)
   */
  clearHistory(): void {
    this.paymentIntents.clear();
    this.logger.debug('[MOCK] Payment history cleared');
  }
}
