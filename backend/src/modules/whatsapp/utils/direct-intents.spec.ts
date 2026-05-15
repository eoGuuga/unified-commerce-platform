import {
  BARE_ORDER_PHRASES,
  isDirectCatalogRequest,
  isDirectGreeting,
  isDirectHelpRequest,
  isDirectPriceQuestion,
  isDirectScheduleQuestion,
  isDirectStockQuestion,
} from './direct-intents';

const testNormalizer = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('direct-intents utils', () => {
  describe('BARE_ORDER_PHRASES', () => {
    it('contem frases-pelada de pedido', () => {
      expect(BARE_ORDER_PHRASES.has('quero')).toBe(true);
      expect(BARE_ORDER_PHRASES.has('pedido')).toBe(true);
      expect(BARE_ORDER_PHRASES.has('quero pedir')).toBe(true);
      expect(BARE_ORDER_PHRASES.has('gostaria de')).toBe(true);
    });

    it('nao inclui frases com produto', () => {
      expect(BARE_ORDER_PHRASES.has('quero brigadeiro')).toBe(false);
    });
  });

  describe('isDirectCatalogRequest', () => {
    it.each([
      ['cardapio', true],
      ['catalogo por favor', true],
      ['me manda o menu', true],
      ['quero comprar', false],
    ])('para "%s" retorna %s', (input, expected) => {
      expect(isDirectCatalogRequest(input, testNormalizer)).toBe(expected);
    });
  });

  describe('isDirectPriceQuestion', () => {
    it.each([
      ['qual o preco', true],
      ['quanto custa', true],
      ['quanto sai', true],
      ['qual o valor', true],
      ['oi', false],
    ])('para "%s" retorna %s', (input, expected) => {
      expect(isDirectPriceQuestion(input, testNormalizer)).toBe(expected);
    });
  });

  describe('isDirectStockQuestion', () => {
    it.each([
      ['tem estoque', true],
      ['ainda tem disponivel', true],
      ['disponibilidade', true],
      ['restou estoque', true],
      ['quero pedir', false],
    ])('para "%s" retorna %s', (input, expected) => {
      expect(isDirectStockQuestion(input, testNormalizer)).toBe(expected);
    });
  });

  describe('isDirectScheduleQuestion', () => {
    it.each([
      ['qual o horario', true],
      ['vcs funciona hoje', true],
      ['ja abre', true], // "abre" eh palavra-chave; "abriu" nao casa por \b
      ['ja esta aberto', true],
      ['que horas fecha', true],
      ['quero comprar', false],
    ])('para "%s" retorna %s', (input, expected) => {
      expect(isDirectScheduleQuestion(input, testNormalizer)).toBe(expected);
    });
  });

  describe('isDirectHelpRequest', () => {
    it('aceita exatamente "ajuda" / "help" / "comandos"', () => {
      expect(isDirectHelpRequest('ajuda', testNormalizer)).toBe(true);
      expect(isDirectHelpRequest('help', testNormalizer)).toBe(true);
      expect(isDirectHelpRequest('comandos', testNormalizer)).toBe(true);
    });

    it('rejeita frases com a palavra mas mais coisas', () => {
      expect(
        isDirectHelpRequest('preciso de ajuda urgente', testNormalizer),
      ).toBe(false);
    });

    it('rejeita string vazia', () => {
      expect(isDirectHelpRequest('', testNormalizer)).toBe(false);
    });
  });

  describe('isDirectGreeting', () => {
    it('saudacoes puras', () => {
      expect(isDirectGreeting('oi', testNormalizer)).toBe(true);
      expect(isDirectGreeting('ola', testNormalizer)).toBe(true);
      expect(isDirectGreeting('bom dia', testNormalizer)).toBe(true);
      expect(isDirectGreeting('boa tarde tudo bem', testNormalizer)).toBe(
        true,
      );
    });

    it('rejeita saudacao + intent comercial', () => {
      expect(
        isDirectGreeting('oi, quero brigadeiro', testNormalizer),
      ).toBe(false);
      expect(isDirectGreeting('ola, qual o preco?', testNormalizer)).toBe(
        false,
      );
    });

    it('rejeita string vazia', () => {
      expect(isDirectGreeting('', testNormalizer)).toBe(false);
    });
  });
});
