import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, LessThan, MoreThan, Repository } from 'typeorm';
import { WhatsAppCart, CartItem } from '../../../database/entities/WhatsappCart.entity';
import { StockEngineService } from '../../products/stock-engine.service';
import { DbContextService } from '../../common/services/db-context.service';
import { maskPhone } from '../../../common/utils/mask.util';

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
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly stockEngine: StockEngineService,
    private readonly dbContext: DbContextService,
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

  /**
   * Repositorio de carrinho no contexto RLS ATUAL (via interceptor/ALS).
   * Usado por leituras que so tem o cartId e rodam dentro de um request
   * (o contexto de tenant ja esta setado). Fora de request retorna vazio — por
   * isso escritas e leituras com tenantId conhecido usam withCart().
   */
  private getCartRepo(): Repository<WhatsAppCart> {
    return this.dbContext.getManager().getRepository(WhatsAppCart);
  }

  /**
   * Roda fn numa transacao propria (commit imediato) com o contexto RLS do
   * tenant setado — necessario porque whatsapp_carts tem FORCE RLS. Funciona
   * tanto em request quanto em job de fundo (o chamador informa o tenantId).
   */
  private async withCart<T>(
    tenantId: string,
    fn: (repo: Repository<WhatsAppCart>) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      return fn(manager.getRepository(WhatsAppCart));
    });
  }

  /** Salva o carrinho no contexto RLS do proprio tenant. */
  private saveCart(cart: WhatsAppCart): Promise<WhatsAppCart> {
    return this.withCart(cart.tenant_id, (repo) => repo.save(cart));
  }

  /**
   * Busca carrinho ativo para o cliente (NÃO cria se não existir)
   * Retorna null se não encontrar carrinho
   */
  async getCartByTenantAndPhone(tenantId: string, customerPhone: string): Promise<WhatsAppCart | null> {
    // Primeiro, expirar carrinhos antigos
    await this.expireOldCarts(tenantId, customerPhone);

    // Buscar carrinho ativo (no contexto RLS do tenant)
    return this.withCart(tenantId, (repo) =>
      repo.findOne({
        where: {
          tenant_id: tenantId,
          customer_phone: customerPhone,
          status: 'active',
        },
        order: { updated_at: 'DESC' },
      }),
    );
  }

  /**
   * Busca ou cria carrinho ativo para o cliente
   */
  async getOrCreateCart(tenantId: string, customerPhone: string): Promise<WhatsAppCart> {
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

      cart = await this.saveCart(newCart);
      this.logger.log(`Carrinho ${cart.id} criado para ${maskPhone(customerPhone)}`);
    }

    return cart;
  }

  /**
   * Adiciona item ao carrinho e reserva estoque atomicamente.
   * Se não houver estoque suficiente, lança exceção e o item NÃO é adicionado.
   */
  async addItem(input: AddToCartInput): Promise<WhatsAppCart> {
    const cart = await this.getOrCreateCart(input.tenantId, input.customerPhone);

    // Verificar limite de itens
    if (cart.items.length >= MAX_CART_ITEMS) {
      throw new Error(`Carrinho cheio! Máximo de ${MAX_CART_ITEMS} itens por carrinho.`);
    }

    // Calcular delta (quantidade adicionada)
    const existingItem = cart.items.find((i: CartItem) => i.produto_id === input.produtoId);
    const deltaQty = input.quantity; // sempre reserva apenas o delta adicionado

    // Reservar o delta no estoque — se lançar (insuficiente), propaga sem alterar o carrinho
    await this.dataSource.transaction(async (manager) => {
      // Contexto RLS tenant para a tabela movimentacoes_estoque
      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [input.tenantId]);
      await this.stockEngine.reserve(manager, input.tenantId, input.produtoId, deltaQty);
    });

    // Só chega aqui se a reserva foi bem-sucedida — atualiza o carrinho em memória
    if (existingItem) {
      existingItem.quantity += input.quantity;
    } else {
      cart.items.push({
        produto_id: input.produtoId,
        produto_name: input.produtoName,
        quantity: input.quantity,
        unit_price: input.unitPrice,
      });
    }

    // Recalcular totais e salvar
    this.recalculateTotals(cart);
    await this.saveCart(cart);

    this.logger.log(`Item ${input.produtoName} adicionado ao carrinho ${cart.id}`, {
      quantity: input.quantity,
      total: Number(cart.total_amount),
    });

    return cart;
  }

  /**
   * Atualiza quantidade de um item, reservando ou liberando o delta de estoque
   * atomicamente. Se delta > 0 e reserve lançar (estoque insuficiente), propaga
   * sem alterar o carrinho. Se delta < 0, libera o excedente de reserva.
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

    const oldQty = item.quantity;

    if (quantity <= 0) {
      // Remoção: liberar toda a reserva do item antes de remover do carrinho
      await this.dataSource.transaction(async (manager) => {
        await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [cart.tenant_id]);
        await this.stockEngine.release(manager, cart.tenant_id, produtoId, oldQty);
      });
      cart.items = cart.items.filter((i: CartItem) => i.produto_id !== produtoId);
    } else {
      const delta = quantity - oldQty;
      if (delta > 0) {
        // Nova quantidade maior: reservar o delta adicional.
        // Se lançar (estoque insuficiente), propaga sem alterar o carrinho.
        await this.dataSource.transaction(async (manager) => {
          await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [cart.tenant_id]);
          await this.stockEngine.reserve(manager, cart.tenant_id, produtoId, delta);
        });
      } else if (delta < 0) {
        // Nova quantidade menor: liberar o delta reduzido.
        await this.dataSource.transaction(async (manager) => {
          await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [cart.tenant_id]);
          await this.stockEngine.release(manager, cart.tenant_id, produtoId, -delta);
        });
      }
      // delta === 0: sem operação de estoque
      item.quantity = quantity;
    }

    this.recalculateTotals(cart);
    await this.saveCart(cart);

    return cart;
  }

  /**
   * Remove item do carrinho e libera a reserva de estoque correspondente.
   */
  async removeItem(cartId: string, produtoId: string): Promise<WhatsAppCart> {
    const cart = await this.getCartById(cartId);

    if (!cart) {
      throw new Error('Carrinho não encontrado');
    }

    // Encontrar o item a remover para calcular quanto liberar
    const itemRemovido = cart.items.find((i: CartItem) => i.produto_id === produtoId);

    // Liberar reserva do item removido (se o carrinho estiver ativo e tiver reserva)
    if (itemRemovido && cart.status === 'active') {
      await this.dataSource.transaction(async (manager) => {
        await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [cart.tenant_id]);
        await this.stockEngine.release(manager, cart.tenant_id, produtoId, itemRemovido.quantity);
      });
    }

    cart.items = cart.items.filter((i: CartItem) => i.produto_id !== produtoId);

    if (cart.items.length === 0) {
      cart.status = 'abandoned';
      cart.stock_released_at = new Date();
      await this.saveCart(cart);
      return cart;
    }

    this.recalculateTotals(cart);
    await this.saveCart(cart);

    return cart;
  }

  /**
   * Limpa carrinho (remove todos os itens) e libera todas as reservas de estoque.
   */
  async clearCart(cartId: string): Promise<WhatsAppCart> {
    const cart = await this.getCartById(cartId);

    if (!cart) {
      throw new Error('Carrinho não encontrado');
    }

    // Liberar reservas de todos os itens (somente se ainda ativo e não liberado)
    if (cart.status === 'active' && cart.items.length > 0 && !cart.stock_released_at) {
      await this.dataSource.transaction(async (manager) => {
        await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [cart.tenant_id]);
        for (const item of cart.items) {
          await this.stockEngine.release(manager, cart.tenant_id, item.produto_id, item.quantity);
        }
      });
    }

    cart.items = [];
    cart.subtotal = 0;
    cart.discount_amount = 0;
    cart.total_amount = 0;
    cart.status = 'abandoned';
    cart.stock_released_at = cart.stock_released_at ?? new Date();

    await this.saveCart(cart);

    return cart;
  }

  /**
   * Libera as reservas de um carrinho expirado de forma idempotente.
   * Usa compare-and-set atômico: só o actor que vira o status='expired'
   * com stock_released_at=now() de fato libera as reservas.
   * Usado tanto pelo fast-path de expireOldCarts quanto pelo sweeper (Task 7).
   */
  async releaseExpiredCart(cartId: string, tenantId: string): Promise<void> {
    // Atomic compare-and-set dentro de transação com RLS configurado:
    // só afeta carrinhos active sem stock_released_at. O tenantId vem do
    // chamador (sweeper loop-por-tenant ou expireOldCarts) — sob FORCE RLS não
    // dá para descobri-lo com uma leitura sem contexto.
    let items: CartItem[] | null = null;
    await this.dataSource.transaction(async (manager) => {
      // RLS: necessário para acessar whatsapp_carts (e também movimentacoes_estoque)
      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);

      // manager.query() com RETURNING retorna tupla [[linhas], rowCount] neste TypeORM+pg; unwrap obrigatorio antes de ler campos.
      const rawUpdate = await manager.query(
        `UPDATE whatsapp_carts
           SET status = 'expired', stock_released_at = now()
         WHERE id = $1
           AND status = 'active'
           AND stock_released_at IS NULL
         RETURNING items, tenant_id`,
        [cartId],
      );
      const rows: Array<{ items: CartItem[]; tenant_id: string }> = Array.isArray(rawUpdate[0])
        ? rawUpdate[0]
        : rawUpdate;

      // Se nenhuma linha foi afetada, já foi tratado por outro actor — no-op
      if (!rows || rows.length === 0) return;

      items = rows[0].items;

      // Liberar reservas de cada item do carrinho expirado
      if (items && items.length > 0) {
        for (const item of items) {
          await this.stockEngine.release(manager, tenantId, item.produto_id, item.quantity);
        }
      }
    });

    this.logger.log(`Carrinho ${cartId} expirado: ${items ? (items as CartItem[]).length : 0} item(ns) liberado(s)`);
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

    await this.saveCart(cart);

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
    await this.saveCart(cart);

    return cart;
  }

  /**
   * Marca carrinho como convertido (pedido criado)
   */
  async markAsConverted(cartId: string): Promise<void> {
    const cart = await this.getCartById(cartId);

    if (cart) {
      cart.status = 'converted';
      await this.saveCart(cart);
      this.logger.log(`Carrinho ${cartId} convertido em pedido`);
    }
  }

  /**
   * Busca carrinho por ID
   */
  async getCartById(cartId: string): Promise<WhatsAppCart | null> {
    // cartId-only: roda no contexto RLS atual (request). Fora de request, vazio.
    return this.getCartRepo().findOne({ where: { id: cartId } });
  }

  /** Contagens de carrinho de um tenant (para métricas), no contexto RLS dele. */
  async countCartsByTenant(
    tenantId: string,
  ): Promise<{ total: number; converted: number }> {
    return this.withCart(tenantId, async (repo) => {
      const total = await repo.count({ where: { tenant_id: tenantId } });
      const converted = await repo.count({
        where: { tenant_id: tenantId, status: 'converted' },
      });
      return { total, converted };
    });
  }

  /**
   * Estende TTL do carrinho
   */
  async extendTtl(cartId: string, minutes?: number): Promise<void> {
    const cart = await this.getCartById(cartId);

    if (cart) {
      const ttl = minutes || this.getCartTtlMinutes();
      cart.expires_at = new Date(Date.now() + ttl * 60 * 1000);
      await this.saveCart(cart);
    }
  }

  /**
   * Gera resumo do carrinho para exibição no WhatsApp
   */
  generateSummary(cart: WhatsAppCart | null): string {
    // Carrinho ausente (null) e um estado valido = vazio, nao um erro. Sem este
    // guard, o GET publico do carrinho quebrava com 500 (BUG-CART-1).
    if (!cart || !cart.items?.length) {
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

    return this.withCart(tenantId, (repo) =>
      repo.findOne({
        where: {
          tenant_id: tenantId,
          customer_phone: customerPhone,
          status: 'active' as any,
          expires_at: MoreThan(now) as any,
        },
        order: { created_at: 'DESC' },
      }),
    );
  }

  /**
   * Expira carrinhos antigos do cliente, liberando reservas de cada um via releaseExpiredCart.
   */
  private async expireOldCarts(tenantId: string, customerPhone: string): Promise<void> {
    const now = new Date();

    // Buscar carrinhos expirados ainda marcados como 'active' (contexto do tenant)
    const carrinhos = await this.withCart(tenantId, (repo) =>
      repo.find({
        where: {
          tenant_id: tenantId,
          customer_phone: customerPhone,
          status: 'active' as any,
          expires_at: LessThan(now) as any,
        },
        select: ['id'],
      }),
    );

    // Liberar estoque de cada carrinho expirado via compare-and-set idempotente
    for (const c of carrinhos) {
      await this.releaseExpiredCart(c.id, tenantId);
    }
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
