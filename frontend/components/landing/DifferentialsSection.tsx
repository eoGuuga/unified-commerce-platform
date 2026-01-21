import { ShieldCheck, MessageCircle, Infinity } from "lucide-react";

const cards = [
  {
    title: "Zero Overselling",
    description:
      "Não é marketing. É garantia técnica. Transações ACID e reserva atômica impedem que o mesmo produto seja vendido duas vezes.",
    items: [
      "Bloqueio instantâneo no momento da venda",
      "Rollback automático se pagamento falhar",
      "Sincronização em menos de 100ms",
    ],
    icon: ShieldCheck,
  },
  {
    title: "WhatsApp Bot Inteligente",
    description:
      "Não é chatbot genérico. É vendedor automatizado que consulta estoque real, processa pagamentos e confirma pedidos.",
    items: [
      "Consulta estoque em tempo real",
      "Processa pagamentos via Pix/cartão",
      "Confirma pedido e reserva produto",
    ],
    icon: MessageCircle,
  },
  {
    title: "Operação Contínua",
    description:
      "Venda 24/7 em todos os canais simultaneamente. O sistema nunca trava porque uma venda está sendo processada em outro lugar.",
    items: ["99,99% de uptime garantido", "Processamento paralelo de vendas", "Failover automático"],
    icon: Infinity,
  },
];

export function DifferentialsSection() {
  return (
    <section className="bg-slate-950 py-20 text-white">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-4 py-1 text-xs font-semibold text-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />Diferenciais Absolutos
          </span>
          <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
            Por que a UCM é diferente de tudo que você já viu
          </h2>
          <p className="mt-3 text-base text-slate-300">
            Não é só mais um sistema. É infraestrutura crítica para operações omnichannel.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {cards.map((card) => (
            <div key={card.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-emerald-300">
                <card.icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{card.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{card.description}</p>

              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-200">
                <p className="text-xs font-semibold text-slate-400">Como funciona:</p>
                <ul className="mt-3 space-y-2">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
