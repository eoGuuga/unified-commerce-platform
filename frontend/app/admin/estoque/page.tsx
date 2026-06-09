'use client';

import Link from 'next/link';
import { ArrowUpRight, Package, AlertTriangle, TrendingUp, Boxes } from 'lucide-react';

export default function EstoquePage() {
  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#1a1814]">
      <header className="border-b border-[#1a1814]/8">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-[#1a1814] text-[10px] font-semibold text-[#f6f3ee]">GT</div>
            <span className="text-[15px] font-medium tracking-[-0.01em]" style={{ fontFamily: 'var(--font-display)' }}>GTSoftHub</span>
          </Link>
          <Link href="/loja" className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55 transition hover:text-[#1a1814]">Loja</Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Estoque</p>
          <h1 className="mt-5 text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[0.98] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-display)' }}>
            Ativo que vira <em className="text-[#b8654a]" style={{ fontStyle: 'italic' }}>vantagem</em>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.55] text-[#1a1814]/70">
            Risco, mínimo, reposição. Tratado como o que é: a peça mais cara do seu negócio.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-px bg-[#1a1814]/8 sm:grid-cols-3">
            {[
              { i: Package, v: '0', l: 'SKUs ativos' },
              { i: AlertTriangle, v: '0', l: 'Em atencao' },
              { i: TrendingUp, v: '0', l: 'Reposicoes hoje' },
            ].map((m) => (
              <div key={m.l} className="bg-[#f6f3ee] p-6 text-left">
                <div className="flex items-start justify-between">
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">{m.l}</p>
                  <m.i className="h-4 w-4 text-[#b8654a]" strokeWidth={1.4} />
                </div>
                <p className="mt-3 text-[36px] font-normal leading-none tracking-[-0.03em]" style={{ fontFamily: 'var(--font-display)' }}>{m.v}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/login" className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#1a1814] px-7 text-[14px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90">
              Gerenciar estoque
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <Link href="/loja" className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55 transition hover:text-[#1a1814]">Ver a loja</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
