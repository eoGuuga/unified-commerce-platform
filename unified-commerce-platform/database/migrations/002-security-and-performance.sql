-- ============================================
-- MIGRATION 002: Segurança e Performance
-- ============================================
-- Data: 08/01/2025
-- Objetivo: Adicionar índices, RLS e melhorias de segurança
-- ============================================

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

-- Índice composto para relatórios de pedidos
CREATE INDEX IF NOT EXISTS idx_pedidos_tenant_status_created 
ON pedidos(tenant_id, status, created_at DESC);

-- Índice para joins de itens de pedido
CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido_produto 
ON itens_pedido(pedido_id, produto_id);

-- Índice para busca de estoque
CREATE INDEX IF NOT EXISTS idx_estoque_tenant_produto 
ON movimentacoes_estoque(tenant_id, produto_id);

-- Índice parcial para produtos ativos
CREATE INDEX IF NOT EXISTS idx_produtos_tenant_active 
ON produtos(tenant_id, is_active) 
WHERE is_active = true;

-- Índice para audit_log (queries frequentes)
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created 
ON audit_log(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record 
ON audit_log(table_name, record_id) 
WHERE record_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- NOTA: RLS requer configuração de variável de sessão
-- Por enquanto, vamos habilitar RLS mas as policies serão implementadas
-- via código usando tenant_id do usuário autenticado

-- Habilitar RLS em todas as tabelas críticas
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Policy básica: Usuário só vê dados do seu tenant
-- (Será expandida quando implementarmos variável de sessão)

-- Policy para produtos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'produtos'
      AND policyname = 'produtos_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY produtos_tenant_isolation ON produtos
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    $p$;
  END IF;
END
$$;

-- Policy para pedidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pedidos'
      AND policyname = 'pedidos_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY pedidos_tenant_isolation ON pedidos
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    $p$;
  END IF;
END
$$;

-- Policy para estoque
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'movimentacoes_estoque'
      AND policyname = 'estoque_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY estoque_tenant_isolation ON movimentacoes_estoque
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    $p$;
  END IF;
END
$$;

-- Policy para itens de pedido (via JOIN com pedidos)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'itens_pedido'
      AND policyname = 'itens_pedido_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY itens_pedido_tenant_isolation ON itens_pedido
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM pedidos p
            WHERE p.id = itens_pedido.pedido_id
              AND p.tenant_id = current_setting('app.current_tenant_id', true)::uuid
          )
        )
    $p$;
  END IF;
END
$$;

-- Policy para categorias
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'categorias'
      AND policyname = 'categorias_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY categorias_tenant_isolation ON categorias
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    $p$;
  END IF;
END
$$;

-- Policy para usuários (só vê usuários do mesmo tenant)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'usuarios'
      AND policyname = 'usuarios_tenant_isolation'
  ) THEN
    EXECUTE $p$
      CREATE POLICY usuarios_tenant_isolation ON usuarios
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    $p$;
  END IF;
END
$$;

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON INDEX idx_pedidos_tenant_status_created IS 'Índice para relatórios de pedidos por tenant, status e data';
COMMENT ON INDEX idx_estoque_tenant_produto IS 'Índice para busca rápida de estoque';
COMMENT ON POLICY produtos_tenant_isolation ON produtos IS 'Isolamento multi-tenant para produtos';
COMMENT ON POLICY pedidos_tenant_isolation ON pedidos IS 'Isolamento multi-tenant para pedidos';

-- ============================================
-- FIM DA MIGRATION
-- ============================================
