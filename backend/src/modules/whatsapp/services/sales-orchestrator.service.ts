import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CartService } from './cart.service';
import { CatalogManagerService } from './catalog-manager.service';
import { NLPService, IntentType } from './nlp.service';
import { ProductsService } from '../../products/products.service';
import { OrdersService } from '../../orders/orders.service';

/**
 * Sales Orchestrator - Coordinates the complete sales flow
 *
 * Responsibilities:
 * - Orchestrates the entire sales conversation flow
 * - Validates stock availability before adding to cart
 * - Coordinates between cart, catalog, and orders
 * - Handles checkout flow with payment integration
 * - Manages order confirmation and tracking
 */
export interface SalesContext {
  tenantId: string;
  customerPhone: string;
  customerName?: string;
  currentIntent?: IntentType;
  conversationHistory: SalesMessage[];
  cartId?: string;
  orderId?: string;
}

export interface SalesMessage {
  role: 'user' | 'bot' | 'system';
  content: string;
  timestamp: Date;
  intent?: IntentType;
}

export interface SalesResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  nextAction?: SalesAction;
  requiresConfirmation?: boolean;
}

export enum SalesAction {
  SHOW_CATALOG = 'SHOW_CATALOG',
  ADD_TO_CART = 'ADD_TO_CART',
  VIEW_CART = 'VIEW_CART',
  UPDATE_CART = 'UPDATE_CART',
  REMOVE_FROM_CART = 'REMOVE_FROM_CART',
  CLEAR_CART = 'CLEAR_CART',
  CHECKOUT = 'CHECKOUT',
  PAYMENT = 'PAYMENT',
  CONFIRM_ORDER = 'CONFIRM_ORDER',
  SHOW_PRODUCT_DETAILS = 'SHOW_PRODUCT_DETAILS',
  ASK_QUANTITY = 'ASK_QUANTITY',
  CONFIRM_WITH_USER = 'CONFIRM_WITH_USER',
  TRANSFER_TO_HUMAN = 'TRANSFER_TO_HUMAN',
  VIEW_ORDERS = 'VIEW_ORDERS',
  FINISH = 'FINISH',
  HELP = 'HELP',
}

@Injectable()
export class SalesOrchestratorService {
  private readonly logger = new Logger(SalesOrchestratorService.name);

