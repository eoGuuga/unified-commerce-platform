import {
  COLLECTION_SOFT_STOP_PHRASES,
  DISCOUNT_QUESTION_PHRASES,
} from './soft-stop-discount-intents';

describe('soft-stop-discount-intents constants', () => {
  describe('COLLECTION_SOFT_STOP_PHRASES', () => {
    it('inclui "nao quero mais", "desisti", "deixa pra la"', () => {
      expect(COLLECTION_SOFT_STOP_PHRASES).toContain('nao quero mais');
      expect(COLLECTION_SOFT_STOP_PHRASES).toContain('desisti');
      expect(COLLECTION_SOFT_STOP_PHRASES).toContain('deixa pra la');
    });

    it('inclui variantes com "para com isso"', () => {
      expect(COLLECTION_SOFT_STOP_PHRASES).toContain('para com isso');
      expect(COLLECTION_SOFT_STOP_PHRASES).toContain('pare com isso');
    });
  });

  describe('DISCOUNT_QUESTION_PHRASES', () => {
    it('inclui sinais comuns de pergunta de desconto/promo', () => {
      expect(DISCOUNT_QUESTION_PHRASES).toContain('tem desconto');
      expect(DISCOUNT_QUESTION_PHRASES).toContain('tem promocao');
      expect(DISCOUNT_QUESTION_PHRASES).toContain('faz melhor no preco');
    });
  });

  it('listas sem duplicatas nem entradas vazias', () => {
    for (const list of [
      COLLECTION_SOFT_STOP_PHRASES,
      DISCOUNT_QUESTION_PHRASES,
    ]) {
      const seen = new Set<string>();
      for (const item of list) {
        expect(item.trim().length).toBeGreaterThan(0);
        expect(seen.has(item)).toBe(false);
        seen.add(item);
      }
    }
  });
});
