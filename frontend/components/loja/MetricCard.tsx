import type { ReactNode } from 'react';

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}

/**
 * Card de metrica/KPI usado na vitrine da loja.
 * Mostra um icone, um label discreto, um numero/valor em destaque
 * e uma descricao curta.
 */
export function MetricCard({ icon, label, value, hint }: MetricCardProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="mb-4 inline-flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-accent">
        {icon}
      </div>
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}
