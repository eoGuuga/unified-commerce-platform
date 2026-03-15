import Link from "next/link"
import { Container } from "@/components/landing/Container"

const proofMetrics = [
  { value: "1 estoque", label: "fonte de verdade entre PDV, loja, WhatsApp e operacao interna" },
  { value: "0 ruido", label: "para o empreendedor que precisa vender com clareza, ritmo e previsibilidade" },
  { value: "24/7", label: "de leitura operacional para saber o que vender, repor e acelerar" },
]

const moduleCards = [
  {
    title: "Loja online que converte",
    description:
      "Vitrine elegante, catalogo claro e checkout com leitura de disponibilidade para vender com mais confianca.",
    eyebrow: "Storefront",
    href: "/loja",
    detail: "Perfeito para encantar no primeiro clique.",
  },
  {
    title: "PDV que flui no ritmo da operacao",
    description:
      "Caixa, carrinho, pagamento e estoque trabalhando juntos para a equipe vender rapido sem perder controle.",
    eyebrow: "Point of sale",
    href: "/pdv",
    detail: "Ideal para atendimento presencial sem atrito.",
  },
  {
    title: "Comando central para o dono",
    description:
      "Visao executiva de vendas, canais, pipeline e produtos para tomar decisoes sem adivinhacao.",
    eyebrow: "Command center",
    href: "/admin",
    detail: "Leitura imediata do que cresce, trava e precisa de acao.",
  },
  {
    title: "Estoque tratado como ativo estrategico",
    description:
      "Ajustes, risco, minimo e reposicao em uma experiencia pensada para evitar falhas e aumentar confianca.",
    eyebrow: "Inventory intelligence",
    href: "/admin/estoque",
    detail: "Menos ruptura, menos excesso, mais margem.",
  },
]

const operatingMoments = [
  {
    title: "Receba pedidos sem medo",
    description:
      "A mesma venda pode nascer no WhatsApp, na loja online ou no caixa. O sistema organiza tudo como uma operacao so.",
  },
  {
    title: "Saiba o que precisa acontecer agora",
    description:
      "Os sinais de estoque, venda e canal aparecem com leitura executiva para a equipe agir rapido e com criterio.",
  },
  {
    title: "Cresca sem parecer improviso",
    description:
      "O cliente percebe consistencia. O empreendedor percebe controle. A operacao ganha escala com mais serenidade.",
  },
]

const launchTracks = [
  {
    step: "01",
    title: "Diagnostico da operacao",
    description:
      "Mapeamos seus canais, estoque, gargalos e rituais para transformar tecnologia em vantagem real de negocio.",
  },
  {
    step: "02",
    title: "Configuracao do ecossistema",
    description:
      "Conectamos os modulos certos para o seu momento: loja, PDV, automacao, estoque e monitoramento.",
  },
  {
    step: "03",
    title: "Ritmo de evolucao continua",
    description:
      "Depois de entrar no ar, a plataforma vira alavanca permanente para melhorar conversao, operacao e experiencia.",
  },
]

const confidenceSignals = [
  "Estoque unico entre canais",
  "Leitura executiva para o dono",
  "Experiencia de compra e operacao no mesmo nivel",
]

