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

/** Metodos de pagamento aceitos no PDV (fast-pass). Boleto e proibido. */
export type PdvPaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito';

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
  /** Pagamento do PDV (fast-pass). O backend recalcula o valor; so o metodo vai no payload. */
  payment?: { method: PdvPaymentMethod };
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
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  salesByChannel: Record<string, number>;
  ordersByStatus: Record<string, number>;
  topProducts: Array<{ name: string; quantity: number; revenue: number; rank: number }>;
  salesByPeriod: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  salesByDay: Array<{ date: string; value: number }>;
  recentOrders: Array<{
    id: string;
    order_no: string;
    status: string;
    total_amount: string;
    created_at: string;
    channel?: string;
  }>;
  entries?: SalesReportEntry[];
  total_revenue?: Decimal;
  total_orders?: number;
  [key: string]: unknown;
}

export interface PublicOrderTrackingItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

/**
 * Resposta do endpoint publico GET-via-POST /orders/public/track.
 * Campos diretos e mascarados (o backend mascara email/telefone por privacidade).
 */
export interface PublicOrderTrackingResponse {
  id: string;
  order_no: string;
  status: OrderStatus;
  channel: SalesChannel;
  customer_name?: string;
  customer_email_masked?: string;
  customer_phone_masked?: string;
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  total_amount: number;
  coupon_code?: string;
  delivery_type?: string;
  delivery_address?: DeliveryAddress;
  created_at?: string;
  updated_at?: string;
  items: PublicOrderTrackingItem[];
  [key: string]: unknown;
}
