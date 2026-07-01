/**
 * Logica pura do carrinho do PDV (sem React, sem efeitos) — testavel em isolamento.
 *
 * Decisao travada (plano §Self-review): `dec` TRAVA no minimo 1. Remover um item
 * e sempre explicito via action `remove`, nunca um efeito colateral do `dec`.
 */

export interface PdvCartItem {
  produto_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  /** Estoque conhecido no momento de adicionar (para o selo/mitigacao na UI). */
  stock: number;
}

/** Produto minimo que a busca passa ao adicionar. */
export interface PdvAddableProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export type CartAction =
  | { type: 'add'; product: PdvAddableProduct }
  | { type: 'inc'; id: string }
  | { type: 'dec'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'clear' };

/** Arredonda para 2 casas evitando ruido de ponto flutuante (ex.: 0.1*3). */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function cartReducer(items: PdvCartItem[], action: CartAction): PdvCartItem[] {
  switch (action.type) {
    case 'add': {
      const { product } = action;
      const existing = items.find((i) => i.produto_id === product.id);
      if (existing) {
        return items.map((i) =>
          i.produto_id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...items,
        {
          produto_id: product.id,
          name: product.name,
          unit_price: product.price,
          quantity: 1,
          stock: product.stock,
        },
      ];
    }

    case 'inc':
      return items.map((i) =>
        i.produto_id === action.id ? { ...i, quantity: i.quantity + 1 } : i,
      );

    case 'dec':
      // Trava no minimo 1 — remover e explicito (action 'remove').
      return items.map((i) =>
        i.produto_id === action.id
          ? { ...i, quantity: Math.max(1, i.quantity - 1) }
          : i,
      );

    case 'remove':
      return items.filter((i) => i.produto_id !== action.id);

    case 'clear':
      return [];

    default:
      return items;
  }
}

/** Total da venda = Σ(unit_price * quantity), 2 casas decimais. */
export function cartTotal(items: PdvCartItem[]): number {
  return round2(items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0));
}

/** Troco = recebido - total (2 casas). Negativo quando recebido < total. */
export function calcChange(total: number, received: number): number {
  return round2(received - total);
}
