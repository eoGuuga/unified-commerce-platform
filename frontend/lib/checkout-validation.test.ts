import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  isValidCpf,
  isValidCnpj,
  isValidCpfCnpj,
  isValidBrPhone,
  validateCheckoutContact,
} from './checkout-validation';

describe('isValidEmail', () => {
  it.each(['voce@empresa.com', 'a.b-c@sub.dominio.com.br', 'x@y.io'])(
    'aceita e-mail válido: %s',
    (email) => expect(isValidEmail(email)).toBe(true),
  );

  it.each(['semarroba.com', 'a@b', 'a@b.c', '@dominio.com', 'a b@c.com', ''])(
    'rejeita e-mail inválido: %s',
    (email) => expect(isValidEmail(email)).toBe(false),
  );
});

describe('isValidCpf', () => {
  it('aceita CPF válido (com e sem máscara)', () => {
    expect(isValidCpf('111.444.777-35')).toBe(true);
    expect(isValidCpf('11144477735')).toBe(true);
    expect(isValidCpf('529.982.247-25')).toBe(true);
  });

  it('rejeita CPF com dígito verificador errado', () => {
    expect(isValidCpf('111.444.777-00')).toBe(false);
    expect(isValidCpf('11144477736')).toBe(false);
  });

  it('rejeita sequências repetidas e tamanho errado', () => {
    expect(isValidCpf('00000000000')).toBe(false);
    expect(isValidCpf('111')).toBe(false);
    expect(isValidCpf('1114447773')).toBe(false); // 10 dígitos
  });

  it('rejeita CPF com letras', () => {
    expect(isValidCpf('111.444.777-3X')).toBe(false);
    expect(isValidCpf('abcdefghijk')).toBe(false);
  });
});

describe('isValidCnpj', () => {
  it('aceita CNPJ válido (com e sem máscara)', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  it('rejeita CNPJ com dígito verificador errado ou repetido', () => {
    expect(isValidCnpj('11.222.333/0001-00')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
  });
});

describe('isValidCpfCnpj', () => {
  it('aceita CPF (11) ou CNPJ (14) válidos', () => {
    expect(isValidCpfCnpj('111.444.777-35')).toBe(true);
    expect(isValidCpfCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('rejeita tamanho intermediário / letras', () => {
    expect(isValidCpfCnpj('123456789012')).toBe(false); // 12 dígitos
    expect(isValidCpfCnpj('111.444.777-3A')).toBe(false);
  });
});

describe('isValidBrPhone', () => {
  it.each(['(11) 99999-9999', '11999999999', '(21) 3333-4444', '2133334444'])(
    'aceita telefone BR válido: %s',
    (tel) => expect(isValidBrPhone(tel)).toBe(true),
  );

  it.each(['999999999', '(11) 89999-9999', '00 99999-9999', 'abcdefghij', ''])(
    'rejeita telefone inválido: %s',
    (tel) => expect(isValidBrPhone(tel)).toBe(false),
  );
});

describe('validateCheckoutContact', () => {
  const valido = {
    nome: 'Ana da Silva',
    email: 'ana@empresa.com',
    cpfCnpj: '111.444.777-35',
    telefone: '(11) 99999-9999',
  };

  it('não retorna erros quando tudo é válido', () => {
    expect(validateCheckoutContact(valido)).toEqual({});
  });

  it('bloqueia e-mail sem @', () => {
    const erros = validateCheckoutContact({ ...valido, email: 'anaempresa.com' });
    expect(erros.email).toBeTruthy();
    expect(erros.email).toMatch(/inválido/i);
  });

  it('bloqueia CPF com letra', () => {
    const erros = validateCheckoutContact({ ...valido, cpfCnpj: '111.444.777-3X' });
    expect(erros.cpfCnpj).toBeTruthy();
  });

  it('bloqueia telefone incompleto', () => {
    const erros = validateCheckoutContact({ ...valido, telefone: '9999' });
    expect(erros.telefone).toBeTruthy();
  });

  it('aponta campos obrigatórios vazios', () => {
    const erros = validateCheckoutContact({
      nome: '',
      email: '',
      cpfCnpj: '',
      telefone: '',
    });
    expect(Object.keys(erros).sort()).toEqual(
      ['cpfCnpj', 'email', 'nome', 'telefone'].sort(),
    );
  });
});
