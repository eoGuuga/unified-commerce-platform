import type { DataSource } from 'typeorm';

/**
 * REDE PREVENTIVA de RLS (Peça 4). Garante que uma tabela FUTURA com `tenant_id`
 * não nasça sem RLS e reabra vazamento cross-tenant.
 *
 * A varredura é DINÂMICA (lê o catálogo `pg_*`), nunca uma lista fixa: uma
 * tabela nova entra sozinha. Uma lista fixa esqueceria dela — o exato modo de
 * falha que esta peça previne.
 */

export interface RlsAllowlistEntry {
  table: string;
  reason: string;
}

/**
 * Exceções LEGÍTIMAS à cobertura de RLS por tenant. Cada entrada é uma DECISÃO
 * CONSCIENTE e documentada — nunca um silêncio. Uma tabela só entra aqui se
 * legitimamente não precisa de RLS por-tenant, com o porquê explícito.
 */
export const RLS_COVERAGE_ALLOWLIST: ReadonlyArray<RlsAllowlistEntry> = [
  {
    table: 'email_confirmations',
    reason:
      'Fluxo PRÉ-LOGIN, sem coluna tenant_id (nem entra na varredura de tenant_id). ' +
      'Guarda código de confirmação de email, não dado de negócio de tenant. ' +
      'Listada defensivamente caso ganhe um tenant_id no futuro.',
  },
];

export interface RlsCoverageResult {
  /** Total de tabelas com coluna `tenant_id` encontradas na varredura. */
  scanned: number;
  /** Tabelas com `tenant_id` SEM RLS completa (enabled+forced+policy), fora da allowlist. */
  offenders: string[];
}

/**
 * Varre o schema (pg_catalog) por toda tabela `public` com coluna `tenant_id` e
 * marca as que NÃO têm RLS completa: `relrowsecurity` (ENABLE) + `relforcerowsecurity`
 * (FORCE) + ≥1 policy. Retorna os "offenders" (fora da allowlist).
 *
 * FAIL-CLOSED até no próprio erro: se a varredura não achar NENHUMA tabela com
 * `tenant_id`, algo está errado (query/banco) → LANÇA, em vez de "passar por
 * vacuidade" (0 offenders daria falsa segurança — a razão de existir da peça).
 */
export async function scanTenantTablesRlsCoverage(
  ds: Pick<DataSource, 'query'>,
  allowlist: ReadonlyArray<Pick<RlsAllowlistEntry, 'table'>> = RLS_COVERAGE_ALLOWLIST,
): Promise<RlsCoverageResult> {
  const rows: Array<{ table: string; protected: boolean }> = await ds.query(`
    SELECT c.relname AS table,
           (c.relrowsecurity
            AND c.relforcerowsecurity
            AND EXISTS (SELECT 1 FROM pg_policies p
                         WHERE p.schemaname = 'public' AND p.tablename = c.relname)
           ) AS protected
    FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id'
                       AND NOT a.attisdropped AND a.attnum > 0
    WHERE c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace
    ORDER BY c.relname
  `);

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      '[SECURITY] RLS coverage: a varredura não encontrou NENHUMA tabela com ' +
        'tenant_id. Varredura suspeita (query ou banco errado). Fail-closed em ' +
        'vez de passar por vacuidade.',
    );
  }

  const allowed = new Set(allowlist.map((a) => a.table));
  const offenders = rows
    // Fail-closed: SÓ `protected === true` conta como protegido. Qualquer outra
    // coisa (false, null, shape inesperado) é tratada como offender.
    .filter((r) => r.protected !== true && !allowed.has(r.table))
    .map((r) => r.table);

  return { scanned: rows.length, offenders };
}

/**
 * Assere (BARULHENTO, fail-closed) que toda tabela com `tenant_id` tem RLS
 * completa. Usada no CI (teste) e no boot em prod (última linha, no `main.ts`).
 * Lança se houver offender OU se a varredura for suspeita.
 */
export async function assertTenantTablesHaveRls(
  ds: Pick<DataSource, 'query'>,
  allowlist?: ReadonlyArray<Pick<RlsAllowlistEntry, 'table'>>,
): Promise<void> {
  const { scanned, offenders } = await scanTenantTablesRlsCoverage(ds, allowlist);
  if (offenders.length > 0) {
    throw new Error(
      `[SECURITY] ${offenders.length} tabela(s) com tenant_id SEM RLS completa ` +
        `(ENABLE+FORCE+policy): ${offenders.join(', ')}. Isso REABRE vazamento ` +
        `cross-tenant. Ligue RLS na migration (ENABLE+FORCE+policy _tenant_isolation) ` +
        `ou justifique explicitamente na RLS_COVERAGE_ALLOWLIST. (Varridas: ${scanned}.)`,
    );
  }
}
