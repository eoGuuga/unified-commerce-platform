import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { ProductWithStock } from '../../products/types/product.types';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;

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

