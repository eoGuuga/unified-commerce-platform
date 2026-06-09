'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  image_url?: string;
  category?: string;
  stock?: number;
  original_price?: number;
  description?: string;
}

/**
 * Hook simples para buscar produtos.
 * Por enquanto retorna array vazio (a API real sera integrada depois).
 */
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: integrar com API real
      // const response = await api.getProducts();
      setProducts([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { products, loading, error, refetch };
}
