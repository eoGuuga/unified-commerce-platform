'use client';

import { useState, useDeferredValue, useMemo } from 'react';
import Link from 'next/link';
import { Search, ShoppingBag, ArrowRight, Sparkles, X } from 'lucide-react';
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
  category?: string;
  stock?: number;
}

/**
 * Página da loja: minimalista, linda e responsiva.
 * - Hero compacto com busca
 * - Grid de produtos limpo
 * - Filtro por categoria inline
 * - Empty state quando não há produtos
 */
export function LojaView() {
  const { products, loading, error, refetch } = useProducts();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  // Extrair categorias únicas
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p: any) => p.category && set.add(p.category));
    return Array.from(set);
  }, [products]);

  // Filtrar produtos
  const filtered = useMemo(() => {
    return products.filter((p: any) => {
      const matchesSearch = !deferredSearch ||
        p.name.toLowerCase().includes(deferredSearch.toLowerCase());
      const matchesCategory = !activeCategory || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, deferredSearch, activeCategory]);

  return (
    <div className="min-h-screen bg-background">
      <StoreHeader />

      {/* Hero compacto */}
      <section className="relative overflow-hidden border-b border-white/6">
        <div className="absolute inset-0 mesh-gradient opacity-50" />
        <div className="absolute top-0 left-1/2 h-72 w-[600px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />

        <div className="container relative mx-auto px-4 py-12 sm:py-16 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-accent">
              <Sparkles className="h-3 w-3" />
              Vitrine
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl md:text-5xl">
              Encontre o que move sua rotina.
            </h1>
            <p className="mt-4 text-base text-slate-300 sm:text-lg">
              Curadoria premium com leitura de estoque em tempo real.
            </p>

            {/* Busca */}
            <div className="relative mx-auto mt-8 max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produtos..."
                className="w-full rounded-full border border-white/10 bg-white/6 py-3 pl-11 pr-11 text-sm text-white placeholder:text-slate-500 transition focus:border-accent/40 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-white/8 hover:text-white"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Filtro de categoria (inline) */}
      {categories.length > 0 && (
        <div className="border-b border-white/6 bg-background/40 backdrop-blur">
          <div className="container mx-auto px-4">
            <div className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => setActiveCategory(null)}
                className={cn(
                  'flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition',
                  !activeCategory
                    ? 'bg-white text-slate-950'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/8'
                )}
              >
                Tudo
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition',
                    activeCategory === cat
                      ? 'bg-white text-slate-950'
                      : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/8'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <section className="container mx-auto px-4 py-8 sm:py-12">
        {loading ? (
          <ProductGridSkeleton />
        ) : error ? (
          <ErrorState onRetry={refetch} error={error} />
        ) : filtered.length === 0 ? (
          <EmptyState hasSearch={!!search || !!activeCategory} onClear={() => { setSearch(''); setActiveCategory(null); }} />
        ) : (
          <>
            <div className="mb-6 flex items-end justify-between">
              <p className="text-sm text-slate-400">
                {filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-white/6 bg-white/[0.02]"
          style={{ animationDelay: `${(i % 4) * 0.1}s` }}
        >
          <div className="aspect-square animate-pulse bg-white/[0.04]" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-1/3 animate-pulse rounded bg-white/6" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-white/8" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-white/8" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasSearch, onClear }: { hasSearch: boolean; onClear: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
        <ShoppingBag className="h-8 w-8 text-accent" strokeWidth={1.5} />
      </div>
      <h3 className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-white">
        {hasSearch ? 'Nenhum resultado' : 'Vitrine em breve'}
      </h3>
      <p className="mt-3 text-slate-300">
        {hasSearch
          ? 'Tente ajustar a busca ou os filtros para encontrar o que procura.'
          : 'Estamos selecionando produtos para abrir com tudo no lugar.'}
      </p>
      {hasSearch && (
        <button
          onClick={onClear}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
        >
          Limpar filtros
          <ArrowRight className="ml-2 h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function ErrorState({ onRetry, error }: { onRetry: () => void; error: string }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h3 className="text-xl font-semibold text-white">Algo deu errado</h3>
      <p className="mt-2 text-slate-300">{error}</p>
      <button
        onClick={onRetry}
        className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
      >
        Tentar novamente
      </button>
    </div>
  );
}
