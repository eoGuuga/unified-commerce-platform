import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';

interface LogEntry {
  level: string;
  timestamp: string;
  context?: string;
  message: string;
  [key: string]: unknown;
}

@Injectable()
export class StructuredLogger extends ConsoleLogger {
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor() {
    super();
    console.log('[StructuredLogger] ===== LOGGER INITIALIZED =====');
  }

  private formatJson(level: string, message: unknown, context?: string, ...meta: unknown[]): string {
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      context: context || this.context || undefined,
      message: typeof message === 'string' ? message : JSON.stringify(message),
    };

    if (meta.length === 1 && typeof meta[0] === 'object' && meta[0] !== null) {
      Object.assign(entry, meta[0]);
    } else if (meta.length > 0) {
      entry.meta = meta;
    }

    return JSON.stringify(entry);
  }

  log(message: unknown, context?: string): void;
  log(message: unknown, ...optionalParams: unknown[]): void;
  log(message: unknown, ...optionalParams: unknown[]): void {
    if (!this.isProduction) {
      super.log(message, ...optionalParams);
      return;
    }
    const ctx = typeof optionalParams[0] === 'string' ? optionalParams[0] : undefined;
    process.stdout.write(this.formatJson('info', message, ctx) + '\n');
  }

  error(message: unknown, stackOrContext?: string): void;
  error(message: unknown, stack?: string, context?: string): void;
  error(message: unknown, ...optionalParams: unknown[]): void;
  error(message: unknown, ...optionalParams: unknown[]): void {
    console.log('[StructuredLogger] ===== ERROR LOG =====');
    console.log('[StructuredLogger] Message:', message);
    console.log('[StructuredLogger] Params:', optionalParams);
    if (!this.isProduction) {
      super.error(message, ...optionalParams);
      return;
    }
    const stack = typeof optionalParams[0] === 'string' ? optionalParams[0] : undefined;
    const ctx = typeof optionalParams[1] === 'string' ? optionalParams[1] : undefined;
    const entry = this.formatJson('error', message, ctx, ...(stack ? [{ stack }] : []));
    process.stderr.write(entry + '\n');
  }

  warn(message: unknown, context?: string): void;
  warn(message: unknown, ...optionalParams: unknown[]): void;
  warn(message: unknown, ...optionalParams: unknown[]): void {
    if (!this.isProduction) {
      super.warn(message, ...optionalParams);
      return;
    }
    const ctx = typeof optionalParams[0] === 'string' ? optionalParams[0] : undefined;
    process.stdout.write(this.formatJson('warn', message, ctx) + '\n');
  }

  debug(message: unknown, context?: string): void;
  debug(message: unknown, ...optionalParams: unknown[]): void;
  debug(message: unknown, ...optionalParams: unknown[]): void {
    if (!this.isProduction) {
      super.debug(message, ...optionalParams);
      return;
    }
    process.stdout.write(this.formatJson('debug', message) + '\n');
  }

  verbose(message: unknown, context?: string): void;
  verbose(message: unknown, ...optionalParams: unknown[]): void;
  verbose(message: unknown, ...optionalParams: unknown[]): void {
    if (!this.isProduction) {
      super.verbose(message, ...optionalParams);
      return;
    }
    process.stdout.write(this.formatJson('verbose', message) + '\n');
  }

  static getLogLevels(): LogLevel[] {
    if (process.env.NODE_ENV === 'production') {
      return ['log', 'warn', 'error'];
    }
    return ['log', 'warn', 'error', 'debug', 'verbose'];
  }
}
