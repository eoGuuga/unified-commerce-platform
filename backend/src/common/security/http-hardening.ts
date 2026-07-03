import type { INestApplication } from '@nestjs/common';

/**
 * Numero de proxies reversos confiaveis na frente da app (nginx = 1 hop).
 *
 * Sem `trust proxy`, o Express usa o IP do socket (o do nginx) como req.ip, e
 * o @nestjs/throttler chaveia TODOS os clientes no mesmo balde: a protecao de
 * brute-force fica inutil (o atacante nao e isolado) e um atacante ainda
 * consegue negar login a todos estourando o balde compartilhado. Com o valor
 * certo, req.ip/req.ips passam a refletir o CLIENTE real via X-Forwarded-For.
 */
export const TRUST_PROXY_HOPS = 1;

/**
 * Hardening no nivel do Express (proxy reverso + headers que vazam a stack).
 *
 * Extraido do main.ts para ser testavel isoladamente (o main.ts nao entra na
 * coleta de cobertura). O bootstrap chama esta funcao; os testes de seguranca
 * exercitam exatamente o mesmo codigo.
 */
export function applyExpressHardening(app: INestApplication): void {
  const instance = app.getHttpAdapter().getInstance() as {
    set?: (key: string, value: unknown) => void;
    disable?: (key: string) => void;
  };
  // Rate limit por cliente real (ver TRUST_PROXY_HOPS).
  instance.set?.('trust proxy', TRUST_PROXY_HOPS);
  // Remove headers que revelam a stack (Express).
  instance.disable?.('x-powered-by');
  // Evita respostas 304/ETag em APIs.
  instance.disable?.('etag');
}
