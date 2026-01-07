import { IdempotencyKey } from '../../../database/entities/IdempotencyKey.entity';

/**
 * Interface para registro de idempotência tipado
 */
export interface IdempotencyRecord {
  id: string;
  tenant_id: string;
  key_hash: string;
  operation_type: string;
  status: 'pending' | 'completed' | 'failed';
  result?: any;
  expires_at: Date;
  created_at: Date;
  metadata: Record<string, any>;
}

/**
 * Helper para converter IdempotencyKey para IdempotencyRecord
 */
export function toIdempotencyRecord(key: IdempotencyKey): IdempotencyRecord {
  return {
    id: key.id,
    tenant_id: key.tenant_id,
    key_hash: key.key_hash,
    operation_type: key.operation_type,
    status: key.status,
    result: key.result,
    expires_at: key.expires_at,
    created_at: key.created_at,
    metadata: key.metadata || {},
  };
}
