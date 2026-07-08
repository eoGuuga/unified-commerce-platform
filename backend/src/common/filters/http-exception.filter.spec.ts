/**
 * Camada 5 do fix de PII (LGPD): o HttpExceptionFilter NAO pode vazar a query
 * string na resposta 4xx nem no log. Hoje ele poe `request.url` (que inclui a
 * query) tanto no corpo devolvido ao cliente quanto no log — foi assim que o
 * `?hub.verify_token=...` do webhook da Meta vazou num 403.
 *
 * Abordagem do fix (robusta): remover a query string INTEIRA do path
 * logado/devolvido (guardar so o pathname). NAO usamos denylist de chaves —
 * ela e fragil e esquece o proximo param sensivel. O `requestId` ja correlaciona
 * a requisicao pro debug.
 */
import 'reflect-metadata';
import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function makeHost(url: string, method = 'GET') {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  const response = { status: statusMock } as any;
  const request = { url, method, requestId: 'req-abc-123' } as any;
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, jsonMock };
}

describe('HttpExceptionFilter — nao vaza query string (Camada 5 do fix de PII)', () => {
  let filter: HttpExceptionFilter;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const SECRET = 'gtsofthub-wh-verify-SUPERSECRET';
  const urlComSegredo = `/api/v1/whatsapp/webhook?hub.verify_token=${SECRET}&hub.challenge=42`;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('🎯 4xx: o path DEVOLVIDO ao cliente nao tem a query (so o pathname)', () => {
    const { host, jsonMock } = makeHost(urlComSegredo);

    filter.catch(new ForbiddenException('Forbidden'), host);

    const body = jsonMock.mock.calls[0][0];
    expect(body.path).toBe('/api/v1/whatsapp/webhook');
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(JSON.stringify(body)).not.toContain('hub.verify_token');
  });

  it('🎯 4xx: o path LOGADO (warn) nao tem a query sensivel', () => {
    const { host } = makeHost(urlComSegredo);

    filter.catch(new ForbiddenException('Forbidden'), host);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = warnSpy.mock.calls[0].join(' ');
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain('hub.verify_token');
    // o pathname continua no log (util pro diagnostico)
    expect(logged).toContain('/api/v1/whatsapp/webhook');
  });

  it('🎯 5xx: o path (log e resposta) tambem tem a query removida', () => {
    const { host, jsonMock } = makeHost('/api/v1/pagar?token=SEGREDO_5XX', 'POST');

    filter.catch(new InternalServerErrorException('detalhe interno do banco'), host);

    const body = jsonMock.mock.calls[0][0];
    expect(body.path).toBe('/api/v1/pagar');
    expect(JSON.stringify(body)).not.toContain('SEGREDO_5XX');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls[0].join(' ');
    expect(logged).not.toContain('SEGREDO_5XX');
  });
});

describe('HttpExceptionFilter — regressao (o fix nao pode quebrar o resto)', () => {
  let filter: HttpExceptionFilter;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('o log de erro continua util: pathname + requestId + status + method', () => {
    const { host } = makeHost('/api/v1/orders?foo=bar', 'GET');

    filter.catch(new BadRequestException('Campo invalido'), host);

    const logged = warnSpy.mock.calls[0].join(' ');
    expect(logged).toContain('/api/v1/orders'); // pathname preservado
    expect(logged).toContain('req-abc-123'); // requestId
    expect(logged).toContain('400'); // status
    expect(logged).toContain('GET'); // method
  });

  it('5xx continua mascarado: message generica, sem error/details expostos', () => {
    const { host, jsonMock } = makeHost('/api/v1/pagar', 'POST');

    filter.catch(new InternalServerErrorException('detalhe interno do banco'), host);

    const body = jsonMock.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error'); // mascarado
    expect(body.error).toBeUndefined(); // nao exposto fora de dev
    expect(JSON.stringify(body)).not.toContain('detalhe interno do banco');
  });

  it('4xx preserva a mensagem de negocio (nao mascara abaixo de 500)', () => {
    const { host, jsonMock } = makeHost('/api/v1/orders', 'POST');

    filter.catch(new BadRequestException('Estoque insuficiente'), host);

    const body = jsonMock.mock.calls[0][0];
    expect(body.statusCode).toBe(400);
    expect(body.message).toBe('Estoque insuficiente');
  });

  it('path sem query permanece intacto', () => {
    const { host, jsonMock } = makeHost('/api/v1/health', 'GET');

    filter.catch(new BadRequestException('x'), host);

    const body = jsonMock.mock.calls[0][0];
    expect(body.path).toBe('/api/v1/health');
  });
});

/**
 * Camada 5b: em rota inexistente o NestJS gera o message padrao
 * "Cannot GET /rota?query" — e a query vaza pelo `message` (o `path` ja e limpo
 * pela Camada 5). Mesma filosofia: remover a CLASSE (nao denylist de params) —
 * quando o message embute a URL crua da requisicao (com query), sai limpa (so o
 * pathname), mantendo rota + verbo pro debug.
 */
describe('HttpExceptionFilter — message nao vaza a query embutida (Camada 5b)', () => {
  let filter: HttpExceptionFilter;
  let warnSpy: jest.SpyInstance;

  const SECRET = 'SEGREDO_5B';
  const rota = '/api/v1/rota-inexistente';
  const urlComQuery = `${rota}?token=${SECRET}`;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('🎯 404 default: o message DEVOLVIDO nao contem a query, mas mantem rota + verbo', () => {
    const { host, jsonMock } = makeHost(urlComQuery, 'GET');

    // simula o 404 automatico do Nest: message = "Cannot GET <url com query>"
    filter.catch(new NotFoundException(`Cannot GET ${urlComQuery}`), host);

    const body = jsonMock.mock.calls[0][0];
    expect(body.message).toBe('Cannot GET /api/v1/rota-inexistente');
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it('🎯 404 default: o message LOGADO nao contem a query (mantem rota + verbo)', () => {
    const { host } = makeHost(urlComQuery, 'GET');

    filter.catch(new NotFoundException(`Cannot GET ${urlComQuery}`), host);

    const logged = warnSpy.mock.calls[0].join(' ');
    expect(logged).not.toContain(SECRET);
    expect(logged).toContain(rota); // rota preservada pro debug
    expect(logged).toContain('Cannot GET'); // verbo preservado pro debug
  });

  it('regressao: message controlada (sem URL embutida) fica intacta — ex.: webhook 403', () => {
    const { host, jsonMock } = makeHost('/api/v1/whatsapp/webhook?hub.verify_token=X', 'GET');

    filter.catch(new ForbiddenException('Falha na verificacao do webhook.'), host);

    const body = jsonMock.mock.calls[0][0];
    expect(body.message).toBe('Falha na verificacao do webhook.');
    expect(JSON.stringify(body)).not.toContain('hub.verify_token');
  });

  it('regressao: message que embute a URL SEM query fica igual', () => {
    const { host, jsonMock } = makeHost('/api/v1/rota-inexistente', 'GET');

    filter.catch(new NotFoundException('Cannot GET /api/v1/rota-inexistente'), host);

    const body = jsonMock.mock.calls[0][0];
    expect(body.message).toBe('Cannot GET /api/v1/rota-inexistente');
  });
});
