import {
  ADDRESS_COMPLEMENT_KEYWORDS,
  parseAddress,
  parseAddressCandidate,
  parseLooseAddress,
} from './address-parser';

const testNormalizer = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('address-parser utils', () => {
  describe('ADDRESS_COMPLEMENT_KEYWORDS', () => {
    it('inclui termos comuns de complemento', () => {
      expect(ADDRESS_COMPLEMENT_KEYWORDS.has('apto')).toBe(true);
      expect(ADDRESS_COMPLEMENT_KEYWORDS.has('bloco')).toBe(true);
      expect(ADDRESS_COMPLEMENT_KEYWORDS.has('sala')).toBe(true);
      expect(ADDRESS_COMPLEMENT_KEYWORDS.has('casa')).toBe(true);
    });
  });

  describe('parseAddress (com virgulas)', () => {
    it('parseia endereco completo com CEP, UF e bairro', () => {
      const result = parseAddress(
        'Rua das Flores 123, Centro, Sao Paulo, SP, 01000-000',
        testNormalizer,
      );
      expect(result).not.toBeNull();
      expect(result!.street).toContain('Rua');
      expect(result!.number).toBe('123');
      expect(result!.city.toLowerCase()).toContain('sao paulo');
      expect(result!.state).toBe('SP');
      expect(result!.zipCode).toBe('01000000');
    });

    it('aceita CEP sem hifen', () => {
      const result = parseAddress(
        'Rua A 100, Centro, Sao Paulo, SP, 01000000',
        testNormalizer,
      );
      expect(result!.zipCode).toBe('01000000');
    });

    it('separa numero do nome da rua', () => {
      const result = parseAddress(
        'Avenida Brasil 500, Jardim, Rio de Janeiro, RJ',
        testNormalizer,
      );
      expect(result!.number).toBe('500');
      expect(result!.street).toBe('Avenida Brasil');
    });

    it('retorna null para entrada com menos de 3 partes', () => {
      expect(parseAddress('Rua A, 123', testNormalizer)).toBeNull();
    });

    it('aceita estado fundido com cidade ("Sao Paulo SP")', () => {
      const result = parseAddress(
        'Rua X 1, Centro, Sao Paulo SP, 01000-000',
        testNormalizer,
      );
      expect(result).not.toBeNull();
      expect(result!.state).toBe('SP');
    });
  });

  describe('parseLooseAddress (sem virgulas)', () => {
    it('parseia endereco sem virgulas em uma linha', () => {
      const result = parseLooseAddress(
        'Rua das Flores 123 Centro Sao Paulo SP 01000-000',
        testNormalizer,
      );
      expect(result).not.toBeNull();
      expect(result!.number).toBe('123');
      expect(result!.state).toBe('SP');
      expect(result!.zipCode).toBe('01000000');
    });

    it('retorna null se a entrada ja tem virgula', () => {
      expect(
        parseLooseAddress('Rua A, 123, Centro', testNormalizer),
      ).toBeNull();
    });

    it('retorna null se for muito curto (< 4 tokens)', () => {
      expect(parseLooseAddress('Rua A 123', testNormalizer)).toBeNull();
    });

    it('parseia complement (apto 45)', () => {
      const result = parseLooseAddress(
        'Rua A 100 apto 45 Centro Sao Paulo SP',
        testNormalizer,
      );
      expect(result).not.toBeNull();
      expect(result!.complement).toContain('apto');
    });

    it('retorna null se nao encontrar numero', () => {
      expect(
        parseLooseAddress('Rua das Flores Centro Sao Paulo SP', testNormalizer),
      ).toBeNull();
    });
  });

  describe('parseAddressCandidate', () => {
    it('tenta parseAddress primeiro (caso com virgulas)', () => {
      const result = parseAddressCandidate(
        'Rua A 123, Centro, Sao Paulo, SP',
        testNormalizer,
      );
      expect(result).not.toBeNull();
      expect(result!.state).toBe('SP');
    });

    it('cai para parseLooseAddress quando nao tem virgula', () => {
      const result = parseAddressCandidate(
        'Rua A 123 Centro Sao Paulo SP',
        testNormalizer,
      );
      expect(result).not.toBeNull();
      expect(result!.number).toBe('123');
    });

    it('retorna null para entrada invalida', () => {
      expect(parseAddressCandidate('asdf', testNormalizer)).toBeNull();
    });
  });
});
