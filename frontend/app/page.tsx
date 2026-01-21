"use client"

import { useEffect } from "react"

const stats = [
  { label: "Disponibilidade", value: "99.99%" },
  { label: "Pedidos/dia", value: "+2.4k" },
  { label: "Rupturas", value: "-46%" },
]

const capabilities = [
  {
    title: "Estoque centralizado",
    text: "Reservas em tempo real e rastreio por canal para eliminar overselling.",
  },
  {
    title: "Pagamentos integrados",
    text: "PIX, cartao e boleto com reconciliacao automatica.",
  },
  {
    title: "Atendimento escalavel",
    text: "WhatsApp e notificacoes no mesmo fluxo operacional.",
  },
]

const channels = [
  { title: "PDV express", text: "Checkout rapido e sem friccao." },
  { title: "E-commerce premium", text: "Vitrine consistente com a marca." },
  { title: "WhatsApp autonomo", text: "Pedidos guiados por IA." },
  { title: "Painel executivo", text: "KPIs com decisao instantanea." },
]

const flow = [
  { step: "01", title: "Capture", text: "Pedido chega de qualquer canal." },
  { step: "02", title: "Sincronize", text: "Estoque atualizado e reservado." },
  { step: "03", title: "Confirme", text: "Pagamento aprovado em segundos." },
  { step: "04", title: "Entregue", text: "Fluxo de fulfillment orquestrado." },
]

const pricing = [
  {
    name: "Essencial",
    price: "R$ 149/mês",
    installment: "12x de R$ 14,90",
    description: "Ative o PDV e controle estoque sem friccao.",
    ideal: "Para quem quer sair do improviso com rapidez.",
    features: [
      "PDV completo com atalhos",
      "Estoque em tempo real",
      "Relatorios essenciais",
      "Cadastro rapido de produtos",
    ],
  },
  {
    name: "Crescimento",
    price: "R$ 349/mês",
    installment: "12x de R$ 34,90",
    description: "WhatsApp virando sua maquina de vendas.",
    ideal: "Para escalar atendimento e fechar pedidos 24/7.",
    features: [
      "Tudo do Start",
      "Bot WhatsApp (pedido, pagamento, status)",
      "Cupons e campanhas",
      "Fluxo de pagamento automatizado",
    ],
    highlight: true,
  },
  {
    name: "Expansao",
    price: "R$ 749/mês",
    installment: "12x de R$ 74,90",
    description: "Multi-lojas, equipes e operacao distribuida.",
    ideal: "Para redes e franquias que precisam de controle.",
    features: [
      "Tudo do Pro",
      "Multi-lojas e permissoes",
      "Integracoes sob demanda",
      "Relatorios avancados",
      "Suporte prioritario",
    ],
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    installment: "Condicoes personalizadas",
    description: "SLA, compliance e integrares sob medida.",
    ideal: "Para operacoes de alto volume e requisitos strict.",
    features: [
      "SLA dedicado",
      "Onboarding premium",
      "Roadmap conjunto",
      "Stack de seguranca",
    ],
  },
]

