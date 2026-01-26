"use client"

import { Container } from "./Container"
import { useRef, useEffect, useState } from "react"

const differentials = [
  {
    icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
    title: "Zero overselling",
    description: "Transações ACID com reserva atômica. Cada venda bloqueia o estoque instantaneamente, impossibilitando vendas duplicadas.",
    highlight: "Garantido por contrato",
    stat: "0",
    statLabel: "meta",
  },
  {
    icon: "M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z",
    title: "WhatsApp Bot nativo",
    description: "Bot integrado que consulta estoque em tempo real, processa pedidos e atualiza disponibilidade automaticamente.",
    highlight: "Vendas 24/7",
    stat: "24/7",
    statLabel: "disponível",
  },
  {
    icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
    title: "Operação contínua",
    description: "Infraestrutura redundante com failover automático. Arquitetura projetada para alta disponibilidade.",
    highlight: "Alta disponibilidade",
    stat: "<100",
    statLabel: "ms alvo",
  },
]

function DifferentialCard({ diff, index }: { diff: typeof differentials[0]; index: number }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), index * 140)
        }
      },
      { threshold: 0.2 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [index])

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div className="relative h-full p-6 lg:p-7 xl:p-8 card-elevated card-interactive">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          {/* Icon */}
          <div className="icon-box bg-accent/8">
            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d={diff.icon} />
            </svg>
          </div>
          
          {/* Stat */}
          <div className="text-right">
            <p className="stat-value text-accent">
              {diff.stat}
            </p>
            <p className="micro-text mt-1">{diff.statLabel}</p>
          </div>
        </div>
        
        {/* Content */}
        <h3 className="card-title mb-3">
          {diff.title}
        </h3>
        <p className="small-text leading-relaxed mb-5">
          {diff.description}
        </p>
        
        {/* Tag */}
        <div className="badge-accent">
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {diff.highlight}
        </div>
      </div>
    </div>
  )
}

export function Differentials() {
  return (
    <section className="section-padding relative bg-secondary/15">
      {/* Background */}
      <div className="absolute inset-0 dot-pattern opacity-10" />
      
      <Container className="relative">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 lg:gap-12 xl:gap-16 section-header-gap">
          <div className="max-w-2xl">
            <div className="badge-base mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>Diferenciais</span>
            </div>
            
            <h2>
              <span className="text-foreground">Por que escolher</span>
              <span className="block text-muted-foreground mt-1">a GTSoftHub.</span>
            </h2>
          </div>
          
          <p className="body-text-lg lg:text-right lg:max-w-md">
            Tecnologia projetada para operações que não podem falhar. Garantias reais em contrato.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid md:grid-cols-3 gap-5 lg:gap-6 xl:gap-8">
          {differentials.map((diff, index) => (
            <DifferentialCard key={diff.title} diff={diff} index={index} />
          ))}
        </div>
      </Container>
    </section>
  )
}




