-- 006-idempotency.sql
-- Cria a tabela de idempotencia usada por OrdersService / IdempotencyService

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key_hash varchar(255) NOT NULL UNIQUE,
  operation_type varchar(50) NOT NULL,
  result jsonb NULL,
  status varchar(50) NOT NULL DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamp NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_idempotency_tenant_operation_created
  ON idempotency_keys (tenant_id, operation_type, created_at);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
  ON idempotency_keys (expires_at);

