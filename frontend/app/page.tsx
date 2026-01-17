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

export default function Page() {
  return (
    <main className="corp-shell min-h-screen text-slate-900">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-52 right-[-10%] h-[520px] w-[520px] rounded-full corp-glow-blue blur-[170px]" />
        <div className="pointer-events-none absolute top-12 left-[-18%] h-[460px] w-[460px] rounded-full corp-glow-ice blur-[170px]" />
        <div className="pointer-events-none absolute bottom-[-25%] right-[18%] h-[520px] w-[520px] rounded-full corp-glow-mint blur-[180px]" />
        <div className="pointer-events-none absolute inset-0 corp-grid opacity-70" />

        <div className="mx-auto w-full max-w-7xl px-6 pb-24 pt-10 md:px-10 md:pt-16">
          <header className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-semibold tracking-[0.2em] shadow-sm">
                GT
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.38em] text-slate-500">GTSOFT HUB</p>
                <p className="text-sm font-semibold text-slate-700">Unified Commerce Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <a href="/login" className="rounded-full border border-slate-300 px-4 py-2 text-slate-700 transition hover:border-slate-400">
                Entrar
              </a>
              <a href="/admin" className="rounded-full bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800">
                Console
              </a>
            </div>
          </header>

          <section className="mt-16 grid min-h-[100svh] items-center gap-12 pb-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8">
              <div className="corp-pill inline-flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[var(--corp-blue)]" />
                Operacao unificada, sem ruina
              </div>

              <div className="space-y-5">
                <h1 className="text-[clamp(2.7rem,6.8vw,4.6rem)] font-semibold leading-[1.05] text-slate-900">
                  Controle corporativo para vendas omnicanal em tempo real.
                </h1>
                <p className="text-lg text-slate-600 max-w-xl">
                  Estoque, pagamentos e atendimento em um unico motor. Dados confiaveis, fluxo continuo e escala sem
                  ruptura.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="/login"
                  className="rounded-full bg-[var(--corp-blue)] px-7 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px] hover:bg-[var(--corp-blue-strong)]"
                >
                  Entrar na plataforma
                </a>
                <a
                  href="/loja"
                  className="rounded-full border border-slate-300 px-7 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                >
                  Ver demo
                </a>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {stats.map((item) => (
                  <div key={item.label} className="corp-stat rounded-2xl p-4">
                    <p className="text-lg font-semibold text-slate-900">{item.value}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="corp-panel rounded-[32px] p-8">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Command center</p>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white">Live</span>
              </div>
              <div className="mt-8 space-y-5">
                {[
                  { label: "Pedidos em fluxo", value: "1.284", delta: "+18% 24h" },
                  { label: "Estoque critico", value: "12", delta: "Reposicao inteligente" },
                  { label: "WhatsApp", value: "3.2s", delta: "Resposta media" },
                ].map((metric) => (
                  <div key={metric.label} className="corp-row">
                    <div>
                      <p className="text-xs text-slate-500">{metric.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{metric.value}</p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <p>{metric.delta}</p>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <span className="corp-bar w-10" />
                        <span className="corp-bar w-6 opacity-60" />
                        <span className="corp-bar w-3 opacity-40" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-4">
                <p className="text-xs text-slate-500">Forecast inteligente</p>
                <p className="mt-2 text-sm text-slate-600">
                  Alertas de reposicao, previsao de demanda e status por canal em segundos.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <div className="flex flex-wrap items-center gap-6 text-xs uppercase tracking-[0.3em] text-slate-400">
              <span>Operacao confiavel</span>
              <span>Dados auditaveis</span>
              <span>Compliance pronto</span>
              <span>Escala imediata</span>
            </div>
          </section>

          <section className="mt-16 grid gap-6 md:grid-cols-3">
            {capabilities.map((item) => (
              <div key={item.title} className="corp-card rounded-2xl p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Core</p>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm text-slate-600">{item.text}</p>
              </div>
            ))}
          </section>

          <section className="mt-20 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <h2 className="text-3xl font-semibold text-slate-900">Tres interfaces, um unico motor.</h2>
              <p className="text-slate-600">
                PDV, e-commerce e WhatsApp obedecem o mesmo core. Um painel unico, estoque central e dados
                instantaneos.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {channels.map((card) => (
                  <div key={card.title} className="corp-surface rounded-2xl p-4">
                    <p className="text-slate-900 font-semibold">{card.title}</p>
                    <p className="mt-2 text-sm text-slate-600">{card.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="corp-panel rounded-[32px] p-8">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Ciclo operacional</p>
              {flow.map((item) => (
                <div key={item.step} className="mt-6 flex items-start gap-4 border-b border-slate-200 pb-4 last:border-b-0 last:pb-0">
                  <span className="text-sm text-slate-400">{item.step}</span>
                  <div>
                    <p className="text-slate-900 font-semibold">{item.title}</p>
                    <p className="text-sm text-slate-600">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-20">
            <div className="corp-cta rounded-[36px] px-8 py-10 md:flex md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Pronto para operar</p>
                <h2 className="mt-3 text-3xl font-semibold text-slate-900">
                  Sua marca no centro do comercio unificado.
                </h2>
                <p className="mt-4 text-slate-600 max-w-xl">
                  Ative canais, mantenha estoque blindado e transforme atendimento em receita real.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 md:mt-0">
                <a
                  href="/login"
                  className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Entrar agora
                </a>
                <a
                  href="/pdv"
                  className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                >
                  Ver PDV
                </a>
              </div>
            </div>
          </section>

          <footer className="mt-16 border-t border-slate-200 pt-6 text-sm text-slate-500">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>UCM Platform - Versao 1.0</p>
              <p>Operacional, auditavel, pronto para escala.</p>
            </div>
          </footer>
        </div>
      </div>
    </main>
  )
}
