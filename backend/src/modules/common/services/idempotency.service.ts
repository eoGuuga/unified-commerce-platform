import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { IdempotencyKey } from '../../../database/entities/IdempotencyKey.entity';

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private idempotencyRepository: Repository<IdempotencyKey>,
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
    const keyHash = this.hashKey(key);

    // Verificar se chave já existe
    const existing = await this.idempotencyRepository.findOne({
      where: { key_hash: keyHash },
    });

    if (existing) {
      // Verificar se ainda está válida (não expirou)
      const now = new Date();
      if (now < existing.expires_at) {
        if (existing.status === 'completed') {
          throw new ConflictException(
            `Operação já foi processada. Key: ${key}`,
          );
        }
        // Ainda pendente, retornar existente
        return existing;
      }

      // Expirou, pode deletar e criar nova
      await this.idempotencyRepository.remove(existing);
    }

    // Criar nova chave
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + ttlSeconds);

    const idempotencyKey = this.idempotencyRepository.create({
      tenant_id: tenantId,
      key_hash: keyHash,
      operation_type: operationType,
      status: 'pending',
      expires_at: expiresAt,
    });

    return this.idempotencyRepository.save(idempotencyKey);
  }

  async markCompleted(
    id: string,
    result: any,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.idempotencyRepository.update(id, {
      status: 'completed',
      result,
      metadata: metadata || {},
    });
  }

  async markFailed(id: string, metadata?: Record<string, any>): Promise<void> {
    await this.idempotencyRepository.update(id, {
      status: 'failed',
      metadata: metadata || {},
    });
  }

  async remove(tenantId: string, key: string): Promise<void> {
    const keyHash = this.hashKey(key);
    await this.idempotencyRepository.delete({
      tenant_id: tenantId,
      key_hash: keyHash,
    });
  }

  async cleanup(tenantId: string, olderThanDays = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.idempotencyRepository
      .createQueryBuilder()
      .delete()
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('created_at < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }
}
