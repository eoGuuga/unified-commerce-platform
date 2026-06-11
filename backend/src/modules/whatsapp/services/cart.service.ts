import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DbContextService } from '../../common/services/db-context.service';
import { In, LessThan, MoreThan } from 'typeorm';
import { WhatsAppCart, CartItem } from '../../../database/entities/WhatsappCart.entity';

export interface AddToCartInput {
  tenantId: string;
  customerPhone: string;
  produtoId: string;
  produtoName: string;
  quantity: number;
  unitPrice: number;
}

export interface UpdateCartItemInput {
  cartId: string;
  produtoId: string;
  quantity: number;
}

export interface ApplyCouponInput {
  cartId: string;
  couponCode: string;
}

export interface Cart extends WhatsAppCart {}

const DEFAULT_CART_TTL_MINUTES = 30;
const MAX_CART_ITEMS = 50;

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly db: DbContextService,
    private readonly config: ConfigService,
  ) {}

  private getCartTtlMinutes(): number {
    const raw = this.config.get<string>('WHATSAPP_CART_TTL_MINUTES') || '';
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CART_TTL_MINUTES;
  }

  private getDefaultShipping(): number {
    const raw = (this.config.get<string>('WHATSAPP_DEFAULT_SHIPPING_AMOUNT') || '').trim();
    if (!raw) return 10;
    const parsed = Number(raw.replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10;
  }

  private getRepository() {
    return this.db.getRepository(WhatsAppCart);
  }

  /**
   * Busca carrinho ativo para o cliente (NÃO cria se não existir)
   * Retorna null se não encontrar carrinho
   */
  async getCartByTenantAndPhone(tenantId: string, customerPhone: string): Promise<WhatsAppCart | null> {
    const repo = this.getRepository();

    // Primeiro, expirar carrinhos antigos
    await this.expireOldCarts(tenantId, customerPhone);

    // Buscar carrinho ativo
    const cart = await repo.findOne({
      where: {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        status: 'active',
      },
      order: { updated_at: 'DESC' },
    });

    return cart;
  }

  /**
   * Busca ou cria carrinho ativo para o cliente
   */
  async getOrCreateCart(tenantId: string, customerPhone: string): Promise<WhatsAppCart> {
    const repo = this.getRepository();

    // Primeiro, expirar carrinhos antigos
    await this.expireOldCarts(tenantId, customerPhone);

    // Buscar carrinho ativo
    let cart = await this.findActiveCart(tenantId, customerPhone);

    if (!cart) {
      // Criar novo carrinho
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.getCartTtlMinutes() * 60 * 1000);

      const newCart = new WhatsAppCart();
      newCart.tenant_id = tenantId;
      newCart.customer_phone = customerPhone;
      newCart.items = [];
      newCart.subtotal = 0;
      newCart.discount_amount = 0;
      newCart.shipping_amount = this.getDefaultShipping();
      newCart.total_amount = this.getDefaultShipping();
      newCart.expires_at = expiresAt;
      newCart.status = 'active';

      cart = await repo.save(newCart);
      this.logger.log(`Created new cart ${cart.id} for ${customerPhone}`);
    }

    return cart;
  }

  /**
   * Adiciona item ao carrinho
   */
  async addItem(input: AddToCartInput): Promise<WhatsAppCart> {
    const cart = await this.getOrCreateCart(input.tenantId, input.customerPhone);

    // Verificar limite de itens
    if (cart.items.length >= MAX_CART_ITEMS) {
      throw new Error(`Carrinho cheio! Máximo de ${MAX_CART_ITEMS} itens por carrinho.`);
    }

    // Verificar se item já existe
    const existingItem = cart.items.find((i: CartItem) => i.produto_id === input.produtoId);

    if (existingItem) {
      // Atualizar quantidade
      existingItem.quantity += input.quantity;
    } else {
      // Adicionar novo item
      cart.items.push({
        produto_id: input.produtoId,
        produto_name: input.produtoName,
        quantity: input.quantity,
        unit_price: input.unitPrice,
      });
    }

    // Recalcular totais
    this.recalculateTotals(cart);

    // Salvar
    await this.getRepository().save(cart);

    this.logger.log(`Added item ${input.produtoName} to cart ${cart.id}`, {
      quantity: input.quantity,
      total: Number(cart.total_amount),
    });

    return cart;
  }

  /**
   * Atualiza quantidade de um item
   */
  async updateItem(cartId: string, produtoId: string, quantity: number): Promise<WhatsAppCart> {
    const cart = await this.getCartById(cartId);

    if (!cart) {
      throw new Error('Carrinho não encontrado');
    }

    const item = cart.items.find((i: CartItem) => i.produto_id === produtoId);

    if (!item) {
      throw new Error('Item não encontrado no carrinho');
    }

    if (quantity <= 0) {
      // Remover item
      cart.items = cart.items.filter((i: CartItem) => i.produto_id !== produtoId);
    } else {
      item.quantity = quantity;
    }

    this.recalculateTotals(cart);
    await this.getRepository().save(cart);

    return cart;
  }

  /**
   * Remove item do carrinho
   */
  async removeItem(cartId: string, produtoId: string): Promise<WhatsAppCart> {
    const cart = await this.getCartById(cartId);

    if (!cart) {
      throw new Error('Carrinho não encontrado');
    }

    cart.items = cart.items.filter((i: CartItem) => i.produto_id !== produtoId);

    if (cart.items.length === 0) {
      cart.status = 'abandoned';
      await this.getRepository().save(cart);
      return cart;
    }

    this.recalculateTotals(cart);
    await this.getRepository().save(cart);

    return cart;
  }

  /**
   * Limpa carrinho (remove todos os itens)
   */
  async clearCart(cartId: string): Promise<WhatsAppCart> {
    const cart = await this.getCartById(cartId);

    if (!cart) {
      throw new Error('Carrinho não encontrado');
    }

    cart.items = [];
    cart.subtotal = 0;
    cart.discount_amount = 0;
    cart.total_amount = 0;
    cart.status = 'abandoned';

    await this.getRepository().save(cart);

    return cart;
  }

  /**
   * Aplica cupom de desconto
   */
  async applyCoupon(input: ApplyCouponInput): Promise<WhatsAppCart> {
    const cart = await this.getCartById(input.cartId);

    if (!cart) {
      throw new Error('Carrinho não encontrado');
    }

    // TODO: Validar cupom no CouponsService
    // Por enquanto, apenas armazena o código
    cart.coupon_code = input.couponCode;

    await this.getRepository().save(cart);

    return cart;
  }

  /**
   * Remove cupom
   */
  async removeCoupon(cartId: string): Promise<WhatsAppCart> {
    const cart = await this.getCartById(cartId);

    if (!cart) {
      throw new Error('Carrinho não encontrado');
    }

    cart.coupon_code = undefined;
    cart.discount_amount = 0;

    this.recalculateTotals(cart);
    await this.getRepository().save(cart);

    return cart;
  }

  /**
   * Marca carrinho como convertido (pedido criado)
   */
  async markAsConverted(cartId: string): Promise<void> {
    const cart = await this.getCartById(cartId);

    if (cart) {
      cart.status = 'converted';
      await this.getRepository().save(cart);
      this.logger.log(`Cart ${cartId} converted to order`);
    }
  }

  /**
   * Busca carrinho por ID
   */
  async getCartById(cartId: string): Promise<WhatsAppCart | null> {
    return await this.getRepository().findOne({ where: { id: cartId } });
  }

  /**
   * Estende TTL do carrinho
   */
  async extendTtl(cartId: string, minutes?: number): Promise<void> {
    const cart = await this.getCartById(cartId);

    if (cart) {
      const ttl = minutes || this.getCartTtlMinutes();
      cart.expires_at = new Date(Date.now() + ttl * 60 * 1000);
      await this.getRepository().save(cart);
    }
  }

  /**
   * Gera resumo do carrinho para exibição no WhatsApp
   */
  generateSummary(cart: WhatsAppCart): string {
    if (cart.items.length === 0) {
      return '🛒 Carrinho vazio';
    }

    const lines: string[] = ['🛒 *Seu Carrinho:*', ''];

    cart.items.forEach((item: CartItem, index: number) => {
      const itemTotal = item.quantity * item.unit_price;
      lines.push(`${index + 1}. ${item.produto_name}`);
      lines.push(`   Qtd: ${item.quantity} × R$ ${item.unit_price.toFixed(2)} = R$ ${itemTotal.toFixed(2)}`);
    });

    lines.push('');
    lines.push(`📦 Subtotal: R$ ${Number(cart.subtotal).toFixed(2)}`);

    if (cart.coupon_code) {
      lines.push(`🎟️ Cupom: ${cart.coupon_code} (-R$ ${Number(cart.discount_amount).toFixed(2)})`);
    }

    lines.push(`🚚 Frete: R$ ${Number(cart.shipping_amount).toFixed(2)}`);
    lines.push('');
    lines.push(`💰 *TOTAL: R$ ${Number(cart.total_amount).toFixed(2)}*`);

    lines.push('');
    lines.push('Comandos:');
    lines.push('• "remover [nome]" - remover item');
    lines.push('• "quantidade [nome] [qtd]" - alterar quantidade');
    lines.push('• "limpar" - esvaziar carrinho');
    lines.push('• "confirmar" - confirmar pedido');

    return lines.join('\n');
  }

  // ============== MÉTODOS PRIVADOS ==============

  private async findActiveCart(tenantId: string, customerPhone: string): Promise<WhatsAppCart | null> {
    const now = new Date();

    return await this.getRepository().findOne({
      where: {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        status: 'active' as any,
        expires_at: MoreThan(now) as any,
      },
      order: { created_at: 'DESC' },
    });
  }

  private async expireOldCarts(tenantId: string, customerPhone: string): Promise<void> {
    const now = new Date();

    await this.getRepository().update(
      {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        status: 'active' as any,
        expires_at: LessThan(now) as any,
      },
      { status: 'expired' as any },
    );
  }

  private recalculateTotals(cart: WhatsAppCart): void {
    // Calcular subtotal
    cart.subtotal = cart.items.reduce(
      (sum: number, item: CartItem) => sum + item.quantity * item.unit_price,
      0,
    );

    // TODO: Validar e aplicar cupom
    // Por enquanto, desconto é 0
    cart.discount_amount = 0;

    // Calcular total
    cart.total_amount = cart.subtotal - Number(cart.discount_amount) + Number(cart.shipping_amount);

    // Atualizar timestamps
    cart.updated_at = new Date();

    // Estender TTL
    const ttl = this.getCartTtlMinutes();
    cart.expires_at = new Date(Date.now() + ttl * 60 * 1000);
  }

  private generateId(): string {
    return `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}