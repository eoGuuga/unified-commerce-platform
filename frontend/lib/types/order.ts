/**
 * Types de pedido (Order).
 * Acompanha backend/src/database/entities/Pedido.entity.ts.
 */

import type { Decimal, Product } from './product';

export type OrderStatus =
  | 'pendente_pagamento'
  | 'confirmado'
  | 'em_producao'
  | 'pronto'
  | 'em_transito'
  | 'entregue'
  | 'cancelado';

export type SalesChannel = 'pdv' | 'ecommerce' | 'whatsapp';

export interface DeliveryAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
}

export interface OrderItem {
  id: string;
  pedido_id: string;
  produto_id: string;
  quantity: number;
  unit_price: Decimal;
  subtotal: Decimal;
  /** Backend pode incluir produto agregado quando faz join. */
  produto?: Product;
  created_at?: string;
  [key: string]: unknown;
}

export interface Order {
  id: string;
  tenant_id: string;
  order_no: string;
  status: OrderStatus;
  channel: SalesChannel;
  seller_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_notes?: string;
  subtotal: Decimal;
  discount_amount: Decimal;
  shipping_amount: Decimal;
  coupon_code?: string;
  total_amount: Decimal;
  delivery_address?: DeliveryAddress;
  delivery_type?: string;
  itens?: OrderItem[];
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface CreateOrderItemInput {
  produto_id: string;
  quantity: number;
  unit_price?: Decimal;
}

export interface CreateOrderInput {
  channel: SalesChannel;
  items: CreateOrderItemInput[];
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_notes?: string;
  discount_amount?: Decimal;
  shipping_amount?: Decimal;
  coupon_code?: string;
  delivery_address?: DeliveryAddress;
  delivery_type?: string;
  [key: string]: unknown;
}

export interface OrderStatusUpdate {
  status: OrderStatus;
}

export interface SalesReportEntry {
  date?: string;
  channel?: SalesChannel;
  count?: number;
  revenue?: Decimal;
  [key: string]: unknown;
}

export interface SalesReport {
  entries?: SalesReportEntry[];
  total_revenue?: Decimal;
  total_orders?: number;
  [key: string]: unknown;
}

export interface PublicOrderTrackingResponse {
  order?: Order;
  status?: OrderStatus;
  status_history?: Array<{
    status: OrderStatus;
    changed_at: string;
    note?: string;
  }>;
  [key: string]: unknown;
}
