import { WhatsAppCartController } from './whatsapp-cart.controller';
import { CartService } from './services/cart.service';

/**
 * BUG-CART-1: o GET publico `whatsapp/cart/:tenantId/:phone` devolvia 500
 * quando nao havia carrinho. O handler chama `buildMinimalCartSummary(cart)`
 * com `cart === null`; todos os campos usam `?.` (null-safe) EXCETO a chamada
 * a `generateSummary(cart)`, que fazia `cart.items.length` e lancava TypeError
 * (nao-HttpException -> 500 mascarado). Provamos a porta da frente do bug: o
 * builder do controller, usando o `generateSummary` REAL, produz um resumo de
 * carrinho vazio sem lancar.
 */
describe('WhatsAppCartController — GET com carrinho ausente nao quebra (BUG-CART-1)', () => {
  function makeController() {
    // generateSummary nao usa `this` — reaproveitamos a implementacao REAL para
    // exercitar o caminho exato da linha 608, sem instanciar o CartService todo.
    const cartService = { generateSummary: CartService.prototype.generateSummary } as any;
    return new (WhatsAppCartController as any)(cartService, {}, {});
  }

  it('🎯 buildMinimalCartSummary(null) devolve um DTO de carrinho vazio, sem lancar', () => {
    const controller = makeController();

    const dto = (controller as any).buildMinimalCartSummary(null);

    expect(dto).toEqual({
      hasCart: false,
      itemCount: 0,
      totalValue: 0,
      expired: false,
      formattedSummary: '🛒 Carrinho vazio',
    });
  });
});

/**
 * Cobertura no ponto exato do crash. generateSummary nao usa `this`, entao
 * exercitamos a implementacao REAL pelo prototype (o cart.service.spec.ts
 * dedicado nao instancia por debito pre-existente: falta DataSource/StockEngine
 * no TestingModule).
 */
describe('CartService.generateSummary — resiliente a carrinho nulo/vazio (BUG-CART-1)', () => {
  const generateSummary = CartService.prototype.generateSummary;

  it('🎯 carrinho null retorna "Carrinho vazio" (nao lanca)', () => {
    expect(() => generateSummary(null as any)).not.toThrow();
    expect(generateSummary(null as any)).toBe('🛒 Carrinho vazio');
  });

  it('carrinho com items vazios retorna "Carrinho vazio"', () => {
    expect(generateSummary({ items: [] } as any)).toBe('🛒 Carrinho vazio');
  });

  it('regressao: carrinho com itens ainda gera o resumo completo', () => {
    const cart = {
      items: [{ produto_name: 'Brigadeiro', quantity: 2, unit_price: 3.5 }],
      subtotal: 7,
      shipping_amount: 10,
      total_amount: 17,
    };
    const summary = generateSummary(cart as any);
    expect(summary).toContain('Brigadeiro');
    expect(summary).toContain('TOTAL: R$ 17.00');
  });
});
