/**
 * Templates de mensagens transacionais de pedido/pagamento do bot WhatsApp.
 * Funcoes puras - receberem o trackingUrl pre-resolvido pelo caller.
 */

import { MetodoPagamento } from '../../../database/entities/Pagamento.entity';
import { Pedido, PedidoStatus } from '../../../database/entities/Pedido.entity';
import {
  formatCurrencyBR,
  getDeliveryTypeLabel,
  getGreetingLine,
  getNextStepSummary,
} from './order-formatters';

/**
 * Adiciona uma frase de follow-up + link de acompanhamento ao final de uma
 * mensagem de pagamento. O follow-up varia conforme o metodo escolhido
 * (PIX -> reconhecimento automatico; dinheiro -> equipe confirma; outros
 * -> generico).
 */
export function enrichPaymentMessage(
  baseMessage: string,
  pedido: Pedido,
  method: MetodoPagamento,
  trackingUrl: string,
): string {
  const followUp =
    method === MetodoPagamento.PIX
      ? 'Assim que o pagamento for reconhecido, o pedido avanca automaticamente.'
      : method === MetodoPagamento.DINHEIRO
        ? 'Assim que a equipe confirmar o recebimento, o pedido segue para a preparacao.'
        : 'A proxima atualizacao chega assim que o pagamento avancar.';

  return [
    baseMessage.trim(),
    '',
    followUp,
    `Acompanhamento completo: ${trackingUrl}`,
  ].join('\n');
}

/**
 * Mensagem com as opcoes de pagamento "premium" do bot (PIX com desconto
 * de 5% + dinheiro).
 */
export function getPremiumPaymentOptionsMessage(total: number): string {
  const totalAmount = Number(total || 0);
  const pixAmount = totalAmount > 0 ? totalAmount * 0.95 : 0;

  return [
    'FORMAS DE PAGAMENTO',
    '',
    `1. PIX com 5% de desconto (R$ ${formatCurrencyBR(pixAmount)})`,
    '2. Dinheiro',
    '',
    'Responda com o numero ou o nome do metodo.',
    'Exemplo: "1", "pix" ou "dinheiro".',
  ].join('\n');
}

/**
 * Mensagem de confirmacao do pedido recem-criado: cumprimento + numero
 * + recebimento + total + proximo passo + opcoes de pagamento + URL.
 */
export function buildOrderCreatedMessage(
  pedido: Pedido,
  trackingUrl: string,
): string {
  return [
    getGreetingLine(pedido.customer_name),
    '',
    'PEDIDO CRIADO COM SUCESSO',
    '',
    `Pedido: *${pedido.order_no}*`,
    `Recebimento: ${getDeliveryTypeLabel(pedido.delivery_type)}`,
    `Total: R$ ${formatCurrencyBR(Number(pedido.total_amount || 0))}`,
    '',
    'Seu pedido ja esta reservado e pronto para seguir assim que o pagamento for escolhido.',
    getNextStepSummary(pedido, PedidoStatus.PENDENTE_PAGAMENTO),
    '',
    getPremiumPaymentOptionsMessage(Number(pedido.total_amount || 0)),
    '',
    `Acompanhamento completo: ${trackingUrl}`,
  ].join('\n');
}
