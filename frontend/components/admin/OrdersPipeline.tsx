'use client';

import { cn } from '@/lib/utils';
import { SectionTitle } from './SectionTitle';

const panelClassName =
  'rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_25px_90px_-60px_rgba(15,23,42,1)]';

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

interface OrdersPipelineProps {
  ordersByStatus: Record<string, number>;
  totalOrders: number;
}

export function OrdersPipeline({ ordersByStatus, totalOrders }: OrdersPipelineProps) {
  const entries = Object.entries(ordersByStatus);

  return (
    <div className={cn(panelClassName, 'p-6 sm:p-7')}>
      <SectionTitle
        eyebrow="pipeline"
        title="Pedidos por status"
        description="Uma visao limpa do que esta parado, avancando ou finalizado."
      />

      <div className="mt-6 space-y-3">
        {entries.length > 0 ? (
          entries.map(([status, value]) => {
            const percentage = ((value) / (totalOrders || 1)) * 100;
            return (
              <div key={status} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-foreground">
                    {getStatusLabel(status)}
                  </span>
                  <span className="text-sm font-semibold text-foreground">{value}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-cyan-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-muted-foreground">
            Ainda sem pedidos para distribuir por status.
          </div>
        )}
      </div>
    </div>
  );
}
