-- ============================================
-- SCHEMA INICIAL - Unified Commerce Platform
-- ============================================
-- Baseado em docs/04-DATABASE.md
-- PostgreSQL 15+ compatibility
-- Multitenancy com Row Level Security

-- ============================================
-- EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABELA: TENANTS (Multitenancy)
-- ============================================

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  owner_id UUID, -- Referência a usuario que criou
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_owner ON tenants(owner_id);

-- ============================================
-- TABELA: USUARIOS
-- ============================================

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  encrypted_password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'seller', -- admin, manager, seller, support
  full_name VARCHAR(255),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_tenant ON usuarios(tenant_id);
CREATE INDEX idx_usuarios_role ON usuarios(role);

-- ============================================
-- TABELA: CATEGORIAS
-- ============================================

CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_categorias_tenant ON categorias(tenant_id);

-- ============================================
-- TABELA: PRODUTOS
-- ============================================

CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES categorias(id),
  sku VARCHAR(100), -- Código único do produto
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  cost_price NUMERIC(10,2), -- Custo para calcular lucro
  unit VARCHAR(50) DEFAULT 'unidade', -- unidade, kg, litro, etc
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}', -- Imagens, tags, etc
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_produtos_tenant ON produtos(tenant_id);
CREATE INDEX idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX idx_produtos_sku ON produtos(sku);
CREATE INDEX idx_produtos_name ON produtos USING gin(to_tsvector('portuguese', name));

-- ============================================
-- TABELA: MOVIMENTACOES_ESTOQUE
-- ============================================

CREATE TABLE movimentacoes_estoque (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
  min_stock INTEGER DEFAULT 0, -- Alerta quando atingir
  last_updated TIMESTAMP DEFAULT NOW(),
  
  -- Garantir uma linha por produto por tenant
  UNIQUE(tenant_id, produto_id)
);

CREATE INDEX idx_estoque_tenant ON movimentacoes_estoque(tenant_id);
CREATE INDEX idx_estoque_produto ON movimentacoes_estoque(produto_id);
CREATE INDEX idx_estoque_min_stock ON movimentacoes_estoque(tenant_id, current_stock) WHERE current_stock <= min_stock;

-- ============================================
-- TABELA: PEDIDOS
-- ============================================

CREATE TYPE pedido_status AS ENUM (
  'pendente_pagamento',
  'confirmado',
  'em_producao',
  'pronto',
  'em_transito',
  'entregue',
  'cancelado'
);

CREATE TYPE canal_venda AS ENUM ('pdv', 'ecommerce', 'whatsapp');

CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_no VARCHAR(50) UNIQUE NOT NULL, -- PED-20241115-001
  status pedido_status DEFAULT 'pendente_pagamento',
  channel canal_venda NOT NULL,
  seller_id UUID REFERENCES usuarios(id), -- NULL se e-commerce/whatsapp
  
  -- Dados do cliente
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(20),
  
  -- Valores
  subtotal NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  shipping_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  
  -- Entrega
  delivery_address JSONB, -- {street, number, city, state, zipcode}
  delivery_type VARCHAR(50), -- pickup, delivery, express
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pedidos_tenant ON pedidos(tenant_id);
CREATE INDEX idx_pedidos_order_no ON pedidos(order_no);
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_channel ON pedidos(channel);
CREATE INDEX idx_pedidos_created ON pedidos(created_at DESC);

-- ============================================
-- TABELA: ITENS_PEDIDO
-- ============================================

