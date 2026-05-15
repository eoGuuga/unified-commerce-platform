import {
  NON_COMMERCIAL_ACTIVITY_RE,
  NON_COMMERCIAL_EMOTIONAL_PHRASES,
  OUT_OF_FLOW_STOP_GUARD_RE,
  OUT_OF_FLOW_STOP_PHRASES,
  isLikelyNonCommercialMessage,
  isOutOfFlowStopIntent,
} from './non-commercial-intents';

const testNormalizer = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const realHasAny = (normalized: string, phrases: string[]): boolean =>
  phrases.some((p) => normalized.includes(p));

describe('non-commercial-intents utils', () => {
  describe('constants', () => {
    it('NON_COMMERCIAL_EMOTIONAL_PHRASES inclui "meu deus", "credo", "aff"', () => {
      expect(NON_COMMERCIAL_EMOTIONAL_PHRASES).toContain('meu deus');
      expect(NON_COMMERCIAL_EMOTIONAL_PHRASES).toContain('credo');
      expect(NON_COMMERCIAL_EMOTIONAL_PHRASES).toContain('aff');
    });

    it('NON_COMMERCIAL_ACTIVITY_RE bate atividades nao-comerciais', () => {
      expect(NON_COMMERCIAL_ACTIVITY_RE.test('vou fazer almoco')).toBe(true);
      expect(NON_COMMERCIAL_ACTIVITY_RE.test('to dormir')).toBe(true);
      expect(NON_COMMERCIAL_ACTIVITY_RE.test('estou trabalhando')).toBe(false); // "trabalhando" nao bate \btrabalhar\b
    });

    it('OUT_OF_FLOW_STOP_PHRASES inclui variantes pt-BR', () => {
      expect(OUT_OF_FLOW_STOP_PHRASES).toContain('para com isso');
      expect(OUT_OF_FLOW_STOP_PHRASES).toContain('deixa quieto');
    });

    it('OUT_OF_FLOW_STOP_GUARD_RE bate termos comerciais', () => {
      expect(OUT_OF_FLOW_STOP_GUARD_RE.test('presente')).toBe(true);
      expect(OUT_OF_FLOW_STOP_GUARD_RE.test('sobremesa')).toBe(true);
      expect(OUT_OF_FLOW_STOP_GUARD_RE.test('brigadeiro')).toBe(false);
    });
  });

  describe('isLikelyNonCommercialMessage', () => {
    it('true para exclamacao emocional', () => {
      expect(
        isLikelyNonCommercialMessage('meu deus que dor', testNormalizer, realHasAny),
      ).toBe(true);
      expect(
        isLikelyNonCommercialMessage('credo', testNormalizer, realHasAny),
      ).toBe(true);
    });

    it('true para "vou fazer X"', () => {
      expect(
        isLikelyNonCommercialMessage('vou cozinhar agora', testNormalizer, realHasAny),
      ).toBe(true);
    });

    it('false para mensagem comercial', () => {
      expect(
        isLikelyNonCommercialMessage(
          'quero brigadeiro',
          testNormalizer,
          realHasAny,
        ),
      ).toBe(false);
    });

    it('false para string vazia', () => {
      expect(isLikelyNonCommercialMessage('', testNormalizer, realHasAny)).toBe(
        false,
      );
    });
  });

  describe('isOutOfFlowStopIntent', () => {
    it('true para phrases explicitas', () => {
      expect(
        isOutOfFlowStopIntent('tira isso', testNormalizer, realHasAny),
      ).toBe(true);
      expect(
        isOutOfFlowStopIntent('deixa quieto', testNormalizer, realHasAny),
      ).toBe(true);
    });

    it('true para "para" curto', () => {
      expect(isOutOfFlowStopIntent('para', testNormalizer, realHasAny)).toBe(
        true,
      );
      expect(isOutOfFlowStopIntent('chega', testNormalizer, realHasAny)).toBe(
        true,
      );
    });

    it('false quando ha guard comercial ("para presentear")', () => {
      expect(
        isOutOfFlowStopIntent(
          'para presentear minha mae',
          testNormalizer,
          realHasAny,
        ),
      ).toBe(false);
    });

    it('false para mensagens longas comecando com "para"', () => {
      // "para mim e minha familia" tem >= 3 tokens, regra de "<=2" falha
      expect(
        isOutOfFlowStopIntent(
          'para mim e familia',
          testNormalizer,
          realHasAny,
        ),
      ).toBe(false);
    });

    it('false para string vazia', () => {
      expect(isOutOfFlowStopIntent('', testNormalizer, realHasAny)).toBe(
        false,
      );
    });
  });
});
