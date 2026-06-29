'use client';

/**
 * AdminDataProvider — contexto compartilhado do painel admin.
 *
 * Chama UMA instância de useOrders() e UMA instância de useStock().
 * Todos os consumidores (selo, Início, StockManager) leem o MESMO estado.
 *
 * Erros de fetch NÃO propagam para o React error boundary —
 * o provider sempre renderiza children; consumers exibem seus próprios erros.
 *
 * stockError NÃO-FATAL: um erro em getStockSummary seta stockError,
 * attentionCount vira undefined (selo de Estoque some) e as demais telas
 * (Pedidos, Produtos) continuam vivas — a casca não é derrubada.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { useStock } from '@/hooks/useStock';
import type { Order, OrderStatus } from '@/lib/types/order';
import type { StockSummary } from '@/lib/types/product';
import type { StockHistoryItem, AdjustResult } from '@/hooks/useStock';

export type { StockHistoryItem };

export interface StockHistoryResult {
  items: StockHistoryItem[];
  total: number;
}

// ---- Tipo completo do contexto ----

export interface AdminDataContextValue {
  // Pedidos
  orders: Order[];
  ordersLoading: boolean;
  ordersError: string | null;
  refetchOrders: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<{ ok: boolean; error?: string }>;
  updatingOrderId: string | null;
  /** Nº de pedidos novos/pendentes (para o selo da aba Pedidos). */
  pedidosCount: number;

  // Estoque — preenchidos pelo useStock() real (T5a)
  summary: StockSummary | null;
  stockLoading: boolean;
  stockError: string | null;
  refetchStock: () => Promise<void>;
  /** Nº de SKUs em atenção; undefined quando fetch falhou (badge some). */
  attentionCount: number | undefined;
  history: (productId: string, limit?: number, offset?: number) => Promise<StockHistoryResult>;
  /** Mutações de estoque com optimistic update (T5b). */
  adjustStock: (
    productId: string,
    tipo: 'COMPRA' | 'PERDA' | 'DEVOLUCAO' | 'AJUSTE',
    delta: number,
    motivo?: string,
  ) => Promise<AdjustResult>;
  setMin: (productId: string, min: number) => Promise<AdjustResult>;
}

// ---- Status que contam pro selo de "novos pedidos" ----
const STATUS_NOVOS: OrderStatus[] = ['pendente_pagamento', 'confirmado'];

// ---- Contexto ----

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

/** Consome o AdminDataContext. Lança se usado fora do AdminDataProvider. */
export function useAdminData(): AdminDataContextValue {
  const ctx = useContext(AdminDataContext);
  if (!ctx) {
    throw new Error(
      'useAdminData() deve ser usado dentro de <AdminDataProvider>. ' +
        'Verifique se o componente está dentro do AdminShell.',
    );
  }
  return ctx;
}

// ---- Provider ----

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  // Uma única chamada useOrders() para todo o painel.
  const {
    orders,
    loading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
    updateStatus: updateOrderStatus,
    updatingId: updatingOrderId,
  } = useOrders();

  // Uma única chamada useStock() para todo o painel.
  // stockError é NÃO-FATAL: attentionCount → undefined (badge some),
  // as demais telas seguem vivas.
  const {
    summary,
    stockLoading,
    stockError,
    refetchStock,
    attentionCount,
    history,
    adjustStock,
    setMin,
  } = useStock();

  const pedidosCount = useMemo(
    () => orders.filter((o) => STATUS_NOVOS.includes(o.status)).length,
    [orders],
  );

  const value = useMemo<AdminDataContextValue>(
    () => ({
      // Pedidos
      orders,
      ordersLoading,
      ordersError,
      refetchOrders,
      updateOrderStatus,
      updatingOrderId,
      pedidosCount,

      // Estoque — dados reais do useStock() (T5a)
      summary,
      stockLoading,
      stockError,
      refetchStock,
      attentionCount,
      history,
      adjustStock,
      setMin,
    }),
    [
      orders,
      ordersLoading,
      ordersError,
      refetchOrders,
      updateOrderStatus,
      updatingOrderId,
      pedidosCount,
      summary,
      stockLoading,
      stockError,
      refetchStock,
      attentionCount,
      history,
      adjustStock,
      setMin,
    ],
  );

  // Provider SEMPRE renderiza children — erros de fetch ficam em value.*Error
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}