  constructor(
    private readonly cartService: CartService,
    private readonly catalogManager: CatalogManagerService,
    private readonly nlpService: NLPService,
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Process a user message and orchestrate the sales flow
   */
  async processMessage(
    context: SalesContext,
    message: string,
  ): Promise<SalesResult> {
    // 1. Classify intent
    const intentResult = await this.nlpService.processMessage(message);

    this.logger.log(
      `Intent classified: ${intentResult.intent} (${intentResult.confidence})`,
    );

    // 2. Check if human intervention is needed
    if (this.nlpService.requiresHumanIntervention(intentResult.intent)) {
      return this.handleHumanIntervention(context, intentResult.intent);
    }

    // 3. Route to appropriate handler
    context.currentIntent = intentResult.intent;

    switch (intentResult.intent) {
      case IntentType.VIEW_CATALOG:
        return this.handleViewCatalog(context);

      case IntentType.PRODUCT_DETAILS:
        return this.handleProductDetails(context, intentResult.entities);

      case IntentType.ADD_TO_CART:
        return this.handleAddToCart(context, intentResult.entities);

      case IntentType.VIEW_CART:
        return this.handleViewCart(context);

      case IntentType.UPDATE_CART:
        return this.handleUpdateCart(context, intentResult.entities);

      case IntentType.REMOVE_FROM_CART:
        return this.handleRemoveFromCart(context, intentResult.entities);

      case IntentType.CLEAR_CART:
        return this.handleClearCart(context);

      case IntentType.CHECKOUT:
        return this.handleCheckout(context);

      case IntentType.PAYMENT:
        return this.handlePayment(context);

      case IntentType.CONFIRM_ORDER:
        return this.handleConfirmOrder(context, intentResult.entities);

      case IntentType.VIEW_ORDERS:
        return this.handleViewOrders(context);

      case IntentType.GREETING:
        return this.handleGreeting(context);

      case IntentType.GOODBYE:
        return this.handleGoodbye(context);

      case IntentType.CONFIRMATION_YES:
        return this.handleConfirmation(context, true);

      case IntentType.CONFIRMATION_NO:
        return this.handleConfirmation(context, false);

      case IntentType.HELP:
        return this.handleHelp(context);

      default:
        return this.handleUnknown(context, message);
    }
  }

  /**
   * Start a new sales conversation
   */
  async startConversation(
    tenantId: string,
    customerPhone: string,
    customerName?: string,
  ): Promise<SalesContext> {
    return {
      tenantId,
      customerPhone,
      customerName,
      conversationHistory: [
        {
          role: 'bot',
          content: this.nlpService.getResponseSuggestion(IntentType.GREETING, {}),
          timestamp: new Date(),
          intent: IntentType.GREETING,
        },
      ],
    };
  }

  /**
   * Handle view catalog request
   */
  private async handleViewCatalog(context: SalesContext): Promise<SalesResult> {
    try {
      const products = await this.catalogManager.getCatalogProducts(
        context.tenantId,
      );

      if (products.length === 0) {
        return {
          success: false,
          message: 'Não encontramos produtos disponíveis no momento.',
          nextAction: SalesAction.SHOW_CATALOG,
        };
      }

      const formattedProducts = products.slice(0, 10)
        .map((p: any, i: number) => `${i + 1}. ${p.name} - R$ ${Number(p.price).toFixed(2)}`)
        .join('\n');

      return {
        success: true,
        message: `Aqui está nosso catálogo:\n\n${formattedProducts}\n\nDigite o número do produto para adicionar ao carrinho.`,
        data: { products },
        nextAction: SalesAction.ADD_TO_CART,
      };
    } catch (error) {
      this.logger.error('Error fetching catalog', error);
      return {
        success: false,
        message: 'Erro ao buscar catálogo. Tente novamente.',
        nextAction: SalesAction.SHOW_CATALOG,
      };
    }
  }

  /**
   * Handle product details request
   */
  private async handleProductDetails(
    context: SalesContext,
    entities: { productId?: string; productName?: string },
  ): Promise<SalesResult> {
    try {
      let product;

      if (entities.productId) {
        product = await this.productsService.findOne(entities.productId, context.tenantId);
      } else if (entities.productName) {
        const products = await this.catalogManager.searchProducts(
          context.tenantId,
          entities.productName,
        );
        product = products[0];
      }

      if (!product) {
        return {
          success: false,
          message: 'Produto não encontrado.',
          nextAction: SalesAction.SHOW_CATALOG,
        };
      }

      return {
        success: true,
        message: `📦 *${product.name}*\n\n💰 Preço: R$ ${Number(product.price).toFixed(2)}\n\n${product.description || 'Sem descrição disponível.'}`,
        data: { product },
        nextAction: SalesAction.ADD_TO_CART,
      };
    } catch (error) {
      this.logger.error('Error fetching product details', error);
      return {
        success: false,
        message: 'Erro ao buscar detalhes do produto.',
        nextAction: SalesAction.SHOW_CATALOG,
      };
    }
  }

  /**
   * Handle add to cart request with stock validation
   */
  private async handleAddToCart(
    context: SalesContext,
    entities: { productId?: string; productName?: string; quantity?: number },
  ): Promise<SalesResult> {
    // If no product specified, ask user
    if (!entities.productId && !entities.productName) {
      return {
        success: true,
        message: 'Qual produto você gostaria de adicionar ao carrinho?',
        nextAction: SalesAction.ASK_QUANTITY,
      };
    }

    try {
      // Find product
      let product: any;
      if (entities.productId) {
        product = await this.productsService.findOne(entities.productId, context.tenantId);
      } else {
        const products = await this.catalogManager.searchProducts(
          context.tenantId,
          entities.productName!,
        );
        product = products[0];
      }

      if (!product) {
        return {
          success: false,
          message: 'Produto não encontrado.',
          nextAction: SalesAction.SHOW_CATALOG,
        };
      }

      const requestedQty = entities.quantity || 1;

      // Add to cart
      await this.cartService.addItem({
        tenantId: context.tenantId,
        customerPhone: context.customerPhone,
        produtoId: product.id,
        produtoName: product.name,
        quantity: requestedQty,
        unitPrice: Number(product.price),
      });

      const cart = await this.cartService.getOrCreateCart(
        context.tenantId,
        context.customerPhone,
      );

      return {
        success: true,
        message: `✅ *${requestedQty}x ${product.name}* adicionado ao carrinho!\n\nSubtotal: R$ ${Number(cart.subtotal).toFixed(2)}\n\nDigite "ver carrinho" para finalizar o pedido.`,
        data: { cart, product },
        nextAction: SalesAction.VIEW_CART,
      };
    } catch (error) {
      this.logger.error('Error adding to cart', error);
      return {
        success: false,
        message: 'Erro ao adicionar produto ao carrinho.',
        nextAction: SalesAction.ADD_TO_CART,
      };
    }
  }

  /**
   * Handle view cart request
   */
  private async handleViewCart(context: SalesContext): Promise<SalesResult> {
    try {
      const cart = await this.cartService.getCartByTenantAndPhone(
        context.tenantId,
        context.customerPhone,
      );

      if (!cart || cart.items.length === 0) {
        return {
          success: true,
          message: 'Seu carrinho está vazio. 🤔\n\nDigite "ver produtos" para ver nosso catálogo.',
          nextAction: SalesAction.SHOW_CATALOG,
        };
      }

      const itemsList = cart.items
        .map((item: any, i: number) => `${i + 1}. ${item.produto_name} x${item.quantity} = R$ ${Number(item.subtotal).toFixed(2)}`)
        .join('\n');

      return {
        success: true,
        message: `🛒 *Seu Carrinho*\n\n${itemsList}\n\n___\nSubtotal: R$ ${cart.subtotal.toFixed(2)}\nFrete: R$ ${cart.shipping_amount.toFixed(2)}\nDesconto: R$ ${cart.discount_amount.toFixed(2)}\n*Total: R$ ${cart.total_amount.toFixed(2)}*\n\nDigite "finalizar" para continuar.`,
        data: { cart },
        nextAction: SalesAction.CHECKOUT,
      };
    } catch (error) {
      this.logger.error('Error viewing cart', error);
      return {
        success: false,
        message: 'Erro ao carregar carrinho.',
        nextAction: SalesAction.VIEW_CART,
      };
    }
  }

  /**
   * Handle update cart request
   */
  private async handleUpdateCart(
    context: SalesContext,
    entities: { productId?: string; quantity?: number },
  ): Promise<SalesResult> {
    if (!entities.productId || entities.quantity === undefined) {
      return {
        success: true,
        message: 'Informe o produto e a nova quantidade.',
        nextAction: SalesAction.UPDATE_CART,
      };
    }

    try {
      const cart = await this.cartService.getOrCreateCart(
        context.tenantId,
        context.customerPhone,
      );

      const updatedCart = await this.cartService.updateItem(
        cart.id,
        entities.productId,
        entities.quantity,
      );

      return {
        success: true,
        message: `✅ Carrinho atualizado!\n\nNovo total: R$ ${Number(updatedCart.total_amount).toFixed(2)}`,
        data: { cart: updatedCart },
        nextAction: SalesAction.VIEW_CART,
      };
    } catch (error) {
      this.logger.error('Error updating cart', error);
      return {
        success: false,
        message: 'Erro ao atualizar carrinho.',
        nextAction: SalesAction.UPDATE_CART,
      };
    }
  }

  /**
   * Handle remove from cart request
   */
  private async handleRemoveFromCart(
    context: SalesContext,
    entities: { productId?: string },
  ): Promise<SalesResult> {
    if (!entities.productId) {
      return {
        success: true,
        message: 'Informe o produto a ser removido.',
        nextAction: SalesAction.REMOVE_FROM_CART,
      };
    }

    try {
      const cart = await this.cartService.getOrCreateCart(
        context.tenantId,
        context.customerPhone,
      );

      const updatedCart = await this.cartService.removeItem(
        cart.id,
        entities.productId,
      );

      return {
        success: true,
        message: '✅ Produto removido do carrinho.',
        data: { cart: updatedCart },
        nextAction: SalesAction.VIEW_CART,
      };
    } catch (error) {
      this.logger.error('Error removing from cart', error);
      return {
        success: false,
        message: 'Erro ao remover produto.',
        nextAction: SalesAction.REMOVE_FROM_CART,
      };
    }
  }

  /**
   * Handle clear cart request
   */
  private async handleClearCart(context: SalesContext): Promise<SalesResult> {
    try {
      const cart = await this.cartService.getOrCreateCart(
        context.tenantId,
        context.customerPhone,
      );

      await this.cartService.clearCart(cart.id);

      return {
        success: true,
        message: '🗑️ Carrinho esvaziado!\n\nDigite "ver produtos" para continuar comprando.',
        nextAction: SalesAction.SHOW_CATALOG,
      };
    } catch (error) {
      this.logger.error('Error clearing cart', error);
      return {
        success: false,
        message: 'Erro ao limpar carrinho.',
        nextAction: SalesAction.CLEAR_CART,
      };
    }
  }

  /**
   * Handle checkout request
   */
  private async handleCheckout(context: SalesContext): Promise<SalesResult> {
    try {
      const cart = await this.cartService.getCartByTenantAndPhone(
        context.tenantId,
        context.customerPhone,
      );

      if (!cart || cart.items.length === 0) {
        return {
          success: false,
          message: 'Seu carrinho está vazio. Adicione produtos primeiro.',
          nextAction: SalesAction.SHOW_CATALOG,
        };
      }

      // Validate all items
      for (const item of cart.items) {
        const product = await this.productsService.findOne(item.produto_id, context.tenantId);
        if (!product) {
          return {
            success: false,
            message: `❌ Um dos produtos do carrinho não está mais disponível.\n\nPor favor, verifique seu carrinho.`,
            nextAction: SalesAction.VIEW_CART,
          };
        }
      }

      return {
        success: true,
        message: `📋 *Resumo do Pedido*\n\nTotal: R$ ${Number(cart.total_amount).toFixed(2)}\n\nConfirma o pedido? (sim/não)`,
        data: { cart },
        nextAction: SalesAction.CONFIRM_WITH_USER,
        requiresConfirmation: true,
      };
    } catch (error) {
      this.logger.error('Error during checkout', error);
      return {
        success: false,
        message: 'Erro ao processar checkout.',
        nextAction: SalesAction.CHECKOUT,
      };
    }
  }

  /**
   * Handle payment request
   */
  private async handlePayment(context: SalesContext): Promise<SalesResult> {
    // Payment methods
    const paymentMethods = `
💳 *Formas de Pagamento*

1️⃣ PIX (mais rápido)
2️⃣ Cartão de Crédito
3️⃣ Boleto Bancário

Qual prefere?`;

    return {
      success: true,
      message: paymentMethods,
      nextAction: SalesAction.PAYMENT,
    };
  }

  /**
   * Handle confirm order request
   */
  private async handleConfirmOrder(
    context: SalesContext,
    entities: { couponCode?: string },
  ): Promise<SalesResult> {
    try {
      const cart = await this.cartService.getOrCreateCart(
        context.tenantId,
        context.customerPhone,
      );

      // Create order
      const order = await this.ordersService.create(
        {
          channel: 'whatsapp' as any,
          customer_name: context.customerName,
          customer_phone: context.customerPhone,
          items: cart.items.map((item: any) => ({
            produto_id: item.produto_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
          shipping_amount: cart.shipping_amount,
          discount_amount: cart.discount_amount,
          coupon_code: entities.couponCode || cart.coupon_code,
        },
        context.tenantId,
      );

      context.orderId = order.id;

      return {
        success: true,
        message: `✅ *Pedido #${order.id} criado!*\n\nTotal: R$ ${Number(order.total_amount).toFixed(2)}\n\nAguarde o link de pagamento...`,
        data: { order },
        nextAction: SalesAction.PAYMENT,
      };
    } catch (error) {
      this.logger.error('Error confirming order', error);
      return {
        success: false,
        message: 'Erro ao confirmar pedido.',
        nextAction: SalesAction.CONFIRM_ORDER,
      };
    }
  }

  /**
   * Handle view orders request
   */
  private async handleViewOrders(context: SalesContext): Promise<SalesResult> {
    try {
      const latestOrder = await this.ordersService.findLatestByCustomerPhone(
        context.tenantId,
        context.customerPhone,
      );

      if (!latestOrder) {
        return {
          success: true,
          message: 'Você ainda não fez nenhum pedido.',
          nextAction: SalesAction.SHOW_CATALOG,
        };
      }

      const orderInfo = `Pedido #${latestOrder.id} - R$ ${Number(latestOrder.total_amount).toFixed(2)} - ${latestOrder.status}`;

      return {
        success: true,
        message: `📦 *Seu Último Pedido*\n\n${orderInfo}`,
        data: { order: latestOrder },
        nextAction: SalesAction.FINISH,
      };
    } catch (error) {
      this.logger.error('Error fetching orders', error);
      return {
        success: false,
        message: 'Erro ao buscar pedidos.',
        nextAction: SalesAction.VIEW_ORDERS,
      };
    }
  }

  /**
   * Handle greeting
   */
  private handleGreeting(context: SalesContext): SalesResult {
    return {
      success: true,
      message: `Olá${context.customerName ? `, ${context.customerName}` : ''}! 👋\n\nBem-vindo à nossa loja!\n\nDigite "ver produtos" para ver o catálogo ou "ajuda" para saber mais.`,
      nextAction: SalesAction.SHOW_CATALOG,
    };
  }

  /**
   * Handle goodbye
   */
  private handleGoodbye(context: SalesContext): SalesResult {
    return {
      success: true,
      message: 'Obrigado pela visita! Volte sempre! 👋',
      nextAction: SalesAction.FINISH,
    };
  }

  /**
   * Handle user confirmation
   */
  private async handleConfirmation(
    context: SalesContext,
    confirmed: boolean,
  ): Promise<SalesResult> {
    if (!confirmed) {
      return {
        success: true,
        message: 'Sem problema! Posso ajudar com algo mais?',
        nextAction: SalesAction.SHOW_CATALOG,
      };
    }

    // Continue with last action
    if (context.currentIntent === IntentType.CHECKOUT) {
      return this.handleConfirmOrder(context, {});
    }

    return {
      success: true,
      message: 'Confirmado!',
      nextAction: SalesAction.VIEW_CART,
    };
  }

  /**
   * Handle help request
   */
  private handleHelp(context: SalesContext): SalesResult {
    return {
      success: true,
      message: `📚 *Como posso ajudar?*\n\nComandos disponíveis:\n\n🛍️ *Produtos*\n• "ver produtos" - Ver catálogo\n• "detalhes [produto]" - Ver info do produto\n\n🛒 *Carrinho*\n• "adicionar [produto]" - Adicionar ao carrinho\n• "ver carrinho" - Ver seu carrinho\n• "remover [produto]" - Remover item\n\n💳 *Pedidos*\n• "finalizar" - Finalizar compra\n• "meus pedidos" - Ver histórico\n\n❓ *Outros*\n• "ajuda" - Mostrar ajuda\n• "atendente" - Falar com humano`,
      nextAction: SalesAction.FINISH,
    };
  }

  /**
   * Handle human intervention request
   */
  private handleHumanIntervention(
    context: SalesContext,
    intent: IntentType,
  ): SalesResult {
    let message: string;

    if (intent === IntentType.TALK_TO_HUMAN) {
      message =
        '👤 Vou conectá-lo com um de nossos atendentes.\n\nPor favor, aguarde um momento...';
    } else if (intent === IntentType.COMPLAIN) {
      message =
        '😔 Lamentamos pelo problema. Vou conectá-lo com nossa equipe para ajudá-lo melhor.';
    } else {
      message = '👤 Vou transferi-lo para um atendente.';
    }

    return {
      success: true,
      message,
      nextAction: SalesAction.TRANSFER_TO_HUMAN,
    };
  }

  /**
   * Handle unknown intent
   */
  private async handleUnknown(
    context: SalesContext,
    message: string,
  ): Promise<SalesResult> {
    // Try to extract product name and add to cart
    const entities = await this.nlpService.processMessage(message);

    if (entities.intent === IntentType.ADD_TO_CART) {
      return this.handleAddToCart(context, entities.entities);
    }

    return {
      success: false,
      message:
        'Desculpe, não entendi. 🤔\n\nDigite "ajuda" para ver os comandos disponíveis.',
      nextAction: SalesAction.HELP,
    };
  }
}