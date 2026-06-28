'use client';

/**
 * AdminDataProvider — contexto compartilhado do painel admin.
 *
 * Chama UMA instância de useOrders() e expõe os dados + stubs de estoque
 * (os campos de estoque são preenchidos pela T5a com useStock()).
 *
 * IMPORTANTE: erros de fetch NÃO propagam para o React error boundary —
 * o provider sempre renderiza children; consumers exibem seus próprios erros.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useOrders } from '@/hooks/useOrders';
import type { Order, OrderStatus } from '@/lib/types/order';

// ---- Tipos de estoque (stubs por ora; T5a preenche com useStock) ----

export interface StockSummary {
  totalSkus: number;
  attentionCount: number;
  [key: string]: unknown;
}

export interface StockHistoryItem {
  id: string;
  [key: string]: unknown;
}

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

  // Estoque — stubs explícitos; T5a substitui com useStock()
  summary: StockSummary | null;
  stockLoading: boolean;
  stockError: string | null;
  /** Nº de SKUs em atenção; undefined até T5a preencher. */
  attentionCount: undefined | number;
  history: (page?: number, limit?: number) => Promise<StockHistoryResult>;
  adjustStock: (productId: string, delta: number, reason?: string) => Promise<void>;
  setMin: (productId: string, min: number) => Promise<void>;
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

// ---- Stubs de estoque ----

const stubHistory: AdminDataContextValue['history'] = async () => ({ items: [], total: 0 });
const stubAdjustStock: AdminDataContextValue['adjustStock'] = async () => {};
const stubSetMin: AdminDataContextValue['setMin'] = async () => {};

// ---- Provider ----

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  // Uma única chamada useOrders() para todo o painel.
  // Erros ficam em ordersError — nunca são jogados para cima.
  const {
    orders,
    loading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
    updateStatus: updateOrderStatus,
    updatingId: updatingOrderId,
  } = useOrders();

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

      // Estoque — stubs (T5a preenche)
      summary: null,
      stockLoading: false,
      stockError: null,
      attentionCount: undefined,
      history: stubHistory,
      adjustStock: stubAdjustStock,
      setMin: stubSetMin,
    }),
    [orders, ordersLoading, ordersError, refetchOrders, updateOrderStatus, updatingOrderId, pedidosCount],
  );

  // Provider SEMPRE renderiza children — erros de fetch ficam em value.*Error
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}
