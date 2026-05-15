import { describe, expect, it } from 'vitest';
import {
  PRODUCT_PALETTES,
  getAvailableUnits,
  getProductPalette,
  getRelevanceScore,
  getStockTone,
} from './product-utils';

describe('getAvailableUnits', () => {
  it('prefere available_stock quando presente', () => {
    expect(getAvailableUnits({ stock: 10, available_stock: 4 })).toBe(4);
  });

  it('cai para stock quando available_stock ausente', () => {
    expect(getAvailableUnits({ stock: 7 })).toBe(7);
  });

  it('nunca retorna numero negativo', () => {
    expect(getAvailableUnits({ stock: -3, available_stock: -1 })).toBe(0);
  });

  it('retorna 0 quando nenhum dos dois esta definido', () => {
    expect(getAvailableUnits({})).toBe(0);
  });
});

describe('getProductPalette', () => {
  it('retorna palette por indice', () => {
    expect(getProductPalette(0)).toEqual(PRODUCT_PALETTES[0]);
    expect(getProductPalette(1)).toEqual(PRODUCT_PALETTES[1]);
  });

  it('faz wrap modular para indices grandes', () => {
    expect(getProductPalette(PRODUCT_PALETTES.length)).toEqual(
      PRODUCT_PALETTES[0],
    );
    expect(getProductPalette(PRODUCT_PALETTES.length + 2)).toEqual(
      PRODUCT_PALETTES[2],
    );
  });
});

describe('getRelevanceScore', () => {
  const product = {
    name: 'Brigadeiro tradicional',
    description: 'Doce artesanal com chocolate belga',
  };

  it('retorna 3 quando nome comeca com a query', () => {
    expect(getRelevanceScore(product, 'briga')).toBe(3);
    expect(getRelevanceScore(product, 'Brigadeiro')).toBe(3);
  });

  it('retorna 2 quando nome contem a query mas nao no inicio', () => {
    expect(getRelevanceScore(product, 'tradicional')).toBe(2);
  });

  it('retorna 1 quando so a descricao contem a query', () => {
    expect(getRelevanceScore(product, 'belga')).toBe(1);
  });

  it('retorna 0 quando nao ha match', () => {
    expect(getRelevanceScore(product, 'carro')).toBe(0);
  });

  it('retorna 0 para query vazia ou so com espacos', () => {
    expect(getRelevanceScore(product, '')).toBe(0);
    expect(getRelevanceScore(product, '   ')).toBe(0);
  });

  it('e case-insensitive', () => {
    expect(getRelevanceScore(product, 'BRIGA')).toBe(3);
    expect(getRelevanceScore(product, 'TRADICIONAL')).toBe(2);
  });

  it('aceita produto sem descricao', () => {
    expect(getRelevanceScore({ name: 'Pao' }, 'pao')).toBe(3);
  });
});

describe('getStockTone', () => {
  it('sinaliza "Sem estoque" quando stock <= 0', () => {
    const tone = getStockTone(0);
    expect(tone.label).toBe('Sem estoque');
    expect(tone.className).toMatch(/rose/);

    const negative = getStockTone(-5);
    expect(negative.label).toBe('Sem estoque');
  });

  it('sinaliza "Ultimas unidades" quando stock <= 3', () => {
    const tone = getStockTone(2);
    expect(tone.label).toBe('Ultimas unidades');
    expect(tone.detail).toContain('2');
    expect(tone.className).toMatch(/amber/);
  });

  it('sinaliza "Ultimas unidades" quando stock <= min_stock (mesmo > 3)', () => {
    const tone = getStockTone(5, 6);
    expect(tone.label).toBe('Ultimas unidades');
    expect(tone.detail).toContain('5');
  });

  it('sinaliza "Pronta entrega" para estoque saudavel', () => {
    const tone = getStockTone(10);
    expect(tone.label).toBe('Pronta entrega');
    expect(tone.detail).toContain('10');
    expect(tone.className).toMatch(/emerald/);
  });

  it('respeita min_stock = 0 (default)', () => {
    const tone = getStockTone(4);
    expect(tone.label).toBe('Pronta entrega');
  });
});
