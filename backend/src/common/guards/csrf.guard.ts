import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

/**
 * CSRF Guard - Protege contra ataques CSRF
 * 
 * Valida que requisições POST/PUT/DELETE incluem token CSRF válido
 * GET/HEAD/OPTIONS são permitidos sem token (safe methods)
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Skip para métodos seguros (GET, HEAD, OPTIONS)
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }
    
    // Obter tokens
    const csrfToken = request.headers['x-csrf-token'] as string;
    const sessionToken = request.cookies?.['csrf-token'] || request.headers['x-csrf-session-token'];
    
    // Validar tokens
    if (!csrfToken || !sessionToken) {
      throw new ForbiddenException('CSRF token não fornecido');
    }
    
    if (csrfToken !== sessionToken) {
      throw new ForbiddenException('CSRF token inválido');
    }
    
    return true;
  }
}
