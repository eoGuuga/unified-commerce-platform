-- 009-rls-force-and-extra-policies.sql
-- Objetivo: RLS end-to-end (FORCE) + policies faltantes para tabelas do backend.
-- Importante: em produção, use um usuário de banco SEM superuser; superuser ainda bypassa RLS.

-- Função auxiliar: evita repetição (por convenção, mantemos em DO $$ ... $$ por tabela)

-- Tabelas base (já tinham ENABLE + policy no 002) -> apenas FORCE (idempotente)
DO $$
BEGIN
  IF to_regclass('public.produtos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE produtos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE produtos FORCE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.pedidos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE pedidos FORCE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.movimentacoes_estoque') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE movimentacoes_estoque ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE movimentacoes_estoque FORCE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.itens_pedido') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE itens_pedido ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE itens_pedido FORCE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.categorias') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE categorias ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE categorias FORCE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.usuarios') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE usuarios FORCE ROW LEVEL SECURITY';
  END IF;
END
$$;

-- pagamentos
DO $$
BEGIN
  IF to_regclass('public.pagamentos') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE pagamentos FORCE ROW LEVEL SECURITY';

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'pagamentos'
       AND policyname = 'pagamentos_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY pagamentos_tenant_isolation ON pagamentos
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    $p$;
  END IF;
END
$$;

-- cupons_desconto
DO $$
BEGIN
  IF to_regclass('public.cupons_desconto') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE cupons_desconto ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE cupons_desconto FORCE ROW LEVEL SECURITY';

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'cupons_desconto'
       AND policyname = 'cupons_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY cupons_tenant_isolation ON cupons_desconto
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    $p$;
  END IF;
END
$$;

-- audit_log
DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE audit_log FORCE ROW LEVEL SECURITY';

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'audit_log'
       AND policyname = 'audit_log_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY audit_log_tenant_isolation ON audit_log
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    $p$;
  END IF;
END
$$;

-- idempotency_keys
DO $$
BEGIN
  IF to_regclass('public.idempotency_keys') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY';

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'idempotency_keys'
       AND policyname = 'idempotency_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY idempotency_tenant_isolation ON idempotency_keys
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    $p$;
  END IF;
END
$$;

-- whatsapp_conversations
DO $$
BEGIN
  IF to_regclass('public.whatsapp_conversations') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE whatsapp_conversations FORCE ROW LEVEL SECURITY';

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'whatsapp_conversations'
       AND policyname = 'whatsapp_conversations_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY whatsapp_conversations_tenant_isolation ON whatsapp_conversations
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    $p$;
  END IF;
END
$$;

-- whatsapp_messages (não tem tenant_id; depende do tenant da conversa)
DO $$
BEGIN
  IF to_regclass('public.whatsapp_messages') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE whatsapp_messages FORCE ROW LEVEL SECURITY';

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'whatsapp_messages'
       AND policyname = 'whatsapp_messages_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY whatsapp_messages_tenant_isolation ON whatsapp_messages
        USING (
          EXISTS (
            SELECT 1
              FROM whatsapp_conversations c
             WHERE c.id = whatsapp_messages.conversation_id
               AND c.tenant_id = current_setting('app.current_tenant_id', true)::uuid
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1
              FROM whatsapp_conversations c
             WHERE c.id = whatsapp_messages.conversation_id
               AND c.tenant_id = current_setting('app.current_tenant_id', true)::uuid
          )
        )
    $p$;
  END IF;
END
$$;

