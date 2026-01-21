import { Database, ShieldCheck, Zap, Lock } from "lucide-react";

const systemCards = [
  {
    title: "Transações ACID",
    description: "Garantia de consistência em todas as operações",
    icon: ShieldCheck,
  },
  {
    title: "Tempo Real",
    description: "Sincronização instantânea entre canais",
    icon: Zap,
  },
  {
    title: "Reserva Atômica",
    description: "Bloqueio imediato de estoque vendido",
    icon: Lock,
  },
];

const channelCards = [
  { title: "PDV Físico", subtitle: "Terminal de vendas presencial" },
  { title: "E-commerce", subtitle: "Loja virtual online" },
  { title: "WhatsApp Bot", subtitle: "Vendas por mensagem" },
];

export function ArchitectureDiagram() {
  return (
    <section className="bg-white pb-20 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
        <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-10 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-xs font-semibold text-slate-600 shadow">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />Arquitetura do Sistema
            </span>
          </div>

          <div className="mt-8 rounded-2xl border border-blue-100 bg-white p-8 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <Database className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">Backend Central UCM</h3>
              <p className="text-sm text-slate-500">Fonte Única da Verdade</p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {systemCards.map((card) => (
                <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <card.icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                      <p className="text-xs text-slate-500">{card.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/70 px-6 py-4 text-xs text-slate-600">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">Status do Sistema</p>
                  <p className="text-sm font-semibold text-emerald-600">Operacional</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Uptime</p>
                  <p className="text-sm font-semibold text-slate-900">99.99%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Latência Média</p>
                  <p className="text-sm font-semibold text-slate-900">23ms</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {channelCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-slate-100" />
                <h4 className="text-sm font-semibold text-slate-900">{card.title}</h4>
                <p className="mt-1 text-xs text-slate-500">{card.subtitle}</p>
                <div className="mt-4 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                  Status · Sincronizado
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

