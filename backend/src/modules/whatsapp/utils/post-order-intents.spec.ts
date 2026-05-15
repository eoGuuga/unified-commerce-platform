import {
  PAYMENT_PROOF_PHRASES,
  POST_ORDER_CHANGE_TARGETS,
  POST_ORDER_CHANGE_VERBS,
  POST_ORDER_COURTESY_PHRASES,
  POST_ORDER_EXPLICIT_CHANGE_PHRASES,
} from './post-order-intents';

describe('post-order-intents constants', () => {
  describe('PAYMENT_PROOF_PHRASES', () => {
    it('inclui sinais de pagamento conhecidos', () => {
      expect(PAYMENT_PROOF_PHRASES).toContain('paguei');
      expect(PAYMENT_PROOF_PHRASES).toContain('ja fiz o pix');
      expect(PAYMENT_PROOF_PHRASES).toContain('pix caiu');
      expect(PAYMENT_PROOF_PHRASES).toContain('mandei comprovante');
      expect(PAYMENT_PROOF_PHRASES).toContain('passei no cartao');
    });
  });

  describe('POST_ORDER_COURTESY_PHRASES', () => {
    it('inclui cortesias comuns', () => {
      expect(POST_ORDER_COURTESY_PHRASES).toContain('obrigado');
      expect(POST_ORDER_COURTESY_PHRASES).toContain('valeu');
      expect(POST_ORDER_COURTESY_PHRASES).toContain('blz');
    });
  });

  describe('POST_ORDER_EXPLICIT_CHANGE_PHRASES', () => {
    it('cobre mudanca de endereco/entrega/pagamento/itens', () => {
      expect(POST_ORDER_EXPLICIT_CHANGE_PHRASES).toContain('trocar endereco');
      expect(POST_ORDER_EXPLICIT_CHANGE_PHRASES).toContain('muda pra entrega');
      expect(POST_ORDER_EXPLICIT_CHANGE_PHRASES).toContain('trocar pagamento');
      expect(POST_ORDER_EXPLICIT_CHANGE_PHRASES).toContain('remover item');
    });
  });

  describe('POST_ORDER_CHANGE_VERBS', () => {
    it('cobre verbos basicos de modificacao', () => {
      expect(POST_ORDER_CHANGE_VERBS).toContain('mudar');
      expect(POST_ORDER_CHANGE_VERBS).toContain('trocar');
      expect(POST_ORDER_CHANGE_VERBS).toContain('alterar');
      expect(POST_ORDER_CHANGE_VERBS).toContain('remover');
    });
  });

  describe('POST_ORDER_CHANGE_TARGETS', () => {
    it('inclui alvos comuns (endereco, pagamento, item)', () => {
      expect(POST_ORDER_CHANGE_TARGETS).toContain('endereco');
      expect(POST_ORDER_CHANGE_TARGETS).toContain('pagamento');
      expect(POST_ORDER_CHANGE_TARGETS).toContain('item');
      expect(POST_ORDER_CHANGE_TARGETS).toContain('pix');
    });
  });

  describe('invariantes globais', () => {
    const lists = [
      ['PAYMENT_PROOF_PHRASES', PAYMENT_PROOF_PHRASES],
      ['POST_ORDER_COURTESY_PHRASES', POST_ORDER_COURTESY_PHRASES],
      ['POST_ORDER_EXPLICIT_CHANGE_PHRASES', POST_ORDER_EXPLICIT_CHANGE_PHRASES],
      ['POST_ORDER_CHANGE_VERBS', POST_ORDER_CHANGE_VERBS],
      ['POST_ORDER_CHANGE_TARGETS', POST_ORDER_CHANGE_TARGETS],
    ] as const;

    it.each(lists)('%s nao tem entrada vazia nem duplicada', (_, list) => {
      const seen = new Set<string>();
      for (const item of list) {
        expect(item.trim().length).toBeGreaterThan(0);
        expect(seen.has(item)).toBe(false);
        seen.add(item);
      }
    });

    it('payment proof e courtesy nao colidem (disjuntos)', () => {
      const proof = new Set(PAYMENT_PROOF_PHRASES);
      for (const phrase of POST_ORDER_COURTESY_PHRASES) {
        expect(proof.has(phrase)).toBe(false);
      }
    });
  });
});