CREATE TABLE itens_pedido (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL, -- Preço no momento da venda
  subtotal NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_itens_pedido_pedido ON itens_pedido(pedido_id);
CREATE INDEX idx_itens_pedido_produto ON itens_pedido(produto_id);

-- ============================================
-- TABELA: RESERVAS_ESTOQUE (Temporárias)
-- ============================================

CREATE TABLE reservas_estoque (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id),
  quantity INTEGER NOT NULL,
  expires_at TIMESTAMP NOT NULL, -- Auto-expira reservas antigas
  metadata JSONB DEFAULT '{}', -- Pedido associado, etc
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reservas_tenant ON reservas_estoque(tenant_id);
CREATE INDEX idx_reservas_produto ON reservas_estoque(produto_id);
CREATE INDEX idx_reservas_expires ON reservas_estoque(expires_at) WHERE expires_at > NOW();

-- ============================================
-- TABELA: PAGAMENTOS
-- ============================================

CREATE TYPE pagamento_status AS ENUM (
  'pending',
  'processing',
  'paid',
  'failed',
  'refunded'
);

CREATE TYPE metodo_pagamento AS ENUM (
  'dinheiro',
  'pix',
  'debito',
  'credito',
  'boleto'
);

CREATE TABLE pagamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pedido_id UUID NOT NULL REFERENCES pedidos(id),
  transaction_id VARCHAR(255) UNIQUE, -- Stripe payment intent ID
  method metodo_pagamento NOT NULL,
  status pagamento_status DEFAULT 'pending',
  amount NUMERIC(10,2) NOT NULL,
  stripe_payment_id VARCHAR(255), -- Link Stripe
  metadata JSONB DEFAULT '{}', -- Pix qr code, boleto, etc
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pagamentos_tenant ON pagamentos(tenant_id);
CREATE INDEX idx_pagamentos_pedido ON pagamentos(pedido_id);
CREATE INDEX idx_pagamentos_status ON pagamentos(status);
CREATE INDEX idx_pagamentos_stripe ON pagamentos(stripe_payment_id) WHERE stripe_payment_id IS NOT NULL;

-- ============================================
-- TABELA: CUPONS_DESCONTO
-- ============================================

CREATE TYPE tipo_desconto AS ENUM ('percentage', 'fixed');

CREATE TABLE cupons_desconto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type tipo_desconto NOT NULL,
  discount_value NUMERIC(10,2) NOT NULL,
  min_purchase_amount NUMERIC(10,2),
  max_discount_amount NUMERIC(10,2),
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cupons_tenant ON cupons_desconto(tenant_id);
CREATE INDEX idx_cupons_code ON cupons_desconto(code);

-- ============================================
-- TABELA: AUDIT_LOG (Inglês - padrão indústria)
-- ============================================

CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES usuarios(id),
  action audit_action NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_table ON audit_log(table_name, record_id);

-- ============================================
-- FUNÇÃO: Calcular Estoque Disponível
-- ============================================

CREATE OR REPLACE FUNCTION estoque_disponivel(p_tenant_id UUID, p_produto_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_current INTEGER;
  v_reserved INTEGER;
BEGIN
  SELECT current_stock, reserved_stock
  INTO v_current, v_reserved
  FROM movimentacoes_estoque
  WHERE tenant_id = p_tenant_id AND produto_id = p_produto_id;
  
  RETURN COALESCE(v_current, 0) - COALESCE(v_reserved, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Atualizar updated_at automaticamente
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pagamentos_updated_at BEFORE UPDATE ON pagamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- ATIVAR RLS EM TODAS AS TABELAS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupons_desconto ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- POLÍTICA: Usuários só vêem dados do próprio tenant
-- (Implementar após configurar JWT auth claims)

-- Exemplo para produtos:
-- CREATE POLICY produtos_tenant_isolation ON produtos
--   FOR SELECT
--   USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- ============================================
-- DADOS INICIAIS (SEED)
-- ============================================

-- Tenant de exemplo
INSERT INTO tenants (id, name, slug, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Loja de Exemplo',
  'exemplo',
  true
);

-- Usuário admin de exemplo
INSERT INTO usuarios (id, tenant_id, email, encrypted_password, role, full_name)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'admin@exemplo.com',
  crypt('admin123', gen_salt('bf')), -- bf = bcrypt, senha: admin123
  'admin',
  'Administrador Sistema'
);

-- Categorias de exemplo
INSERT INTO categorias (tenant_id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000000', 'Brigadeiros', 'Doces recheados'),
  ('00000000-0000-0000-0000-000000000000', 'Trufas', 'Trufas gourmet'),
  ('00000000-0000-0000-0000-000000000000', 'Bolos', 'Bolos artesanais');

-- ============================================
-- GRANTS (Permissões)
-- ============================================

-- Supabase usa roles diferentes, ajustar conforme necessário
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;

-- ============================================
-- COMENTÁRIOS (Documentação)
-- ============================================

COMMENT ON TABLE tenants IS 'Multitenancy - cada loja é um tenant';
COMMENT ON TABLE usuarios IS 'Usuários do sistema (vendedores, admin, etc)';
COMMENT ON TABLE produtos IS 'Catálogo de produtos da loja';
COMMENT ON TABLE movimentacoes_estoque IS 'Estoque atual de cada produto';
COMMENT ON TABLE pedidos IS 'Pedidos de venda (PDV, E-com, WhatsApp)';
COMMENT ON TABLE pagamentos IS 'Transações de pagamento';
COMMENT ON TABLE audit_log IS 'Log de auditoria de todas operações';

-- ============================================
-- FIM DO SCHEMA
-- ============================================