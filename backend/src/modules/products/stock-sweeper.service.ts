import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { CartService } from '../whatsapp/services/cart.service';
import { OrdersService } from '../orders/orders.service';

/**
 * Varredor de TTL: rede de segurança que libera reservas de carrinhos e pedidos
 * pendentes vencidos de forma idempotente.
 *
 * Roda a cada minuto via @Cron. Cada release individual é delegado ao serviço
 * responsável (releaseExpiredCart / releaseExpiredPendingOrder), que usam
 * compare-and-set atômico — sem risco de dupla liberação mesmo sob corrida.
 */
@Injectable()
export class StockSweeperService {
  private readonly logger = new Logger(StockSweeperService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly cartService: CartService,
    private readonly ordersService: OrdersService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'stock-sweeper' })
  async run(): Promise<void> {
    try { await this.sweepExpiredCarts(); }
    catch (err) { this.logger.error('sweepExpiredCarts falhou', { error: err instanceof Error ? err.message : String(err) }); }
    try { await this.sweepExpiredPendingOrders(); }
    catch (err) { this.logger.error('sweepExpiredPendingOrders falhou', { error: err instanceof Error ? err.message : String(err) }); }
  }

  /**
   * Varre carrinhos ativos com expires_at < now() e stock_released_at nulo.
   * Delega a liberação ao CartService.releaseExpiredCart (compare-and-set).
   */
  async sweepExpiredCarts(): Promise<void> {
    // Itera POR TENANT (abordagem (a) do handoff): whatsapp_carts tem FORCE RLS,
    // então uma varredura cross-tenant sem contexto retorna 0. Para cada tenant
    // setamos o contexto e varremos os carrinhos dele. O app segue NOSUPERUSER
    // (sem BYPASSRLS) — a lista de tenants vem de app_list_tenant_ids().
    const tenantIds = await this.listTenantIds();
    let total = 0;

    for (const tenantId of tenantIds) {
      const cartIds = await this.expiredCartIdsForTenant(tenantId);
      total += cartIds.length;
      for (const cartId of cartIds) {
        try {
          await this.cartService.releaseExpiredCart(cartId, tenantId);
        } catch (err) {
          this.logger.error(`Falha ao liberar carrinho ${cartId}`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    this.logger.debug(
      `Sweeper: ${total} carrinho(s) expirado(s) em ${tenantIds.length} tenant(s)`,
    );
  }

  /**
   * Varre pedidos em pendente_pagamento mais antigos que o TTL configurado
   * e com stock_released_at nulo.
   * Delega o cancelamento ao OrdersService.releaseExpiredPendingOrder (compare-and-set).
   */
  async sweepExpiredPendingOrders(): Promise<void> {
    const ttlMin = Number(this.config.get('ORDER_PAYMENT_TTL_MINUTES')) || 60;

    // Itera POR TENANT (pedidos tem FORCE RLS). Antes, este sweep varria
    // cross-tenant sem contexto e, sob o papel restrito de prod, já era um no-op
    // silencioso — agora limpa os pendentes vencidos de todos os tenants.
    const tenantIds = await this.listTenantIds();
    let total = 0;

    for (const tenantId of tenantIds) {
      const orderIds = await this.expiredPendingOrderIdsForTenant(tenantId, ttlMin);
      total += orderIds.length;
      for (const orderId of orderIds) {
        try {
          await this.ordersService.releaseExpiredPendingOrder(orderId, tenantId);
        } catch (err) {
          this.logger.error(`Falha ao cancelar pedido vencido ${orderId}`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    this.logger.debug(
      `Sweeper: ${total} pedido(s) pendente(s) vencido(s) em ${tenantIds.length} tenant(s)`,
    );
  }

  /**
   * Lista os tenants via a primitiva SECURITY DEFINER app_list_tenant_ids().
   * Permite ao job (papel NOSUPERUSER) enumerar tenants sem BYPASSRLS.
   */
  private async listTenantIds(): Promise<string[]> {
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT app_list_tenant_ids() AS id`,
    );
    return rows.map((r) => r.id);
  }

  /** IDs de carrinhos expirados de UM tenant, lidos no contexto RLS dele. */
  private async expiredCartIdsForTenant(tenantId: string): Promise<string[]> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      const rows: Array<{ id: string }> = await manager.query(
        `SELECT id FROM whatsapp_carts
         WHERE status = 'active'
           AND expires_at < now()
           AND stock_released_at IS NULL
         LIMIT 500`,
      );
      return rows.map((r) => r.id);
    });
  }

  /** IDs de pedidos pendentes vencidos de UM tenant, lidos no contexto RLS dele. */
  private async expiredPendingOrderIdsForTenant(
    tenantId: string,
    ttlMin: number,
  ): Promise<string[]> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      const rows: Array<{ id: string }> = await manager.query(
        `SELECT id FROM pedidos
         WHERE status = 'pendente_pagamento'
           AND created_at < now() - ($1 || ' minutes')::interval
           AND stock_released_at IS NULL
         LIMIT 500`,
        [ttlMin],
      );
      return rows.map((r) => r.id);
    });
  }
}
