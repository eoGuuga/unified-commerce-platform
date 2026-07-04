/**
 * Envelope encryption (Fase 1) — testes da API tenant-aware.
 *
 * O CORACAO e o isolamento de chave: a DEK de um tenant NAO pode decifrar o
 * dado de outro. Um DataSource mock simula a tabela tenant_data_keys em memoria
 * (o RLS de verdade e provado no *.integration.spec, contra o banco).
 */
import { EncryptionService } from './encryption.service';

type DekRow = { version: number; wrapped: string };

function buildEnvelope(
  opts: {
    encKey?: string;
    masterKey?: string;
    store?: Map<string, DekRow>;
  } = {},
): { svc: EncryptionService; store: Map<string, DekRow> } {
  const encKey = opts.encKey ?? 'enc-key-teste-bem-grande-1234567890-abcd';
  const masterKey =
    opts.masterKey ?? 'MASTER-key-teste-bem-grande-0987654321-wxyz';
  const store = opts.store ?? new Map<string, DekRow>();

  const manager = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: async (sql: string, params: any[]) => {
      if (/set_config/i.test(sql)) return [];
      if (/select[\s\S]*tenant_data_keys/i.test(sql)) {
        const e = store.get(params[0]);
        return e ? [{ key_version: e.version, wrapped_dek: e.wrapped }] : [];
      }
      if (/insert[\s\S]*tenant_data_keys/i.test(sql)) {
        // INSERT ... VALUES ($1, 1, $2) -> key_version literal, params = [tenant, wrapped]
        const [t, w] = params;
        if (!store.has(t)) store.set(t, { version: 1, wrapped: w });
        return [];
      }
      return [];
    },
  };
  const dataSource = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transaction: async (fn: any) => fn(manager),
  } as never;
  const configService = {
    get: (name: string) =>
      name === 'ENCRYPTION_MASTER_KEY' ? masterKey : encKey,
  } as never;

  return { svc: new EncryptionService(configService, dataSource), store };
}

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('EncryptionService envelope — isolamento de chave por-tenant', () => {
  it('🎯 a DEK de um tenant NAO decifra o dado de outro (A cifra; B nao le)', async () => {
    const { svc, store } = buildEnvelope();
    const secret = 'credencial-de-recebimento-do-tenant-A';

    const ct = await svc.encrypt(secret, A);
    expect(ct).not.toContain(secret); // nunca em claro
    expect(ct.startsWith('v2.')).toBe(true); // formato envelope

    // B tambem passa a ter a propria DEK (distinta):
    await svc.encrypt('outro-segredo-do-B', B);

    // A le o proprio dado:
    expect(await svc.decrypt(ct, A)).toBe(secret);

    // B (DEK diferente) NAO le o dado de A:
    expect(await svc.decrypt(ct, B)).toBeNull();

    // sanity: A e B tem DEKs distintas persistidas (wrapped diferentes)
    expect(store.get(A)!.wrapped).not.toBe(store.get(B)!.wrapped);
  });

  it('round-trip v2: cifra e decifra o proprio dado', async () => {
    const { svc } = buildEnvelope();
    const secret = 'token-da-cloud-api-EAAG...';
    const ct = await svc.encrypt(secret, A);
    expect(await svc.decrypt(ct, A)).toBe(secret);
  });

  it('IV nao-deterministico: mesmo texto -> ciphertexts diferentes (mesma DEK)', async () => {
    const { svc } = buildEnvelope();
    const a = await svc.encrypt('mesmo-segredo', A);
    const b = await svc.encrypt('mesmo-segredo', A);
    expect(a).not.toBe(b); // IV aleatorio
    expect(await svc.decrypt(a, A)).toBe('mesmo-segredo');
    expect(await svc.decrypt(b, A)).toBe('mesmo-segredo');
  });

  it('dual-format: le o formato v1 legado (chave unica) transparentemente', async () => {
    const { svc } = buildEnvelope();
    // um segredo cifrado no formato ANTIGO (v1, sem prefixo "v2.")
    const legacy = svc.encryptString('segredo-legado-v1');
    expect(legacy.startsWith('v2.')).toBe(false);
    // decrypt tenant-aware detecta v1 e usa a ENCRYPTION_KEY (nao a DEK)
    expect(await svc.decrypt(legacy, A)).toBe('segredo-legado-v1');
  });

  it('adulteracao: mexer no ciphertext v2 -> null (tag falha)', async () => {
    const { svc } = buildEnvelope();
    const ct = await svc.encrypt('segredo', A);
    const parts = ct.split('.'); // v2.version.iv.tag.ct
    const badCt = Buffer.from(parts[4], 'base64');
    badCt[0] ^= 0x01; // vira 1 bit do ciphertext
    parts[4] = badCt.toString('base64');
    expect(await svc.decrypt(parts.join('.'), A)).toBeNull();
  });

  it('formato v2 invalido (partes de menos) -> null', async () => {
    const { svc } = buildEnvelope();
    expect(await svc.decrypt('v2.1.so-tres-partes', A)).toBeNull();
    expect(await svc.decrypt(null, A)).toBeNull();
    expect(await svc.decrypt(undefined, A)).toBeNull();
  });

  it('master errada: unwrap da DEK PROPAGA (nao vira null silencioso)', async () => {
    // instancia 1 cifra e persiste a DEK de A embrulhada com master-1
    const store = new Map<string, DekRow>();
    const { svc: svc1 } = buildEnvelope({ masterKey: 'MASTER-1-forte-com-32+-chars-aaaaaaaa', store });
    const ct = await svc1.encrypt('segredo-de-A', A);

    // instancia 2 (master DIFERENTE, MESMO store) tenta ler -> unwrap falha -> propaga
    const { svc: svc2 } = buildEnvelope({ masterKey: 'MASTER-2-forte-com-32+-chars-bbbbbbbb', store });
    await expect(svc2.decrypt(ct, A)).rejects.toThrow();
  });

  it('idempotencia da DEK: cifrar 2x reusa a MESMA DEK (nao cria v2 duplicada)', async () => {
    const { svc, store } = buildEnvelope();
    await svc.encrypt('primeiro', A);
    const wrappedApos1 = store.get(A)!.wrapped;
    await svc.encrypt('segundo', A);
    // mesma DEK persistida (nao regenerou), so 1 version
    expect(store.get(A)!.wrapped).toBe(wrappedApos1);
    expect(store.get(A)!.version).toBe(1);
  });

  it('boot fail-closed: recusa subir sem ENCRYPTION_MASTER_KEY forte', () => {
    expect(() => buildEnvelope({ masterKey: 'curta' })).toThrow(/ENCRYPTION_MASTER_KEY/);
    expect(() => buildEnvelope({ masterKey: 'change-me-please-change-me-please-32' })).toThrow(
      /ENCRYPTION_MASTER_KEY/,
    );
  });
});
