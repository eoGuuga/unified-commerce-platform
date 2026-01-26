"use client"

import { Container } from "./Container"
import { useEffect, useState, useRef } from "react"

type EventState = "idle" | "incoming" | "processing" | "locked" | "resolved" | "synced"

interface SystemEvent {
  id: number
  channel: "pdv" | "ecommerce" | "whatsapp"
  state: EventState
  product: string
  quantity: number
}

const CHANNELS = {
  pdv: { name: "PDV", color: "bg-blue-500" },
  ecommerce: { name: "E-commerce", color: "bg-violet-500" },
  whatsapp: { name: "WhatsApp", color: "bg-emerald-500" },
}

// Evolving SyncPulse - SystemFlow variant (monitoring/observing)
function SyncPulse({ active, variant = "default" }: { active: boolean; variant?: "default" | "locked" | "resolved" }) {
  const pulseStyles = {
    default: "bg-accent",
    locked: "bg-amber-400",
    resolved: "bg-accent",
  }
  
  return (
    <div className="relative flex items-center justify-center">
      <div className={`w-3 h-3 rounded-full transition-all duration-700 ${active ? pulseStyles[variant] : "bg-muted-foreground/30"}`} />
      {active && variant === "locked" && (
        <div className="absolute w-3 h-3 rounded-full border-2 border-amber-400 animate-ping opacity-60" style={{ animationDuration: "0.8s" }} />
      )}
      {active && variant !== "locked" && (
        <>
          <div className="absolute w-3 h-3 rounded-full bg-accent animate-ping opacity-40" style={{ animationDuration: "2s" }} />
          <div className="absolute w-6 h-6 rounded-full border border-accent/20 animate-ping opacity-20" style={{ animationDuration: "2.5s" }} />
        </>
      )}
    </div>
  )
}

function StateBadge({ state }: { state: EventState }) {
  const stateConfig: Record<EventState, { label: string; className: string }> = {
    idle: { label: "Aguardando", className: "bg-muted/50 text-muted-foreground" },
    incoming: { label: "Recebendo", className: "bg-blue-500/15 text-blue-400" },
    processing: { label: "Processando", className: "bg-amber-500/15 text-amber-400" },
    locked: { label: "Reservado", className: "bg-orange-500/15 text-orange-400" },
    resolved: { label: "Confirmado", className: "bg-accent/15 text-accent" },
    synced: { label: "Sincronizado", className: "bg-accent/20 text-accent" },
  }

  const config = stateConfig[state]

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium uppercase tracking-wider transition-all duration-500 ${config.className}`}>
      {state === "locked" && (
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      )}
      {(state === "processing") && (
        <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
      )}
      {state === "synced" && (
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {config.label}
    </span>
  )
}

function DataLine({ active, direction, state }: { active: boolean; direction: "left" | "right"; state?: string }) {
  const isLocked = state === "locked"
  const lineColor = isLocked ? "bg-amber-400" : "bg-accent"
  const glowColor = isLocked ? "shadow-amber-400/60" : "shadow-accent/60"
  
  return (
    <div className="relative h-[3px] w-full overflow-hidden rounded-full">
      {/* Background track */}
      <div className="absolute inset-0 bg-border/20 rounded-full" />
      
      {/* Animated gradient fill */}
      <div 
        className={`absolute inset-y-0 rounded-full transition-all duration-700 ease-out ${
          direction === "left" ? "left-0" : "right-0"
        } ${isLocked ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-gradient-to-r from-accent to-accent/80"}`}
        style={{ 
          width: active ? "100%" : "0%",
          transitionDelay: active ? "0ms" : "200ms",
          boxShadow: active ? `0 0 12px 2px ${isLocked ? 'oklch(0.75 0.12 85 / 0.5)' : 'var(--accent)'}` : 'none'
        }}
      />
      
      {/* Multiple animated particles for active state */}
      {active && (
        <>
          {/* Main particle */}
          <div 
            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${lineColor} ${glowColor} shadow-[0_0_16px_4px]`}
            style={{
              animation: direction === "left" 
                ? 'dataFlowEnhanced 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards' 
                : 'dataFlowReverseEnhanced 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards'
            }}
          >
            <div className="absolute inset-0.5 rounded-full bg-white/90" />
          </div>
          
          {/* Trail particles */}
          <div 
            className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${lineColor} opacity-60`}
            style={{
              animation: direction === "left" 
                ? 'dataFlowEnhanced 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards' 
                : 'dataFlowReverseEnhanced 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
              animationDelay: '0.15s'
            }}
          />
          <div 
            className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${lineColor} opacity-40`}
            style={{
              animation: direction === "left" 
                ? 'dataFlowEnhanced 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards' 
                : 'dataFlowReverseEnhanced 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
              animationDelay: '0.3s'
            }}
          />
        </>
      )}
    </div>
  )
}

function ChannelNode({ channel, event, isSource }: { channel: keyof typeof CHANNELS; event?: SystemEvent; isSource: boolean }) {
  const config = CHANNELS[channel]
  const hasActivity = event && event.channel === channel && event.state !== "idle"
  
  return (
    <div className={`relative p-5 rounded-xl border transition-all duration-500 ${
      hasActivity ? "border-accent/30 bg-accent/5" : "border-border/40 bg-card/30"
    }`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-lg ${config.color} flex items-center justify-center transition-transform duration-500 ${hasActivity ? "scale-105" : ""}`}>
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{config.name}</p>
          <p className="text-xs text-muted-foreground">{isSource ? "Origem" : "Destino"}</p>
        </div>
      </div>
      
      {event && isSource && event.channel === channel && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Evento</span>
            <span className="font-mono text-foreground/70">#{event.id.toString().padStart(4, "0")}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Produto</span>
            <span className="text-foreground/70">{event.product}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Qtd</span>
            <span className="text-foreground/70">-{event.quantity}</span>
          </div>
        </div>
      )}
      
      {!isSource && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Status</span>
          {event && ["resolved", "synced"].includes(event.state) ? (
            <StateBadge state="synced" />
          ) : (
            <StateBadge state="idle" />
          )}
        </div>
      )}
    </div>
  )
}

