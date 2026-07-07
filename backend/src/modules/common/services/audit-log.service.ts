import { Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { AuditLog } from '../../../database/entities/AuditLog.entity';
import { AuditLogParams } from '../types/audit.types';
import { DbContextService } from './db-context.service';

@Injectable()
export class AuditLogService {
  constructor(
    private readonly db: DbContextService,
  ) {}

  async log(params: AuditLogParams): Promise<AuditLog> {
    // audit_log tem RLS FORCE (WITH CHECK em tenant_id). Este metodo pode ser
    // chamado de fluxos @Public/sem contexto de tenant ambiente (login, checkout
    // publico) -> sem isso, o INSERT era rejeitado pelo RLS e o audit se perdia.
    // GARANTE o contexto RLS aqui, do tenantId do parametro (fonte confiavel: o
    // tenant do dono do evento). runInTransaction reusa a transacao ambiente se
    // houver (fluxos autenticados) ou abre uma nova (fluxos @Public).
    return this.db.runInTransaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [
        params.tenantId,
      ]);
      const auditLogRepository = manager.getRepository(AuditLog);
      const auditLog = auditLogRepository.create({
        tenant_id: params.tenantId,
        user_id: params.userId,
        action: params.action,
        table_name: params.tableName,
        record_id: params.recordId,
        old_data: (params.oldData || null) as never, // TypeORM JSONB: any-like aceito
        new_data: (params.newData || null) as never, // TypeORM JSONB: any-like aceito
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
        metadata: (params.metadata || {}) as never, // TypeORM JSONB: any-like aceito
      });

      return auditLogRepository.save(auditLog);
    });
  }

  async findByTenant(
    tenantId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ data: AuditLog[]; total: number }> {
    const [data, total] = await this.db.getRepository(AuditLog).findAndCount({
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

    return this.db.getRepository(AuditLog).find({
      where,
      order: { created_at: 'DESC' },
    });
  }
}
