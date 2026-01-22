"use client"

import { Container } from "./Container"
import { useRef, useEffect, useState } from "react"

const metrics = [
  {
    value: 99.9,
    suffix: "%",
    label: "Uptime projetado",
    description: "Arquitetura com redundância",
  },
  {
    value: 100,
    prefix: "<",
    suffix: "ms",
    label: "Latência alvo",
    description: "Sincronização entre canais",
  },
  {
    value: 0,
    suffix: "",
    label: "Overselling",
    description: "Meta garantida por contrato",
    accent: true,
  },
  {
    value: 3,
    suffix: "",
    label: "Canais",
    description: "PDV, e-commerce, WhatsApp",
  },
]

// Evolving SyncPulse - Metrics variant (confident/stable, minimal animation)
function SyncPulse({ active }: { active: boolean }) {
  return (
    <div className="relative flex items-center justify-center">
      <div className={`w-2 h-2 rounded-full transition-all duration-1000 ${active ? "bg-accent" : "bg-muted-foreground/30"}`} />
      {active && (
        <>
          {/* Confident, subtle outer ring instead of ping */}
          <div className="absolute w-4 h-4 rounded-full border border-accent/20 transition-all duration-1000" />
        </>
      )}
    </div>
  )
}

function AnimatedCounter({ 
  value, 
  prefix = "", 
  suffix, 
  accent 
}: { 
  value: number; 
  prefix?: string;
  suffix: string; 
  accent?: boolean 
}) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          const duration = 2500 // Slower, more deliberate
          const steps = 60
          const stepValue = value / steps
          let current = 0
          
          const timer = setInterval(() => {
            current += stepValue
            if (current >= value) {
              setCount(value)
              clearInterval(timer)
            } else {
              setCount(Number.isInteger(value) ? Math.floor(current) : Number(current.toFixed(2)))
            }
          }, duration / steps)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, hasAnimated])

  const displayValue = Number.isInteger(value) ? count : count.toFixed(2)

  return (
    <div ref={ref} className="flex items-baseline justify-center gap-0.5">
      {prefix && (
        <span className={`stat-value ${accent ? "text-accent" : "text-foreground"}`}>
          {prefix}
        </span>
      )}
      <span className={`stat-value-lg ${accent ? "text-accent" : "text-foreground"}`}>
        {displayValue}
      </span>
      <span className="text-xl lg:text-2xl font-semibold text-accent">
        {suffix}
      </span>
    </div>
  )
}

export function Metrics() {
  const [isInView, setIsInView] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

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

  return (
    <section ref={sectionRef} className="section-padding relative">
      {/* Background */}
      <div className="absolute inset-0 mesh-gradient opacity-20" />
      
      <Container className="relative">
        <div className="max-w-3xl mx-auto text-center section-header-gap">
          <div className="badge-base mb-6">
            <SyncPulse active={isInView} />
            <span>Resultados</span>
          </div>
          
          <h2 className="mb-5">
            <span className="text-foreground">Arquitetura projetada</span>
            <span className="block text-accent mt-1">para performance.</span>
          </h2>
          
          <p className="body-text-lg mx-auto">
            Infraestrutura desenhada para alta disponibilidade e baixa laténcia. 
            Métricas em validação contínua.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 xl:gap-7">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className="relative p-6 lg:p-7 xl:p-8 card-base card-interactive"
            >
              {/* Sync indicator for the "0 overselling" metric */}
              {metric.accent && (
                <div className="absolute top-4 right-4">
                  <SyncPulse active={isInView} />
                </div>
              )}
              
              <div className="text-center">
                <AnimatedCounter 
                  value={metric.value} 
                  prefix={metric.prefix}
                  suffix={metric.suffix} 
                  accent={metric.accent}
                />
                
                <div className="mt-6 pt-6 border-t border-border/30">
                  <p className="text-sm font-medium text-foreground mb-1">
                    {metric.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {metric.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* System status */}
        <div className="mt-10 lg:mt-12 xl:mt-14 text-center">
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Sistema em fase de validação | Métricas monitoradas continuamente
          </span>
        </div>
      </Container>
    </section>
  )
}



