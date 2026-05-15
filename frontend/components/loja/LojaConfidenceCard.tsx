import { BadgeCheck, CreditCard, ShieldCheck, Truck } from 'lucide-react';

/**
 * Card "Compra segura, rapida e memoravel" - 3 sinais de confianca pro
 * cliente (estoque real, pagamento maduro, entrega clara). 100% estatico.
 */
export function LojaConfidenceCard() {
  return (
    <div className="rounded-[36px] border border-white/10 bg-white/[0.04] p-6 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            sensacao para o cliente
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            Compra segura, rapida e memoravel.
          </h3>
        </div>
        <div className="hidden size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-accent sm:flex">
          <ShieldCheck className="size-6" />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <BadgeCheck className="mt-0.5 size-5 text-accent" />
          <div>
            <p className="font-medium text-foreground">
              Catalogo com leitura de estoque real
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Menos surpresa, mais transparencia e mais confianca no pedido.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <CreditCard className="mt-0.5 size-5 text-accent" />
          <div>
            <p className="font-medium text-foreground">
              Pagamento com cara de operacao madura
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Pix, dinheiro e resumo de pedido claro do inicio ao fim.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <Truck className="mt-0.5 size-5 text-accent" />
          <div>
            <p className="font-medium text-foreground">
              Entrega ou retirada sem confusao
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              O cliente entende o fluxo em segundos e finaliza com mais tranquilidade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
