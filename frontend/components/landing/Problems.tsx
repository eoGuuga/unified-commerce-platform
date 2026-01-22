"use client"

import { Container } from "./Container"
import { useRef, useEffect, useState } from "react"

const problems = [
  {
    number: "01",
    title: "Overselling constante",
    description: "Vendas simult�neas em m�ltiplos canais causam promessas imposs�veis. Clientes frustrados, reembolsos e reputa��o destru�da.",
    icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
    stat: "comum",
    statLabel: "no varejo",
  },
  {
    number: "02",
    title: "Dessincronia de dados",
    description: "Sistemas que n�o conversam. Planilhas manuais, integra��es fr�geis e dados desatualizados gerando decis�es erradas.",
    icon: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
    stat: "horas",
    statLabel: "perdidas/dia",
  },
  {
    number: "03",
    title: "Carga mental excessiva",
    description: "Equipe gastando horas apagando inc�ndios. Confer�ncias manuais, clientes insatisfeitos e opera��o sempre no limite.",
    icon: "M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z",
    stat: "alto",
    statLabel: "risco burnout",
  },
]

function AnimatedCard({ problem, index }: { problem: typeof problems[0]; index: number }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), index * 120)
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
      <div className="relative h-full p-6 lg:p-7 xl:p-8 card-base card-interactive">
        {/* Header row */}
        <div className="flex items-start justify-between mb-6">
          {/* Icon */}
          <div className="icon-box bg-destructive/8">
            <svg className="w-6 h-6 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d={problem.icon} />
            </svg>
          </div>
          
          {/* Stat */}
          <div className="text-right">
            <p className="stat-value text-destructive">
              {problem.stat}
            </p>
            <p className="micro-text mt-1">{problem.statLabel}</p>
          </div>
        </div>
        
        {/* Number line */}
        <div className="flex items-center gap-4 mb-5">
          <span className="text-xs font-mono text-muted-foreground/50">{problem.number}</span>
          <div className="flex-1 h-px bg-border/40" />
        </div>
        
        {/* Content */}
        <h3 className="card-title mb-3">
          {problem.title}
        </h3>
        <p className="small-text leading-relaxed">
          {problem.description}
        </p>
      </div>
    </div>
  )
}

export function Problems() {
  return (
    <section id="problema" className="section-padding relative">
      {/* Background */}
      <div className="absolute inset-0 gradient-radial opacity-20" />
      
      <Container className="relative">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center section-header-gap">
          <div className="badge-base mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            <span>O Problema</span>
          </div>
          
          <h2 className="mb-5">
            <span className="text-foreground">Problemas que voc�</span>
            <span className="block text-muted-foreground mt-1">conhece bem demais.</span>
          </h2>
          
          <p className="body-text-lg mx-auto">
            Se voc� vende em m�ltiplos canais, j� enfrentou isso. E sabe exatamente quanto custa em dinheiro, tempo e reputa��o.
          </p>
        </div>

        {/* Problem Cards */}
        <div className="grid md:grid-cols-3 gap-5 lg:gap-6 xl:gap-8">
          {problems.map((problem, index) => (
            <AnimatedCard key={problem.title} problem={problem} index={index} />
          ))}
        </div>
      </Container>
    </section>
  )
}
