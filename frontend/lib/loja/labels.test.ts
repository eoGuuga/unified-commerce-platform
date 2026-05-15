import { describe, expect, it } from 'vitest';
import {
  getDeliveryTypeLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from './labels';

describe('getPaymentStatusLabel', () => {
  it('traduz status conhecidos para pt-BR', () => {
    expect(getPaymentStatusLabel('pending')).toBe('Aguardando pagamento');
    expect(getPaymentStatusLabel('approved')).toBe('Pagamento aprovado');
    expect(getPaymentStatusLabel('paid')).toBe('Pagamento aprovado');
    expect(getPaymentStatusLabel('cancelled')).toBe('Pagamento cancelado');
    expect(getPaymentStatusLabel('rejected')).toBe('Pagamento recusado');
  });

  it('retorna o status cru quando nao mapeado', () => {
    expect(getPaymentStatusLabel('something_new')).toBe('something_new');
  });
});

describe('getPaymentMethodLabel', () => {
  it('mapeia pix e dinheiro', () => {
    expect(getPaymentMethodLabel('pix')).toBe('Pix');
    expect(getPaymentMethodLabel('dinheiro')).toBe('Dinheiro');
  });
});

describe('getDeliveryTypeLabel', () => {
  it('mapeia delivery e pickup', () => {
    expect(getDeliveryTypeLabel('delivery')).toBe('Entrega');
    expect(getDeliveryTypeLabel('pickup')).toBe('Retirada');
  });
});
