'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { ArrowRight, CheckCircle2, Copy } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock?: number;
}

type PaymentMethod = 'pix' | 'dinheiro' | 'debito' | 'credito' | 'boleto';

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
  /**
   * Fast-pass (PDV): 1 passo, sem QR. Quando true, o pagamento e marcado pago
   * numa unica acao (`onCreateOrderAndPayment`) — o bloco de QR e o 2o botao
   * (`onConfirmPayment`) ficam ocultos. Default `false` = fluxo de 2 passos atual.
   */
  fastPass?: boolean;
  /** Mostra o campo de cupom. Default `true`; o PDV passa `false` (oculto no v1). */
  showCoupon?: boolean;
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

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
  boleto: 'Boleto',
};

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
      <div className="rounded-[28px] border border-emerald-400/30 bg-[linear-gradient(160deg,#064e3b_0%,#0f172a_62%)] p-6 text-white shadow-[0_20px_48px_rgba(2,16,12,0.45)]">
        {/* Sucesso inequivoco e instantaneo: titulo grande, sem ambiguidade. */}
        <div className="flex items-center gap-3">
          <span className="inline-flex size-14 items-center justify-center rounded-3xl border border-emerald-300/30 bg-emerald-400/15 text-emerald-100">
            <CheckCircle2 className="size-8" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-100/80">
              venda confirmada
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              <span aria-hidden="true">✅ </span>Venda registrada
            </h2>
          </div>
        </div>
        <p className="mt-4 text-sm leading-7 text-emerald-50/90">
          Pode chamar o proximo. A venda foi gravada com seguranca.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-300">pedido</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {completedSale.orderNo || 'Venda confirmada'}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-300">total</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {currencyFormatter.format(completedSale.total)}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-300">itens</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {completedSale.itemsCount}
            </p>
          </div>
          {typeof completedSale.changeAmount === 'number' && (
            <div className="rounded-[24px] border border-emerald-300/30 bg-emerald-400/10 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-100">troco</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {currencyFormatter.format(completedSale.changeAmount)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col rounded-[28px] border border-slate-200 bg-slate-50 p-6">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-500">Metodo</span>
              <strong className="text-sm font-semibold text-slate-950">
                {PAYMENT_METHOD_LABELS[completedSale.paymentMethod] ?? completedSale.paymentMethod}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-500">Total confirmado</span>
              <strong className="text-base font-semibold text-slate-950">
                {currencyFormatter.format(completedSale.total)}
              </strong>
            </div>
            {typeof completedSale.changeAmount === 'number' && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-500">Troco</span>
                <strong className="text-base font-semibold text-emerald-700">
                  {currencyFormatter.format(completedSale.changeAmount)}
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* "Nova venda" e a acao primaria obvia para o balcao com fila. */}
        <div className="mt-auto flex flex-col gap-3 pt-6">
          <button
            onClick={onNewSale}
            autoFocus
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#22c55e_0%,#0f766e_100%)] px-6 py-5 text-base font-bold text-white shadow-[0_16px_32px_rgba(16,185,129,0.24)] transition hover:translate-y-[-1px]"
          >
            Nova venda
            <ArrowRight className="size-5" />
          </button>
          <div className="flex gap-3">
            <button
              onClick={onCopyReceipt}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Copy className="size-4" />
              Copiar comprovante
            </button>
            <button
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Fechar resumo
            </button>
          </div>
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
  fastPass = false,
  showCoupon = true,
  onCreateOrderAndPayment,
  onConfirmPayment,
  onCopyReceipt,
  onNewSale,
  onClose,
}: PdvPaymentModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-white p-5 shadow-[0_40px_120px_rgba(15,23,42,0.4)] sm:p-6">
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
            fastPass={fastPass}
            showCoupon={showCoupon}
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
  fastPass,
  showCoupon,
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
  fastPass: boolean;
  showCoupon: boolean;
  onCreateOrderAndPayment: () => void;
  onConfirmPayment: () => void;
  onClose: () => void;
}) {
  // Troco negativo (dinheiro): valor recebido < total -> bloqueia finalizar (spec §4.6/§10).
  const insufficientCash = paymentMethod === 'dinheiro' && cashChange < 0;
  // Dinheiro = acao principal: o foco do teclado vai DIRETO pro valor recebido,
  // pra a operadora ja digitar quanto a cliente deu (troco calculado na hora).
  const cashInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (paymentMethod === 'dinheiro') {
      cashInputRef.current?.focus();
    }
  }, [paymentMethod]);
  // Cards de metodo compactos numa fileira (4-up): pix/debito/credito = acento cyan,
  // dinheiro = acento emerald (a unica acao com calculo extra de troco).
  const methodBtn = (active: boolean, accent: 'cyan' | 'emerald') =>
    active
      ? accent === 'emerald'
        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-[0_6px_16px_rgba(16,185,129,0.14)]'
        : 'border-cyan-500 bg-cyan-50 text-cyan-900 shadow-[0_6px_16px_rgba(8,145,178,0.14)]'
      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300';
  return (
    <>
      {/* Cabecalho enxuto: titulo + total a vista + Fechar. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-semibold text-slate-950">Pagamento</h2>
          <p className="text-sm text-slate-600">
            Total: <strong className="font-semibold tabular-nums text-slate-900">{currencyFormatter.format(saleSummaryTotal)}</strong>
          </p>
          {orderData?.orderNo && (
            <p className="text-xs text-slate-400">Pedido: {orderData.orderNo}</p>
          )}
        </div>
        <button
          onClick={onClose}
          disabled={paymentLoading}
          className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Fechar
        </button>
      </div>

      {/* Tudo numa olhada, SEM scroll interno: metodos -> valor/troco -> resumo -> Confirmar. */}
      <div className="mt-4 space-y-4">
        {/* 4 metodos em fileira compacta. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            onClick={() => onPaymentMethodChange('pix')}
            className={`rounded-xl border-2 px-3 py-2.5 text-center text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${methodBtn(paymentMethod === 'pix', 'cyan')}`}
          >
            PIX
          </button>
          <button
            onClick={() => onPaymentMethodChange('dinheiro')}
            className={`rounded-xl border-2 px-3 py-2.5 text-center text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${methodBtn(paymentMethod === 'dinheiro', 'emerald')}`}
          >
            Dinheiro
          </button>
          <button
            onClick={() => onPaymentMethodChange('debito')}
            className={`rounded-xl border-2 px-3 py-2.5 text-center text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${methodBtn(paymentMethod === 'debito', 'cyan')}`}
          >
            Débito
          </button>
          <button
            onClick={() => onPaymentMethodChange('credito')}
            className={`rounded-xl border-2 px-3 py-2.5 text-center text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${methodBtn(paymentMethod === 'credito', 'cyan')}`}
          >
            Crédito
          </button>
        </div>

        {/* Dica do metodo + parametros (cupom opcional / valor recebido) numa fileira enxuta. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <p className="flex-1 text-xs leading-5 text-slate-500">
            {paymentMethod === 'pix'
              ? fastPass
                ? 'Cliente paga no QR/maquininha — confirme quando vir o pagamento.'
                : 'QR code e copia e cola.'
              : paymentMethod === 'dinheiro'
                ? 'Informe o valor recebido — o troco é calculado.'
                : 'Passe na maquininha — confirme quando aprovar.'}
          </p>
          {showCoupon && (
            <div className="sm:w-44">
              <label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Cupom</label>
              <input
                value={couponCode}
                onChange={(e) => onCouponCodeChange(e.target.value)}
                disabled={Boolean(orderData?.id)}
                placeholder="EX: PROMO10"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
          )}
        </div>

        {/* Dinheiro = acao principal: VALOR RECEBIDO grande/central + TROCO em destaque.
            So aparece no dinheiro (pix/debito/credito nao precisam de troco). */}
        {paymentMethod === 'dinheiro' && (
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
            <label
              htmlFor="pdv-cash-received"
              className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800"
            >
              Valor recebido
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400 sm:text-3xl">
                R$
              </span>
              <input
                id="pdv-cash-received"
                ref={cashInputRef}
                value={cashReceived}
                onChange={(e) => onCashReceivedChange(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                aria-label="Valor recebido"
                className="w-full rounded-xl border-2 border-emerald-300 bg-white py-3 pl-14 pr-4 text-3xl font-bold tabular-nums text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:text-4xl"
              />
            </div>
            {cashReceived && (
              <div
                className={`mt-3 flex items-center justify-between rounded-xl px-4 py-3 ${
                  insufficientCash ? 'bg-rose-100 text-rose-700' : 'bg-emerald-600 text-white'
                }`}
              >
                <span className="text-sm font-semibold uppercase tracking-[0.14em]">Troco</span>
                <strong className="text-3xl font-extrabold tabular-nums sm:text-4xl">
                  {currencyFormatter.format(cashChange)}
                </strong>
              </div>
            )}
          </div>
        )}

        {/* Resumo condensado da venda (escuro = ancora visual, reusa a linguagem). */}
        <div className="rounded-xl border border-slate-200 bg-slate-950 px-4 py-3 text-white">
          <div className="max-h-28 space-y-1 overflow-y-auto">
            {saleSummaryItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <p className="min-w-0 flex-1 truncate text-slate-200">
                  <span className="tabular-nums text-slate-400">{item.quantity}×</span> {item.name}
                </p>
                <strong className="shrink-0 font-semibold tabular-nums text-white">
                  {currencyFormatter.format(item.price * item.quantity)}
                </strong>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-white/10 pt-2">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-300">Total final</span>
            <strong className="text-2xl font-bold tabular-nums text-white">
              {currencyFormatter.format(saleSummaryTotal)}
            </strong>
          </div>
        </div>

        {paymentError && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {paymentError}
          </div>
        )}

        {/* Confirmar SEMPRE visivel (sem scroll). */}
        {fastPass ? (
          // Fast-pass (PDV): 1 passo, sem QR. Um unico botao marca pago e finaliza.
          // Troco negativo (dinheiro) bloqueia finalizar — a operadora ve o porque.
          <div className="space-y-2">
            <button
              onClick={onCreateOrderAndPayment}
              disabled={paymentLoading || insufficientCash}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#22c55e_0%,#0f766e_100%)] px-6 py-3.5 text-base font-bold text-white shadow-[0_12px_28px_rgba(16,185,129,0.24)] transition hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:hover:translate-y-0"
            >
              {paymentLoading ? 'Registrando…' : 'Confirmar pagamento e finalizar'}
            </button>
            {insufficientCash && (
              <p className="text-center text-xs font-medium text-rose-600">
                Valor recebido insuficiente
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onCreateOrderAndPayment}
                disabled={paymentLoading}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#0891b2_0%,#0f766e_100%)] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(8,145,178,0.22)] transition hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
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
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#22c55e_0%,#0f766e_100%)] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(34,197,94,0.2)] transition hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  Confirmar pagamento
                </button>
              )}
            </div>
            {/* QR (fluxo de 2 passos, fora do PDV). */}
            {paymentData && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                {paymentData.message && (
                  <p className="whitespace-pre-line text-sm text-slate-600">{paymentData.message}</p>
                )}
                {paymentMethod === 'pix' && paymentData.qr_code && (
                  <div className="mt-3 flex flex-col items-center gap-3">
                    <Image
                      src={paymentData.qr_code}
                      alt="QR Code Pix"
                      width={160}
                      height={160}
                      unoptimized
                      className="h-40 w-40 rounded-xl border border-slate-200 bg-white p-2"
                    />
                    {paymentData.copy_paste && (
                      <textarea
                        readOnly
                        aria-label="Copia e cola"
                        className="h-20 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none"
                        value={paymentData.copy_paste}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
