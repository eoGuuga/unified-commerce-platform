import {
  CATALOG_CATEGORY_FOLLOWUP_PHRASES,
  CATALOG_PRODUCT_RECALL_PHRASES,
  CATALOG_SIMILAR_FOLLOWUP_PHRASES,
} from './catalog-intents';

describe('catalog-intents constants', () => {
  it('CATALOG_SIMILAR_FOLLOWUP_PHRASES tem termos esperados', () => {
    expect(CATALOG_SIMILAR_FOLLOWUP_PHRASES).toContain('parecido');
    expect(CATALOG_SIMILAR_FOLLOWUP_PHRASES).toContain('algo semelhante');
    expect(CATALOG_SIMILAR_FOLLOWUP_PHRASES).toContain('nesse estilo');
  });

  it('CATALOG_CATEGORY_FOLLOWUP_PHRASES tem termos esperados', () => {
    expect(CATALOG_CATEGORY_FOLLOWUP_PHRASES).toContain('volta pra categoria');
    expect(CATALOG_CATEGORY_FOLLOWUP_PHRASES).toContain('mais dessa categoria');
  });

  it('CATALOG_PRODUCT_RECALL_PHRASES tem termos esperados', () => {
    expect(CATALOG_PRODUCT_RECALL_PHRASES).toContain('abre esse item');
    expect(CATALOG_PRODUCT_RECALL_PHRASES).toContain('mostra esse item');
  });

  it('nenhuma colisao entre as 3 listas', () => {
    const similar = new Set(CATALOG_SIMILAR_FOLLOWUP_PHRASES);
    const category = new Set(CATALOG_CATEGORY_FOLLOWUP_PHRASES);
    const recall = new Set(CATALOG_PRODUCT_RECALL_PHRASES);

    for (const phrase of similar) {
      expect(category.has(phrase)).toBe(false);
      expect(recall.has(phrase)).toBe(false);
    }
    for (const phrase of category) {
      expect(recall.has(phrase)).toBe(false);
    }
  });

  it('nenhuma string vazia ou duplicada em cada lista', () => {
    for (const list of [
      CATALOG_SIMILAR_FOLLOWUP_PHRASES,
      CATALOG_CATEGORY_FOLLOWUP_PHRASES,
      CATALOG_PRODUCT_RECALL_PHRASES,
    ]) {
      const seen = new Set<string>();
      for (const phrase of list) {
        expect(phrase.trim().length).toBeGreaterThan(0);
        expect(seen.has(phrase)).toBe(false);
        seen.add(phrase);
      }
    }
  });
});
