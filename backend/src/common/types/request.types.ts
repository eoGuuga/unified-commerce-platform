import { Request } from 'express';
import { Usuario } from '../../database/entities/Usuario.entity';

/**
 * Interface para Request HTTP tipado com informações de usuário e tenant
 */
export interface TypedRequest extends Request {
  user?: Usuario;
  headers: Request['headers'] & {
    'x-tenant-id'?: string;
    'x-csrf-token'?: string;
    'idempotency-key'?: string;
    'authorization'?: string;
  };
}

/**
 * Interface para extrair IP Address do request
 */
export function getClientIp(req: TypedRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    (req.headers['x-real-ip'] as string) ||
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Interface para extrair User Agent do request
 */
export function getUserAgent(req: TypedRequest): string {
  return (req.headers['user-agent'] as string) || 'unknown';
}
