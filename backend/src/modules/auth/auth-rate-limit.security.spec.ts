/**
 * Prova de seguranca (Bloco 1 / #1): brute-force no login e bloqueado.
 *
 * Ataque simulado: N+1 tentativas rapidas de login com credencial invalida.
 *  - A tentativa N+1 do MESMO cliente recebe 429 (rate limit ativo).
 *  - A contagem e por CLIENTE real (X-Forwarded-For), nao pelo IP do proxy
 *    reverso. Sem `trust proxy`, o @nestjs/throttler chaveia no IP do nginx e
 *    TODOS os clientes caem no mesmo balde: o atacante nao e isolado e ainda
 *    consegue negar login a todos. O segundo teste so passa com o hardening
 *    (applyExpressHardening -> trust proxy) ligado.
 */
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { applyExpressHardening } from '../../common/security/http-hardening';

const LOGIN_LIMIT = 10; // igual ao @Throttle({ strict: { limit: 10 } }) do /auth/login
const TENANT = '00000000-0000-0000-0000-000000000000';

describe('Auth — rate limit de login (prova de brute-force bloqueado)', () => {
  let app: INestApplication;
  const login = jest.fn();

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: 'default', ttl: 60000, limit: 100 },
          { name: 'strict', ttl: 60000, limit: LOGIN_LIMIT },
        ]),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: { login } },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    applyExpressHardening(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    // Toda tentativa "falha" como credencial invalida (401) — o cenario de brute-force.
    login.mockReset();
    login.mockRejectedValue(new UnauthorizedException('Credenciais invalidas'));
  });

  const attempt = (ip: string) =>
    request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-id', TENANT)
      .set('X-Forwarded-For', ip)
      .send({ email: 'victim@example.com', password: 'guess' });

  it('bloqueia a tentativa N+1 do mesmo cliente com 429', async () => {
    const ip = '203.0.113.7';
    for (let i = 0; i < LOGIN_LIMIT; i++) {
      const res = await attempt(ip);
      expect(res.status).toBe(401);
    }
    const blocked = await attempt(ip);
    expect(blocked.status).toBe(429);
  });

  it('conta por cliente real (X-Forwarded-For): um atacante esgotado nao nega login a outro cliente', async () => {
    const attacker = '203.0.113.66';
    for (let i = 0; i < LOGIN_LIMIT; i++) {
      await attempt(attacker);
    }
    expect((await attempt(attacker)).status).toBe(429);

    // Cliente legitimo, IP diferente — deve continuar podendo tentar (401, nao 429).
    const legit = await attempt('198.51.100.9');
    expect(legit.status).toBe(401);
  });
});
