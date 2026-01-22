"use client"

import { Container } from "./Container"
import { useRef, useEffect, useState } from "react"

const metrics = [
  {
    value: 99.99,
    suffix: "%",
    label: "Uptime garantido",
    description: "Disponibilidade continua por SLA",
    gradient: "from-accent to-[oklch(0.65_0.20_200)]",
  },
  {
    value: 87,
    prefix: "<",
    suffix: "ms",
    label: "Sincronizacao",
    description: "Latencia maxima de estoque",
    gradient: "from-blue-400 to-cyan-400",
  },
  {
    value: 0,
    suffix: "",
    label: "Overselling",
    description: "Casos registrados em 2025",
    accent: true,
    gradient: "from-accent to-emerald-400",
  },
  {
    value: 2.4,
    prefix: "+",
    suffix: "k",
    label: "Pedidos/dia",
    description: "Media em operacao ativa",
    gradient: "from-violet-400 to-fuchsia-400",
  },
]

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
          const duration = 2000
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
    <div ref={ref} className="flex items-baseline justify-center gap-1">
      {prefix && (
        <span className={`text-4xl lg:text-5xl font-bold ${accent ? "text-accent" : "text-foreground"}`}>
          {prefix}
        </span>
      )}
      <span className={`text-6xl lg:text-8xl font-black tracking-tighter tabular-nums ${accent ? "text-accent text-glow" : "text-foreground"}`}>
        {displayValue}
      </span>
      <span className="text-3xl lg:text-4xl font-bold text-accent">
        {suffix}
      </span>
    </div>
  )
}

export function Metrics() {
  return (
    <section className="py-32 lg:py-44 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 mesh-gradient opacity-40" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full bg-accent/5 blur-[128px]" />
      
      <Container className="relative">
        <div className="max-w-4xl mx-auto text-center mb-20 lg:mb-28">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full glass glass-border mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            <span className="text-sm font-medium text-muted-foreground">Resultados</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
            <span className="text-gradient-radial">Numeros que</span>
            <span className="block mt-2 text-gradient-accent">comprovam.</span>
          </h2>
          
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Resultados reais de clientes em producao. Metricas auditadas mensalmente.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {metrics.map((metric, i) => (
            <div
              key={metric.label}
              className="group relative p-8 lg:p-10 rounded-3xl border border-border/50 bg-card/30 backdrop-blur-xl overflow-hidden transition-all duration-700 hover:border-accent/30 hover-lift"
            >
              {/* Glow on hover */}
              <div className={`absolute -inset-4 rounded-[2rem] bg-gradient-to-r ${metric.gradient} opacity-0 blur-2xl group-hover:opacity-10 transition-opacity duration-700`} />
              
              {/* Shine */}
              <div className="absolute inset-0 shine" />
              
              <div className="relative text-center">
                <AnimatedCounter 
                  value={metric.value} 
                  prefix={metric.prefix}
                  suffix={metric.suffix} 
                  accent={metric.accent}
                />
                
                <div className="mt-6 pt-6 border-t border-border/50">
                  <p className="font-bold text-lg text-foreground mb-1">
                    {metric.label}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {metric.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
      
      {/* Bottom Line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  )
}
