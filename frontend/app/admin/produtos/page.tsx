'use client';

import { Package } from 'lucide-react';

/** Página de produtos. A casca (AdminShell) fornece o layout e a nav. */
export default function AdminProdutosPage() {
  return (
    <div className="mx-auto max-w-[1320px] px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Produtos</p>
        <h1
          className="mt-5 text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[0.98] tracking-[-0.04em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Seu catálogo, <em className="text-[#b8654a]" style={{ fontStyle: 'italic' }}>organizado</em>.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[16px] leading-[1.55] text-[#1a1814]/70">
          Cadastre, edite e gerencie todos os seus produtos em um só lugar.
        </p>

        <div className="mt-16 flex flex-col items-center gap-3">
          <Package className="h-12 w-12 text-[#1a1814]/20" strokeWidth={1.2} />
          <p className="text-[14px] text-[#1a1814]/50">Gestão de produtos em breve.</p>
        </div>
      </div>
    </div>
  );
}
