-- 008-usuarios-email-unique-por-tenant.sql
-- Objetivo: permitir o mesmo email em tenants diferentes (SaaS real)
-- e reforçar consistência com RLS e extração de tenant no login.

DO $$
BEGIN
  -- constraint default do Postgres quando email era UNIQUE
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_email_key') THEN
    EXECUTE 'ALTER TABLE usuarios DROP CONSTRAINT usuarios_email_key';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- tabela pode não existir em ambientes parciais
    NULL;
END
$$;

DROP INDEX IF EXISTS idx_usuarios_email;

-- Índice único correto para multi-tenant
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_tenant_email ON usuarios(tenant_id, email);

