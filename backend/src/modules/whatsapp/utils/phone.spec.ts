import {
  matchesConfiguredPhoneNumber,
  normalizePhoneForControl,
  parsePhoneList,
} from './phone';

describe('phone utils', () => {
  describe('normalizePhoneForControl', () => {
    it('remove caracteres nao-digitos', () => {
      expect(normalizePhoneForControl('+55 (11) 98765-4321')).toBe(
        '5511987654321',
      );
    });

    it('aceita null/undefined retornando string vazia', () => {
      expect(normalizePhoneForControl(null)).toBe('');
      expect(normalizePhoneForControl(undefined)).toBe('');
      expect(normalizePhoneForControl('')).toBe('');
    });

    it('preserva digitos consecutivos', () => {
      expect(normalizePhoneForControl('11987654321')).toBe('11987654321');
    });
  });

  describe('parsePhoneList', () => {
    it('aceita array de strings, normaliza e deduplica', () => {
      expect(
        parsePhoneList(['(11) 98765-4321', '+5511987654321', '11999999999']),
      ).toEqual(['11987654321', '5511987654321', '11999999999']);
    });

    it('aceita string com separadores variados (virgula, espaco, ponto-virgula)', () => {
      expect(
        parsePhoneList('11987654321, +5511999998888 ; 11888887777'),
      ).toEqual(['11987654321', '5511999998888', '11888887777']);
    });

    it('descarta vazios e retorna lista vazia para entrada vazia', () => {
      expect(parsePhoneList(undefined)).toEqual([]);
      expect(parsePhoneList(null)).toEqual([]);
      expect(parsePhoneList('')).toEqual([]);
      expect(parsePhoneList('   ')).toEqual([]);
    });

    it('deduplica numeros iguais apos normalizacao', () => {
      // mesma string com prefixo "+" e ponto - normalizadas viram identicas.
      expect(parsePhoneList('11987654321, +11.987.654.321')).toEqual([
        '11987654321',
      ]);
    });
  });

  describe('matchesConfiguredPhoneNumber', () => {
    it('match exato apos normalizacao', () => {
      expect(
        matchesConfiguredPhoneNumber('+5511987654321', '5511987654321'),
      ).toBe(true);
    });

    it('match pelos ultimos 11 digitos (com ou sem prefixo 55)', () => {
      expect(
        matchesConfiguredPhoneNumber('+5511987654321', '11987654321'),
      ).toBe(true);
      expect(
        matchesConfiguredPhoneNumber('(11) 98765-4321', '5511987654321'),
      ).toBe(true);
    });

    it('false quando ultimos 11 digitos diferem', () => {
      expect(
        matchesConfiguredPhoneNumber('5511987654321', '5511988888888'),
      ).toBe(false);
    });

    it('false quando algum dos lados eh vazio', () => {
      expect(matchesConfiguredPhoneNumber('', '5511987654321')).toBe(false);
      expect(matchesConfiguredPhoneNumber('5511987654321', '')).toBe(false);
    });

    it('false se algum dos lados tem menos de 11 digitos e nao bate exato', () => {
      // 10 digitos vs 13 digitos - nao tem 11 nas pontas dos dois lados.
      expect(matchesConfiguredPhoneNumber('1187654321', '5511987654321')).toBe(
        false,
      );
    });
  });
});
