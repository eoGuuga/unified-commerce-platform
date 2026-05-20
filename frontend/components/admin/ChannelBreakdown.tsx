'use client';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { SectionTitle } from './SectionTitle';

const panelClassName =
  'rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_25px_90px_-60px_rgba(15,23,42,1)]';

function formatChannel(channel?: string) {
  const labels: Record<string, string> = {
    pdv: 'PDV',
    ecommerce: 'E-commerce',
    whatsapp: 'WhatsApp',
  };
  return channel ? labels[channel] || channel : 'Canal nao informado';
}

interface ChannelBreakdownProps {
  salesByChannel: Record<string, number>;
  totalSales: number;
}

export function ChannelBreakdown({ salesByChannel, totalSales }: ChannelBreakdownProps) {
  const entries = Object.entries(salesByChannel);

  return (
    <div className={cn(panelClassName, 'p-6 sm:p-7')}>
      <SectionTitle
        eyebrow="mix de canais"
        title="Quem esta puxando receita"
        description="Canal lider, distribuicao e participacao financeira lado a lado."
      />

      <div className="mt-6 space-y-4">
        {entries.length > 0 ? (
          entries.map(([channel, value]) => {
            const percentage = ((value) / (totalSales || 1)) * 100;
            return (
              <div key={channel} className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {formatChannel(channel)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatCurrency(value)} em vendas
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
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
            Os canais vao aparecer aqui assim que as vendas forem registradas.
          </div>
        )}
      </div>
    </div>
  );
}
