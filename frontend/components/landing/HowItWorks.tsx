"use client"

import { Container } from "./Container"
import { useRef, useEffect, useState } from "react"

const steps = [
  {
    step: "01",
    title: "Captura",
    description: "Pedido entra por qualquer canal e � capturado instantaneamente pelo backend central.",
    icon: "M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3",
    state: "incoming"
  },
  {
    step: "02",
    title: "Reserva",
    description: "Estoque � reservado atomicamente antes de qualquer confirma��o. Bloqueio imediato e seguro.",
    icon: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
    state: "locked"
  },
  {
    step: "03",
    title: "Confirma��o",
    description: "Transa��o validada com sucesso. Estoque atualizado em todos os canais simultaneamente.",
    icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    state: "confirmed"
  },
  {
    step: "04",
    title: "Sincroniza��o",
    description: "Todos os canais recebem a atualiza��o em milissegundos. Consist�ncia garantida.",
    icon: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99",
    state: "synced"
  },
]

// Signature sync pulse that appears throughout the site
function SyncPulse({ active, size = "sm" }: { active: boolean; size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "w-2 h-2" : "w-3 h-3"
  return (
    <div className="relative flex items-center justify-center">
      <div className={`${sizeClasses} rounded-full transition-all duration-700 ${active ? "bg-accent" : "bg-muted-foreground/30"}`} />
      {active && (
        <>
          <div className={`absolute ${sizeClasses} rounded-full bg-accent animate-ping opacity-40`} style={{ animationDuration: "1.5s" }} />
          <div className={`absolute w-4 h-4 rounded-full border border-accent/30 animate-ping opacity-20`} style={{ animationDuration: "2s" }} />
        </>
      )}
    </div>
  )
}

// Connection line between steps - simplified and smooth
function ConnectionLine({ isPast, isActive, progress }: { isPast: boolean; isActive: boolean; progress: number }) {
  // Clamp progress between 0-100
  const safeProgress = Math.max(0, Math.min(100, progress))
  
  return (
    <div className="hidden lg:block absolute top-[3.5rem] left-full w-6 xl:w-7 h-[2px] ml-0">
      {/* Background track */}
      <div className="absolute inset-0 bg-border/40 rounded-full" />
      
      {/* Fill bar - simple CSS transition for smoothness */}
      <div 
        className="absolute inset-y-0 left-0 bg-accent rounded-full"
        style={{ 
          width: isPast ? '100%' : isActive ? `${safeProgress}%` : '0%',
          transition: isPast ? 'width 0.4s ease-out' : 'none',
          boxShadow: (isActive || isPast) ? '0 0 6px 1px var(--accent)' : 'none'
        }}
      />
      
      {/* Moving dot for active state */}
      {isActive && safeProgress > 0 && safeProgress < 100 && (
        <div 
          className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-accent"
          style={{ 
            left: `${safeProgress}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 10px 3px var(--accent)'
          }}
        />
      )}
      
      {/* End dot for completed */}
      {isPast && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent" />
      )}
    </div>
  )
}

function StepCard({ step, index, activeStep, progress }: { step: typeof steps[0]; index: number; activeStep: number; progress: number }) {
  const isActive = index === activeStep
  const isPast = index < activeStep
  const isFuture = index > activeStep

  return (
    <div className="group relative">
      {/* Connection Line */}
      {index < steps.length - 1 && (
        <ConnectionLine isPast={isPast} isActive={isActive} progress={isActive ? progress : 0} />
      )}
      
      {/* Card */}
      <div 
        className={`relative p-5 rounded-xl border transition-all duration-300 ${
          isActive 
            ? "border-accent/40 bg-accent/8 -translate-y-1" 
            : isPast
              ? "border-accent/25 bg-card/40"
              : "border-border/40 bg-card/20 hover:border-border/60 hover:bg-card/30"
        }`}
      >
        {/* Icon */}
        <div className={`relative w-14 h-14 mb-5 rounded-xl border flex items-center justify-center transition-all duration-300 ${
          isActive 
            ? "border-accent/40 bg-accent/15"
            : isPast
              ? "border-accent/25 bg-accent/8"
              : "border-border/30 bg-secondary/15"
        }`}>
          <svg 
            className={`w-6 h-6 transition-colors duration-300 ${isActive || isPast ? "text-accent" : "text-muted-foreground"}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth="1.5" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
          </svg>
          
          {/* Processing indicator */}
          {isActive && (
            <div className="absolute -top-1.5 -right-1.5">
              <SyncPulse active={true} size="sm" />
            </div>
          )}
          
          {/* Checkmark for completed */}
          {isPast && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
              <svg className="w-3 h-3 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        
        {/* Step number with state badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs font-mono transition-colors duration-500 ${isActive ? "text-accent" : isPast ? "text-accent/70" : "text-muted-foreground/60"}`}>
            Passo {step.step}
          </span>
          {isPast && (
            <span className="badge-accent text-[10px]">
              Conclu�do
            </span>
          )}
          {isActive && (
            <span className="badge-accent text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Processando
            </span>
          )}
        </div>
        
        {/* Content */}
        <h3 className="card-title-sm mb-2">
          {step.title}
        </h3>
        <p className={`text-sm leading-relaxed transition-colors duration-300 ${isFuture ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
          {step.description}
        </p>
      </div>
    </div>
  )
}

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const [isInView, setIsInView] = useState(false)
  const STEP_DURATION = 4000 // 4 seconds per step

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

  // Progress animation
  useEffect(() => {
    if (!isInView) return
    
    setProgress(0)
    const startTime = Date.now()
    
    const animationFrame = () => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.min((elapsed / STEP_DURATION) * 100, 100)
      setProgress(newProgress)
      
      if (newProgress < 100) {
        requestAnimationFrame(animationFrame)
      }
    }
    
    const frameId = requestAnimationFrame(animationFrame)
    
    return () => cancelAnimationFrame(frameId)
  }, [isInView, activeStep])

  // Step change
  useEffect(() => {
    if (!isInView) return
    
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length)
    }, STEP_DURATION)
    
    return () => clearInterval(interval)
  }, [isInView])

  return (
    <section ref={sectionRef} id="como-funciona" className="section-padding relative">
      {/* Background */}
      <div className="absolute inset-0 gradient-radial opacity-15" />
      
      <Container className="relative">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center section-header-gap">
          <div className="badge-base mb-6">
            <SyncPulse active={isInView} size="sm" />
            <span>Processo</span>
          </div>
          
          <h2 className="mb-5">
            <span className="text-foreground">Como funciona</span>
          </h2>
          
          <p className="body-text-lg mx-auto">
            Do pedido � entrega em quatro etapas automatizadas. Sem interven��o manual, sem erros humanos.
          </p>
        </div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 xl:gap-7">
          {steps.map((step, index) => (
            <StepCard key={step.step} step={step} index={index} activeStep={activeStep} progress={progress} />
          ))}
        </div>
        
        {/* Progress indicators - more minimal, system-like */}
        <div className="flex justify-center gap-3 mt-10 lg:mt-12 xl:mt-14">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveStep(index)}
              className={`relative w-10 h-1 rounded-full transition-all duration-700 overflow-hidden ${
                index <= activeStep ? "bg-accent/30" : "bg-border/40"
              }`}
              aria-label={`Go to step ${index + 1}`}
            >
              <div 
                className={`absolute inset-y-0 left-0 bg-accent transition-all duration-700 rounded-full`}
                style={{ 
                  width: index < activeStep ? '100%' : index === activeStep ? '100%' : '0%'
                }}
              />
            </button>
          ))}
        </div>
        
        {/* System status footer */}
        <div className="mt-10 lg:mt-12 text-center">
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Sistema operacional | Ciclo {activeStep + 1}/{steps.length}
          </span>
        </div>
      </Container>
      
    </section>
  )
}
