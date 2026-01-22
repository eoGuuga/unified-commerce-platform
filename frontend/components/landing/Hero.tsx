"use client"

import { Container } from "./Container"
import Link from "next/link"
import { useEffect, useState, useRef } from "react"

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          let start = 0
          const duration = 2000
          const increment = value / (duration / 16)
          const timer = setInterval(() => {
            start += increment
            if (start >= value) {
              setCount(value)
              clearInterval(timer)
            } else {
              setCount(Math.floor(start))
            }
          }, 16)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, hasAnimated])

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

// Evolving SyncPulse - Hero variant (active/prominent)
function SyncPulse() {
  return (
    <span className="relative inline-flex">
      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
      <span className="absolute w-1.5 h-1.5 rounded-full bg-accent animate-ping opacity-50" style={{ animationDuration: "1.5s" }} />
    </span>
  )
}

// Conflict Resolution Visualization
// Shows two events entering simultaneously, creating tension, then resolving
function ConflictResolutionDemo() {
  const [phase, setPhase] = useState<"idle" | "dual-entry" | "tension" | "locked" | "resolving" | "resolved">("idle")
  const [cycleCount, setCycleCount] = useState(0)

  useEffect(() => {
    const runCycle = () => {
      // Phase 1: Two events enter simultaneously
      setTimeout(() => setPhase("dual-entry"), 0)
      
      // Phase 2: Tension - system detects conflict
      setTimeout(() => setPhase("tension"), 1500)
      
      // Phase 3: Lock acquired
      setTimeout(() => setPhase("locked"), 3000)
      
      // Phase 4: Resolving
      setTimeout(() => setPhase("resolving"), 4200)
      
      // Phase 5: Resolved
      setTimeout(() => setPhase("resolved"), 5400)
      
      // Reset
      setTimeout(() => {
        setPhase("idle")
        setCycleCount(c => c + 1)
      }, 8000)
    }

    // Initial delay before first cycle
    const initialDelay = setTimeout(runCycle, 4000)
    
    // Subsequent cycles
    const interval = setInterval(runCycle, 12000)

    return () => {
      clearTimeout(initialDelay)
      clearInterval(interval)
    }
  }, [])

  const getPhaseConfig = () => {
    switch (phase) {
      case "dual-entry":
        return {
          status: "Eventos simultaneos detectados",
          statusColor: "text-amber-400",
          bgPulse: "bg-amber-500/5",
          events: [
            { channel: "PDV Centro", action: "Venda SKU-7821", qty: "-1 un", state: "incoming" },
            { channel: "Shopify", action: "Venda SKU-7821", qty: "-1 un", state: "incoming" },
          ]
        }
      case "tension":
        return {
          status: "Conflito de estoque",
          statusColor: "text-orange-400",
          bgPulse: "bg-orange-500/8",
          events: [
            { channel: "PDV Centro", action: "Aguardando lock", qty: "-1 un", state: "waiting" },
            { channel: "Shopify", action: "Aguardando lock", qty: "-1 un", state: "waiting" },
          ]
        }
      case "locked":
        return {
          status: "Lock adquirido",
          statusColor: "text-blue-400",
          bgPulse: "bg-blue-500/5",
          events: [
            { channel: "PDV Centro", action: "Processando", qty: "-1 un", state: "processing" },
            { channel: "Shopify", action: "Em fila", qty: "-1 un", state: "queued" },
          ]
        }
      case "resolving":
        return {
          status: "Resolvendo sequencialmente",
          statusColor: "text-accent-secondary",
          bgPulse: "bg-accent-secondary/5",
          events: [
            { channel: "PDV Centro", action: "Confirmado", qty: "-1 un", state: "confirmed" },
            { channel: "Shopify", action: "Processando", qty: "-1 un", state: "processing" },
          ]
        }
      case "resolved":
        return {
          status: "Sincronizado",
          statusColor: "text-accent",
          bgPulse: "bg-accent/5",
          events: [
            { channel: "PDV Centro", action: "Conclu�do", qty: "-1 un", state: "done" },
            { channel: "Shopify", action: "Conclu�do", qty: "-1 un", state: "done" },
          ]
        }
      default:
        return {
          status: "Sistema operacional",
          statusColor: "text-accent",
          bgPulse: "bg-transparent",
          events: [
            { channel: "PDV Centro", action: "Venda confirmada", qty: "-3 un", state: "done" },
            { channel: "Shopify", action: "Reserva criada", qty: "-1 un", state: "done" },
          ]
        }
    }
  }

  const config = getPhaseConfig()

  return (
    <div className={`p-5 rounded-lg border border-border/30 transition-all duration-700 ${config.bgPulse}`}>
      {/* Header with status */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Atividade Recente</h3>
        <div className={`flex items-center gap-2 text-xs font-medium transition-colors duration-500 ${config.statusColor}`}>
          {phase === "tension" || phase === "locked" || phase === "resolving" ? (
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          ) : phase === "resolved" ? (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <SyncPulse />
          )}
          {config.status}
        </div>
      </div>

      {/* Events visualization */}
      <div className="space-y-3">
        {config.events.map((event, i) => (
          <div 
            key={`${cycleCount}-${i}`}
            className={`flex items-center gap-3 text-sm transition-all duration-500 ${
              event.state === "incoming" ? "animate-[slideInLeft_0.4s_ease-out]" :
              event.state === "waiting" ? "opacity-90" :
              event.state === "queued" ? "opacity-60" : ""
            }`}
            style={{ 
              animationDelay: event.state === "incoming" ? `${i * 150}ms` : "0ms"
            }}
          >
            <div className={`relative w-2 h-2 rounded-full flex-shrink-0 transition-all duration-500 ${
              event.state === "incoming" ? "bg-amber-400" :
              event.state === "waiting" ? "bg-orange-400 animate-pulse" :
              event.state === "queued" ? "bg-muted-foreground/50" :
              event.state === "processing" ? "bg-blue-400 animate-pulse" :
              event.state === "confirmed" ? "bg-accent" :
              "bg-accent"
            }`}>
              {/* Ripple effect during tension */}
              {(event.state === "waiting" || event.state === "incoming") && (
                <span className="absolute inset-0 rounded-full bg-current animate-ping opacity-40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`transition-colors duration-300 ${
                event.state === "queued" ? "text-muted-foreground" : "text-foreground/80"
              }`}>
                {event.action}
              </span>
              <span className="text-muted-foreground"> - {event.channel}</span>
            </div>
            <span className="text-xs font-mono text-muted-foreground">{event.qty}</span>
          </div>
        ))}
      </div>

      {/* Progress indicator during conflict resolution */}
      {(phase === "tension" || phase === "locked" || phase === "resolving") && (
        <div className="mt-5 pt-4 border-t border-border/20">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 rounded-full bg-muted/30 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  phase === "tension" ? "w-1/4 bg-orange-400" :
                  phase === "locked" ? "w-1/2 bg-blue-400" :
                  "w-3/4 bg-accent"
                }`}
              />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {phase === "tension" ? "Detectando" :
               phase === "locked" ? "Processando" :
               "Finalizando"}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-28 pb-24 md:pt-32 md:pb-28 lg:pt-36 lg:pb-32 xl:pt-40 xl:pb-36 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 mesh-gradient opacity-40" />
      <div className="absolute inset-0 grid-pattern-fade opacity-30" />
      
      {/* Subtle glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px]">
        <div className="absolute inset-0 bg-accent/6 blur-[140px] rounded-full" />
      </div>
      
      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      
      <Container className="relative z-10">
        <div className="max-w-5xl xl:max-w-6xl mx-auto">
          {/* Trust Badge */}
          <div className="animate-slide-up opacity-0 stagger-1 flex justify-center lg:justify-start mb-10">
            <div className="inline-flex items-center gap-3 px-1.5 pr-5 py-1.5 rounded-full glass glass-border">
              <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium uppercase tracking-[0.06em]">
                Novo
              </span>
              <span className="text-sm text-muted-foreground">
                Integra��o nativa com WhatsApp Business API
              </span>
            </div>
          </div>

          {/* Main Headline */}
          <div className="text-center lg:text-left mb-8">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl 2xl:text-9xl font-semibold tracking-tight leading-none">
              <span className="animate-slide-up opacity-0 stagger-2 block text-foreground">
                Zero overselling.
              </span>
              <span className="animate-slide-up opacity-0 stagger-3 block mt-2 text-muted-foreground">
                Controle total.
              </span>
            </h1>
          </div>

          {/* Subheadline */}
          <p className="animate-slide-up opacity-0 stagger-4 text-lg xl:text-xl text-muted-foreground max-w-xl xl:max-w-2xl mx-auto lg:mx-0 mb-10 lg:mb-12 leading-[1.6] text-center lg:text-left text-balance">
            Backend centralizado que sincroniza estoque em tempo real entre PDV, e-commerce e WhatsApp. 
            <span className="text-foreground/70"> Arquitetura projetada para atualizar todos os canais em milissegundos.</span>
          </p>

          {/* CTA Buttons */}
          <div className="animate-slide-up opacity-0 stagger-5 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-12 lg:mb-14">
            <Link
              href="#"
              className="group btn-primary h-12 px-7 text-base"
            >
              <span>Ver demo ao vivo</span>
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            
            <Link
              href="#"
              className="btn-ghost h-12 px-7 text-base"
            >
              <span>Come�ar teste gratuito</span>
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="animate-slide-up opacity-0 stagger-6 flex flex-wrap items-center justify-center lg:justify-start gap-6 lg:gap-8 mb-16 lg:mb-20 text-sm text-muted-foreground">
            {[
              "Setup em 5 minutos",
              "Sem cart�o de cr�dito",
              "14 dias gr�tis"
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* Product Preview */}
          <div className="relative animate-slide-up opacity-0" style={{ animationDelay: '0.5s' }}>
            {/* Subtle glow behind card */}
            <div className="absolute -inset-4 rounded-2xl bg-accent/3 blur-3xl opacity-50" />
            
            {/* Main Card */}
            <div className="relative border border-border/40 rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm">
              {/* Browser Chrome */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/30 bg-secondary/15">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/15" />
                  <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/15" />
                  <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/15" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="flex items-center gap-2 px-3 py-1 rounded bg-background/30 text-xs text-muted-foreground">
                    <svg className="w-3 h-3 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>app.ucm.com.br/dashboard</span>
                  </div>
                </div>
              </div>
              
              {/* Dashboard Content */}
              <div className="p-5 lg:p-6 xl:p-8">
                {/* Top Stats Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: "SKUs Ativos", value: 847, suffix: "", change: "demo" },
                    { label: "Pedidos/Hora", value: 59, suffix: "", change: "demo" },
                    { label: "Sync Time", value: 92, suffix: "ms", change: "alvo" },
                    { label: "Overselling", value: 0, suffix: "", change: "meta", accent: true },
                  ].map((stat) => (
                    <div key={stat.label} className="p-4 rounded-lg bg-secondary/20 border border-border/20">
                      <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-[0.06em]">{stat.label}</p>
                      <p className={`text-xl lg:text-2xl font-semibold tracking-tight ${stat.accent ? 'text-accent' : 'text-foreground'}`}>
                        <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                        <span className="text-[10px] text-muted-foreground font-medium">{stat.change}</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Main Grid */}
                <div className="grid lg:grid-cols-3 gap-3">
                  {/* Left: Channels */}
                  <div className="lg:col-span-2 space-y-2.5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.06em]">Canais Conectados</h3>
                      <span className="flex items-center gap-2 text-[10px] text-accent font-medium">
                        <SyncPulse />
                        Sincronizado
                      </span>
                    </div>
                    
                    {[
                      { name: "PDV Loja F�sica", orders: "127", status: "Sync: agora", color: "bg-blue-500" },
                      { name: "E-commerce Shopify", orders: "89", status: "Sync: 1s", color: "bg-emerald-500" },
                      { name: "WhatsApp Business", orders: "43", status: "Sync: 2s", color: "bg-green-500" },
                    ].map((channel) => (
                      <div key={channel.name} className="flex items-center gap-3 p-3.5 rounded-lg bg-secondary/15 border border-border/20">
                        <div className={`w-9 h-9 rounded-lg ${channel.color} flex items-center justify-center`}>
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{channel.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{channel.status}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-semibold text-foreground">{channel.orders}</p>
                          <p className="text-[10px] text-muted-foreground">pedidos/h</p>
                        </div>
                        <SyncPulse />
                      </div>
                    ))}
                  </div>
                  
                  {/* Right: Conflict Resolution Demo */}
                  <ConflictResolutionDemo />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
      
    </section>
  )
}
