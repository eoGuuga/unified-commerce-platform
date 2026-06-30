/**
 * Montagem pura do payload de venda do PDV para `POST /orders`.
 *
 * Contrato (spec §6): { channel:'pdv', payment:{method}, items:[{produto_id, quantity, unit_price}], customer_name? }.
 * - unit_price = preco vigente carregado com o produto (o backend rejeita divergencia > 0,01).
 * - NAO enviar `amount` (servidor recalcula o total) nem delivery_type/endereco (balcao).
 * - customer_name default = "Cliente Balcão" (cliente anonimo do balcao).
 */

import type { CreateOrderInput, PdvPaymentMethod } from '../types/order';
import type { PdvCartItem } from './cart';

export const DEFAULT_PDV_CUSTOMER_NAME = 'Cliente Balcão';

export function buildPdvOrderPayload(
  items: PdvCartItem[],
  method: PdvPaymentMethod,
  customerName?: string,
): CreateOrderInput {
  const trimmed = (customerName ?? '').trim();
  return {
    channel: 'pdv',
    payment: { method },
    items: items.map((item) => ({
      produto_id: item.produto_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
    customer_name: trimmed || DEFAULT_PDV_CUSTOMER_NAME,
  };
}
