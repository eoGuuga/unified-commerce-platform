'use client';

import Link from 'next/link';
import { ShoppingBag, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { cn } from '@/lib/utils';

interface StoreHeaderProps {
  variant?: 'transparent' | 'solid';
}

/**
 * Header sticky da loja: logo + nav + cart + menu mobile.
 * Bg com blur (glass) e borda inferior sutil.
 */
export function StoreHeader({ variant = 'solid' }: StoreHeaderProps) {
  const { totalItems } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Inicio' },
    { href: '/loja', label: 'Loja' },
    { href: '/pdv', label: 'PDV' },
    { href: '/admin', label: 'Admin' },
  ];

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-white/6',
        variant === 'transparent'
          ? 'bg-background/60 backdrop-blur-xl'
          : 'bg-background/80 backdrop-blur-xl'
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white text-[11px] font-semibold tracking-[0.18em] text-slate-950">
            GT
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">
            GTSoftHub
          </span>
        </Link>

        {/* Nav desktop */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                item.href === '/loja'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Acoes */}
        <div className="flex items-center gap-2">
          <CartButton count={totalItems} />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-full p-2 text-slate-400 transition hover:bg-white/5 hover:text-white md:hidden"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/6 bg-background/95 backdrop-blur-xl md:hidden">
          <nav className="container mx-auto flex flex-col gap-1 px-4 py-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

function CartButton({ count }: { count: number }) {
  return (
    <button
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
      aria-label={`Carrinho (${count} ${count === 1 ? 'item' : 'itens'})`}
    >
      <ShoppingBag className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-slate-950">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
