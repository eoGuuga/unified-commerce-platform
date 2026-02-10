-- 012-tenants-rls-policy.sql
-- Objetivo: garantir RLS e policy de leitura para tenants.

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE tenants ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE tenants FORCE ROW LEVEL SECURITY';

  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'tenants'
       AND policyname = 'tenants_read_all'
  ) THEN
    EXECUTE 'DROP POLICY tenants_read_all ON tenants';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'tenants'
       AND policyname = 'tenants_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY tenants_tenant_isolation ON tenants
        FOR SELECT
        USING (id = current_setting('app.current_tenant_id', true)::uuid)
    $p$;
  END IF;
END
$$;
