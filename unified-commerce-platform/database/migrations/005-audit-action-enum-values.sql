-- ============================================
-- MIGRATION 005: Audit Action Enum Values
-- ============================================
-- Data: 09/01/2025
-- Objetivo: Adicionar novos valores ao enum audit_action
-- ============================================

-- Adicionar novos valores ao enum audit_action
-- CREATE: para criacao de registros
-- LOGIN: para login de usuarios
-- LOGOUT: para logout de usuarios

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'CREATE';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'LOGIN';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'LOGOUT';

-- Verificar valores do enum
-- SELECT enum_range(NULL::audit_action);
-- Resultado esperado: {INSERT,UPDATE,DELETE,CREATE,LOGIN,LOGOUT}

-- ============================================
-- FIM DA MIGRATION
-- ============================================
