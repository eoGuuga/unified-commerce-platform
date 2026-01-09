import { WhatsappConversation } from '../../../database/entities/WhatsappConversation.entity';
import { ProductWithStock } from '../../products/types/product.types';

/**
 * Interface para resultado de busca de produto
 */
export interface ProductSearchResult {
  produto: ProductWithStock | null;
  sugestoes?: ProductWithStock[];
}

/**
 * Estados possíveis da conversa durante o fluxo de pedido
 */
export type ConversationState = 
  | 'idle'                    // Sem contexto, aguardando comando
  | 'collecting_order'        // Coletando itens do pedido
  | 'collecting_name'         // Coletando nome do cliente
  | 'collecting_address'      // Coletando endereço (se entrega)
  | 'collecting_phone'        // Coletando telefone de contato
  | 'confirming_order'        // Confirmando pedido completo antes de criar
  | 'waiting_payment'         // Aguardando seleção e processamento de pagamento
  | 'order_confirmed'         // Pedido confirmado e pago
  | 'order_completed';        // Pedido completo (entregue)

/**
 * Dados do cliente coletados durante a conversa
 */
export interface CustomerData {
  name?: string;
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  phone?: string;
  notes?: string;
  delivery_type?: 'delivery' | 'pickup'; // Entrega ou retirada
}

/**
 * Item do pedido pendente
 */
export interface PendingOrderItem {
  produto_id: string;
  produto_name: string;
  quantity: number;
  unit_price: number;
}

/**
 * Pedido pendente (antes de confirmar)
 */
export interface PendingOrder {
  items: PendingOrderItem[];
  subtotal: number;
  coupon_code?: string | null;
  discount_amount: number;
  shipping_amount: number;
  total_amount: number;
}

/**
 * Tipo para contexto de conversa
 */
export interface ConversationContext {
  pedido_id?: string;
  waiting_payment?: boolean;
  state?: ConversationState;           // Estado atual da conversa
  customer_data?: CustomerData;         // Dados do cliente coletados
  pending_order?: PendingOrder;        // Pedido pendente (antes de confirmar)
  [key: string]: unknown; // Para permitir extensibilidade
}

/**
 * Interface para conversa tipada (baseada na entidade)
 */
export interface TypedConversation {
  id: string;
  tenant_id: string;
  customer_phone: string;
  customer_name?: string;
  status: string;
  context: ConversationContext;
  pedido_id?: string;
  started_at: Date;
  last_message_at: Date;
  completed_at?: Date;
  metadata: Record<string, unknown>;
}

/**
 * Helper para converter WhatsappConversation para TypedConversation
 */
export function toTypedConversation(conv: WhatsappConversation): TypedConversation {
  return {
    id: conv.id,
    tenant_id: conv.tenant_id,
    customer_phone: conv.customer_phone,
    customer_name: conv.customer_name,
    status: conv.status,
    context: conv.context as ConversationContext,
    pedido_id: conv.pedido_id,
    started_at: conv.started_at,
    last_message_at: conv.last_message_at,
    completed_at: conv.completed_at,
    metadata: conv.metadata || {},
  };
}
