/**
 * Prova de seguranca: revogacao de token no logout (denylist de jti em Redis).
 *
 * O ATAQUE que fechamos: hoje "sair" so limpa o cliente; o JWT continua valido
 * ate expirar. Se o token foi roubado, o logout NAO o invalida. Aqui provamos:
 *  - token valido -> logout -> o MESMO token e rejeitado (401);
 *  - revogar UMA sessao NAO afeta OUTRA sessao ativa do mesmo usuario (por-token);
 *  - a denylist tem TTL = vida restante do token (nao cresce sem limite);
 *  - Redis fora do ar NAO derruba a auth (fail-open na disponibilidade);
 *  - token legado sem jti continua funcionando (back-compat).
 */
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole } from '../../database/entities/Usuario.entity';
import { REVOKED_TOKEN_PREFIX } from './auth.constants';

const TENANT = '11111111-1111-4111-8111-111111111111';
const activeUser = {
  id: 'u1',
  email: 'a@a.com',
  role: UserRole.SELLER,
  tenant_id: TENANT,
  is_active: true,
};

function build(opts: { cacheThrows?: boolean } = {}) {
  const store = new Map<string, unknown>();
  const ttls: Record<string, number> = {};
  const cache = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get: async (k: string): Promise<any> => {
      if (opts.cacheThrows) throw new Error('redis down');
      return store.has(k) ? store.get(k) : null;
    },
    set: async (k: string, v: unknown, ttl: number): Promise<void> => {
      if (opts.cacheThrows) throw new Error('redis down');
      store.set(k, v);
      ttls[k] = ttl;
    },
    delete: async (k: string): Promise<void> => {
      store.delete(k);
    },
  } as never;
  const manager = {
    query: async () => undefined,
    getRepository: () => ({ findOne: async () => activeUser }),
  };
  const db = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    runInTransaction: async (fn: any) => fn(manager),
    getRepository: () => ({ findOne: async () => activeUser }),
  } as never;
  const audit = { log: async () => undefined } as never;
  const repo = {} as never;
  const jwt = new JwtService({
    secret: 'test-secret-para-revocation-0123456789-abcd',
    signOptions: { expiresIn: '15m' },
  });
  const svc = new AuthService(repo, jwt, audit, db, cache);
  return { svc, jwt, store, ttls };
}

function signSession(jwt: JwtService, jti?: string) {
  const payload: Record<string, unknown> = {
    sub: 'u1',
    email: 'a@a.com',
    role: UserRole.SELLER,
    tenant_id: TENANT,
  };
  if (jti) payload.jti = jti;
  const token = jwt.sign(payload);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { token, decoded: jwt.decode(token) as any };
}

describe('AuthService — revogacao de token no logout (denylist jti)', () => {
  it('🎯 token valido -> logout -> o MESMO token e rejeitado (401)', async () => {
    const { svc, jwt } = build();
    const { token, decoded } = signSession(jwt, 'sessao-1');

    // antes do logout: o token vale
    await expect(svc.validateUser(decoded)).resolves.toBeTruthy();

    // logout revoga o token atual
    await svc.logout(token);

    // depois do logout: o MESMO token e rejeitado
    await expect(svc.validateUser(decoded)).rejects.toThrow(UnauthorizedException);
  });

  it('revogar UMA sessao NAO afeta OUTRA sessao ativa do mesmo usuario', async () => {
    const { svc, jwt } = build();
    const a = signSession(jwt, 'sessao-A');
    const b = signSession(jwt, 'sessao-B');

    await svc.logout(a.token); // desloga so a sessao A

    await expect(svc.validateUser(a.decoded)).rejects.toThrow(UnauthorizedException);
    await expect(svc.validateUser(b.decoded)).resolves.toBeTruthy(); // B sobrevive
  });

  it('a denylist grava o jti com TTL = vida restante do token (bounded)', async () => {
    const { svc, jwt, store, ttls } = build();
    const { token } = signSession(jwt, 'sessao-ttl');

    await svc.logout(token);

    const key = `${REVOKED_TOKEN_PREFIX}sessao-ttl`;
    expect(store.has(key)).toBe(true);
    expect(ttls[key]).toBeGreaterThan(0);
    expect(ttls[key]).toBeLessThanOrEqual(15 * 60); // <= 15min (TTL do access token)
  });

  it('Redis fora do ar NAO derruba a auth (fail-open na disponibilidade)', async () => {
    const { svc, jwt } = build({ cacheThrows: true });
    const { decoded } = signSession(jwt, 'sessao-redis-down');
    // mesmo com o cache lancando, a validacao normal segue funcionando
    await expect(svc.validateUser(decoded)).resolves.toBeTruthy();
  });

  it('token legado SEM jti continua valido (back-compat)', async () => {
    const { svc, jwt } = build();
    const { decoded } = signSession(jwt); // sem jti
    await expect(svc.validateUser(decoded)).resolves.toBeTruthy();
  });
});
