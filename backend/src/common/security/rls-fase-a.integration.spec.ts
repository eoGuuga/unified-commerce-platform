/**
 * Prova de seguranca (Bloco 2 / Fase A): as 6 tabelas "verdes" passam a ter o
 * isolamento multi-tenant IMPOSTO pelo banco (RLS+FORCE+policy).
 *
 * Duas provas, sob o papel restrito (espelho do ucm_app de prod):
 *  - ESTRUTURAL (as 6): a migration ligou ENABLE+FORCE e criou a policy
 *    `<tabela>_tenant_isolation`.
 *  - COMPORTAMENTAL (as 5 sem FK de tenant): sem contexto -> 0 linhas; com o
 *    tenant certo -> so as linhas dele. `reservas_estoque` (tabela morta, com
 *    FKs pra tenants/produtos) fica na prova estrutural.
 *
 * Requer o banco de teste (ucm_test_motor via tunel SSH) COM a migration
 * 1751900000000 aplicada; roda so na suite de integracao.
 */
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const dotenv = require('dotenv') as { config: (o: { path: string }) => void };
  dotenv.config({ path: resolve(__dirname, '..', '..', '..', '.env') });
} catch {
  // env vars vem do processo
}

const ADMIN_URL = process.env.DATABASE_URL;
const PROBE_ROLE = 'ucm_rls_probe';
const PROBE_PWD = 'rls_probe_pw_test_only';
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

// Todas com tenant_id, sem FK de tenant -> da pra semear com UUID arbitrario.
const FK_FREE = [
  'whatsapp_message_metrics',
  'whatsapp_conversation_metrics',
  'whatsapp_conversion_events',
  'whatsapp_abandonment_events',
  'movimentacoes_estoque_historico',
];
const ALL_6 = [...FK_FREE, 'reservas_estoque'];

// INSERT minimo (so colunas NOT NULL sem default) por tabela.
const seeders: Record<string, (t: string, i: number) => [string, unknown[]]> = {
  whatsapp_message_metrics: (t, i) => [
    `INSERT INTO whatsapp_message_metrics (tenant_id, customer_phone, message_id, direction, message_type, processing_time_ms)
     VALUES ($1, $2, $3, 'inbound', 'text', 5)`,
    [t, '5511999999999', `msg-${t.slice(0, 8)}-${i}`],
  ],
  whatsapp_conversation_metrics: (t) => [
    `INSERT INTO whatsapp_conversation_metrics (conversation_id, tenant_id, customer_phone, started_at)
     VALUES (uuid_generate_v4(), $1, $2, now())`,
    [t, '5511999999999'],
  ],
  whatsapp_conversion_events: (t, i) => [
    `INSERT INTO whatsapp_conversion_events (tenant_id, customer_phone, cart_id, order_id, conversion_value, converted_at)
     VALUES ($1, $2, $3, uuid_generate_v4(), 10.00, now())`,
    [t, '5511999999999', `cart-${t.slice(0, 8)}-${i}`],
  ],
  whatsapp_abandonment_events: (t, i) => [
    `INSERT INTO whatsapp_abandonment_events (tenant_id, customer_phone, cart_id, abandonment_point, cart_value, abandoned_at)
     VALUES ($1, $2, $3, 'checkout', 20.00, now())`,
    [t, '5511999999999', `cart-${t.slice(0, 8)}-${i}`],
  ],
  movimentacoes_estoque_historico: (t) => [
    `INSERT INTO movimentacoes_estoque_historico (tenant_id, produto_id, tipo, delta, saldo_resultante)
     VALUES ($1, uuid_generate_v4(), 'AJUSTE', 1, 1)`,
    [t],
  ],
};

const describeOrSkip = ADMIN_URL ? describe : describe.skip;

