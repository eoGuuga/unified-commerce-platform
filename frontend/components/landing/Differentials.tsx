"use client"

import { Container } from "./Container"
import { useRef, useEffect, useState } from "react"

const differentials = [
  {
    icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
    title: "Zero overselling",
    description: "Transacoes ACID com reserva atomica. Cada venda bloqueia o estoque instantaneamente, impossibilitando vendas duplicadas.",
    highlight: "Garantido por contrato",
    stat: "0",
    statLabel: "erros/mes",
    gradient: "from-accent via-accent to-[oklch(0.65_0.20_200)]",
  },
  {
    icon: "M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z",
    title: "WhatsApp Bot nativo",
    description: "Bot integrado que consulta estoque em tempo real, processa pedidos e atualiza disponibilidade automaticamente.",
    highlight: "Vendas 24/7",
    stat: "+43%",
    statLabel: "conversoes",
    gradient: "from-green-400 via-emerald-400 to-teal-400",
  },
  {
    icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
    title: "Operacao continua",
    description: "Infraestrutura redundante com failover automatico. Sua operacao nunca para, mesmo em picos extremos de demanda.",
    highlight: "99.99% uptime",
    stat: "<100ms",
    statLabel: "latencia",
    gradient: "from-violet-400 via-purple-400 to-fuchsia-400",
  },
]

function DifferentialCard({ diff, index }: { diff: typeof differentials[0]; index: number }) {
  const [isHovered, setIsHovered] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), index * 200)
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
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow effect */}
      <div className={`absolute -inset-4 rounded-[2rem] bg-gradient-to-r ${diff.gradient} opacity-0 blur-2xl transition-opacity duration-700 ${isHovered ? "opacity-20" : ""}`} />
      
      {/* Card */}
      <div className="relative h-full p-8 lg:p-10 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl overflow-hidden transition-all duration-700 hover:border-white/20 hover-lift">
        {/* Shine effect */}
        <div className="absolute inset-0 shine" />
        
        {/* Background gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${diff.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-700`} />
        
        <div className="relative">
          {/* Header */}
          <div className="flex items-start justify-between mb-10">
            {/* Icon */}
            <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${diff.gradient} p-[1px] overflow-hidden group-hover:scale-110 transition-transform duration-500`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
              <div className="relative w-full h-full rounded-2xl bg-[oklch(0.12_0.015_270)] flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={diff.icon} />
                </svg>
              </div>
            </div>
            
            {/* Stat */}
            <div className="text-right">
              <p className={`text-4xl lg:text-5xl font-black bg-gradient-to-r ${diff.gradient} bg-clip-text text-transparent`}>
                {diff.stat}
              </p>
              <p className="text-sm text-white/50 mt-1">{diff.statLabel}</p>
            </div>
          </div>
          
          {/* Content */}
          <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4 tracking-tight">
            {diff.title}
          </h3>
          <p className="text-white/60 leading-relaxed text-lg mb-8">
            {diff.description}
          </p>
          
          {/* Tag */}
          <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r ${diff.gradient} bg-opacity-10`} style={{ background: `linear-gradient(135deg, oklch(0.20 0.02 270) 0%, oklch(0.15 0.015 270) 100%)` }}>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-gradient-to-r ${diff.gradient}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 bg-gradient-to-r ${diff.gradient}`} />
            </span>
            <span className={`text-sm font-bold bg-gradient-to-r ${diff.gradient} bg-clip-text text-transparent`}>
              {diff.highlight}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Differentials() {
  return (
    <section className="py-32 lg:py-44 relative overflow-hidden bg-[oklch(0.08_0.015_270)]">
      {/* Background */}
      <div className="absolute inset-0 dot-pattern opacity-30" />
      
      {/* Gradient overlays */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      
      {/* Glow spots */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[oklch(0.65_0.22_280_/_0.1)] rounded-full blur-[128px]" />
      
      <Container className="relative">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 lg:gap-16 mb-20 lg:mb-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              <span className="text-sm font-medium text-white/60">Diferenciais</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              <span className="text-white">Por que lideres</span>
              <span className="block mt-2 text-white/50">escolhem a UCM.</span>
            </h2>
          </div>
          
          <p className="text-xl text-white/50 leading-relaxed max-w-md lg:text-right">
            Tecnologia de ponta para operacoes que nao podem falhar. Confiabilidade que voce pode medir.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          {differentials.map((diff, index) => (
            <DifferentialCard key={diff.title} diff={diff} index={index} />
          ))}
        </div>
      </Container>
    </section>
  )
}
