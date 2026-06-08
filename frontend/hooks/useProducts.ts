'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/lib/types/product';
import { api } from '@/lib/api-client';

interface UseProductsOptions {
  tenantId?: string;
  category?: string;
  search?: string;
  limit?: number;
}

export function useProducts(options: UseProductsOptions = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async (filters: UseProductsOptions = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.getProducts(filters.tenantId);

      // Apply local filtering
      let filteredProducts = response;

      if (filters.category) {
        filteredProducts = filteredProducts.filter(p => p.category === filters.category);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredProducts = filteredProducts.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower) ||
          p.sku?.toLowerCase().includes(searchLower)
        );
      }

      if (filters.limit) {
        filteredProducts = filteredProducts.slice(0, filters.limit);
      }

      setProducts(filteredProducts);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar produtos');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchProducts(options);
  }, [JSON.stringify(options)]);

  const refetch = (newFilters?: UseProductsOptions) => {
    fetchProducts(newFilters || options);
  };

  const addProduct = (product: Product) => {
    setProducts(prev => [...prev, product]);
  };

  const updateProduct = (updatedProduct: Product) => {
    setProducts(prev =>
      prev.map(p => p.id === updatedProduct.id ? updatedProduct : p)
    );
  };

  const removeProduct = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  return {
    products,
    loading,
    error,
    refetch,
    addProduct,
    updateProduct,
    removeProduct,
    isEmpty: products.length === 0,
    hasProducts: products.length > 0,
  };
}