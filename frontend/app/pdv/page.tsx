'use client';

import Link from 'next/link';
import { ArrowUpRight, ShoppingCart, Package, BarChart3, Sparkles } from 'lucide-react';

export default function PdvPage() {
  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#1a1814]">
      <header className="border-b border-[#1a1814]/8">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-[#1a1814] text-[10px] font-semibold text-[#f6f3ee]">GT</div>
            <span className="text-[15px] font-medium tracking-[-0.01em]" style={{ fontFamily: 'var(--font-display)' }}>GTSoftHub</span>
          </Link>
          <Link href="/" className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55 transition hover:text-[#1a1814]">Início</Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">PDV</p>
          <h1 className="mt-5 text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[0.98] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-display)' }}>
            Caixa que <em className="text-[#b8654a]" style={{ fontStyle: 'italic' }}>respira</em> com a operação.
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-[16px] leading-[1.55] text-[#1a1814]/70">
            Venda presencial sem perder o contexto do online. Estoque único, atendimento humano, zero improviso.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-px bg-[#1a1814]/8 sm:grid-cols-3">
            {[
              { i: ShoppingCart, t: 'Vendas', d: 'Carrinho, pagamento, recibo' },
              { i: Package, t: 'Estoque', d: 'Baixa em tempo real' },
              { i: BarChart3, t: 'Relatórios', d: 'Fechamento de turno' },
            ].map((m) => (
              <div key={m.t} className="bg-[#f6f3ee] p-8">
                <m.i className="mx-auto h-7 w-7 text-[#b8654a]" strokeWidth={1.4} />
                <h3 className="mt-5 text-[18px] font-normal tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>{m.t}</h3>
                <p className="mt-2 text-[13px] text-[#1a1814]/60">{m.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/pdv/caixa" className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#1a1814] px-7 text-[14px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90">
              Abrir PDV
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <Link href="/" className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55 transition hover:text-[#1a1814]">Voltar ao site</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
