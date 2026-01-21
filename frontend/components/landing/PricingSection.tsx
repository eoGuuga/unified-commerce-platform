const plans = [
  {
    name: "Essencial",
    price: "R$299",
    subtitle: "Para quem está começando no omnichannel",
    features: [
      "Até 2 canais ativos",
      "1.000 transações/mês",
      "Sincronização tempo real",
      "Zero overselling garantido",
      "Suporte por e-mail",
    ],
    cta: "Começar Agora",
  },
  {
    name: "Crescimento",
    price: "R$599",
    subtitle: "Para operações em expansão",
    features: [
      "Até 4 canais ativos",
      "5.000 transações/mês",
      "WhatsApp Bot incluído",
      "Relatórios avançados",
      "Suporte prioritário",
    ],
    cta: "Começar Agora",
  },
  {
    name: "Escala",
    price: "R$999",
    subtitle: "Para operações consolidadas",
    features: [
      "Canais ilimitados",
      "20.000 transações/mês",
      "Multi-loja (até 5)",
      "API completa",
      "Suporte 24/7",
    ],
    cta: "Começar Agora",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    subtitle: "Para grandes operações",
    features: [
      "Tudo do Escala, mais:",
      "SLA customizado",
      "Onboarding dedicado",
      "Integrações customizadas",
      "Account Manager",
    ],
    cta: "Falar com Vendas",
  },
];

export function PricingSection() {
  return (
    <section id="planos" className="bg-white py-20 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-6 text-center lg:px-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1 text-xs font-semibold text-blue-600">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Planos
        </span>
        <h2 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">Escolha o plano ideal para o seu momento</h2>
        <p className="mt-3 text-base text-slate-600">Comece pequeno. Cresça sem trocar de sistema.</p>

        <div className="mt-12 grid gap-6 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 text-left shadow-sm ${
                plan.highlight
                  ? "border-blue-600 bg-gradient-to-b from-blue-700 to-blue-900 text-white"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-xs font-semibold uppercase ${plan.highlight ? "text-blue-100" : "text-slate-400"}`}>
                  {plan.name}
                </p>
                {plan.highlight && (
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                    Mais Popular
                  </span>
                )}
              </div>
              <p className={`mt-3 text-3xl font-semibold ${plan.highlight ? "text-white" : "text-slate-900"}`}>
                {plan.price}
                <span className={`text-sm font-medium ${plan.highlight ? "text-blue-100" : "text-slate-500"}`}>/mês</span>
              </p>
              <p className={`mt-2 text-xs ${plan.highlight ? "text-blue-100" : "text-slate-500"}`}>
                {plan.subtitle}
              </p>
              <ul className={`mt-6 space-y-3 text-sm ${plan.highlight ? "text-blue-50" : "text-slate-600"}`}>
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className={`mt-1 h-2 w-2 rounded-full ${plan.highlight ? "bg-blue-200" : "bg-emerald-400"}`} />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`mt-8 w-full rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  plan.highlight
                    ? "bg-white text-blue-700 hover:bg-blue-50"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

