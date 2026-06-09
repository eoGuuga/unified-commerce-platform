'use client';

import Link from 'next/link';

/**
 * Footer minimalista e responsivo para a loja.
 */
export function StoreFooter() {
  return (
    <footer className="border-t border-white/6 bg-background/40 backdrop-blur">
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white text-[11px] font-semibold tracking-[0.18em] text-slate-950">
                GT
              </div>
              <span className="text-sm font-semibold tracking-tight text-white">
                GTSoftHub
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-slate-400">
              Plataforma premium para varejo omnichannel. Estoque, PDV, loja online e atendimento em um so ecossistema.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Plataforma
            </h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/loja" className="text-slate-400 transition hover:text-white">
                  Loja
                </Link>
              </li>
              <li>
                <Link href="/pdv" className="text-slate-400 transition hover:text-white">
                  PDV
                </Link>
              </li>
              <li>
                <Link href="/admin" className="text-slate-400 transition hover:text-white">
                  Admin
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Conta
            </h4>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/login" className="text-slate-400 transition hover:text-white">
                  Entrar
                </Link>
              </li>
              <li>
                <Link href="/info/privacidade" className="text-slate-400 transition hover:text-white">
                  Privacidade
                </Link>
              </li>
              <li>
                <Link href="/info/termos" className="text-slate-400 transition hover:text-white">
                  Termos
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/6 pt-6 text-center text-xs text-slate-500">
          GTSoftHub - Operacao premium para varejo omnichannel
        </div>
      </div>
    </footer>
  );
}
