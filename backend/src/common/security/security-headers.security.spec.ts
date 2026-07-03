/**
 * Prova de seguranca (Bloco 1 / #2): os headers de hardening HTTP estao
 * presentes na resposta do backend (via helmet, com as opcoes reais do main.ts).
 */
import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';
import { buildHelmetOptions } from './http-hardening';

@Controller()
class PingController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}

describe('Security headers (helmet) — prova de hardening web', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PingController],
    }).compile();
    app = moduleRef.createNestApplication();
    // enableSwagger=false = producao padrao (CSP ligado).
    app.use(helmet(buildHelmetOptions(false)));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  const get = () => request(app.getHttpServer()).get('/ping');

  it('envia HSTS forte (2 anos, includeSubDomains, preload)', async () => {
    const res = await get();
    expect(res.headers['strict-transport-security']).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
  });

  it('envia X-Content-Type-Options: nosniff e X-Frame-Options', async () => {
    const res = await get();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('envia Content-Security-Policy quando o swagger esta desligado', async () => {
    const res = await get();
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('nao vaza o header X-Powered-By', async () => {
    const res = await get();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
