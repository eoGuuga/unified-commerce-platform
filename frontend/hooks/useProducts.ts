'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api-client';
import type { Product, CreateProductInput, UpdateProductInput } from '@/lib/types/product';

interface UseProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Cria um produto no backend e insere na lista local. */
  create: (input: CreateProductInput) => Promise<{ ok: boolean; product?: Product; error?: string }>;
  /** Atualiza campos de um produto. SKU NUNCA é incluído no payload. */
  update: (id: string, input: UpdateProductInput) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Toggle de ativo/inativo — optimistic: altera is_active local imediatamente.
   * Em caso de erro da API, reverte para o valor anterior e retorna {ok:false}.
   */
  toggleActive: (id: string, next: boolean) => Promise<{ ok: boolean; error?: string }>;
  /** Id do produto cuja mutação está em andamento (para desabilitar botões). */
  mutatingId: string | null;
}

/**
 * Carrega e gerencia os produtos do tenant autenticado (tela de gestão do admin).
 */
export function useProducts(): UseProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await api.getProducts('');
      const list = Array.isArray(raw) ? raw : ((raw as { data?: Product[] })?.data ?? []);
      setProducts(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os produtos.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const create = useCallback(
    async (input: CreateProductInput): Promise<{ ok: boolean; product?: Product; error?: string }> => {
      try {
        const produto = await api.createProduct(input, '');
        setProducts((prev) => [produto, ...prev]);
        return { ok: true, product: produto };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Falha ao criar produto.',
        };
      }
    },
    [],
  );

  const update = useCallback(
    async (id: string, input: UpdateProductInput): Promise<{ ok: boolean; error?: string }> => {
      setMutatingId(id);
      try {
        // SKU é imutável pós-criação: garantir que nunca vai no payload de update.
        const { sku: _sku, ...payloadSemSku } = input as UpdateProductInput & { sku?: string };
        const atualizado = await api.updateProduct(id, payloadSemSku, '');
        setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...atualizado } : p)));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Falha ao atualizar produto.',
        };
      } finally {
        setMutatingId(null);
      }
    },
    [],
  );

  const toggleActive = useCallback(
    async (id: string, next: boolean): Promise<{ ok: boolean; error?: string }> => {
      // Optimistic: aplicar imediatamente na UI antes da resposta da API
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: next } : p)));
      setMutatingId(id);
      try {
        const atualizado = await api.updateProduct(id, { is_active: next }, '');
        setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...atualizado } : p)));
        return { ok: true };
      } catch (err) {
        // Reverter para o valor anterior em caso de erro da API
        setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: !next } : p)));
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Falha ao alterar status do produto.',
        };
      } finally {
        setMutatingId(null);
      }
    },
    [],
  );

  return { products, loading, error, refetch: fetchProducts, create, update, toggleActive, mutatingId };
}
