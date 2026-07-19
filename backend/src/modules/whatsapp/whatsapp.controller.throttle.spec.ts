import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerStorageService } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { PaymentsController } from '../payments/payments.controller';

/**
 * Teto EFETIVO de requisicoes dos webhooks publicos.
 *
 * ⚠️ LICAO QUE ORIGINOU ESTE ARQUIVO: a versao anterior deste teste checava o
 * METADATA do decorator ("declara webhook=60?") e passava verde — enquanto o
 * teto real em producao seguia 10/min. Proposicao verdadeira, irrelevante.
 * Medicao ao vivo (12 POSTs em prod) mostrou 429 na 11ª.
 *
 * CAUSA (throttler.guard.js:67-97): o guard percorre TODOS os throttlers
 * nomeados do modulo e exige `.every(...)` — a requisicao precisa passar em
 * TODOS. `@Throttle({webhook: 60})` sobrescreve SO o `webhook`; o `strict`
 * continua valendo com o fallback do modulo (10/min) porque nada o pula.
 * So `@SkipThrottle({<nome>: true})` remove um throttler da conta
 * (grava THROTTLER:SKIP<nome>, exatamente a chave que o guard consulta).
 *
 * Por isso este teste MEDE: monta o guard real com storage real e conta
 * quantas requisicoes passam antes do 429. E o unico formato que teria
 * pego o bug anterior.
 */

// Mesma FORMA da config do app.module (default/strict/webhook), com os valores
// de producao. O que importa aqui e a RELACAO: `strict` (10) e mais restritivo
// que `webhook` (60), entao se `strict` nao for pulado ele e quem manda.
const THROTTLERS = [
  { name: 'default', ttl: 60000, limit: 100 },
  { name: 'strict', ttl: 60000, limit: 10 },
  { name: 'webhook', ttl: 60000, limit: 60 },
];

const STRICT_LIMIT = 10;
const WEBHOOK_LIMIT = 60;

function makeContext(
  handler: unknown,
  classRef: unknown,
  ip: string,
): ExecutionContext {
  const req = { ip, ips: [], headers: {} };
  const res = { header: () => undefined };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getHandler: () => handler,
    getClass: () => classRef,
  } as unknown as ExecutionContext;
}

/** Quantas requisicoes passam antes do guard barrar (o teto EFETIVO). */
async function measureCeiling(handler: unknown, classRef: unknown): Promise<number> {
  const storage = new ThrottlerStorageService();
  try {
    const guard = new ThrottlerGuard(
      THROTTLERS as never,
      storage,
      new Reflector(),
    );
    // O guard monta `this.throttlers` no onModuleInit, NAO no construtor
    // (throttler.guard.js:31). Sem isto, o canActivate estoura
    // "this.throttlers is not iterable" e a medicao daria 0 pra tudo.
    await guard.onModuleInit();
    let allowed = 0;
    // Teto de seguranca bem acima do maior limite configurado.
    for (let i = 0; i < WEBHOOK_LIMIT * 3; i++) {
      try {
        await guard.canActivate(makeContext(handler, classRef, '203.0.113.7'));
        allowed += 1;
      } catch {
        break; // ThrottlerException -> achamos o teto
      }
    }
    return allowed;
  } finally {
    storage.onApplicationShutdown();
  }
}

describe('Webhooks publicos — teto EFETIVO de requisicoes (guard real)', () => {
  it('🔒 o webhook do WhatsApp aguenta o limite `webhook`, nao o `strict`', async () => {
    const ceiling = await measureCeiling(
      WhatsappController.prototype.webhook,
      WhatsappController,
    );

    expect(ceiling).toBe(WEBHOOK_LIMIT);
    // Redundante de proposito: e ESTA a afirmacao que era falsa em producao.
    expect(ceiling).toBeGreaterThan(STRICT_LIMIT);
  });

  it('🔒 o webhook do Mercado Pago tambem (o molde estava capado em 10/min)', async () => {
    const ceiling = await measureCeiling(
      PaymentsController.prototype.mercadoPagoWebhook,
      PaymentsController,
    );

    expect(ceiling).toBe(WEBHOOK_LIMIT);
    expect(ceiling).toBeGreaterThan(STRICT_LIMIT);
  });

  it('controle: uma rota SEM decorator continua presa ao `strict` (o guard esta medindo mesmo)', async () => {
    // Se este teste falhar, o harness nao esta exercitando o guard de verdade
    // e os dois acima nao valem nada.
    const semDecorator = PaymentsController.prototype.getPayment;

    const ceiling = await measureCeiling(semDecorator, PaymentsController);

    expect(ceiling).toBe(STRICT_LIMIT);
  });
});
