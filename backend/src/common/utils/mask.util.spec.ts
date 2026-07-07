import { maskPhone, maskEmail } from './mask.util';

describe('mask.util — mascaramento de PII para logs (LGPD)', () => {
  describe('maskPhone', () => {
    it('mascara o meio, mostrando 2 primeiros + 2 ultimos digitos', () => {
      expect(maskPhone('5511998887766')).toBe('55****66');
    });

    it('normaliza formatacao antes de mascarar', () => {
      expect(maskPhone('(11) 99888-7766')).toBe('11****66');
    });

    it('NAO revela o numero completo (nenhum bloco central aparece)', () => {
      const masked = maskPhone('5511998887766');
      expect(masked).not.toContain('9988877');
      expect(masked).not.toContain('11998887766');
    });

    it('numero curto (<6 digitos) -> totalmente mascarado', () => {
      expect(maskPhone('1234')).toBe('****');
    });

    it('vazio / nulo / indefinido -> placeholder, sem quebrar', () => {
      expect(maskPhone('')).toBe('(sem telefone)');
      expect(maskPhone(null)).toBe('(sem telefone)');
      expect(maskPhone(undefined)).toBe('(sem telefone)');
    });
  });

  describe('maskEmail', () => {
    it('mostra a 1a letra do local + o dominio', () => {
      expect(maskEmail('joao@gmail.com')).toBe('j***@gmail.com');
    });

    it('local de 1 char continua mascarado', () => {
      expect(maskEmail('a@x.com')).toBe('a***@x.com');
    });

    it('NAO revela o local completo do email', () => {
      const masked = maskEmail('joaosilva@empresa.com.br');
      expect(masked).not.toContain('joaosilva');
      expect(masked).toBe('j***@empresa.com.br');
    });

    it('sem "@" valido -> totalmente mascarado', () => {
      expect(maskEmail('naoehemail')).toBe('***');
      expect(maskEmail('@x.com')).toBe('***');
      expect(maskEmail('a@')).toBe('***');
    });

    it('vazio / nulo / indefinido -> placeholder, sem quebrar', () => {
      expect(maskEmail('')).toBe('(sem email)');
      expect(maskEmail(null)).toBe('(sem email)');
      expect(maskEmail(undefined)).toBe('(sem email)');
    });
  });
});
