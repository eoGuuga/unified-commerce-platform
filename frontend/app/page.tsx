'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, MessageCircle, Heart, Zap, Package, BarChart3, Users, Receipt, Check, Sparkles, MousePointer2, ChevronDown, ShieldCheck, Clock4, TrendingUp, Boxes, Bell, ShoppingBag, X } from 'lucide-react';
import { ScrollReveal, ScrollParallax, ScrollCountUp, WhatsAppMockup, MetricCard, MóduloVisual, TimelineStep, AvatarGradiente, PlanoDestaque, BotaoMicro, ScrollHint } from '@/components/landing/Animations';

/**
 * Landing page GTSoftHub - 10/10.
 * Cada detalhe intencional: copy autoexplicativa, animações sutis,
 * mockup WhatsApp como protagonista, ícones visuais, micro-interações.
 */

type VisualType = 'loja' | 'pdv' | 'admin' | 'estoque';

const modules: Array<{
  number: string;
  icon: typeof Package;
  visual: VisualType;
  title: string;
  headline: string;
  description: string;
  href: string;
  tags: string[];
}> = [
  {
    number: '01',
    icon: Package,
    visual: 'loja',
    title: 'Loja',
    headline: 'Sua vitrine na internet, aberta 24 horas.',
    description: 'O cliente vê o que tem, escolhe, paga, recebe. Sem ligar, sem esperar. Funciona enquanto você dorme.',
    href: '/loja',
    tags: ['Vitrine online', 'Vendas automáticas'],
  },
  {
    number: '02',
    icon: Receipt,
    visual: 'pdv',
    title: 'PDV',
    headline: 'O caixa que entende o que está acontecendo.',
    description: 'Quando o cliente chega na loja, você sabe o que vendeu online, o que entrou, o que precisa repor. Tudo junto.',
    href: '/pdv',
    tags: ['Atendimento', 'Controle em tempo real'],
  },
  {
    number: '03',
    icon: BarChart3,
    visual: 'admin',
    title: 'Admin',
    headline: 'A visão geral do seu negócio, numa tela só.',
    description: 'Vendas, clientes, produtos, canais. Sem planilha, sem montagem. Você abre, entende, decide.',
    href: '/admin',
    tags: ['Relatórios', 'Decisão com dados'],
  },
  {
    number: '04',
    icon: Boxes,
    visual: 'estoque',
    title: 'Estoque',
    headline: 'Nunca mais perder venda por falta de produto.',
    description: 'O sistema avisa antes de acabar. Você compra no tempo certo, na quantidade certa.',
    href: '/admin/estoque',
    tags: ['Reposição', 'Sem ruptura'],
  },
];

const whatsappFeatures = [
  {
    icon: MessageCircle,
    title: 'Atende sozinho',
    description: 'O cliente manda "oi" no WhatsApp às 3 da manhã? O bot responde, mostra produtos, fecha a venda. Você só acorda pra embalar.',
  },
  {
    icon: Heart,
    title: 'Lembra de tudo',
    description: 'O bot sabe o que o cliente já comprou, o que ele curtiu, o que ele estava procurando. A conversa não começa do zero toda vez.',
  },
  {
    icon: Zap,
    title: 'Vende no automático',
    description: 'Quando o cliente decide, o bot processa o pedido, gera o pagamento, avisa o estoque. Você só envia.',
  },
];

const principios = [
  { k: '01', t: 'Tudo conectado', d: 'Loja, caixa, WhatsApp e painel usam a mesma informação. Sem divergência, sem retrabalho.' },
  { k: '02', t: 'Cliente lembrado', d: 'Cada interação carrega o histórico. A equipe sabe quem é a pessoa, o que ela quer, o que ela já levou.' },
  { k: '03', t: 'Você no controle', d: 'O sistema cuida do operacional. Você cuida da estratégia. Reunião pra entender o que aconteceu ontem não existe mais.' },
];

