/**
 * Testes do WhatsappConfigResolver (R2 - WhatsApp por-tenant).
 * Prova o isolamento por-tenant: cada tenant resolve o proprio provider/credencial,
 * e o fallback para o env global mantem compatibilidade.
 */
import { WhatsappConfigResolver } from './whatsapp-config.resolver';

function buildResolver(opts: {
  tenantSettings?: Record<string, unknown>;
  decryptedToken?: string | null;
  globalEnv?: Record<string, string>;
  tenantThrows?: boolean;
}) {
  const tenantsService = {
    findOneById: jest.fn().mockImplementation(async () => {
      if (opts.tenantThrows) throw new Error('tenant nao encontrado');
      return { id: 't1', settings: { whatsapp: opts.tenantSettings || {} } };
    }),
  };
  const encryptionService = {
    getWhatsappCloudToken: jest.fn().mockResolvedValue(opts.decryptedToken ?? null),
  };
  const config = {
    get: (key: string, def?: string) => opts.globalEnv?.[key] ?? def ?? '',
  };
  return new WhatsappConfigResolver(
    tenantsService as any,
    encryptionService as any,
    config as any,
  );
}

describe('WhatsappConfigResolver (R2 - per-tenant)', () => {
  it('resolve cloud_api do tenant com token descriptografado', async () => {
    const resolver = buildResolver({
      tenantSettings: { provider: 'cloud_api', phoneNumberId: '12345', apiVersion: 'v21.0' },
      decryptedToken: 'SECRET-TOKEN-DO-TENANT',
    });
    const config = await resolver.resolve('t1');

    expect(config.provider).toBe('cloud_api');
    expect(config.cloudApi?.phoneNumberId).toBe('12345');
    expect(config.cloudApi?.accessToken).toBe('SECRET-TOKEN-DO-TENANT');
  });

  it('resolve evolution do tenant (legado) das settings', async () => {
    const resolver = buildResolver({
      tenantSettings: { provider: 'evolution', apiUrl: 'http://x', apiKey: 'k', instance: 'inst1' },
    });
    const config = await resolver.resolve('t1');

    expect(config.provider).toBe('evolution');
    expect(config.evolution?.instance).toBe('inst1');
  });

  it('FALLBACK: tenant sem provider proprio usa o env global (cloud_api)', async () => {
    const resolver = buildResolver({
      tenantSettings: {}, // tenant nao configurou nada
      globalEnv: {
        WHATSAPP_PROVIDER: 'cloud_api',
        WHATSAPP_CLOUD_PHONE_NUMBER_ID: 'global-phone',
        WHATSAPP_CLOUD_ACCESS_TOKEN: 'global-token',
      },
    });
    const config = await resolver.resolve('t1');

    expect(config.provider).toBe('cloud_api');
    expect(config.cloudApi?.phoneNumberId).toBe('global-phone');
    expect(config.cloudApi?.accessToken).toBe('global-token');
  });

  it('FALLBACK: env global evolution', async () => {
    const resolver = buildResolver({
      tenantSettings: {},
      globalEnv: { WHATSAPP_PROVIDER: 'evolution', EVOLUTION_API_URL: 'u', EVOLUTION_API_KEY: 'k' },
    });
    const config = await resolver.resolve('t1');
    expect(config.provider).toBe('evolution');
    expect(config.evolution?.apiUrl).toBe('u');
  });

  it('sem nada configurado -> mock (nao explode)', async () => {
    const resolver = buildResolver({ tenantSettings: {}, globalEnv: {} });
    const config = await resolver.resolve('t1');
    expect(config.provider).toBe('mock');
  });

  it('erro ao carregar tenant -> cai no fallback global (nao propaga excecao)', async () => {
    const resolver = buildResolver({
      tenantThrows: true,
      globalEnv: { WHATSAPP_PROVIDER: 'mock' },
    });
    const config = await resolver.resolve('t1');
    expect(config.provider).toBe('mock');
  });

  it('isolamento: dois tenants diferentes nao compartilham credencial (cache por tenant)', async () => {
    // tenant A = cloud_api proprio; tenant B (outra instancia) = mock global
    const resolverA = buildResolver({
      tenantSettings: { provider: 'cloud_api', phoneNumberId: 'A-phone' },
      decryptedToken: 'A-token',
    });
    const configA = await resolver_resolveTwice(resolverA, 'tenantA');
    expect(configA.cloudApi?.phoneNumberId).toBe('A-phone');

    const resolverB = buildResolver({ tenantSettings: {}, globalEnv: { WHATSAPP_PROVIDER: 'mock' } });
    const configB = await resolverB.resolve('tenantB');
    expect(configB.provider).toBe('mock');
    expect(configB.cloudApi).toBeUndefined();
  });
});

// Helper: chama resolve 2x para exercitar o cache.
async function resolver_resolveTwice(resolver: WhatsappConfigResolver, tenantId: string) {
  await resolver.resolve(tenantId);
  return resolver.resolve(tenantId);
}