function ArrowIcon() {
  return (
    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 mesh-gradient opacity-60" />
        <div className="absolute inset-0 grid-pattern-fade opacity-25" />
        <div className="absolute left-1/2 top-0 h-[560px] w-[920px] -translate-x-1/2 rounded-full bg-accent/10 blur-[140px]" />
        <div className="absolute -left-20 top-48 h-72 w-72 rounded-full bg-accent-secondary/10 blur-[120px]" />

        <header className="sticky top-0 z-40 border-b border-white/6 bg-background/72 backdrop-blur-xl">
          <Container className="py-4">
            <div className="flex items-center justify-between gap-6">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/92 text-sm font-semibold tracking-[0.26em] text-slate-950 shadow-[0_18px_60px_-32px_rgba(255,255,255,0.85)]">
                  GT
                </div>
                <div>
                  <p className="text-base font-semibold tracking-tight text-white">GTSoftHub</p>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Retail operating system</p>
                </div>
              </Link>

              <nav className="hidden items-center gap-8 text-sm text-slate-300 lg:flex">
                <Link href="#modulos" className="transition-colors hover:text-white">
                  Modulos
                </Link>
                <Link href="#jornada" className="transition-colors hover:text-white">
                  Jornada
                </Link>
                <Link href="#impacto" className="transition-colors hover:text-white">
                  Impacto
                </Link>
                <Link href="#demo" className="transition-colors hover:text-white">
                  Demonstracao
                </Link>
              </nav>

              <div className="flex items-center gap-3">
                <Link href="/login" className="hidden text-sm text-slate-300 transition-colors hover:text-white sm:inline-flex">
                  Entrar
                </Link>
                <Link href="#demo" className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
                  Ver a plataforma
                </Link>
              </div>
            </div>
          </Container>
        </header>

        <main>
          <section className="relative pb-20 pt-14 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24">
            <Container>
              <div className="grid gap-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)] lg:items-center">
                <div className="max-w-3xl">
                  <div className="animate-slide-up opacity-0">
                    <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.28em] text-accent">
                      Plataforma premium para varejo
                    </span>
                  </div>

                  <h1 className="animate-slide-up mt-7 max-w-4xl text-5xl font-semibold leading-[0.92] tracking-[-0.05em] text-white opacity-0 sm:text-6xl lg:text-7xl xl:text-[5.4rem]" style={{ animationDelay: "0.1s" }}>
                    O sistema que faz cada canal vender como se toda a operacao respirasse em unissono.
                  </h1>

                  <p className="animate-slide-up mt-8 max-w-2xl text-lg leading-8 text-slate-300 opacity-0 sm:text-xl" style={{ animationDelay: "0.18s" }}>
                    GTSoftHub transforma estoque, PDV, loja online e atendimento em uma experiencia unica de controle, beleza e fluidez para o empreendedor que nao aceita improviso.
                  </p>

                  <div className="animate-slide-up mt-10 flex flex-col gap-4 opacity-0 sm:flex-row" style={{ animationDelay: "0.26s" }}>
                    <Link href="/login" className="group inline-flex h-14 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
                      Entrar no ecossistema
                      <ArrowIcon />
                    </Link>
                    <Link href="/loja" className="inline-flex h-14 items-center justify-center rounded-full border border-white/12 bg-white/6 px-7 text-sm font-semibold text-white transition hover:border-white/24 hover:bg-white/10">
                      Explorar a vitrine ao vivo
                    </Link>
                  </div>

                  <div className="animate-slide-up mt-10 flex flex-wrap gap-3 opacity-0" style={{ animationDelay: "0.34s" }}>
                    {confidenceSignals.map((signal) => (
                      <div
                        key={signal}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
                      >
                        <span className="h-2 w-2 rounded-full bg-accent" />
                        {signal}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="animate-slide-up relative opacity-0 lg:pl-6" style={{ animationDelay: "0.42s" }}>
                  <div className="absolute -inset-4 rounded-[2rem] bg-white/6 blur-3xl" />
                  <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(14,17,20,0.96),rgba(6,8,11,0.98))] shadow-[0_40px_120px_-48px_rgba(6,182,212,0.65)]">
                    <div className="flex items-center justify-between border-b border-white/8 px-6 py-5">
                      <div>
                        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Operating pulse</p>
                        <h2 className="mt-2 text-xl font-semibold text-white">Comando unificado GTSoftHub</h2>
                      </div>
                      <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                        Operacao sincronizada
                      </div>
                    </div>

                    <div className="grid gap-4 p-6 sm:grid-cols-2">
                      <div className="rounded-[1.6rem] border border-white/8 bg-white/5 p-5">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Receita viva</p>
                        <p className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white">R$ 182k</p>
                        <p className="mt-2 text-sm text-slate-300">ultima semana com crescimento puxado por loja, caixa e WhatsApp.</p>
                        <div className="mt-5 h-2 rounded-full bg-white/8">
                          <div className="h-2 w-[72%] rounded-full bg-[linear-gradient(90deg,#6ee7b7,#22d3ee)]" />
                        </div>
                      </div>

                      <div className="rounded-[1.6rem] border border-white/8 bg-white/5 p-5">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Leitura de estoque</p>
                        <div className="mt-4 space-y-3">
                          {[
                            ["Disponivel para vender", "94%", "bg-emerald-400"],
                            ["Itens em atencao", "11 SKUs", "bg-amber-300"],
                            ["Reposicao automatizada", "ativa", "bg-cyan-300"],
                          ].map(([label, value, color]) => (
                            <div key={label} className="flex items-center justify-between rounded-2xl border border-white/8 bg-slate-950/40 px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                                <span className="text-sm text-slate-200">{label}</span>
                              </div>
                              <span className="text-sm font-semibold text-white">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[1.6rem] border border-white/8 bg-white/5 p-5 sm:col-span-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Jornada do cliente</p>
                            <p className="mt-2 text-lg font-semibold text-white">Do primeiro clique ao recebimento sem perder contexto</p>
                          </div>
                          <div className="hidden rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 sm:block">
                            Omnichannel orchestration
                          </div>
                        </div>

                        <div className="mt-6 grid gap-3 md:grid-cols-3">
                          {[
                            ["Atracao", "Loja premium, campanhas e prova visual forte."],
                            ["Conversao", "PDV e WhatsApp com estoque fiel e decisao agil."],
                            ["Retencao", "Acompanhamento, reposicao e gestao de canal em um painel unico."],
                          ].map(([title, description]) => (
                            <div key={title} className="rounded-[1.35rem] border border-white/8 bg-slate-950/45 p-4">
                              <p className="text-sm font-semibold text-white">{title}</p>
                              <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-16 grid gap-4 md:grid-cols-3">
                {proofMetrics.map((metric, index) => (
                  <div
                    key={metric.value}
                    className="animate-slide-up rounded-[1.75rem] border border-white/8 bg-white/[0.045] p-6 opacity-0"
                    style={{ animationDelay: `${0.2 + index * 0.08}s` }}
                  >
                    <p className="text-3xl font-semibold tracking-[-0.04em] text-white">{metric.value}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{metric.label}</p>
                  </div>
                ))}
              </div>
            </Container>
          </section>

          <section id="modulos" className="border-y border-white/6 bg-white/[0.02] py-20 sm:py-24">
            <Container>
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.32em] text-accent">Modulos que conversam entre si</p>
                <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                  Cada tela foi desenhada para ser bonita aos olhos e indispensavel na rotina.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Nao existe glamour sem operacao. Por isso a plataforma une experiencia premium, clareza de decisao e disciplina de estoque em todos os pontos da jornada.
                </p>
              </div>

              <div className="mt-12 grid gap-5 lg:grid-cols-2">
                {moduleCards.map((card) => (
                  <Link
                    key={card.title}
                    href={card.href}
                    className="group rounded-[1.9rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-7 transition hover:-translate-y-1 hover:border-white/16 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))]"
                  >
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{card.eyebrow}</p>
                    <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">{card.title}</h3>
                    <p className="mt-4 text-sm leading-7 text-slate-300">{card.description}</p>
                    <div className="mt-6 flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-slate-100">{card.detail}</span>
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white transition group-hover:border-accent/40 group-hover:bg-accent/12">
                        <ArrowIcon />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </Container>
          </section>

          <section id="impacto" className="py-20 sm:py-24">
            <Container>
              <div className="grid gap-10 lg:grid-cols-[0.88fr_minmax(0,1.12fr)] lg:items-start">
                <div className="rounded-[2rem] border border-white/8 bg-white/[0.04] p-8 sm:p-10">
                  <p className="text-xs uppercase tracking-[0.32em] text-accent">O que muda na vida do empreendedor</p>
                  <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white">
                    Controle, calma e confianca viram sensacao diaria, nao promessa de software.
                  </h2>
                  <p className="mt-5 text-base leading-7 text-slate-300">
                    Quando a operacao esta realmente orquestrada, o dono para de apagar incendio e volta a construir marca, margem e relacionamento com o cliente.
                  </p>
                </div>

                <div className="grid gap-5">
                  {operatingMoments.map((moment, index) => (
                    <div
                      key={moment.title}
                      className="rounded-[1.75rem] border border-white/8 bg-slate-950/55 p-6 sm:p-7"
                    >
                      <div className="flex items-start gap-4">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-sm font-semibold text-accent">
                          0{index + 1}
                        </span>
                        <div>
                          <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">{moment.title}</h3>
                          <p className="mt-3 text-sm leading-7 text-slate-300">{moment.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Container>
          </section>

          <section id="jornada" className="border-t border-white/6 py-20 sm:py-24">
            <Container>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs uppercase tracking-[0.32em] text-accent">Jornada de implantacao</p>
                  <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                    Tecnologia bonita demais para ser superficial. Estrategia suficiente para sustentar crescimento real.
                  </h2>
                </div>
                <p className="max-w-xl text-base leading-7 text-slate-300">
                  Cada etapa foi pensada para transformar implementacao em ganho tangivel de negocio, com ritmo claro, prioridades certas e refinamento continuo.
                </p>
              </div>

              <div className="mt-12 grid gap-5 lg:grid-cols-3">
                {launchTracks.map((track) => (
                  <div key={track.step} className="rounded-[1.8rem] border border-white/8 bg-white/[0.035] p-7">
                    <p className="text-sm font-semibold tracking-[0.24em] text-accent">{track.step}</p>
                    <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-white">{track.title}</h3>
                    <p className="mt-4 text-sm leading-7 text-slate-300">{track.description}</p>
                  </div>
                ))}
              </div>
            </Container>
          </section>

          <section id="demo" className="pb-24 pt-6 sm:pb-28">
            <Container>
              <div className="relative overflow-hidden rounded-[2.4rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-8 shadow-[0_32px_120px_-48px_rgba(34,211,238,0.55)] sm:p-10 lg:p-12">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(110,231,183,0.15),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.16),transparent_38%)]" />
                <div className="relative grid gap-8 lg:grid-cols-[1.15fr_minmax(320px,0.85fr)] lg:items-center">
                  <div className="max-w-3xl">
                    <p className="text-xs uppercase tracking-[0.32em] text-accent">Demonstracao guiada</p>
                    <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                      Se a meta e emocionar o cliente final e devolver paz ao empreendedor, a plataforma precisa ser sentida ao vivo.
                    </h2>
                    <p className="mt-5 text-base leading-7 text-slate-200">
                      Entre na operacao, explore a vitrine, acompanhe o painel e veja como GTSoftHub transforma rotina, imagem e decisao em uma unica experiencia de crescimento.
                    </p>
                  </div>

                  <div className="rounded-[2rem] border border-white/12 bg-slate-950/55 p-6">
                    <div className="space-y-3">
                      {[
                        "Ver a vitrine premium funcionando",
                        "Sentir o PDV e o painel no mesmo ecossistema",
                        "Entender como estoque e canais viram uma so decisao",
                      ].map((item) => (
                        <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent" />
                          <span className="text-sm leading-6 text-slate-200">{item}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                      <Link href="/login" className="group inline-flex h-14 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
                        Entrar agora
                        <ArrowIcon />
                      </Link>
                      <Link href="/loja" className="inline-flex h-14 items-center justify-center rounded-full border border-white/12 bg-white/6 px-6 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10">
                        Ver a loja ao vivo
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              <footer className="mt-12 flex flex-col gap-6 border-t border-white/8 pt-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-slate-200">GTSoftHub</p>
                  <p className="mt-1">Operacao premium para varejo omnichannel sem overselling.</p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <Link href="/login" className="transition-colors hover:text-white">
                    Login
                  </Link>
                  <Link href="/loja" className="transition-colors hover:text-white">
                    Loja
                  </Link>
                  <Link href="/pdv" className="transition-colors hover:text-white">
                    PDV
                  </Link>
                  <Link href="/admin" className="transition-colors hover:text-white">
                    Admin
                  </Link>
                </div>
              </footer>
            </Container>
          </section>
        </main>
      </div>
    </div>
  )
}
