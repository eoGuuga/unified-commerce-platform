/**
 * Types de produto, estoque e reservas.
 * Acompanha backend/src/database/entities/Produto.entity.ts e MovimentacaoEstoque.entity.ts.
 *
 * Nota: campos decimais (price, cost_price) vem do Postgres como string em algumas
 * configuracoes do TypeORM e como number em outras. Aceitamos ambos.
 */

export type Decimal = number | string;

export interface Product {
  id: string;
  tenant_id: string;
  categoria_id?: string;
  sku?: string;
  name: string;
  description?: string;
  price: Decimal;
  original_price?: Decimal;
  cost_price?: Decimal;
  unit: string;
  is_active: boolean;
  metadata?: Record<string, unknown>;
  image_url?: string;
  additional_images?: string[];
  category?: string;
  rating?: number;
  review_count?: number;
  discount?: number;
  features?: string[];
  /** Pode vir agregado dependendo do endpoint (stock summary, etc). */
  stock?: number;
  min_stock?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProductInput {
  name: string;
  price: Decimal;
  sku?: string;
  description?: string;
  cost_price?: Decimal;
  unit?: string;
  is_active?: boolean;
  categoria_id?: string;
  metadata?: Record<string, unknown>;
}

export type UpdateProductInput = Partial<CreateProductInput>;

export interface StockSummaryEntry {
  id: string;
  product_id: string;
  product_name: string;
  name: string;
  sku?: string;
  stock: number;
  current_stock: number;
  available_stock: number;
  reserved_stock: number;
  min_stock?: number;
  status: 'ok' | 'low' | 'out';
  /** Permite campos extras de relatorio que o backend possa adicionar. */
  [key: string]: unknown;
}

export interface StockSummary {
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  products?: StockSummaryEntry[];
  items?: StockSummaryEntry[];
  [key: string]: unknown;
}

export interface StockReservationResponse {
  product_id: string;
  reserved: number;
  available: number;
  [key: string]: unknown;
}

export interface StockAdjustmentResponse {
  product_id: string;
  delta: number;
  new_stock: number;
  reason?: string;
  [key: string]: unknown;
}
