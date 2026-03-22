-- 014-tenants-update-policy.sql
-- Objetivo: permitir que o app atualize o proprio tenant sob RLS.

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenants'
      AND policyname = 'tenants_tenant_update'
  ) THEN
    EXECUTE $p$
      CREATE POLICY tenants_tenant_update ON tenants
        FOR UPDATE
        USING (id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (id = current_setting('app.current_tenant_id', true)::uuid)
    $p$;
  END IF;
END
$$;
