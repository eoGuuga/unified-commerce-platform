import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Usuario } from '../../../database/entities/Usuario.entity';

export const CurrentUser = createParamDecorator(
  (data: keyof Usuario | undefined, ctx: ExecutionContext): Usuario | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
