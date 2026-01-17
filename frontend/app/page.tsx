"use client"

export default function Page() {
  return (
    <main className="hero-signal min-h-screen text-slate-100">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 right-[-12%] h-[480px] w-[480px] rounded-full glow-ember blur-[140px]" />
        <div className="pointer-events-none absolute top-8 left-[-18%] h-[420px] w-[420px] rounded-full glow-ice blur-[140px]" />
        <div className="pointer-events-none absolute bottom-[-20%] right-[10%] h-[520px] w-[520px] rounded-full glow-aurora blur-[160px]" />
        <div className="pointer-events-none absolute inset-0 hero-grid opacity-70" />

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

          <section className="mt-16 grid gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-10">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">
                <span className="h-2 w-2 rounded-full bg-[var(--signal-amber)]" />
                Controle de vendas em estado de alerta
              </div>

              <div className="space-y-6">
                <h1 className="font-display text-[clamp(3.4rem,8.8vw,5.9rem)] leading-[0.94] text-white animate-fade-up">
                  A torre de comando que sincroniza cada venda.
                </h1>
                <p className="text-lg text-slate-300 max-w-xl animate-fade-up-delay">
                  Estoque, pagamentos e atendimento rodando em um so plano de voo. Menos ruina, mais escala, e uma
                  operacao que nunca perde o ritmo.
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
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white font-semibold">{item.value}</p>
                    <p className="mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="signal-panel rounded-[32px] p-8 animate-fade-up-delay">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Mission Control</p>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">Live sync</span>
              </div>

              <div className="mt-8 space-y-4">
                {[
                  { label: "Pedidos em fluxo", value: "1.284", delta: "+18% 24h" },
                  { label: "Estoque critico", value: "12", delta: "Reposicao inteligente" },
                  { label: "WhatsApp", value: "3.2s", delta: "Resposta media" },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-slate-400">{metric.label}</p>
                    <div className="mt-2 flex items-baseline justify-between">
                      <p className="text-2xl font-semibold text-white">{metric.value}</p>
                      <p className="text-xs text-slate-300">{metric.delta}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-400">Previsao operacional</p>
                <p className="mt-2 text-sm text-slate-200">
                  Alertas de reposicao, previsao de demanda e status por canal em segundos.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              { title: "Estoque blindado", text: "Transacoes ACID e reservas inteligentes para zerar overselling." },
              { title: "Pagamentos sem atrito", text: "PIX, cartao e boleto em um fluxo unificado." },
              { title: "Atendimento em escala", text: "WhatsApp, notificacoes e bot prontos para vender." },
            ].map((item) => (
              <div key={item.title} className="signal-card rounded-2xl p-6">
                <div className="h-1 w-12 rounded-full accent-line mb-4" />
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm text-slate-300">{item.text}</p>
              </div>
            ))}
          </section>

          <section className="mt-20 grid gap-12 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-6">
              <h2 className="font-display text-4xl text-white">Tres interfaces. Um unico pulso.</h2>
              <p className="text-slate-300">
                PDV, e-commerce e WhatsApp nao competem entre si. Eles obedecem o mesmo motor, com estoque central e
                dados em tempo real.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { title: "PDV express", text: "Checkout imediato, sem friccao." },
                  { title: "Storefront premium", text: "Vitrine pronta para conversao." },
                  { title: "Bot autonomo", text: "Atendimento que fecha pedidos." },
                  { title: "Painel executivo", text: "KPIs e alertas em uma tela." },
                ].map((card) => (
                  <div key={card.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
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

          <section className="mt-20 grid gap-6 lg:grid-cols-3">
            {[
              { title: "Seguranca operacional", text: "Auditoria total, controles de acesso e logs por usuario." },
              { title: "Performance tatica", text: "Cache distribuido e idempotencia critica." },
              { title: "Escala imediata", text: "Multi-tenant pronto para growth e franquias." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm text-slate-300">{item.text}</p>
              </div>
            ))}
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
