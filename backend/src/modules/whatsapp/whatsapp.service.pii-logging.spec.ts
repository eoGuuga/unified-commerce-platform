import { WhatsAppService } from './whatsapp.service';

/**
 * Guarda de LGPD: o WhatsAppService NAO pode gravar o CONTEUDO da mensagem do
 * cliente no log (console ou logger). O conteudo de conversa e dado pessoal;
 * logar isso em prod (quando o bot entrar no ar) seria vazamento.
 *
 * Mesma regua do fix do audit-log (email fora do log): o teste usa uma
 * "sentinela" no lugar do conteudo real e prova que ela NAO aparece em log
 * nenhum — o `error` continua sendo logado (diagnostico preservado).
 *
 * Teste unitario de COMPORTAMENTO DE LOG (nao de fluxo): invoca os handlers
 * diretamente com deps minimas + spies. A sentinela e toda minuscula/estavel
 * para sobreviver ao `.toLowerCase()` interno.
 */
describe('WhatsAppService — nao vaza conteudo de mensagem do cliente no log (LGPD)', () => {
  const SENTINEL = 'sentinelapii4242';
  const TENANT = 'tenant-x';
  const PHONE = '5511999999999';

  // O construtor tem 31 deps posicionais; so productsService (idx 9) e
  // cartService (idx 21) sao exercitados nos caminhos deste teste.
  function makeService() {
    const productsService: any = { search: jest.fn().mockResolvedValue([]) };
    const cartService: any = { getOrCreateCart: jest.fn() };
    const deps: any[] = Array.from({ length: 31 }, () => ({}));
    deps[9] = productsService;
    deps[21] = cartService;
    const service = new (WhatsAppService as any)(...deps);
    return { service, productsService, cartService };
  }

  function leaksSentinel(spy: jest.SpyInstance): boolean {
    return spy.mock.calls.some((args) =>
      JSON.stringify(args).toLowerCase().includes(SENTINEL),
    );
  }

  afterEach(() => jest.restoreAllMocks());

  it('NAO escreve o conteudo da mensagem no console.log (fluxo normal do handleCart)', async () => {
    const { service, productsService } = makeService();
    productsService.search.mockResolvedValue([]); // nao encontra -> retorna limpo
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    // "quero <sentinela>" -> intencao de adicionar -> passa pelo site :777
    await (service as any).handleCart(TENANT, PHONE, `quero ${SENTINEL}`, {} as any);

    expect(productsService.search).toHaveBeenCalled(); // sanity: chegamos no caminho
    expect(leaksSentinel(consoleSpy)).toBe(false);
  });

  it('NAO inclui o conteudo da mensagem no logger.error do catch — mas MANTEM o error', async () => {
    const { service, cartService } = makeService();
    const boom = new Error('cart indisponivel');
    cartService.getOrCreateCart.mockRejectedValue(boom); // forca o catch (:673)
    const errorSpy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);

    // "remover <sentinela>" -> branch de remover -> catch :673 (que retorna, sem fallthrough)
    await (service as any).handleCart(TENANT, PHONE, `remover ${SENTINEL}`, {} as any);

    // regressao: o erro DEVE continuar logado (diagnostico util preservado)
    expect(errorSpy).toHaveBeenCalled();
    // mas o conteudo do cliente NAO pode vazar em lugar nenhum do log
    expect(leaksSentinel(errorSpy)).toBe(false);
  });
});
