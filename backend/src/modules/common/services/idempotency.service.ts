import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyKey } from '../../../database/entities/IdempotencyKey.entity';

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private idempotencyRepository: Repository<IdempotencyKey>,
  ) {}

  async checkAndSet(
    tenantId: string,
    key: string,
    ttlSeconds = 3600,
  ): Promise<boolean> {
    // Verificar se chave já existe
    const existing = await this.idempotencyRepository.findOne({
      where: { tenant_id: tenantId, key },
    });

    if (existing) {
      // Verificar se ainda está válida (não expirou)
      const now = new Date();
      const expiresAt = new Date(existing.created_at);
      expiresAt.setSeconds(expiresAt.getSeconds() + ttlSeconds);

      if (now < expiresAt) {
        throw new ConflictException(
          `Operação já foi processada. Key: ${key}`,
        );
      }

      // Expirou, pode deletar e criar nova
      await this.idempotencyRepository.remove(existing);
    }

    // Criar nova chave
    const idempotencyKey = this.idempotencyRepository.create({
      tenant_id: tenantId,
      key,
    });

    await this.idempotencyRepository.save(idempotencyKey);
    return true;
  }

  async remove(tenantId: string, key: string): Promise<void> {
    await this.idempotencyRepository.delete({
      tenant_id: tenantId,
      key,
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
