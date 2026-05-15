import {
  ACTIVE_CONTEXT_STATUS_PHRASES,
  ORDER_KEYWORDS,
  ORDER_STATUS_QUERY_PHRASES,
  ORDER_STATUS_SIGNALS,
  REOPEN_INTENT_PHRASES,
} from './order-status-intents';

describe('order-status-intents constants', () => {
  describe('ORDER_STATUS_QUERY_PHRASES', () => {
    it('inclui pergunta direta e variantes pt-BR', () => {
      expect(ORDER_STATUS_QUERY_PHRASES).toContain('meu pedido');
      expect(ORDER_STATUS_QUERY_PHRASES).toContain('status do pedido');
      expect(ORDER_STATUS_QUERY_PHRASES).toContain('cade meu pedido');
      expect(ORDER_STATUS_QUERY_PHRASES).toContain('quando chega meu pedido');
      expect(ORDER_STATUS_QUERY_PHRASES).toContain('saiu para entrega');
    });
  });

  describe('ORDER_STATUS_SIGNALS', () => {
    it('cobre sinais soltos de "status"', () => {
      expect(ORDER_STATUS_SIGNALS).toContain('status');
      expect(ORDER_STATUS_SIGNALS).toContain('acompanhar');
      expect(ORDER_STATUS_SIGNALS).toContain('cade');
      expect(ORDER_STATUS_SIGNALS).toContain('quando chega');
    });
  });

  describe('ORDER_KEYWORDS', () => {
    it('contem pedido/encomenda/entrega', () => {
      expect(ORDER_KEYWORDS).toEqual(
        expect.arrayContaining(['pedido', 'encomenda', 'entrega']),
      );
    });
  });

  describe('ACTIVE_CONTEXT_STATUS_PHRASES', () => {
    it('inclui termos contextuais sem precisar dizer "pedido"', () => {
      expect(ACTIVE_CONTEXT_STATUS_PHRASES).toContain('motoboy');
      expect(ACTIVE_CONTEXT_STATUS_PHRASES).toContain('entregador');
      expect(ACTIVE_CONTEXT_STATUS_PHRASES).toContain('ficou pronto');
      expect(ACTIVE_CONTEXT_STATUS_PHRASES).toContain('ta pronto');
    });
  });

  describe('REOPEN_INTENT_PHRASES', () => {
    it('inclui variantes de "reabrir" e "retomar"', () => {
      expect(REOPEN_INTENT_PHRASES).toContain('reabrir pedid');
      expect(REOPEN_INTENT_PHRASES).toContain('continuar pedid');
      expect(REOPEN_INTENT_PHRASES).toContain('retomar pedid');
    });
  });

  describe('invariantes', () => {
    const lists = [
      ['ORDER_STATUS_QUERY_PHRASES', ORDER_STATUS_QUERY_PHRASES],
      ['ORDER_STATUS_SIGNALS', ORDER_STATUS_SIGNALS],
      ['ORDER_KEYWORDS', ORDER_KEYWORDS],
      ['ACTIVE_CONTEXT_STATUS_PHRASES', ACTIVE_CONTEXT_STATUS_PHRASES],
      ['REOPEN_INTENT_PHRASES', REOPEN_INTENT_PHRASES],
    ] as const;

    it.each(lists)('%s nao tem duplicatas nem entrada vazia', (_, list) => {
      const seen = new Set<string>();
      for (const item of list) {
        expect(item.trim().length).toBeGreaterThan(0);
        expect(seen.has(item)).toBe(false);
        seen.add(item);
      }
    });

    it('ACTIVE_CONTEXT_STATUS_PHRASES eh subset relevante de ORDER_STATUS_SIGNALS', () => {
      // Validacao de coerencia: muitos termos contextuais (cade, status,
      // etc) tambem aparecem nos signals genericos.
      const signals = new Set(ORDER_STATUS_SIGNALS);
      const overlap = ACTIVE_CONTEXT_STATUS_PHRASES.filter((p) => signals.has(p));
      expect(overlap.length).toBeGreaterThan(0);
    });
  });
});
