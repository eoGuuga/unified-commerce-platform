'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, MessageCircle, Sparkles, Shield, Zap, Heart, Package, BarChart3, Users, Receipt, Check } from 'lucide-react';

/**
 * Landing page GTSoftHub - design editorial/magazine premium.
 * - Tipografia: Fraunces (display serif) + Geist (body sans)
 * - Paleta: off-white + preto + cobre
 * - Animações sutis: fade-in stagger, hover lift, scroll-reveal
 * - Copy autoexplicativa (sem jargão técnico)
 */

const proofMetrics = [
  { v: '1', l: 'Estoque único' },
  { v: '4', l: 'Canais' },
  { v: '24/7', l: 'Atendendo' },
];

const modules = [
  {
    number: '01',
    title: 'Loja',
    headline: 'Sua vitrine na internet, aberta 24 horas.',
    description: 'O cliente vê o que tem, escolhe, paga, recebe. Sem ligar, sem esperar. Funciona enquanto você dorme.',
    href: '/loja',
    tags: ['Vitrine online', 'Vendas automáticas'],
  },
  {
    number: '02',
    title: 'PDV',
    headline: 'O caixa que entende o que está acontecendo.',
    description: 'Quando o cliente chega na loja, você sabe o que vendeu online, o que entrou, o que precisa repor. Tudo junto.',
    href: '/pdv',
    tags: ['Atendimento', 'Controle em tempo real'],
  },
  {
    number: '03',
    title: 'Admin',
    headline: 'A visão geral do seu negócio, numa tela só.',
    description: 'Vendas, clientes, produtos, canais. Sem planilha, sem montagem. Você abre, entende, decide.',
    href: '/admin',
    tags: ['Relatórios', 'Decisão com dados'],
  },
  {
    number: '04',
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

const principles = [
  { k: '01', t: 'Tudo conectado', d: 'Loja, caixa, WhatsApp e painel usam a mesma informação. Sem divergência, sem retrabalho.' },
  { k: '02', t: 'Cliente lembrado', d: 'Cada interação carrega o histórico. A equipe sabe quem é a pessoa, o que ela quer, o que ela já levou.' },
  { k: '03', t: 'Você no controle', d: 'O sistema cuida do operacional. Você cuida da estratégia. Reunião pra entender o que aconteceu ontem não existe mais.' },
];

function useReveal() {
  if (typeof window === 'undefined') return { ref: () => {}, isVisible: true };
  // Use IntersectionObserver para scroll reveal
  return null;
}

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
              { href: '#principios', label: 'Princípios' },
            ].map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[13px] font-medium tracking-[0.01em] text-[#1a1814]/70 transition-all duration-300 hover:text-[#1a1814] hover:tracking-[0.02em]"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden h-9 items-center rounded-full px-4 text-[13px] font-medium text-[#1a1814]/80 transition-all duration-300 hover:text-[#1a1814] sm:inline-flex"
            >
              Entrar
            </Link>
            <Link
              href="/loja"
              className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1a1814] px-4 text-[13px] font-medium text-[#f6f3ee] transition-all duration-300 hover:bg-[#1a1814]/90 hover:gap-2.5"
            >
              Ver a plataforma
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-[1320px] px-6 pb-16 pt-12 sm:pb-24 sm:pt-16 lg:pb-32 lg:pt-20">
          {/* Eyebrow */}
          <div className="mb-10 flex animate-fade-in items-center gap-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
            <span className="h-px w-8 bg-[#1a1814]/30" />
            <span>Edição 01</span>
            <span>·</span>
            <span>Retail OS</span>
            <span>·</span>
            <span>2026</span>
          </div>

          {/* Headline */}
          <h1
            className="max-w-5xl animate-fade-up text-[clamp(2.75rem,7vw,6.5rem)] font-normal leading-[0.95] tracking-[-0.04em] text-[#1a1814]"
            style={{ fontFamily: 'var(--font-display)', animationDelay: '200ms', animationFillMode: 'both' }}
          >
            Vender em qualquer canal, como se fosse <em className="text-[#b8654a]">tudo um só</em>.
          </h1>

          {/* Subheadline */}
          <div className="mt-12 grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
            <p
              className="animate-fade-up max-w-2xl text-[18px] leading-[1.55] text-[#1a1814]/75 sm:text-[20px]"
              style={{ animationDelay: '350ms', animationFillMode: 'both' }}
            >
              A GTSoftHub une sua loja física, sua vitrine online, seu caixa e seu WhatsApp numa operação só. Estoque, vendas e atendimento conversando entre si, sem você precisar montar nada.
            </p>

            <div className="animate-fade-up grid grid-cols-3 gap-6 self-end border-t border-[#1a1814]/15 pt-6" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
              {proofMetrics.map((m, i) => (
                <div
                  key={m.l}
                  className="transition-transform duration-500 hover:-translate-y-1"
                  style={{ animationDelay: `${650 + i * 100}ms` }}
                >
                  <div className="text-[36px] font-normal leading-none tracking-[-0.03em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
                    {m.v}
                  </div>
                  <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/50">
                    {m.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div
            className="mt-12 flex animate-fade-up flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: '700ms', animationFillMode: 'both' }}
          >
            <Link
              href="#whatsapp"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#1a1814] px-7 text-[14px] font-medium text-[#f6f3ee] transition-all duration-300 hover:bg-[#1a1814]/90 hover:gap-3"
            >
              Conhecer o bot de WhatsApp
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/loja"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#1a1814]/15 bg-[#f6f3ee] px-7 text-[14px] font-medium text-[#1a1814] transition-all duration-300 hover:border-[#1a1814]/30 hover:gap-3"
            >
              Ver a vitrine funcionando
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* Hero image */}
        <div className="mx-auto max-w-[1320px] px-6 pb-20">
          <div
            className="group relative aspect-[16/8] animate-fade-up overflow-hidden rounded-[2px] border border-[#1a1814]/8 transition-transform duration-700 hover:scale-[1.005]"
            style={{ animationDelay: '600ms', animationFillMode: 'both' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#e8d5c4] via-[#d4b896] to-[#8b6f47] transition-transform duration-1000 group-hover:scale-105" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.25),transparent_60%)]" />

            {/* Mockup "WhatsApp conversa" sobreposto */}
            <div className="absolute inset-0 flex flex-col justify-between p-8 sm:p-12">
              <div className="flex items-start justify-between text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/60">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  WhatsApp · Bot ativo
                </span>
                <span>GTSoftHub · 2026</span>
              </div>

              <div className="grid gap-6 sm:grid-cols-[1.4fr_1fr]">
                {/* Bolha cliente */}
                <div className="space-y-3">
                  <div className="ml-auto max-w-xs animate-fade-in rounded-2xl rounded-tr-sm bg-white/90 px-4 py-3 text-[14px] text-[#1a1814] shadow-sm" style={{ animationDelay: '1.2s', animationFillMode: 'both' }}>
                    Oi! Vcs tem a caneca personalizada ainda?
                  </div>
                  {/* Bolha bot */}
                  <div className="animate-fade-in rounded-2xl rounded-tl-sm bg-[#1a1814] px-4 py-3 text-[14px] text-[#f6f3ee] shadow-sm" style={{ animationDelay: '1.5s', animationFillMode: 'both' }}>
                    <p>Oi! Temos sim 😊</p>
                    <p className="mt-1.5">Tenho 3 modelos. Quer ver?</p>
                    <p className="mt-2 inline-block rounded bg-[#b8654a] px-2 py-0.5 text-[12px]">Ver modelos →</p>
                  </div>
                </div>

                {/* Texto editorial */}
                <div className="hidden self-end sm:block">
                  <p className="text-[24px] leading-[1.15] tracking-[-0.02em] text-[#1a1814] sm:text-[28px]" style={{ fontFamily: 'var(--font-display)' }}>
                    Vendas que acontecem enquanto você dorme, viaja ou almoça.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHATSAPP - DESTAQUE PRINCIPAL */}
      <section id="whatsapp" className="border-t border-[#1a1814]/8 bg-[#1a1814] py-20 text-[#f6f3ee] sm:py-28">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="mb-16 grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <div>
              <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-[#b8654a]">
                <span className="h-px w-8 bg-[#b8654a]" />
                O que faz a diferença
              </p>
              <h2 className="mt-5 max-w-3xl text-[clamp(2.25rem,5vw,4rem)] font-normal leading-[1] tracking-[-0.04em] text-[#f6f3ee]" style={{ fontFamily: 'var(--font-display)' }}>
                Um <em className="text-[#b8654a]">vendedor</em> que nunca dorme, nunca esquece e nunca pede aumento.
              </h2>
            </div>
            <p className="max-w-md text-[16px] leading-[1.55] text-[#f6f3ee]/65">
              É o bot de WhatsApp da GTSoftHub. Ele conversa com seus clientes como se fosse você, mas está disponível 24 horas, não erra o estoque e fecha a venda sozinho.
            </p>
          </div>

          <div className="grid gap-px bg-[#f6f3ee]/10 sm:grid-cols-3">
            {whatsappFeatures.map((f, i) => (
              <div
                key={f.title}
                className="group relative bg-[#1a1814] p-8 transition-all duration-500 hover:bg-[#25221c] sm:p-10"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-full border border-[#f6f3ee]/15 bg-[#f6f3ee]/5 transition-all duration-500 group-hover:scale-110 group-hover:border-[#b8654a]/40 group-hover:bg-[#b8654a]/10">
                  <f.icon className="h-5 w-5 text-[#b8654a]" strokeWidth={1.4} />
                </div>
                <h3 className="text-[24px] font-normal leading-[1.15] tracking-[-0.02em] text-[#f6f3ee]" style={{ fontFamily: 'var(--font-display)' }}>
                  {f.title}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.55] text-[#f6f3ee]/60">
                  {f.description}
                </p>

                {/* Linha de "check" sutil */}
                <div className="mt-6 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#f6f3ee]/40">
                  <Check className="h-3 w-3 text-[#b8654a]" />
                  Disponível 24/7
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#b8654a] px-7 text-[14px] font-medium text-[#f6f3ee] transition-all duration-300 hover:bg-[#b8654a]/90 hover:gap-3"
            >
              Ativar o bot no meu WhatsApp
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="#modulos"
              className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#f6f3ee]/55 transition-colors duration-300 hover:text-[#f6f3ee]"
            >
              Ver os outros módulos
            </Link>
          </div>
        </div>
      </section>

      {/* MÓDULOS */}
      <section id="modulos" className="border-t border-[#1a1814]/8 bg-[#f6f3ee] py-20 sm:py-28">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="mb-16 grid items-end gap-6 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Módulos</p>
              <h2 className="mt-4 max-w-2xl text-[clamp(2rem,4vw,3.25rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
                Quatro partes, um sistema só.
              </h2>
            </div>
            <p className="max-w-md text-[15px] leading-[1.55] text-[#1a1814]/65">
              Cada módulo resolve uma parte do seu dia. Mas o que faz a diferença é eles conversarem entre si — você não precisa digitar a mesma coisa em três lugares.
            </p>
          </div>

          <div className="grid gap-px bg-[#1a1814]/8 sm:grid-cols-2">
            {modules.map((m, i) => (
              <Link
                key={m.number}
                href={m.href}
                className="group relative overflow-hidden bg-[#f6f3ee] p-8 transition-all duration-500 hover:bg-[#efe9df] sm:p-10"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Número grande que aparece no hover */}
                <div className="pointer-events-none absolute -right-4 -top-8 select-none text-[180px] font-normal leading-none text-[#1a1814]/[0.04] transition-all duration-700 group-hover:-translate-y-2 group-hover:text-[#1a1814]/[0.06]" style={{ fontFamily: 'var(--font-display)' }}>
                  {m.number}
                </div>

                <div className="relative mb-8 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
                    {m.number} · {m.title}
                  </span>
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
            ))}
          </div>
        </div>
      </section>

      {/* PRINCÍPIOS */}
      <section id="principios" className="border-t border-[#1a1814]/8 bg-[#1a1814] py-20 text-[#f6f3ee] sm:py-28">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#f6f3ee]/50">Princípios</p>
              <h2 className="mt-4 text-[clamp(2rem,4vw,3.25rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#f6f3ee]" style={{ fontFamily: 'var(--font-display)' }}>
                Três coisas que a gente não negocia.
              </h2>
            </div>

            <div className="space-y-10">
              {principles.map((p) => (
                <div key={p.k} className="grid grid-cols-[auto_1fr] gap-6 border-t border-[#f6f3ee]/15 pt-6">
                  <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#b8654a]">{p.k}</span>
                  <div>
                    <h3 className="text-[24px] font-normal leading-[1.2] tracking-[-0.02em] text-[#f6f3ee]" style={{ fontFamily: 'var(--font-display)' }}>
                      {p.t}
                    </h3>
                    <p className="mt-3 text-[15px] leading-[1.55] text-[#f6f3ee]/65">
                      {p.d}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL + FOOTER */}
      <section id="jornada" className="border-t border-[#1a1814]/8 bg-[#f6f3ee]">
        <div className="mx-auto max-w-[1320px] px-6 py-24 sm:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Próximo passo</p>
            <h2 className="mt-6 text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[1] tracking-[-0.03em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
              Viu? <em className="text-[#b8654a]">Não parece</em> software.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.55] text-[#1a1814]/70 sm:text-[18px]">
              Porque não é. É varejo com ritmo, marca e controle. O software é só o que faz isso caber numa tela.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#1a1814] px-7 text-[14px] font-medium text-[#f6f3ee] transition-all duration-300 hover:bg-[#1a1814]/90 hover:gap-3"
              >
                Entrar agora
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/loja"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-[#1a1814]/15 px-7 text-[14px] font-medium text-[#1a1814] transition-all duration-300 hover:border-[#1a1814]/30 hover:gap-3"
              >
                Ver a loja ao vivo
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#1a1814]/8">
          <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-6 py-8 text-[12px] text-[#1a1814]/55 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-[#1a1814] text-[8px] font-semibold text-[#f6f3ee]">GT</div>
              <span>GTSoftHub · Operação premium para varejo omnichannel</span>
            </div>
            <div className="flex flex-wrap gap-6">
              <Link href="/loja" className="transition-colors duration-300 hover:text-[#1a1814]">Loja</Link>
              <Link href="/pdv" className="transition-colors duration-300 hover:text-[#1a1814]">PDV</Link>
              <Link href="/admin" className="transition-colors duration-300 hover:text-[#1a1814]">Admin</Link>
              <Link href="/info/privacidade" className="transition-colors duration-300 hover:text-[#1a1814]">Privacidade</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