const etapas = [
  { dia: '01', t: 'Diagnóstico', d: 'Entendemos sua operação, seus produtos, seu volume. Nada de "template genérico".' },
  { dia: '02', t: 'Configuração', d: 'Importamos seus produtos, configuramos o bot de WhatsApp, ligamos tudo ao seu estoque.' },
  { dia: '03', t: 'Treinamento', d: 'Ensinamos sua equipe a usar. Em vídeo, ao vivo, no ritmo deles. Sem pressa.' },
  { dia: '04', t: 'Operação', d: 'Você atende pela loja, pelo site, pelo WhatsApp. Tudo no mesmo painel.' },
];

const planos = [
  {
    nome: 'Começar',
    preco: 'R$ 197',
    periodo: '/mês',
    descricao: 'Para quem está validando o modelo e quer parar de controlar tudo no caderno.',
    destaque: false,
    cta: 'Começar 14 dias grátis',
    ctaIcon: ArrowRight,
    features: [
      'Loja online com até 100 produtos',
      'PDV com 1 caixa',
      'Bot de WhatsApp (100 conversas/mês)',
      'Painel admin básico',
      'Suporte por e-mail',
    ],
  },
  {
    nome: 'Crescer',
    preco: 'R$ 497',
    periodo: '/mês',
    descricao: 'Para quem já vende e quer profissionalizar a operação sem perder o controle.',
    destaque: true,
    badge: 'Mais escolhido',
    cta: 'Assinar Crescer',
    ctaIcon: Sparkles,
    features: [
      'Loja online com produtos ilimitados',
      'PDV com até 5 caixas',
      'Bot de WhatsApp ilimitado',
      'Painel admin avançado com relatórios',
      'Estoque com reposição automática',
      'Suporte por WhatsApp em horário comercial',
    ],
  },
  {
    nome: 'Escalar',
    preco: 'R$ 1.297',
    periodo: '/mês',
    descricao: 'Para operações com várias lojas, alto volume ou necessidade de integrações.',
    destaque: false,
    cta: 'Falar com vendas',
    ctaIcon: MessageCircle,
    features: [
      'Tudo do plano Crescer',
      'PDV com caixas ilimitados',
      'Multi-loja (matriz + filiais)',
      'API e integrações personalizadas',
      'Gerente de conta dedicado',
      'Suporte 24/7',
    ],
  },
];

