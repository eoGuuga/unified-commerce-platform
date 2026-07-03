/**
 * Provas de seguranca (Bloco 2 / Fase B): whatsapp_carts sob RLS + o sweeper
 * continua limpando cross-tenant, sob o papel RESTRITO (espelho do ucm_app).
 *
 * PROVA 1 — RLS protege: sob o papel restrito, ler whatsapp_carts SEM contexto
 *   retorna 0 (mesmo havendo linhas); com o tenant certo, so as dele. Isolamento
 *   imposto pelo banco.
 * PROVA 2 — o faxineiro ainda funciona (e respeita o isolamento): populamos
 *   carrinhos expirados de 2 tenants, rodamos o StockSweeper REAL (modelo
 *   loop-por-tenant) conectado pelo papel restrito, e provamos que ele liberou
 *   os expirados de TODOS os tenants — sem furar isolamento e sem deixar
 *   carrinho de nenhum tenant pra tras. Como o job quebra silencioso, esta prova
 *   e a critica: o mesmo teste mostra que a varredura cross-tenant ingenua (sem
 *   contexto) enxerga 0, e ainda assim o sweeper limpou tudo.
 *
 * Requer o banco de teste (ucm_test_motor via tunel) COM a migration
 * 1752000000000 aplicada. Roda so na suite de integracao.
 */
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import { CartService } from '../../modules/whatsapp/services/cart.service';
import { StockEngineService } from '../../modules/products/stock-engine.service';
import { DbContextService } from '../../modules/common/services/db-context.service';
import { StockSweeperService } from '../../modules/products/stock-sweeper.service';
import type { OrdersService } from '../../modules/orders/orders.service';

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const dotenv = require('dotenv') as { config: (o: { path: string }) => void };
  dotenv.config({ path: resolve(__dirname, '..', '..', '..', '.env') });
} catch {
  // env vars do processo
}

const ADMIN_URL = process.env.DATABASE_URL;
const PROBE_ROLE = 'ucm_rls_probe';
const PROBE_PWD = 'rls_probe_pw_test_only';
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const PHONE = '5511999999999';

const describeOrSkip = ADMIN_URL ? describe : describe.skip;

