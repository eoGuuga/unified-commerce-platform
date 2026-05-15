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
  cost_price?: Decimal;
  unit: string;
  is_active: boolean;
  metadata?: Record<string, unknown>;
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
  product_id: string;
  product_name: string;
  sku?: string;
  stock: number;
  min_stock?: number;
  reserved?: number;
  available?: number;
  /** Permite campos extras de relatorio que o backend possa adicionar. */
  [key: string]: unknown;
}

export interface StockSummary {
  items?: StockSummaryEntry[];
  total_products?: number;
  /** Algumas versoes retornam o array direto sem envelope. */
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
