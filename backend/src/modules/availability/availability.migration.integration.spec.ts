import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { databaseConfig } from '../../config/database.config';

/**
 * Task 1 — smoke da tabela `store_availability_exceptions` (migration 1751800000000).
 *
 * Prova, sob contexto de tenant (RLS via set_config app.current_tenant_id), que:
 *  (a) INSERT `closed` com open/close NULL          -> OK
 *  (b) INSERT `closed` com `open` preenchido        -> CHECK rejeita
 *  (c) INSERT `custom_hours` com `open` NULL         -> CHECK rejeita
 *  (d) INSERT 2x a mesma (tenant_id, date)          -> UNIQUE rejeita
 *
 * NOTE: exige o test-DB (tunel localhost:5544/ucm_test_motor) UP; se a conexao
 * falhar o beforeAll estoura (falha explicita, nao skip silencioso) — antes da
 * migration o INSERT (a) falha porque a tabela nao existe.
 */
const tenantId = '00000000-0000-0000-0000-000000000000';

describe('StoreAvailabilityExceptions migration (integration)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    process.env.SUPPRESS_TENANT_RLS_LOGS = 'true';
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
        TypeOrmModule.forRootAsync(databaseConfig),
      ],
    }).compile();
    dataSource = moduleRef.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  // Executa fn com o tenant setado; sempre libera o queryRunner.
  async function withTenant<T>(
    fn: (run: (sql: string, params?: unknown[]) => Promise<unknown>) => Promise<T>,
  ): Promise<T> {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      return await fn((sql, params) => qr.query(sql, params));
    } finally {
      await qr.release();
    }
  }

  // Limpa exceçoes deste tenant entre asserts (a data e a mesma).
  async function cleanup(): Promise<void> {
    await withTenant((run) =>
      run(`DELETE FROM store_availability_exceptions WHERE tenant_id = $1`, [tenantId]),
    );
  }

  beforeEach(cleanup);

  it('(a) aceita `closed` com open/close NULL', async () => {
    const rows = await withTenant((run) =>
      run(
        `INSERT INTO store_availability_exceptions (tenant_id, date, kind, open, close)
         VALUES ($1, '2099-12-25', 'closed', NULL, NULL) RETURNING id, kind`,
        [tenantId],
      ),
    );
    expect((rows as Array<{ kind: string }>)[0].kind).toBe('closed');
  });

  it('(b) CHECK rejeita `closed` com `open` preenchido', async () => {
    await expect(
      withTenant((run) =>
        run(
          `INSERT INTO store_availability_exceptions (tenant_id, date, kind, open, close)
           VALUES ($1, '2099-12-25', 'closed', '09:00', NULL)`,
          [tenantId],
        ),
      ),
    ).rejects.toThrow(/chk_exception_hours|check constraint/i);
  });

  it('(c) CHECK rejeita `custom_hours` com `open` NULL', async () => {
    await expect(
      withTenant((run) =>
        run(
          `INSERT INTO store_availability_exceptions (tenant_id, date, kind, open, close)
           VALUES ($1, '2099-12-25', 'custom_hours', NULL, '13:00')`,
          [tenantId],
        ),
      ),
    ).rejects.toThrow(/chk_exception_hours|check constraint/i);
  });

  it('(d) UNIQUE rejeita 2x a mesma (tenant_id, date)', async () => {
    await withTenant((run) =>
      run(
        `INSERT INTO store_availability_exceptions (tenant_id, date, kind, open, close)
         VALUES ($1, '2099-12-25', 'closed', NULL, NULL)`,
        [tenantId],
      ),
    );
    await expect(
      withTenant((run) =>
        run(
          `INSERT INTO store_availability_exceptions (tenant_id, date, kind, open, close)
           VALUES ($1, '2099-12-25', 'custom_hours', '09:00', '13:00')`,
          [tenantId],
        ),
      ),
    ).rejects.toThrow(/uq_exception_tenant_date|duplicate key/i);
  });
});
