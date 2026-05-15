import {
  extractCustomerNameCandidate,
  extractPhoneDigitsCandidate,
  looksLikeStandalonePhoneMessage,
} from './customer-extract';

const testNormalizer = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('customer-extract utils', () => {
  describe('extractCustomerNameCandidate', () => {
    it('remove prefixos de apresentacao', () => {
      expect(extractCustomerNameCandidate('meu nome e Maria Silva')).toBe(
        'Maria Silva',
      );
      expect(extractCustomerNameCandidate('me chamo Joao')).toBe('Joao');
      expect(extractCustomerNameCandidate('eu sou Ana')).toBe('Ana');
      expect(extractCustomerNameCandidate('sou o Carlos')).toBe('Carlos');
    });

    it('remove despedidas no final', () => {
      expect(extractCustomerNameCandidate('Maria Silva, obrigada')).toBe(
        'Maria Silva,',
      );
      expect(extractCustomerNameCandidate('Joao ok')).toBe('Joao');
    });

    it('colapsa whitespace e faz trim', () => {
      expect(extractCustomerNameCandidate('  Maria   Silva  ')).toBe(
        'Maria Silva',
      );
    });

    it('mantem nome simples sem prefixo nem ruido', () => {
      expect(extractCustomerNameCandidate('Maria Silva')).toBe(
        'Maria Silva',
      );
    });

    it('aceita string vazia', () => {
      expect(extractCustomerNameCandidate('')).toBe('');
    });
  });

  describe('extractPhoneDigitsCandidate', () => {
    it('remove tudo que nao for digito', () => {
      expect(extractPhoneDigitsCandidate('(11) 98765-4321')).toBe(
        '11987654321',
      );
      expect(extractPhoneDigitsCandidate('+55 11 98765-4321')).toBe(
        '5511987654321',
      );
    });

    it('aceita string vazia', () => {
      expect(extractPhoneDigitsCandidate('')).toBe('');
    });

    it('faz sanitize antes (descarta caracteres de controle)', () => {
      const noisy = `11${String.fromCharCode(0)}987654321`;
      expect(extractPhoneDigitsCandidate(noisy)).toBe('11987654321');
    });
  });

  describe('looksLikeStandalonePhoneMessage', () => {
    it('true para celular BR como digitos puros (10-11 chars)', () => {
      // O regex ^\+?\d[\d\s().-]{8,}$ exige inicio com digito/+digito.
      // Parenteses iniciais ("(11)") nao passam - so digitos.
      expect(
        looksLikeStandalonePhoneMessage('11987654321', testNormalizer),
      ).toBe(true);
      expect(
        looksLikeStandalonePhoneMessage('1198765432', testNormalizer),
      ).toBe(true);
    });

    it('false para formato com parenteses iniciais (regex requer inicio com digito)', () => {
      expect(
        looksLikeStandalonePhoneMessage('(11) 98765-4321', testNormalizer),
      ).toBe(false);
    });

    it('false para mais de 11 digitos mesmo com prefixo "+"', () => {
      // 13 digitos no total - fora da janela 10-11.
      expect(
        looksLikeStandalonePhoneMessage('+55 11 98765-4321', testNormalizer),
      ).toBe(false);
    });

    it('true quando comeca com palavra-chave de telefone', () => {
      expect(
        looksLikeStandalonePhoneMessage(
          'meu telefone 11987654321',
          testNormalizer,
        ),
      ).toBe(true);
      expect(
        looksLikeStandalonePhoneMessage('zap 11987654321', testNormalizer),
      ).toBe(true);
    });

    it('false para texto com palavra de endereco', () => {
      expect(
        looksLikeStandalonePhoneMessage('Rua 123, 456', testNormalizer),
      ).toBe(false);
    });

    it('false quando ha CEP no texto', () => {
      expect(
        looksLikeStandalonePhoneMessage(
          '01000-000 e 11987654321',
          testNormalizer,
        ),
      ).toBe(false);
    });

    it('false para poucos digitos (< 10)', () => {
      expect(
        looksLikeStandalonePhoneMessage('123456', testNormalizer),
      ).toBe(false);
    });

    it('false para muitos digitos (> 11) sem palavra-chave', () => {
      expect(
        looksLikeStandalonePhoneMessage(
          '551198765432100',
          testNormalizer,
        ),
      ).toBe(false);
    });

    it('false para string vazia', () => {
      expect(looksLikeStandalonePhoneMessage('', testNormalizer)).toBe(false);
    });
  });
});
