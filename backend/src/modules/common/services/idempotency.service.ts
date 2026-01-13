import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { IdempotencyKey } from '../../../database/entities/IdempotencyKey.entity';
import { DbContextService } from './db-context.service';

@Injectable()
export class IdempotencyService {
  constructor(
    private readonly db: DbContextService,
  ) {}

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  async checkAndSet(
    tenantId: string,
    operationType: string,
    key: string,
    ttlSeconds = 3600,
  ): Promise<IdempotencyKey | null> {
    const idempotencyRepository = this.db.getRepository(IdempotencyKey);
    const keyHash = this.hashKey(key);

    // Verificar se chave já existe
    const existing = await idempotencyRepository.findOne({
      where: { tenant_id: tenantId, operation_type: operationType, key_hash: keyHash },
    });

    if (existing) {
      // Verificar se ainda está válida (não expirou)
      const now = new Date();
      if (now < existing.expires_at) {
        // ✅ IMPORTANTE: não lançar erro em "completed" aqui.
        // Quem chama (ex.: OrdersService) decide se retorna o resultado anterior
        // ou trata como conflito. Aqui retornamos o registro existente.
        return existing;
      }

      // Expirou, pode deletar e criar nova
      await idempotencyRepository.remove(existing);
    }

    // Criar nova chave
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + ttlSeconds);

    const idempotencyKey = idempotencyRepository.create({
      tenant_id: tenantId,
      key_hash: keyHash,
      operation_type: operationType,
      status: 'pending',
      expires_at: expiresAt,
    });

    try {
      return await idempotencyRepository.save(idempotencyKey);
    } catch (error: any) {
      // Race condition: outro request criou a chave antes (unique_violation)
      if (error && error.code === '23505') {
        const raced = await idempotencyRepository.findOne({
          where: { tenant_id: tenantId, operation_type: operationType, key_hash: keyHash },
        });
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  async markCompleted<T = unknown>(
    id: string,
    result: T,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.db.getRepository(IdempotencyKey).update(id, {
      status: 'completed',
      result: result as any, // TypeORM JSONB requer 'any'
      metadata: (metadata || {}) as Record<string, any>, // TypeORM JSONB requer 'any'
    });
  }

  async markFailed(id: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.db.getRepository(IdempotencyKey).update(id, {
      status: 'failed',
      metadata: (metadata || {}) as Record<string, any>, // TypeORM JSONB requer 'any'
    });
  }

  async remove(tenantId: string, key: string, operationType?: string): Promise<void> {
    const keyHash = this.hashKey(key);
    await this.db.getRepository(IdempotencyKey).delete({
      tenant_id: tenantId,
      key_hash: keyHash,
      ...(operationType ? { operation_type: operationType } : {}),
    } as any);
  }

  async cleanup(tenantId: string, olderThanDays = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.db
      .getRepository(IdempotencyKey)
      .createQueryBuilder()
      .delete()
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('created_at < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }
}
