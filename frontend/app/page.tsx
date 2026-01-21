"use client"

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
    name: "Start",
    price: "R$ 149/mês",
    description: "Base essencial para comecar a vender.",
    features: ["PDV completo", "Estoque centralizado", "Relatorios basicos"],
  },
  {
    name: "Pro",
    price: "R$ 349/mês",
    description: "WhatsApp como canal principal de vendas.",
    features: [
      "Tudo do Start",
      "Bot WhatsApp (pedido, pagamento, status)",
      "Cupons e regras promocionais",
    ],
    highlight: true,
  },
  {
    name: "Scale",
    price: "R$ 749/mês",
    description: "Operacao multi-loja e integracoes avancadas.",
    features: [
      "Tudo do Pro",
      "Multi-lojas e equipes",
      "Integracoes sob demanda",
      "Suporte prioritario",
    ],
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    description: "SLA, compliance e integrações especiais.",
    features: ["SLA dedicado", "Onboarding premium", "Roadmap conjunto"],
  },
]

export default function Page() {
  return (
    <main className="app-shell full-bleed text-slate-100">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-48 right-[-12%] h-[520px] w-[520px] rounded-full signal-halo blur-[180px]" />
        <div className="pointer-events-none absolute top-16 left-[-16%] h-[520px] w-[520px] rounded-full signal-ember blur-[200px]" />
        <div className="pointer-events-none absolute bottom-[-30%] right-[25%] h-[540px] w-[540px] rounded-full signal-teal blur-[200px]" />
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
              <a href="/login" className="rounded-full border border-white/20 px-4 py-2 text-slate-100 transition hover:border-white/40">
                Entrar
              </a>
              <a href="/admin" className="rounded-full bg-white px-4 py-2 font-semibold text-slate-900 transition hover:bg-slate-100">
                Console
              </a>
            </div>
          </header>
        </div>

        <section className="page-wrap pb-16 pt-10">
          <div className="grid min-h-[80svh] items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8 animate-fade-up">
              <div className="signal-pill inline-flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[var(--signal-cyan)]" />
                Operacao sincronizada em tempo real
              </div>

              <div className="space-y-5">
                <h1 className="font-display text-[clamp(3rem,8vw,6rem)] leading-[0.95] text-white">
                  A torre de comando que sincroniza cada venda.
                </h1>
                <p className="text-lg text-slate-200 max-w-2xl">
                  Estoque, pagamentos e atendimento rodando no mesmo pulso. Menos ruptura, mais escala e uma operacao
                  que nunca perde o ritmo.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="/login"
                  className="rounded-full bg-[var(--accent-coral)] px-7 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] hover:bg-[var(--signal-ember)]"
                >
                  Entrar no sistema
                </a>
                <a
                  href="/loja"
                  className="rounded-full border border-white/20 px-7 py-3 text-sm font-semibold text-white transition hover:border-white/40"
                >
                  Ver vitrine ao vivo
                </a>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {stats.map((item) => (
                  <div key={item.label} className="signal-card rounded-2xl p-4">
                    <p className="text-xl font-semibold text-white">{item.value}</p>
                    <p className="mt-1 text-sm text-slate-300">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="signal-panel rounded-[32px] p-8 animate-fade-up-delay">
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

        <section className="page-wrap pt-2">
          <div className="flex flex-wrap items-center gap-6 text-xs uppercase tracking-[0.3em] text-slate-400">
            <span>Operacao confiavel</span>
            <span>Dados auditaveis</span>
            <span>Compliance pronto</span>
            <span>Escala imediata</span>
          </div>
        </section>

        <section className="page-wrap mt-6 grid gap-6 md:grid-cols-3">
          {capabilities.map((item) => (
            <div key={item.title} className="glass-card rounded-2xl p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Core</p>
              <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm text-slate-200">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="page-wrap mt-8 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold text-white">Um combo completo para vender sem friccao.</h2>
            <p className="text-slate-200">
              PDV, e-commerce e WhatsApp obedecem o mesmo core. O bot do WhatsApp atende, vende, valida pagamento
              e acompanha o pedido, fazendo o trabalho pesado acontecer.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {channels.map((card) => (
                <div key={card.title} className="signal-card rounded-2xl p-4">
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

        <section className="page-wrap mt-10">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Planos</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Escolha o ritmo da sua operacao.</h2>
              <p className="mt-3 text-slate-200 max-w-2xl">
                Planos pensados para escalar o PDV e colocar o WhatsApp como motor de vendas.
              </p>
            </div>
            <a
              href="/login"
              className="rounded-full bg-[var(--accent-coral)] px-6 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] hover:bg-[var(--signal-ember)]"
            >
              Comecar teste
            </a>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 ${plan.highlight ? "signal-panel border border-white/20" : "glass-card border border-white/10"}`}
              >
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{plan.name}</p>
                <p className="mt-3 text-2xl font-semibold text-white">{plan.price}</p>
                <p className="mt-2 text-sm text-slate-200">{plan.description}</p>
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
                    plan.highlight
                      ? "bg-white text-slate-900 hover:bg-slate-100"
                      : "border border-white/20 text-white hover:border-white/40"
                  }`}
                >
                  Comecar teste
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="page-wrap mt-8">
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
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Entrar agora
              </a>
              <a
                href="/pdv"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/40"
              >
                Ver PDV
              </a>
            </div>
          </div>
        </section>

        <section className="page-wrap mt-10">
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
