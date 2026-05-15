import {
  ORDER_INTENT_PHRASES,
  REPEAT_ORDER_PHRASES,
} from './order-intents';

describe('order-intents constants', () => {
  describe('REPEAT_ORDER_PHRASES', () => {
    it('cobre variantes de "repetir/refazer pedido"', () => {
      expect(REPEAT_ORDER_PHRASES).toContain('repetir pedido');
      expect(REPEAT_ORDER_PHRASES).toContain('pedido repetido');
      expect(REPEAT_ORDER_PHRASES).toContain('repetir meu pedido');
      expect(REPEAT_ORDER_PHRASES).toContain('refazer pedido');
    });
  });

  describe('ORDER_INTENT_PHRASES', () => {
    it('inclui verbos basicos de querer/comprar/pedir', () => {
      expect(ORDER_INTENT_PHRASES).toContain('quero');
      expect(ORDER_INTENT_PHRASES).toContain('preciso');
      expect(ORDER_INTENT_PHRASES).toContain('comprar');
      expect(ORDER_INTENT_PHRASES).toContain('pedir');
    });

    it('inclui variantes coloquiais ("me manda", "separa pra mim")', () => {
      expect(ORDER_INTENT_PHRASES).toContain('me manda');
      expect(ORDER_INTENT_PHRASES).toContain('manda ai');
      expect(ORDER_INTENT_PHRASES).toContain('separa pra mim');
      expect(ORDER_INTENT_PHRASES).toContain('separar para mim');
    });

    it('inclui formulacoes mais formais', () => {
      expect(ORDER_INTENT_PHRASES).toContain('gostaria de');
      expect(ORDER_INTENT_PHRASES).toContain('poderia');
      expect(ORDER_INTENT_PHRASES).toContain('seria possível');
    });

    it('inclui combinacoes com "encomenda" e "pedido"', () => {
      expect(ORDER_INTENT_PHRASES).toContain('quero fazer pedido');
      expect(ORDER_INTENT_PHRASES).toContain('quero encomendar');
      expect(ORDER_INTENT_PHRASES).toContain('preciso fazer um pedido');
    });

    it('nao tem entrada vazia nem duplicata', () => {
      const seen = new Set<string>();
      for (const item of ORDER_INTENT_PHRASES) {
        expect(item.trim().length).toBeGreaterThan(0);
        expect(seen.has(item)).toBe(false);
        seen.add(item);
      }
    });
  });
});
