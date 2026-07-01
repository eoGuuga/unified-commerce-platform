import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DbContextService } from '../common/services/db-context.service';
import { Tenant } from '../../database/entities/Tenant.entity';
import {
  StoreAvailabilityException,
  StoreExceptionKind,
} from '../../database/entities/StoreAvailabilityException.entity';
import { CreateStoreExceptionDto } from './dto/create-store-exception.dto';

const DEFAULT_TZ = 'America/Sao_Paulo';

/**
 * Camada 2 — CRUD das exceçoes pontuais de disponibilidade da loja.
 *
 * Escopo SEMPRE por `tenantId` (do JWT, nunca body) + RLS reforça no banco. Le
 * o tenant sob o contexto RLS corrente (via DbContextService, sem depender do
 * TenantsService — sem ciclo: o WhatsappModule importa este service no gate T3).
 *
 * "Hoje"/`date >= hoje` sao computados no FUSO DA LOJA (`settings.business_hours.tz`,
 * default America/Sao_Paulo) — nunca na data do servidor (R3).
 */
@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(private readonly db: DbContextService) {}

  /**
   * Data civil "hoje" (YYYY-MM-DD) no fuso da loja do tenant. Le o tenant sob o
   * contexto RLS corrente; se nao houver tz configurado, usa America/Sao_Paulo.
   */
  private async todayInStoreTz(tenantId: string): Promise<string> {
    const tz = await this.resolveStoreTz(tenantId);
    return this.civilDateInTz(new Date(), tz);
  }

  private async resolveStoreTz(tenantId: string): Promise<string> {
    const tenant = await this.db
      .getRepository(Tenant)
      .findOne({ where: { id: tenantId } });
    const rawBh = tenant?.settings?.business_hours as { tz?: unknown } | undefined;
    const tz = rawBh && typeof rawBh.tz === 'string' && rawBh.tz.length > 0 ? rawBh.tz : DEFAULT_TZ;
    return tz;
  }

  /** Formata uma data como 'YYYY-MM-DD' no fuso indicado (Intl, DST-safe). */
  private civilDateInTz(d: Date, tz: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  /** Normaliza HH:MM:SS -> HH:MM (a coluna `time` volta com segundos). */
  private trimSeconds(value: string | null): string | null {
    if (value === null || value === undefined) return null;
    return value.length >= 5 ? value.slice(0, 5) : value;
  }

  /**
   * Lista as exceçoes FUTURAS (`date >= hoje` no fuso da loja), ordenadas por data.
   */
  async findFuture(tenantId: string): Promise<StoreAvailabilityException[]> {
    const today = await this.todayInStoreTz(tenantId);
    const rows = await this.db
      .getRepository(StoreAvailabilityException)
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId', { tenantId })
      .andWhere('e.date >= :today', { today })
      .orderBy('e.date', 'ASC')
      .getMany();
    return rows.map((r) => this.normalizeRow(r));
  }

  /**
   * Retorna as exceçoes do range [from, to] (datas civis no fuso da loja). Usado
   * pelo gate do bot (T3) para montar a Map de lookup O(1). `from`/`to` sao Dates
   * convertidas para a data civil no fuso da loja.
   */
  async findByDateRange(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<StoreAvailabilityException[]> {
    const tz = await this.resolveStoreTz(tenantId);
    const fromDate = this.civilDateInTz(from, tz);
    const toDate = this.civilDateInTz(to, tz);
    const rows = await this.db
      .getRepository(StoreAvailabilityException)
      .createQueryBuilder('e')
      .where('e.tenant_id = :tenantId', { tenantId })
      .andWhere('e.date >= :fromDate', { fromDate })
      .andWhere('e.date <= :toDate', { toDate })
      .orderBy('e.date', 'ASC')
      .getMany();
    return rows.map((r) => this.normalizeRow(r));
  }

  /**
   * Cria (ou sobrescreve — R1) uma exceçao por `(tenant_id, date)`.
   * `INSERT ... ON CONFLICT (tenant_id, date) DO UPDATE` = upsert idempotente:
   * a 2a criaçao da mesma data sobrescreve kind/open/close (nao dá 500 nem duplica).
   */
  async create(
    tenantId: string,
    dto: CreateStoreExceptionDto,
  ): Promise<StoreAvailabilityException> {
    const open = dto.kind === StoreExceptionKind.CUSTOM_HOURS ? dto.open ?? null : null;
    const close = dto.kind === StoreExceptionKind.CUSTOM_HOURS ? dto.close ?? null : null;
    return this.upsert(tenantId, dto.date, dto.kind, open, close);
  }

  /**
   * Atalho "fechar hoje" — upsert `closed` para a data de HOJE no fuso da loja (R1/R3).
   */
  async closeToday(tenantId: string): Promise<StoreAvailabilityException> {
    const today = await this.todayInStoreTz(tenantId);
    return this.upsert(tenantId, today, StoreExceptionKind.CLOSED, null, null);
  }

  private async upsert(
    tenantId: string,
    date: string,
    kind: StoreExceptionKind,
    open: string | null,
    close: string | null,
  ): Promise<StoreAvailabilityException> {
    // Escopo por tenant_id + RLS. ON CONFLICT no indice unico (tenant_id, date).
    const rows = (await this.db.getManager().query(
      `INSERT INTO store_availability_exceptions (tenant_id, date, kind, open, close)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, date)
       DO UPDATE SET kind = EXCLUDED.kind, open = EXCLUDED.open, close = EXCLUDED.close
       RETURNING id, tenant_id, date, kind, open, close, created_at`,
      [tenantId, date, kind, open, close],
    )) as Array<{
      id: string;
      tenant_id: string;
      date: string;
      kind: StoreExceptionKind;
      open: string | null;
      close: string | null;
      created_at: Date;
    }>;

    const row = rows[0];
    const entity = new StoreAvailabilityException();
    entity.id = row.id;
    entity.tenant_id = row.tenant_id;
    entity.date = this.normalizeDate(row.date);
    entity.kind = row.kind;
    entity.open = this.trimSeconds(row.open);
    entity.close = this.trimSeconds(row.close);
    entity.created_at = row.created_at;
    return entity;
  }

  /**
   * Remove uma exceçao (escopada por tenant). 404 se nao existir NESTE tenant
   * (RLS + filtro por tenant_id garantem que o DELETE de outro tenant e no-op).
   */
  async remove(tenantId: string, id: string): Promise<void> {
    const result = await this.db
      .getRepository(StoreAvailabilityException)
      .createQueryBuilder()
      .delete()
      .from(StoreAvailabilityException)
      .where('id = :id', { id })
      .andWhere('tenant_id = :tenantId', { tenantId })
      .execute();

    if (!result.affected || result.affected < 1) {
      throw new NotFoundException(`Exceçao ${id} nao encontrada`);
    }
  }

  /**
   * `date` volta como Date (TypeORM 'date') ou string dependendo do driver;
   * normaliza para 'YYYY-MM-DD' e trima os segundos de open/close.
   */
  private normalizeRow(r: StoreAvailabilityException): StoreAvailabilityException {
    r.date = this.normalizeDate(r.date as unknown);
    r.open = this.trimSeconds(r.open);
    r.close = this.trimSeconds(r.close);
    return r;
  }

  private normalizeDate(value: unknown): string {
    if (value instanceof Date) {
      // Coluna DATE em UTC-neutro: extrai os componentes UTC (a data nao tem fuso).
      const y = value.getUTCFullYear();
      const m = String(value.getUTCMonth() + 1).padStart(2, '0');
      const d = String(value.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return String(value).slice(0, 10);
  }
}
