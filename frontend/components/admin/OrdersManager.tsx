'use client';

import { useMemo, useState, useEffect } from 'react';
import { RefreshCw, Package, Search, Bell } from 'lucide-react';
import { useAdminData } from '@/components/admin/shell/AdminDataProvider';
import { StatusBadge } from './StatusBadge';
import { getNextStatuses, getStatusMeta } from '@/lib/order-status';
import type { Order, OrderStatus } from '@/lib/types/order';

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  pdv: 'PDV',
  ecommerce: 'Online',
};

function formatMoney(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return `R$ ${n.toFixed(2)}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function OrdersManager() {
  // Consome dados do provider compartilhado (auth-gate fica no AdminShell)
  const {
    orders,
    ordersLoading: loading,
    ordersError: error,
    refetchOrders: refetch,
    updateOrderStatus: updateStatus,
    updatingOrderId: updatingId,
  } = useAdminData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'todos'>('todos');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Feedback de sucesso some sozinho apos 6s; erro fica ate o proximo clique.
  useEffect(() => {
    if (feedback?.kind !== 'ok') return;
    const id = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(id);
  }, [feedback]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'todos' && o.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        o.order_no?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.toLowerCase().includes(q)
      );
    });
  }, [orders, search, statusFilter]);

  async function handleAdvance(order: Order, next: OrderStatus) {
    setFeedback(null);
    const result = await updateStatus(order.id, next);
    if (result.ok) {
      const meta = getStatusMeta(next);
      setFeedback({
        kind: 'ok',
        text: `Pedido ${order.order_no} → ${meta.adminLabel}. Cliente notificado no WhatsApp.`,
      });
    } else {
      setFeedback({ kind: 'err', text: result.error ?? 'Falha ao atualizar.' });
    }
  }

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-10">
      {/* Cabecalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#1a1814]/50">Admin</p>
          <h1
            className="mt-2 text-[clamp(1.8rem,4vw,2.6rem)] font-normal leading-[1.05] tracking-[-0.03em] text-[#1a1814]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Pedidos
          </h1>
        </div>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 self-start rounded-full border border-[#1a1814]/15 px-4 text-[13px] font-medium text-[#1a1814] transition hover:bg-[#1a1814]/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {/* Filtros */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1a1814]/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nº, cliente ou telefone"
            className="h-11 w-full rounded-full border border-[#1a1814]/15 bg-[#f6f3ee] pl-10 pr-4 text-[14px] text-[#1a1814] outline-none transition focus:border-[#1a1814]/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'todos')}
          className="h-11 rounded-full border border-[#1a1814]/15 bg-[#f6f3ee] px-4 text-[14px] text-[#1a1814] outline-none transition focus:border-[#1a1814]/40"
        >
          <option value="todos">Todos os status</option>
          <option value="confirmado">Confirmado</option>
          <option value="em_producao">Em produção</option>
          <option value="pronto">Pronto</option>
          <option value="em_transito">Em trânsito</option>
          <option value="entregue">Entregue</option>
          <option value="pendente_pagamento">Aguardando pagamento</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`mt-5 flex items-start gap-2 rounded-[4px] border px-4 py-3 text-[13px] ${
            feedback.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.kind === 'ok' && <Bell className="mt-0.5 h-4 w-4 flex-shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Conteudo */}
      <div className="mt-6">
        {loading ? (
          <CenteredMessage>Carregando pedidos…</CenteredMessage>
        ) : error ? (
          <CenteredMessage>
            <p className="mb-3 text-red-700">{error}</p>
            <button onClick={() => refetch()} className="text-[13px] underline">
              Tentar novamente
            </button>
          </CenteredMessage>
        ) : filtered.length === 0 ? (
          <CenteredMessage>
            <Package className="mx-auto mb-3 h-8 w-8 text-[#1a1814]/30" />
            {orders.length === 0 ? 'Nenhum pedido ainda.' : 'Nenhum pedido com esse filtro.'}
          </CenteredMessage>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                updating={updatingId === order.id}
                onAdvance={handleAdvance}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderRow({
  order,
  updating,
  onAdvance,
}: {
  order: Order;
  updating: boolean;
  onAdvance: (order: Order, next: OrderStatus) => void;
}) {
  const nextStatuses = getNextStatuses(order.status);

  return (
    <div className="rounded-[4px] border border-[#1a1814]/10 bg-[#f6f3ee] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium text-[#1a1814]">#{order.order_no}</span>
            <StatusBadge status={order.status} admin />
            <span className="rounded-full bg-[#1a1814]/5 px-2 py-0.5 text-[11px] text-[#1a1814]/60">
              {CHANNEL_LABEL[order.channel] ?? order.channel}
            </span>
          </div>
          <p className="mt-1 truncate text-[13px] text-[#1a1814]/70">
            {order.customer_name || 'Cliente'}
            {order.customer_phone ? ` · ${order.customer_phone}` : ''}
            {' · '}
            {formatDate(order.created_at)}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[16px] font-medium text-[#1a1814]">{formatMoney(order.total_amount)}</span>
        </div>
      </div>

      {/* Acoes de avanco de status */}
      {nextStatuses.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#1a1814]/8 pt-4">
          {nextStatuses.map((next) => {
            const meta = getStatusMeta(next);
            const isCancel = next === 'cancelado';
            return (
              <button
                key={next}
                disabled={updating}
                onClick={() => onAdvance(order, next)}
                className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] font-medium transition disabled:opacity-50 ${
                  isCancel
                    ? 'border border-red-200 text-red-700 hover:bg-red-50'
                    : 'bg-[#1a1814] text-[#f6f3ee] hover:bg-[#1a1814]/90'
                }`}
              >
                {isCancel ? 'Cancelar' : `→ ${meta.adminLabel}`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[4px] border border-[#1a1814]/10 bg-[#f6f3ee] p-8 text-center text-[14px] text-[#1a1814]/65">
      {children}
    </div>
  );
}
