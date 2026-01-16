"use client"

export default function Page() {
  return (
    <main className="hero-bg min-h-screen text-slate-100">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-48 right-[-10%] h-[520px] w-[520px] rounded-full glow-coral blur-3xl" />
        <div className="pointer-events-none absolute top-20 left-[-20%] h-[460px] w-[460px] rounded-full glow-teal blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-20%] right-[-15%] h-[480px] w-[480px] rounded-full glow-teal blur-[140px]" />

        <div className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pt-16">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                GT
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">GTSOFT HUB</p>
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

          <section className="mt-16 grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-slate-300">
                <span className="h-2 w-2 rounded-full bg-[var(--accent-coral)]" />
                Vendas sincronizadas em tempo real
              </div>

              <div className="space-y-6">
                <h1 className="font-display text-[clamp(3.2rem,8vw,5.6rem)] leading-[0.95] text-white animate-fade-up">
                  O comando absoluto da sua operação de vendas.
                </h1>
                <p className="text-lg text-slate-300 max-w-xl animate-fade-up-delay">
                  Unifique PDV, e-commerce e WhatsApp em uma só orquestra. Estoque blindado, pedidos fluindo,
                  automação de atendimento e dados que antecipam o próximo movimento.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="/login"
                  className="rounded-full bg-[var(--accent-coral)] px-6 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] hover:bg-[#ff9a66]"
                >
                  Acessar o sistema
                </a>
                <a
                  href="/loja"
                  className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/50"
                >
                  Ver vitrine ao vivo
                </a>
              </div>

              <div className="flex flex-wrap gap-6 text-sm text-slate-400">
                <div>
                  <p className="text-white font-semibold">99.99%</p>
                  <p>Tempo de atividade</p>
                </div>
                <div>
                  <p className="text-white font-semibold">3 canais</p>
                  <p>PDV + E-commerce + WhatsApp</p>
                </div>
                <div>
                  <p className="text-white font-semibold">-40%</p>
                  <p>Redução de rupturas</p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-3xl p-8 animate-fade-up-delay">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Controle em tempo real</p>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">Ao vivo</span>
                </div>

                <div className="space-y-4">
                  {[
                    { label: "Pedidos sincronizados", value: "1.284", delta: "+18% 24h" },
                    { label: "Estoque crítico", value: "12", delta: "Ajuste automático" },
                    { label: "Atendimento WhatsApp", value: "3.2s", delta: "Resposta média" },
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

                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <p className="text-xs text-slate-400">Alertas inteligentes</p>
                  <p className="mt-2 text-sm text-slate-200">
                    Sugestões de reposição baseadas em velocidade de venda, sazonalidade e campanhas.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              { title: "Estoque impenetrável", text: "Transações ACID e reserva inteligente para nunca vender o que não existe." },
              { title: "Checkout sem atrito", text: "Pagamentos e confirmações fluem com integração imediata." },
              { title: "Automação em cadeia", text: "WhatsApp e notificações em um fluxo unificado que não perde pedidos." },
            ].map((item) => (
              <div key={item.title} className="glass-card rounded-2xl p-6">
                <div className="h-1 w-12 rounded-full accent-line mb-4" />
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm text-slate-300">{item.text}</p>
              </div>
            ))}
          </section>

          <section className="mt-20 grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-6">
              <h2 className="font-display text-4xl text-white">Três interfaces. Um único motor.</h2>
              <p className="text-slate-300">
                Controle centralizado com experiências específicas para cada canal. Tudo conversa com o mesmo core,
                com visão instantânea de estoque, pedidos e clientes.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { title: "PDV inteligente", text: "Vendas rápidas no balcão com baixa fricção." },
                  { title: "E-commerce premium", text: "Vitrine e checkout alinhados com a marca." },
                  { title: "WhatsApp autônomo", text: "IA treinada para responder, vender e confirmar." },
                  { title: "Painel executivo", text: "Indicadores em tempo real para decisões instantâneas." },
                ].map((card) => (
                  <div key={card.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-white font-semibold">{card.title}</p>
                    <p className="mt-2 text-sm text-slate-300">{card.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-3xl p-8 space-y-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Blueprint operacional</p>
              {[
                { step: "01", title: "Capture", text: "Pedido chega de qualquer canal." },
                { step: "02", title: "Sincronize", text: "Estoque atualizado e reservado." },
                { step: "03", title: "Confirme", text: "Pagamento validado em segundos." },
                { step: "04", title: "Entregue", text: "Fulfillment orquestrado." },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4 border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
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
              { title: "Segurança de operação", text: "JWT, auditoria completa e rastreio de eventos por usuário." },
              { title: "Performance tática", text: "Cache de alto desempenho e filas inteligentes." },
              { title: "Expansão imediata", text: "Arquitetura multi-tenant pronta para escala." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm text-slate-300">{item.text}</p>
              </div>
            ))}
          </section>

          <section className="mt-20">
            <div className="glass-card rounded-[32px] px-8 py-10 md:flex md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pronto para dominar</p>
                <h2 className="font-display text-4xl text-white mt-3">Sua marca no centro do comércio unificado.</h2>
                <p className="mt-4 text-slate-300 max-w-xl">
                  Ative novos canais sem fricção, mantenha o estoque blindado e transforme atendimento em vendas.
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
              <p>UCM Platform • Versão 1.0</p>
              <p>Operacional, auditável, pronto para escala.</p>
            </div>
          </footer>
        </div>
      </div>
    </main>
  )
}
