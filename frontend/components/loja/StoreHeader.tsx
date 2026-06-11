'use client';

import Link from 'next/link';
import { ShoppingBag, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

/**
 * Header sticky - off-white com blur sutil.
 */
export function StoreHeader() {
  const { totalItems } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Início' },
    { href: '/loja', label: 'Loja' },
    { href: '/pdv', label: 'PDV' },
    { href: '/admin', label: 'Admin' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#1a1814]/8 bg-[#f6f3ee]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-[#1a1814] text-[10px] font-semibold text-[#f6f3ee]">
            GT
          </div>
          <span
            className="text-[15px] font-medium tracking-[-0.01em] text-[#1a1814]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            GTSoftHub
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition',
                item.href === '/loja'
                  ? 'text-[#1a1814]'
                  : 'text-[#1a1814]/60 hover:text-[#1a1814]'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#1a1814]/15 bg-white/30 text-[#1a1814] transition hover:bg-white/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            aria-label={`Carrinho (${totalItems} ${totalItems === 1 ? 'item' : 'itens'})`}
          >
            <ShoppingBag className="h-4 w-4" />
            {totalItems > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#b8654a] px-1 text-[10px] font-semibold text-[#f6f3ee]">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-full p-2 text-[#1a1814]/60 transition hover:bg-[#1a1814]/5 hover:text-[#1a1814] md:hidden"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#1a1814]/8 bg-[#f6f3ee]/95 backdrop-blur-md md:hidden">
          <nav className="mx-auto flex max-w-[1320px] flex-col gap-0.5 px-6 py-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-[2px] px-3 py-2.5 text-[14px] font-medium text-[#1a1814]/70 transition hover:bg-[#1a1814]/5 hover:text-[#1a1814]"
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
