/**
 * Provas de seguranca (Envelope Fase 1): a tabela tenant_data_keys (material de
 * chave — as DEKs embrulhadas) esta sob RLS+FORCE, sob o papel RESTRITO (espelho
 * do ucm_app, NOSUPERUSER/NOBYPASSRLS). Material de chave = isolamento MAXIMO.
 *
 * PROVA 1a (estrutural): ENABLE+FORCE RLS + a policy tenant_isolation existem.
 * PROVA 1b (comportamental READ): sob o papel restrito, ler tenant_data_keys SEM
 *   contexto retorna 0 (mesmo havendo DEKs); com o tenant certo, so a DEK dele.
 * PROVA 2 (WITH CHECK): sob o contexto do tenant A, INSERT de uma DEK com
 *   tenant_id = B e REJEITADO — um lojista nao consegue plantar chave em outro.
 * PROVA 3 (fim-a-fim): o EncryptionService REAL, conectado pelo papel restrito,
 *   cifra pra A (cria+le a DEK de A sob RLS) e o dado de A NAO e legivel com o
 *   contexto de B — o isolamento de chave provado tambem contra o banco de verdade.
 *
 * Requer o banco de teste (ucm_test_motor via tunel) COM a migration
 * 1752100000000 aplicada. Roda so na suite de integracao.
 */
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../modules/common/services/encryption.service';

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

// Chaves de teste (fortes o bastante p/ passar o boot; NAO sao segredos reais).
const ENC_KEY = 'enc-key-teste-integracao-1234567890-abcd';
const MASTER_KEY = 'MASTER-key-teste-integracao-0987654321-wxyz';

const describeOrSkip = ADMIN_URL ? describe : describe.skip;

describeOrSkip('RLS Envelope Fase 1 — tenant_data_keys (DEKs) sob papel restrito', () => {
  let adminDs: DataSource;
  let restrictedDs: DataSource; // faz SET LOCAL (contexto de tenant)
  let restrictedCleanDs: DataSource; // nunca faz SET LOCAL -> GUC unset (NULL)

  const buildConfig = () =>
    ({
      get: (name: string) =>
        name === 'ENCRYPTION_MASTER_KEY' ? MASTER_KEY : ENC_KEY,
    }) as unknown as ConfigService;

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

    await adminDs.query(
      `INSERT INTO tenants (id, name, slug) VALUES
         ($1, 'DEK RLS A', 'dek-rls-a'),
         ($2, 'DEK RLS B', 'dek-rls-b')
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
        `DELETE FROM tenant_data_keys WHERE tenant_id = ANY($1::uuid[])`,
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

  const cleanDeks = () =>
    adminDs.query(`DELETE FROM tenant_data_keys WHERE tenant_id = ANY($1::uuid[])`, [
      [TENANT_A, TENANT_B],
    ]);

  // Semeia uma DEK (como admin, que ignora RLS). Conteudo irrelevante p/ RLS.
  const seedDek = (tenantId: string) =>
    adminDs.query(
      `INSERT INTO tenant_data_keys (tenant_id, key_version, wrapped_dek)
       VALUES ($1, 1, 'wrapped-placeholder')
       ON CONFLICT (tenant_id, key_version) DO NOTHING`,
      [tenantId],
    );

  // ─── PROVA 1a — estrutural ────────────────────────────────────────────────

  it('PROVA 1a: tenant_data_keys tem ENABLE+FORCE RLS e a policy de isolamento', async () => {
    const meta = await adminDs.query(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relname = 'tenant_data_keys' AND relnamespace = 'public'::regnamespace`,
    );
    expect(meta[0].relrowsecurity).toBe(true);
    expect(meta[0].relforcerowsecurity).toBe(true);
    const pols = await adminDs.query(
      `SELECT policyname FROM pg_policies WHERE tablename = 'tenant_data_keys'`,
    );
    expect(pols.map((p: { policyname: string }) => p.policyname)).toContain(
      'tenant_data_keys_tenant_isolation',
    );
  });

  // ─── PROVA 1b — comportamental (READ) ─────────────────────────────────────

  it('PROVA 1b: sem contexto ve 0 DEKs; com o tenant A ve so a DEK de A', async () => {
    try {
      await seedDek(TENANT_A);
      await seedDek(TENANT_B);

      // Sem contexto (conexao limpa) -> 0
      const noCtx = await restrictedCleanDs.query(
        `SELECT count(*)::int AS n FROM tenant_data_keys`,
      );
      expect(noCtx[0].n).toBe(0);

      // Com contexto do tenant A -> so a DEK de A
      const qr = restrictedDs.createQueryRunner();
      await qr.connect();
      try {
        await qr.startTransaction();
        await qr.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [TENANT_A]);
        const rows = await qr.query(
          `SELECT tenant_id FROM tenant_data_keys`,
        );
        expect(rows.length).toBe(1);
        expect(rows[0].tenant_id).toBe(TENANT_A);
        await qr.commitTransaction();
      } finally {
        await qr.release();
      }
    } finally {
      await cleanDeks();
    }
  });

  // ─── PROVA 2 — WITH CHECK (nao planta chave em outro tenant) ───────────────

  it('PROVA 2: sob o contexto de A, INSERT de DEK com tenant_id=B e rejeitado', async () => {
    const qr = restrictedDs.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [TENANT_A]);
      await expect(
        qr.query(
          `INSERT INTO tenant_data_keys (tenant_id, key_version, wrapped_dek)
           VALUES ($1, 1, 'chave-plantada')`,
          [TENANT_B],
        ),
      ).rejects.toThrow(); // viola a WITH CHECK da policy
      await qr.rollbackTransaction();
    } finally {
      await qr.release();
    }
    // garante que nada de B foi plantado
    const leftover = await adminDs.query(
      `SELECT count(*)::int AS n FROM tenant_data_keys WHERE tenant_id = $1`,
      [TENANT_B],
    );
    expect(leftover[0].n).toBe(0);
  });

  // ─── PROVA 3 — fim-a-fim: o EncryptionService real sob o papel restrito ────

  it('PROVA 3: o EncryptionService (papel restrito) cifra pra A; B nao le o dado de A', async () => {
    try {
      const svc = new EncryptionService(buildConfig(), restrictedDs);
      const secret = 'credencial-de-recebimento-de-A';

      // A cifra: cria a DEK de A (INSERT sob o contexto de A, passa a WITH CHECK) e le.
      const ct = await svc.encrypt(secret, TENANT_A);
      expect(ct.startsWith('v2.')).toBe(true);
      expect(await svc.decrypt(ct, TENANT_A)).toBe(secret);

      // A DEK de A ficou persistida (admin ignora RLS e ve).
      const stored = await adminDs.query(
        `SELECT count(*)::int AS n FROM tenant_data_keys WHERE tenant_id = $1`,
        [TENANT_A],
      );
      expect(stored[0].n).toBe(1);

      // B (DEK propria distinta) NAO decifra o dado de A.
      await svc.encrypt('segredo-de-B', TENANT_B); // da a B a propria DEK
      expect(await svc.decrypt(ct, TENANT_B)).toBeNull();
    } finally {
      await cleanDeks();
    }
  });
});
