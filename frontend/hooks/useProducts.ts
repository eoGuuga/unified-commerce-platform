'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image?: string;
  image_url?: string;
  category: string;
  stock: number;
  rating?: number;
}

/**
 * Formato cru vindo do backend (GET /products/public/catalog).
 * A entidade Produto e espalhada + campos de estoque adicionados pelo service.
 */
interface RawProduct {
  id: string;
  name: string;
  description?: string;
  price: number | string;
  categoria?: { name?: string } | null;
  image_url?: string;
  stock?: number;
  available_stock?: number;
}

/**
 * Converte o produto do backend para o formato usado pela loja.
 */
function mapProduct(raw: RawProduct): Product {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description || '',
    price: typeof raw.price === 'string' ? parseFloat(raw.price) : raw.price,
    image_url: raw.image_url,
    category: raw.categoria?.name || 'Geral',
    stock: raw.available_stock ?? raw.stock ?? 0,
  };
}

/**
 * Hook que carrega os produtos REAIS do catalogo publico da loja (por tenant).
 * Estados: loading enquanto busca, error em falha, lista vazia tratada pela UI.
 */
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = (await api.getPublicStoreProducts()) as unknown as RawProduct[];
      const list = Array.isArray(raw) ? raw : [];
      setProducts(list.map(mapProduct));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel carregar o cardapio. Tente novamente.',
      );
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}
