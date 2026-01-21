import { ShieldCheck, Zap, CheckCircle, BarChart3 } from "lucide-react";

const metrics = [
  {
    value: "99,99%",
    label: "Uptime",
    description: "Menos de 1 hora de indisponibilidade por ano",
    icon: ShieldCheck,
  },
  {
    value: "<100ms",
    label: "Latência",
    description: "Sincronização entre canais em tempo real",
    icon: Zap,
  },
  {
    value: "0",
    label: "Overselling",
    description: "Garantia absoluta desde o primeiro dia",
    icon: CheckCircle,
  },
  {
    value: "2.4M+",
    label: "Transações/Mês",
    description: "Processadas com sucesso",
    icon: BarChart3,
  },
];

export function MetricsSection() {
  return (
    <section className="bg-white py-20 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-6 text-center lg:px-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />Prova e Confiança
        </span>
        <h2 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">Números que provam confiabilidade</h2>
        <p className="mt-3 text-base text-slate-600">Não é promessa. São métricas reais de operação.</p>

        <div className="mt-10 grid gap-6 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <metric.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{metric.value}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{metric.label}</p>
              <p className="mt-2 text-xs text-slate-500">{metric.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-6">
          <p className="text-sm font-semibold text-slate-700">Empresas que confiam na UCM</p>
          <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-slate-400 sm:grid-cols-5">
            {["LOJA A", "MARCA B", "SHOP C", "STORE D", "BRAND E"].map((logo) => (
              <span key={logo} className="rounded-xl bg-white px-3 py-2">
                {logo}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

