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
    try {
      await this.sweepExpiredCarts();
      await this.sweepExpiredPendingOrders();
    } catch (err) {
      this.logger.error('Sweeper de estoque falhou', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Varre carrinhos ativos com expires_at < now() e stock_released_at nulo.
   * Delega a liberação ao CartService.releaseExpiredCart (compare-and-set).
   */
  async sweepExpiredCarts(): Promise<void> {
    const rows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM whatsapp_carts
       WHERE status = 'active'
         AND expires_at < now()
         AND stock_released_at IS NULL
       LIMIT 500`,
    );

    this.logger.debug(`Sweeper: ${rows.length} carrinho(s) expirado(s) encontrado(s)`);

    for (const row of rows) {
      try {
        await this.cartService.releaseExpiredCart(row.id);
      } catch (err) {
        this.logger.error(`Falha ao liberar carrinho ${row.id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /**
   * Varre pedidos em pendente_pagamento mais antigos que o TTL configurado
   * e com stock_released_at nulo.
   * Delega o cancelamento ao OrdersService.releaseExpiredPendingOrder (compare-and-set).
   */
  async sweepExpiredPendingOrders(): Promise<void> {
    const ttlMin = Number(this.config.get('ORDER_PAYMENT_TTL_MINUTES')) || 60;

    const rows: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM pedidos
       WHERE status = 'pendente_pagamento'
         AND created_at < now() - ($1 || ' minutes')::interval
         AND stock_released_at IS NULL
       LIMIT 500`,
      [ttlMin],
    );

    this.logger.debug(`Sweeper: ${rows.length} pedido(s) pendente(s) vencido(s) encontrado(s)`);

    for (const row of rows) {
      try {
        await this.ordersService.releaseExpiredPendingOrder(row.id);
      } catch (err) {
        this.logger.error(`Falha ao cancelar pedido vencido ${row.id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
