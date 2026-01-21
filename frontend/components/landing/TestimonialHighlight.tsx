import { Quote } from "lucide-react";

export function TestimonialHighlight() {
  return (
    <section className="bg-white py-16 text-slate-900">
      <div className="mx-auto w-full max-w-5xl px-6 lg:px-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap gap-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
              <Quote className="h-6 w-6 text-slate-500" aria-hidden="true" />
            </div>
            <div className="flex-1 space-y-4">
              <p className="text-lg text-slate-700">
                "Era sexta-feira, 18h. Cliente comprou no site. Vendedor acabou de vender a última peça na loja. Eu só descobri
                no sábado de manhã. Tive que ligar pro cliente explicando que não tinha mais."
                <span className="text-rose-500"> Ele nunca mais voltou.</span>
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Rafael Costa</p>
                  <p className="text-xs text-slate-500">Dono, Loja de Roupas</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-xs font-semibold text-slate-500">Esse problema tem nome:</p>
            <h3 className="mt-2 text-lg font-semibold text-rose-500">OVERSELLING</h3>
            <p className="mt-2 text-sm text-slate-600">
              Ele acontece toda vez que seus sistemas não conversam entre si em tempo real.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
