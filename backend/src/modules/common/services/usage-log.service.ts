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
    serviceType: string,
    quantity: number,
    costEstimated = 0,
    metadata?: Record<string, any>,
    referenceId?: string,
    referenceType?: string,
  ): Promise<UsageLog> {
    const log = this.usageLogRepository.create({
      tenant_id: tenantId,
      service_type: serviceType,
      quantity,
      cost_estimated: costEstimated,
      metadata: metadata || {},
      reference_id: referenceId,
      reference_type: referenceType,
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
    serviceType: string,
    limit = 100,
  ): Promise<UsageLog[]> {
    return this.usageLogRepository.find({
      where: { tenant_id: tenantId, service_type: serviceType },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }
}
