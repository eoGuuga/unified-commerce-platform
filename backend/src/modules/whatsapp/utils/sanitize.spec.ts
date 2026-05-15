import { repairPotentialMojibake, sanitizeInput } from './sanitize';

describe('sanitize utils', () => {
  describe('sanitizeInput', () => {
    it('retorna string vazia para entradas falsy', () => {
      expect(sanitizeInput('')).toBe('');
      // chamada com null/undefined viola contrato mas o codigo defensivamente
      // retorna ''. Casting para forcar para o teste.
      expect(sanitizeInput(null as unknown as string)).toBe('');
      expect(sanitizeInput(undefined as unknown as string)).toBe('');
    });

    it('remove tag <script>...</script>', () => {
      expect(
        sanitizeInput('Olá <script>alert(1)</script> mundo'),
      ).toBe('Olá mundo');
    });

    it('remove tags HTML genericas', () => {
      expect(sanitizeInput('<b>negrito</b>')).toBe('negrito');
      expect(sanitizeInput('linha<br/>quebra')).toBe('linhaquebra');
    });

    it('remove "javascript:" URI', () => {
      expect(sanitizeInput('clique javascript:alert(1)')).toBe(
        'clique alert(1)',
      );
    });

    it('remove atributos on* = (XSS handler)', () => {
      expect(sanitizeInput('img onerror=alert(1)')).toBe('img alert(1)');
    });

    it('descarta caracteres de controle ASCII', () => {
      const noisy = `hello${String.fromCharCode(0)}${String.fromCharCode(31)}${String.fromCharCode(127)}world`;
      expect(sanitizeInput(noisy)).toBe('hello world');
    });

    it('remove aspas simples e duplas', () => {
      expect(sanitizeInput('he said "hi" then \'ok\'')).toBe(
        'he said hi then ok',
      );
    });

    it('limita ao maxLength informado', () => {
      const longInput = 'a'.repeat(2000);
      expect(sanitizeInput(longInput, 50)).toHaveLength(50);
    });

    it('colapsa whitespace e faz trim', () => {
      expect(sanitizeInput('   muito    espaco   aqui   ')).toBe(
        'muito espaco aqui',
      );
    });
  });

  describe('repairPotentialMojibake', () => {
    it('retorna string vazia se entrada eh vazia', () => {
      expect(repairPotentialMojibake('')).toBe('');
    });

    it('retorna entrada inalterada se nao tiver indicadores de mojibake', () => {
      expect(repairPotentialMojibake('texto normal sem ruido')).toBe(
        'texto normal sem ruido',
      );
      expect(repairPotentialMojibake('açai com mãos')).toBe(
        'açai com mãos',
      );
    });

    it('reduz sequencias mojibake conhecidas (latin1 lido como utf8)', () => {
      // 'cafÃƒÂ©' eh 'café' codificado duplo. A funcao reverte para 'café'
      // pelo loop latin1->utf8 (a substring intacta 'caf' deve estar limpa).
      const result = repairPotentialMojibake('cafÃƒÂ©');
      expect(result).toContain('caf');
      expect(result).not.toContain('ÃƒÂ');
    });

    it('nao trava para input com ruido nao mapeado', () => {
      // Mesmo se ningum fix bater, a funcao deve terminar sem throw.
      const noisy = 'lixo Ãƒ Â Â aleatorio Â';
      expect(() => repairPotentialMojibake(noisy)).not.toThrow();
    });
  });
});
