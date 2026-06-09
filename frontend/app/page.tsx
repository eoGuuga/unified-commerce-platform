'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

/**
 * Landing page GTSoftHub - design editorial/magazine premium.
 * Tipografia: Fraunces (display serif) + Geist (body sans)
 * Paleta: off-white + preto + accent dourado/cobre sutil
 */

const modules = [
  {
    number: '01',
    title: 'Loja',
    headline: 'A vitrine como argumento de venda.',
    description: 'Catálogo elegante, leitura de estoque em tempo real, checkout que entende o cliente antes dele pedir.',
    href: '/loja',
    tags: ['storefront', 'conversão'],
  },
  {
    number: '02',
    title: 'PDV',
    headline: 'Caixa que respira com a operação.',
    description: 'Venda presencial sem perder o contexto do que acontece no online. Estoque único, atendimento humano, zero improviso.',
    href: '/pdv',
    tags: ['atendimento', 'velocidade'],
  },
  {
    number: '03',
    title: 'Admin',
    headline: 'O cockpit do dono que pensa no negócio.',
    description: 'Visão executiva de vendas, canais, margens e produtos. Decisão com leitura, não com achismo.',
    href: '/admin',
    tags: ['estratégia', 'comando'],
  },
  {
    number: '04',
    title: 'Estoque',
    headline: 'Ativo que vira vantagem competitiva.',
    description: 'Risco, mínimo, reposição. Tratado como o que é: a peça mais cara do seu negócio.',
    href: '/admin/estoque',
    tags: ['inteligência', 'margem'],
  },
];

