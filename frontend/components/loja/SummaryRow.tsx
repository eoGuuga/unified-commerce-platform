import { cn } from '@/lib/utils';

interface SummaryRowProps {
  label: string;
  value: string;
  /** Quando true, destaca o valor com fonte maior e cor de foreground. */
  strong?: boolean;
}

/**
 * Linha de resumo (label a esquerda, valor a direita). Usada nos blocos
 * de subtotal/entrega/total do carrinho e checkout.
 */
export function SummaryRow({ label, value, strong = false }: SummaryRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 text-sm',
        strong ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <span>{label}</span>
      <span className={cn(strong && 'text-lg font-semibold tracking-tight')}>
        {value}
      </span>
    </div>
  );
}
