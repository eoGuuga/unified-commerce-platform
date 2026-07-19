'use client';

import { useState, useEffect, useCallback } from 'react';
import api, { normalizeApiError } from '@/lib/api-client';
import type { Order, OrderStatus } from '@/lib/types/order';

interface UseOrdersResult {
  orders: Order[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Avanca o status de um pedido. Backend valida a transicao e notifica o cliente no WhatsApp. */
  updateStatus: (orderId: string, status: OrderStatus) => Promise<{ ok: boolean; error?: string }>;
  /** Confirma manualmente o pagamento (pago na entrega) — via de ator `payment`. */
  confirmPayment: (orderId: string) => Promise<{ ok: boolean; error?: string }>;
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
      setError(
        normalizeApiError(err, {
          fallback: 'Não foi possível carregar os pedidos.',
        }),
      );
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
          error: normalizeApiError(err, { fallback: 'Falha ao atualizar o status.' }),
        };
      } finally {
        setUpdatingId(null);
      }
    },
    [],
  );

  /**
   * Confirma MANUALMENTE o pagamento de um pedido (pago na entrega: dinheiro
   * ou cartao). Dois saltos, porque o endpoint recebe o id do PAGAMENTO e o
   * painel lista PEDIDOS: busca os pagamentos do pedido -> confirma o que esta
   * pendente.
   *
   * Usa POST /payments/:id/confirm de proposito: e a UNICA via que confirma
   * com o ator `payment`, o unico que a politica do backend aceita pra
   * PENDENTE_PAGAMENTO -> CONFIRMADO. Chamar PATCH /orders/:id/status daqui
   * levaria 400 (ator `admin`).
   */
  const confirmPayment = useCallback(
    async (orderId: string): Promise<{ ok: boolean; error?: string }> => {
      setUpdatingId(orderId);
      try {
        const pagamentos = await api.getPaymentsByOrder(orderId);
        const pendente = pagamentos.find((p) => p.status === 'pending');
        if (!pendente) {
          // Fail-closed: sem pagamento pendente nao ha o que confirmar. Silenciar
          // aqui deixaria a lojista clicando num botao que nao faz nada.
          return {
            ok: false,
            error: 'Nenhum pagamento pendente neste pedido. Atualize a lista e tente de novo.',
          };
        }
        await api.confirmPayment(pendente.id, '');
        // Refetch completo: o backend move o pedido pra CONFIRMADO como efeito
        // da confirmacao, entao o status novo vem do servidor, nao de um palpite.
        await fetchOrders();
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: normalizeApiError(err, { fallback: 'Falha ao confirmar o pagamento.' }),
        };
      } finally {
        setUpdatingId(null);
      }
    },
    [fetchOrders],
  );

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders,
    updateStatus,
    confirmPayment,
    updatingId,
  };
}
