"use client"

import { Container } from "./Container"
import { useRef, useEffect, useState } from "react"

const features = [
  { text: "Sincronizacao < 100ms", icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" },
  { text: "Transacoes ACID", icon: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" },
  { text: "Webhooks flexiveis", icon: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" },
  { text: "Dashboard realtime", icon: "M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" },
]

const channels = [
  { name: "PDV", subtitle: "Point of Sale", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", gradient: "from-blue-500 via-blue-400 to-cyan-400" },
  { name: "E-commerce", subtitle: "Online Store", icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9", gradient: "from-violet-500 via-purple-400 to-fuchsia-400" },
  { name: "WhatsApp", subtitle: "Business API", icon: "M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z", gradient: "from-green-500 via-emerald-400 to-teal-400" },
]

function AnimatedOrb() {
  return (
    <div className="relative w-48 h-48 lg:w-56 lg:h-56">
      {/* Outer glow */}
      <div className="absolute inset-0 bg-accent/30 rounded-full blur-3xl animate-pulse-glow" />
      
      {/* Orbital rings */}
      <div className="absolute inset-0 rounded-full border border-accent/20 animate-spin-slow" />
      <div className="absolute inset-4 rounded-full border border-accent/30" style={{ animation: 'spin 15s linear infinite reverse' }} />
      <div className="absolute inset-8 rounded-full border border-accent/40" style={{ animation: 'spin 12s linear infinite' }} />
      
      {/* Center hub */}
      <div className="absolute inset-12 rounded-full border-glow overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-card to-card" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-accent to-[oklch(0.65_0.22_200)] flex items-center justify-center shadow-2xl shadow-accent/40">
              <svg className="w-7 h-7 text-accent-foreground" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <p className="mt-2 text-xs font-bold text-foreground uppercase tracking-wider">UCM</p>
          </div>
        </div>
      </div>
      
      {/* Data particles */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-accent shadow-lg shadow-accent/50"
          style={{
            top: '50%',
            left: '50%',
            animation: `orbit ${8 + i * 2}s linear infinite`,
            animationDelay: `${i * -1.5}s`,
          }}
        />
      ))}
    </div>
  )
}

export function Solution() {
  const [activeChannel, setActiveChannel] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveChannel((prev) => (prev + 1) % channels.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section id="solucao" className="py-32 lg:py-44 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 mesh-gradient opacity-50" />
      <div className="absolute inset-0 grid-pattern-fade opacity-40" />
      
      {/* Glow spots */}
      <div className="absolute top-1/4 left-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-[oklch(0.65_0.22_280_/_0.05)] rounded-full blur-3xl" />
      
      <Container className="relative">
        {/* Header */}
        <div className="max-w-4xl mx-auto text-center mb-20 lg:mb-28">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full glass glass-border mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            <span className="text-sm font-medium text-muted-foreground">A Solucao</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
            <span className="text-gradient-radial">Uma unica fonte</span>
            <span className="block mt-2 text-gradient-accent">da verdade.</span>
          </h2>
          
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Backend centralizado que garante consistencia absoluta do estoque. 
            Todas as vendas passam por um unico ponto de controle atomico.
          </p>
        </div>

        {/* Architecture Visualization */}
        <div className="relative max-w-5xl mx-auto mb-20 lg:mb-28">
          <div className="grid lg:grid-cols-[1fr,auto,1fr] items-center gap-8 lg:gap-16">
            {/* Left channels */}
            <div className="flex flex-col gap-4">
              {channels.slice(0, 2).map((channel, i) => (
                <div
                  key={channel.name}
                  className={`group relative p-6 rounded-2xl border transition-all duration-700 cursor-pointer ${
                    activeChannel === i 
                      ? "border-accent/50 bg-accent/5 scale-105" 
                      : "border-border/50 bg-card/30 hover:border-border"
                  }`}
                  onClick={() => setActiveChannel(i)}
                >
                  {/* Connection line */}
                  <div className="hidden lg:block absolute right-0 top-1/2 w-8 h-px">
                    <div className={`h-full transition-all duration-500 ${activeChannel === i ? "bg-gradient-to-r from-accent to-accent/50" : "bg-border"}`} />
                    <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-all duration-500 ${activeChannel === i ? "bg-accent shadow-lg shadow-accent/50" : "bg-border"}`} />
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${channel.gradient} flex items-center justify-center shadow-xl transition-transform duration-500 group-hover:scale-110`}>
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d={channel.icon} />
                      </svg>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-foreground">{channel.name}</p>
                      <p className="text-sm text-muted-foreground">{channel.subtitle}</p>
                    </div>
                    {activeChannel === i && (
                      <div className="ml-auto flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Center Hub */}
            <div className="flex justify-center order-first lg:order-none">
              <AnimatedOrb />
            </div>
            
            {/* Right channel + status */}
            <div className="flex flex-col gap-4">
              <div
                className={`group relative p-6 rounded-2xl border transition-all duration-700 cursor-pointer ${
                  activeChannel === 2 
                    ? "border-accent/50 bg-accent/5 scale-105" 
                    : "border-border/50 bg-card/30 hover:border-border"
                }`}
                onClick={() => setActiveChannel(2)}
              >
                {/* Connection line */}
                <div className="hidden lg:block absolute left-0 top-1/2 w-8 h-px">
                  <div className={`h-full transition-all duration-500 ${activeChannel === 2 ? "bg-gradient-to-l from-accent to-accent/50" : "bg-border"}`} />
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-all duration-500 ${activeChannel === 2 ? "bg-accent shadow-lg shadow-accent/50" : "bg-border"}`} />
                </div>
                
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${channels[2].gradient} flex items-center justify-center shadow-xl transition-transform duration-500 group-hover:scale-110`}>
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={channels[2].icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{channels[2].name}</p>
                    <p className="text-sm text-muted-foreground">{channels[2].subtitle}</p>
                  </div>
                  {activeChannel === 2 && (
                    <div className="ml-auto flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Status panel */}
              <div className="p-6 rounded-2xl glass glass-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Status do Sistema</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Uptime</span>
                    <span className="text-sm font-bold text-accent">99.99%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Latencia</span>
                    <span className="text-sm font-bold text-foreground">&lt;100ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Erros</span>
                    <span className="text-sm font-bold text-accent">0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, i) => (
            <div 
              key={feature.text} 
              className="group flex items-center gap-4 p-5 rounded-2xl border border-border/50 bg-card/30 backdrop-blur-xl hover:border-accent/30 hover:bg-card/50 transition-all duration-500 hover-lift"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center text-accent group-hover:scale-110 transition-transform duration-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                </svg>
              </div>
              <span className="text-sm font-medium text-foreground">{feature.text}</span>
            </div>
          ))}
        </div>
      </Container>
      
      {/* Bottom Line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  )
}
