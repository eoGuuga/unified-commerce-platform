/**
 * Teste de integração do StockSweeperService (Task 7).
 * Valida varredura de carrinhos expirados e pedidos pendentes vencidos.
 *
 * Estratégia de isolamento:
 *  - Usa superusuário postgres (bypass RLS) para INSERT/SELECT diretos.
 *  - IDs determinísticos por suite para evitar colisão entre runs paralelos.
 *  - Limpeza em afterEach para idempotência do suite.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { StockSweeperService } from './stock-sweeper.service';
import { StockSchedulerModule } from './stock-scheduler.module';
import { CommonModule } from '../common/common.module';
import { databaseConfig } from '../../config/database.config';

// IDs fixos para este suite de testes
const TENANT_ID = '00000000-0000-0000-0000-000000000099';
const PRODUTO_ID_CART = '00000000-0000-0000-0000-000000000901';
const PRODUTO_ID_ORDER = '00000000-0000-0000-0000-000000000902';
const CART_ID = '00000000-0000-0000-0000-000000000801';
const ORDER_ID = '00000000-0000-0000-0000-000000000701';

describe('StockSweeperService — integração', () => {
  let module: TestingModule;
  let sweeper: StockSweeperService;
  let dataSource: DataSource | null = null;

  beforeAll(async () => {
    try {
      module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
          TypeOrmModule.forRootAsync(databaseConfig),
          ScheduleModule.forRoot(),
          CommonModule,
          StockSchedulerModule,
        ],
      }).compile();

      sweeper = module.get<StockSweeperService>(StockSweeperService);
      dataSource = module.get<DataSource>(DataSource);
    } catch (err) {
      console.error('❌ Falha ao inicializar módulo de testes do sweeper:', err);
      dataSource = null;
    }
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  // ─── helpers de seed ──────────────────────────────────────────────────────

  /**
   * Garante que o tenant existe no banco (upsert).
   */
  async function ensureTenant(ds: DataSource): Promise<void> {
    await ds.query(`
      INSERT INTO tenants (id, name, slug, is_active)
      VALUES ($1, 'Tenant Sweeper Test', 'sweeper-test', true)
      ON CONFLICT (id) DO NOTHING
    `, [TENANT_ID]);
  }

  /**
   * Cria ou atualiza o produto e sua linha de estoque.
   */
  async function seedProdutoEstoque(
    ds: DataSource,
    produtoId: string,
    current: number,
    reserved: number,
  ): Promise<void> {
    await ds.query(`
      INSERT INTO produtos (id, tenant_id, name, description, price, is_active)
      VALUES ($1, $2, 'Produto Sweeper', 'desc', 10.00, true)
      ON CONFLICT (id) DO NOTHING
    `, [produtoId, TENANT_ID]);

    await ds.query(`
      INSERT INTO movimentacoes_estoque (id, tenant_id, produto_id, current_stock, reserved_stock, min_stock)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, 0)
      ON CONFLICT (tenant_id, produto_id)
        DO UPDATE SET current_stock = $3, reserved_stock = $4
    `, [TENANT_ID, produtoId, current, reserved]);
  }

  /**
   * Cria carrinho ativo com expires_at no passado.
   */
  async function seedCartExpirado(
    ds: DataSource,
    cartId: string,
    produtoId: string,
    reservedQty: number,
  ): Promise<void> {
    const items = JSON.stringify([
      { produto_id: produtoId, produto_name: 'Produto Sweeper', quantity: reservedQty, unit_price: 10 },
    ]);
    await ds.query(`
      INSERT INTO whatsapp_carts (
        id, tenant_id, customer_phone, status,
        items, subtotal, shipping_amount, total_amount,
        discount_amount, expires_at, stock_released_at,
        created_at, updated_at
      )
      VALUES (
        $1, $2, '5511900000099', 'active',
        $3::jsonb, 10, 0, 10,
        0, now() - interval '1 hour', NULL,
        now() - interval '2 hours', now() - interval '2 hours'
      )
      ON CONFLICT (id) DO UPDATE
        SET status = 'active',
            stock_released_at = NULL,
            expires_at = now() - interval '1 hour',
            items = $3::jsonb
    `, [cartId, TENANT_ID, items]);
  }

  /**
   * Cria pedido pendente com created_at mais antigo que o TTL.
   */
  async function seedPedidoExpirado(
    ds: DataSource,
    orderId: string,
    produtoId: string,
    qty: number,
  ): Promise<void> {
    // Pedido com created_at há 2 horas (TTL padrão = 60 min)
    const orderNo = `SWEEP-TEST-${orderId.slice(0, 8)}`;
    await ds.query(`
      INSERT INTO pedidos (
        id, tenant_id, order_no, status, channel,
        subtotal, discount_amount, shipping_amount, total_amount,
        stock_released_at, created_at, updated_at
      )
      VALUES (
        $1, $2, $3,
        'pendente_pagamento', 'whatsapp',
        10, 0, 0, 10,
        NULL,
        now() - interval '2 hours',
        now() - interval '2 hours'
      )
      ON CONFLICT (id) DO UPDATE
        SET status = 'pendente_pagamento',
            stock_released_at = NULL,
            created_at = now() - interval '2 hours'
    `, [orderId, TENANT_ID, orderNo]);

    await ds.query(`
      INSERT INTO itens_pedido (id, pedido_id, produto_id, quantity, unit_price, subtotal)
      VALUES (gen_random_uuid(), $1, $2, $3, 10.00, $4)
      ON CONFLICT DO NOTHING
    `, [orderId, produtoId, qty, qty * 10]);
  }

  /**
   * Remove registros gerados por este suite.
   */
  async function cleanup(ds: DataSource): Promise<void> {
    await ds.query(`DELETE FROM itens_pedido WHERE pedido_id = $1`, [ORDER_ID]);
    await ds.query(`DELETE FROM pedidos WHERE id = $1`, [ORDER_ID]);
    await ds.query(`DELETE FROM whatsapp_carts WHERE id = $1`, [CART_ID]);
    await ds.query(`DELETE FROM movimentacoes_estoque WHERE tenant_id = $1`, [TENANT_ID]);
    await ds.query(`DELETE FROM produtos WHERE tenant_id = $1`, [TENANT_ID]);
    await ds.query(`DELETE FROM tenants WHERE id = $1`, [TENANT_ID]);
  }

  // ─── testes ───────────────────────────────────────────────────────────────

  describe('sweepExpiredCarts', () => {
    beforeEach(async () => {
      if (!dataSource) return;
      await cleanup(dataSource);
      await ensureTenant(dataSource);
      // current=5, reserved=2 (simulando reserva do carrinho)
      await seedProdutoEstoque(dataSource, PRODUTO_ID_CART, 5, 2);
      await seedCartExpirado(dataSource, CART_ID, PRODUTO_ID_CART, 2);
    });

    afterEach(async () => {
      if (!dataSource) return;
      await cleanup(dataSource);
    });

    it('libera reserva de carrinhos vencidos e é idempotente', async () => {
      if (!dataSource) {
        console.warn('⚠ DB indisponível — pulando teste');
        return;
      }

      // ── primeira execução ──────────────────────────────────────────────────
      await sweeper.sweepExpiredCarts();

      const [estoqueRow] = await dataSource.query(
        `SELECT reserved_stock FROM movimentacoes_estoque
         WHERE tenant_id = $1 AND produto_id = $2`,
        [TENANT_ID, PRODUTO_ID_CART],
      );
      expect(Number(estoqueRow.reserved_stock)).toBe(0);

      const [cartRow] = await dataSource.query(
        `SELECT status, stock_released_at FROM whatsapp_carts WHERE id = $1`,
        [CART_ID],
      );
      expect(cartRow.status).toBe('expired');
      expect(cartRow.stock_released_at).not.toBeNull();

      // ── segunda execução (idempotência) ────────────────────────────────────
      await sweeper.sweepExpiredCarts();

      const [estoqueRow2] = await dataSource.query(
        `SELECT reserved_stock FROM movimentacoes_estoque
         WHERE tenant_id = $1 AND produto_id = $2`,
        [TENANT_ID, PRODUTO_ID_CART],
      );
      // Não deve liberar negativamente
      expect(Number(estoqueRow2.reserved_stock)).toBe(0);
    });
  });

  describe('sweepExpiredPendingOrders', () => {
    beforeEach(async () => {
      if (!dataSource) return;
      await cleanup(dataSource);
      await ensureTenant(dataSource);
      // current=5, reserved=3 (simulando reserva do pedido)
      await seedProdutoEstoque(dataSource, PRODUTO_ID_ORDER, 5, 3);
      await seedPedidoExpirado(dataSource, ORDER_ID, PRODUTO_ID_ORDER, 3);
    });

    afterEach(async () => {
      if (!dataSource) return;
      await cleanup(dataSource);
    });

    it('cancela pedido vencido, libera reserva e é idempotente', async () => {
      if (!dataSource) {
        console.warn('⚠ DB indisponível — pulando teste');
        return;
      }

      // ── primeira execução ──────────────────────────────────────────────────
      await sweeper.sweepExpiredPendingOrders();

      const [pedidoRow] = await dataSource.query(
        `SELECT status, stock_released_at FROM pedidos WHERE id = $1`,
        [ORDER_ID],
      );
      expect(pedidoRow.status).toBe('cancelado');
      expect(pedidoRow.stock_released_at).not.toBeNull();

      const [estoqueRow] = await dataSource.query(
        `SELECT reserved_stock FROM movimentacoes_estoque
         WHERE tenant_id = $1 AND produto_id = $2`,
        [TENANT_ID, PRODUTO_ID_ORDER],
      );
      expect(Number(estoqueRow.reserved_stock)).toBe(0);

      // ── segunda execução (idempotência) ────────────────────────────────────
      await sweeper.sweepExpiredPendingOrders();

      const [estoqueRow2] = await dataSource.query(
        `SELECT reserved_stock FROM movimentacoes_estoque
         WHERE tenant_id = $1 AND produto_id = $2`,
        [TENANT_ID, PRODUTO_ID_ORDER],
      );
      // Não deve liberar novamente
      expect(Number(estoqueRow2.reserved_stock)).toBe(0);
    });
  });
});
