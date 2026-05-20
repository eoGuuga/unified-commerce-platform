import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JourneyCardProps {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  tone: string;
  meta: string;
  actionLabel: string;
  onAction: () => void;
}

export function JourneyCard({
  icon,
  eyebrow,
  title,
  description,
  status,
  tone,
  meta,
  actionLabel,
  onAction,
}: JourneyCardProps) {
  return (
    <article className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="inline-flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-accent">
          {icon}
        </div>
        <span
          className={cn(
            'rounded-full border px-3 py-1.5 text-[0.7rem] font-medium uppercase tracking-[0.18em]',
            tone,
          )}
        >
          {status}
        </span>
      </div>

      <p className="mt-4 text-xs uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>

      <div className="mt-5 flex items-center justify-between gap-4">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{meta}</span>
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/30 hover:bg-white/[0.08]"
        >
          {actionLabel}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </article>
  );
}
