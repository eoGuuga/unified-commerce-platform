"use client"

import { Container } from "./Container"
import { useEffect, useState, useRef } from "react"

const features = [
  { text: "Sincroniza��o r�pida", icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" },
  { text: "Transa��es ACID", icon: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" },
  { text: "Webhooks flex�veis", icon: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" },
  { text: "Dashboard em tempo real", icon: "M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" },
]

const channels = [
  { name: "PDV", subtitle: "Point of Sale", color: "bg-blue-500" },
  { name: "E-commerce", subtitle: "Online Store", color: "bg-violet-500" },
  { name: "WhatsApp", subtitle: "Business API", color: "bg-emerald-500" },
]

// Evolving SyncPulse - Solution variant (calm/observing, slower animation)
function SyncPulse({ active, size = "sm" }: { active: boolean; size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "w-2 h-2" : "w-3 h-3"
  return (
    <div className="relative flex items-center justify-center">
      <div className={`${sizeClasses} rounded-full transition-all duration-1000 ${active ? "bg-accent" : "bg-muted-foreground/30"}`} />
      {active && (
        <div className={`absolute ${sizeClasses} rounded-full bg-accent animate-ping opacity-30`} style={{ animationDuration: "3s" }} />
      )}
    </div>
  )
}

function AnimatedOrb({ isActive }: { isActive: boolean }) {
  return (
    <div className="relative w-44 h-44 lg:w-52 lg:h-52">
      {/* Outer glow - responds to activity */}
      <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-1000 ${
        isActive ? "bg-accent/15" : "bg-accent/8"
      }`} />
      
      {/* Orbital rings - mechanical, deliberate motion */}
      <div className="absolute inset-0 rounded-full border border-accent/15" style={{ animation: 'spin 50s linear infinite' }} />
      <div className="absolute inset-5 rounded-full border border-accent/20" style={{ animation: 'spin 35s linear infinite reverse' }} />
      
      {/* Center hub */}
      <div className={`absolute inset-10 rounded-full border transition-all duration-700 flex items-center justify-center backdrop-blur-sm ${
        isActive ? "border-accent/40 bg-card/90" : "border-border/60 bg-card/80"
      }`}>
        <div className="text-center">
          <div className={`w-12 h-12 mx-auto rounded-lg flex items-center justify-center transition-colors duration-700 ${
            isActive ? "bg-accent text-background" : "bg-foreground text-background"
          }`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
            </svg>
          </div>
          <p className="mt-2 text-xs font-semibold text-foreground uppercase tracking-[0.06em]">UCM</p>
        </div>
      </div>
      
      {/* Data particles - subtle, not playful */}
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className={`absolute w-1.5 h-1.5 rounded-full transition-colors duration-700 ${isActive ? "bg-accent" : "bg-muted-foreground/50"}`}
          style={{
            top: '50%',
            left: '50%',
            animation: `orbit ${14 + i * 5}s linear infinite`,
            animationDelay: `${i * -4}s`,
          }}
        />
      ))}
    </div>
  )
}

export function Solution() {
  const [activeChannel, setActiveChannel] = useState(0)
  const [isInView, setIsInView] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting)
      },
      { threshold: 0.3 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isInView) return
    const interval = setInterval(() => {
      setActiveChannel((prev) => (prev + 1) % channels.length)
    }, 4000) // Slower, more deliberate
    return () => clearInterval(interval)
  }, [isInView])

  return (
    <section ref={sectionRef} id="solucao" className="section-padding relative">
      {/* Background */}
      <div className="absolute inset-0 mesh-gradient opacity-25" />
      <div className="absolute inset-0 grid-pattern-fade opacity-15" />
      
      <Container className="relative">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center section-header-gap">
          <div className="badge-base mb-6">
            <SyncPulse active={isInView} />
            <span>A Solu��o</span>
          </div>
          
          <h2 className="mb-5">
            <span className="text-foreground">Uma �nica fonte</span>
            <span className="block text-accent mt-1">da verdade.</span>
          </h2>
          
          <p className="body-text-lg mx-auto">
            Backend centralizado que garante consist�ncia absoluta do estoque. 
            Todas as vendas passam por um �nico ponto de controle at�mico.
          </p>
        </div>

        {/* Architecture Visualization */}
        <div className="relative max-w-4xl xl:max-w-5xl mx-auto mb-12 lg:mb-14 xl:mb-16">
          <div className="grid lg:grid-cols-[1fr,auto,1fr] items-center gap-8 lg:gap-12 xl:gap-16">
            {/* Left channels */}
            <div className="flex flex-col gap-4">
              {channels.slice(0, 2).map((channel, i) => (
                <div
                  key={channel.name}
                  className={`group relative p-5 rounded-xl border transition-all duration-700 cursor-pointer ${
                    activeChannel === i 
                      ? "border-accent/40 bg-accent/5" 
                      : "border-border/40 bg-card/20 hover:border-border/60"
                  }`}
                  onClick={() => setActiveChannel(i)}
                >
                  {/* Connection line */}
                  <div className="hidden lg:block absolute right-0 top-1/2 w-8 h-px overflow-hidden">
                    <div className="absolute inset-0 bg-border/40" />
                    <div 
                      className={`absolute inset-y-0 left-0 bg-accent transition-all duration-700`}
                      style={{ width: activeChannel === i ? '100%' : '0%' }}
                    />
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-lg ${channel.color} flex items-center justify-center transition-transform duration-500 ${activeChannel === i ? "scale-105" : ""}`}>
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-base font-medium text-foreground">{channel.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{channel.subtitle}</p>
                    </div>
                    <div className="ml-auto">
                      <SyncPulse active={activeChannel === i} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Center Hub */}
            <div className="flex justify-center order-first lg:order-none">
              <AnimatedOrb isActive={isInView} />
            </div>
            
            {/* Right channel + status */}
            <div className="flex flex-col gap-4">
              <div
                className={`group relative p-5 rounded-xl border transition-all duration-700 cursor-pointer ${
                  activeChannel === 2 
                    ? "border-accent/40 bg-accent/5" 
                    : "border-border/40 bg-card/20 hover:border-border/60"
                }`}
                onClick={() => setActiveChannel(2)}
              >
                {/* Connection line */}
                <div className="hidden lg:block absolute left-0 top-1/2 w-8 h-px overflow-hidden">
                  <div className="absolute inset-0 bg-border/40" />
                  <div 
                    className={`absolute inset-y-0 right-0 bg-accent transition-all duration-700`}
                    style={{ width: activeChannel === 2 ? '100%' : '0%' }}
                  />
                </div>
                
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-lg ${channels[2].color} flex items-center justify-center transition-transform duration-500 ${activeChannel === 2 ? "scale-105" : ""}`}>
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-medium text-foreground">{channels[2].name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{channels[2].subtitle}</p>
                  </div>
                  <div className="ml-auto">
                    <SyncPulse active={activeChannel === 2} />
                  </div>
                </div>
              </div>
              
              {/* Status panel */}
              <div className="p-5 rounded-xl border border-border/40 bg-card/20">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.06em]">Arquitetura</p>
                  <SyncPulse active={isInView} size="sm" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Uptime alvo</span>
                    <span className="text-sm font-medium text-accent font-mono">99.9%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Lat�ncia alvo</span>
                    <span className="text-sm font-medium text-foreground font-mono">{"<"}100ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Overselling</span>
                    <span className="text-sm font-medium text-accent font-mono">0 (meta)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 xl:gap-6">
          {features.map((feature) => (
            <div 
              key={feature.text} 
              className="flex items-center gap-4 p-5 card-base card-interactive"
            >
              <div className="flex-shrink-0 icon-box-sm bg-accent/8 text-accent">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                </svg>
              </div>
              <span className="text-sm font-medium text-foreground">{feature.text}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
