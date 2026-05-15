/**
 * Helpers de etapa da conversa (collection state machine).
 * Labels, requisitos e dicas para o cliente no fluxo de coleta de dados.
 *
 * Funcoes puras - sem this, sem servicos. Extraidas de whatsapp.service.ts.
 */

import { ConversationState, CustomerData } from '../types/whatsapp.types';

/**
 * Label legivel da etapa atual da conversa para exibir em resumos.
 */
export function getConversationStageLabel(
  currentState?: ConversationState,
  customerData?: CustomerData,
): string {
  switch (currentState) {
    case 'collecting_order':
      return 'Montando o pedido';
    case 'collecting_name':
      return 'Coletando o nome do cliente';
    case 'collecting_address':
      return customerData?.delivery_type
        ? 'Coletando o endereco de entrega'
        : 'Escolhendo entrega ou retirada';
    case 'collecting_phone':
      return 'Coletando o telefone de contato';
    case 'collecting_notes':
      return 'Coletando observacoes finais';
    case 'collecting_cash_change':
      return 'Coletando informacao de troco';
    case 'confirming_stock_adjustment':
      return 'Confirmando ajuste por estoque';
    case 'confirming_order':
      return 'Revisando o pedido antes de fechar';
    case 'waiting_payment':
      return 'Aguardando pagamento';
    case 'order_confirmed':
      return 'Pedido confirmado';
    case 'order_completed':
      return 'Pedido concluido';
    default:
      return 'Conversa aberta';
  }
}

/**
 * Frase que descreve o que ainda falta para concluir a etapa atual
 * ("preciso DO/DA ...").
 */
export function getCollectionStageRequirement(
  currentState: ConversationState,
  customerData?: CustomerData,
): string {
  switch (currentState) {
    case 'collecting_name':
      return 'do nome completo de quem vai receber o pedido';
    case 'collecting_address':
      return customerData?.delivery_type === 'delivery'
        ? 'do endereco de entrega'
        : 'de como voce prefere receber: entrega ou retirada';
    case 'collecting_phone':
      return 'do telefone de contato com DDD';
    default:
      return 'da etapa atual do pedido';
  }
}

/**
 * Dica de formato esperado pelo bot para a etapa atual.
 */
export function getCollectionStageHint(
  currentState: ConversationState,
  customerData?: CustomerData,
): string {
  switch (currentState) {
    case 'collecting_name':
      return 'Me envie so o nome completo. Exemplo: "Jordan Lincoln".';
    case 'collecting_address':
      return customerData?.delivery_type === 'delivery'
        ? 'Me envie rua, numero, bairro, cidade, estado e CEP.'
        : 'Responda com "entrega" ou "retirada".';
    case 'collecting_phone':
      return 'Me envie so o telefone com DDD. Exemplo: 11987654321.';
    default:
      return 'Me responda so essa etapa para eu seguir sem me perder.';
  }
}

/**
 * Constroi mensagem de "desvio" - quando o usuario tenta avancar mas
 * ainda falta dado da etapa corrente. Combina intro + linhas extras +
 * requirement + hint num formato consistente.
 */
export function buildCollectionStageDetourMessage(
  intro: string,
  currentState: ConversationState,
  customerData?: CustomerData,
  extraLines: string[] = [],
): string {
  return [
    intro,
    ...extraLines,
    '',
    `Antes disso, preciso ${getCollectionStageRequirement(currentState, customerData)}.`,
    getCollectionStageHint(currentState, customerData),
  ]
    .filter(Boolean)
    .join('\n');
}
