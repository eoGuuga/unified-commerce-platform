/**
 * Tipos para mensagens interativas do WhatsApp Business API
 * Suporta: Reply Buttons, Product Messages, Order Details, Interactive Lists
 */

// Tipos de mensagem interativa
export type InteractiveMessageType =
  | 'reply_button'      // Botões de resposta rápida
  | 'product'           // Card de produto
  | 'order_details'     // Detalhes do pedido
  | 'list'              // Lista interativa (já existe)
  | 'product_list';     // Lista de produtos

// ============================================
// REPLY BUTTONS (Botões de resposta rápida)
// ============================================
export interface ReplyButton {
  id: string;
  title: string;
}

export interface InteractiveReplyButtonMessage {
  kind: 'interactive_reply_button';
  header?: {
    type: 'text' | 'image' | 'video';
    text?: string;
    mediaUrl?: string;
  };
  body: string;
  footer?: string;
  buttons: ReplyButton[];
}

// ============================================
// PRODUCT MESSAGE (Card de produto)
// ============================================
export interface ProductMessage {
  kind: 'interactive_product';
  catalogId: string;
  productId: string;
  header?: {
    type: 'text';
    text: string;
  };
  body: string;
  footer?: string;
  action: {
    buttons: ReplyButton[];
  };
}

// ============================================
// ORDER DETAILS (Detalhes do pedido)
// ============================================
export interface OrderItem {
  quantity: number;
  amount: number;
  currency: string;
}

export interface OrderDetailsMessage {
  kind: 'interactive_order_details';
  header: {
    title: string;
    subtitle?: string;
  };
  body: {
    document?: {
      id: string;
      caption: string;
    };
    text: string;
    sections?: {
      title: string;
      rows: {
        id: string;
        title: string;
        description?: string;
      }[];
    }[];
  };
  footer?: string;
  action: {
    buttons: ReplyButton[];
  };
}

// ============================================
// PRODUCT LIST MESSAGE (Lista de produtos)
// ============================================
export interface ProductListItem {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  imageUrl?: string;
}

export interface ProductListSection {
  title: string;
  productItems: ProductListItem[];
}

export interface ProductListMessage {
  kind: 'interactive_product_list';
  header: {
    title: string;
    body: string;
  };
  catalogId: string;
  sections: ProductListSection[];
  action: {
    buttonText: string;
  };
}

// ============================================
// INTERACTIVE LIST MESSAGE (Lista interativa - melhorada)
// ============================================
export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

export interface InteractiveListMessage {
  kind: 'interactive_list';
  header?: {
    type: 'text';
    text: string;
  };
  body: string;
  footer?: string;
  buttonText: string;
  sections: ListSection[];
}

// Tipo unificado de resposta
export type WhatsAppBusinessResponse =
  | string
  | InteractiveReplyButtonMessage
  | ProductMessage
  | OrderDetailsMessage
  | ProductListMessage
  | InteractiveListMessage;

// Preview text para respostas interativas
export function getPreviewText(response: WhatsAppBusinessResponse): string {
  if (typeof response === 'string') {
    return response.substring(0, 50);
  }

  switch (response.kind) {
    case 'interactive_reply_button':
      return response.body.substring(0, 50);
    case 'interactive_product':
      return response.body.substring(0, 50);
    case 'interactive_order_details':
      return response.body.text?.substring(0, 50) || 'Pedido';
    case 'interactive_product_list':
      return response.header.body.substring(0, 50);
    case 'interactive_list':
      return response.body.substring(0, 50);
    default:
      return 'Resposta';
  }
}