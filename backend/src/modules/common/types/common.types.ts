/**
 * Tipos comuns usados em múltiplos módulos
 */

/**
 * Interface para dados de auditoria (old/new)
 */
export interface AuditData {
  [key: string]: any;
}

/**
 * Interface para requisição HTTP tipada
 */
export interface TypedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    tenant_id: string;
  };
  headers: Headers & {
    'x-tenant-id'?: string;
    'x-csrf-token'?: string;
    'idempotency-key'?: string;
    authorization?: string;
  };
}

/**
 * Interface para corpo de webhook genérico
 */
export interface WebhookBody {
  [key: string]: any;
}

/**
 * Interface para resultado paginado
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * DTO base para paginação
 */
export class PaginationDto {
  page?: number = 1;
  limit?: number = 50;
}