function CentralHub({ event }: { event?: SystemEvent }) {
  const isProcessing = event && ["incoming", "processing"].includes(event.state)
  const isLocked = event && event.state === "locked"
  const isResolved = event && ["resolved", "synced"].includes(event.state)
  
  return (
    <div className="relative">
      {/* Outer glow - changes based on state */}
      <div className={`absolute -inset-4 rounded-full transition-all duration-700 ${
        isLocked ? "bg-amber-500/10 blur-2xl" :
        isProcessing ? "bg-accent/10 blur-2xl" : 
        isResolved ? "bg-accent/8 blur-xl" : 
        "bg-transparent"
      }`} />
      
      {/* Hub container with lock feedback */}
      <div 
        className={`relative w-40 h-40 rounded-full border-2 transition-all duration-500 ${
          isLocked ? "border-amber-400/60 bg-card/90" :
          isProcessing ? "border-accent/50 bg-card/80" : 
          "border-border/50 bg-card/60"
        }`}
        style={{
          animation: isLocked ? "lock-pulse 1s ease-in-out" : "none"
        }}
      >
        {/* Inner ring */}
        <div className="absolute inset-3 rounded-full border border-border/40 flex items-center justify-center">
          {/* Core */}
          <div className={`w-20 h-20 rounded-full border flex flex-col items-center justify-center transition-all duration-500 ${
            isLocked ? "bg-amber-500/10 border-amber-500/30" :
            isProcessing ? "bg-secondary/70 border-border/50" : 
            "bg-secondary/50 border-border/40"
          }`}>
            {isLocked ? (
              <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            ) : (
              <svg className={`w-6 h-6 transition-colors duration-500 ${isProcessing || isResolved ? "text-accent" : "text-muted-foreground"}`} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
              </svg>
            )}
            <span className={`text-[10px] font-semibold mt-1 uppercase tracking-[0.06em] transition-colors duration-500 ${
              isLocked ? "text-amber-400" : "text-foreground"
            }`}>
              {isLocked ? "LOCK" : "GTSoftHub"}
            </span>
          </div>
        </div>
        
        {/* State badge */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
          {event && <StateBadge state={event.state} />}
        </div>
      </div>
    </div>
  )
}

export function SystemFlow() {
  const [currentEvent, setCurrentEvent] = useState<SystemEvent | null>(null)
  const [cycleCount, setCycleCount] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const [isInView, setIsInView] = useState(false)

  // Event scenarios
  const scenarios: Omit<SystemEvent, "state">[] = [
    { id: 1042, channel: "pdv", product: "SKU-7821", quantity: 2 },
    { id: 1043, channel: "ecommerce", product: "SKU-3349", quantity: 1 },
    { id: 1044, channel: "whatsapp", product: "SKU-9912", quantity: 3 },
  ]

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

    const scenario = scenarios[cycleCount % scenarios.length]
    // Deliberate, mechanical timing
    const states: EventState[] = ["incoming", "processing", "locked", "resolved", "synced", "idle"]
    const timings = [0, 1400, 2800, 4400, 5800, 8500]
    
    const timeouts: NodeJS.Timeout[] = []
    
    states.forEach((state, i) => {
      const timeout = setTimeout(() => {
        if (state === "idle") {
          setCurrentEvent(null)
          setCycleCount(c => c + 1)
        } else {
          setCurrentEvent({ ...scenario, state })
        }
      }, timings[i])
      timeouts.push(timeout)
    })

    return () => timeouts.forEach(clearTimeout)
  }, [isInView, cycleCount])

  const showLeftLine = currentEvent && ["incoming", "processing", "locked", "resolved", "synced"].includes(currentEvent.state) && currentEvent.channel === "pdv"
  const showRightLine = currentEvent && ["resolved", "synced"].includes(currentEvent.state)
  const showTopLine = currentEvent && ["incoming", "processing", "locked", "resolved", "synced"].includes(currentEvent.state) && currentEvent.channel === "ecommerce"
  const showBottomLine = currentEvent && ["incoming", "processing", "locked", "resolved", "synced"].includes(currentEvent.state) && currentEvent.channel === "whatsapp"

  const pulseVariant = currentEvent?.state === "locked" ? "locked" : currentEvent?.state === "synced" ? "resolved" : "default"

  return (
    <section ref={sectionRef} className="section-padding relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-radial opacity-20" />
      
      <Container className="relative">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center section-header-gap">
          <div className="badge-base mb-6">
            <SyncPulse active={!!currentEvent && currentEvent.state !== "idle"} variant={pulseVariant} />
            <span>
              {currentEvent?.state === "locked" ? "Lock Ativo" : "Sistema em Operação"}
            </span>
          </div>
          
          <h2 className="mb-5">
            <span className="text-foreground">Fluxo de dados</span>
            <span className="block text-accent mt-1">em tempo real.</span>
          </h2>
          
          <p className="body-text-lg mx-auto">
            Observe como cada evento é processado atomicamente. Reserva, confirmação e sincronização em milissegundos.
          </p>
        </div>

        {/* System Visualization */}
        <div className="relative max-w-5xl xl:max-w-6xl mx-auto">
          {/* Desktop Layout */}
          <div className="hidden lg:grid grid-cols-[1fr,auto,1fr] items-center gap-6 xl:gap-8">
            {/* Left Column - PDV */}
            <div className="flex items-center gap-4">
              <ChannelNode channel="pdv" event={currentEvent || undefined} isSource={currentEvent?.channel === "pdv"} />
              <DataLine active={!!showLeftLine} direction="left" state={currentEvent?.state} />
            </div>
            
            {/* Center - Hub */}
            <div className="flex flex-col items-center gap-6">
              {/* Top channel */}
              <div className="flex flex-col items-center gap-4">
                <ChannelNode channel="ecommerce" event={currentEvent || undefined} isSource={currentEvent?.channel === "ecommerce"} />
                <div className="h-16 w-[3px] relative overflow-hidden rounded-full">
                  <div className="absolute inset-0 bg-border/20 rounded-full" />
                  <div 
                    className={`absolute inset-x-0 top-0 rounded-full transition-all duration-700 ease-out ${
                      currentEvent?.state === "locked" ? "bg-gradient-to-b from-amber-400 to-amber-500" : "bg-gradient-to-b from-accent to-accent/80"
                    }`}
                    style={{ 
                      height: showTopLine ? "100%" : "0%",
                      boxShadow: showTopLine ? `0 0 12px 2px ${currentEvent?.state === "locked" ? 'oklch(0.75 0.12 85 / 0.5)' : 'var(--accent)'}` : 'none'
                    }}
                  />
                  {showTopLine && (
                    <div 
                      className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${currentEvent?.state === "locked" ? "bg-amber-400" : "bg-accent"}`}
                      style={{
                        animation: 'verticalDataFlow 1s ease-out forwards',
                        boxShadow: `0 0 8px 2px ${currentEvent?.state === "locked" ? 'oklch(0.75 0.12 85 / 0.6)' : 'var(--accent)'}`
                      }}
                    />
                  )}
                </div>
              </div>
              
              <CentralHub event={currentEvent || undefined} />
              
              {/* Bottom channel */}
              <div className="flex flex-col items-center gap-4">
                <div className="h-16 w-[3px] relative overflow-hidden rounded-full">
                  <div className="absolute inset-0 bg-border/20 rounded-full" />
                  <div 
                    className={`absolute inset-x-0 bottom-0 rounded-full transition-all duration-700 ease-out ${
                      currentEvent?.state === "locked" ? "bg-gradient-to-t from-amber-400 to-amber-500" : "bg-gradient-to-t from-accent to-accent/80"
                    }`}
                    style={{ 
                      height: showBottomLine ? "100%" : "0%",
                      boxShadow: showBottomLine ? `0 0 12px 2px ${currentEvent?.state === "locked" ? 'oklch(0.75 0.12 85 / 0.5)' : 'var(--accent)'}` : 'none'
                    }}
                  />
                  {showBottomLine && (
                    <div 
                      className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${currentEvent?.state === "locked" ? "bg-amber-400" : "bg-accent"}`}
                      style={{
                        animation: 'verticalDataFlowUp 1s ease-out forwards',
                        boxShadow: `0 0 8px 2px ${currentEvent?.state === "locked" ? 'oklch(0.75 0.12 85 / 0.6)' : 'var(--accent)'}`
                      }}
                    />
                  )}
                </div>
                <ChannelNode channel="whatsapp" event={currentEvent || undefined} isSource={currentEvent?.channel === "whatsapp"} />
              </div>
            </div>
            
            {/* Right Column - Sync Status */}
            <div className="flex items-center gap-4">
              <DataLine active={!!showRightLine} direction="right" state={currentEvent?.state} />
              <div className="p-6 rounded-xl border border-border/40 bg-card/30 w-full">
                <div className="flex items-center gap-2 mb-5">
                  <SyncPulse active={currentEvent?.state === "synced"} variant="resolved" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-[0.06em]">Broadcast</span>
                </div>
                <div className="space-y-3">
                  {(["pdv", "ecommerce", "whatsapp"] as const).map((ch) => (
                    <div key={ch} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{CHANNELS[ch].name}</span>
                      {currentEvent?.state === "synced" ? (
                        <span className="text-xs text-accent font-medium">Atualizado</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">Aguardando</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="lg:hidden space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {(["pdv", "ecommerce", "whatsapp"] as const).map((ch) => (
                <div 
                  key={ch}
                  className={`p-4 rounded-xl border text-center transition-all duration-500 ${
                    currentEvent?.channel === ch ? "border-accent/30 bg-accent/5" : "border-border/40 bg-card/30"
                  }`}
                >
                  <div className={`w-8 h-8 mx-auto rounded-lg ${CHANNELS[ch].color} flex items-center justify-center mb-2`}>
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                    </svg>
                  </div>
                  <p className="text-xs font-medium text-foreground">{CHANNELS[ch].name}</p>
                </div>
              ))}
            </div>
            
            <div className="flex justify-center">
              <CentralHub event={currentEvent || undefined} />
            </div>
            
            {currentEvent && (
              <div className="p-4 rounded-xl border border-border/40 bg-card/30 text-center">
                <StateBadge state={currentEvent.state} />
                <p className="text-sm text-muted-foreground mt-3">
                  Evento #{currentEvent.id} via {CHANNELS[currentEvent.channel].name}
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Event Log */}
        <div className="mt-10 lg:mt-12 xl:mt-14 max-w-2xl xl:max-w-3xl mx-auto">
          <div className="p-5 rounded-xl border border-border/40 bg-card/20 font-mono text-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
              <span className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                currentEvent?.state === "locked" ? "bg-amber-400" : "bg-accent"
              } animate-pulse`} />
              <span className="text-muted-foreground uppercase tracking-[0.06em]">Event Log</span>
            </div>
            <div className="space-y-2 text-muted-foreground">
              {currentEvent ? (
                <>
                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground/50">{new Date().toLocaleTimeString()}</span>
                    <span>
                      <span className={`${
                        currentEvent.state === "locked" ? "text-amber-400" : "text-accent"
                      }`}>[{currentEvent.state.toUpperCase()}]</span>{" "}
                      Event #{currentEvent.id} | Channel: {CHANNELS[currentEvent.channel].name} | 
                      SKU: {currentEvent.product} | Qty: -{currentEvent.quantity}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground/50">Aguardando próximo evento...</div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}




