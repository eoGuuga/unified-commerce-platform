import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Decorator para extrair tenant_id do usuário autenticado
 * Garante que usuário só acessa dados do seu próprio tenant
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    if (!user.tenant_id) {
      throw new ForbiddenException('Usuário sem tenant_id associado');
    }

    // Sempre usar tenant_id do usuário autenticado (não confiar em query params)
    return user.tenant_id;
  },
);