describeOrSkip('RLS Fase A — 6 tabelas verdes com isolamento imposto pelo banco', () => {
  let adminDs: DataSource;
  let restrictedDs: DataSource; // faz SET LOCAL (contexto de tenant)
  let restrictedCleanDs: DataSource; // NUNCA faz SET LOCAL -> GUC fica unset (NULL)

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

    // Papel restrito (mesmo do provision-db-user.sh), idempotente.
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

    const restrictedUrl = new URL(ADMIN_URL as string);
    restrictedUrl.username = PROBE_ROLE;
    restrictedUrl.password = PROBE_PWD;
    const restrictedOpts = {
      type: 'postgres' as const,
      url: restrictedUrl.toString(),
      entities: [],
      synchronize: false,
      logging: false,
    };
    restrictedDs = new DataSource(restrictedOpts);
    await restrictedDs.initialize();
    // Conexao separada, so pra queries SEM contexto: como nunca faz SET LOCAL,
    // o placeholder `app.current_tenant_id` fica unset -> current_setting(...,true)
    // retorna NULL (nao ''), a policy vira `tenant_id = NULL` -> 0 linhas, sem erro.
    restrictedCleanDs = new DataSource(restrictedOpts);
    await restrictedCleanDs.initialize();
  }, 30000);

  afterAll(async () => {
    // Limpeza defensiva (caso algum teste tenha abortado no meio).
    if (adminDs?.isInitialized) {
      for (const table of FK_FREE) {
        await adminDs.query(
          `DELETE FROM "${table}" WHERE tenant_id = ANY($1::uuid[])`,
          [[TENANT_A, TENANT_B]],
        );
      }
    }
    await restrictedCleanDs?.destroy();
    await restrictedDs?.destroy();
    await adminDs?.destroy();
  });

  // Conta SEM contexto de tenant (conexao que nunca fez SET LOCAL).
  const countNoContext = async (table: string): Promise<number> => {
    const r = await restrictedCleanDs.query(
      `SELECT count(*)::int AS n FROM "${table}"`,
    );
    return r[0].n;
  };

  // Conta COM o contexto do tenant (SET LOCAL dentro de transacao).
  const countWithContext = async (
    table: string,
    tenantId: string,
  ): Promise<number> => {
    const qr = restrictedDs.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      const r = await qr.query(`SELECT count(*)::int AS n FROM "${table}"`);
      await qr.commitTransaction();
      return r[0].n;
    } finally {
      await qr.release();
    }
  };

  it.each(ALL_6)(
    'ESTRUTURAL — %s tem ENABLE+FORCE RLS e a policy _tenant_isolation',
    async (table) => {
      const meta = await adminDs.query(
        `SELECT relrowsecurity, relforcerowsecurity
         FROM pg_class WHERE relname = $1 AND relnamespace = 'public'::regnamespace`,
        [table],
      );
      expect(meta[0].relrowsecurity).toBe(true);
      expect(meta[0].relforcerowsecurity).toBe(true);

      const pols = await adminDs.query(
        `SELECT policyname FROM pg_policies WHERE tablename = $1`,
        [table],
      );
      expect(pols.map((p: { policyname: string }) => p.policyname)).toContain(
        `${table}_tenant_isolation`,
      );
    },
  );

  it.each(FK_FREE)(
    'COMPORTAMENTAL — %s: papel restrito sem contexto ve 0; com tenant ve so o dele',
    async (table) => {
      const seed = seeders[table];
      try {
        await adminDs.query(...seed(TENANT_A, 1));
        await adminDs.query(...seed(TENANT_A, 2));
        await adminDs.query(...seed(TENANT_B, 1));

        expect(await countNoContext(table)).toBe(0); // RLS imposto pelo banco
        expect(await countWithContext(table, TENANT_A)).toBe(2); // so A
        expect(await countWithContext(table, TENANT_B)).toBe(1); // so B
      } finally {
        await adminDs.query(
          `DELETE FROM "${table}" WHERE tenant_id = ANY($1::uuid[])`,
          [[TENANT_A, TENANT_B]],
        );
      }
    },
  );
});
