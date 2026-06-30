/**
 * stock-status.ts — Fonte ÚNICA de classificação de estoque.
 *
 * Todas as telas (selo, Início, StockManager) derivam badges da mesma
 * função. Blindagem: campo ausente/null NÃO cai silenciosamente em 'ok'
 * (mascararia bug de chave errada do summary) — trata-se como 'out'.
 */

export type StockStatus = 'ok' | 'low' | 'out';

/**
 * Fonte ÚNICA do status de estoque.
 * available = current_stock − reserved_stock (nunca current_stock puro).
 *
 * Blindagem: undefined/null/NaN → 'out' (nunca 'ok' silencioso).
 * min null/undefined → trata como 0 (produto sem mínimo definido).
 */
export function stockStatus(
  available: number | null | undefined,
  minStock: number | null | undefined,
): StockStatus {
  if (available == null || !Number.isFinite(available)) return 'out';
  const min = minStock == null || !Number.isFinite(minStock) ? 0 : minStock;
  if (available <= 0) return 'out';
  if (available <= min) return 'low';
  return 'ok';
}

/** Retorna true para status que exigem atenção (low ou out). */
export function isAttention(s: StockStatus): boolean {
  return s === 'low' || s === 'out';
}

/** Metadados de exibição por status — label PT-BR + classes Tailwind. */
export const STATUS_META: Record<StockStatus, { label: string; classes: string }> = {
  ok:  { label: 'OK',      classes: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  low: { label: 'Baixo',   classes: 'border-amber-200 bg-amber-50 text-amber-800' },
  out: { label: 'Esgotado', classes: 'border-red-200 bg-red-50 text-red-700' },
};
