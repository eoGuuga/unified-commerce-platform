import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../database/entities/Usuario.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard de autorizacao por papel (role). Le os papeis exigidos via @Roles(...)
 * e compara contra `user.role` (o usuario ja foi autenticado/validado pelo
 * JwtAuthGuard, que popula `request.user` a partir do banco sob RLS).
 *
 * FAIL-CLOSED: sem usuario ou sem role na lista -> 403. Se o handler nao declara
 * @Roles, o guard nao restringe (deixa passar para os demais guards decidirem);
 * portanto USE SEMPRE com @Roles(...) explicito na rota protegida.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sem @Roles declarado -> este guard nao restringe.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: UserRole } | undefined;

    // Fail-closed: usuario ausente ou role fora da lista -> 403.
    if (!user || !user.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Acesso restrito: requer papel de administrador.');
    }

    return true;
  }
}