const garantias = [
  { icon: ShieldCheck, t: '14 dias grátis', d: 'Sem cartão, sem compromisso' },
  { icon: Clock4, t: 'Setup em 15 dias', d: 'A gente configura tudo' },
  { icon: TrendingUp, t: 'Cancele quando quiser', d: 'Sem multa, sem letra miúda' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#1a1814]">
      {/* TOP BAR */}
      <header className="border-b border-[#1a1814]/8 bg-[#f6f3ee]/85 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 transition-transform duration-300 hover:scale-[1.02]">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1a1814] text-[11px] font-semibold tracking-[0.04em] text-[#f6f3ee]">
              GT
            </div>
            <span className="text-[15px] font-medium tracking-[-0.01em]" style={{ fontFamily: 'var(--font-display)' }}>
              GTSoftHub
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {[
              { href: '#whatsapp', label: 'WhatsApp' },
              { href: '#modulos', label: 'Módulos' },
              { href: '#preços', label: 'Planos' },
              { href: '#depoimentos', label: 'Histórias' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="link-underline text-[13px] font-medium tracking-[0.01em] text-[#1a1814]/70 transition-colors duration-300 hover:text-[#1a1814]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden h-9 items-center rounded-full px-4 text-[13px] font-medium text-[#1a1814]/80 transition-colors duration-300 hover:text-[#1a1814] sm:inline-flex"
            >
              Entrar
            </Link>
            <BotaoMicro href="#preços" variant="dark" icon="right">
              Ver planos
            </BotaoMicro>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-[1320px] px-6 pb-16 pt-12 sm:pb-24 sm:pt-16 lg:pb-32 lg:pt-20">
          <div className="mb-10 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
            <span className="h-px w-8 bg-[#1a1814]/30" />
            <span>Plataforma de varejo</span>
            <span>·</span>
            <span>2026</span>
          </div>

          <h1
            className="max-w-5xl text-[clamp(2.75rem,7vw,6.5rem)] font-normal leading-[0.95] tracking-[-0.04em] text-[#1a1814]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Vender em qualquer canal, como se fosse <em className="text-[#b8654a]">tudo um só</em>.
          </h1>

          <div className="mt-12 grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
            <p className="max-w-2xl text-[18px] leading-[1.55] text-[#1a1814]/75 sm:text-[20px]">
              A GTSoftHub une sua loja física, sua vitrine online, seu caixa e seu WhatsApp numa operação só. Estoque, vendas e atendimento conversando entre si, sem você precisar montar nada.
            </p>

            <div className="grid gap-4 self-end border-t border-[#1a1814]/15 pt-6 sm:grid-cols-3">
              {[
                { t: 'Estoque único', d: 'Loja, PDV, WhatsApp' },
                { t: '4 canais', d: 'Físico, online, app, bot' },
                { t: 'Bot 24/7', d: 'WhatsApp automático' },
              ].map((m) => (
                <div
                  key={m.t}
                  className="group transition-transform duration-500 hover:-translate-y-0.5"
                >
                  <p
                    className="text-[20px] font-normal leading-none tracking-[-0.03em] text-[#1a1814] sm:text-[24px]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {m.t}
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#1a1814]/55">
                    {m.d}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
            <BotaoMicro href="#preços" variant="dark" icon="right" size="lg">
              Quero isso no meu negócio
            </BotaoMicro>
            <BotaoMicro href="#whatsapp" variant="outline" icon="up-right" size="lg">
              Conhecer o bot de WhatsApp
            </BotaoMicro>
          </div>
        </div>

        {/* Hero image - WHATSAPP MOCKUP GRANDE */}
        <ScrollReveal>
          <div className="mx-auto max-w-[1320px] px-6 pb-20">
            <div className="group relative aspect-[16/8] overflow-hidden rounded-[2px] border border-[#1a1814]/8 transition-transform duration-700 hover:scale-[1.005]">
              {/* Background com gradiente sutil */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#e8d5c4] via-[#d4b896] to-[#8b6f47]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.25),transparent_60%)]" />

              <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10 md:p-12">
                <div className="flex items-start justify-between text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/60">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    WhatsApp · Bot ativo agora
                  </span>
                  <span className="hidden sm:inline">GTSoftHub · Demonstração real</span>
                </div>

                <div className="grid gap-4 sm:gap-6 sm:grid-cols-[1.3fr_1fr] sm:items-end">
                  <WhatsAppMockup />

                  <div className="hidden self-end sm:block">
                    <p className="text-[20px] leading-[1.15] tracking-[-0.02em] text-[#1a1814] sm:text-[26px] md:text-[32px]" style={{ fontFamily: 'var(--font-display)' }}>
                      Vendas que acontecem enquanto você <em className="text-[#b8654a]">dorme</em>, viaja ou almoça.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Scroll hint */}
        <ScrollHint />
      </section>

      {/* WHATSAPP - DESTAQUE PRINCIPAL */}
      <section id="whatsapp" className="border-t border-[#1a1814]/8 bg-[#1a1814] py-20 text-[#f6f3ee] sm:py-28">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="mb-16 grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <ScrollReveal>
              <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[#b8654a]">
                <span className="h-px w-8 bg-[#b8654a]" />
                O diferencial da plataforma
              </p>
              <h2 className="mt-5 max-w-3xl text-[clamp(2.25rem,5vw,4rem)] font-normal leading-[1] tracking-[-0.04em] text-[#f6f3ee]" style={{ fontFamily: 'var(--font-display)' }}>
                Um <em className="text-[#b8654a]">vendedor</em> que nunca dorme, nunca esquece e nunca pede aumento.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <p className="max-w-md text-[16px] leading-[1.55] text-[#f6f3ee]/65">
                É o bot de WhatsApp da GTSoftHub. Ele conversa com seus clientes como se fosse você, mas está disponível 24 horas, não erra o estoque e fecha a venda sozinho.
              </p>
            </ScrollReveal>
          </div>

          <div className="grid gap-px bg-[#f6f3ee]/10 sm:grid-cols-3">
            {whatsappFeatures.map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 150}>
                <div className="group relative bg-[#1a1814] p-8 transition-all duration-500 hover:bg-[#25221c] sm:p-10">
                  <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-full border border-[#f6f3ee]/15 bg-[#f6f3ee]/5 transition-all duration-500 group-hover:scale-110 group-hover:border-[#b8654a]/40 group-hover:bg-[#b8654a]/10">
                    <f.icon className="h-5 w-5 text-[#b8654a]" strokeWidth={1.4} />
                  </div>
                  <h3 className="text-[24px] font-normal leading-[1.15] tracking-[-0.02em] text-[#f6f3ee]" style={{ fontFamily: 'var(--font-display)' }}>
                    {f.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-[1.55] text-[#f6f3ee]/60">
                    {f.description}
                  </p>
                  <div className="mt-6 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#f6f3ee]/40">
                    <Check className="h-3 w-3 text-[#b8654a]" />
                    Disponível 24/7
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={300}>
            <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <BotaoMicro href="#preços" variant="accent" icon="right">
                Ativar bot no meu WhatsApp
              </BotaoMicro>
              <Link
                href="#modulos"
                className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#f6f3ee]/55 transition-colors duration-300 hover:text-[#f6f3ee]"
              >
                Ver os outros módulos
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* MÓDULOS - COM VISUAIS */}
      <section id="modulos" className="border-t border-[#1a1814]/8 bg-[#f6f3ee] py-20 sm:py-28">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="mb-16 grid items-end gap-6 lg:grid-cols-[1fr_1fr]">
            <ScrollReveal>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Módulos</p>
              <h2 className="mt-4 max-w-2xl text-[clamp(2rem,4vw,3.25rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
                Quatro módulos que <em className="text-[#b8654a]">conversam entre si</em>.
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={150}>
              <p className="max-w-md text-[15px] leading-[1.55] text-[#1a1814]/65">
                Cada módulo resolve uma parte do seu dia. Mas o que faz a diferença é eles conversarem entre si — você não precisa digitar a mesma coisa em três lugares.
              </p>
            </ScrollReveal>
          </div>

          <div className="grid gap-px bg-[#1a1814]/8 sm:grid-cols-2">
            {modules.map((m, i) => (
              <ScrollReveal key={m.number} delay={i * 100}>
                <Link
                  href={m.href}
                  className="group relative block overflow-hidden rounded-[3px] border border-[#1a1814]/8 bg-[#f6f3ee] p-8 transition-all duration-500 hover:border-[#1a1814]/20 hover:bg-[#efe9df] sm:p-10"
                >
                  <div className="pointer-events-none absolute -right-2 -top-3 select-none text-[120px] font-normal leading-none text-[#1a1814]/[0.05] transition-all duration-700 ease-out group-hover:-translate-y-1 group-hover:text-[#1a1814]/[0.08]" style={{ fontFamily: 'var(--font-display)' }}>
                    {m.number}
                  </div>

                  {/* Visual SVG no topo */}
                  <MóduloVisual tipo={m.visual} />

                  <div className="relative mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1a1814]/10 bg-[#f6f3ee] transition-all duration-500 group-hover:scale-110 group-hover:border-[#b8654a]/40 group-hover:bg-[#b8654a]/10">
                        <m.icon className="h-4 w-4 text-[#1a1814] transition-colors duration-500 group-hover:text-[#b8654a]" strokeWidth={1.4} />
                      </div>
                      <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
                        {m.number} · {m.title}
                      </span>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-[#1a1814]/30 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#1a1814]/70" />
                  </div>

                  <h3 className="relative mb-4 text-[28px] font-normal leading-[1.1] tracking-[-0.02em] text-[#1a1814] sm:text-[32px]" style={{ fontFamily: 'var(--font-display)' }}>
                    {m.headline}
                  </h3>

                  <p className="relative mb-6 max-w-md text-[15px] leading-[1.55] text-[#1a1814]/70">
                    {m.description}
                  </p>

                  <div className="relative flex flex-wrap gap-1.5">
                    {m.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[#1a1814]/15 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-[#1a1814]/65"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA - TIMELINE */}
      <section className="border-t border-[#1a1814]/8 bg-[#1a1814] py-20 text-[#f6f3ee] sm:py-28">
        <div className="mx-auto max-w-[1320px] px-6">
          <ScrollReveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#b8654a]">Como funciona</p>
            <h2 className="mt-4 max-w-3xl text-[clamp(2rem,4vw,3.25rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#f6f3ee]" style={{ fontFamily: 'var(--font-display)' }}>
              Você não precisa ser técnico.
            </h2>
            <p className="mt-6 max-w-2xl text-[16px] leading-[1.55] text-[#f6f3ee]/65">
              Em 15 dias sua operação está rodando. A gente cuida de configurar tudo, importar seus produtos e treinar sua equipe. Você só usa.
            </p>
          </ScrollReveal>

          {/* Timeline com linha conectora */}
          <div className="mt-20 grid gap-px bg-[#f6f3ee]/10 sm:grid-cols-2 lg:grid-cols-4">
            {etapas.map((step, i) => (
              <ScrollReveal key={step.dia} delay={i * 100}>
                <TimelineStep dia={step.dia} titulo={step.t} descricao={step.d} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRINCÍPIOS */}
      <section id="principios" className="border-t border-[#1a1814]/8 bg-[#f6f3ee] py-20 sm:py-28">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <ScrollReveal>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Princípios</p>
              <h2 className="mt-4 text-[clamp(2rem,4vw,3.25rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
                Três coisas que a gente não negocia.
              </h2>
            </ScrollReveal>

            <div className="space-y-10">
              {principios.map((p, i) => (
                <ScrollReveal key={p.k} delay={i * 100}>
                  <div className="group grid grid-cols-[auto_1fr] gap-6 border-t border-[#1a1814]/15 pt-6 transition-colors duration-500 hover:border-[#b8654a]/30">
                    <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#b8654a]">{p.k}</span>
                    <div>
                      <h3 className="text-[24px] font-normal leading-[1.2] tracking-[-0.02em] text-[#1a1814] transition-colors duration-300 group-hover:text-[#b8654a]" style={{ fontFamily: 'var(--font-display)' }}>
                        {p.t}
                      </h3>
                      <p className="mt-3 text-[15px] leading-[1.55] text-[#1a1814]/65">
                        {p.d}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HONESTIDADE - o que você precisa saber antes de assinar */}
      <section id="depoimentos" className="border-t border-[#1a1814]/8 bg-[#efe9df] py-20 sm:py-28">
        <div className="mx-auto max-w-[1320px] px-6">
          <ScrollReveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
              Antes de você assinar
            </p>
            <h2 className="mt-4 max-w-3xl text-[clamp(2rem,4vw,3.25rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
              O que a gente <em className="text-[#b8654a]">não</em> te conta nos outros sites.
            </h2>
          </ScrollReveal>

          <div className="mt-12 grid gap-px bg-[#1a1814]/8 sm:grid-cols-2">
            {/* O que SIM fazemos */}
            <div className="bg-[#f6f3ee] p-8 sm:p-10">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-4 w-4 text-emerald-700" strokeWidth={2.5} />
                </div>
                <h3 className="text-[20px] font-normal leading-[1.1] tracking-[-0.01em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
                  O que a gente faz
                </h3>
              </div>

              <ul className="space-y-3">
                {[
                  'Unifica estoque, PDV, loja online e WhatsApp numa operação só',
                  'Bot de WhatsApp responde cliente 24/7 e fecha vendas sozinho',
                  'Setup assistido em 15 dias pela nossa equipe (sem você configurar nada)',
                  'Suporte humano em português, não chatbot',
                  'Sem fidelidade. Cancele quando quiser, sem multa',
                  '14 dias grátis pra você testar antes de pagar qualquer coisa',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[14px] text-[#1a1814]/80">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" strokeWidth={2.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Como a gente trabalha - honesto e confiante */}
            <div className="bg-[#f6f3ee] p-8 sm:p-10">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1814]/10">
                  <Check className="h-4 w-4 text-[#1a1814]" strokeWidth={2.5} />
                </div>
                <h3 className="text-[20px] font-normal leading-[1.1] tracking-[-0.01em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
                  Como a gente trabalha
                </h3>
              </div>

              <ul className="space-y-3">
                {[
                  'Resultados dependem do seu negócio — a gente dá as ferramentas, você opera',
                  'A gente só mostra foto de cliente com autorização explícita',
                  'Os números que você vê no site são os números reais da plataforma',
                  'Histórias que compartilhamos vêm de clientes que topam contar',
                  'Time brasileiro te atende em horário comercial, em português',
                  'A gente é pra quem quer construir uma operação, não pra quem quer atalhos',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[14px] text-[#1a1814]/80">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1a1814]" strokeWidth={2.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <ScrollReveal delay={200}>
            <p className="mt-10 text-center text-[14px] text-[#1a1814]/70">
              A gente prefere perder uma venda por ser honesto do que ganhar uma por mentir.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* PLANOS E PREÇOS - DESTAQUE FORTE */}
      <section id="preços" className="border-t border-[#1a1814]/8 bg-[#f6f3ee] py-20 sm:py-28">
        <div className="mx-auto max-w-[1320px] px-6">
          <ScrollReveal>
            <div className="text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Planos</p>
              <h2 className="mt-4 mx-auto max-w-2xl text-[clamp(2rem,4vw,3.25rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
                Comece pequeno, cresça quando precisar.
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.55] text-[#1a1814]/65">
                Sem fidelidade. Sem setup caro. Você paga pelo que usa e cancela quando quiser.
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-16 grid items-stretch gap-6 lg:grid-cols-3">
            {planos.map((plano, i) => (
              <ScrollReveal key={plano.nome} delay={i * 150} className={plano.destaque ? 'lg:-mt-6' : ''}>
                <PlanoDestaque plano={plano} />
              </ScrollReveal>
            ))}
          </div>

          {/* Garantias inline */}
          <ScrollReveal delay={300}>
            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {garantias.map((g) => (
                <div
                  key={g.t}
                  className="flex items-start gap-3 border-t border-[#1a1814]/15 pt-5"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[#1a1814]/15 bg-[#f6f3ee]">
                    <g.icon className="h-4 w-4 text-[#b8654a]" strokeWidth={1.4} />
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-[#1a1814]">{g.t}</p>
                    <p className="mt-0.5 text-[12px] text-[#1a1814]/55">{g.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* CTA FINAL + FOOTER */}
      <section className="border-t border-[#1a1814]/8 bg-[#f6f3ee]">
        <div className="mx-auto max-w-[1320px] px-6 py-24 sm:py-32">
          <ScrollReveal>
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Última coisa</p>
              <h2 className="mt-6 text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[1] tracking-[-0.03em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
                Pronto para <em className="text-[#b8654a]">vender mais</em> com menos esforço?
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.55] text-[#1a1814]/70 sm:text-[18px]">
                Comece com 14 dias de teste grátis. Sem cartão, sem compromisso, sem ligação de comercial insistindo.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <BotaoMicro href="#preços" variant="dark" icon="right" size="lg">
                  Começar 14 dias grátis
                </BotaoMicro>
                <BotaoMicro href="/loja" variant="outline" icon="up-right" size="lg">
                  Ver a loja funcionando
                </BotaoMicro>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Footer expandido */}
        <div className="border-t border-[#1a1814]/8 bg-[#1a1814] py-12 text-[#f6f3ee]">
          <div className="mx-auto max-w-[1320px] px-6">
            <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
              <div className="sm:col-span-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-[#f6f3ee] text-[10px] font-semibold text-[#1a1814]">GT</div>
                  <span className="text-[15px] font-medium tracking-[-0.01em] text-[#f6f3ee]" style={{ fontFamily: 'var(--font-display)' }}>GTSoftHub</span>
                </div>
                <p className="mt-4 max-w-sm text-[13px] leading-[1.55] text-[#f6f3ee]/60">
                  Plataforma premium para varejo omnichannel. Estoque, PDV, loja online e atendimento num só ecossistema.
                </p>
              </div>

              <div>
                <h4 className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#f6f3ee]/50">Plataforma</h4>
                <ul className="mt-4 space-y-2 text-[13px]">
                  <li><Link href="/loja" className="text-[#f6f3ee]/75 transition-colors duration-300 hover:text-[#f6f3ee]">Loja</Link></li>
                  <li><Link href="/pdv" className="text-[#f6f3ee]/75 transition-colors duration-300 hover:text-[#f6f3ee]">PDV</Link></li>
                  <li><Link href="/admin" className="text-[#f6f3ee]/75 transition-colors duration-300 hover:text-[#f6f3ee]">Admin</Link></li>
                  <li><Link href="/admin/estoque" className="text-[#f6f3ee]/75 transition-colors duration-300 hover:text-[#f6f3ee]">Estoque</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#f6f3ee]/50">Conta</h4>
                <ul className="mt-4 space-y-2 text-[13px]">
                  <li><Link href="/login" className="text-[#f6f3ee]/75 transition-colors duration-300 hover:text-[#f6f3ee]">Entrar</Link></li>
                  <li><Link href="#preços" className="text-[#f6f3ee]/75 transition-colors duration-300 hover:text-[#f6f3ee]">Planos</Link></li>
                  <li><Link href="/info/privacidade" className="text-[#f6f3ee]/75 transition-colors duration-300 hover:text-[#f6f3ee]">Privacidade</Link></li>
                  <li><Link href="/info/termos" className="text-[#f6f3ee]/75 transition-colors duration-300 hover:text-[#f6f3ee]">Termos</Link></li>
                </ul>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-3 border-t border-[#f6f3ee]/10 pt-6 text-[11px] uppercase tracking-[0.16em] text-[#f6f3ee]/40 sm:flex-row sm:items-center sm:justify-between">
              <span>© 2026 GTSoftHub</span>
              <span>gtsofthub.com.br</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA STICKY MOBILE - só aparece em telas pequenas */}
      <div className="fixed bottom-4 left-4 right-4 z-50 sm:hidden">
        <Link
          href="#preços"
          className="group flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#1a1814] text-[14px] font-medium text-[#f6f3ee] shadow-[0_12px_32px_-8px_rgba(26,24,20,0.5)] transition-all duration-300 active:scale-[0.98]"
        >
          Começar 14 dias grátis
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>

      {/* Espaçador para o CTA sticky não cobrir conteúdo em mobile */}
      <div className="h-20 sm:hidden" />
    </div>
  );
}
