'use client';

/**
 * PdvProductSearch — busca por nome + grade de favoritos + estoque (spec §3.2/§5.3/§7).
 *
 * Recebe `products` por PROP (a página passa os dados da camada já existente —
 * `useProducts`/`apiClient.getProducts`). Assim o componente fica testável sem
 * mock de rede e não dispara refetch próprio.
 *
 * Comportamento:
 *  - filtra por nome ao vivo (case-insensitive), só produtos ativos;
 *  - favoritos no topo (estrela toggla via favorites.ts, persiste em localStorage);
 *  - cada card mostra nome + preço; estoque disponível <= 0 → selo "Esgotado" e add desabilitado;
 *  - clicar um card com estoque chama onAdd(PdvAddableProduct);
 *  - Enter na busca adiciona o 1º resultado COM estoque e limpa a busca.
 */

import { useMemo, useState } from 'react';
import { Search, Star } from 'lucide-react';
import type { Product } from '@/lib/types/product';
import type { PdvAddableProduct } from '@/lib/pdv/cart';
import { listFavorites, toggleFavorite, orderByFavorites } from '@/lib/pdv/favorites';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Coerção de Decimal (number|string) para número seguro. */
function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Estoque disponível do produto. O backend pode entregar o número em campos
 * diferentes conforme o endpoint (catálogo simples x resumo de estoque); usamos
 * a primeira fonte presente. Ausência total = 0 (trata como esgotado, não vende às cegas).
 */
function availableStock(product: Product): number {
  const candidate =
    (product as { available_stock?: number }).available_stock ??
    product.stock ??
    (product as { current_stock?: number }).current_stock;
  return typeof candidate === 'number' ? candidate : 0;
}

/** Mapeia o Product (camada de dados) para a forma mínima que o carrinho aceita. */
function toAddable(product: Product): PdvAddableProduct {
  return {
    id: product.id,
    name: product.name,
    price: toNumber(product.price),
    stock: availableStock(product),
  };
}

export function PdvProductSearch({
  products,
  onAdd,
}: {
  products: Product[];
  onAdd: (product: PdvAddableProduct) => void;
}) {
  const [query, setQuery] = useState('');
  // Snapshot dos favoritos em estado para re-render ao alternar a estrela.
  const [favIds, setFavIds] = useState<string[]>(() => listFavorites());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = products.filter((p) => p.is_active !== false);
    const matched = q ? active.filter((p) => p.name?.toLowerCase().includes(q)) : active;
    return orderByFavorites(matched, favIds);
  }, [products, query, favIds]);

  function handleAdd(product: Product) {
    if (availableStock(product) <= 0) return;
    onAdd(toAddable(product));
  }

  function handleToggleFavorite(id: string) {
    setFavIds(toggleFavorite(id));
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const first = filtered.find((p) => availableStock(p) > 0);
    if (!first) return;
    onAdd(toAddable(first));
    setQuery('');
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Busca — compacta, foco de teclado visivel. */}
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Buscar produto pelo nome…"
          aria-label="Buscar produto"
          autoFocus
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
        />
      </div>

      {/* Grade DENSA: 3 col estreito -> 4 (sm) -> 5 (xl, ~1366) -> 6 (2xl, ~1920).
          Ver muitos produtos de uma vez, como caixa de mercado. So a grade rola. */}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-0.5">
        {filtered.length === 0 ? (
          <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
            {products.length === 0
              ? 'Nenhum produto cadastrado.'
              : 'Nenhum produto encontrado para essa busca.'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filtered.map((product) => {
              const stock = availableStock(product);
              const esgotado = stock <= 0;
              const isFav = favIds.includes(product.id);
              return (
                <div
                  key={product.id}
                  className={`relative rounded-xl border bg-white transition ${
                    esgotado
                      ? 'border-slate-200 opacity-55'
                      : 'border-slate-200 hover:border-cyan-400 hover:shadow-[0_6px_16px_rgba(8,145,178,0.10)]'
                  }`}
                >
                  {/* Estrela de favorito */}
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(product.id)}
                    aria-label={`Favoritar ${product.name}`}
                    aria-pressed={isFav}
                    className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full text-slate-300 transition hover:bg-slate-50 hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    <Star
                      className={`size-3.5 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`}
                    />
                  </button>

                  {/* Card clicável = adicionar. Linha enxuta: nome, preco, estoque. */}
                  <button
                    type="button"
                    onClick={() => handleAdd(product)}
                    disabled={esgotado}
                    aria-label={`Adicionar ${product.name}`}
                    className="flex w-full flex-col items-start gap-0.5 rounded-xl px-2.5 py-2 pr-6 text-left disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    <span
                      data-testid="pdv-product-name"
                      className="line-clamp-2 text-xs font-semibold leading-tight text-slate-950"
                    >
                      {product.name}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-900">
                      {currencyFormatter.format(toNumber(product.price))}
                    </span>
                    {esgotado ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                        Esgotado
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-emerald-700">
                        {stock} un
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
