/**
 * Types de pagamento.
 * Acompanha backend/src/database/entities/Pagamento.entity.ts.
 */

import type { Decimal } from './product';

export type PaymentMethod =
  | 'dinheiro'
  | 'pix'
  | 'debito'
  | 'credito'
  | 'boleto';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'refunded';

export interface PaymentMetadata {
  pix_qr_code?: string;
  pix_qr_code_url?: string;
  pix_copy_paste?: string;
  boleto_url?: string;
  boleto_barcode?: string;
  [key: string]: unknown;
}

export interface Payment {
  id: string;
  tenant_id: string;
  pedido_id: string;
  transaction_id?: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: Decimal;
  stripe_payment_id?: string;
  metadata: PaymentMetadata;
  created_at?: string;
  updated_at?: string;
}

/**
 * Resposta dos endpoints POST /payments e /payments/public.
 * Backend (PaymentsService.buildPaymentResult) retorna `{ pagamento, qr_code?,
 * qr_code_url?, copy_paste?, message? }` com o pagamento e dados extras do
 * provider (PIX QR, redirect URL, etc).
 */
export interface PaymentResponse {
  pagamento: Payment;
  /** QR code Pix em base64 (data URL ou raw) - somente PIX. */
  qr_code?: string;
  /** URL externa do QR code (provider). */
  qr_code_url?: string;
  /** Chave Pix copia-e-cola. */
  copy_paste?: string;
  /** Mensagem amigavel para o cliente. */
  message?: string;
  provider?: string;
  redirect_url?: string;
  [key: string]: unknown;
}

export interface CreatePaymentInput {
  pedido_id: string;
  method: PaymentMethod | string;
  amount?: Decimal;
  payerEmail?: string;
  cardToken?: string;
  installments?: number;
}

export interface CreatePublicPaymentInput extends CreatePaymentInput {
  metadata?: Record<string, unknown>;
}

export interface ConfirmPaymentResponse {
  pagamento: Payment;
  status: PaymentStatus;
  [key: string]: unknown;
}
