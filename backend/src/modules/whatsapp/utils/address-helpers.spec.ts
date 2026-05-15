import {
  containsStateReference,
  extractStateCodeFromText,
  getAddressEvidence,
  hasAddressKeyword,
  normalizeAddressCandidate,
} from './address-helpers';

/**
 * Normalizer minimo para testes: lowercase + remover acentos basicos +
 * colapsar espacos. Eh proximo do que messageIntelligenceService.normalizeText
 * faz sem precisar da dependencia real.
 */
const testNormalizer = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('address-helpers utils', () => {
  describe('normalizeAddressCandidate', () => {
    it('remove prefixos comuns', () => {
      expect(normalizeAddressCandidate('meu endereco e Rua A, 123')).toBe(
        'Rua A, 123',
      );
      expect(normalizeAddressCandidate('entrega na Rua B, 200')).toBe(
        'Rua B, 200',
      );
    });

    it('normaliza "n 100" para "100"', () => {
      expect(normalizeAddressCandidate('Rua X, n 100, Bairro Y')).toContain(
        '100',
      );
      expect(
        normalizeAddressCandidate('Rua X, n 100, Bairro Y'),
      ).not.toContain(' n ');
    });

    it('remove "CEP" mantendo o numero do CEP', () => {
      expect(
        normalizeAddressCandidate('Rua X, CEP 01000-000'),
      ).toContain('01000-000');
    });

    it('remove despedidas no final', () => {
      expect(
        normalizeAddressCandidate('Rua X, 123, Bairro, ok'),
      ).not.toContain('ok');
      expect(
        normalizeAddressCandidate('Rua X, 123, obrigada'),
      ).not.toContain('obrigada');
    });

    it('colapsa whitespace', () => {
      expect(normalizeAddressCandidate('Rua   X,    123')).toBe('Rua X, 123');
    });

    it('aceita entrada vazia', () => {
      expect(normalizeAddressCandidate('')).toBe('');
    });
  });

  describe('hasAddressKeyword', () => {
    it('detecta palavras-chave de endereco', () => {
      expect(hasAddressKeyword('Rua das Flores', testNormalizer)).toBe(true);
      expect(hasAddressKeyword('Avenida Brasil', testNormalizer)).toBe(true);
      expect(hasAddressKeyword('Apto 101', testNormalizer)).toBe(true);
      expect(hasAddressKeyword('bairro Centro', testNormalizer)).toBe(true);
    });

    it('false para texto sem palavras de endereco', () => {
      expect(hasAddressKeyword('quero brigadeiro', testNormalizer)).toBe(
        false,
      );
      expect(hasAddressKeyword('Maria', testNormalizer)).toBe(false);
    });
  });

  describe('extractStateCodeFromText', () => {
    it('reconhece codigo de UF em maiusculas', () => {
      expect(extractStateCodeFromText('Sao Paulo, SP', testNormalizer)).toBe(
        'SP',
      );
      expect(extractStateCodeFromText('Rio - RJ', testNormalizer)).toBe('RJ');
    });

    it('reconhece nome de estado por extenso', () => {
      expect(extractStateCodeFromText('sao paulo', testNormalizer)).toBe(
        'SP',
      );
      expect(extractStateCodeFromText('rio de janeiro', testNormalizer)).toBe(
        'RJ',
      );
      expect(extractStateCodeFromText('mato grosso do sul', testNormalizer)).toBe(
        'MS',
      );
    });

    it('retorna vazio para texto sem UF', () => {
      expect(extractStateCodeFromText('apenas texto comum', testNormalizer)).toBe(
        '',
      );
      expect(extractStateCodeFromText('', testNormalizer)).toBe('');
    });

    it('nao confunde substring (ex: "MGM" nao eh MG)', () => {
      expect(
        extractStateCodeFromText('produto MGM premium', testNormalizer),
      ).toBe('');
    });
  });

  describe('containsStateReference', () => {
    it('true quando ha UF', () => {
      expect(containsStateReference('Belo Horizonte, MG', testNormalizer)).toBe(
        true,
      );
    });

    it('false sem UF', () => {
      expect(containsStateReference('Rua das Flores, 123', testNormalizer)).toBe(
        false,
      );
    });
  });

  describe('getAddressEvidence', () => {
    it('endereco completo com CEP score > 5', () => {
      const evidence = getAddressEvidence(
        'Rua das Flores, 123, Bairro Centro, Sao Paulo, SP, 01000-000',
        testNormalizer,
      );
      expect(evidence.score).toBeGreaterThan(5);
      expect(evidence.hasStreetLike).toBe(true);
      expect(evidence.hasNumber).toBe(true);
      expect(evidence.hasZip).toBe(true);
      expect(evidence.hasState).toBe(true);
    });

    it('endereco simples (rua + numero, sem CEP/UF) tem score modesto', () => {
      const evidence = getAddressEvidence('Rua A, 123', testNormalizer);
      expect(evidence.hasStreetLike).toBe(true);
      expect(evidence.hasNumber).toBe(true);
      expect(evidence.hasZip).toBe(false);
      expect(evidence.hasState).toBe(false);
      expect(evidence.score).toBeGreaterThanOrEqual(2);
      expect(evidence.score).toBeLessThan(6);
    });

    it('texto sem dados de endereco -> score baixo', () => {
      const evidence = getAddressEvidence('quero brigadeiro', testNormalizer);
      expect(evidence.score).toBe(0);
      expect(evidence.hasStreetLike).toBe(false);
      expect(evidence.hasNumber).toBe(false);
    });
  });
});
