-- ============================================
-- MIGRATION 011: Criar tabela PAGAMENTOS
-- ============================================
-- Esta migration cria a tabela pagamentos e seus tipos
-- caso não existam (idempotente)

-- Criar tipos ENUM se não existirem
DO $$
BEGIN
    -- Criar tipo pagamento_status se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pagamento_status') THEN
        CREATE TYPE pagamento_status AS ENUM (
            'pending',
            'processing',
            'paid',
            'failed',
            'refunded'
        );
    END IF;

    -- Criar tipo metodo_pagamento se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'metodo_pagamento') THEN
        CREATE TYPE metodo_pagamento AS ENUM (
            'dinheiro',
            'pix',
            'debito',
            'credito',
            'boleto'
        );
    END IF;
END $$;

-- Criar tabela pagamentos se não existir
CREATE TABLE IF NOT EXISTS pagamentos (
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

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_pagamentos_tenant ON pagamentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_pedido ON pagamentos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON pagamentos(status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_stripe ON pagamentos(stripe_payment_id) WHERE stripe_payment_id IS NOT NULL;

-- Comentários
COMMENT ON TABLE pagamentos IS 'Transações de pagamento';
COMMENT ON COLUMN pagamentos.transaction_id IS 'ID da transação no provedor de pagamento (ex: Mercado Pago)';
COMMENT ON COLUMN pagamentos.metadata IS 'Dados adicionais (QR Code Pix, link boleto, etc)';
