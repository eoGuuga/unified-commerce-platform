import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateOrderItemDto } from './create-order.dto';

/**
 * H6 (auditoria de seguranca): quantity aceitava fracionado (@IsNumber). Um
 * pedido de "2.5 brigadeiros" nao faz sentido e podia baguncar estoque/total.
 * Fix: @IsInt (mantendo @Min(1) — nao se pede 0). unit_price segue @IsNumber
 * (preco pode ter centavos).
 */
describe('CreateOrderItemDto — H6: quantity tem que ser inteiro >= 1', () => {
  const base = { produto_id: '11111111-1111-1111-1111-111111111111', unit_price: 10 };
  const hasError = (errors: { property: string }[], prop: string) =>
    errors.some((e) => e.property === prop);

  it('🎯 quantity fracionada (3.5) e rejeitada', async () => {
    const errors = await validate(plainToInstance(CreateOrderItemDto, { ...base, quantity: 3.5 }));
    expect(hasError(errors, 'quantity')).toBe(true);
  });

  it('quantity 0 e rejeitada (min 1)', async () => {
    const errors = await validate(plainToInstance(CreateOrderItemDto, { ...base, quantity: 0 }));
    expect(hasError(errors, 'quantity')).toBe(true);
  });

  it('quantity inteira positiva (2) passa', async () => {
    const errors = await validate(plainToInstance(CreateOrderItemDto, { ...base, quantity: 2 }));
    expect(hasError(errors, 'quantity')).toBe(false);
  });

  it('regressao: unit_price fracionado (10.5) continua valido', async () => {
    const errors = await validate(
      plainToInstance(CreateOrderItemDto, { ...base, quantity: 2, unit_price: 10.5 }),
    );
    expect(hasError(errors, 'unit_price')).toBe(false);
  });
});
