-- 010-idempotency-unique-tenant-operation.sql
-- Objetivo: idempotência correta em SaaS multi-tenant:
-- - key_hash NÃO pode ser globalmente unique
-- - deve ser unique por (tenant_id, operation_type, key_hash)

DO $$
BEGIN
  IF to_regclass('public.idempotency_keys') IS NULL THEN
    RETURN;
  END IF;

  -- Remover UNIQUE antigo de key_hash (pode ser constraint ou index dependendo do ambiente)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'idempotency_keys_key_hash_key') THEN
    EXECUTE 'ALTER TABLE idempotency_keys DROP CONSTRAINT idempotency_keys_key_hash_key';
  END IF;

  -- Alguns ambientes podem ter index único com nome diferente
  IF EXISTS (
    SELECT 1
      FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'idempotency_keys'
       AND indexname = 'idx_idempotency_key_hash'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS idx_idempotency_key_hash';
  END IF;

  -- Índice único correto (idempotência por tenant + operação)
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS ux_idempotency_tenant_operation_keyhash ON idempotency_keys(tenant_id, operation_type, key_hash)';
END
$$;

