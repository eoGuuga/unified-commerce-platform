import { Injectable, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class JwtAuthGuardProd extends JwtAuthGuard {
  canActivate(context: ExecutionContext) {
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      return true;
    }
    return super.canActivate(context);
  }
}
