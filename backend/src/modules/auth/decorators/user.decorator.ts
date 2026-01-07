import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Usuario } from '../../../database/entities/Usuario.entity';

export const CurrentUser = createParamDecorator(
  <K extends keyof Usuario | undefined>(
    data: K,
    ctx: ExecutionContext,
  ): K extends keyof Usuario ? Usuario[K] : Usuario => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as Usuario;

    return (data ? user?.[data] : user) as K extends keyof Usuario ? Usuario[K] : Usuario;
  },
);
