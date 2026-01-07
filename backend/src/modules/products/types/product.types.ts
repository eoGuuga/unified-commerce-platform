/**
 * Tipos para produtos
 */

/**
 * Interface para produto com informações de estoque
 */
export interface ProductWithStock {
  id: string;
  tenant_id: string;
  categoria_id?: string;
  sku?: string;
  name: string;
  description?: string;
  price: string | number;
  cost_price?: number;
  unit?: string;
  is_active: boolean;
  stock: number;
  available_stock: number;
  reserved_stock: number;
  min_stock: number;
  categoria?: {
    id: string;
    name: string;
  };
  created_at: Date;
  updated_at: Date;
}
