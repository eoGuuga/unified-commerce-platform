'use client';

import { useMemo, useState, useEffect } from 'react';
import { RefreshCw, Package, Search, Plus, Pencil } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { ProductForm } from './ProductForm';
import api, { normalizeApiError } from '@/lib/api-client';
import type { Product, CreateProductInput, UpdateProductInput } from '@/lib/types/product';

function formatMoney(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return `R$ ${n.toFixed(2)}`;
}

type FiltroAtivo = 'todos' | 'ativos' | 'inativos';

/**
 * Tela de gestão de produtos do admin.
 * Lista com busca + filtro de ativos/inativos + form de create/edit.
 * Toggle de ativo/inativo é optimistic (via useProducts).
 */
export function ProductsManager() {
  const { products, loading, error, refetch, create, update, toggleActive, mutatingId } = useProducts();
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>('todos');
  const [formAberto, setFormAberto] = useState<{ mode: 'create' | 'edit'; product?: Product } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [categoriasErro, setCategoriasErro] = useState<string | null>(null);

  // Carrega categorias para o formulário. Falha NÃO é silenciada (B3): sem aviso,
  // o dropdown fica misteriosamente vazio e a lojista não sabe que algo quebrou.
  useEffect(() => {
    api
      .getCategories()
      .then((cats) => {
        setCategories(cats);
        setCategoriasErro(null);
      })
      .catch((err) => {
        setCategories([]);
        setCategoriasErro(
          normalizeApiError(err, {
            fallback: 'Não foi possível carregar as categorias.',
          }),
        );
      });
  }, []);

  // Feedback de sucesso some sozinho após 6s; erro fica até próximo clique
  useEffect(() => {
    if (feedback?.kind !== 'ok') return;
    const id = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(id);
  }, [feedback]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (filtroAtivo === 'ativos' && !p.is_active) return false;
      if (filtroAtivo === 'inativos' && p.is_active) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
    });
  }, [products, search, filtroAtivo]);

  async function handleCreate(data: CreateProductInput | UpdateProductInput) {
    setSubmitting(true);
    const result = await create(data as CreateProductInput);
    setSubmitting(false);
    if (result.ok) {
      setFeedback({ kind: 'ok', text: `Produto "${result.product?.name}" criado.` });
      setFormAberto(null);
      // Recarregar categorias caso nova tenha sido criada
      api.getCategories().then(setCategories).catch(() => undefined);
    } else {
      setFeedback({ kind: 'err', text: result.error ?? 'Falha ao criar produto.' });
    }
  }

  async function handleEdit(data: CreateProductInput | UpdateProductInput) {
    if (!formAberto?.product) return;
    setSubmitting(true);
    const result = await update(formAberto.product.id, data as UpdateProductInput);
    setSubmitting(false);
    if (result.ok) {
      setFeedback({ kind: 'ok', text: 'Produto atualizado.' });
      setFormAberto(null);
    } else {
      setFeedback({ kind: 'err', text: result.error ?? 'Falha ao atualizar produto.' });
    }
  }

  async function handleToggle(product: Product) {
    setFeedback(null);
    const next = !product.is_active;
    const result = await toggleActive(product.id, next);
    if (result.ok) {
      setFeedback({
        kind: 'ok',
        text: `"${product.name}" ${next ? 'ativado' : 'desativado'}.`,
      });
    } else {
      setFeedback({ kind: 'err', text: result.error ?? 'Falha ao alterar status.' });
    }
  }

  // Painel lateral de form (direita no desktop, tela cheia no mobile)
  const panelClass =
    'fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-xl sm:max-w-md md:border-l md:border-[#1a1814]/10';

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-10">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Admin</p>
          <h1
            className="mt-2 text-[clamp(1.8rem,4vw,2.6rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#1a1814]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Produtos
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#1a1814]/15 px-4 text-[13px] font-medium text-[#1a1814] transition hover:bg-[#1a1814]/5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={() => setFormAberto({ mode: 'create' })}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1a1814] px-4 text-[13px] font-medium text-[#f6f3ee] transition hover:bg-[#1a1814]/90"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1a1814]/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou categoria"
            className="h-11 w-full rounded-full border border-[#1a1814]/15 bg-[#f6f3ee] pl-10 pr-4 text-[14px] text-[#1a1814] outline-none transition focus:border-[#1a1814]/40"
          />
        </div>
        <select
          value={filtroAtivo}
          onChange={(e) => setFiltroAtivo(e.target.value as FiltroAtivo)}
          className="h-11 rounded-full border border-[#1a1814]/15 bg-[#f6f3ee] px-4 text-[14px] text-[#1a1814] outline-none transition focus:border-[#1a1814]/40"
        >
          <option value="todos">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
        </select>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`mt-5 rounded-[4px] border px-4 py-3 text-[13px] ${
            feedback.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Aviso de categorias (B3): não silencia a falha de carregamento */}
      {categoriasErro && (
        <div
          role="status"
          className="mt-5 rounded-[4px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800"
        >
          {categoriasErro} As sugestões de categoria podem estar incompletas.
        </div>
      )}

      {/* Conteúdo */}
      <div className="mt-6">
        {loading ? (
          <CenteredMessage>Carregando produtos…</CenteredMessage>
        ) : error ? (
          <CenteredMessage>
            <p className="mb-3 text-red-700">{error}</p>
            <button onClick={() => refetch()} className="text-[13px] underline">
              Tentar novamente
            </button>
          </CenteredMessage>
        ) : filtered.length === 0 ? (
          <CenteredMessage>
            <Package className="mx-auto mb-3 h-8 w-8 text-[#1a1814]/30" />
            {products.length === 0 ? 'Nenhum produto cadastrado ainda.' : 'Nenhum produto com esse filtro.'}
          </CenteredMessage>
        ) : (
          <div className="space-y-3">
            {filtered.map((produto) => (
              <ProductRow
                key={produto.id}
                product={produto}
                mutating={mutatingId === produto.id}
                onEdit={() => setFormAberto({ mode: 'edit', product: produto })}
                onToggle={() => handleToggle(produto)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Painel lateral de formulário */}
      {formAberto && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => !submitting && setFormAberto(null)}
          />
          <aside className={panelClass}>
            <ProductForm
              mode={formAberto.mode}
              initial={formAberto.product}
              categories={categories}
              onSubmit={formAberto.mode === 'create' ? handleCreate : handleEdit}
              onCancel={() => setFormAberto(null)}
              submitting={submitting}
            />
          </aside>
        </>
      )}
    </div>
  );
}

function ProductRow({
  product,
  mutating,
  onEdit,
  onToggle,
}: {
  product: Product;
  mutating: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-[4px] border border-[#1a1814]/10 bg-[#f6f3ee] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium text-[#1a1814]">{product.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                product.is_active
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-[#1a1814]/8 text-[#1a1814]/50'
              }`}
            >
              {product.is_active ? 'Ativo' : 'Inativo'}
            </span>
            {product.category && (
              <span className="rounded-full bg-[#1a1814]/5 px-2 py-0.5 text-[11px] text-[#1a1814]/60">
                {product.category}
              </span>
            )}
          </div>
          {/* Estoque atual: omitir se current_stock não vier nos dados (decisão v1) */}
          {'current_stock' in product && (product as Product & { current_stock?: number }).current_stock != null && (
            <p className="mt-1 text-[13px] text-[#1a1814]/60">
              Estoque: {(product as Product & { current_stock?: number }).current_stock}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[16px] font-medium text-[#1a1814]">{formatMoney(product.price)}</span>
          <button
            onClick={onEdit}
            disabled={mutating}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#1a1814]/15 px-3 text-[13px] text-[#1a1814] transition hover:bg-[#1a1814]/5 disabled:opacity-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
          <button
            onClick={onToggle}
            disabled={mutating}
            className={`inline-flex h-9 items-center rounded-full px-3 text-[13px] font-medium transition disabled:opacity-50 ${
              product.is_active
                ? 'border border-[#1a1814]/15 text-[#1a1814] hover:bg-[#1a1814]/5'
                : 'bg-[#1a1814] text-[#f6f3ee] hover:bg-[#1a1814]/90'
            }`}
          >
            {mutating ? '…' : product.is_active ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[4px] border border-[#1a1814]/10 bg-[#f6f3ee] p-8 text-center text-[14px] text-[#1a1814]/65">
      {children}
    </div>
  );
}
