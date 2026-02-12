-- Adds optional customer notes to pedidos
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS customer_notes VARCHAR(500);
