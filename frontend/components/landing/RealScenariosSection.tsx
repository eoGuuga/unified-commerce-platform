import { CheckCircle, AlertTriangle } from "lucide-react";

const scenarios = [
  {
    title: "Venda Simultânea",
    subtitle: "Última unidade em estoque",
    items: [
      "Cliente A adiciona produto no e-commerce às 14:32:15",
      "Cliente B pede no WhatsApp às 14:32:17 (2s depois)",
      "Cliente A reserva o produto (chegou primeiro)",
      "Cliente B recebe: “Produto indisponível no momento”",
      "Cliente A finaliza compra. Zero overselling.",
    ],
    accent: "bg-emerald-50/60 border-emerald-200",
    icon: CheckCircle,
  },
  {
    title: "Pagamento Falhou",
    subtitle: "Rollback automático",
    items: [
      "Cliente reserva produto no PDV",
      "Produto fica bloqueado por 10 minutos",
      "Cartão recusado ou cliente desiste",
      "Sistema faz rollback automático",
      "Produto volta ao estoque e fica disponível em todos os canais",
    ],
    accent: "bg-amber-50/60 border-amber-200",
    icon: AlertTriangle,
  },
];

export function RealScenariosSection() {
  return (
    <section className="bg-white py-16 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
        <h2 className="text-center text-3xl font-semibold text-slate-900">Cenários Reais de Operação</h2>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {scenarios.map((scenario) => (
            <div key={scenario.title} className={`rounded-2xl border p-6 ${scenario.accent}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow">
                  <scenario.icon className="h-5 w-5 text-slate-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{scenario.title}</p>
                  <p className="text-xs text-slate-500">{scenario.subtitle}</p>
                </div>
              </div>

              <ol className="mt-5 space-y-3 text-sm text-slate-600">
                {scenario.items.map((item, index) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

