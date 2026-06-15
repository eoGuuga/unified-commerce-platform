import { Injectable, Logger } from '@nestjs/common';
import {
  InteractiveReplyButtonMessage,
  ProductMessage,
  OrderDetailsMessage,
  ProductListMessage,
  InteractiveListMessage,
  ReplyButton,
  WhatsAppBusinessResponse,
  getPreviewText,
} from '../types/whatsapp-interactive.types';

/**
 * Serviço para criar mensagens interativas profissionais do WhatsApp Business API
 */
@Injectable()
export class InteractiveMessageService {
  private readonly logger = new Logger(InteractiveMessageService.name);

  // ============================================
  // REPLY BUTTONS - Botões de ação
  // ============================================

  /**
   * Cria botões de resposta para o carrinho
   */
  createCartButtons(): InteractiveReplyButtonMessage {
    return {
      kind: 'interactive_reply_button',
      body: '🛒 O que você quer fazer com seu carrinho?',
      footer: 'Escolha uma opção abaixo',
      buttons: [
        { id: 'btn_add', title: '➕ Adicionar mais' },
        { id: 'btn_finalize', title: '✅ Finalizar pedido' },
        { id: 'btn_clear', title: '🗑️ Limpar carrinho' },
      ],
    };
  }

  /**
   * Cria botões para mensagem de produto encontrado
   */
  createProductFoundButtons(productName: string, productId: string): InteractiveReplyButtonMessage {
    return {
      kind: 'interactive_reply_button',
      body: `Encontramos "${productName}" para você!`,
      footer: 'Gostaria de adicionar ao carrinho?',
      buttons: [
        { id: `btn_add_${productId}`, title: '🛒 Adicionar ao carrinho' },
        { id: 'btn_catalog', title: '📋 Ver cardápio' },
        { id: 'btn_cancel', title: '❌ Cancelar' },
      ],
    };
  }

  /**
   * Cria botões para confirmação de pedido
   */
  createOrderConfirmationButtons(orderId: string): InteractiveReplyButtonMessage {
    return {
      kind: 'interactive_reply_button',
      body: `Pedido #${orderId} confirmado! 🎉`,
      footer: 'Aguarde o pagamento ser confirmado',
      buttons: [
        { id: `btn_pix_${orderId}`, title: '💳 Pagar com PIX' },
        { id: `btn_status_${orderId}`, title: '📦 Ver status' },
        { id: 'btn_help', title: '❓ Ajuda' },
      ],
    };
  }

  /**
   * Cria botões para menu principal
   */
  createMainMenuButtons(): InteractiveReplyButtonMessage {
    return {
      kind: 'interactive_reply_button',
      body: '👋 Olá! Como posso ajudar?',
      footer: 'Escolha uma opção ou digite o que precisa',
      buttons: [
        { id: 'btn_catalog', title: '📋 Ver cardápio' },
        { id: 'btn_cart', title: '🛒 Meu carrinho' },
        { id: 'btn_help', title: '❓ Ajuda' },
      ],
    };
  }

  // ============================================
  // PRODUCT LIST - Lista de produtos com preço
  // ============================================

  /**
   * Cria lista de produtos com preços visíveis
   */
  createProductList(
    products: Array<{
      id: string;
      name: string;
      price: number;
      description?: string;
    }>,
    categories?: string[],
  ): InteractiveListMessage {
    // Agrupar por categorias ou usar "Todos os Produtos"
    const sections = [];

    if (categories && categories.length > 0) {
      // Agrupar por categoria
      categories.forEach((category, idx) => {
        const categoryProducts = products.slice(idx * 3, (idx + 1) * 3);
        sections.push({
          title: category,
          rows: categoryProducts.map((p) => ({
            id: `prod_${p.id}`,
            title: p.name,
            description: `R$ ${p.price.toFixed(2)}`,
          })),
        });
      });
    } else {
      // Sem categoria - listar todos
      const rows = products.map((p) => ({
        id: `prod_${p.id}`,
        title: p.name,
        description: `R$ ${p.price.toFixed(2)}`,
      }));

      sections.push({
        title: '🍫 Nossos Produtos',
        rows,
      });
    }

    return {
      kind: 'interactive_list',
      header: {
        type: 'text',
        text: '📋 Cardápio',
      },
      body: 'Escolha um produto para ver mais detalhes ou adicionar ao carrinho:',
      footer: 'Preços sujeitos à alteração',
      buttonText: 'Ver opções',
      sections,
    };
  }

