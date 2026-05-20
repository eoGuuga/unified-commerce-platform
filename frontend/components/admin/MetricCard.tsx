import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const panelClassName =
  'rounded-[32px] border border-white/10 bg-white/[0.04] shadow-[0_25px_90px_-60px_rgba(15,23,42,1)]';

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}

export function MetricCard({ icon, label, value, hint }: MetricCardProps) {
  return (
    <div className={cn(panelClassName, 'p-5')}>
      <div className="mb-4 inline-flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-accent">
        {icon}
      </div>
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}
