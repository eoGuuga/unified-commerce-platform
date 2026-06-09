'use client';

import { useState, useDeferredValue, useMemo } from 'react';
import Link from 'next/link';
import { Search, ShoppingBag, ArrowRight, X, ArrowUpRight } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { ProductCard } from './ProductCard';
import { StoreHeader } from './StoreHeader';
import { StoreFooter } from './StoreFooter';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  image_url?: string;
  category?: string;
  stock?: number;
}

/**
 * Loja - design editorial off-white premium.
 * Consistente com a landing page.
 */
export function LojaView() {
  const { products, loading, error, refetch } = useProducts();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p: any) => p.category && set.add(p.category));
    return Array.from(set);
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p: any) => {
      const matchesSearch = !deferredSearch ||
        p.name.toLowerCase().includes(deferredSearch.toLowerCase());
      const matchesCategory = !activeCategory || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, deferredSearch, activeCategory]);

  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#1a1814]">
      <StoreHeader />

      {/* HERO */}
      <section className="border-b border-[#1a1814]/8">
        <div className="mx-auto max-w-[1320px] px-6 py-16 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
              Vitrine
            </p>
            <h1
              className="mt-5 text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[0.98] tracking-[-0.04em] text-[#1a1814]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Encontre o que move sua rotina.
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-[1.55] text-[#1a1814]/70 sm:text-[18px]">
              Curadoria premium, estoque em tempo real, atendimento que entende.
            </p>

            {/* Busca */}
            <div className="relative mt-10 max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1a1814]/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produtos..."
                className="w-full rounded-full border border-[#1a1814]/15 bg-white/40 py-3 pl-11 pr-11 text-[14px] text-[#1a1814] placeholder:text-[#1a1814]/40 transition focus:border-[#1a1814]/40 focus:bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#b8654a]/30"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[#1a1814]/40 transition hover:bg-[#1a1814]/5 hover:text-[#1a1814]"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FILTRO DE CATEGORIA */}
      {categories.length > 0 && (
        <div className="border-b border-[#1a1814]/8 bg-[#efe9df]/40">
          <div className="mx-auto max-w-[1320px] px-6">
            <div className="flex gap-1.5 overflow-x-auto py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => setActiveCategory(null)}
                className={cn(
                  'flex-shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition',
                  !activeCategory
                    ? 'bg-[#1a1814] text-[#f6f3ee]'
                    : 'border border-[#1a1814]/15 text-[#1a1814]/70 hover:bg-[#1a1814]/5'
                )}
              >
                Tudo
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'flex-shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition',
                    activeCategory === cat
                      ? 'bg-[#1a1814] text-[#f6f3ee]'
                      : 'border border-[#1a1814]/15 text-[#1a1814]/70 hover:bg-[#1a1814]/5'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONTEUDO */}
      <section className="mx-auto max-w-[1320px] px-6 py-16">
        {loading ? (
          <ProductGridSkeleton />
        ) : error ? (
          <ErrorState onRetry={refetch} error={error} />
        ) : filtered.length === 0 ? (
          <EmptyState
            hasSearch={!!search || !!activeCategory}
            onClear={() => { setSearch(''); setActiveCategory(null); }}
          />
        ) : (
          <>
            <div className="mb-10 flex items-end justify-between border-b border-[#1a1814]/8 pb-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
                {filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}
              </p>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">
                Atualizado agora
              </p>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </section>

      <StoreFooter />
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-4">
          <div className="aspect-[4/5] animate-pulse rounded-[2px] bg-[#1a1814]/5" />
          <div className="space-y-2">
            <div className="h-3 w-16 animate-pulse rounded-[1px] bg-[#1a1814]/8" />
            <div className="h-4 w-3/4 animate-pulse rounded-[1px] bg-[#1a1814]/10" />
            <div className="h-4 w-1/3 animate-pulse rounded-[1px] bg-[#1a1814]/8" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasSearch, onClear }: { hasSearch: boolean; onClear: () => void }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#1a1814]/15">
        <ShoppingBag className="h-8 w-8 text-[#1a1814]/40" strokeWidth={1.2} />
      </div>
      <h3
        className="mt-8 text-[28px] font-normal leading-[1.1] tracking-[-0.02em] text-[#1a1814]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {hasSearch ? 'Nenhum resultado.' : 'Vitrine em breve.'}
      </h3>
      <p className="mt-4 text-[15px] leading-[1.55] text-[#1a1814]/60">
        {hasSearch
          ? 'Tente outros termos ou remova os filtros.'
          : 'Estamos selecionando produtos para abrir com tudo no lugar.'}
      </p>
      {hasSearch && (
        <button
          onClick={onClear}
          className="group mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-[#1a1814] px-6 text-[13px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90"
        >
          Limpar filtros
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  );
}

function ErrorState({ onRetry, error }: { onRetry: () => void; error: string }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h3
        className="text-[24px] font-normal tracking-[-0.02em] text-[#1a1814]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Algo deu errado.
      </h3>
      <p className="mt-3 text-[15px] text-[#1a1814]/60">{error}</p>
      <button
        onClick={onRetry}
        className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-[#1a1814] px-6 text-[13px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90"
      >
        Tentar novamente
      </button>
    </div>
  );
}
