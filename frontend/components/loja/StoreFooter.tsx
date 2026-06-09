'use client';

import Link from 'next/link';

/**
 * Footer editorial - off-white, minimalista.
 */
export function StoreFooter() {
  return (
    <footer className="border-t border-[#1a1814]/8 bg-[#1a1814] text-[#f6f3ee]">
      <div className="mx-auto max-w-[1320px] px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-[#f6f3ee] text-[10px] font-semibold text-[#1a1814]">
                GT
              </div>
              <span
                className="text-[15px] font-medium tracking-[-0.01em] text-[#f6f3ee]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                GTSoftHub
              </span>
            </div>
            <p className="mt-5 max-w-sm text-[14px] leading-[1.55] text-[#f6f3ee]/55">
              Plataforma premium para varejo omnichannel. Estoque, PDV, loja online e atendimento em um único ecossistema.
            </p>
          </div>

          <div>
            <h4 className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#f6f3ee]/50">
              Plataforma
            </h4>
            <ul className="mt-5 space-y-2.5 text-[14px]">
              <li><Link href="/loja" className="text-[#f6f3ee]/75 transition hover:text-[#f6f3ee]">Loja</Link></li>
              <li><Link href="/pdv" className="text-[#f6f3ee]/75 transition hover:text-[#f6f3ee]">PDV</Link></li>
              <li><Link href="/admin" className="text-[#f6f3ee]/75 transition hover:text-[#f6f3ee]">Admin</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#f6f3ee]/50">
              Conta
            </h4>
            <ul className="mt-5 space-y-2.5 text-[14px]">
              <li><Link href="/login" className="text-[#f6f3ee]/75 transition hover:text-[#f6f3ee]">Entrar</Link></li>
              <li><Link href="/info/privacidade" className="text-[#f6f3ee]/75 transition hover:text-[#f6f3ee]">Privacidade</Link></li>
              <li><Link href="/info/termos" className="text-[#f6f3ee]/75 transition hover:text-[#f6f3ee]">Termos</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-14 border-t border-[#f6f3ee]/10 pt-6 text-[11px] uppercase tracking-[0.16em] text-[#f6f3ee]/40">
          GTSoftHub · Operação premium para varejo omnichannel
        </div>
      </div>
    </footer>
  );
}
