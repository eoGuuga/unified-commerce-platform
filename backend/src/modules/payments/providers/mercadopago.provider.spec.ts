import { ConfigService } from '@nestjs/config';
import {
  MercadoPagoProvider,
  PROD_TOKEN_IN_DEV_MSG,
  TEST_TOKEN_IN_PROD_MSG,
  formatPixExpiration,
} from './mercadopago.provider';

function makeConfig(token: string): ConfigService {
  return { get: (k: string) => (k === 'MERCADOPAGO_ACCESS_TOKEN' ? token : undefined) } as any;
}

describe('MercadoPagoProvider — guarda bidirecional de token (S1)', () => {
  const ORIG = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = ORIG; });

  // --- Sentido 1: APP_USR fora de produção (cobrou de verdade em dev) ---
  it('dev + APP_USR: construtor lança PROD_TOKEN_IN_DEV_MSG', () => {
    process.env.NODE_ENV = 'development';
    expect(() => new MercadoPagoProvider(makeConfig('APP_USR-123'))).toThrow(PROD_TOKEN_IN_DEV_MSG);
  });

  it('dev + APP_USR: createPixPayment lança mesmo se o construtor for contornado', async () => {
    process.env.NODE_ENV = 'production'; // constrói sem lançar
    const p = new MercadoPagoProvider(makeConfig('APP_USR-123'));
    process.env.NODE_ENV = 'development'; // agora cria pagamento em dev
    await expect(p.createPixPayment(10, 'x', 'ref')).rejects.toThrow(PROD_TOKEN_IN_DEV_MSG);
  });

  // --- Sentido 2 (espelho): TEST- em produção (subiu sem conseguir cobrar) ---
  it('production + TEST-: construtor lança TEST_TOKEN_IN_PROD_MSG', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new MercadoPagoProvider(makeConfig('TEST-abc'))).toThrow(TEST_TOKEN_IN_PROD_MSG);
  });

  it('production + TEST-: createPixPayment lança mesmo se o construtor for contornado', async () => {
    process.env.NODE_ENV = 'development'; // constrói sem lançar
    const p = new MercadoPagoProvider(makeConfig('TEST-abc'));
    process.env.NODE_ENV = 'production'; // agora cria pagamento em prod
    await expect(p.createPixPayment(10, 'x', 'ref')).rejects.toThrow(TEST_TOKEN_IN_PROD_MSG);
  });

  // --- Caminhos legítimos: cada token no seu ambiente ---
  it('dev + TEST-: não lança (configurado)', () => {
    process.env.NODE_ENV = 'development';
    const p = new MercadoPagoProvider(makeConfig('TEST-abc'));
    expect(p.isConfigured()).toBe(true);
  });

  it('production + APP_USR: não lança (lugar legítimo do token de prod)', () => {
    process.env.NODE_ENV = 'production';
    const p = new MercadoPagoProvider(makeConfig('APP_USR-123'));
    expect(p.isConfigured()).toBe(true);
  });

  // --- Token vazio: nunca lança, em qualquer ambiente ---
  it('dev + vazio: não lança, não-configurado', () => {
    process.env.NODE_ENV = 'development';
    expect(new MercadoPagoProvider(makeConfig('')).isConfigured()).toBe(false);
  });

  it('production + vazio: não lança, não-configurado', () => {
    process.env.NODE_ENV = 'production';
    expect(new MercadoPagoProvider(makeConfig('')).isConfigured()).toBe(false);
  });
});

describe('formatPixExpiration — formato verificado (S4)', () => {
  it('formatPixExpiration: datetime completo com offset -03:00 (nao UTC Z, nao so-data)', () => {
    const s = formatPixExpiration(Date.parse('2026-06-29T18:30:00.000Z'), 60);
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}-03:00$/);
    expect(s.endsWith('Z')).toBe(false);
    // 18:30 UTC + 60min = 19:30 UTC = 16:30 em -03:00
    expect(s).toBe('2026-06-29T16:30:00.000-03:00');
  });
});
