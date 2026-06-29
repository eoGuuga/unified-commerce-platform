/**
 * Testes da fonte única de status de estoque.
 *
 * Cobertura obrigatória (revisão T5a):
 *  1. stockStatus(undefined, undefined) === 'out'  — blindagem chave errada
 *  2. Bordas OK/Baixo/Esgotado
 *  3. isAttention(s)
 *  4. STATUS_META
 */

import { describe, it, expect } from 'vitest';
import { stockStatus, isAttention, STATUS_META } from './stock-status';
import type { StockStatus } from './stock-status';

describe('stockStatus — blindagem null/undefined', () => {
  it('stockStatus(undefined, undefined) === "out" — nunca cai em ok silencioso', () => {
    expect(stockStatus(undefined, undefined)).toBe('out');
  });

  it('stockStatus(null, null) === "out"', () => {
    expect(stockStatus(null, null)).toBe('out');
  });

  it('stockStatus(NaN, 10) === "out"', () => {
    expect(stockStatus(NaN, 10)).toBe('out');
  });

  it('stockStatus(5, null) === "ok" — min null trata como 0', () => {
    // 5 > 0 (esgotado) e 5 > 0 (mínimo) → ok
    expect(stockStatus(5, null)).toBe('ok');
  });

  it('stockStatus(5, undefined) === "ok" — min undefined trata como 0', () => {
    expect(stockStatus(5, undefined)).toBe('ok');
  });
});

describe('stockStatus — bordas de classificação', () => {
  it('available=0 → "out"', () => {
    expect(stockStatus(0, 10)).toBe('out');
  });

  it('available<0 não acontece mas negative → "out"', () => {
    expect(stockStatus(-1, 5)).toBe('out');
  });

  it('available=min → "low" (borda igual ao mínimo é atenção)', () => {
    expect(stockStatus(10, 10)).toBe('low');
  });

  it('available=min+1 → "ok"', () => {
    expect(stockStatus(11, 10)).toBe('ok');
  });

  it('available=1, min=0 → "ok" (min zero sem configuração)', () => {
    expect(stockStatus(1, 0)).toBe('ok');
  });

  it('available=1, min=1 → "low"', () => {
    expect(stockStatus(1, 1)).toBe('low');
  });

  it('available grande, min pequeno → "ok"', () => {
    expect(stockStatus(100, 5)).toBe('ok');
  });

  it('available pequeno, min grande → "low"', () => {
    expect(stockStatus(3, 10)).toBe('low');
  });
});

describe('isAttention', () => {
  it('"ok" não é atenção', () => {
    expect(isAttention('ok')).toBe(false);
  });

  it('"low" é atenção', () => {
    expect(isAttention('low')).toBe(true);
  });

  it('"out" é atenção', () => {
    expect(isAttention('out')).toBe(true);
  });
});

describe('STATUS_META', () => {
  const statuses: StockStatus[] = ['ok', 'low', 'out'];

  it('todos os status têm label e classes definidos', () => {
    for (const s of statuses) {
      expect(STATUS_META[s].label.length).toBeGreaterThan(0);
      expect(STATUS_META[s].classes.length).toBeGreaterThan(0);
    }
  });

  it('ok tem classes verde (emerald)', () => {
    expect(STATUS_META.ok.classes).toContain('emerald');
  });

  it('low tem classes âmbar (amber)', () => {
    expect(STATUS_META.low.classes).toContain('amber');
  });

  it('out tem classes vermelho (red)', () => {
    expect(STATUS_META.out.classes).toContain('red');
  });
});
