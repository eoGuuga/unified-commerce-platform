"use client"

export default function Page() {
  return (
    <main className="hero-signal min-h-screen text-slate-100">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-48 right-[-8%] h-[520px] w-[520px] rounded-full glow-ember blur-[160px]" />
        <div className="pointer-events-none absolute top-16 left-[-20%] h-[460px] w-[460px] rounded-full glow-ice blur-[160px]" />
        <div className="pointer-events-none absolute bottom-[-22%] right-[18%] h-[520px] w-[520px] rounded-full glow-aurora blur-[160px]" />
        <div className="pointer-events-none absolute inset-0 hero-grid opacity-50" />

        <div className="mx-auto max-w-6xl px-6 pb-24 pt-10 md:pt-16">
          <header className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold tracking-[0.2em]">
                GT
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">GTSOFT HUB</p>
                <p className="text-sm font-semibold text-slate-200">Unified Commerce Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <a href="/login" className="rounded-full border border-white/15 px-4 py-2 text-slate-200 transition hover:border-white/40">
                Entrar
              </a>
              <a href="/admin" className="rounded-full bg-white text-slate-900 px-4 py-2 font-semibold transition hover:bg-slate-200">
                Console
              </a>
            </div>
          </header>

          <section className="mt-18 grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8">
              <div className="signal-pill inline-flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[var(--signal-amber)]" />
                Controle premium de operacao
              </div>

              <div className="space-y-5">
                <h1 className="font-display text-[clamp(3.1rem,7.8vw,5.2rem)] leading-[0.96] text-white animate-fade-up">
                  Sua operacao de vendas em estado de comando absoluto.
                </h1>
                <p className="text-lg text-slate-300 max-w-xl animate-fade-up-delay">
                  Estoque, pagamentos e atendimento em um unico fluxo. Sem ruina, sem atraso, com previsibilidade
                  real para crescer.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="/login"
                  className="rounded-full bg-[var(--signal-amber)] px-7 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] hover:bg-[#ffc96b]"
                >
                  Entrar no sistema
                </a>
                <a
                  href="/loja"
                  className="rounded-full border border-white/20 px-7 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/50"
                >
                  Vitrine ao vivo
                </a>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 text-sm text-slate-400">
                {[
                  { label: "Disponibilidade", value: "99.99%" },
                  { label: "Pedidos/dia", value: "+2.4k" },
                  { label: "Rupturas", value: "-46%" },
                ].map((item) => (
                  <div key={item.label} className="signal-surface rounded-2xl p-4">
                    <p className="text-white font-semibold">{item.value}</p>
                    <p className="mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="signal-surface rounded-[32px] p-8 animate-fade-up-delay">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Mission control</p>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">Live sync</span>
              </div>

              <div className="mt-8 space-y-5">
                {[
                  { label: "Pedidos em fluxo", value: "1.284", delta: "+18% 24h" },
                  { label: "Estoque critico", value: "12", delta: "Reposicao inteligente" },
                  { label: "WhatsApp", value: "3.2s", delta: "Resposta media" },
                ].map((metric) => (
                  <div key={metric.label} className="stat-row">
                    <div>
                      <p className="text-xs text-slate-400">{metric.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-300">{metric.delta}</p>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <span className="mini-bar w-10" />
                        <span className="mini-bar w-6 opacity-60" />
                        <span className="mini-bar w-3 opacity-40" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-400">Forecast inteligente</p>
                <p className="mt-2 text-sm text-slate-200">
                  Alertas de reposicao, previsao de demanda e status por canal em segundos.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-16">
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { title: "Estoque blindado", text: "Transacoes ACID e reservas inteligentes para zerar overselling." },
                { title: "Pagamentos sem atrito", text: "PIX, cartao e boleto com reconciliacao instantanea." },
                { title: "Atendimento em escala", text: "WhatsApp, notificacoes e bot prontos para vender." },
              ].map((item) => (
                <div key={item.title} className="signal-card rounded-2xl p-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Core</p>
                  <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm text-slate-300">{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-18 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <h2 className="font-display text-4xl text-white">Tres interfaces, um unico pulso.</h2>
              <p className="text-slate-300">
                PDV, e-commerce e WhatsApp obedecem o mesmo motor. Um painel unico, estoque central e dados
                instantaneos.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { title: "PDV express", text: "Checkout imediato, sem friccao." },
                  { title: "Storefront premium", text: "Vitrine pronta para conversao." },
                  { title: "Bot autonomo", text: "Atendimento que fecha pedidos." },
                  { title: "Painel executivo", text: "KPIs e alertas em uma tela." },
                ].map((card) => (
                  <div key={card.title} className="signal-surface rounded-2xl p-4">
                    <p className="text-white font-semibold">{card.title}</p>
                    <p className="mt-2 text-sm text-slate-300">{card.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="signal-panel rounded-[32px] p-8">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Ciclo de dominio</p>
              {[
                { step: "01", title: "Capture", text: "Venda chega de qualquer canal." },
                { step: "02", title: "Sincronize", text: "Reserva e atualiza estoque." },
                { step: "03", title: "Confirme", text: "Pagamento aprovado em segundos." },
                { step: "04", title: "Entregue", text: "Fluxo de fulfillment orquestrado." },
              ].map((item) => (
                <div key={item.step} className="mt-6 flex items-start gap-4 border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
                  <span className="text-sm text-slate-400">{item.step}</span>
                  <div>
                    <p className="text-white font-semibold">{item.title}</p>
                    <p className="text-sm text-slate-300">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-20">
            <div className="signal-card rounded-[36px] px-8 py-10 md:flex md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Pronto para liderar</p>
                <h2 className="font-display text-4xl text-white mt-3">Sua marca no centro do comercio unificado.</h2>
                <p className="mt-4 text-slate-300 max-w-xl">
                  Ative canais, mantenha estoque blindado e transforme atendimento em receita real.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 md:mt-0">
                <a
                  href="/login"
                  className="rounded-full bg-white text-slate-900 px-6 py-3 text-sm font-semibold transition hover:bg-slate-200"
                >
                  Entrar agora
                </a>
                <a
                  href="/pdv"
                  className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/50"
                >
                  Ver PDV
                </a>
              </div>
            </div>
          </section>

          <footer className="mt-16 border-t border-white/10 pt-6 text-sm text-slate-400">
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
