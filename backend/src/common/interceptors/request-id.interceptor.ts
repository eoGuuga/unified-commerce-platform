import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const requestId =
      (req.headers['x-request-id'] as string) || randomUUID();

    (req as any).requestId = requestId;
    res.setHeader('x-request-id', requestId);

    return next.handle().pipe(
      tap({
        error: () => {
          if (!res.headersSent) {
            res.setHeader('x-request-id', requestId);
          }
        },
      }),
    );
  }
}