  /**
   * Cria lista de produtos para adicionar ao carrinho
   */
  createProductAddList(
    products: Array<{
      id: string;
      name: string;
      price: number;
    }>,
  ): InteractiveListMessage {
    return {
      kind: 'interactive_list',
      header: {
        type: 'text',
        text: '🛒 Adicionar ao carrinho',
      },
      body: 'Escolha o produto:',
      footer: 'Toque em um produto para adicionar',
      buttonText: 'Selecionar',
      sections: [
        {
          title: '📦 Produtos disponíveis',
          rows: products.map((p) => ({
            id: `add_${p.id}`,
            title: p.name,
            description: `R$ ${p.price.toFixed(2)}`,
          })),
        },
      ],
    };
  }

  // ============================================
  // ORDER DETAILS - Detalhes do pedido
  // ============================================

  /**
   * Cria mensagem de detalhes do pedido
   */
  createOrderDetails(
    orderId: string,
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>,
    subtotal: number,
    shipping: number,
    total: number,
    paymentMethod: string,
  ): OrderDetailsMessage {
    return {
      kind: 'interactive_order_details',
      header: {
        title: `📦 Pedido #${orderId}`,
        subtitle: 'Aguardando pagamento',
      },
      body: {
        text: '',
        sections: [
          {
            title: '📋 Itens do pedido',
            rows: items.map((item, idx) => ({
              id: `item_${idx}`,
              title: `${item.quantity}x ${item.name}`,
              description: `R$ ${(item.price * item.quantity).toFixed(2)}`,
            })),
          },
          {
            title: '💰 Valores',
            rows: [
              {
                id: 'subtotal',
                title: 'Subtotal',
                description: `R$ ${subtotal.toFixed(2)}`,
              },
              {
                id: 'shipping',
                title: 'Frete',
                description: `R$ ${shipping.toFixed(2)}`,
              },
              {
                id: 'total',
                title: 'TOTAL',
                description: `R$ ${total.toFixed(2)}`,
              },
            ],
          },
        ],
      },
      footer: `Forma de pagamento: ${paymentMethod}`,
      action: {
        buttons: [
          { id: `btn_pay_${orderId}`, title: '💳 Pagar agora' },
          { id: `btn_cancel_${orderId}`, title: '❌ Cancelar' },
        ],
      },
    };
  }

  // ============================================
  // PRODUCT CARD - Card de produto individual
  // ============================================

  /**
   * Cria card de produto com botões
   */
  createProductCard(
    product: {
      id: string;
      name: string;
      price: number;
      description?: string;
      imageUrl?: string;
    },
    catalogId?: string,
  ): ProductMessage | InteractiveReplyButtonMessage {
    if (catalogId) {
      return {
        kind: 'interactive_product',
        catalogId,
        productId: product.id,
        header: {
          type: 'text',
          text: product.name,
        },
        body: [
          `💰 *Preço: R$ ${product.price.toFixed(2)}*`,
          '',
          product.description || '',
        ].join('\n'),
        footer: 'Toque para adicionar ao carrinho',
        action: {
          buttons: [
            { id: `btn_add_${product.id}`, title: '🛒 Adicionar' },
            { id: `btn_details_${product.id}`, title: '📝 Ver detalhes' },
          ],
        },
      };
    }

    // Fallback para reply button se não tiver catalog
    return {
      kind: 'interactive_reply_button',
      header: {
        type: 'text',
        text: `🍫 ${product.name}`,
      },
      body: [
        `💰 *R$ ${product.price.toFixed(2)}*`,
        '',
        product.description || 'Delicioso!',
      ].join('\n'),
      footer: 'Adicionar ao carrinho?',
      buttons: [
        { id: `btn_add_${product.id}`, title: '🛒 Adicionar' },
        { id: 'btn_catalog', title: '📋 Ver mais' },
      ],
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Extrai texto de qualquer tipo de resposta para logs
   */
  getTextForLog(response: WhatsAppBusinessResponse): string {
    if (typeof response === 'string') {
      return response;
    }
    return getPreviewText(response);
  }
}