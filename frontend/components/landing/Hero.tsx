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

export function Hero() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      })
    }
    window.addEventListener("mousemove", handleMouse)
    return () => window.removeEventListener("mousemove", handleMouse)
  }, [])

  return (
    <section className="relative min-h-[100dvh] flex items-center pt-32 pb-20 overflow-hidden">
      {/* Layered Background System */}
      <div className="absolute inset-0 bg-background" />
      
      {/* Animated Mesh Gradient */}
      <div className="absolute inset-0 mesh-gradient opacity-60" />
      
      {/* Grid with Radial Fade */}
      <div className="absolute inset-0 grid-pattern-fade opacity-60" />
      
      {/* Floating Orbs with Mouse Parallax */}
      <div 
        className="absolute top-1/4 left-1/2 w-[1000px] h-[600px] -translate-x-1/2 -translate-y-1/2 transition-transform duration-1000 ease-out"
        style={{ transform: `translate(calc(-50% + ${mousePos.x}px), calc(-50% + ${mousePos.y}px))` }}
      >
        <div className="absolute inset-0 animate-pulse-glow" style={{ background: 'radial-gradient(ellipse 100% 100% at 50% 50%, oklch(0.72 0.19 160 / 0.12) 0%, transparent 60%)' }} />
      </div>
      
      <div 
        className="absolute top-1/3 right-[10%] w-[600px] h-[600px] transition-transform duration-1000 ease-out"
        style={{ transform: `translate(${mousePos.x * -0.5}px, ${mousePos.y * -0.5}px)` }}
      >
        <div className="absolute inset-0 animate-float-slow" style={{ background: 'radial-gradient(ellipse at center, oklch(0.65 0.22 280 / 0.08) 0%, transparent 60%)' }} />
      </div>
      
      <div 
        className="absolute bottom-[20%] left-[5%] w-[500px] h-[500px] transition-transform duration-1000 ease-out"
        style={{ transform: `translate(${mousePos.x * 0.3}px, ${mousePos.y * 0.3}px)` }}
      >
        <div className="absolute inset-0 animate-float-delayed" style={{ background: 'radial-gradient(ellipse at center, oklch(0.70 0.18 200 / 0.06) 0%, transparent 60%)' }} />
      </div>

      {/* Conic Gradient Overlay */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[1200px] gradient-conic opacity-30 animate-spin-slow" />
      
      {/* Top/Bottom Vignette */}
      <div className="absolute inset-x-0 top-0 h-60 bg-gradient-to-b from-background via-background/80 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-background via-background/50 to-transparent pointer-events-none" />
      
      {/* Noise Overlay */}
      <div className="absolute inset-0 noise pointer-events-none" />
      
      <Container className="relative z-10">
        <div className="max-w-6xl mx-auto text-center">
          {/* Announcement Badge */}
          <div className="animate-slide-up opacity-0 stagger-1">
            <Link 
              href="#" 
              className="group inline-flex items-center gap-4 px-1.5 pr-6 py-1.5 rounded-full glass glass-border border-glow hover:scale-[1.02] transition-all duration-500"
            >
              <span className="relative px-4 py-1.5 rounded-full bg-gradient-to-r from-accent to-accent/80 text-accent-foreground text-xs font-bold uppercase tracking-wider overflow-hidden">
                <span className="relative z-10">Novo</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 -translate-x-full animate-[shine_2s_ease-in-out_infinite]" />
              </span>
              <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors duration-300">
                Integracao nativa com WhatsApp Business API
              </span>
              <svg className="w-4 h-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          {/* Main Headline */}
          <div className="mt-12 mb-8">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] xl:text-[6.5rem] font-bold tracking-[-0.03em] leading-[0.9]">
              <span className="animate-slide-up opacity-0 stagger-2 block text-gradient-radial">
                Zero overselling.
              </span>
              <span className="animate-slide-up opacity-0 stagger-3 block mt-2 text-gradient-accent">
                Controle total.
              </span>
            </h1>
          </div>

          {/* Subheadline */}
          <p className="animate-slide-up opacity-0 stagger-4 text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed text-balance">
            Backend centralizado que sincroniza estoque em tempo real entre PDV, e-commerce e WhatsApp. 
            <span className="text-foreground/90"> Cada venda atualiza todos os canais em menos de 100ms.</span>
          </p>

          {/* CTA Buttons */}
          <div className="animate-slide-up opacity-0 stagger-5 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-20">
            <Link
              href="#"
              className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-foreground text-background font-semibold text-lg overflow-hidden btn-glow"
            >
              <span className="relative z-10 transition-transform duration-300 group-hover:-translate-x-1">Comece gratuitamente</span>
              <div className="relative z-10 w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center overflow-hidden">
                <svg className="w-4 h-4 text-accent transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-accent via-accent to-[oklch(0.65_0.22_280)] -translate-x-[101%] group-hover:translate-x-0 transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]" />
            </Link>
            
            <Link
              href="#"
              className="group inline-flex items-center gap-4 px-6 py-4 text-foreground/80 hover:text-foreground font-medium text-lg transition-all duration-500"
            >
              <div className="relative w-14 h-14 rounded-2xl glass glass-border flex items-center justify-center overflow-hidden hover-glow transition-all duration-500">
                <svg className="w-5 h-5 ml-0.5 relative z-10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <div className="absolute inset-0 bg-accent/0 group-hover:bg-accent/10 transition-colors duration-500" />
              </div>
              <span className="link-underline">Ver demonstracao</span>
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="animate-slide-up opacity-0 stagger-6 flex flex-wrap items-center justify-center gap-8 sm:gap-12 mb-20 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Setup em 5 minutos</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Sem cartao de credito</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Suporte 24/7</span>
            </div>
          </div>

          {/* Product Preview */}
          <div className="relative mx-auto max-w-6xl animate-slide-up opacity-0" style={{ animationDelay: '0.7s' }}>
            {/* Multi-layer Glow Effect */}
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-b from-accent/30 via-accent/10 to-transparent blur-2xl opacity-60" />
            <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-r from-accent/20 via-transparent to-[oklch(0.65_0.22_280_/_0.2)] blur-3xl opacity-40 animate-pulse-glow" />
            <div className="absolute -inset-16 rounded-[4rem]" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 100%, oklch(0.72 0.19 160 / 0.15) 0%, transparent 50%)' }} />
            
            {/* Main Card */}
            <div className="relative border-glow rounded-2xl lg:rounded-3xl overflow-hidden">
              <div className="bg-card/90 backdrop-blur-3xl">
                {/* Browser Chrome */}
                <div className="flex items-center gap-4 px-6 py-4 border-b border-border/50 bg-secondary/20">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57] shadow-lg shadow-[#ff5f57]/30" />
                    <div className="w-3 h-3 rounded-full bg-[#febc2e] shadow-lg shadow-[#febc2e]/30" />
                    <div className="w-3 h-3 rounded-full bg-[#28c840] shadow-lg shadow-[#28c840]/30" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="flex items-center gap-2.5 px-5 py-2 rounded-xl bg-background/50 border border-border/50 text-xs text-muted-foreground">
                      <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>app.ucm.com.br/dashboard</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Dashboard Content */}
                <div className="p-6 lg:p-10">
                  {/* Top Stats Row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
                    {[
                      { label: "SKUs Ativos", value: 2847, suffix: "", change: "+12%", up: true },
                      { label: "Pedidos/Hora", value: 259, suffix: "", change: "+8%", up: true },
                      { label: "Sync Time", value: 87, suffix: "ms", change: "-15ms", up: true },
                      { label: "Overselling", value: 0, suffix: "", change: "0%", up: true, accent: true },
                    ].map((stat, i) => (
                      <div key={stat.label} className="group relative p-5 rounded-2xl bg-secondary/30 border border-border/30 hover:border-accent/30 transition-all duration-500 hover-lift">
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <p className="relative text-xs text-muted-foreground mb-3 uppercase tracking-wider">{stat.label}</p>
                        <p className={`relative text-3xl lg:text-4xl font-bold tracking-tight ${stat.accent ? 'text-accent text-glow' : 'text-foreground'}`}>
                          <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                        </p>
                        <div className="relative flex items-center gap-1.5 mt-2">
                          <svg className={`w-3.5 h-3.5 ${stat.up ? 'text-accent' : 'text-destructive'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.up ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                          </svg>
                          <span className={`text-xs font-medium ${stat.up ? 'text-accent' : 'text-destructive'}`}>{stat.change}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Main Grid */}
                  <div className="grid lg:grid-cols-3 gap-6">
                    {/* Left: Channels */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Canais Conectados</h3>
                        <span className="flex items-center gap-2 text-xs text-accent font-medium">
                          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                          Todos sincronizados
                        </span>
                      </div>
                      
                      {[
                        { name: "PDV Loja Fisica", orders: "127", status: "Ultima sync: agora", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", gradient: "from-blue-500 via-blue-400 to-cyan-400" },
                        { name: "E-commerce Shopify", orders: "89", status: "Ultima sync: 1s", icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9", gradient: "from-green-500 via-emerald-400 to-teal-400" },
                        { name: "WhatsApp Business", orders: "43", status: "Ultima sync: 2s", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", gradient: "from-emerald-500 via-green-400 to-lime-400" },
                      ].map((channel) => (
                        <div key={channel.name} className="group flex items-center gap-5 p-5 rounded-2xl bg-secondary/20 border border-border/30 hover:border-accent/30 hover:bg-secondary/30 transition-all duration-500 hover-lift">
                          <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${channel.gradient} flex items-center justify-center shadow-xl overflow-hidden`}>
                            <svg className="w-6 h-6 text-white relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={channel.icon} />
                            </svg>
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-foreground">{channel.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{channel.status}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-foreground">{channel.orders}</p>
                            <p className="text-xs text-muted-foreground">pedidos/h</p>
                          </div>
                          <div className="relative">
                            <div className="w-3 h-3 rounded-full bg-accent" />
                            <div className="absolute inset-0 w-3 h-3 rounded-full bg-accent animate-ping opacity-75" />
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Right: Activity */}
                    <div className="p-6 rounded-2xl bg-secondary/20 border border-border/30 border-gradient-subtle">
                      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-5">Atividade em Tempo Real</h3>
                      <div className="space-y-4">
                        {[
                          { action: "Venda confirmada", channel: "PDV", time: "agora", qty: "-3 un", type: "sale" },
                          { action: "Reserva criada", channel: "Shopify", time: "2s", qty: "-1 un", type: "reserve" },
                          { action: "Reposicao", channel: "Sistema", time: "5s", qty: "+50 un", type: "restock" },
                          { action: "Venda confirmada", channel: "WhatsApp", time: "12s", qty: "-2 un", type: "sale" },
                          { action: "Sync completo", channel: "Todos", time: "15s", qty: "847 SKUs", type: "sync" },
                        ].map((activity, i) => (
                          <div key={i} className="group flex items-center gap-4 text-sm">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                              activity.type === 'sale' ? 'bg-blue-500/10 text-blue-400' :
                              activity.type === 'reserve' ? 'bg-amber-500/10 text-amber-400' :
                              activity.type === 'restock' ? 'bg-accent/10 text-accent' :
                              'bg-purple-500/10 text-purple-400'
                            }`}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                                  activity.type === 'sale' ? "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" :
                                  activity.type === 'reserve' ? "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" :
                                  activity.type === 'restock' ? "M5 10l7-7m0 0l7 7m-7-7v18" :
                                  "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                } />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-foreground font-medium truncate">{activity.action}</p>
                              <p className="text-xs text-muted-foreground">{activity.channel} - {activity.time}</p>
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                              activity.qty.startsWith('+') ? 'bg-accent/10 text-accent' : 
                              activity.qty.startsWith('-') ? 'bg-foreground/5 text-foreground' :
                              'bg-purple-500/10 text-purple-400'
                            }`}>
                              {activity.qty}
                            </span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Live indicator */}
                      <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                        </span>
                        Atualizando em tempo real
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floating Elements */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-2xl glass glass-border border-glow p-4 animate-float hidden lg:flex flex-col justify-center items-center">
              <span className="text-2xl font-bold text-accent">99.9%</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Uptime</span>
            </div>
            
            <div className="absolute -bottom-4 -left-4 w-28 h-20 rounded-2xl glass glass-border border-glow p-4 animate-float-delayed hidden lg:flex flex-col justify-center">
              <span className="text-lg font-bold text-foreground">&lt;100ms</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Sync Time</span>
            </div>
          </div>
        </div>
      </Container>
      
      {/* Bottom Gradient Line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  )
}