export default function Page() {
  useEffect(() => {
    if (typeof window === "undefined") return
    const elements = Array.from(document.querySelectorAll(".reveal"))
    if (!("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("reveal-visible"))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible")
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.2 },
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const root = document.documentElement
    const handleMove = (event: MouseEvent) => {
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2
      root.style.setProperty("--mouse-x", `${event.clientX - centerX}px`)
      root.style.setProperty("--mouse-y", `${event.clientY - centerY}px`)
      root.style.setProperty("--cursor-x", `${event.clientX}px`)
      root.style.setProperty("--cursor-y", `${event.clientY}px`)
    }
    window.addEventListener("mousemove", handleMove)
    return () => window.removeEventListener("mousemove", handleMove)
  }, [])

  return (
    <main className="app-shell full-bleed text-slate-100">
      <div className="relative overflow-hidden">
        <div className="cursor-glow" />
        <div className="pointer-events-none absolute -top-48 right-[-12%] h-[520px] w-[520px] rounded-full signal-halo blur-[180px] parallax-slow" />
        <div className="pointer-events-none absolute top-16 left-[-16%] h-[520px] w-[520px] rounded-full signal-ember blur-[200px] parallax-fast" />
        <div className="pointer-events-none absolute bottom-[-30%] right-[25%] h-[540px] w-[540px] rounded-full signal-teal blur-[200px] parallax-slow" />
        <div className="pointer-events-none absolute inset-0 signal-grid opacity-70" />

        <div className="page-wrap">
          <header className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-sm font-semibold tracking-[0.2em]">
                GT
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.38em] text-slate-300">GTSOFT HUB</p>
                <p className="text-sm font-semibold text-slate-100">Unified Commerce Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <a href="/login" className="btn-outline">
                Entrar
              </a>
              <a href="/login" className="btn-primary btn-glow">
                Comecar teste
              </a>
            </div>
          </header>
        </div>

        <section className="page-wrap pb-16 pt-10">
          <div className="grid min-h-[80svh] items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8 animate-fade-up reveal">
              <div className="signal-pill inline-flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[var(--signal-cyan)]" />
                Operacao sincronizada em tempo real
              </div>

              <div className="space-y-5">
                <h1 className="font-display text-[clamp(3rem,8vw,6rem)] leading-[0.95] text-white">
                  Sincronize vendas, estoque, pagamentos e atendimento.
                </h1>
                <p className="text-lg text-slate-200 max-w-2xl">
                  Uma plataforma unificada para operar tudo em segundos, com dados em tempo real e execucao sem ruido.
                </p>
                <p className="text-sm text-slate-300 max-w-xl">
                  O bot do WhatsApp atende, vende, valida pagamento e acompanha o pedido com linguagem natural.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="/login"
                  className="btn-primary btn-glow"
                >
                  Comecar teste
                </a>
                <a
                  href="#planos"
                  className="btn-outline"
                >
                  Ver planos
                </a>
                <a
                  href="/pdv"
                  className="btn-outline"
                >
                  Ver PDV ao vivo
                </a>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 reveal reveal-delay-1">
                {stats.map((item) => (
                  <div key={item.label} className="signal-card rounded-2xl p-4 tilt-card">
                    <p className="text-xl font-semibold text-white">{item.value}</p>
                    <p className="mt-1 text-sm text-slate-300">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="signal-panel rounded-[32px] p-8 animate-fade-up-delay reveal tilt-card">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Mission control</p>
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900">Live sync</span>
              </div>
              <div className="mt-8 space-y-5">
                {[
                  { label: "Pedidos em fluxo", value: "1.284", delta: "+18% 24h" },
                  { label: "Estoque critico", value: "12", delta: "Reposicao inteligente" },
                  { label: "WhatsApp", value: "3.2s", delta: "Resposta media" },
                ].map((metric) => (
                  <div key={metric.label} className="stat-row">
                    <div>
                      <p className="text-xs text-slate-300">{metric.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
                    </div>
                    <div className="text-right text-xs text-slate-300">
                      <p>{metric.delta}</p>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <span className="mini-bar w-10" />
                        <span className="mini-bar w-6 opacity-60" />
                        <span className="mini-bar w-3 opacity-40" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs text-slate-300">Previsao operacional</p>
                <p className="mt-2 text-sm text-slate-200">
                  Alertas de reposicao, previsao de demanda e status por canal em segundos.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="page-wrap pt-2 reveal">
          <div className="flex flex-wrap items-center gap-6 text-xs uppercase tracking-[0.3em] text-slate-400">
            <span>Operacao confiavel</span>
            <span>Dados auditaveis</span>
            <span>Compliance pronto</span>
            <span>Escala imediata</span>
          </div>
        </section>

        <section className="page-wrap mt-6 reveal">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="glass-card rounded-2xl p-6 tilt-card">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Prova social</p>
              <h3 className="mt-3 text-xl font-semibold text-white">Operacoes que confiam no UCM.</h3>
              <p className="mt-2 text-sm text-slate-200">
                Historias reais de quem migrou para uma operacao unificada e passou a vender com previsibilidade.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-slate-300">
                {["Loja Aurora", "Grupo Vitrine", "Rede Cafe", "Studio Dock"].map((logo) => (
                  <div key={logo} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    {logo}
                  </div>
                ))}
              </div>
            </div>
            <div className="signal-panel rounded-2xl p-6 tilt-card">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Depoimentos</p>
              <div className="mt-4 space-y-4 text-sm text-slate-200">
                <p>
                  "O bot do WhatsApp virou nosso melhor vendedor. Ele atende, confirma e libera o pedido sem
                  gargalo."
                </p>
                <p className="text-xs text-slate-400">Mariana S. - Operacoes Omnichannel</p>
                <div className="h-px w-full bg-white/10" />
                <p>
                  "Estoque parou de estourar. Tudo sincronizado, do PDV ao WhatsApp, em tempo real."
                </p>
                <p className="text-xs text-slate-400">Lucas A. - Rede de lojas</p>
              </div>
            </div>
          </div>
        </section>

        <section className="page-wrap mt-6 grid gap-6 md:grid-cols-3 reveal">
          {capabilities.map((item) => (
            <div key={item.title} className="glass-card rounded-2xl p-6 tilt-card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Core</p>
              <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm text-slate-200">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="page-wrap mt-8 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] reveal">
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold text-white">Um combo completo para vender sem friccao.</h2>
            <p className="text-slate-200">
              PDV, e-commerce e WhatsApp obedecem o mesmo core. O bot do WhatsApp atende, vende, valida pagamento
              e acompanha o pedido, fazendo o trabalho pesado acontecer.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {channels.map((card) => (
                <div key={card.title} className="signal-card rounded-2xl p-4 tilt-card">
                  <p className="text-white font-semibold">{card.title}</p>
                  <p className="mt-2 text-sm text-slate-200">{card.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="signal-panel rounded-[32px] p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Ciclo operacional</p>
            {flow.map((item) => (
              <div key={item.step} className="mt-6 flex items-start gap-4 border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
                <span className="text-sm text-slate-400">{item.step}</span>
                <div>
                  <p className="text-white font-semibold">{item.title}</p>
                  <p className="text-sm text-slate-200">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="page-wrap mt-10" id="planos">
          <div className="flex items-end justify-between gap-6 flex-wrap reveal">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Planos</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Escolha o ritmo da sua operacao.</h2>
              <p className="mt-3 text-slate-200 max-w-2xl">
                Planos pensados para escalar o PDV e colocar o WhatsApp como motor de vendas.
              </p>
            </div>
            <a
              href="/login"
              className="btn-primary btn-glow"
            >
              Comecar teste
            </a>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4 reveal reveal-delay-1">
            {pricing.map((plan) => (
              <div key={plan.name} className="flip-card">
                <div className="flip-card-inner tilt-card">
                  <div
                    className={`flip-card-face rounded-2xl p-6 ${plan.highlight ? "signal-panel border border-white/20" : "glass-card border border-white/10"}`}
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{plan.name}</p>
                    <p className="mt-4 text-3xl font-semibold text-white">{plan.price}</p>
                    <p className="mt-2 text-sm text-slate-200">{plan.description}</p>
                    <p className="mt-3 text-xs text-slate-300">{plan.ideal}</p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-200">
                      {plan.features.slice(0, 2).map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[var(--signal-cyan)]" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 flex items-center justify-between text-xs text-slate-300">
                      <span>Hover para detalhes completos</span>
                      <span className="rounded-full border border-white/20 px-2 py-1">+</span>
                    </div>
                  </div>

                  <div
                    className={`flip-card-face flip-card-back rounded-2xl p-6 ${plan.highlight ? "signal-panel border border-white/20" : "glass-card border border-white/10"}`}
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{plan.name}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{plan.price}</p>
                    <p className="text-xs text-slate-300">{plan.installment}</p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-200">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[var(--signal-cyan)]" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <a
                      href="/login"
                      className={`mt-5 inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                        plan.highlight ? "btn-primary" : "btn-outline"
                      }`}
                    >
                      Comecar teste
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="page-wrap mt-8 reveal">
          <div className="signal-panel rounded-[36px] px-8 py-10 md:flex md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Pronto para operar</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">
                Sua marca no centro do comercio unificado.
              </h2>
              <p className="mt-4 text-slate-200 max-w-xl">
                Ative canais, mantenha estoque blindado e transforme atendimento em receita real.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 md:mt-0">
              <a
                href="/login"
                className="btn-primary btn-glow"
              >
                Comecar teste
              </a>
              <a
                href="/pdv"
                className="btn-outline"
              >
                Ver PDV
              </a>
            </div>
          </div>
        </section>

        <section className="page-wrap mt-10 reveal">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Contato</p>
              <h2 className="text-3xl font-semibold text-white">Vamos colocar sua operacao para rodar.</h2>
              <p className="text-slate-200">
                Entre em contato para agendar uma demo e destravar o poder do bot no WhatsApp.
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <a
                  href="https://wa.me/5511978118610"
                  className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/40"
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp: +55 11 97811-8610
                </a>
                <a
                  href="mailto:guuga.dev20@gmail.com"
                  className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:border-white/40"
                >
                  guuga.dev20@gmail.com
                </a>
              </div>
            </div>
            <form
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
              action="mailto:guuga.dev20@gmail.com"
              method="post"
              encType="text/plain"
            >
              <div className="grid gap-4">
                <div>
                  <label className="text-xs text-slate-300">Nome</label>
                  <input
                    name="nome"
                    placeholder="Seu nome"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300">Email</label>
                  <input
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300">Mensagem</label>
                  <textarea
                    name="mensagem"
                    rows={4}
                    placeholder="Conte rapidamente o que voce precisa."
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="mt-4 w-full rounded-full bg-[var(--accent-coral)] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[var(--signal-ember)]"
              >
                Enviar mensagem
              </button>
              <p className="mt-2 text-xs text-slate-400">
                Este formulario abre seu cliente de email.
              </p>
            </form>
          </div>
        </section>

        <footer className="page-wrap mt-6 border-t border-white/10 pt-6 text-sm text-slate-400">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>UCM Platform - Versao 1.0</p>
            <p>Operacional, auditavel, pronto para escala.</p>
          </div>
        </footer>
      </div>
    </main>
  )
}
