import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private redisClient: Redis;

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {
    // Initialize Redis client if URL is provided
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      try {
        const isTest =
          process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';

        const redisOptions: RedisOptions = isTest
          ? {
              lazyConnect: true,
              retryStrategy: () => null,
              maxRetriesPerRequest: 0,
            }
          : {};

        this.redisClient = new Redis(redisUrl, redisOptions);
      } catch (error) {
        this.logger.warn('Redis initialization failed, health checks will skip Redis', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          context: { redisUrl: redisUrl ? 'configured' : 'not configured' },
        });
      }
    }
  }

  async onModuleDestroy() {
    if (!this.redisClient) return;
    try {
      await this.redisClient.quit();
    } catch {
      this.redisClient.disconnect();
    }
  }

  async check() {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'UCM Backend',
      version: '1.0.0',
      checks: {
        database: await this.checkDatabase(),
        redis: await this.checkRedis(),
      },
    };

    const allHealthy = Object.values(checks.checks).every((check: any) => check.status === 'ok');
    checks.status = allHealthy ? 'ok' : 'degraded';

    return checks;
  }

  async ready() {
    const dbCheck = await this.checkDatabase();
    const redisCheck = await this.checkRedis();

    const isReady = dbCheck.status === 'ok' && redisCheck.status === 'ok';

    return {
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck,
        redis: redisCheck,
      },
    };
  }

  async live() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<{ status: string; message?: string; responseTime?: number }> {
    try {
      const start = Date.now();
      await this.dataSource.query('SELECT 1');
      const responseTime = Date.now() - start;

      return {
        status: 'ok',
        message: 'Database connection successful',
        responseTime,
      };
    } catch (error) {
      this.logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { checkType: 'database' },
      });
      const errorMessage = error instanceof Error ? error.message : 'Database connection failed';
      return {
        status: 'error',
        message: errorMessage,
      };
    }
  }

  private async checkRedis(): Promise<{ status: string; message?: string; responseTime?: number }> {
    if (!this.redisClient) {
      return {
        status: 'skipped',
        message: 'Redis not configured',
      };
    }

    try {
      // Em modo de testes pode estar lazyConnect: conectar apenas uma vez (sem retry infinito)
      if ((this.redisClient as any).status === 'wait') {
        await this.redisClient.connect();
      }
      const start = Date.now();
      await this.redisClient.ping();
      const responseTime = Date.now() - start;

      return {
        status: 'ok',
        message: 'Redis connection successful',
        responseTime,
      };
    } catch (error) {
      this.logger.warn('Redis health check failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { checkType: 'redis' },
      });
      const errorMessage = error instanceof Error ? error.message : 'Redis connection failed';
      return {
        status: 'error',
        message: errorMessage,
      };
    }
  }
}
