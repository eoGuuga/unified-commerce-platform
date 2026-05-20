'use client';

import Image from 'next/image';
import { ArrowRight, CheckCircle2, Copy } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock?: number;
}

type PaymentMethod = 'pix' | 'dinheiro';

interface PaymentResult {
  pagamento: {
    id: string;
    status: string;
    method: PaymentMethod;
    amount: number | string;
    metadata?: Record<string, unknown>;
  };
  qr_code?: string;
  qr_code_url?: string;
  copy_paste?: string;
  message?: string;
}

interface CompletedSaleState {
  orderNo?: string;
  total: number;
  paymentMethod: PaymentMethod;
  itemsCount: number;
  changeAmount?: number;
}

export interface PdvPaymentModalProps {
  saleSummaryItems: CartItem[];
  saleSummaryTotal: number;
  orderData: { id: string; total: number; orderNo?: string } | null;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  cashReceived: string;
  onCashReceivedChange: (value: string) => void;
  cashChange: number;
  couponCode: string;
  onCouponCodeChange: (value: string) => void;
  paymentLoading: boolean;
  paymentError: string | null;
  paymentData: PaymentResult | null;
  completedSale: CompletedSaleState | null;
  onCreateOrderAndPayment: () => void;
  onConfirmPayment: () => void;
  onCopyReceipt: () => void;
  onNewSale: () => void;
  onClose: () => void;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function CompletedSaleView({
  completedSale,
  saleSummaryItems,
  onCopyReceipt,
  onNewSale,
  onClose,
}: {
  completedSale: CompletedSaleState;
  saleSummaryItems: CartItem[];
  onCopyReceipt: () => void;
  onNewSale: () => void;
  onClose: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(16,185,129,0.18)_0%,rgba(56,189,248,0.14)_45%,rgba(15,23,42,0.98)_100%)] p-6 text-white">
        <div className="inline-flex size-14 items-center justify-center rounded-3xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-100">
          <CheckCircle2 className="size-7" />
        </div>
        <p className="mt-6 text-xs uppercase tracking-[0.28em] text-emerald-100/80">
          venda confirmada
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          Caixa concluido com a serenidade de uma operacao madura.
        </h2>
        <p className="mt-4 text-sm leading-7 text-slate-200/85">
          Pedido, total e recebimento ficaram claros do primeiro clique ate a confirmacao final.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-300">pedido</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {completedSale.orderNo || 'Venda confirmada'}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-300">total</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {currencyFormatter.format(completedSale.total)}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-300">itens</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {completedSale.itemsCount}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">pos-venda</p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          O operador sai com clareza e pronto para a proxima venda.
        </h3>

        <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-500">Metodo</span>
              <strong className="text-sm font-semibold text-slate-950">
                {completedSale.paymentMethod === 'pix' ? 'Pix' : 'Dinheiro'}
              </strong>
            </div>
            {typeof completedSale.changeAmount === 'number' && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-500">Troco</span>
                <strong className="text-sm font-semibold text-slate-950">
                  {currencyFormatter.format(completedSale.changeAmount)}
                </strong>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-500">Total confirmado</span>
              <strong className="text-base font-semibold text-slate-950">
                {currencyFormatter.format(completedSale.total)}
              </strong>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">ritmo</p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              O fechamento terminou sem esconder risco, valor ou proximo passo.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">proxima venda</p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              O caixa ja pode voltar para a busca com o mesmo fluxo premium.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">comprovante</p>
            <p className="mt-2 text-sm font-medium text-slate-900">
              O resumo da venda pode ser copiado em um clique para registro ou envio interno.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={onCopyReceipt}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Copy className="size-4" />
            Copiar comprovante
          </button>
          <button
            onClick={onNewSale}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Nova venda
            <ArrowRight className="size-4" />
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Fechar resumo
          </button>
        </div>
      </div>
    </div>
  );
}

