/**
 * REDE PREVENTIVA de RLS contra o schema REAL (Peça 4). Prova, no banco de teste,
 * que o check dinâmico:
 *   (a) PASSA no schema atual (nenhuma tabela tenant_id sem RLS);
 *   (b) PEGA o buraco — uma tabela nova com tenant_id e SEM RLS faz o check gritar;
 *   (c) a allowlist cobre uma exceção justificada.
 *
 * Requer o banco de teste (via DATABASE_URL / túnel SSH); roda só na suíte de
 * integração. A LÓGICA (fail-closed, vacuidade, allowlist) é coberta no unit
 * `rls-coverage.spec.ts`; aqui o foco é o binding com o catálogo real.
 */
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import {
  scanTenantTablesRlsCoverage,
  assertTenantTablesHaveRls,
} from './rls-coverage';

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const dotenv = require('dotenv') as { config: (o: { path: string }) => void };
  dotenv.config({ path: resolve(__dirname, '..', '..', '..', '.env') });
} catch {
  // env vars vêm do processo
}

const ADMIN_URL = process.env.DATABASE_URL;
const describeOrSkip = ADMIN_URL ? describe : describe.skip;
const PROBE = '_rls_coverage_probe';

describeOrSkip('RLS coverage — rede preventiva contra o schema REAL (Peça 4)', () => {
  let adminDs: DataSource;

  beforeAll(async () => {
    adminDs = new DataSource({
      type: 'postgres',
      url: ADMIN_URL,
      entities: [],
      synchronize: false,
      logging: false,
    });
    await adminDs.initialize();
    await adminDs.query(`DROP TABLE IF EXISTS ${PROBE}`);
  });

  afterEach(async () => {
    await adminDs.query(`DROP TABLE IF EXISTS ${PROBE}`);
  });

  afterAll(async () => {
    if (adminDs?.isInitialized) {
      await adminDs.query(`DROP TABLE IF EXISTS ${PROBE}`);
      await adminDs.destroy();
    }
  });

  it('o schema REAL passa: 0 offenders + varreu as tabelas tenant_id de verdade', async () => {
    const r = await scanTenantTablesRlsCoverage(adminDs);
    expect(r.offenders).toEqual([]);
    expect(r.scanned).toBeGreaterThanOrEqual(19); // as 19 tabelas tenant_id conhecidas
    await expect(assertTenantTablesHaveRls(adminDs)).resolves.toBeUndefined();
  });

  it('🎯 PEGA O BURACO: tabela nova com tenant_id SEM RLS → o check grita', async () => {
    // Simula a tabela esquecida: tenant_id, mas sem ENABLE/FORCE/policy.
    await adminDs.query(
      `CREATE TABLE ${PROBE} (id serial PRIMARY KEY, tenant_id uuid NOT NULL)`,
    );

    const r = await scanTenantTablesRlsCoverage(adminDs);
    expect(r.offenders).toContain(PROBE);
    await expect(assertTenantTablesHaveRls(adminDs)).rejects.toThrow(new RegExp(PROBE));
  });

  it('allowlist: a MESMA tabela desprotegida, justificada, NÃO faz o check falhar', async () => {
    await adminDs.query(
      `CREATE TABLE ${PROBE} (id serial PRIMARY KEY, tenant_id uuid NOT NULL)`,
    );

    await expect(
      assertTenantTablesHaveRls(adminDs, [{ table: PROBE }]),
    ).resolves.toBeUndefined();
  });
});
