import { Container } from "./Container"

const plans = [
  {
    name: "Essencial",
    price: "R$ 297",
    period: "/m�s",
    description: "Para pequenos neg�cios come�ando a vender em m�ltiplos canais.",
    features: [
      "At� 500 pedidos/m�s",
      "2 canais de venda",
      "Sincroniza��o em tempo real",
      "Suporte por e-mail",
    ],
    cta: "Come�ar teste",
    popular: false,
  },
  {
    name: "Crescimento",
    price: "R$ 597",
    period: "/m�s",
    description: "Para neg�cios em expans�o que precisam de mais recursos.",
    features: [
      "At� 2.000 pedidos/m�s",
      "4 canais de venda",
      "WhatsApp Bot b�sico",
      "Relat�rios avan�ados",
      "Suporte priorit�rio",
    ],
    cta: "Come�ar teste",
    popular: false,
  },
  {
    name: "Escala",
    price: "R$ 997",
    period: "/m�s",
    description: "Para opera��es maduras com alto volume de vendas.",
    features: [
      "At� 10.000 pedidos/m�s",
      "Canais ilimitados",
      "WhatsApp Bot completo",
      "API personalizada",
      "Onboarding dedicado",
      "SLA garantido",
    ],
    cta: "Come�ar teste",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    description: "Para grandes opera��es com necessidades espec�ficas.",
    features: [
      "Volume ilimitado",
      "Infraestrutura dedicada",
      "Integra��es customizadas",
      "Account manager",
      "SLA personalizado",
      "Suporte 24/7",
    ],
    cta: "Falar com vendas",
    popular: false,
  },
]

export function Pricing() {
  return (
    <section id="planos" className="py-20 lg:py-32 bg-muted/30">
      <Container>
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight mb-4">
            Planos para cada momento
          </h2>
          <p className="text-lg text-muted-foreground">
            Escale conforme seu neg�cio cresce. Sem surpresas, sem taxas ocultas.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col p-6 lg:p-8 rounded-2xl border transition-all duration-300 ${
                plan.popular
                  ? "bg-primary text-primary-foreground border-primary shadow-2xl shadow-primary/20 scale-105"
                  : "bg-card text-foreground border-border hover:shadow-lg"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-medium bg-accent text-accent-foreground rounded-full">
                    Mais popular
                  </span>
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className={plan.popular ? "opacity-70" : "text-muted-foreground"}>
                      {plan.period}
                    </span>
                  )}
                </div>
                <p className={`mt-2 text-sm ${plan.popular ? "opacity-80" : "text-muted-foreground"}`}>
                  {plan.description}
                </p>
              </div>
              
              <ul className="flex-1 space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <svg
                      className={`w-5 h-5 flex-shrink-0 ${plan.popular ? "text-accent" : "text-accent"}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className={plan.popular ? "opacity-90" : ""}>{feature}</span>
                  </li>
                ))}
              </ul>
              
              <a
                href="#"
                className={`inline-flex items-center justify-center px-6 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                  plan.popular
                    ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
