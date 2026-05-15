/**
 * Helpers de formatacao reutilizaveis (moeda, valores numericos pt-BR).
 * Antes ficavam inline em loja/page.tsx e pdv/page.tsx duplicados.
 */

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Parse de input monetario em formato brasileiro ("1.234,56" -> 1234.56).
 * Retorna NaN se o valor nao for um numero finito.
 */
export function parseCurrencyInput(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
