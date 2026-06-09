'use client';

import Link from 'next/link';
import { ArrowUpRight, BarChart3, Users, Package, Receipt } from 'lucide-react';

export default function AdminPage() {
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
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Admin</p>
          <h1 className="mt-5 text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[0.98] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-display)' }}>
            O cockpit do <em className="text-[#b8654a]" style={{ fontStyle: 'italic' }}>dono</em>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.55] text-[#1a1814]/70">
            Visão executiva de vendas, canais, margens e produtos. Decisão com leitura, não com achismo.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-px bg-[#1a1814]/8 sm:grid-cols-4">
            {[
              { v: 'R$ 0', l: 'Receita 7d' },
              { v: '0', l: 'Pedidos' },
              { v: '0%', l: 'Conversão' },
              { v: '0', l: 'Novos clientes' },
            ].map((m) => (
              <div key={m.l} className="bg-[#f6f3ee] p-6 text-left">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">{m.l}</p>
                <p className="mt-3 text-[28px] font-normal leading-none tracking-[-0.03em]" style={{ fontFamily: 'var(--font-display)' }}>{m.v}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid grid-cols-1 gap-px bg-[#1a1814]/8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { i: BarChart3, t: 'Vendas', d: 'Por canal, periodo, SKU' },
              { i: Users, t: 'Clientes', d: 'Historico e segmentos' },
              { i: Package, t: 'Estoque', d: 'Niveis e reposicao' },
              { i: Receipt, t: 'Pedidos', d: 'Status e historico' },
            ].map((m) => (
              <div key={m.t} className="bg-[#f6f3ee] p-6 text-left">
                <m.i className="h-5 w-5 text-[#b8654a]" strokeWidth={1.4} />
                <h3 className="mt-4 text-[16px] font-normal tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>{m.t}</h3>
                <p className="mt-1.5 text-[12px] text-[#1a1814]/60">{m.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/login" className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#1a1814] px-7 text-[14px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90">
              Entrar no admin
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <Link href="/loja" className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55 transition hover:text-[#1a1814]">Ver a loja</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
