import { BadRequestException } from '@nestjs/common';
import { WhatsAppCartController } from './whatsapp-cart.controller';

/**
 * H6 (auditoria de seguranca): o parser hand-rolled do cart (a validacao VIVA;
 * o `dto/cart.dto.ts` e dead code) so checava quantity undefined/null —
 * aceitava 3.5, 0, -1 e ate "abc" (cast pra number = NaN). Fix: exigir inteiro
 * >= 1. O metodo e puro (nao usa deps), entao instanciamos o controller com
 * mocks vazios e chamamos direto.
 */
describe('WhatsAppCartController — H6: add exige quantity inteiro >= 1', () => {
  const controller = new WhatsAppCartController({} as any, {} as any, {} as any);
  const parse = (quantity: unknown) =>
    (controller as any).parseAndValidateAddToCartDto({
      tenantId: 't1',
      customerPhone: '5511999998888',
      productId: 'p1',
      quantity,
    });

  it('🎯 quantity fracionada (3.5) → BadRequest', () => {
    expect(() => parse(3.5)).toThrow(BadRequestException);
  });

  it('quantity 0 → BadRequest', () => {
    expect(() => parse(0)).toThrow(BadRequestException);
  });

  it('quantity negativa (-2) → BadRequest', () => {
    expect(() => parse(-2)).toThrow(BadRequestException);
  });

  it('🎯 quantity nao-numerica ("abc") → BadRequest', () => {
    expect(() => parse('abc')).toThrow(BadRequestException);
  });

  it('quantity inteira positiva (2) → passa', () => {
    expect(parse(2)).toMatchObject({ quantity: 2, productId: 'p1' });
  });
});
