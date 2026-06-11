import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Intent types for WhatsApp messages
 */
export enum IntentType {
  // Product intents
  VIEW_CATALOG = 'VIEW_CATALOG',
  PRODUCT_DETAILS = 'PRODUCT_DETAILS',
  ADD_TO_CART = 'ADD_TO_CART',

  // Cart intents
  VIEW_CART = 'VIEW_CART',
  UPDATE_CART = 'UPDATE_CART',
  REMOVE_FROM_CART = 'REMOVE_FROM_CART',
  CLEAR_CART = 'CLEAR_CART',

  // Order intents
  CHECKOUT = 'CHECKOUT',
  PAYMENT = 'PAYMENT',
  CONFIRM_ORDER = 'CONFIRM_ORDER',
  VIEW_ORDERS = 'VIEW_ORDERS',

  // Support intents
  HELP = 'HELP',
  TALK_TO_HUMAN = 'TALK_TO_HUMAN',
  COMPLAIN = 'COMPLAIN',

  // General intents
  START = 'START',
  GREETING = 'GREETING',
  GOODBYE = 'GOODBYE',
  CONFIRMATION_YES = 'CONFIRMATION_YES',
  CONFIRMATION_NO = 'CONFIRMATION_NO',
  UNKNOWN = 'UNKNOWN',
}

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  entities: IntentEntities;
  rawText: string;
  processedText: string;
}

export interface IntentEntities {
  productId?: string;
  productName?: string;
  quantity?: number;
  couponCode?: string;
  phoneNumber?: string;
  orderId?: string;
}

/**
 * NLP Service for WhatsApp message classification
 *
 * Features:
 * - Intent classification using keyword matching
 * - Entity extraction (products, quantities, etc.)
 * - Confidence scoring
 * - Multi-language support (Portuguese)
 */
@Injectable()
export class NLPService {
  private readonly logger = new Logger(NLPService.name);

  // Intent patterns for Portuguese
  private readonly intentPatterns: Record<IntentType, string[]> = {
    [IntentType.VIEW_CATALOG]: [
      'ver produtos', 'ver cardápio', 'ver cardapio', 'ver catálogo', 'ver catalogo',
      'produtos', 'cardápio', 'cardapio', 'cardápio', 'menu', 'catálogo', 'catalogo',
      'tenho fome', 'quero ver', 'mostre', 'o que tem', 'quais produtos',
      'navegar', 'explorar', 'ver loja', 'loja',
    ],
    [IntentType.PRODUCT_DETAILS]: [
      'detalhes', 'info', 'informações', 'informacoes', 'sobre o produto',
      'mais info', 'mais detalhes', 'especificações', 'especificacoes',
    ],
    [IntentType.ADD_TO_CART]: [
      'adicionar', 'colocar', 'quero esse', 'quero este', 'comprar',
      'incluir', 'add', 'pedir', 'quero pedir', 'levar',
    ],
    [IntentType.VIEW_CART]: [
      'ver carrinho', 'meu carrinho', 'carrinho', 'tenho no carrinho',
      'o que tenho', 'ver o que tenho', 'meus itens',
    ],
    [IntentType.UPDATE_CART]: [
      'alterar', 'mudar quantidade', 'trocar quantidade', 'mais um',
      'menos um', 'aumentar', 'diminuir', 'atualizar',
    ],
    [IntentType.REMOVE_FROM_CART]: [
      'remover', 'tirar', 'excluir', 'delete', 'não quero mais',
      'cancelar item', 'retirar do carrinho',
    ],
    [IntentType.CLEAR_CART]: [
      'esvaziar', 'limpar carrinho', 'zerar', 'remover tudo',
      'apagar carrinho', 'cancelar pedido',
    ],
    [IntentType.CHECKOUT]: [
      'finalizar', 'fechar pedido', 'confirmar', 'encerrar',
      'checkout', 'confirmar pedido', 'pedir agora', 'finalizar pedido',
    ],
    [IntentType.PAYMENT]: [
      'pagamento', 'pagar', 'forma de pagamento', 'pix', 'cartão', 'cartao',
      'boleto', 'transferência', 'transferencia',
    ],
    [IntentType.CONFIRM_ORDER]: [
      'confirmar pagamento', 'já paguei', 'efetuei pagamento', 'transferi',
      'enviei', 'confirmar pedido', 'aprovado',
    ],
    [IntentType.VIEW_ORDERS]: [
      'meus pedidos', 'pedidos', 'histórico', 'historico', 'último pedido',
      'pedidos anteriores', 'rastrear',
    ],
    [IntentType.HELP]: [
      'ajuda', 'help', 'como funciona', 'não sei', 'não entendi',
      'socorro', 'não consegui', 'dúvida', 'duvida', 'preciso de ajuda',
    ],
    [IntentType.TALK_TO_HUMAN]: [
      'atendente', 'humano', 'pessoa', 'vendedor', 'operador',
      'falar com alguém', 'falar com pessoa', 'atendimento',
    ],
    [IntentType.COMPLAIN]: [
      'reclamação', 'reclamacao', 'problema', 'erro', 'bug',
      'não funcionou', 'deu errado', 'insatisfeito',
    ],
    [IntentType.START]: [
      'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite',
      'hello', 'hi', 'hey',
    ],
    [IntentType.GREETING]: [
      'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite',
      'hello', 'hi', 'hey', 'como vai', 'tudo bem',
    ],
    [IntentType.GOODBYE]: [
      'tchau', 'adeus', 'até mais', 'ate mais', 'bye', 'obrigado', 'obrigada',
      'fim', 'encerrar',
    ],
    [IntentType.CONFIRMATION_YES]: [
      'sim', 'sim', 'confirmo', 'certo', 'ok', 'okay', 'de acordo',
      'entendido', 'já', 'sim please', 'pode ser',
    ],
    [IntentType.CONFIRMATION_NO]: [
      'não', 'nao', 'não preciso', 'cancela', 'desistir', 'não quero',
      'negativo', 'nope',
    ],
    [IntentType.UNKNOWN]: [],
  };

