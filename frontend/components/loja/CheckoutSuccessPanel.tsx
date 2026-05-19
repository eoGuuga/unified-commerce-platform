import { ArrowRight, BadgeCheck, Copy } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { getDeliveryTypeLabel, getPaymentMethodLabel } from '@/lib/loja/labels';
import { SummaryRow } from './SummaryRow';

type PaymentMethod = 'pix' | 'dinheiro';
type DeliveryType = 'delivery' | 'pickup';

export interface CheckoutSuccessData {
  orderNo?: string;
  total: number;
  paymentMethod: PaymentMethod;
  customerName: string;
  deliveryType: DeliveryType;
  changeAmount?: number;
}

interface CheckoutSuccessPanelProps {
  data: CheckoutSuccessData;
  onTrackOrder: () => void;
  onCopyReceipt: () => void;
  onContinueShopping: () => void;
  onClose: () => void;
}

export function CheckoutSuccessPanel({
  data,
  onTrackOrder,
  onCopyReceipt,
  onContinueShopping,
  onClose,
}: CheckoutSuccessPanelProps) {
  return (
    <div className="grid h-full lg:grid-cols-[1.08fr_0.92fr]">
      <div className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(160deg,rgba(16,185,129,0.2)_0%,rgba(56,189,248,0.14)_42%,rgba(5,8,22,0.98)_100%)] px-6 py-8 sm:px-8 sm:py-9 lg:border-b-0 lg:border-r">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(110,231,183,0.22),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.18),transparent_38%)]" />
        <div className="relative">
          <div className="inline-flex size-14 items-center justify-center rounded-3xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-100">
            <BadgeCheck className="size-7" />
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.28em] text-emerald-100/75">
            pagamento confirmado
          </p>
          <h3 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-white">
            {data.customerName
              ? `${data.customerName.split(' ')[0]}, seu pedido agora esta oficialmente a caminho.`
              : 'Seu pedido agora esta oficialmente a caminho.'}
          </h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200/85">
            A experiencia fechou com o mesmo cuidado do resto da jornada: clareza no total,
            confianca no pagamento e um proximo passo obvio para o cliente.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-300">pedido</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {data.orderNo || 'Pedido confirmado'}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-300">total</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatCurrency(data.total)}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-300">recebimento</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {getDeliveryTypeLabel(data.deliveryType)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between bg-white/[0.03] px-6 py-8 sm:px-8 sm:py-9">
        <div className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              proximo capitulo
            </p>
            <h4 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              O cliente sai com mais serenidade e mais vontade de voltar.
            </h4>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
            <div className="space-y-3">
              <SummaryRow
                label="Metodo"
                value={getPaymentMethodLabel(data.paymentMethod)}
              />
              <SummaryRow
                label="Recebimento"
                value={getDeliveryTypeLabel(data.deliveryType)}
              />
              {typeof data.changeAmount === 'number' && (
                <SummaryRow
                  label="Troco previsto"
                  value={formatCurrency(data.changeAmount)}
                />
              )}
              <SummaryRow label="Total confirmado" value={formatCurrency(data.total)} strong />
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                confianca
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                O pedido ficou claro do carrinho ate a confirmacao final.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                retorno
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                Agora a vitrine esta pronta para a proxima compra com o mesmo padrao premium.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-background/60 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              acompanhamento
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">
                  etapa 1
                </p>
                <p className="mt-2 text-sm font-medium text-emerald-50">
                  Pagamento confirmado e pedido registrado com o codigo {data.orderNo || 'da compra'}.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  etapa 2
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  A preparacao e a retirada ou entrega aparecem na pagina de acompanhamento em tempo real.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {data.orderNo && (
            <button
              type="button"
              onClick={onTrackOrder}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
            >
              Acompanhar pedido agora
              <ArrowRight className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onCopyReceipt}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
          >
            <Copy className="size-4" />
            Copiar comprovante
          </button>
          <button
            type="button"
            onClick={onContinueShopping}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            Continuar comprando
            <ArrowRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
          >
            Fechar resumo
          </button>
        </div>
      </div>
    </div>
  );
}
