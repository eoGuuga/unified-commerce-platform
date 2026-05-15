/**
 * Helpers de produto especificos da experiencia loja/storefront:
 * estoque disponivel, palette visual e relevancia textual.
 */

export interface StockTone {
  label: string;
  detail: string;
  className: string;
}

export interface ProductPalette {
  gradient: string;
  accent: string;
  glow: string;
}

export const PRODUCT_PALETTES: ProductPalette[] = [
  {
    gradient: 'from-emerald-400/22 via-cyan-400/12 to-transparent',
    accent: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/20',
    glow: 'shadow-[0_22px_60px_-34px_rgba(16,185,129,0.65)]',
  },
  {
    gradient: 'from-sky-400/22 via-blue-400/12 to-transparent',
    accent: 'bg-sky-400/15 text-sky-200 border-sky-400/20',
    glow: 'shadow-[0_22px_60px_-34px_rgba(56,189,248,0.6)]',
  },
  {
    gradient: 'from-amber-300/22 via-orange-400/12 to-transparent',
    accent: 'bg-amber-300/15 text-amber-100 border-amber-300/20',
    glow: 'shadow-[0_22px_60px_-34px_rgba(251,191,36,0.55)]',
  },
  {
    gradient: 'from-fuchsia-400/22 via-violet-400/12 to-transparent',
    accent: 'bg-fuchsia-400/15 text-fuchsia-100 border-fuchsia-400/20',
    glow: 'shadow-[0_22px_60px_-34px_rgba(232,121,249,0.55)]',
  },
];

export function getProductPalette(index: number): ProductPalette {
  return PRODUCT_PALETTES[index % PRODUCT_PALETTES.length];
}

/**
 * Unidades disponiveis para venda - prefere available_stock (reservas
 * descontadas) se presente, cai para stock total.
 */
export function getAvailableUnits(
  product: { stock?: number; available_stock?: number },
): number {
  return Math.max(0, product.available_stock ?? product.stock ?? 0);
}

/**
 * Score de relevancia textual contra uma query de busca:
 *   3 = prefixo do nome
 *   2 = substring do nome
 *   1 = substring da descricao
 *   0 = sem match (ou query vazia)
 */
export function getRelevanceScore(
  product: { name: string; description?: string },
  query: string,
): number {
  if (!query) return 0;

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 0;

  const name = product.name.toLowerCase();
  const description = (product.description || '').toLowerCase();

  if (name.startsWith(normalizedQuery)) return 3;
  if (name.includes(normalizedQuery)) return 2;
  if (description.includes(normalizedQuery)) return 1;
  return 0;
}

/**
 * Tom visual + texto explicativo de acordo com o nivel de estoque.
 * Usado nos cards de produto da loja para sinalizar urgencia.
 */
export function getStockTone(stock: number, minStock = 0): StockTone {
  if (stock <= 0) {
    return {
      label: 'Sem estoque',
      detail: 'Reposicao em andamento',
      className: 'border-rose-400/25 bg-rose-400/10 text-rose-100',
    };
  }

  if ((minStock > 0 && stock <= minStock) || stock <= 3) {
    return {
      label: 'Ultimas unidades',
      detail: `${stock} disponiveis agora`,
      className: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
    };
  }

  return {
    label: 'Pronta entrega',
    detail: `${stock} disponiveis para venda`,
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
  };
}
