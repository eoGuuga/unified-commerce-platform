import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Observable, from, lastValueFrom } from 'rxjs';
import { DataSource } from 'typeorm';
import { DbContextService } from '../../modules/common/services/db-context.service';
import { TypedRequest } from '../types/request.types';

@Injectable()
export class TenantDbContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantDbContextInterceptor.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly dbContext: DbContextService,
  ) {}

  private extractTenantId(req: any): string | null {
    const request = req as TypedRequest & { body?: any };
    const userTenant = (request as any)?.user?.tenant_id;
    if (typeof userTenant === 'string' && userTenant.trim()) return userTenant.trim();

    const isProd = process.env.NODE_ENV === 'production';
    const allowNonJwtTenant =
      !isProd && process.env.ALLOW_TENANT_FROM_REQUEST !== 'false';

    if (allowNonJwtTenant) {
      const headerTenant = request.headers?.['x-tenant-id'];
      const normalizedHeaderTenant = Array.isArray(headerTenant)
        ? headerTenant[0]
        : headerTenant;
      if (typeof normalizedHeaderTenant === 'string' && normalizedHeaderTenant.trim()) {
        return normalizedHeaderTenant.trim();
      }

      const bodyTenant = request.body?.tenantId || request.body?.tenant_id;
      if (typeof bodyTenant === 'string' && bodyTenant.trim()) return bodyTenant.trim();

      const queryTenant =
        request.query?.tenantId || request.query?.tenant_id || request.query?.['tenant-id'];
      if (typeof queryTenant === 'string' && queryTenant.trim()) return queryTenant.trim();
    }

    return null;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const tenantId = this.extractTenantId(req);

    // Sem tenant -> nao abrir transacao nem setar variavel de sessao.
    if (!tenantId) {
      return next.handle();
    }

    return from(this.runRequestInTenantContext(tenantId, next));
  }

  private async runRequestInTenantContext(tenantId: string, next: CallHandler): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // SET LOCAL: escopo da transacao (nao vaza entre requests/pool).
      await queryRunner.manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);

      const result = await this.dbContext.runWithManager(queryRunner.manager, async () => {
        return await lastValueFrom(next.handle());
      });

      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      try {
        await queryRunner.rollbackTransaction();
      } catch {
        // ignore
      }
      const suppressLogs =
        process.env.NODE_ENV === 'test' ||
        process.env.SUPPRESS_TENANT_RLS_LOGS === 'true';
      if (!suppressLogs) {
        this.logger.error('Erro no contexto transacional do tenant (RLS)', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    } finally {
      try {
        await queryRunner.release();
      } catch {
        // ignore
      }
    }
  }
}
