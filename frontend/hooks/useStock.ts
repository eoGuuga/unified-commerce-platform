'use client';

/**
 * useStock — hook de dados de estoque (leitura).
 *
 * Modelado em useOrders. Uma única instância deve viver no AdminDataProvider;
 * consumidores (StockManager, AdminNav, Início) leem do contexto via useAdminData().
 *
 * Erro de getStockSummary é NÃO-FATAL: attentionCount vira undefined
 * (selo some), StockManager exibe seu próprio estado de erro com retry.
 */

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api-client';
import { stockStatus, isAttention } from '@/lib/stock-status';
import type { StockSummary } from '@/lib/types/product';

export interface StockHistoryItem {
  tipo: string;
  delta: number;
  saldo_resultante: number;
  motivo: string | null;
  created_at: string;
}

export interface StockHistoryResult {
  items: StockHistoryItem[];
  total: number;
}

export interface UseStockResult {
  summary: StockSummary | null;
  stockLoading: boolean;
  stockError: string | null;
  refetchStock: () => Promise<void>;
  history: (productId: string, limit?: number, offset?: number) => Promise<StockHistoryResult>;
  /** Nº de SKUs em atenção (low + out). undefined quando fetch falhou (badge some). */
  attentionCount: number | undefined;
  /** Stubs para T5b — preenchidos com mutações reais na T5b. */
  adjustStock: (productId: string, delta: number, reason?: string) => Promise<void>;
  setMin: (productId: string, min: number) => Promise<void>;
}

export function useStock(): UseStockResult {
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setStockLoading(true);
    setStockError(null);
    try {
      const data = await api.getStockSummary('');
      setSummary(data);
    } catch (err) {
      // Erro NÃO-FATAL: registra o erro mas não lança — provider permanece vivo.
      setStockError(
        err instanceof Error ? err.message : 'Não foi possível carregar o estoque.',
      );
      setSummary(null);
    } finally {
      setStockLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  /**
   * Conta produtos em atenção usando stock-status.ts (fonte única).
   * Chaves exatas do backend: available_stock e min_stock.
   * undefined quando summary é null (fetch falhou) — badge de aba some.
   */
  const attentionCount: number | undefined = summary
    ? (summary.products ?? summary.items ?? []).filter((p) =>
        isAttention(stockStatus(p.available_stock as number | null | undefined, p.min_stock as number | null | undefined)),
      ).length
    : undefined;

  const history = useCallback(
    async (productId: string, limit = 50, offset = 0): Promise<StockHistoryResult> => {
      return api.getStockHistory(productId, limit, offset);
    },
    [],
  );

  // Stubs para T5b
  const adjustStock = useCallback(async (_productId: string, _delta: number, _reason?: string) => {
    // T5b implementa: otimismo, rollback, 422 tipado
  }, []);

  const setMin = useCallback(async (_productId: string, _min: number) => {
    // T5b implementa: otimismo, rollback
  }, []);

  return {
    summary,
    stockLoading,
    stockError,
    refetchStock: fetchSummary,
    history,
    attentionCount,
    adjustStock,
    setMin,
  };
}
