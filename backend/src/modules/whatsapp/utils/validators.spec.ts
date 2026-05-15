import {
  validateAddressBasic,
  validateName,
  validatePhone,
  validatePrice,
} from './validators';

describe('validators', () => {
  describe('validateName', () => {
    it('aceita nome simples', () => {
      expect(validateName('Maria Silva')).toEqual({ valid: true });
    });

    it('aceita nome com acentos, hifen e apostrofo', () => {
      expect(validateName("João D'Avila").valid).toBe(true);
      expect(validateName('Anne-Marie').valid).toBe(true);
    });

    it('rejeita nome muito curto', () => {
      const result = validateName('Jo');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('minimo');
    });

    it('rejeita nome com caracteres especiais', () => {
      expect(validateName('user@x.com').valid).toBe(false);
      expect(validateName('Maria123').valid).toBe(false);
    });

    it('rejeita palavras reservadas (comandos do bot)', () => {
      for (const word of ['pix', 'menu', 'pedido', 'cardapio']) {
        const result = validateName(word);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/comando|invalidos/i);
      }
    });

    it('rejeita nome com keyword de pedido embarcada', () => {
      expect(validateName('Maria do pix').valid).toBe(false);
      expect(validateName('rua das flores').valid).toBe(false);
    });

    it('rejeita nome com keyword de produto', () => {
      expect(validateName('brigadeiro premium').valid).toBe(false);
      expect(validateName('Bolo de chocolate').valid).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('aceita celular com 11 digitos e 9 apos DDD', () => {
      expect(validatePhone('11987654321')).toEqual({ valid: true });
    });

    it('aceita fixo com 10 digitos', () => {
      expect(validatePhone('1133334444')).toEqual({ valid: true });
    });

    it('aceita formato (xx) xxxxx-xxxx', () => {
      expect(validatePhone('(11) 98765-4321').valid).toBe(true);
    });

    it('rejeita menos de 10 digitos', () => {
      expect(validatePhone('1198765432').valid).toBe(true);
      expect(validatePhone('119876543').valid).toBe(false);
    });

    it('rejeita mais de 11 digitos', () => {
      expect(validatePhone('551198765432').valid).toBe(false);
    });

    it('rejeita DDD invalido (comeca com 0)', () => {
      expect(validatePhone('0198765432').valid).toBe(false);
    });

    it('rejeita celular 11 digitos sem 9 apos DDD', () => {
      // DDD=11, depois 8xxxxxxxx (sem 9 inicial em mobile)
      const result = validatePhone('11887654321');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('9');
    });
  });

  describe('validatePrice', () => {
    it('aceita preco positivo razoavel', () => {
      expect(validatePrice(99.9)).toEqual({ valid: true });
      expect(validatePrice(1)).toEqual({ valid: true });
    });

    it('rejeita zero e negativos', () => {
      expect(validatePrice(0).valid).toBe(false);
      expect(validatePrice(-5).valid).toBe(false);
    });

    it('rejeita NaN', () => {
      expect(validatePrice(NaN).valid).toBe(false);
    });

    it('rejeita preco acima do limite (1.000.000)', () => {
      expect(validatePrice(1_000_001).valid).toBe(false);
    });

    it('aceita exatamente o limite', () => {
      expect(validatePrice(1_000_000).valid).toBe(true);
    });
  });

  describe('validateAddressBasic', () => {
    it('aceita endereco com tamanho minimo', () => {
      expect(validateAddressBasic('Rua A, 123, Centro').valid).toBe(true);
    });

    it('rejeita endereco curto', () => {
      expect(validateAddressBasic('Rua A').valid).toBe(false);
    });

    it('rejeita endereco gigante (> MAX)', () => {
      expect(validateAddressBasic('x'.repeat(600)).valid).toBe(false);
    });
  });
});