describeOrSkip('RLS Fase B — whatsapp_carts protegido + sweeper cross-tenant sob papel restrito', () => {
  let adminDs: DataSource;
  let restrictedDs: DataSource; // faz SET LOCAL (contexto de tenant)
  let restrictedCleanDs: DataSource; // nunca faz SET LOCAL -> GUC unset (NULL)

  beforeAll(async () => {
    adminDs = new DataSource({
      type: 'postgres',
      url: ADMIN_URL,
      entities: [],
      synchronize: false,
      logging: false,
    });
    await adminDs.initialize();

    const dbName = new URL(ADMIN_URL as string).pathname.replace(/^\//, '');
    await adminDs.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${PROBE_ROLE}') THEN
          CREATE ROLE ${PROBE_ROLE} LOGIN PASSWORD '${PROBE_PWD}';
        END IF;
      END $$;`);
    await adminDs.query(
      `ALTER ROLE ${PROBE_ROLE} NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${PROBE_PWD}'`,
    );
    await adminDs.query(`GRANT CONNECT ON DATABASE "${dbName}" TO ${PROBE_ROLE}`);
    await adminDs.query(`GRANT USAGE ON SCHEMA public TO ${PROBE_ROLE}`);
    await adminDs.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${PROBE_ROLE}`,
    );
    await adminDs.query(
      `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${PROBE_ROLE}`,
    );

    // Dois tenants reais (o sweeper enumera a partir de tenants).
    await adminDs.query(
      `INSERT INTO tenants (id, name, slug) VALUES
         ($1, 'RLS Fase B A', 'rls-fase-b-a'),
         ($2, 'RLS Fase B B', 'rls-fase-b-b')
       ON CONFLICT (id) DO NOTHING`,
      [TENANT_A, TENANT_B],
    );

    const restrictedOpts = {
      type: 'postgres' as const,
      url: (() => {
        const u = new URL(ADMIN_URL as string);
        u.username = PROBE_ROLE;
        u.password = PROBE_PWD;
        return u.toString();
      })(),
      entities: [],
      synchronize: false,
      logging: false,
    };
    restrictedDs = new DataSource(restrictedOpts);
    await restrictedDs.initialize();
    restrictedCleanDs = new DataSource(restrictedOpts);
    await restrictedCleanDs.initialize();
  }, 30000);

  afterAll(async () => {
    if (adminDs?.isInitialized) {
      await adminDs.query(
        `DELETE FROM whatsapp_carts WHERE tenant_id = ANY($1::uuid[])`,
        [[TENANT_A, TENANT_B]],
      );
      await adminDs.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [
        [TENANT_A, TENANT_B],
      ]);
    }
    await restrictedCleanDs?.destroy();
    await restrictedDs?.destroy();
    await adminDs?.destroy();
  });

  const cleanCarts = () =>
    adminDs.query(`DELETE FROM whatsapp_carts WHERE tenant_id = ANY($1::uuid[])`, [
      [TENANT_A, TENANT_B],
    ]);

  // Semeia um carrinho (como admin, que ignora RLS). expiredHoursAgo>0 => expirado.
  const seedCart = (tenantId: string, expiredHoursAgo: number) =>
    adminDs.query(
      `INSERT INTO whatsapp_carts (tenant_id, customer_phone, expires_at, status)
       VALUES ($1, $2, now() - ($3 || ' hours')::interval, 'active')`,
      [tenantId, PHONE, expiredHoursAgo],
    );

  // ─── PROVA 1 — RLS protege whatsapp_carts ────────────────────────────────

  it('PROVA 1a (estrutural): whatsapp_carts tem ENABLE+FORCE RLS e a policy', async () => {
    const meta = await adminDs.query(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname = 'whatsapp_carts' AND relnamespace = 'public'::regnamespace`,
    );
    expect(meta[0].relrowsecurity).toBe(true);
    expect(meta[0].relforcerowsecurity).toBe(true);
    const pols = await adminDs.query(
      `SELECT policyname FROM pg_policies WHERE tablename = 'whatsapp_carts'`,
    );
    expect(pols.map((p: { policyname: string }) => p.policyname)).toContain(
      'whatsapp_carts_tenant_isolation',
    );
  });

  it('PROVA 1b (comportamental): sem contexto ve 0; com tenant ve so o dele', async () => {
    try {
      await seedCart(TENANT_A, 5); // 1 de A
      await seedCart(TENANT_A, 5); // 2 de A
      await seedCart(TENANT_B, 5); // 1 de B

      // Sem contexto (conexao limpa) -> 0
      const noCtx = await restrictedCleanDs.query(
        `SELECT count(*)::int AS n FROM whatsapp_carts`,
      );
      expect(noCtx[0].n).toBe(0);

      // Com contexto do tenant A -> so os 2 de A
      const qr = restrictedDs.createQueryRunner();
      await qr.connect();
      try {
        await qr.startTransaction();
        await qr.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [TENANT_A]);
        const a = await qr.query(`SELECT count(*)::int AS n FROM whatsapp_carts`);
        expect(a[0].n).toBe(2);
        await qr.commitTransaction();
      } finally {
        await qr.release();
      }
    } finally {
      await cleanCarts();
    }
  });

  it('PROVA da enumeracao: o papel restrito lista tenants via app_list_tenant_ids()', async () => {
    const rows = await restrictedDs.query(`SELECT app_list_tenant_ids() AS id`);
    const ids = rows.map((r: { id: string }) => r.id);
    expect(ids).toEqual(expect.arrayContaining([TENANT_A, TENANT_B]));
  });

  // ─── PROVA 2 — o sweeper REAL limpa cross-tenant sob o papel restrito ─────

  it('PROVA 2: o sweeper (loop-por-tenant) libera os carrinhos expirados de TODOS os tenants', async () => {
    try {
      // Semear: A tem 2 expirados + 1 futuro (nao deve ser varrido); B tem 1 expirado.
      await seedCart(TENANT_A, 5);
      await seedCart(TENANT_A, 5);
      await seedCart(TENANT_A, -5); // futuro (expires_at no futuro)
      await seedCart(TENANT_B, 5);

      // A varredura cross-tenant INGENUA (sem contexto) enxerga 0 sob o papel
      // restrito — e por isso que o sweeper antigo era um no-op silencioso.
      const naive = await restrictedCleanDs.query(
        `SELECT count(*)::int AS n FROM whatsapp_carts
         WHERE status = 'active' AND expires_at < now() AND stock_released_at IS NULL`,
      );
      expect(naive[0].n).toBe(0);

      // Monta o StockSweeper REAL conectado pelo papel RESTRITO.
      const config = { get: () => undefined } as unknown as ConfigService;
      const dbContext = new DbContextService(restrictedDs);
      const stockEngine = new StockEngineService();
      const cartService = new CartService(restrictedDs, config, stockEngine, dbContext);
      const ordersService = {
        releaseExpiredPendingOrder: jest.fn(),
      } as unknown as OrdersService;
      const sweeper = new StockSweeperService(
        restrictedDs,
        config,
        cartService,
        ordersService,
      );

      // Roda o faxineiro (loop-por-tenant + enumeracao segura).
      await sweeper.sweepExpiredCarts();

      // Verifica pelo admin (ignora RLS) que TODOS os tenants foram limpos.
      const releasedA = await adminDs.query(
        `SELECT count(*)::int AS n FROM whatsapp_carts
         WHERE tenant_id = $1 AND stock_released_at IS NOT NULL`,
        [TENANT_A],
      );
      expect(releasedA[0].n).toBe(2); // os 2 expirados de A liberados

      const releasedB = await adminDs.query(
        `SELECT count(*)::int AS n FROM whatsapp_carts
         WHERE tenant_id = $1 AND stock_released_at IS NOT NULL`,
        [TENANT_B],
      );
      expect(releasedB[0].n).toBe(1); // o expirado de B liberado

      // O carrinho FUTURO de A NAO pode ter sido varrido.
      const stillActiveA = await adminDs.query(
        `SELECT count(*)::int AS n FROM whatsapp_carts
         WHERE tenant_id = $1 AND status = 'active' AND stock_released_at IS NULL`,
        [TENANT_A],
      );
      expect(stillActiveA[0].n).toBe(1);
    } finally {
      await cleanCarts();
    }
  });
});
