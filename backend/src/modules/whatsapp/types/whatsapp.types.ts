import { WhatsappConversation } from '../../../database/entities/WhatsappConversation.entity';
import { Produto } from '../../../database/entities/Produto.entity';

/**
 * Interface para produto com informações de estoque
 */
export interface ProductWithStock extends Produto {
  available_stock: number;
  reserved_stock: number;
  stock: number;
  min_stock: number;
}

/**
 * Interface para resultado de busca de produto
 */
export interface ProductSearchResult {
  produto: ProductWithStock | null;
  sugestoes?: ProductWithStock[];
}

/**
 * Tipo para contexto de conversa
 */
export interface ConversationContext {
  pedido_id?: string;
  waiting_payment?: boolean;
  [key: string]: any; // Para permitir extensibilidade
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
  metadata: Record<string, any>;
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
