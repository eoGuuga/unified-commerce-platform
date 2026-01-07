-- ============================================
-- MIGRATION 004: Audit Log Metadata Column
-- ============================================
-- Data: 08/01/2025
-- Objetivo: Adicionar coluna metadata na tabela audit_log
-- ============================================

ALTER TABLE audit_log 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN audit_log.metadata IS 'Metadados adicionais do evento de auditoria';

-- ============================================
-- FIM DA MIGRATION
-- ============================================
