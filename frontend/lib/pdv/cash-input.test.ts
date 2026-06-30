/**
 * Testes do campo de moeda BR do caixa (centavos da direita pra esquerda).
 *
 * Cobre as 2 funcoes puras + o cenario de troco real (regressao do bug em que
 * "123312" era lido como R$ 123.312,00 em vez de R$ 1.233,12).
 */

import { describe, it, expect } from 'vitest';
import { cashDigitsToReais, formatCashInput } from './cash-input';
import { calcChange } from '@/lib/pdv/cart';

describe('cashDigitsToReais', () => {
  it('preenche os centavos da direita pra esquerda', () => {
    expect(cashDigitsToReais('123312')).toBe(1233.12);
    expect(cashDigitsToReais('50000')).toBe(500);
    expect(cashDigitsToReais('500')).toBe(5);
    expect(cashDigitsToReais('5')).toBe(0.05);
  });

  it('vazio / so zeros -> 0', () => {
    expect(cashDigitsToReais('')).toBe(0);
    expect(cashDigitsToReais('00')).toBe(0);
  });

  it('ignora caracteres nao-digitos (pontos/virgulas do proprio mask)', () => {
    expect(cashDigitsToReais('1.233,12')).toBe(1233.12);
  });
});

describe('formatCashInput', () => {
  it('formata os digitos como moeda BR (sem R$)', () => {
    expect(formatCashInput('123312')).toBe('1.233,12');
    expect(formatCashInput('50000')).toBe('500,00');
    expect(formatCashInput('5')).toBe('0,05');
  });

  it('vazio -> string vazia', () => {
    expect(formatCashInput('')).toBe('');
  });
});

describe('troco com o input cents-aware (regressao do bug)', () => {
  it('R$ 500,00 recebido sobre total R$ 460,30 -> troco R$ 39,70', () => {
    expect(calcChange(460.3, cashDigitsToReais('50000'))).toBe(39.7);
  });

  it('"123312" = R$ 1.233,12 -> troco R$ 772,82 (nao R$ 122.851,70)', () => {
    expect(calcChange(460.3, cashDigitsToReais('123312'))).toBe(772.82);
  });
});
