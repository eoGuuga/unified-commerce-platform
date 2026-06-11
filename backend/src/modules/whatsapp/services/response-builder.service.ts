import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypedConversation, ConversationState, CustomerData } from '../types/whatsapp.types';
import { Pedido, PedidoStatus } from '../../../database/entities/Pedido.entity';

export interface ResponseOptions {
  includeGreeting?: boolean;
  includeContext?: boolean;
  includeGuidance?: boolean;
  maxLength?: number;
}

const GREETINGS = [
  'Olá! 👋',
  'Oi! 😊',
  'Tudo bem? 👋',
];

@Injectable()
export class ResponseBuilderService {
  private readonly logger = new Logger(ResponseBuilderService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Constrói saudação
   */
  buildGreeting(customerName?: string | null): string {
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

    if (customerName) {
      return `${greeting} ${customerName}! Como posso ajudar?`;
    }

    return `${greeting} Como posso ajudar?`;
  }

  /**
   * Constrói despedida
   */
  buildFarewell(customerName?: string | null): string {
    const lines: string[] = [];

    lines.push('Foi um prazer atender você! 😊');

    if (customerName) {
      lines.push(`${customerName}, volte sempre!`);
    }

    lines.push('Até mais! 👋');

    return lines.join('\n');
  }

  /**
   * Constrói resposta de carrinho vazio
   */
  buildEmptyCartResponse(): string {
    return [
      '🛒 *Carrinho vazio*',
      '',
      'Que tal começar a escolher?',
      '',
      'Diga o que você quer ou peça para ver o cardápio!',
    ].join('\n');
  }

  /**
   * Constrói resposta de produto adicionado
   */
  buildProductAddedMessage(productName: string, quantity: number, unitPrice: number, cartTotal: number): string {
    const itemTotal = quantity * unitPrice;

    return [
      `✅ Adicionado ${quantity}x ${productName}`,
      '',
      `Subtotal: R$ ${itemTotal.toFixed(2).replace('.', ',')}`,
      `Total carrinho: R$ ${cartTotal.toFixed(2).replace('.', ',')}`,
      '',
      'Deseja algo mais?',
    ].join('\n');
  }

  /**
   * Constrói resposta de ajuda
   */
  buildHelpMessage(): string {
    return [
      '📋 *Comandos disponíveis:*',
      '',
      '🛒 *Carrinho:*',
      '• "carrinho" - ver seu carrinho',
      '• "adicionar [produto]" - adicionar item',
      '• "remover [produto]" - remover item',
      '• "limpar" - esvaziar carrinho',
      '',
      '📦 *Pedidos:*',
      '• "pedido" - ver seus pedidos',
      '• "status [número]" - ver status do pedido',
      '',
      '💳 *Pagamento:*',
      '• "pix" - pagar com PIX',
      '• "cartão" - pagar com cartão',
      '',
      'Digite qualquer pergunta que vou ajudar! 😊',
    ].join('\n');
  }

  /**
   * Constrói resposta de erro amigável
   */
  buildErrorMessage(errorType: string, retryable: boolean): string {
    const messages: Record<string, string> = {
      'connection': '🌐 Nossa conexão está lenta. Tente novamente em alguns segundos.',
      'timeout': '⏱️ Demorei para processar. Pode repetir sua mensagem?',
      'not_found': '🔍 Não encontrei o que você procura. Quer ver o cardápio?',
      'out_of_stock': '😔 Este produto está fora de estoque. Posso mostrar outras opções?',
      'validation': '🤔 Não entendi bem. Pode reformular?',
      'payment_failed': '💳 Houve um problema com o pagamento. Quer tentar outra forma?',
      'default': '😅 Ops! Algo deu errado. Pode tentar novamente?',
    };

    const baseMessage = messages[errorType] || messages['default'];

    if (retryable) {
      return baseMessage;
    }

    return baseMessage;
  }

  /**
   * Constrói resposta de etapa de coleta
   */
  buildCollectionStageMessage(
    currentState: ConversationState,
    customerData?: CustomerData,
    guidance?: string,
  ): string {
    const stateMessages: Record<ConversationState, string> = {
      idle: 'Como posso ajudar?',
      collecting_order: 'O que você gostaria de pedir?',
      collecting_name: 'Qual é o seu nome?',
      collecting_address: 'Qual é o endereço de entrega?',
      collecting_phone: 'Qual é o seu telefone?',
      collecting_notes: 'Alguma observação? (ou diga "nada" para continuar)',
      collecting_cash_change: 'Você vai pagar com dinheiro? Precisa de troco?',
      confirming_order: 'Confirma o pedido? (sim/não)',
      confirming_stock_adjustment: 'A quantidade disponível mudou. Quer ajustar?',
      waiting_payment: 'Escolha a forma de pagamento:',
      order_confirmed: 'Pedido confirmado! 🎉',
      order_completed: 'Pedido concluído!',
    };

    const baseMessage = stateMessages[currentState] || 'Pode continuar...';

    if (guidance) {
      return [baseMessage, '', guidance].join('\n');
    }

    return baseMessage;
  }

  /**
   * Constrói resposta de informações faltando
   */
  buildMissingInfoMessage(field: string): string {
    const fieldMessages: Record<string, string> = {
      name: 'Qual é o seu nome?',
      phone: 'Qual é o seu telefone para contato?',
      address: 'Qual é o endereço de entrega?',
      notes: 'Tem alguma observação? (ou diga "nada" para continuar)',
      payment: 'Como prefere pagar?',
    };

    return fieldMessages[field] || `Preciso de mais informações. ${field}`;
  }

  /**
   * Constrói resumo do pedido
   */
  buildOrderSummary(
    pedido: Pedido,
    customerData?: CustomerData,
    options?: ResponseOptions,
  ): string {
    const lines: string[] = [];

    lines.push('📋 *Resumo do Pedido*\n');

    // Order number
    if (pedido.order_no) {
      lines.push(`Pedido: ${pedido.order_no}`);
    }

    // Status
    const statusLabel = this.getStatusLabel(pedido.status);
    lines.push(`Status: ${statusLabel}`);
    lines.push('');

    // Items
    if (pedido.itens) {
      const items = typeof pedido.itens === 'string' ? JSON.parse(pedido.itens) : pedido.itens;
      items.forEach((item: any, index: number) => {
        lines.push(`${index + 1}. ${item.produto_name || item.name}`);
        lines.push(`   ${item.quantity || 1}x R$ ${Number(item.unit_price || item.price).toFixed(2).replace('.', ',')}`);
      });
    }

    lines.push('');
    lines.push(`Subtotal: R$ ${Number(pedido.subtotal || 0).toFixed(2).replace('.', ',')}`);
    lines.push(`Frete: R$ ${Number(pedido.shipping_amount || 0).toFixed(2).replace('.', ',')}`);
    lines.push('');
    lines.push(`💰 *TOTAL: R$ ${Number(pedido.total_amount || 0).toFixed(2).replace('.', ',')}*`);

    // Customer info
    if (customerData || pedido.customer_name) {
      lines.push('');
      lines.push('📍 *Dados:*');

      const name = customerData?.name || pedido.customer_name;
      if (name) lines.push(`   Nome: ${name}`);

      const phone = customerData?.phone || pedido.customer_phone;
      if (phone) lines.push(`   Telefone: ${phone}`);

      const address = customerData?.address || pedido.delivery_address;
      if (address) {
        const addressStr = typeof address === 'string' ? address :
          `${address.street || ''}, ${address.number || ''}`.trim();
        if (addressStr) lines.push(`   Endereço: ${addressStr}`);
      }
    }

    // Delivery type
    const deliveryType = customerData?.delivery_type || pedido.delivery_type;
    if (deliveryType) {
      lines.push(`   Entrega: ${deliveryType === 'pickup' ? 'Retirada' : 'Entrega'}`);
    }

    return lines.join('\n');
  }

  /**
   * Constrói mensagem de status do pedido
   */
  buildOrderStatusMessage(pedido: Pedido): string {
    const statusLabel = this.getStatusLabel(pedido.status);
    const statusEmoji = this.getStatusEmoji(pedido.status);

    const lines: string[] = [];

    lines.push(`${statusEmoji} *Pedido ${pedido.order_no || pedido.id}*`);
    lines.push(`Status: ${statusLabel}`);
    lines.push('');

    // Next step based on status
    const nextStep = this.getNextStep(pedido);
    if (nextStep) {
      lines.push(nextStep);
    }

    // Contact info
    lines.push('');
    lines.push('Dúvidas? Digite "ajuda" para falar conosco.');

    return lines.join('\n');
  }

  /**
   * Constrói mensagem de boas-vindas para novo cliente
   */
  buildWelcomeMessage(): string {
    return [
      '🍫 *Bem-vindo(a)!*',
      '',
      'Sou o assistente virtual da loja!',
      '',
      'Posso te ajudar a:',
      '• Montar seu pedido',
      '• Consultar preços e disponibilidade',
      '• Acompanhar seus pedidos',
      '',
      'O que você gostaria de fazer?',
    ].join('\n');
  }

  /**
   * Constrói mensagem de despedida
   */
  buildGoodbyeMessage(): string {
    return [
      '👋 Até mais!',
      '',
      'Foi um prazer te atender!',
      '',
      'Quando quiser fazer um novo pedido, é só chamar. 😊',
    ].join('\n');
  }

  /**
   * Constrói mensagem de escalação para humano
   */
  buildEscalationMessage(conversation?: TypedConversation): string {
    const lines: string[] = [];

    lines.push('👤 *Encaminhando para atendimento...*');
    lines.push('');
    lines.push('Aguarde um momento que logo um de nossos atendentes vai te ajudar.');

    if (conversation) {
      lines.push('');
      lines.push('📋 *Resumo do que você precisa:*');

      const customerData = conversation.context?.customer_data as CustomerData | undefined;
      if (customerData?.name) lines.push(`   Nome: ${customerData.name}`);

      const pendingOrder = conversation.context?.pending_order;
      if (pendingOrder?.items?.length) {
        lines.push(`   Itens: ${pendingOrder.items.length} produto(s)`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Constrói mensagem de confirmação
   */
  buildConfirmationMessage(question: string, yesLabel = 'sim', noLabel = 'não'): string {
    return `${question}\n\n${yesLabel} / ${noLabel}`;
  }

  /**
   * Constrói mensagem de listagem de opções
   */
  buildOptionsList(title: string, options: Array<{ id: string; label: string; description?: string }>): string {
    const lines: string[] = [];

    lines.push(`📋 *${title}*\n`);

    options.forEach((option, index) => {
      lines.push(`${index + 1}. ${option.label}`);
      if (option.description) {
        lines.push(`   ${option.description}`);
      }
    });

    return lines.join('\n');
  }

  // ============== HELPERS ==============

  private getStatusLabel(status: PedidoStatus | string): string {
    const labels: Record<string, string> = {
      [PedidoStatus.PENDENTE_PAGAMENTO]: 'Aguardando pagamento',
      [PedidoStatus.CONFIRMADO]: 'Confirmado',
      [PedidoStatus.EM_PRODUCAO]: 'Preparando',
      [PedidoStatus.PRONTO]: 'Pronto',
      [PedidoStatus.EM_TRANSITO]: 'Em trânsito',
      [PedidoStatus.ENTREGUE]: 'Entregue',
      [PedidoStatus.CANCELADO]: 'Cancelado',
    };

    return labels[status as string] || String(status);
  }

  private getStatusEmoji(status: PedidoStatus | string): string {
    const emojis: Record<string, string> = {
      [PedidoStatus.PENDENTE_PAGAMENTO]: '⏳',
      [PedidoStatus.CONFIRMADO]: '✅',
      [PedidoStatus.EM_PRODUCAO]: '👨‍🍳',
      [PedidoStatus.PRONTO]: '📦',
      [PedidoStatus.EM_TRANSITO]: '🚚',
      [PedidoStatus.ENTREGUE]: '🎉',
      [PedidoStatus.CANCELADO]: '❌',
    };

    return emojis[status as string] || '📋';
  }

  private getNextStep(pedido: Pedido): string | null {
    switch (pedido.status) {
      case PedidoStatus.PENDENTE_PAGAMENTO:
        return 'Aguardando confirmação de pagamento.';
      case PedidoStatus.CONFIRMADO:
        return 'Seu pedido foi confirmado e está sendo preparado!';
      case PedidoStatus.EM_PRODUCAO:
        return 'Estamos preparando seu pedido com muito carinho! 🍫';
      case PedidoStatus.PRONTO:
        return 'Seu pedido está pronto! ';
      case PedidoStatus.ENTREGUE:
        return 'Pedido entregue! Bom apetite! 🍫';
      case PedidoStatus.CANCELADO:
        return 'Pedido cancelado. Se quiser fazer um novo, é só chamar!';
      default:
        return null;
    }
  }
}