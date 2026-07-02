'use client';

/**
 * useStock — hook de dados de estoque (leitura + mutações).
 *
 * Modelado em useOrders. Uma única instância deve viver no AdminDataProvider;
 * consumidores (StockManager, AdminNav, Início) leem do contexto via useAdminData().
 *
 * Erro de getStockSummary é NÃO-FATAL: attentionCount vira undefined
 * (selo some), StockManager exibe seu próprio estado de erro com retry.
 *
 * T5b: adjust + setMin com optimistic update no estado compartilhado.
 * Quando o estado é do provider, o re-render propaga automaticamente
 * para o selo da aba (AdminNav) e para o número do Início.
 */

import { useState, useEffect, useCallback } from 'react';
import api, { normalizeApiError } from '@/lib/api-client';
import { stockStatus, isAttention } from '@/lib/stock-status';
import type { StockSummary, StockSummaryEntry } from '@/lib/types/product';

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

export interface AdjustResult {
  ok: boolean;
  error?: string;
  /** Código do erro tipado do backend (ex.: INSUFFICIENT_STOCK). */
  code?: string;
}

export interface UseStockResult {
  summary: StockSummary | null;
  stockLoading: boolean;
  stockError: string | null;
  refetchStock: () => Promise<void>;
  history: (productId: string, limit?: number, offset?: number) => Promise<StockHistoryResult>;
  /** Nº de SKUs em atenção (low + out). undefined quando fetch falhou (badge some). */
  attentionCount: number | undefined;
  /** Ajuste de estoque com optimistic update e revert fiel no erro. */
  adjustStock: (
    productId: string,
    tipo: 'COMPRA' | 'PERDA' | 'DEVOLUCAO' | 'AJUSTE',
    delta: number,
    motivo?: string,
  ) => Promise<AdjustResult>;
  /** Define estoque mínimo com optimistic update e revert fiel no erro. */
  setMin: (productId: string, min: number) => Promise<AdjustResult>;
}

/**
 * Aplica um ajuste otimista num produto dentro do summary.
 * Retorna um novo summary (não muta o original) e o snapshot do produto anterior
 * para que o rollback possa restaurar o estado exato.
 */
function aplicarOtimismoAjuste(
  summary: StockSummary,
  productId: string,
  delta: number,
): { novoSummary: StockSummary; snapshotProduto: StockSummaryEntry | null } {
  const lista = summary.products ?? summary.items ?? [];
  let snapshotProduto: StockSummaryEntry | null = null;

  const novaLista = lista.map((p) => {
    if (p.id !== productId) return p;
    snapshotProduto = { ...p };

    const novoCurrentStock = (p.current_stock ?? 0) + delta;
    // reserved_stock NÃO muda — apenas current e available.
    const novoAvailableStock = novoCurrentStock - (p.reserved_stock ?? 0);

    return {
      ...p,
      current_stock: novoCurrentStock,
      available_stock: novoAvailableStock,
    };
  });

  const novoSummary: StockSummary = summary.products
    ? { ...summary, products: novaLista }
    : { ...summary, items: novaLista };

  return { novoSummary, snapshotProduto };
}

/**
 * Aplica um ajuste otimista de min_stock num produto dentro do summary.
 * Retorna novo summary e snapshot do produto anterior.
 */
function aplicarOtimismoMinStock(
  summary: StockSummary,
  productId: string,
  novoMin: number,
): { novoSummary: StockSummary; snapshotProduto: StockSummaryEntry | null } {
  const lista = summary.products ?? summary.items ?? [];
  let snapshotProduto: StockSummaryEntry | null = null;

  const novaLista = lista.map((p) => {
    if (p.id !== productId) return p;
    snapshotProduto = { ...p };
    return { ...p, min_stock: novoMin };
  });

  const novoSummary: StockSummary = summary.products
    ? { ...summary, products: novaLista }
    : { ...summary, items: novaLista };

  return { novoSummary, snapshotProduto };
}

/**
 * Reverte um produto ao snapshot anterior no summary.
 */
function reverterSummary(
  summary: StockSummary,
  productId: string,
  snapshot: StockSummaryEntry,
): StockSummary {
  const lista = summary.products ?? summary.items ?? [];
  const novaLista = lista.map((p) => (p.id === productId ? snapshot : p));

  return summary.products
    ? { ...summary, products: novaLista }
    : { ...summary, items: novaLista };
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
        normalizeApiError(err, {
          fallback: 'Não foi possível carregar o estoque.',
        }),
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

  /**
   * Ajusta o estoque de um produto com optimistic update fiel.
   *
   * Fluxo:
   * 1. Salva snapshot do produto atual.
   * 2. Aplica o delta no estado (current_stock += delta, available = current - reserved).
   * 3. O re-render propaga para o selo da aba (AdminNav via provider) e para Início.
   * 4. Em erro: reverte o summary ao snapshot exato — badge volta ao status original.
   * 5. 422 com code === 'INSUFFICIENT_STOCK' retorna código específico para o UI.
   */
  const adjustStock = useCallback(
    async (
      productId: string,
      tipo: 'COMPRA' | 'PERDA' | 'DEVOLUCAO' | 'AJUSTE',
      delta: number,
      motivo?: string,
    ): Promise<AdjustResult> => {
      if (!summary) return { ok: false, error: 'Estoque não carregado.' };

      // 1. Snapshot + optimistic update
      const { novoSummary, snapshotProduto } = aplicarOtimismoAjuste(summary, productId, delta);
      setSummary(novoSummary);

      try {
        await api.adjustStock(productId, tipo, delta, motivo);
        return { ok: true };
      } catch (err) {
        // 3. Revert fiel — restaura o produto ao estado exato antes do optimismo.
        if (snapshotProduto) {
          setSummary((atual) =>
            atual ? reverterSummary(atual, productId, snapshotProduto!) : atual,
          );
        }

        const code = (err as Error & { code?: string }).code;
        const message = normalizeApiError(err, {
          fallback: 'Falha no ajuste de estoque.',
        });
        return { ok: false, error: message, code };
      }
    },
    [summary],
  );

  /**
   * Define o estoque mínimo de um produto com optimistic update fiel.
   *
   * Fluxo idêntico ao adjustStock: aplica otimismo → request → revert no erro.
   * O badge re-deriva automaticamente via stockStatus(available, novoMin).
   */
  const setMin = useCallback(
    async (productId: string, min: number): Promise<AdjustResult> => {
      if (!summary) return { ok: false, error: 'Estoque não carregado.' };

      // 1. Snapshot + optimistic update
      const { novoSummary, snapshotProduto } = aplicarOtimismoMinStock(summary, productId, min);
      setSummary(novoSummary);

      try {
        await api.setMinStock(productId, min);
        return { ok: true };
      } catch (err) {
        // Revert fiel
        if (snapshotProduto) {
          setSummary((atual) =>
            atual ? reverterSummary(atual, productId, snapshotProduto!) : atual,
          );
        }

        const code = (err as Error & { code?: string }).code;
        const message = normalizeApiError(err, {
          fallback: 'Falha ao definir estoque mínimo.',
        });
        return { ok: false, error: message, code };
      }
    },
    [summary],
  );

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