  constructor(
    private readonly config: ConfigService,
  ) {}

  /**
   * Process a message and extract intent + entities
   */
  async processMessage(message: string): Promise<IntentResult> {
    // Normalize message
    const normalizedMessage = this.normalizeMessage(message);
    const processedText = this.preprocessText(normalizedMessage);

    // Classify intent
    const intentResult = this.classifyIntent(processedText);

    // Extract entities
    const entities = this.extractEntities(normalizedMessage);

    return {
      ...intentResult,
      entities,
      rawText: message,
      processedText,
    };
  }

  /**
   * Classify intent from text
   */
  private classifyIntent(text: string): { intent: IntentType; confidence: number } {
    const lowerText = text.toLowerCase().trim();

    let bestMatch: { intent: IntentType; score: number } = {
      intent: IntentType.UNKNOWN,
      score: 0,
    };

    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      if (intent === IntentType.UNKNOWN) continue;

      const score = this.calculateMatchScore(lowerText, patterns);

      if (score > bestMatch.score) {
        bestMatch = { intent: intent as IntentType, score };
      }
    }

    // Apply minimum confidence threshold
    if (bestMatch.score < 0.2) {
      return { intent: IntentType.UNKNOWN, confidence: bestMatch.score };
    }

    return {
      intent: bestMatch.intent,
      confidence: Math.min(bestMatch.score, 1),
    };
  }

  /**
   * Calculate match score between text and patterns
   */
  private calculateMatchScore(text: string, patterns: string[]): number {
    let maxScore = 0;

    for (const pattern of patterns) {
      const patternLower = pattern.toLowerCase();

      // Exact match
      if (text === patternLower) {
        maxScore = Math.max(maxScore, 1.0);
      }
      // Contains pattern
      else if (text.includes(patternLower)) {
        const score = patternLower.length / text.length;
        maxScore = Math.max(maxScore, Math.min(score + 0.5, 0.9));
      }
      // Word overlap
      else {
        const textWords = text.split(/\s+/);
        const patternWords = patternLower.split(/\s+/);
        const overlap = patternWords.filter(w => textWords.includes(w)).length;
        if (overlap > 0) {
          const score = overlap / patternWords.length;
          maxScore = Math.max(maxScore, score * 0.7);
        }
      }
    }

    return maxScore;
  }

  /**
   * Extract entities from message
   */
  private extractEntities(text: string): IntentEntities {
    const entities: IntentEntities = {};

    // Extract quantity
    entities.quantity = this.extractQuantity(text);

    // Extract phone number
    entities.phoneNumber = this.extractPhoneNumber(text);

    // Extract coupon code
    entities.couponCode = this.extractCouponCode(text);

    // Extract product ID (could be a number like "produto 5")
    const productMatch = text.match(/produto\s*#?(\d+)/i);
    if (productMatch) {
      entities.productId = productMatch[1];
    }

    // Extract product name (words after "de" or similar)
    const nameMatch = text.match(/(?:de|do|da|chamado|nome)\s+['"]?([^'"\n]+?)['"]?(?:\s|$|\?|!)/i);
    if (nameMatch) {
      entities.productName = nameMatch[1].trim();
    }

    // Extract order ID
    const orderMatch = text.match(/pedido\s*#?(\d+)/i);
    if (orderMatch) {
      entities.orderId = orderMatch[1];
    }

    return entities;
  }

  /**
   * Extract quantity from text
   */
  private extractQuantity(text: string): number | undefined {
    // Portuguese number words
    const numberWords: Record<string, number> = {
      'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'três': 3, 'tres': 3,
      'quatro': 4, 'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8,
      'nove': 9, 'dez': 10,
    };

    // Check for word numbers
    const words = text.split(/\s+/);
    for (const word of words) {
      const lowerWord = word.toLowerCase().replace(/[.,]/g, '');
      if (numberWords[lowerWord]) {
        return numberWords[lowerWord];
      }
    }

    // Check for digit numbers
    const digitMatch = text.match(/(\d+)/);
    if (digitMatch) {
      const num = parseInt(digitMatch[1], 10);
      if (num > 0 && num <= 100) {
        return num;
      }
    }

    // Check for quantity indicators
    if (text.includes('meia') || text.includes('meio')) {
      return 0.5 as unknown as number;
    }

    return undefined;
  }

  /**
   * Extract phone number from text
   */
  private extractPhoneNumber(text: string): string | undefined {
    // Match Brazilian phone format
    const phoneMatch = text.match(/(?:\+55\s?)?(?:\(?\d{2}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}/);
    if (phoneMatch) {
      return phoneMatch[0].replace(/\D/g, '');
    }
    return undefined;
  }

  /**
   * Extract coupon code
   */
  private extractCouponCode(text: string): string | undefined {
    // Match common coupon patterns
    const couponMatch = text.match(/(?:cupom|código|codigo|coupon)[:\s]*([A-Z0-9]{4,10})/i);
    if (couponMatch) {
      return couponMatch[1].toUpperCase();
    }

    // Check for standalone coupon codes (like DESCONTO10)
    const standaloneMatch = text.match(/\b([A-Z]{3,8}\d{2,6})\b/);
    if (standaloneMatch) {
      return standaloneMatch[1].toUpperCase();
    }

    return undefined;
  }

  /**
   * Normalize message (lowercase, remove extra spaces)
   */
  private normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // Remove accents
      .replace(/[^\w\sáéíóúàèìòùãẽĩõũç]/gi, ' ') // Keep only letters, numbers, spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Preprocess text for better matching
   */
  private preprocessText(text: string): string {
    // Common replacements
    const replacements: Record<string, string> = {
      'vc': 'voce',
      'tb': 'tambem',
      'pq': 'porque',
      'msm': 'mesmo',
      'td': 'tudo',
      'agr': 'agora',
      'flw': 'falou',
    };

    let processed = text;
    for (const [abbr, full] of Object.entries(replacements)) {
      processed = processed.replace(new RegExp(`\\b${abbr}\\b`, 'g'), full);
    }

    return processed;
  }

  /**
   * Get response suggestion based on intent
   */
  getResponseSuggestion(intent: IntentType, entities: IntentEntities): string {
    switch (intent) {
      case IntentType.VIEW_CATALOG:
        return 'Aqui está nosso catálogo de produtos! 🛍️';

      case IntentType.ADD_TO_CART:
        if (entities.productId) {
          return `Adicionando produto #${entities.productId} ao carrinho...`;
        }
        return 'Qual produto você gostaria de adicionar?';

      case IntentType.VIEW_CART:
        return 'Aqui está seu carrinho atual:';

      case IntentType.CHECKOUT:
        return 'Vamos finalizar seu pedido!';

      case IntentType.PAYMENT:
        return 'Aqui estão as opções de pagamento:';

      case IntentType.HELP:
        return 'Posso ajudar! Veja o que posso fazer:';

      case IntentType.TALK_TO_HUMAN:
        return 'Vou conectá-lo com um de nossos atendentes...';

      case IntentType.GREETING:
        return 'Olá! 👋 Bem-vindo(a) à nossa loja! Como posso ajudar?';

      case IntentType.GOODBYE:
        return 'Obrigado pela visita! Volte sempre! 👋';

      case IntentType.UNKNOWN:
        return 'Desculpe, não entendi. Poderia reformular?';

      default:
        return 'Entendido! Como posso ajudar?';
    }
  }

  /**
   * Check if intent requires human intervention
   */
  requiresHumanIntervention(intent: IntentType): boolean {
    return [
      IntentType.TALK_TO_HUMAN,
      IntentType.COMPLAIN,
    ].includes(intent);
  }

  /**
   * Check if intent is related to checkout flow
   */
  isCheckoutIntent(intent: IntentType): boolean {
    return [
      IntentType.CHECKOUT,
      IntentType.PAYMENT,
      IntentType.CONFIRM_ORDER,
    ].includes(intent);
  }
}