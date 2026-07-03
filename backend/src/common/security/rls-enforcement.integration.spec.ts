/**
 * Prova de seguranca (Bloco 1 / #3): o isolamento multi-tenant e imposto pelo
 * BANCO (RLS), nao apenas pelo comportamento do app.
 *
 * Contexto do achado: em producao o app conecta como `ucm_app`
 * (NOSUPERUSER, sem BYPASSRLS). Este teste cria um papel RESTRITO espelhando
 * esse ucm_app (com os MESMOS grants do deploy/scripts/provision-db-user.sh) e
 * prova, conectado por ele:
 *   (a) o papel restrito consegue as operacoes do app (SELECT/INSERT + sequences
 *       + set_config) — nenhum grant faltando;
 *   (b) SEM contexto de tenant, uma query numa tabela FORCE-RLS retorna 0 (mesmo
 *       havendo linhas) — um app comprometido nao vaza cross-tenant;
 *   (c) COM contexto do tenant A, so enxerga as linhas do tenant A (isolamento).
 *
 * Contraste explicito: como SUPERUSER (o `postgres` que os demais
 * *.integration.spec usam), a MESMA query sem contexto retorna TODAS as linhas
 * — provando que so o papel restrito faz o RLS valer.
 *
 * Requer o banco de teste (ucm_test_motor via tunel SSH); roda so na suite de
 * integracao.
 */
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';

// Carrega backend/.env (DATABASE_URL do banco de teste) — igual ao data-source.ts.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const dotenv = require('dotenv') as { config: (o: { path: string }) => void };
  dotenv.config({ path: resolve(__dirname, '..', '..', '..', '.env') });
} catch {
  // env vars vem do processo
}

const ADMIN_URL = process.env.DATABASE_URL;
const PROBE_ROLE = 'ucm_rls_probe';
const PROBE_PWD = 'rls_probe_pw_test_only'; // papel descartavel, so no banco de teste
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

const describeOrSkip = ADMIN_URL ? describe : describe.skip;

