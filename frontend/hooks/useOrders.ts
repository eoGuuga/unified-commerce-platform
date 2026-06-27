'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api-client';
import type { Order, OrderStatus } from '@/lib/types/order';

interface UseOrdersResult {
  orders: Order[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Avanca o status de um pedido. Backend valida a transicao e notifica o cliente no WhatsApp. */
  updateStatus: (orderId: string, status: OrderStatus) => Promise<{ ok: boolean; error?: string }>;
  /** Id do pedido cuja atualizacao esta em andamento (para desabilitar botoes). */
  updatingId: string | null;
}

/**
 * Carrega e gerencia os pedidos do tenant autenticado (tela de gestao do admin).
 * A atualizacao de status delega ao backend, que ja valida a state machine e
 * dispara a notificacao WhatsApp — aqui so refletimos o resultado na UI.
 */
export function useOrders(): UseOrdersResult {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await api.getOrders('');
      const list = Array.isArray(raw) ? raw : ((raw as { data?: Order[] })?.data ?? []);
      setOrders(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os pedidos.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const updateStatus = useCallback(
    async (orderId: string, status: OrderStatus): Promise<{ ok: boolean; error?: string }> => {
      setUpdatingId(orderId);
      try {
        const updated = await api.updateOrderStatus(orderId, status);
        // Atualiza o pedido localmente sem refazer o fetch inteiro (UI responsiva).
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, ...updated, status } : o)),
        );
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Falha ao atualizar o status.',
        };
      } finally {
        setUpdatingId(null);
      }
    },
    [],
  );

  return { orders, loading, error, refetch: fetchOrders, updateStatus, updatingId };
}
