/**
 * Builder da chave de idempotencia usada para POST /orders vindo do bot
 * WhatsApp.
 *
 * A chave eh deterministica para o mesmo (conversa + tentativa + cliente +
 * pedido pendente), de modo que retries do mesmo carrinho na mesma janela
 * de tentativa nao gerem 2 pedidos no backend.
 *
 * Funcao pura.
 */

import * as crypto from 'crypto';
import { CustomerData, PendingOrder, TypedConversation } from '../types/whatsapp.types';

/**
 * Gera `wa:<conversationId>:create_order:<sha256>` onde o hash inclui o
 * order_attempt_id (ou fallback conversationId), o pendingOrder atual e
 * os dados do cliente. JSON.stringify garante representacao consistente
 * para inputs equivalentes.
 */
export function buildWhatsAppOrderIdempotencyKey(
  conversation: TypedConversation,
  pendingOrder: PendingOrder,
  customerData?: CustomerData,
): string {
  const attemptId = conversation.context?.order_attempt_id || conversation.id;
  const stablePayload = {
    order_attempt_id: attemptId,
    conversation_id: conversation.id,
    customer_phone: conversation.customer_phone,
    tenant_id: conversation.tenant_id,
    pending_order: pendingOrder,
    customer_data: {
      name: customerData?.name || null,
      phone: customerData?.phone || null,
      delivery_type: customerData?.delivery_type || null,
      address: customerData?.address || null,
    },
  };

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(stablePayload))
    .digest('hex');

  return `wa:${conversation.id}:create_order:${hash}`;
}
