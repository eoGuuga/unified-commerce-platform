import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../database/entities/Usuario.entity';

export const ROLES_KEY = 'roles';

/**
 * Marca um handler/controller como restrito a um ou mais papeis (roles).
 * Usado em conjunto com o RolesGuard, que le `user.role` (do JWT validado)
 * e barra (403) quem nao estiver na lista.
 *
 * Ex.: @Roles(UserRole.ADMIN)
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
