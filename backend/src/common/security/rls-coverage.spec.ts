import {
  scanTenantTablesRlsCoverage,
  assertTenantTablesHaveRls,
  RLS_COVERAGE_ALLOWLIST,
} from './rls-coverage';

/**
 * Unit da REDE PREVENTIVA (Peça 4): prova a LÓGICA do check com `ds.query`
 * mockado (o binding com o catálogo real fica no integration spec). O foco é o
 * fail-closed: pegar o buraco, respeitar a allowlist, e NÃO passar por vacuidade.
 */
function mockDs(rows: unknown) {
  return { query: jest.fn().mockResolvedValue(rows) };
}
const P = (table: string, protectedFlag: unknown) => ({ table, protected: protectedFlag });

describe('RLS coverage — rede preventiva (Peça 4)', () => {
  describe('scanTenantTablesRlsCoverage', () => {
    it('schema saudável: todas as tabelas tenant_id protegidas → 0 offenders', async () => {
      const ds = mockDs([P('produtos', true), P('pedidos', true), P('usuarios', true)]);
      const r = await scanTenantTablesRlsCoverage(ds as any, []);
      expect(r.offenders).toEqual([]);
      expect(r.scanned).toBe(3);
    });

    it('🎯 pega o buraco: tabela tenant_id sem RLS → aparece nos offenders', async () => {
      const ds = mockDs([P('produtos', true), P('tabela_nova_sem_rls', false)]);
      const r = await scanTenantTablesRlsCoverage(ds as any, []);
      expect(r.offenders).toEqual(['tabela_nova_sem_rls']);
    });

    it('allowlist: exceção justificada não vira offender', async () => {
      const ds = mockDs([P('produtos', true), P('email_confirmations', false)]);
      const r = await scanTenantTablesRlsCoverage(ds as any, [{ table: 'email_confirmations' }]);
      expect(r.offenders).toEqual([]);
    });

    it('🎯 fail-closed por VACUIDADE: varredura vazia → LANÇA (não passa por vácuo)', async () => {
      const ds = mockDs([]);
      await expect(scanTenantTablesRlsCoverage(ds as any, [])).rejects.toThrow(
        /vacuidade|suspeita|nenhuma/i,
      );
    });

    it('🎯 fail-closed no shape estranho: `protected` não-`true` (null/erro) → tratado como offender', async () => {
      const ds = mockDs([P('produtos', true), P('estranha', null)]);
      const r = await scanTenantTablesRlsCoverage(ds as any, []);
      expect(r.offenders).toEqual(['estranha']);
    });
  });

  describe('assertTenantTablesHaveRls', () => {
    it('🎯 offender presente → LANÇA barulhento, com o nome da tabela', async () => {
      const ds = mockDs([P('produtos', true), P('vazando', false)]);
      await expect(assertTenantTablesHaveRls(ds as any, [])).rejects.toThrow(/vazando/);
    });

    it('schema limpo → não lança', async () => {
      const ds = mockDs([P('produtos', true), P('pedidos', true)]);
      await expect(assertTenantTablesHaveRls(ds as any, [])).resolves.toBeUndefined();
    });
  });

  it('a allowlist real inclui email_confirmations com motivo documentado', () => {
    const entry = RLS_COVERAGE_ALLOWLIST.find((a) => a.table === 'email_confirmations');
    expect(entry).toBeDefined();
    expect(entry?.reason?.length ?? 0).toBeGreaterThan(10);
  });
});
