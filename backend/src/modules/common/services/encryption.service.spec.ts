/**
 * Testes da criptografia AES-256-GCM em TypeScript (R2).
 * Substitui o caminho SQL fantasma (encrypt_api_key nunca existiu no banco).
 */
import { EncryptionService } from './encryption.service';

function buildService(key = 'uma-chave-de-teste-bem-grande-1234567890') {
  const configService = { get: () => key } as never;
  const dataSource = {} as never;
  return new EncryptionService(configService, dataSource);
}

describe('EncryptionService.encryptString/decryptString (AES real)', () => {
  it('round-trip: descriptografar volta ao texto original', () => {
    const svc = buildService();
    const secret = 'EAAG-token-da-cloud-api-1234567890-abcdef';
    const enc = svc.encryptString(secret);
    expect(enc).not.toContain(secret); // nao guarda em claro
    expect(svc.decryptString(enc)).toBe(secret);
  });

  it('cada criptografia usa IV diferente (ciphertext nao e deterministico)', () => {
    const svc = buildService();
    const a = svc.encryptString('mesmo-segredo');
    const b = svc.encryptString('mesmo-segredo');
    expect(a).not.toBe(b);
    expect(svc.decryptString(a)).toBe('mesmo-segredo');
    expect(svc.decryptString(b)).toBe('mesmo-segredo');
  });

  it('retorna null para payload nulo/indefinido/vazio', () => {
    const svc = buildService();
    expect(svc.decryptString(null)).toBeNull();
    expect(svc.decryptString(undefined)).toBeNull();
    expect(svc.decryptString('')).toBeNull();
  });

  it('rejeita payload adulterado (authTag invalido) retornando null', () => {
    const svc = buildService();
    const enc = svc.encryptString('segredo');
    const [iv, , data] = enc.split('.');
    const tampered = `${iv}.${Buffer.from('tag-falsa').toString('base64')}.${data}`;
    expect(svc.decryptString(tampered)).toBeNull();
  });

  it('chave diferente nao consegue descriptografar (isolamento de chave)', () => {
    const svcA = buildService('chave-A-bem-grande-1234567890-abcdefghij');
    const svcB = buildService('chave-B-bem-grande-1234567890-abcdefghij');
    const enc = svcA.encryptString('segredo-do-A');
    expect(svcB.decryptString(enc)).toBeNull();
  });

  it('rejeita formato invalido (sem os 3 segmentos)', () => {
    const svc = buildService();
    expect(svc.decryptString('lixo-sem-pontos')).toBeNull();
    expect(svc.decryptString('so.dois')).toBeNull();
  });
});
