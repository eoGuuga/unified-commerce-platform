"use client"

import { Container } from "./Container"
import Link from "next/link"
import { useState } from "react"

// Plan data with "under the hood" details
const plans = [
  {
    name: "Essencial",
    price: "Em definição",
    period: "/mês",
    description: "Para começar com o básico da operação unificada.",
    features: [
      "PDV, e-commerce e WhatsApp conectados",
      "Estoque sempre consistente",
      "Indicadores essenciais",
      "Suporte humano",
    ],
    cta: "Agendar demonstração",
    popular: false,
    underTheHood: {
      transactions: "Sob medida",
      lockType: "Proteção automática",
      channels: "Canais essenciais",
      syncLatency: "Em tempo real",
      guarantee: "Suporte padrão",
    },
  },
  {
    name: "Crescimento",
    price: "Em definição",
    period: "/mês",
    description: "Para quem precisa crescer sem perder controle.",
    features: [
      "Automação no WhatsApp",
      "Alertas de ruptura",
      "Relatórios completos",
      "Suporte prioritário",
    ],
    cta: "Agendar demonstração",
    popular: false,
    underTheHood: {
      transactions: "Sob medida",
      lockType: "Proteção avançada",
      channels: "Canais ampliados",
      syncLatency: "Em tempo real",
      guarantee: "Suporte prioritário",
    },
  },
  {
    name: "Escala",
    price: "Em definição",
    period: "/mês",
    description: "Para operações consolidadas e alto volume.",
    features: [
      "Fluxos avançados no WhatsApp",
      "Integrações sob medida",
      "Acesso a API",
      "Onboarding dedicado",
      "SLA contratual",
    ],
    cta: "Agendar demonstração",
    popular: true,
    underTheHood: {
      transactions: "Sob medida",
      lockType: "Fila inteligente",
      channels: "Canais ilimitados",
      syncLatency: "Tempo mínimo",
      guarantee: "SLA dedicado",
    },
  },
  {
    name: "Enterprise",
    price: "Sob medida",
    period: "",
    description: "Para grandes operações com necessidades específicas.",
    features: [
      "Volume ilimitado",
      "Infraestrutura dedicada",
      "Integrações customizadas",
      "Gerente de sucesso",
      "SLA personalizado",
      "Suporte 24/7",
    ],
    cta: "Falar com vendas",
    popular: false,
    underTheHood: {
      transactions: "Sob medida",
      lockType: "Estratégia personalizada",
      channels: "Ilimitados",
      syncLatency: "Tempo mínimo",
      guarantee: "SLA personalizado",
    },
  },
]

