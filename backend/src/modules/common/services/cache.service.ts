import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis, { RedisOptions } from 'ioredis';
import { ProductWithStock } from '../../products/types/product.types';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;
  private readonly localLocks = new Map<string, string>();
  private warnedAboutLocalLockFallback = false;
  private readonly releaseLockScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    end
    return 0
  `;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    const isTest =
      process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';

    // ✅ Importante para testes: evitar retry infinito (gera timers/handles abertos e deixa Jest “pendurado”).
    const redisOptions: RedisOptions = isTest
      ? {
          lazyConnect: true,
          retryStrategy: () => null,
          maxRetriesPerRequest: 0,
        }
      : {};

    this.redis = new Redis(redisUrl, redisOptions);
  }

  async onModuleInit() {
    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis error: ${error}`);
    });

    // Se for lazyConnect (test), conectar explicitamente uma vez (sem retry).
    try {
      if ((this.redis as any).status === 'wait') {
        await this.redis.connect();
      }
    } catch (error) {
      // Não derrubar o app por Redis em testes/dev: cache é otimização, não requisito para funcionar.
      this.logger.warn(
        `Redis não conectou (${this.redis.options.host}:${this.redis.options.port}). Cache ficará desabilitado até próxima inicialização.`,
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }

  /**
   * Salva resposta no cache
   */
  async set<T = unknown>(
    key: string,
    value: T,
    ttlSeconds: number = 3600,
  ): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.redis.setex(key, ttlSeconds, serialized);
  }

  /**
   * Busca valor do cache
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Remove do cache
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Remove múltiplas chaves (pattern)
   */
  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private isRedisReady(): boolean {
    return this.redis.status === 'ready' || this.redis.status === 'connect';
  }

  private async sleep(milliseconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private tryAcquireLocalLock(lockKey: string, token: string): boolean {
    if (this.localLocks.has(lockKey)) {
      return false;
    }

    this.localLocks.set(lockKey, token);
    return true;
  }

  private releaseLocalLock(lockKey: string, token: string): void {
    if (this.localLocks.get(lockKey) === token) {
      this.localLocks.delete(lockKey);
    }
  }

  private async tryAcquireRedisLock(
    lockKey: string,
    token: string,
    ttlSeconds: number,
  ): Promise<'acquired' | 'busy' | 'unavailable'> {
    if (!this.isRedisReady()) {
      return 'unavailable';
    }

    try {
      const result = await this.redis.set(lockKey, token, 'EX', ttlSeconds, 'NX');
      return result === 'OK' ? 'acquired' : 'busy';
    } catch (error) {
      this.logger.warn(
        `Redis lock unavailable for ${lockKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 'unavailable';
    }
  }

  private async releaseRedisLock(lockKey: string, token: string): Promise<void> {
    try {
      await this.redis.eval(this.releaseLockScript, 1, lockKey, token);
    } catch (error) {
      this.logger.warn(
        `Failed to release Redis lock ${lockKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async withConversationLock<T>(
    tenantId: string,
    customerPhone: string,
    handler: () => Promise<T>,
    options?: {
      ttlSeconds?: number;
      waitTimeoutMs?: number;
      retryDelayMs?: number;
    },
  ): Promise<T> {
    const ttlSeconds = Math.max(options?.ttlSeconds ?? 45, 5);
    const waitTimeoutMs = Math.max(options?.waitTimeoutMs ?? 15000, 250);
    const retryDelayMs = Math.max(options?.retryDelayMs ?? 75, 10);
    const normalizedPhone =
      String(customerPhone || '').replace(/\D/g, '') || String(customerPhone || '').trim();
    const lockKey = `wa:conversation-lock:${tenantId}:${normalizedPhone}`;
    const token = randomUUID();
    const deadline = Date.now() + waitTimeoutMs;

    while (Date.now() <= deadline) {
      const redisAttempt = await this.tryAcquireRedisLock(lockKey, token, ttlSeconds);
      if (redisAttempt === 'acquired') {
        try {
          return await handler();
        } finally {
          await this.releaseRedisLock(lockKey, token);
        }
      }

      if (redisAttempt === 'unavailable') {
        if (!this.warnedAboutLocalLockFallback) {
          this.logger.warn(
            'Redis indisponivel para lock conversacional; usando fallback local nesta instancia.',
          );
          this.warnedAboutLocalLockFallback = true;
        }

        if (this.tryAcquireLocalLock(lockKey, token)) {
          try {
            return await handler();
          } finally {
            this.releaseLocalLock(lockKey, token);
          }
        }
      }

      await this.sleep(retryDelayMs);
    }

    throw new Error('CONVERSATION_LOCK_TIMEOUT');
  }

  /**
   * Cache de resposta de pergunta frequente
   * Chave: "faq:tenant_id:question_hash"
   */
  async cacheFaqResponse(
    tenantId: string,
    questionHash: string,
    response: string,
    ttlHours: number = 24,
  ): Promise<void> {
    const key = `faq:${tenantId}:${questionHash}`;
    await this.set(key, { response, cachedAt: Date.now() }, ttlHours * 3600);
  }

  /**
   * Busca resposta em cache de FAQ
   */
  async getCachedFaqResponse(
    tenantId: string,
    questionHash: string,
  ): Promise<string | null> {
    const key = `faq:${tenantId}:${questionHash}`;
    const cached = await this.get<{ response: string }>(key);
    return cached?.response || null;
  }

  /**
   * Cache de lista de produtos
   * Chave: "products:tenant_id"
   */
  async cacheProducts(
    tenantId: string,
    products: ProductWithStock[],
    ttlSeconds: number = 300, // 5 minutos
  ): Promise<void> {
    const key = `products:${tenantId}`;
    await this.set<ProductWithStock[]>(key, products, ttlSeconds);
  }

  /**
   * Busca produtos em cache
   */
  async getCachedProducts(tenantId: string): Promise<ProductWithStock[] | null> {
    const key = `products:${tenantId}`;
    return this.get<ProductWithStock[]>(key);
  }

  /**
   * Invalida cache de produtos (quando produto é criado/editado)
   */
  async invalidateProductsCache(tenantId: string): Promise<void> {
    const key = `products:${tenantId}`;
    await this.delete(key);
  }

  /**
   * Cache de estoque
   * Chave: "stock:tenant_id:product_id"
   */
  async cacheStock(
    tenantId: string,
    productId: string,
    stock: number,
    ttlSeconds: number = 10, // Cache muito curto (10s) para ser preciso
  ): Promise<void> {
    const key = `stock:${tenantId}:${productId}`;
    await this.set(key, stock, ttlSeconds);
  }

  /**
   * Busca estoque em cache
   */
  async getCachedStock(
    tenantId: string,
    productId: string,
  ): Promise<number | null> {
    const key = `stock:${tenantId}:${productId}`;
    return this.get<number>(key);
  }

  /**
   * Invalida cache de estoque (quando venda acontece)
   */
  async invalidateStockCache(tenantId: string, productId?: string): Promise<void> {
    if (productId) {
      const key = `stock:${tenantId}:${productId}`;
      await this.delete(key);
    } else {
      // Invalida todos os estoques do tenant
      await this.deletePattern(`stock:${tenantId}:*`);
    }
  }
}

