import { describe, expect, it } from 'vitest';
import { formatCurrency, parseCurrencyInput } from './format';

describe('formatCurrency', () => {
  it('formata numero inteiro em moeda BRL', () => {
    // Intl.NumberFormat usa nbsp (U+00A0) entre simbolo e valor.
    expect(formatCurrency(10)).toMatch(/^R\$\s10,00$/);
  });

  it('formata valor com decimais com virgula', () => {
    expect(formatCurrency(1234.56)).toMatch(/^R\$\s1\.234,56$/);
  });

  it('formata zero', () => {
    expect(formatCurrency(0)).toMatch(/^R\$\s0,00$/);
  });

  it('formata valor negativo', () => {
    expect(formatCurrency(-5.5)).toMatch(/^-R\$\s5,50$/);
  });
});

describe('parseCurrencyInput', () => {
  it('parseia formato brasileiro com ponto de milhar e virgula decimal', () => {
    expect(parseCurrencyInput('1.234,56')).toBe(1234.56);
  });

  it('parseia valor simples com virgula', () => {
    expect(parseCurrencyInput('99,90')).toBe(99.9);
  });

  it('parseia numero inteiro sem decimais', () => {
    expect(parseCurrencyInput('100')).toBe(100);
  });

  it('aceita espacos ao redor', () => {
    expect(parseCurrencyInput('  10,50  ')).toBe(10.5);
  });

  it('retorna NaN para entradas nao-numericas', () => {
    expect(parseCurrencyInput('abc')).toBeNaN();
    expect(parseCurrencyInput('R$ algo')).toBeNaN();
  });

  // Comportamento herdado (Number('') === 0). Mantido para nao mudar
  // semantica durante o refactor; vale revisitar se causar bug em UX.
  it('retorna 0 para string vazia (quirk: Number("") === 0)', () => {
    expect(parseCurrencyInput('')).toBe(0);
    expect(parseCurrencyInput('   ')).toBe(0);
  });
});
