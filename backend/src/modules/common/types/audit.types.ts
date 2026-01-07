/**
 * Tipos para sistema de auditoria
 */

/**
 * Tipo para dados de auditoria (old/new) - permite JSON válido
 */
export type AuditData = Record<string, unknown> | unknown[] | string | number | boolean | null;

/**
 * Interface para parâmetros de log de auditoria
 */
export interface AuditLogParams {
  tenantId: string;
  userId?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
  tableName: string;
  recordId?: string;
  oldData?: AuditData;
  newData?: AuditData;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Interface para filtros de busca de audit log
 */
export interface AuditLogFilters {
  tenant_id: string;
  table_name: string;
  record_id?: string;
}