const principles = [
  { k: '01', t: 'Estoque é verdade', d: 'Loja, PDV, WhatsApp e admin leem a mesma fonte. Sem overselling, sem retrabalho.' },
  { k: '02', t: 'Cliente é contexto', d: 'Cada interação carrega o histórico. O sistema lembra para a equipe não precisar adivinhar.' },
  { k: '03', t: 'Operação é ritmo', d: 'Sinais claros, decisões rápidas, sem reunião para entender o que aconteceu ontem.' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#1a1814]">
      {/* TOP BAR */}
      <header className="border-b border-[#1a1814]/8 bg-[#f6f3ee]/85 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1a1814] text-[11px] font-semibold tracking-[0.04em] text-[#f6f3ee]" style={{ fontFamily: 'var(--font-display)' }}>
              GT
            </div>
            <span className="text-[15px] font-medium tracking-[-0.01em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
              GTSoftHub
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {[
              { href: '#modulos', label: 'Módulos' },
              { href: '#principios', label: 'Princípios' },
              { href: '#jornada', label: 'Jornada' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[13px] font-medium tracking-[0.01em] text-[#1a1814]/70 transition hover:text-[#1a1814]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden h-9 items-center rounded-full px-4 text-[13px] font-medium text-[#1a1814]/80 transition hover:text-[#1a1814] sm:inline-flex"
            >
              Entrar
            </Link>
            <Link
              href="/loja"
              className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1a1814] px-4 text-[13px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90"
            >
              Ver a plataforma
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO EDITORIAL */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-[1320px] px-6 pb-16 pt-12 sm:pb-24 sm:pt-16 lg:pb-32 lg:pt-20">
          {/* Eyebrow com data e número de edição */}
          <div className="mb-10 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
            <span className="h-px w-8 bg-[#1a1814]/30" />
            <span>Edição 01</span>
            <span>·</span>
            <span>Retail OS</span>
            <span>·</span>
            <span>2026</span>
          </div>

          {/* Headline em serifa gigante */}
          <h1 className="max-w-5xl text-[clamp(2.75rem,7vw,6.5rem)] font-normal leading-[0.95] tracking-[-0.04em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
            Cada canal vendendo como se a operação inteira <em className="text-[#b8654a]" style={{ fontStyle: 'italic' }}>respirasse em uníssono</em>.
          </h1>

          {/* Subheadline + meta */}
          <div className="mt-12 grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
            <p className="max-w-2xl text-[18px] leading-[1.55] text-[#1a1814]/75 sm:text-[20px]">
              GTSoftHub transforma estoque, PDV, loja online e atendimento em uma única experiência de controle, beleza e fluidez. Para o empreendedor que se recusa a aceitar improviso.
            </p>

            <div className="grid grid-cols-3 gap-6 self-end border-t border-[#1a1814]/15 pt-6">
              {[
                { v: '1', l: 'Estoque' },
                { v: '4', l: 'Canais' },
                { v: '0', l: 'Ruído' },
              ].map((m) => (
                <div key={m.l}>
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
          <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#1a1814] px-7 text-[14px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90"
            >
              Entrar no ecossistema
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/loja"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#1a1814]/15 bg-[#f6f3ee] px-7 text-[14px] font-medium text-[#1a1814] transition hover:border-[#1a1814]/30"
            >
              Explorar a vitrine ao vivo
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* Imagem hero — placeholder editorial com gradiente sutil */}
        <div className="mx-auto max-w-[1320px] px-6 pb-20">
          <div className="relative aspect-[16/8] overflow-hidden rounded-[2px] border border-[#1a1814]/8">
            <div className="absolute inset-0 bg-gradient-to-br from-[#e8d5c4] via-[#d4b896] to-[#8b6f47]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.25),transparent_60%)]" />

            {/* Grid overlay sutil */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(to right, #1a1814 1px, transparent 1px), linear-gradient(to bottom, #1a1814 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

            {/* Texto editorial sobreposto */}
            <div className="absolute inset-0 flex flex-col justify-between p-8 sm:p-12">
              <div className="flex items-start justify-between text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/60">
                <span>01 — Vitrine</span>
                <span>GTSoftHub · 2026</span>
              </div>

              <div>
                <p className="max-w-md text-[24px] leading-[1.15] tracking-[-0.02em] text-[#1a1814] sm:text-[32px]" style={{ fontFamily: 'var(--font-display)' }}>
                  Onde o operador, o cliente e o sistema encontram a mesma página.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MÓDULOS */}
      <section id="modulos" className="border-t border-[#1a1814]/8 bg-[#f6f3ee] py-20 sm:py-28">
        <div className="mx-auto max-w-[1320px] px-6">
          <div className="mb-16 flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
                Módulos
              </p>
              <h2 className="mt-4 max-w-2xl text-[clamp(2rem,4vw,3.25rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
                Quatro peças, uma só operação.
              </h2>
            </div>
            <p className="hidden max-w-md text-[15px] leading-[1.55] text-[#1a1814]/65 lg:block">
              Cada módulo é desenhado para resolver uma parte do problema, mas só funciona bem junto. A soma é maior que as partes.
            </p>
          </div>

          <div className="grid gap-px bg-[#1a1814]/8 sm:grid-cols-2">
            {modules.map((m) => (
              <Link
                key={m.number}
                href={m.href}
                className="group relative bg-[#f6f3ee] p-8 transition hover:bg-[#efe9df] sm:p-10"
              >
                <div className="mb-8 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
                    {m.number} · {m.title}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[#1a1814]/30 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#1a1814]/70" />
                </div>

                <h3 className="mb-4 text-[28px] font-normal leading-[1.1] tracking-[-0.02em] text-[#1a1814] sm:text-[32px]" style={{ fontFamily: 'var(--font-display)' }}>
                  {m.headline}
                </h3>

                <p className="mb-6 max-w-md text-[15px] leading-[1.55] text-[#1a1814]/70">
                  {m.description}
                </p>

                <div className="flex flex-wrap gap-1.5">
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
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#f6f3ee]/50">
                Princípios
              </p>
              <h2 className="mt-4 text-[clamp(2rem,4vw,3.25rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#f6f3ee]" style={{ fontFamily: 'var(--font-display)' }}>
                Três coisas que não negociamos.
              </h2>
            </div>

            <div className="space-y-10">
              {principles.map((p) => (
                <div key={p.k} className="grid grid-cols-[auto_1fr] gap-6 border-t border-[#f6f3ee]/15 pt-6">
                  <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#b8654a]">
                    {p.k}
                  </span>
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
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
              Próximo passo
            </p>
            <h2 className="mt-6 text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[1] tracking-[-0.03em] text-[#1a1814]" style={{ fontFamily: 'var(--font-display)' }}>
              Viu? Não parece <em className="text-[#b8654a]" style={{ fontStyle: 'italic' }}>software</em>.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.55] text-[#1a1814]/70 sm:text-[18px]">
              Porque não é. É varejo com ritmo, marca e controle. O software é só o que faz isso caber numa tela.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#1a1814] px-7 text-[14px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90"
              >
                Entrar agora
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/loja"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-[#1a1814]/15 px-7 text-[14px] font-medium text-[#1a1814] transition hover:border-[#1a1814]/30"
              >
                Ver a loja ao vivo
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
              <Link href="/loja" className="transition hover:text-[#1a1814]">Loja</Link>
              <Link href="/pdv" className="transition hover:text-[#1a1814]">PDV</Link>
              <Link href="/admin" className="transition hover:text-[#1a1814]">Admin</Link>
              <Link href="/info/privacidade" className="transition hover:text-[#1a1814]">Privacidade</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