export function PdvPaymentModal({
  saleSummaryItems,
  saleSummaryTotal,
  orderData,
  paymentMethod,
  onPaymentMethodChange,
  cashReceived,
  onCashReceivedChange,
  cashChange,
  couponCode,
  onCouponCodeChange,
  paymentLoading,
  paymentError,
  paymentData,
  completedSale,
  onCreateOrderAndPayment,
  onConfirmPayment,
  onCopyReceipt,
  onNewSale,
  onClose,
}: PdvPaymentModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[30px] border border-white/10 bg-white p-6 shadow-[0_40px_120px_rgba(15,23,42,0.4)] sm:p-8">
        {completedSale ? (
          <CompletedSaleView
            completedSale={completedSale}
            saleSummaryItems={saleSummaryItems}
            onCopyReceipt={onCopyReceipt}
            onNewSale={onNewSale}
            onClose={onClose}
          />
        ) : (
          <PaymentFormView
            saleSummaryItems={saleSummaryItems}
            saleSummaryTotal={saleSummaryTotal}
            orderData={orderData}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={onPaymentMethodChange}
            cashReceived={cashReceived}
            onCashReceivedChange={onCashReceivedChange}
            cashChange={cashChange}
            couponCode={couponCode}
            onCouponCodeChange={onCouponCodeChange}
            paymentLoading={paymentLoading}
            paymentError={paymentError}
            paymentData={paymentData}
            onCreateOrderAndPayment={onCreateOrderAndPayment}
            onConfirmPayment={onConfirmPayment}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function PaymentFormView({
  saleSummaryItems,
  saleSummaryTotal,
  orderData,
  paymentMethod,
  onPaymentMethodChange,
  cashReceived,
  onCashReceivedChange,
  cashChange,
  couponCode,
  onCouponCodeChange,
  paymentLoading,
  paymentError,
  paymentData,
  onCreateOrderAndPayment,
  onConfirmPayment,
  onClose,
}: {
  saleSummaryItems: CartItem[];
  saleSummaryTotal: number;
  orderData: { id: string; total: number; orderNo?: string } | null;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  cashReceived: string;
  onCashReceivedChange: (value: string) => void;
  cashChange: number;
  couponCode: string;
  onCouponCodeChange: (value: string) => void;
  paymentLoading: boolean;
  paymentError: string | null;
  paymentData: PaymentResult | null;
  onCreateOrderAndPayment: () => void;
  onConfirmPayment: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Fechamento da venda</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Pagamento</h2>
          <p className="mt-2 text-sm text-slate-600">Total: {currencyFormatter.format(saleSummaryTotal)}</p>
          {orderData?.orderNo && (
            <p className="text-xs text-slate-400">Pedido: {orderData.orderNo}</p>
          )}
        </div>
        <button
          onClick={onClose}
          disabled={paymentLoading}
          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Fechar
        </button>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr,0.9fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <button
              onClick={() => onPaymentMethodChange('pix')}
              className={`rounded-[24px] border-2 px-5 py-4 text-left transition ${
                paymentMethod === 'pix'
                  ? 'border-cyan-500 bg-cyan-50 shadow-[0_12px_26px_rgba(8,145,178,0.12)]'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-semibold text-slate-950">PIX</p>
              <p className="mt-1 text-xs text-slate-500">QR code e copia e cola</p>
            </button>
            <button
              onClick={() => onPaymentMethodChange('dinheiro')}
              className={`rounded-[24px] border-2 px-5 py-4 text-left transition ${
                paymentMethod === 'dinheiro'
                  ? 'border-emerald-500 bg-emerald-50 shadow-[0_12px_26px_rgba(16,185,129,0.12)]'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-semibold text-slate-950">Dinheiro</p>
              <p className="mt-1 text-xs text-slate-500">Troco calculado automaticamente</p>
            </button>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Parametros</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.24em] text-slate-500">Cupom</label>
                <input
                  value={couponCode}
                  onChange={(e) => onCouponCodeChange(e.target.value)}
                  disabled={Boolean(orderData?.id)}
                  placeholder="EX: PROMO10"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
                {orderData?.id && (
                  <p className="mt-2 text-xs text-slate-500">
                    O pedido ja foi criado. Agora vamos apenas regenerar o pagamento com seguranca.
                  </p>
                )}
              </div>
              {paymentMethod === 'dinheiro' && (
                <div>
                  <label className="text-xs uppercase tracking-[0.24em] text-slate-500">Valor recebido</label>
                  <input
                    value={cashReceived}
                    onChange={(e) => onCashReceivedChange(e.target.value)}
                    placeholder="0,00"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                  />
                  {cashReceived && (
                    <p className="mt-2 text-xs text-slate-500">Troco: {currencyFormatter.format(cashChange)}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <p className="text-xs leading-6 text-slate-500">
            Ambiente de teste: o Pix funciona com comprador de teste do Mercado Pago.
          </p>

          {paymentError && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {paymentError}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onCreateOrderAndPayment}
              disabled={paymentLoading}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0891b2_0%,#0f766e_100%)] px-6 py-4 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(8,145,178,0.22)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {paymentLoading
                ? 'Processando...'
                : orderData?.id
                  ? 'Gerar pagamento novamente'
                  : 'Gerar pagamento'}
            </button>
            {paymentData?.pagamento?.id && (
              <button
                onClick={onConfirmPayment}
                disabled={paymentLoading}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[linear-gradient(135deg,#22c55e_0%,#0f766e_100%)] px-6 py-4 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(34,197,94,0.2)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                Confirmar pagamento
              </button>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-6 text-white">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/70">Resumo da venda</p>
          <div className="mt-4 space-y-3">
            {saleSummaryItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-300">{item.quantity} x {currencyFormatter.format(item.price)}</p>
                </div>
                <strong className="text-sm font-semibold text-white">
                  {currencyFormatter.format(item.price * item.quantity)}
                </strong>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-5">
            <span className="text-sm text-slate-300">Total final</span>
            <strong className="text-2xl font-semibold text-white">{currencyFormatter.format(saleSummaryTotal)}</strong>
          </div>

          {paymentData && (
            <div className="mt-6 rounded-[22px] border border-white/10 bg-white/5 p-4">
              {paymentData.message && (
                <p className="text-sm whitespace-pre-line text-slate-300">{paymentData.message}</p>
              )}
              {paymentMethod === 'pix' && paymentData.qr_code && (
                <div className="mt-4 flex flex-col items-center gap-4">
                  <Image
                    src={paymentData.qr_code}
                    alt="QR Code Pix"
                    width={192}
                    height={192}
                    unoptimized
                    className="h-48 w-48 rounded-2xl border border-white/10 bg-white p-3"
                  />
                  {paymentData.copy_paste && (
                    <div className="w-full">
                      <label className="text-xs uppercase tracking-[0.24em] text-slate-400">Copia e cola</label>
                      <textarea
                        readOnly
                        className="mt-2 h-28 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-200 outline-none"
                        value={paymentData.copy_paste}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
