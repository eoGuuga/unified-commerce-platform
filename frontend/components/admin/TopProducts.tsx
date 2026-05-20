'use client';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { SectionTitle } from './SectionTitle';

const panelClassName =
  'rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_25px_90px_-60px_rgba(15,23,42,1)]';

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
  rank: number;
}

interface TopProductsProps {
  topProducts: TopProduct[];
}

export function TopProducts({ topProducts }: TopProductsProps) {
  return (
    <div className={cn(panelClassName, 'p-6 sm:p-7')}>
      <SectionTitle
        eyebrow="performance"
        title="Top produtos"
        description="Os campeoes de giro aparecem com mais presenca e contexto comercial."
      />

      <div className="mt-6 space-y-3">
        {topProducts.length > 0 ? (
          topProducts.map((product) => (
            <div
              key={`${product.rank}-${product.name}`}
              className="flex items-center justify-between gap-4 rounded-[26px] border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex size-11 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-sm font-semibold text-accent">
                  {product.rank}
                </div>
                <div>
                  <p className="font-medium text-foreground">{product.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {product.quantity} unidades vendidas
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-foreground">
                  {formatCurrency(product.revenue)}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  receita
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-muted-foreground">
            Os produtos mais vendidos vao aparecer aqui assim que a operacao ganhar ritmo.
          </div>
        )}
      </div>
    </div>
  );
}
