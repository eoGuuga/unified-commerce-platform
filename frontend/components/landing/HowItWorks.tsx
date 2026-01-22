"use client"

import { Container } from "./Container"
import { useRef, useEffect, useState } from "react"

const steps = [
  {
    step: "01",
    title: "Captura",
    description: "Pedido entra por qualquer canal e e capturado instantaneamente pelo backend central.",
    icon: "M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3",
    gradient: "from-blue-500 via-blue-400 to-cyan-400",
  },
  {
    step: "02",
    title: "Reserva",
    description: "Estoque e reservado atomicamente antes de qualquer confirmacao. Bloqueio imediato e seguro.",
    icon: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
    gradient: "from-violet-500 via-purple-400 to-fuchsia-400",
  },
  {
    step: "03",
    title: "Confirmacao",
    description: "Transacao validada com sucesso. Estoque atualizado em todos os canais simultaneamente.",
    icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    gradient: "from-accent via-emerald-400 to-teal-400",
  },
  {
    step: "04",
    title: "Entrega",
    description: "Pedido segue para fulfillment com rastreamento integrado e status em tempo real.",
    icon: "M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12",
    gradient: "from-amber-500 via-orange-400 to-red-400",
  },
]

function StepCard({ step, index, activeStep }: { step: typeof steps[0]; index: number; activeStep: number }) {
  const isActive = index === activeStep
  const isPast = index < activeStep

  return (
    <div className="group relative">
      {/* Connection Line */}
      {index < steps.length - 1 && (
        <div className="hidden lg:block absolute top-10 left-[calc(100%+0.5rem)] w-[calc(100%-1rem)] h-0.5">
          <div className="absolute inset-0 bg-border/50" />
          <div 
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${step.gradient} transition-all duration-1000 ease-out`}
            style={{ width: isPast || isActive ? '100%' : '0%' }}
          />
        </div>
      )}
      
      {/* Card */}
      <div className={`relative p-8 rounded-3xl border transition-all duration-700 ${
        isActive 
          ? "border-accent/50 bg-accent/5 scale-105" 
          : isPast
            ? "border-accent/30 bg-card/50"
            : "border-border/50 bg-card/30"
      }`}>
        {/* Glow */}
        {isActive && (
          <div className="absolute -inset-2 rounded-[1.75rem] bg-gradient-to-r from-accent/20 to-transparent blur-xl opacity-60" />
        )}
        
        <div className="relative">
          {/* Icon */}
          <div className={`relative w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br ${step.gradient} p-[2px] overflow-hidden transition-transform duration-500 ${isActive ? "scale-110" : ""}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
            <div className="relative w-full h-full rounded-2xl bg-card flex items-center justify-center">
              <svg className={`w-8 h-8 transition-colors duration-500 ${isActive || isPast ? "text-foreground" : "text-muted-foreground"}`} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
              </svg>
            </div>
          </div>
          
          {/* Step number */}
          <div className="flex items-center gap-3 mb-4">
            <span className={`text-sm font-mono transition-colors duration-500 ${isActive ? "text-accent" : "text-muted-foreground"}`}>
              Passo {step.step}
            </span>
            <div className={`h-px flex-1 transition-colors duration-500 ${isActive ? "bg-accent/50" : "bg-border/50"}`} />
          </div>
          
          {/* Content */}
          <h3 className="text-2xl font-bold text-foreground mb-3 tracking-tight">
            {step.title}
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            {step.description}
          </p>
        </div>
      </div>
    </div>
  )
}

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
        }
      },
      { threshold: 0.3 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isInView) return
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [isInView])

  return (
    <section ref={sectionRef} id="como-funciona" className="py-32 lg:py-44 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-radial opacity-30" />
      <div className="absolute inset-0 grid-pattern-fade opacity-30" />
      
      <Container className="relative">
        {/* Header */}
        <div className="max-w-4xl mx-auto text-center mb-20 lg:mb-28">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full glass glass-border mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            <span className="text-sm font-medium text-muted-foreground">Processo</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
            <span className="text-gradient-radial">Como funciona</span>
          </h2>
          
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Do pedido a entrega em quatro etapas automatizadas. Sem intervencao manual, sem erros humanos.
          </p>
        </div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
          {steps.map((step, index) => (
            <StepCard key={step.step} step={step} index={index} activeStep={activeStep} />
          ))}
        </div>
        
        {/* Progress indicators */}
        <div className="flex justify-center gap-2 mt-12">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveStep(index)}
              className={`w-12 h-1.5 rounded-full transition-all duration-500 ${
                index === activeStep ? "bg-accent" : "bg-border hover:bg-border/80"
              }`}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>
      </Container>
      
      {/* Bottom Line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  )
}
