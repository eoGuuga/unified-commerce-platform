'use client';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { SectionTitle } from './SectionTitle';

const panelClassName =
  'rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_25px_90px_-60px_rgba(15,23,42,1)]';

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

function formatChannel(channel?: string) {
  const labels: Record<string, string> = {
    pdv: 'PDV',
    ecommerce: 'E-commerce',
    whatsapp: 'WhatsApp',
  };
  return channel ? labels[channel] || channel : 'Canal nao informado';
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendente_pagamento: 'Pendente pagamento',
    confirmado: 'Confirmado',
    em_producao: 'Em producao',
    pronto: 'Pronto',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  };
  return labels[status] || status;
}

function getStatusTone(status: string) {
  const tones: Record<string, string> = {
    pendente_pagamento: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    confirmado: 'border-sky-300/20 bg-sky-300/10 text-sky-100',
    em_producao: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    pronto: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    entregue: 'border-white/10 bg-white/[0.05] text-foreground',
    cancelado: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
  };
  return tones[status] || 'border-white/10 bg-white/[0.05] text-foreground';
}

interface Order {
  id: string;
  order_no: string;
  status: string;
  total_amount: string;
  created_at: string;
  channel?: string;
}

interface RecentOrdersProps {
  recentOrders: Order[];
}

export function RecentOrders({ recentOrders }: RecentOrdersProps) {
  return (
    <div className={cn(panelClassName, 'p-6 sm:p-7')}>
      <SectionTitle
        eyebrow="operacao"
        title="Pedidos recentes"
        description="Ultimos movimentos da base, com valor, canal e status mais legiveis."
      />

      <div className="mt-6 space-y-3">
        {recentOrders.length > 0 ? (
          recentOrders.map((order) => (
            <div key={order.id} className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-sm font-medium text-foreground">
                    {order.order_no}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatShortDate(order.created_at)} - {formatChannel(order.channel)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em]',
                      getStatusTone(order.status),
                    )}
                  >
                    {getStatusLabel(order.status)}
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(Number(order.total_amount))}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-muted-foreground">
            Nenhum pedido encontrado ainda.
          </div>
        )}
      </div>
    </div>
  );
}
