"use client"

import { Container } from "./Container"
import { useRef, useEffect, useState } from "react"

const problems = [
  {
    number: "01",
    title: "Overselling constante",
    description: "Vendas simultaneas em multiplos canais causam promessas impossiveis. Clientes frustrados, reembolsos e reputacao destruida.",
    icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
    gradient: "from-red-500 to-orange-500",
    bgGradient: "from-red-500/10 via-red-500/5 to-transparent",
    stat: "R$47k",
    statLabel: "perdido/mes em media",
  },
  {
    number: "02",
    title: "Dessincronia de dados",
    description: "Sistemas que nao conversam. Planilhas manuais, integracoes frageis e dados desatualizados gerando decisoes erradas.",
    icon: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
    gradient: "from-amber-500 to-yellow-500",
    bgGradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    stat: "3-5h",
    statLabel: "gastas por dia",
  },
  {
    number: "03",
    title: "Carga mental excessiva",
    description: "Equipe gastando horas apagando incendios. Conferencias manuais, clientes insatisfeitos e operacao sempre no limite.",
    icon: "M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z",
    gradient: "from-purple-500 to-pink-500",
    bgGradient: "from-purple-500/10 via-purple-500/5 to-transparent",
    stat: "68%",
    statLabel: "risco de burnout",
  },
]

function AnimatedCard({ problem, index }: { problem: typeof problems[0]; index: number }) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), index * 150)
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
      className={`group relative transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      {/* Card */}
      <div className="relative h-full p-8 lg:p-10 rounded-3xl border border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden transition-all duration-700 hover:border-border hover-lift hover-glow">
        {/* Background gradient on hover */}
        <div className={`absolute inset-0 bg-gradient-to-br ${problem.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
        
        {/* Shine effect */}
        <div className="absolute inset-0 shine" />
        
        <div className="relative">
          {/* Header row */}
          <div className="flex items-start justify-between mb-8">
            {/* Icon */}
            <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${problem.gradient} p-[1px] overflow-hidden`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
              <div className="relative w-full h-full rounded-2xl bg-card/90 flex items-center justify-center">
                <svg className="w-7 h-7 text-foreground" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={problem.icon} />
                </svg>
              </div>
            </div>
            
            {/* Stat */}
            <div className="text-right">
              <p className={`text-3xl lg:text-4xl font-bold bg-gradient-to-r ${problem.gradient} bg-clip-text text-transparent`}>
                {problem.stat}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{problem.statLabel}</p>
            </div>
          </div>
          
          {/* Number line */}
          <div className="flex items-center gap-4 mb-5">
            <span className="text-sm font-mono text-muted-foreground/60">{problem.number}</span>
            <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
          </div>
          
          {/* Content */}
          <h3 className="text-2xl lg:text-3xl font-bold text-foreground mb-4 tracking-tight">
            {problem.title}
          </h3>
          <p className="text-muted-foreground leading-relaxed text-lg">
            {problem.description}
          </p>
        </div>
      </div>
    </div>
  )
}

export function Problems() {
  return (
    <section id="problema" className="py-32 lg:py-44 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 gradient-radial opacity-40" />
      <div className="absolute inset-0 gradient-radial-purple opacity-30" />
      
      <Container className="relative">
        {/* Header */}
        <div className="max-w-4xl mx-auto text-center mb-20 lg:mb-28">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full glass glass-border mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
            </span>
            <span className="text-sm font-medium text-muted-foreground">O Problema</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
            <span className="text-gradient-radial">Problemas que voce</span>
            <span className="block mt-2 text-muted-foreground">conhece bem demais.</span>
          </h2>
          
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Se voce vende em multiplos canais, ja enfrentou isso. E sabe exatamente quanto custa em dinheiro, tempo e reputacao.
          </p>
        </div>

        {/* Problem Cards */}
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          {problems.map((problem, index) => (
            <AnimatedCard key={problem.title} problem={problem} index={index} />
          ))}
        </div>
      </Container>
      
      {/* Bottom Line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  )
}
