import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsageLog } from '../../../database/entities/UsageLog.entity';

@Injectable()
export class UsageLogService {
  constructor(
    @InjectRepository(UsageLog)
    private usageLogRepository: Repository<UsageLog>,
  ) {}

  async logUsage(
    tenantId: string,
    service: string,
    action: string,
    metadata?: Record<string, any>,
  ): Promise<UsageLog> {
    const log = this.usageLogRepository.create({
      tenant_id: tenantId,
      service,
      action,
      metadata: metadata || {},
    });

    return this.usageLogRepository.save(log);
  }

  async getUsageByTenant(tenantId: string, limit = 100): Promise<UsageLog[]> {
    return this.usageLogRepository.find({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async getUsageByService(
    tenantId: string,
    service: string,
    limit = 100,
  ): Promise<UsageLog[]> {
    return this.usageLogRepository.find({
      where: { tenant_id: tenantId, service },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }
}
