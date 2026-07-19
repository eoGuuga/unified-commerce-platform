import { requireAdminPassword } from './admin-password';

/**
 * F12 (blindagem do seed): o seed nunca pode criar/atualizar o admin com uma
 * senha default PUBLICA (o antigo `|| 'senha123'`). Sem `SEED_ADMIN_PASSWORD`,
 * o seed tem que FALHAR — nao cair num default conhecido do codigo.
 */
describe('requireAdminPassword — F12: seed sem senha default publica', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('(a) sem SEED_ADMIN_PASSWORD → lanca erro (recusa o default)', () => {
    delete process.env.SEED_ADMIN_PASSWORD;
    expect(() => requireAdminPassword()).toThrow(/SEED_ADMIN_PASSWORD/);
  });

  it('(a) SEED_ADMIN_PASSWORD vazio → lanca erro', () => {
    process.env.SEED_ADMIN_PASSWORD = '';
    expect(() => requireAdminPassword()).toThrow(/SEED_ADMIN_PASSWORD/);
  });

  it('(b) com SEED_ADMIN_PASSWORD setado → retorna a senha (sem default)', () => {
    process.env.SEED_ADMIN_PASSWORD = 'Brigadeiro2026';
    expect(requireAdminPassword()).toBe('Brigadeiro2026');
  });
});
