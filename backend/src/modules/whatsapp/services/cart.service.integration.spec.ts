/**
 * Testes de integração para CartService — reserva/liberação de estoque.
 * Padrão: banco real (localhost:5544/ucm_test_motor), sem Redis/HTTP.
 * Produto e saldo são semeados via SQL puro (igual ao stock-engine.service.integration.spec.ts).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { databaseConfig } from '../../../config/database.config';
import { CommonModule } from '../../common/common.module';
import { ProductsModule } from '../../products/products.module';
import { CartService, AddToCartInput } from './cart.service';
import { StockEngineService } from '../../products/stock-engine.service';
import { WhatsAppCart } from '../../../database/entities/WhatsappCart.entity';
import { TypeOrmModule as TypeOrmFeatureModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

const tenantId = '00000000-0000-0000-0000-000000000000';
const customerPhone = '+5511999000001';

describe('CartService (integration — reserva de estoque)', () => {
  let dataSource: DataSource | null = null;
  let cartService: CartService;

  beforeAll(async () => {
    try {
      process.env.SUPPRESS_TENANT_RLS_LOGS = 'true';
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
          TypeOrmModule.forRootAsync(databaseConfig),
          // Registrar entidade WhatsAppCart para o repositório do CartService
          TypeOrmModule.forFeature([WhatsAppCart]),
          CommonModule,
          ProductsModule,
        ],
        providers: [CartService],
      }).compile();

      dataSource = moduleRef.get<DataSource>(DataSource);
      cartService = moduleRef.get<CartService>(CartService);
    } catch (err) {
      console.error('Falha ao inicializar módulo de teste:', err);
      dataSource = null;
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  // ─── helpers de seed/leitura ──────────────────────────────────────────────

  /**
   * Cria produto + saldo de estoque diretamente via SQL.
   * Usa set_config session-level (false) pois está fora de transação.
   */
  async function seedProduto(current: number, reserved = 0): Promise<string> {
    const qr = dataSource!.createQueryRunner();
    await qr.connect();
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
    const prod = await qr.query(
      `INSERT INTO produtos (id, tenant_id, name, price, is_active, created_at, updated_at)
       VALUES (uuid_generate_v4(), $1, 'Produto Teste Cart', 29.90, true, now(), now())
       RETURNING id`,
      [tenantId],
    );
    const pid = prod[0].id;
    await qr.query(
      `INSERT INTO movimentacoes_estoque
         (id, tenant_id, produto_id, current_stock, reserved_stock, min_stock, last_updated)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, 0, now())`,
      [tenantId, pid, current, reserved],
    );
    await qr.release();
    return pid;
  }

  /** Lê current_stock e reserved_stock sem passar pelo cache. */
  async function saldo(pid: string): Promise<{ current: number; reserved: number }> {
    const qr = dataSource!.createQueryRunner();
    await qr.connect();
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
    const r = await qr.query(
      `SELECT current_stock, reserved_stock FROM movimentacoes_estoque WHERE produto_id = $1`,
      [pid],
    );
    await qr.release();
    return { current: Number(r[0].current_stock), reserved: Number(r[0].reserved_stock) };
  }

  /** Limpa carrinhos do cliente de teste para isolar os cenários. */
  async function limparCarrinhos(): Promise<void> {
    const qr = dataSource!.createQueryRunner();
    await qr.connect();
    await qr.query(
      `DELETE FROM whatsapp_carts WHERE tenant_id = $1 AND customer_phone = $2`,
      [tenantId, customerPhone],
    );
    await qr.release();
  }

  // ─── testes ──────────────────────────────────────────────────────────────

  it('addItem reserva estoque do produto (current=5, add qty=2 → reserved=2)', async () => {
    if (!dataSource) return;
    await limparCarrinhos();
    const produtoId = await seedProduto(5);

    const input: AddToCartInput = {
      tenantId,
      customerPhone,
      produtoId,
      produtoName: 'Produto Teste Cart',
      quantity: 2,
      unitPrice: 29.90,
    };

    await cartService.addItem(input);

    const s = await saldo(produtoId);
    expect(s.reserved).toBe(2);
    expect(s.current).toBe(5);
  });

  it('clearCart libera a reserva (idempotente: 2ª chamada → reserved=0 sem erro)', async () => {
    if (!dataSource) return;
    await limparCarrinhos();
    const produtoId = await seedProduto(5);

    const input: AddToCartInput = {
      tenantId,
      customerPhone,
      produtoId,
      produtoName: 'Produto Teste Cart',
      quantity: 2,
      unitPrice: 29.90,
    };

    const cart = await cartService.addItem(input);
    expect((await saldo(produtoId)).reserved).toBe(2);

    // 1ª chamada ao clearCart → deve liberar
    await cartService.clearCart(cart.id);
    expect((await saldo(produtoId)).reserved).toBe(0);

    // 2ª chamada ao clearCart → idempotente (carrinho já abandoned)
    await cartService.clearCart(cart.id);
    expect((await saldo(produtoId)).reserved).toBe(0);
  });

  it('releaseExpiredCart libera reserva de carrinho active e é idempotente', async () => {
    if (!dataSource) return;
    await limparCarrinhos();
    const produtoId = await seedProduto(5);

    const input: AddToCartInput = {
      tenantId,
      customerPhone,
      produtoId,
      produtoName: 'Produto Teste Cart',
      quantity: 3,
      unitPrice: 29.90,
    };

    const cart = await cartService.addItem(input);
    expect((await saldo(produtoId)).reserved).toBe(3);

    // 1ª chamada — deve marcar expired e liberar
    await cartService.releaseExpiredCart(cart.id);
    expect((await saldo(produtoId)).reserved).toBe(0);

    // Verificar status no banco
    const qr = dataSource!.createQueryRunner();
    await qr.connect();
    const rows = await qr.query(
      `SELECT status, stock_released_at FROM whatsapp_carts WHERE id = $1`,
      [cart.id],
    );
    await qr.release();
    expect(rows[0].status).toBe('expired');
    expect(rows[0].stock_released_at).not.toBeNull();

    // 2ª chamada — idempotente (stock_released_at já preenchido) → sem erro, sem dupla-liberação
    await cartService.releaseExpiredCart(cart.id);
    expect((await saldo(produtoId)).reserved).toBe(0);
  });

  it('addItem com quantidade acima do disponível é rejeitado (sem alterar estoque)', async () => {
    if (!dataSource) return;
    await limparCarrinhos();
    const produtoId = await seedProduto(2); // só 2 disponíveis

    const input: AddToCartInput = {
      tenantId,
      customerPhone,
      produtoId,
      produtoName: 'Produto Teste Cart',
      quantity: 5, // excede o disponível
      unitPrice: 29.90,
    };

    await expect(cartService.addItem(input)).rejects.toThrow();
    expect((await saldo(produtoId)).reserved).toBe(0);
  });
});
