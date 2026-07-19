import { WhatsappController } from './whatsapp.controller';
import { PaymentsController } from '../payments/payments.controller';

/**
 * Teto de requisicoes do webhook do WhatsApp.
 *
 * O ThrottlerModule (app.module.ts) registra TRES throttlers nomeados —
 * default(100/min), strict(10/min) e webhook(60/min) em producao. No
 * @nestjs/throttler v6 TODOS valem para TODA rota; quem nao declara
 * @Throttle herda os tres, e o mais restritivo manda. Ou seja: um webhook
 * publico sem decorator fica preso ao teto de 10/min do `strict`.
 *
 * Isso importa porque o tracker e por IP e a Meta entrega de poucos IPs
 * proprios: o teto e COMPARTILHADO pela loja inteira, nao por cliente. Um
 * cliente digitando "oi"/"quero"/"2"/"sim" gasta metade da cota sozinho.
 * Estourado o teto, a Meta recebe 429, re-tenta e DESCARTA a mensagem — o
 * cliente fica sem resposta e ninguem e avisado (429 e 4xx -> "level":"warn",
 * e o app-alert.sh so caça "level":"error").
 *
 * O webhook do Mercado Pago ja resolvia isso com @Throttle({webhook:...}).
 * Este teste amarra o do WhatsApp ao MESMO molde — e falha se alguem remover
 * o decorator ou se os dois webhooks divergirem.
 */
describe('WhatsappController — teto de requisicoes do webhook', () => {
  // Chave montada pelo proprio decorator: THROTTLER_LIMIT + nome, sem separador
  // (node_modules/@nestjs/throttler/dist/throttler.decorator.js:9-10).
  const LIMIT_KEY = 'THROTTLER:LIMITwebhook';
  const TTL_KEY = 'THROTTLER:TTLwebhook';

  const whatsappWebhook = WhatsappController.prototype.webhook;
  const mercadoPagoWebhook = PaymentsController.prototype.mercadoPagoWebhook;

  it('o molde ja existe: o webhook do Mercado Pago declara o throttler `webhook`', () => {
    expect(Reflect.getMetadata(LIMIT_KEY, mercadoPagoWebhook)).toBe(60);
    expect(Reflect.getMetadata(TTL_KEY, mercadoPagoWebhook)).toBe(60000);
  });

  it('🔒 o webhook do WhatsApp declara o throttler `webhook` (senao herda o strict de 10/min)', () => {
    expect(Reflect.getMetadata(LIMIT_KEY, whatsappWebhook)).toBe(60);
    expect(Reflect.getMetadata(TTL_KEY, whatsappWebhook)).toBe(60000);
  });

  it('os dois webhooks publicos usam o MESMO teto (nao divergem)', () => {
    expect(Reflect.getMetadata(LIMIT_KEY, whatsappWebhook)).toBe(
      Reflect.getMetadata(LIMIT_KEY, mercadoPagoWebhook),
    );
  });
});
