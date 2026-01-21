import { CheckCircle, XCircle } from "lucide-react";

const without = [
  {
    title: "Cada canal tem seu próprio estoque",
    description: "Atualização manual e propensa a erros",
  },
  {
    title: "Sincronização por planilhas ou APIs frágeis",
    description: "Atrasos de minutos ou horas",
  },
  {
    title: "Overselling frequente",
    description: "Clientes frustrados e prejuízo financeiro",
  },
  {
    title: "Dados conflitantes entre sistemas",
    description: "Impossível ter visão unificada do negócio",
  },
];

const withUcm = [
  {
    title: "Uma única fonte da verdade",
    description: "Todos os canais consultam o mesmo backend",
  },
  {
    title: "Sincronização em tempo real",
    description: "Atualização instantânea em todos os canais",
  },
  {
    title: "Zero overselling garantido",
    description: "Reserva atômica impede vendas duplicadas",
  },
  {
    title: "Visão unificada e confiável",
    description: "Dados consistentes para tomada de decisão",
  },
];

export function ComparisonSection() {
  return (
    <section className="bg-white py-16 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-500">
                <XCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Sem UCM</p>
                <p className="text-xs text-slate-500">Sistemas isolados</p>
              </div>
            </div>
            <ul className="mt-5 space-y-4 text-sm text-slate-600">
              {without.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-rose-400" />
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <CheckCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Com UCM</p>
                <p className="text-xs text-slate-500">Backend unificado</p>
              </div>
            </div>
            <ul className="mt-5 space-y-4 text-sm text-slate-600">
              {withUcm.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

