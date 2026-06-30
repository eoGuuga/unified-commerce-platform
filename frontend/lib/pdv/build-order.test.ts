import { describe, it, expect } from 'vitest';
import { buildPdvOrderPayload } from './build-order';
import type { PdvCartItem } from './cart';

const items: PdvCartItem[] = [
  { produto_id: 'p1', name: 'Brigadeiro', unit_price: 2.5, quantity: 2, stock: 10 },
  { produto_id: 'p2', name: 'Beijinho', unit_price: 3, quantity: 1, stock: 5 },
];

describe('buildPdvOrderPayload', () => {
  it('monta o payload com channel "pdv" e payment.method', () => {
    const payload = buildPdvOrderPayload(items, 'dinheiro');
    expect(payload.channel).toBe('pdv');
    expect(payload.payment).toEqual({ method: 'dinheiro' });
  });

  it('mapeia itens para { produto_id, quantity, unit_price } com o preco do item', () => {
    const payload = buildPdvOrderPayload(items, 'pix');
    expect(payload.items).toEqual([
      { produto_id: 'p1', quantity: 2, unit_price: 2.5 },
      { produto_id: 'p2', quantity: 1, unit_price: 3 },
    ]);
  });

  it('usa "Cliente Balcao" como customer_name quando nenhum nome e dado', () => {
    const payload = buildPdvOrderPayload(items, 'debito');
    expect(payload.customer_name).toBe('Cliente Balcão');
  });

  it('usa "Cliente Balcao" quando o nome e vazio ou so espacos', () => {
    expect(buildPdvOrderPayload(items, 'credito', '').customer_name).toBe('Cliente Balcão');
    expect(buildPdvOrderPayload(items, 'credito', '   ').customer_name).toBe('Cliente Balcão');
  });

  it('preserva o nome digitado quando dado (trim das pontas)', () => {
    expect(buildPdvOrderPayload(items, 'dinheiro', 'Maria').customer_name).toBe('Maria');
    expect(buildPdvOrderPayload(items, 'dinheiro', '  Joao  ').customer_name).toBe('Joao');
  });

  it('nao envia amount/delivery_type/endereco (o backend recalcula o total)', () => {
    const payload = buildPdvOrderPayload(items, 'dinheiro');
    expect(payload).not.toHaveProperty('amount');
    expect(payload.delivery_type).toBeUndefined();
    expect(payload.delivery_address).toBeUndefined();
  });

  it('aceita os 4 metodos de pagamento do PDV', () => {
    for (const method of ['dinheiro', 'pix', 'debito', 'credito'] as const) {
      expect(buildPdvOrderPayload(items, method).payment).toEqual({ method });
    }
  });
});
