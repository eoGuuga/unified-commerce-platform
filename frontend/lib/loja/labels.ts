/**
 * Labels traduzidos para apresentacao em pt-BR (storefront, PDV e admin).
 */

export type PaymentMethodLojaPdv = 'pix' | 'dinheiro';
export type DeliveryType = 'delivery' | 'pickup';

export function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Aguardando pagamento',
    approved: 'Pagamento aprovado',
    confirmed: 'Pagamento confirmado',
    paid: 'Pagamento aprovado',
    cancelled: 'Pagamento cancelado',
    rejected: 'Pagamento recusado',
  };

  return labels[status] || status;
}

export function getPaymentMethodLabel(method: PaymentMethodLojaPdv): string {
  return method === 'pix' ? 'Pix' : 'Dinheiro';
}

export function getDeliveryTypeLabel(deliveryType: DeliveryType): string {
  return deliveryType === 'delivery' ? 'Entrega' : 'Retirada';
}
