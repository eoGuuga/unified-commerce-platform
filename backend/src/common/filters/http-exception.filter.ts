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

  /**
   * Remove a query string (e um eventual fragmento) do path antes de logar ou
   * devolver ao cliente. A query e onde params sensiveis vivem (ex.: o
   * `?hub.verify_token=...` do webhook da Meta), e o mascaramento de >=500 so
   * cobria message/error/details — nao o path. Guardamos so o pathname; o
   * `requestId` ja correlaciona a requisicao pro diagnostico.
   */
  private sanitizePath(url: string): string {
    return (url || '').split(/[?#]/)[0];
  }

  /**
   * Camada 5b: quando o `message` embute a URL CRUA da requisicao (com query) —
   * o caso classico e o 404 default do Nest ("Cannot GET /rota?query") — remove
   * a query dessa URL, mantendo rota + verbo pro debug. Mesma filosofia da
   * `sanitizePath`: fecha a CLASSE (qualquer message que ecoa a URL da
   * requisicao), nao uma denylist de params. Substituicao LITERAL da string
   * conhecida (`request.url`) => zero falso-positivo em mensagens de negocio.
   * Mensagens nao-string (ex.: array de erros de validacao) nao carregam a URL,
   * entao passam intactas.
   */
  private sanitizeMessage(message: unknown, url: string): unknown {
    if (typeof message !== 'string' || !url) return message;
    const cleanPath = this.sanitizePath(url);
    if (url === cleanPath) return message; // URL sem query — nada a remover
    return message.split(url).join(cleanPath);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isDevelopment = process.env.NODE_ENV === 'development';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';
    let details: any = null;
    // Codigo de erro tipado opcional (ex.: INSUFFICIENT_STOCK) — preservado p/ o frontend.
    let code: string | null = null;

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
        code = responseObj.code || null;
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

    // Camada 5b: se o message embute a URL crua (com query) — ex.: o 404 default
    // "Cannot GET /rota?query" — remove a query (mantem rota+verbo pro debug).
    // (cast: `message` e tipado string, mas em runtime pode ser array de erros
    // de validacao — o helper devolve nao-strings intactos.)
    message = this.sanitizeMessage(message, request.url) as string;

    // Log error
    const errorLog = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: this.sanitizePath(request.url),
      method: request.method,
      requestId: (request as any).requestId || null,
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
      path: this.sanitizePath(request.url),
      message,
      ...(code && { code }),
      ...(isDevelopment && { error, ...(details && { details }) }),
    };

    response.status(status).json(responseBody);
  }
}
