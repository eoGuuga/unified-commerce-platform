import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { AuditLog } from '../../../database/entities/AuditLog.entity';
import { AuditLogParams, AuditLogFilters } from '../types/audit.types';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(params: AuditLogParams): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      tenant_id: params.tenantId,
      user_id: params.userId,
      action: params.action,
      table_name: params.tableName,
      record_id: params.recordId,
      old_data: (params.oldData || null) as any, // TypeORM JSONB requer 'any'
      new_data: (params.newData || null) as any, // TypeORM JSONB requer 'any'
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      metadata: (params.metadata || {}) as Record<string, any>, // TypeORM JSONB requer 'any'
    });

    return this.auditLogRepository.save(auditLog);
  }

  async findByTenant(
    tenantId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ data: AuditLog[]; total: number }> {
    const [data, total] = await this.auditLogRepository.findAndCount({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { data, total };
  }

  async findByTable(
    tenantId: string,
    tableName: string,
    recordId?: string,
  ): Promise<AuditLog[]> {
    const where: FindOptionsWhere<AuditLog> = {
      tenant_id: tenantId,
      table_name: tableName,
    };

    if (recordId) {
      where.record_id = recordId;
    }

    return this.auditLogRepository.find({
      where,
      order: { created_at: 'DESC' },
    });
  }
}
