'use client';

import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, Package, Truck, MapPin } from 'lucide-react';

export default function PedidoPage() {
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
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Pedido</p>
          <h1 className="mt-5 text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[0.98] tracking-[-0.04em]" style={{ fontFamily: 'var(--font-display)' }}>
            Acompanhe sua <em className="text-[#b8654a]" style={{ fontStyle: 'italic' }}>jornada</em>.
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-[16px] leading-[1.55] text-[#1a1814]/70">
            Cada etapa do seu pedido, em tempo real. Sem ligar, sem esperar, sem adivinhar.
          </p>

          <div className="mt-12 space-y-0">
            {[
              { i: CheckCircle2, t: 'Confirmado', d: 'Pedido recebido e validado' },
              { i: Package, t: 'Em separacao', d: 'Sendo preparado para envio' },
              { i: Truck, t: 'A caminho', d: 'Saiu para entrega' },
              { i: MapPin, t: 'Entregue', d: 'Recebido pelo cliente' },
            ].map((step, idx) => (
              <div
                key={step.t}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-6 border-t border-[#1a1814]/8 py-5 text-left"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1a1814]/15">
                  <step.i className="h-4 w-4 text-[#b8654a]" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Etapa {idx + 1}</p>
                  <h3 className="text-[18px] font-normal tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>{step.t}</h3>
                  <p className="mt-1 text-[13px] text-[#1a1814]/60">{step.d}</p>
                </div>
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/40">--:--</span>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/loja" className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#1a1814] px-7 text-[14px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90">
              Voltar à loja
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <Link href="/login" className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#1a1814]/55 transition hover:text-[#1a1814]">Entrar</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
