import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isDevelopment = process.env.NODE_ENV === 'development';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.constructor.name;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        error = responseObj.error || exception.constructor.name;
        details = responseObj.details || null;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.constructor.name;
    }

    // ✅ Segurança: nunca expor detalhes de erro interno em produção
    // - Em produção, qualquer erro 5xx retorna mensagem genérica
    // - Evita vazamento de mensagens do DB, stack traces, etc.
    if (!isDevelopment && status >= 500) {
      message = 'Internal server error';
      error = 'Internal Server Error';
      details = null;
    }

    // Log error
    const errorLog = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
      ...(details && { details }),
    };

    if (status >= 500) {
      this.logger.error('Internal Server Error', JSON.stringify(errorLog, null, 2));
    } else {
      this.logger.warn('Client Error', JSON.stringify(errorLog, null, 2));
    }

    const responseBody: any = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(isDevelopment && { error, ...(details && { details }) }),
    };

    response.status(status).json(responseBody);
  }
}
