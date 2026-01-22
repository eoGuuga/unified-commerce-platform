"use client"

import { Container } from "./Container"
import Link from "next/link"
import { useState } from "react"

const plans = [
  {
    name: "Essencial",
    price: "297",
    period: "/mes",
    description: "Para pequenos negocios comecando a vender em multiplos canais.",
    features: [
      "Ate 500 pedidos/mes",
      "2 canais de venda",
      "Sincronizacao em tempo real",
      "Suporte por e-mail",
    ],
    cta: "Comecar teste",
    popular: false,
  },
  {
    name: "Crescimento",
    price: "597",
    period: "/mes",
    description: "Para negocios em expansao que precisam de mais recursos.",
    features: [
      "Ate 2.000 pedidos/mes",
      "4 canais de venda",
      "WhatsApp Bot basico",
      "Relatorios avancados",
      "Suporte prioritario",
    ],
    cta: "Comecar teste",
    popular: false,
  },
  {
    name: "Escala",
    price: "997",
    period: "/mes",
    description: "Para operacoes maduras com alto volume de vendas.",
    features: [
      "Ate 10.000 pedidos/mes",
      "Canais ilimitados",
      "WhatsApp Bot completo",
      "API personalizada",
      "Onboarding dedicado",
      "SLA garantido",
    ],
    cta: "Comecar teste",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Para grandes operacoes com necessidades especificas.",
    features: [
      "Volume ilimitado",
      "Infraestrutura dedicada",
      "Integracoes customizadas",
      "Account manager",
      "SLA personalizado",
      "Suporte 24/7",
    ],
    cta: "Falar com vendas",
    popular: false,
  },
]

export function Pricing() {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null)

  return (
    <section id="precos" className="py-32 lg:py-44 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 mesh-gradient opacity-30" />
      <div className="absolute inset-0 grid-pattern-fade opacity-30" />
      
      <Container className="relative">
        <div className="max-w-4xl mx-auto text-center mb-20 lg:mb-28">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full glass glass-border mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            <span className="text-sm font-medium text-muted-foreground">Precos</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
            <span className="text-gradient-radial">Planos para cada</span>
            <span className="block mt-2 text-muted-foreground">momento.</span>
          </h2>
          
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Escale conforme seu negocio cresce. Sem surpresas, sem taxas ocultas.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`group relative flex flex-col transition-all duration-700 ${
                plan.popular ? "lg:scale-[1.02] lg:z-10" : ""
              }`}
              onMouseEnter={() => setHoveredPlan(plan.name)}
              onMouseLeave={() => setHoveredPlan(null)}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                  <span className="relative px-5 py-2 text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-accent to-[oklch(0.65_0.22_200)] text-accent-foreground rounded-full shadow-xl shadow-accent/30">
                    <span className="relative z-10">Mais popular</span>
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-accent to-[oklch(0.65_0.22_200)] blur-lg opacity-50" />
                  </span>
                </div>
              )}
              
              {/* Card */}
              <div className={`relative flex-1 flex flex-col p-8 lg:p-10 rounded-3xl overflow-hidden transition-all duration-700 ${
                plan.popular
                  ? "bg-foreground text-background border-2 border-foreground"
                  : "border border-border/50 bg-card/30 backdrop-blur-xl hover:border-border"
              } ${hoveredPlan === plan.name && !plan.popular ? "scale-[1.02]" : ""}`}>
                
                {/* Glow for popular */}
                {plan.popular && (
                  <>
                    <div className="absolute -inset-1 rounded-3xl bg-gradient-to-b from-accent/50 via-accent/20 to-transparent blur-2xl opacity-40" />
                    <div className="absolute inset-0 shine" />
                  </>
                )}
                
                <div className="relative flex-1 flex flex-col">
                  {/* Header */}
                  <div className="mb-8">
                    <h3 className={`text-xl font-bold mb-6 ${plan.popular ? "" : "text-foreground"}`}>
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1">
                      {plan.price !== "Custom" && (
                        <span className={`text-lg ${plan.popular ? "opacity-50" : "text-muted-foreground"}`}>R$</span>
                      )}
                      <span className="text-5xl lg:text-6xl font-black tracking-tight">{plan.price}</span>
                      {plan.period && (
                        <span className={`text-lg ${plan.popular ? "opacity-40" : "text-muted-foreground"}`}>
                          {plan.period}
                        </span>
                      )}
                    </div>
                    <p className={`mt-4 text-sm leading-relaxed ${plan.popular ? "opacity-60" : "text-muted-foreground"}`}>
                      {plan.description}
                    </p>
                  </div>
                  
                  {/* Features */}
                  <ul className="flex-1 space-y-4 mb-10">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-full flex items-center justify-center ${
                          plan.popular ? "bg-accent/20" : "bg-accent/10"
                        }`}>
                          <svg
                            className="w-3 h-3 text-accent"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="3"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </div>
                        <span className={`text-sm ${plan.popular ? "opacity-80" : "text-foreground/80"}`}>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {/* CTA */}
                  <Link
                    href="#"
                    className={`group/btn relative inline-flex items-center justify-center px-6 py-4 text-sm font-bold rounded-2xl overflow-hidden transition-all duration-500 ${
                      plan.popular
                        ? "bg-background text-foreground"
                        : "bg-foreground text-background"
                    }`}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {plan.cta}
                      <svg className="w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </span>
                    <div className={`absolute inset-0 transition-transform duration-500 -translate-x-full group-hover/btn:translate-x-0 ${
                      plan.popular
                        ? "bg-gradient-to-r from-accent/20 to-transparent"
                        : "bg-gradient-to-r from-accent to-[oklch(0.65_0.22_280)]"
                    }`} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Trust badges */}
        <div className="mt-20 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>14 dias gratis</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span>Sem cartao de credito</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Cancele quando quiser</span>
          </div>
        </div>
      </Container>
      
      {/* Bottom Line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  )
}
