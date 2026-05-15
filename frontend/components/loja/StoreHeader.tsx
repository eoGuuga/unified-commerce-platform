'use client';

import Link from 'next/link';
import { ShoppingBag, Store } from 'lucide-react';

interface StoreHeaderProps {
  storeName: string;
  cartCount: number;
  /** Clique no botao "Carrinho". Se a sessao de checkout ja estiver
   *  aberta, o caller pode rotear pro modal de checkout em vez do drawer. */
  onCartClick: () => void;
}

/**
 * Header sticky da vitrine: logo + nome da loja + atalhos de navegacao
 * (acompanhar pedido, ver catalogo) + botao do carrinho com contador.
 */
export function StoreHeader({
  storeName,
  cartCount,
  onCartClick,
}: StoreHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_50px_-35px_rgba(16,185,129,0.9)]">
            <Store className="size-5 text-accent" />
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.26em] text-muted-foreground">
              ecommerce conectado
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {storeName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/pedido"
            className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08] md:inline-flex"
          >
            Acompanhar pedido
          </Link>
          <a
            href="#catalogo"
            className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08] sm:inline-flex"
          >
            Ver catalogo
          </a>
          <button
            type="button"
            onClick={onCartClick}
            className="relative inline-flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <ShoppingBag className="size-4" />
            Carrinho
            {cartCount > 0 && (
              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-foreground">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
