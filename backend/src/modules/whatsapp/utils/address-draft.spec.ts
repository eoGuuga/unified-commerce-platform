import {
  buildAddressDraftText,
  getAddressDraftParts,
  isAddressDraftWorthy,
  isNumericOnlyAddressFragment,
  mergeAddressDraftParts,
} from './address-draft';

const testNormalizer = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('address-draft utils', () => {
  describe('getAddressDraftParts', () => {
    it('retorna array sanitizado de strings', () => {
      expect(getAddressDraftParts(['  Rua A  ', 'Centro', ''])).toEqual([
        'Rua A',
        'Centro',
      ]);
    });

    it('descarta nao-strings', () => {
      expect(
        getAddressDraftParts(['Rua A', 123 as unknown as string, null, 'Centro']),
      ).toEqual(['Rua A', 'Centro']);
    });

    it('retorna [] para entrada nao-array', () => {
      expect(getAddressDraftParts(undefined)).toEqual([]);
      expect(getAddressDraftParts(null)).toEqual([]);
      expect(getAddressDraftParts('string')).toEqual([]);
      expect(getAddressDraftParts({} as unknown)).toEqual([]);
    });
  });

  describe('buildAddressDraftText', () => {
    it('junta partes com virgula', () => {
      expect(buildAddressDraftText(['Rua A', '123', 'Centro'])).toBe(
        'Rua A, 123, Centro',
      );
    });

    it('descarta partes vazias e faz trim', () => {
      expect(
        buildAddressDraftText(['  Rua A  ', '', '   ', 'Centro']),
      ).toBe('Rua A, Centro');
    });

    it('descarta parte vazia entre duas validas e produz separacao limpa', () => {
      // Parts ja sem virgula no final (caso comum). join('','') -> "A, , C".
      // Apos cleanup das regexes, deve virar "A, C".
      expect(buildAddressDraftText(['Rua A', '', 'Centro'])).toBe(
        'Rua A, Centro',
      );
    });
  });

  describe('mergeAddressDraftParts', () => {
    it('inicia draft vazio com nextPart sanitizado', () => {
      const result = mergeAddressDraftParts([], 'Rua A, 123', testNormalizer);
      expect(result).toContain('Rua A, 123');
    });

    it('substitui draft fragmentado por endereco completo novo', () => {
      const parts = ['123', '01000-000']; // fragmentos soltos
      const result = mergeAddressDraftParts(
        parts,
        'Rua das Flores, 456, Centro, SP',
        testNormalizer,
      );
      // O endereco "fresh" eh completo (>=12 chars + tem keyword + tem digito)
      expect(result.length).toBe(1);
      expect(result[0]).toContain('Rua das Flores');
    });

    it('preserva parte mais longa quando ja existe similar', () => {
      const parts = ['Rua A'];
      const result = mergeAddressDraftParts(
        parts,
        'Rua A, 100',
        testNormalizer,
      );
      // "Rua A, 100" sera mantido pois eh mais longo apos normalize
      expect(result.some((p) => p.includes('100'))).toBe(true);
    });

    it('append quando nao ha overlap', () => {
      const result = mergeAddressDraftParts(
        ['Rua A'],
        'Centro',
        testNormalizer,
      );
      expect(result).toEqual(['Rua A', 'Centro']);
    });

    it('limita a 5 partes (mantem ultimas 4 + nova)', () => {
      const parts = ['A', 'B', 'C', 'D', 'E'];
      const result = mergeAddressDraftParts(parts, 'F', testNormalizer);
      expect(result.length).toBeLessThanOrEqual(5);
      expect(result[result.length - 1]).toBe('F');
    });

    it('ignora nextPart vazio/whitespace', () => {
      const result = mergeAddressDraftParts(
        ['Rua A'],
        '   ',
        testNormalizer,
      );
      expect(result).toEqual(['Rua A']);
    });
  });

  describe('isAddressDraftWorthy', () => {
    it('aceita texto com keyword de endereco', () => {
      expect(isAddressDraftWorthy('Rua das Flores', testNormalizer)).toBe(
        true,
      );
    });

    it('aceita numero curto solto (1-6 digitos)', () => {
      expect(isAddressDraftWorthy('123', testNormalizer)).toBe(true);
      expect(isAddressDraftWorthy('1', testNormalizer)).toBe(true);
    });

    it('aceita CEP formatado', () => {
      expect(isAddressDraftWorthy('01000-000', testNormalizer)).toBe(true);
    });

    it('rejeita "0" sozinho', () => {
      expect(isAddressDraftWorthy('0', testNormalizer)).toBe(false);
    });

    it('rejeita texto generico sem sinais de endereco', () => {
      expect(isAddressDraftWorthy('quero brigadeiro', testNormalizer)).toBe(
        false,
      );
    });

    it('rejeita string vazia', () => {
      expect(isAddressDraftWorthy('', testNormalizer)).toBe(false);
    });
  });

  describe('isNumericOnlyAddressFragment', () => {
    it('true para apenas digitos curtos', () => {
      expect(isNumericOnlyAddressFragment('123', testNormalizer)).toBe(true);
      expect(isNumericOnlyAddressFragment('45A', testNormalizer)).toBe(true);
    });

    it('false quando ha keyword de endereco', () => {
      expect(
        isNumericOnlyAddressFragment('Rua 123', testNormalizer),
      ).toBe(false);
    });

    it('false para texto com palavras', () => {
      expect(
        isNumericOnlyAddressFragment('Centro', testNormalizer),
      ).toBe(false);
    });
  });
});