// 3D Flip Card Component
function FlipCard({ plan }: { plan: typeof plans[0] }) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  const handleFlip = () => {
    if (isLocked) return
    
    // Brief lock state during transition
    setIsLocked(true)
    setIsFlipped(!isFlipped)
    
    // Release lock after animation
    setTimeout(() => setIsLocked(false), 700)
  }

  return (
    <div 
      className={`group relative ${plan.popular ? "lg:-mt-3 lg:mb-3" : ""}`}
    >
      <div className="relative min-h-[560px] h-full" style={{ perspective: "1200px" }}>
      {/* Popular badge */}
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <span className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider bg-foreground text-background rounded-full">
            Mais popular
          </span>
        </div>
      )}

      {/* Card Container with 3D transform */}
        <div
          className="relative h-full transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
        {/* Front Face */}
          <div
            className={`absolute inset-0 flex flex-col p-6 rounded-xl transition-colors ${
            plan.popular
              ? "bg-foreground text-background border-2 border-foreground"
              : "border border-border/40 bg-card/20 hover:border-border/60 hover:bg-card/30"
            } ${isFlipped ? "pointer-events-none" : ""}`}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          {/* Lock indicator during flip */}
          {isLocked && (
            <div className="absolute inset-0 rounded-xl bg-background/5 flex items-center justify-center z-10">
              <div className="w-5 h-5 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
            </div>
          )}

          <div className="relative flex-1 flex flex-col">
            {/* Header */}
            <div className="mb-6">
              <h3 className={`card-title-sm mb-4 ${plan.popular ? "" : ""}`}>
                {plan.name}
              </h3>
              <div className="flex items-baseline gap-0.5">
                {!["Sob medida", "Em definição"].includes(plan.price) && (
                  <span className={`text-sm ${plan.popular ? "opacity-50" : "text-muted-foreground"}`}>R$</span>
                )}
                <span className="text-3xl font-semibold tracking-[-0.02em]">{plan.price}</span>
              {plan.period && !["Sob medida", "Em definição"].includes(plan.price) && (
                <span className={`text-sm ${plan.popular ? "opacity-40" : "text-muted-foreground"}`}>
                  {plan.period}
                </span>
              )}
            </div>
              <p className={`mt-3 text-sm leading-relaxed ${plan.popular ? "opacity-60" : "text-muted-foreground"}`}>
                {plan.description}
              </p>
            </div>
            
            {/* Features */}
            <ul className="flex-1 space-y-3 mb-6">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <svg
                    className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className={`text-sm ${plan.popular ? "opacity-80" : "text-foreground/70"}`}>{feature}</span>
                </li>
              ))}
            </ul>
            
            {/* Flip trigger */}
            <button
              onClick={handleFlip}
              className={`mb-4 text-xs font-medium transition-colors flex items-center gap-2 ${
                plan.popular ? "text-background/50 hover:text-background/80" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Ver especificações técnicas
            </button>
            
            {/* CTA */}
            <Link
              href="#demo"
              className={`inline-flex items-center justify-center h-12 px-6 text-sm font-medium rounded-lg transition-colors ${
                plan.popular
                  ? "bg-background text-foreground hover:bg-background/90"
                  : "bg-foreground text-background hover:bg-foreground/90"
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        </div>

        {/* Back Face - Under the Hood */}
          <div
            className={`absolute inset-0 flex flex-col p-7 lg:p-8 rounded-xl ${
            plan.popular
              ? "bg-foreground text-background border-2 border-foreground"
              : "border border-border/40 bg-card/30"
            } ${!isFlipped ? "pointer-events-none" : ""}`}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {/* Lock indicator during flip */}
          {isLocked && (
            <div className="absolute inset-0 rounded-xl bg-background/5 flex items-center justify-center z-10">
              <div className="w-5 h-5 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
            </div>
          )}

          <div className="relative flex-1 flex flex-col">
            {/* Back Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className={`w-4 h-4 ${plan.popular ? "text-accent" : "text-accent"}`} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                </svg>
                <h3 className={`text-sm font-semibold uppercase tracking-wider ${plan.popular ? "" : "text-foreground"}`}>
                  Detalhes do plano
                </h3>
              </div>
              <p className={`text-xs ${plan.popular ? "opacity-50" : "text-muted-foreground"}`}>
                O que está incluído no plano {plan.name}
              </p>
            </div>
            
            {/* Technical Specs */}
            <div className="flex-1 space-y-4">
              {[
                { label: "Volume mensal", value: plan.underTheHood.transactions, icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
                { label: "Proteção de estoque", value: plan.underTheHood.lockType, icon: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" },
                { label: "Canais", value: plan.underTheHood.channels, icon: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" },
                { label: "Atualização", value: plan.underTheHood.syncLatency, icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" },
                { label: "Suporte", value: plan.underTheHood.guarantee, icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" },
              ].map((spec) => (
                <div 
                  key={spec.label} 
                  className={`flex items-center justify-between py-2.5 border-b ${
                    plan.popular ? "border-background/10" : "border-border/30"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <svg className={`w-3.5 h-3.5 ${plan.popular ? "opacity-40" : "text-muted-foreground"}`} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={spec.icon} />
                    </svg>
                    <span className={`text-xs ${plan.popular ? "opacity-60" : "text-muted-foreground"}`}>{spec.label}</span>
                  </div>
                  <span className={`text-xs font-mono font-medium ${plan.popular ? "" : "text-foreground"}`}>{spec.value}</span>
                </div>
              ))}
            </div>
            
            {/* Flip back button */}
            <button
              onClick={handleFlip}
              className={`mt-6 text-xs font-medium transition-all duration-300 flex items-center gap-2 ${
                plan.popular ? "text-background/50 hover:text-background/80" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <svg className="w-3.5 h-3.5 rotate-180" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              Voltar aos recursos
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

export function Pricing() {
  return (
    <section id="precos" className="section-padding relative">
      {/* Background */}
      <div className="absolute inset-0 mesh-gradient opacity-15" />
      
      <Container className="relative">
        <div className="max-w-3xl mx-auto text-center section-header-gap">
          <div className="badge-base mb-6">
            <span className="relative flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="absolute w-1.5 h-1.5 rounded-full bg-accent animate-ping opacity-30" style={{ animationDuration: "3s" }} />
            </span>
            <span>Preços</span>
          </div>
          
          <h2 className="mb-5">
            <span className="text-foreground">Planos para cada</span>
            <span className="block text-muted-foreground mt-1">momento.</span>
          </h2>
          
          <p className="body-text-lg mx-auto mb-3">
            Escale conforme seu negócio cresce. Sem surpresas, sem taxas ocultas.
          </p>
          
          <p className="text-xs text-muted-foreground/60">
            Clique em qualquer card para ver os detalhes do plano
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 items-stretch">
          {plans.map((plan) => (
            <FlipCard key={plan.name} plan={plan} />
          ))}
        </div>
        
        {/* Trust badges */}
        <div className="mt-10 lg:mt-12 xl:mt-14 flex flex-wrap items-center justify-center gap-6 lg:gap-8 text-sm text-muted-foreground">
          {[
            { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", text: "14 dias grátis" },
            { icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z", text: "Sem cartão de crédito" },
            { icon: "M6 18L18 6M6 6l12 12", text: "Cancele quando quiser" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}







