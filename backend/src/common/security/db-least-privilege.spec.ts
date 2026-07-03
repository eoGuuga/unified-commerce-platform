/**
 * Prova de seguranca (Bloco 1 / #3): o boot recusa um papel de banco privilegiado.
 *
 * Se o app conectar como superuser ou BYPASSRLS, o RLS e ignorado e o
 * isolamento multi-tenant morre — o boot deve abortar (fail-closed).
 */
import { assertDatabaseLeastPrivilege } from './db-least-privilege';

const dsWith = (row: Record<string, unknown> | null) => ({
  query: jest.fn().mockResolvedValue(row ? [row] : []),
});

describe('assertDatabaseLeastPrivilege — boot fail-closed contra papel privilegiado', () => {
  it('lanca se conectado como SUPERUSER (RLS seria ignorado)', async () => {
    await expect(
      assertDatabaseLeastPrivilege(
        dsWith({ is_superuser: 'on', bypassrls: false, usr: 'postgres' }),
      ),
    ).rejects.toThrow(/privilegiado/i);
  });

  it('lanca se o papel tem BYPASSRLS (mesmo sem ser superuser)', async () => {
    await expect(
      assertDatabaseLeastPrivilege(
        dsWith({ is_superuser: 'off', bypassrls: true, usr: 'evil' }),
      ),
    ).rejects.toThrow(/privilegiado/i);
  });

  it('passa com papel restrito (ucm_app: NOSUPERUSER, sem BYPASSRLS)', async () => {
    await expect(
      assertDatabaseLeastPrivilege(
        dsWith({ is_superuser: 'off', bypassrls: false, usr: 'ucm_app' }),
      ),
    ).resolves.toBeUndefined();
  });

  it('lanca se a verificacao nao retorna linha', async () => {
    await expect(assertDatabaseLeastPrivilege(dsWith(null))).rejects.toThrow(
      /nao foi possivel verificar/i,
    );
  });
});