describeOrSkip('RLS enforcement — isolamento imposto pelo banco sob papel restrito (#3)', () => {
  let adminDs: DataSource; // superuser (postgres) — provisiona + semeia
  let restrictedDs: DataSource; // papel restrito (espelho do ucm_app)

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

    // 1) Papel restrito com os MESMOS grants do provision-db-user.sh.
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

    // 2) Tabela-sonda FORCE-RLS com a MESMA policy que o app usa.
    await adminDs.query(`DROP TABLE IF EXISTS rls_probe`);
    await adminDs.query(
      `CREATE TABLE rls_probe (id serial PRIMARY KEY, tenant_id uuid NOT NULL, val text)`,
    );
    await adminDs.query(`ALTER TABLE rls_probe ENABLE ROW LEVEL SECURITY`);
    await adminDs.query(`ALTER TABLE rls_probe FORCE ROW LEVEL SECURITY`);
    await adminDs.query(`
      CREATE POLICY rls_probe_isolation ON rls_probe
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)`);

    // 3) Grants espelhando provision-db-user.sh (SELECT/INSERT/UPDATE/DELETE +
    //    sequences em TODAS as tabelas — inclui rls_probe e as tabelas reais).
    await adminDs.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${PROBE_ROLE}`,
    );
    await adminDs.query(
      `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${PROBE_ROLE}`,
    );

    // 4) Semeia 2 tenants (como superuser, que ignora RLS): A tem 2, B tem 1.
    await adminDs.query(
      `INSERT INTO rls_probe (tenant_id, val) VALUES ($1,'a1'), ($1,'a2'), ($2,'b1')`,
      [TENANT_A, TENANT_B],
    );

    // 5) Conexao como o papel restrito.
    const restrictedUrl = new URL(ADMIN_URL as string);
    restrictedUrl.username = PROBE_ROLE;
    restrictedUrl.password = PROBE_PWD;
    restrictedDs = new DataSource({
      type: 'postgres',
      url: restrictedUrl.toString(),
      entities: [],
      synchronize: false,
      logging: false,
    });
    await restrictedDs.initialize();
  }, 30000);

  afterAll(async () => {
    if (adminDs?.isInitialized) {
      await adminDs.query(`DROP TABLE IF EXISTS rls_probe`);
    }
    await restrictedDs?.destroy();
    await adminDs?.destroy();
  });

  // Conta rls_probe pelo papel restrito. tenantId=null => sem contexto.
  // Contexto setado com set_config(..., true) = SET LOCAL (transacional).
  const countAsRestricted = async (tenantId: string | null): Promise<number> => {
    const qr = restrictedDs.createQueryRunner();
    await qr.connect();
    try {
      if (tenantId === null) {
        const r = await qr.query(`SELECT count(*)::int AS n FROM rls_probe`);
        return r[0].n;
      }
      await qr.startTransaction();
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      const r = await qr.query(`SELECT count(*)::int AS n FROM rls_probe`);
      await qr.commitTransaction();
      return r[0].n;
    } finally {
      await qr.release();
    }
  };

  it('o papel realmente e restrito (NOSUPERUSER, sem BYPASSRLS)', async () => {
    const rows = await restrictedDs.query(
      `SELECT current_setting('is_superuser') AS s, current_user AS u,
              (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS b`,
    );
    expect(rows[0].s).toBe('off');
    expect(rows[0].u).toBe(PROBE_ROLE);
    expect(rows[0].b).toBe(false);
  });

  it('CONTRASTE: superuser sem contexto ve TODAS as linhas (RLS bypassed)', async () => {
    const r = await adminDs.query(`SELECT count(*)::int AS n FROM rls_probe`);
    expect(r[0].n).toBe(3); // A(2) + B(1) — o superuser fura o RLS
  });

  it('papel restrito SEM contexto de tenant ve 0 (RLS imposto pelo banco)', async () => {
    expect(await countAsRestricted(null)).toBe(0);
  });

  it('papel restrito COM contexto do tenant A ve so as 2 linhas de A', async () => {
    expect(await countAsRestricted(TENANT_A)).toBe(2);
  });

  it('papel restrito COM contexto do tenant B ve so a 1 linha de B (isolamento)', async () => {
    expect(await countAsRestricted(TENANT_B)).toBe(1);
  });

  it('papel restrito consegue INSERIR no proprio tenant (grants suficientes)', async () => {
    const qr = restrictedDs.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [TENANT_B]);
      await qr.query(`INSERT INTO rls_probe (tenant_id, val) VALUES ($1, 'b2')`, [TENANT_B]);
      const r = await qr.query(`SELECT count(*)::int AS n FROM rls_probe`);
      expect(r[0].n).toBe(2); // B agora ve 2 (1 semeado + 1 inserido)
      await qr.rollbackTransaction(); // nao suja o estado das outras provas
    } finally {
      await qr.release();
    }
  });

  it('numa tabela REAL FORCE-RLS (produtos), o papel restrito so ve o tenant do contexto', async () => {
    const adminTotal = (
      await adminDs.query(`SELECT count(*)::int AS n FROM produtos`)
    )[0].n;

    // Contexto de um tenant "fantasma" (sem linhas) -> o papel restrito ve 0,
    // mesmo que a tabela tenha dados de outros tenants (RLS filtra pelo contexto).
    const ghostTenant = '33333333-3333-4333-8333-333333333333';
    const qr = restrictedDs.createQueryRunner();
    await qr.connect();
    let restrictedForGhost: number;
    try {
      await qr.startTransaction();
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [ghostTenant]);
      restrictedForGhost = (
        await qr.query(`SELECT count(*)::int AS n FROM produtos`)
      )[0].n;
      await qr.commitTransaction();
    } finally {
      await qr.release();
    }

    expect(restrictedForGhost).toBe(0);
    // Se ha dados reais, o contraste e significativo: admin ve tudo, restrito nao.
    if (adminTotal > 0) {
      expect(adminTotal).toBeGreaterThan(restrictedForGhost);
    }
  });
});
