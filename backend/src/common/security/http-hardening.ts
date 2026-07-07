import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

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

/**
 * Opcoes do helmet para o backend (headers de seguranca HTTP).
 *
 * Extraido para ser testavel. Destaques:
 *  - HSTS explicito de 2 anos (+ includeSubDomains + preload) — protege contra
 *    downgrade/SSL-strip; sem isto o navegador aceita a 1a request em HTTP.
 *  - CSP do helmet fica LIGADO por padrao, mas e desligado quando o swagger-ui
 *    esta servido (ele usa inline e quebraria). O swagger e IP-locked no nginx.
 *
 * Nota: os headers que o USUARIO ve no site (frontend Next.js) vem do nginx,
 * nao daqui — este helmet cobre so as respostas da API. HSTS/CSP do site sao
 * setados no nginx (deploy/nginx/ucm.conf).
 */
export function buildHelmetOptions(
  enableSwagger: boolean,
): Parameters<typeof helmet>[0] {
  return {
    strictTransportSecurity: {
      maxAge: 63072000, // 2 anos
      includeSubDomains: true,
      preload: true,
    },
    contentSecurityPolicy: enableSwagger ? false : true,
    crossOriginEmbedderPolicy: enableSwagger ? false : { policy: 'require-corp' },
  };
}
