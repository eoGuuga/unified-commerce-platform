'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { PackagePlus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { SectionTitle } from './SectionTitle';

const panelClassName =
  'rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_25px_90px_-60px_rgba(15,23,42,1)]';
const controlClassName =
  'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 transition focus:border-accent/50 focus:outline-none focus:ring-4 focus:ring-accent/10';

interface Product {
  id: string;
  name: string;
  price: string | number;
  description?: string;
  is_active: boolean;
}

interface ProductCatalogProps {
  products: Product[];
  onAddProduct: (product: { name: string; price: string; description: string }) => Promise<void>;
  sectionRef?: React.RefObject<HTMLElement | null>;
}

export function ProductCatalog({ products, onAddProduct, sectionRef }: ProductCatalogProps) {
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', price: '', description: '' });
  const deferredProductSearch = useDeferredValue(productSearch);

  const filteredProducts = useMemo(() => {
    const query = deferredProductSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        (product.description || '').toLowerCase().includes(query),
    );
  }, [deferredProductSearch, products]);

  const activeProductsCount = products.filter((p) => p.is_active).length;
  const inactiveProductsCount = products.length - activeProductsCount;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onAddProduct(newProduct);
    setNewProduct({ name: '', price: '', description: '' });
    setShowAddProduct(false);
  };

  return (
    <section ref={sectionRef} className={cn(panelClassName, 'p-6 sm:p-7')}>
      <SectionTitle
        eyebrow="catalogo"
        title={`Produtos cadastrados (${products.length})`}
        description="Pesquisa rapida, leitura visual mais limpa e um fluxo melhor para inserir novos produtos."
        action={
          <button
            type="button"
            onClick={() => setShowAddProduct((current) => !current)}
            className="inline-flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <PackagePlus className="size-4" />
            {showAddProduct ? 'Fechar formulario' : 'Adicionar produto'}
          </button>
        }
      />

      {showAddProduct && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Nome</label>
              <input
                type="text"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                required
                className={controlClassName}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Preco</label>
              <input
                type="number"
                step="0.01"
                value={newProduct.price}
                onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                required
                className={controlClassName}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-foreground">Descricao</label>
              <textarea
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                rows={3}
                className={controlClassName}
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
          >
            <PackagePlus className="size-4" />
            Criar produto
          </button>
        </form>
      )}

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Buscar produto por nome ou descricao..."
            className={cn(controlClassName, 'pl-11')}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {activeProductsCount} ativos
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {inactiveProductsCount} inativos
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {filteredProducts.length} exibidos
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-muted-foreground">
            Nenhum produto encontrado para essa busca.
          </div>
        ) : (
          filteredProducts.map((product, index) => (
            <div
              key={product.id}
              className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-4"
            >
              <div
                className={cn(
                  'pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r opacity-80',
                  index % 2 === 0
                    ? 'from-sky-400/12 via-cyan-400/8 to-transparent'
                    : 'from-emerald-400/12 via-amber-300/8 to-transparent',
                )}
              />

              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sm font-semibold uppercase tracking-[0.14em] text-accent">
                    {product.name.slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{product.name}</p>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {product.description || 'Produto pronto para venda nos canais conectados.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      preco
                    </p>
                    <p className="mt-1 font-semibold text-foreground">
                      {formatCurrency(parseFloat(String(product.price)))}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em]',
                      product.is_active
                        ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                        : 'border-rose-300/20 bg-rose-300/10 text-rose-100',
                    )}
                  >
                    {product.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
