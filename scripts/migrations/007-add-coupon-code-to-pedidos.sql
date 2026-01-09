-- 007-add-coupon-code-to-pedidos.sql
-- Persistir cupom aplicado no pedido (WhatsApp/PDV/ECOMMERCE)

ALTER TABLE IF EXISTS pedidos
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_pedidos_coupon_code
  ON pedidos (tenant_id, coupon_code)
  WHERE coupon_code IS NOT NULL;

