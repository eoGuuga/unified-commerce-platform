/**
 * Prova do bug do audit-log sem contexto RLS (achado via observabilidade 2026-07-07).
 *
 * `audit_log` tem RLS FORCE + WITH CHECK (tenant_id = current_setting('app.current_tenant_id')).
 * Quando o `AuditLogService.log()` e chamado de um fluxo @Public/sem contexto de tenant
 * ambiente (login, checkout publico), o INSERT era REJEITADO pelo RLS -> nenhum audit
 * gravado (em prod: 0 audits de LOGIN em 10 dias).
 *
 * Este teste roda sob um papel RESTRITO (`ucm_rls_probe`, NOSUPERUSER NOBYPASSRLS) —
 * espelho do `ucm_app` de prod — porque os *.integration.spec normais conectam como
 * SUPERUSER (postgres), que BYPASSA RLS e por isso NUNCA pegaram este bug.
 *
 *   RED  (antes do fix): `audit.log()` sem contexto -> RLS rejeita -> throw.
 *   GREEN (pos-fix): o service seta o proprio contexto -> grava com o tenant certo.
 *
 * Requer o banco de teste (ucm_test_motor via tunel SSH); roda so na suite de integracao.
 */
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AuditLog } from '../../../database/entities/AuditLog.entity';
import { AuditLogService } from './audit-log.service';
import { DbContextService } from './db-context.service';

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const dotenv = require('dotenv') as { config: (o: { path: string }) => void };
  // backend/.env — este arquivo esta em src/modules/common/services (4 niveis ate backend).
  dotenv.config({ path: resolve(__dirname, '..', '..', '..', '..', '.env') });
} catch {
  // env vars vem do processo
}

const ADMIN_URL = process.env.DATABASE_URL;
const PROBE_ROLE = 'ucm_rls_probe';
const PROBE_PWD = 'rls_probe_pw_test_only'; // papel descartavel, so no banco de teste
const TENANT_A = '11111111-1111-4111-8111-111111111111';

const describeOrSkip = ADMIN_URL ? describe : describe.skip;

describeOrSkip('AuditLogService — grava sob RLS FORCE mesmo SEM contexto ambiente (@Public)', () => {
  let adminDs: DataSource; // superuser: provisiona + semeia + verifica (ignora RLS)
  let restrictedDs: DataSource; // ucm_rls_probe (espelho do ucm_app, RLS-enforced)
  let audit: AuditLogService;

  beforeAll(async () => {
    adminDs = new DataSource({ type: 'postgres', url: ADMIN_URL, entities: [], synchronize: false, logging: false });
    await adminDs.initialize();
    const dbName = new URL(ADMIN_URL as string).pathname.replace(/^\//, '');

    // Papel restrito com os grants do app (mesmo padrao do rls-enforcement.spec).
    await adminDs.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${PROBE_ROLE}') THEN CREATE ROLE ${PROBE_ROLE} LOGIN PASSWORD '${PROBE_PWD}'; END IF; END $$;`);
    await adminDs.query(`ALTER ROLE ${PROBE_ROLE} NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${PROBE_PWD}'`);
    await adminDs.query(`GRANT CONNECT ON DATABASE "${dbName}" TO ${PROBE_ROLE}`);
    await adminDs.query(`GRANT USAGE ON SCHEMA public TO ${PROBE_ROLE}`);
    await adminDs.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${PROBE_ROLE}`);
    await adminDs.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${PROBE_ROLE}`);

    // Semeia o tenant (FK audit_log.tenant_id -> tenants). Idempotente.
    await adminDs.query(
      `INSERT INTO tenants (id, name, slug, settings, is_active) VALUES ($1,'RLS Audit Test','rls-audit-test','{}'::jsonb,true) ON CONFLICT (id) DO NOTHING`,
      [TENANT_A],
    );
    // Limpa audits antigos deste tenant (idempotencia entre rodadas).
    await adminDs.query(`DELETE FROM audit_log WHERE tenant_id = $1`, [TENANT_A]);

    // Conexao restrita + o service REAL por cima dela.
    const rUrl = new URL(ADMIN_URL as string);
    rUrl.username = PROBE_ROLE;
    rUrl.password = PROBE_PWD;
    restrictedDs = new DataSource({ type: 'postgres', url: rUrl.toString(), entities: [AuditLog], synchronize: false, logging: false });
    await restrictedDs.initialize();
    audit = new AuditLogService(new DbContextService(restrictedDs));
  }, 30000);

  afterAll(async () => {
    if (adminDs?.isInitialized) {
      await adminDs.query(`DELETE FROM audit_log WHERE tenant_id = $1`, [TENANT_A]);
      await adminDs.query(`DELETE FROM tenants WHERE id = $1`, [TENANT_A]);
    }
    await restrictedDs?.destroy();
    await adminDs?.destroy();
  });

  it('CONTRASTE: INSERT direto SEM contexto (papel restrito) e rejeitado pelo RLS', async () => {
    // Documenta o mecanismo: sem app.current_tenant_id, o WITH CHECK do audit_log falha.
    await expect(
      restrictedDs.query(
        `INSERT INTO audit_log (tenant_id, action, table_name, record_id, metadata) VALUES ($1,'LOGIN','usuarios',$2,'{}'::jsonb)`,
        [TENANT_A, randomUUID()],
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it('audit.log() grava SEM contexto ambiente (o caminho @Public de prod: login/checkout)', async () => {
    const recordId = randomUUID();
    // Chamado SEM setar app.current_tenant_id antes — exatamente o login @Public em prod.
    await audit.log({
      tenantId: TENANT_A,
      action: 'LOGIN',
      tableName: 'usuarios',
      recordId,
      metadata: { email: 'rls-audit-test@x.com' },
    });
    // Prova (como admin, que ve tudo): a linha foi gravada com o tenant CERTO.
    const rows = await adminDs.query(
      `SELECT tenant_id, action FROM audit_log WHERE record_id = $1 AND action = 'LOGIN'`,
      [recordId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_id).toBe(TENANT_A);
  });
});
