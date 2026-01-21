import { ShieldAlert, AlertTriangle, Brain } from "lucide-react";

const problems = [
  {
    title: "Overselling",
    description:
      "Cliente compra no site. Vendedor vende a última unidade no PDV. Dois pedidos para um produto que não existe mais.",
    consequences: ["Pedido cancelado", "Cliente frustrado", "Reputação prejudicada"],
    accent: "border-rose-200 bg-rose-50/60",
    icon: ShieldAlert,
  },
  {
    title: "Dessincronia",
    description:
      "Cada sistema tem seu próprio estoque. Você atualiza manualmente. Mas sempre tem um atraso. Sempre tem um erro.",
    consequences: ["Horas perdidas em conferência", "Dados conflitantes", "Decisões erradas"],
    accent: "border-amber-200 bg-amber-50/60",
    icon: AlertTriangle,
  },
  {
    title: "Carga Mental",
    description:
      "Você não dorme tranquilo. Sempre tem o medo de ter vendido algo que não tem. Sempre conferindo, sempre ajustando.",
    consequences: ["Estresse operacional constante", "Tempo gasto em controle manual", "Crescimento limitado"],
    accent: "border-slate-200 bg-slate-50/60",
    icon: Brain,
  },
];

export function ProblemSection() {
  return (
    <section id="problema" className="bg-white py-20 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-1 text-xs font-semibold text-rose-600">
            <span className="h-2 w-2 rounded-full bg-rose-500" />O Problema Real
          </span>
          <h2 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
            Vender em múltiplos canais deveria ser simples. <span className="text-rose-500">Mas não é.</span>
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Quando você vende no PDV, no site e pelo WhatsApp ao mesmo tempo, o estoque vira um campo de batalha. E quem
            perde é você.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {problems.map((item) => (
            <div key={item.title} className={`rounded-2xl border p-6 ${item.accent}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow">
                <item.icon className="h-5 w-5 text-slate-700" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              <div className="mt-4 rounded-xl border border-white/80 bg-white/70 p-4">
                <p className="text-xs font-semibold text-slate-500">Consequência Real:</p>
                <ul className="mt-3 space-y-2 text-xs text-slate-600">
                  {item.consequences.map((text) => (
                    <li key={text} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      {text}
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

