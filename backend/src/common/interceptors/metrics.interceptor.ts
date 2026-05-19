import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Response } from 'express';
import { MetricsService } from '../../modules/health/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const res = context.switchToHttp().getResponse<Response>();
    const req = context.switchToHttp().getRequest();
    const method = req.method;

    return next.handle().pipe(
      tap({
        next: () => {
          this.metrics.recordRequest(method, res.statusCode);
        },
        error: () => {
          this.metrics.recordRequest(method, res.statusCode || 500);
        },
      }),
    );
  }
}
