/**
 * Prova de seguranca: PATCH /tenants/branding e restrito a ADMIN (broken access
 * control fechado). Antes, qualquer usuario autenticado do tenant (ex.: seller)
 * podia trocar logo/cor/nome/tagline da loja. Aqui usamos o RolesGuard REAL + o
 * handler REAL de updateBranding (com sua metadata @Roles) e provamos:
 *  - seller -> 403;  admin -> passa;  e a rota realmente declara @Roles(ADMIN).
 */
import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { TenantsController } from './tenants.controller';
import { UserRole } from '../../database/entities/Usuario.entity';

// eslint-disable-next-line @typescript-eslint/ban-types
function contextFor(handler: Function, user: unknown): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => TenantsController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PATCH /tenants/branding — restrito a ADMIN', () => {
  const guard = new RolesGuard(new Reflector());
  const handler = TenantsController.prototype.updateBranding;

  it('🎯 um seller autenticado e barrado (403)', () => {
    expect(() =>
      guard.canActivate(contextFor(handler, { role: UserRole.SELLER })),
    ).toThrow(ForbiddenException);
  });

  it('um admin passa', () => {
    expect(guard.canActivate(contextFor(handler, { role: UserRole.ADMIN }))).toBe(true);
  });

  it('sanity: a rota realmente declara @Roles(ADMIN)', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const roles = Reflect.getMetadata(ROLES_KEY, handler);
    expect(roles).toEqual([UserRole.ADMIN]);
  });
});
