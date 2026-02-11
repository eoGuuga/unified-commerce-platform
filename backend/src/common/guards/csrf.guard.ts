import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

/**
 * CSRF Guard - Protege contra ataques CSRF.
 * Ativo apenas quando CSRF_ENABLED=true.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const enabled = String(process.env.CSRF_ENABLED || '').toLowerCase() === 'true';
    if (!enabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const path = (request.originalUrl || request.url || '').toString();

    // Webhooks externos não têm cookie/header CSRF.
    if (
      path.includes('/api/v1/whatsapp/webhook') ||
      path.includes('/api/v1/payments/webhook/mercadopago')
    ) {
      return true;
    }

    // Skip para metodos seguros (GET, HEAD, OPTIONS)
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    const csrfHeaderName = (process.env.CSRF_HEADER_NAME || 'x-csrf-token').toLowerCase();
    const csrfCookieName = process.env.CSRF_COOKIE_NAME || 'csrf-token';
    const csrfSessionHeaderName =
      (process.env.CSRF_SESSION_HEADER_NAME || 'x-csrf-session-token').toLowerCase();

    const headers = request.headers || {};
    const csrfToken = (headers as any)[csrfHeaderName] as string | undefined;
    const sessionToken =
      request.cookies?.[csrfCookieName] || (headers as any)[csrfSessionHeaderName];

    if (!csrfToken || !sessionToken) {
      throw new ForbiddenException('CSRF token nao fornecido');
    }

    if (csrfToken !== sessionToken) {
      throw new ForbiddenException('CSRF token invalido');
    }

    return true;
  }
}
