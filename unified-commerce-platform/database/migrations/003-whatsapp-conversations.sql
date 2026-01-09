-- ============================================
-- MIGRATION 003: WhatsApp Conversations
-- ============================================
-- Data: 08/01/2025
-- Objetivo: Adicionar tabelas para conversas WhatsApp e contexto
-- ============================================

-- ============================================
-- TABELA: WHATSAPP_CONVERSATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'waiting_payment', 'order_placed', 'completed', 'abandoned')),
  context JSONB DEFAULT '{}',
  pedido_id UUID REFERENCES pedidos(id),
  started_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_tenant_status 
ON whatsapp_conversations(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_customer_tenant 
ON whatsapp_conversations(customer_phone, tenant_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_pedido 
ON whatsapp_conversations(pedido_id) 
WHERE pedido_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_active 
ON whatsapp_conversations(tenant_id, status, last_message_at) 
WHERE status IN ('active', 'waiting_payment');

-- ============================================
-- TABELA: WHATSAPP_MESSAGES
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'button')),
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_sent 
ON whatsapp_messages(conversation_id, sent_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_direction 
ON whatsapp_messages(conversation_id, direction, sent_at);

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE whatsapp_conversations IS 'Conversas do WhatsApp Bot com contexto e histórico';
COMMENT ON TABLE whatsapp_messages IS 'Mensagens individuais das conversas WhatsApp';

COMMENT ON INDEX idx_whatsapp_conversations_tenant_status IS 'Índice para buscar conversas por tenant e status';
COMMENT ON INDEX idx_whatsapp_messages_conversation_sent IS 'Índice para histórico de mensagens por conversa';

-- ============================================
-- FIM DA MIGRATION
-- ============================================
