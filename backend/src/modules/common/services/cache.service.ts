import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
  }

  onModuleInit() {
    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis error: ${error}`);
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  /**
   * Salva resposta no cache
   */
  async set(
    key: string,
    value: any,
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
    products: any[],
    ttlSeconds: number = 300, // 5 minutos
  ): Promise<void> {
    const key = `products:${tenantId}`;
    await this.set(key, products, ttlSeconds);
  }

  /**
   * Busca produtos em cache
   */
  async getCachedProducts(tenantId: string): Promise<any[] | null> {
    const key = `products:${tenantId}`;
    return this.get<any[]>(key);
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

