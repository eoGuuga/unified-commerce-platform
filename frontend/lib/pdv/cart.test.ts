import { describe, it, expect } from 'vitest';
import {
  cartReducer,
  cartTotal,
  calcChange,
  type PdvCartItem,
  type CartAction,
} from './cart';

const brigadeiro = { id: 'p1', name: 'Brigadeiro', price: 2.5, stock: 10 };
const beijinho = { id: 'p2', name: 'Beijinho', price: 3, stock: 5 };

function add(product: { id: string; name: string; price: number; stock: number }): CartAction {
  return { type: 'add', product };
}

describe('cartReducer', () => {
  it('add cria item com quantity 1 a partir do produto', () => {
    const items = cartReducer([], add(brigadeiro));
    expect(items).toEqual([
      { produto_id: 'p1', name: 'Brigadeiro', unit_price: 2.5, quantity: 1, stock: 10 },
    ]);
  });

  it('add repetido do mesmo produto incrementa a quantity (nao duplica linha)', () => {
    let items = cartReducer([], add(brigadeiro));
    items = cartReducer(items, add(brigadeiro));
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it('add de produto diferente cria uma nova linha', () => {
    let items = cartReducer([], add(brigadeiro));
    items = cartReducer(items, add(beijinho));
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.produto_id)).toEqual(['p1', 'p2']);
  });

  it('inc incrementa a quantity do item', () => {
    let items = cartReducer([], add(brigadeiro));
    items = cartReducer(items, { type: 'inc', id: 'p1' });
    expect(items[0].quantity).toBe(2);
  });

  it('dec decrementa a quantity do item', () => {
    let items = cartReducer([], add(brigadeiro));
    items = cartReducer(items, { type: 'inc', id: 'p1' }); // qty 2
    items = cartReducer(items, { type: 'dec', id: 'p1' }); // qty 1
    expect(items[0].quantity).toBe(1);
  });

  it('dec TRAVA no minimo 1 — nunca remove o item nem vai a 0', () => {
    let items = cartReducer([], add(brigadeiro)); // qty 1
    items = cartReducer(items, { type: 'dec', id: 'p1' });
    items = cartReducer(items, { type: 'dec', id: 'p1' });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1);
  });

  it('remove tira o item explicitamente do carrinho', () => {
    let items = cartReducer([], add(brigadeiro));
    items = cartReducer(items, add(beijinho));
    items = cartReducer(items, { type: 'remove', id: 'p1' });
    expect(items).toHaveLength(1);
    expect(items[0].produto_id).toBe('p2');
  });

  it('clear esvazia o carrinho', () => {
    let items = cartReducer([], add(brigadeiro));
    items = cartReducer(items, add(beijinho));
    items = cartReducer(items, { type: 'clear' });
    expect(items).toEqual([]);
  });

  it('inc/dec/remove em id inexistente nao quebra (no-op)', () => {
    const base = cartReducer([], add(brigadeiro));
    expect(cartReducer(base, { type: 'inc', id: 'nope' })).toEqual(base);
    expect(cartReducer(base, { type: 'dec', id: 'nope' })).toEqual(base);
    expect(cartReducer(base, { type: 'remove', id: 'nope' })).toEqual(base);
  });

  it('e puro — nao muta o array de entrada', () => {
    const base = cartReducer([], add(brigadeiro));
    const snapshot = JSON.parse(JSON.stringify(base));
    cartReducer(base, { type: 'inc', id: 'p1' });
    expect(base).toEqual(snapshot);
  });
});

describe('cartTotal', () => {
  it('soma unit_price * quantity de todos os itens', () => {
    let items = cartReducer([], add(brigadeiro)); // 2.5 x1
    items = cartReducer(items, { type: 'inc', id: 'p1' }); // 2.5 x2 = 5
    items = cartReducer(items, add(beijinho)); // + 3 = 8
    expect(cartTotal(items)).toBe(8);
  });

  it('arredonda para 2 casas decimais (sem ruido de ponto flutuante)', () => {
    const items = cartReducer([], add({ id: 'x', name: 'X', price: 0.1, stock: 10 }));
    const withMore = cartReducer(cartReducer(items, { type: 'inc', id: 'x' }), {
      type: 'inc',
      id: 'x',
    }); // 0.1 x3 = 0.30000000000000004 sem arredondamento
    expect(cartTotal(withMore)).toBe(0.3);
  });

  it('carrinho vazio tem total 0', () => {
    expect(cartTotal([])).toBe(0);
  });
});

describe('calcChange', () => {
  it('troco = recebido - total', () => {
    expect(calcChange(10, 50)).toBe(40);
  });

  it('arredonda o troco para 2 casas', () => {
    expect(calcChange(0.3, 1)).toBe(0.7);
  });

  it('recebido menor que o total da troco negativo (a UI bloqueia, mas o calculo e fiel)', () => {
    expect(calcChange(50, 10)).toBe(-40);
  });
});
