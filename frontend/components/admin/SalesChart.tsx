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

interface SalesChartProps {
  salesByDay: Array<{ date: string; value: number }>;
  maxSalesValue: number;
}

export function SalesChart({ salesByDay, maxSalesValue }: SalesChartProps) {
  return (
    <div className={cn(panelClassName, 'p-6 sm:p-7')}>
      <SectionTitle
        eyebrow="movimento comercial"
        title="Vendas nos ultimos dias"
        description="A leitura visual agora ajuda a perceber rapidamente onde a operacao acelerou ou esfriou."
      />

      {salesByDay.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-7">
          {salesByDay.map((day, index) => {
            const height = maxSalesValue > 0 ? (day.value / maxSalesValue) * 100 : 0;
            return (
              <div key={`${day.date}-${index}`} className="flex flex-col items-center gap-3">
                <div className="flex h-56 w-full items-end rounded-[26px] border border-white/10 bg-white/[0.04] p-3">
                  <div
                    className="w-full rounded-[18px] bg-gradient-to-t from-accent to-cyan-300 transition-all duration-500"
                    style={{ height: `${Math.max(height, 10)}%` }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {formatShortDate(day.date)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatCurrency(day.value)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-8 rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-10 text-center text-muted-foreground">
          Sem dados suficientes para desenhar a curva de vendas.
        </div>
      )}
    </div>
  );
}
