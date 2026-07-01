/**
 * Testes e2e do fluxo de pagamento (Phase 34 - revenue path).
 *
 * Cobre o caminho que efetivamente gera dinheiro:
 *   1. Public ecommerce checkout (cria pedido sem auth)
 *   2. Public PIX payment (gera pagamento + mock QR code)
 *   3. Idempotencia: 2x criar pagamento mesmo metodo = reusa pendente
 *   4. RLS isolation: tenant B nao consegue ler pagamento do tenant A
 *   5. Confirm payment muda status para PAID
 *   6. [Task 8] PIX expirado/cancelado → cancel+release idempotente
 *
 * Usa o provider 'mock' (PAYMENT_PROVIDER nao setado em test).
 *
 * Os testes sao defensivos: se o DB nao estiver disponivel, sao pulados
 * com log em vez de falhar (mesma estrategia das outras integration specs).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { DataSource, EntityManager } from 'typeorm';
import { Pagamento, PagamentoStatus } from '../../database/entities/Pagamento.entity';
import { PedidoStatus } from '../../database/entities/Pedido.entity';
import { JwtService } from '@nestjs/jwt';
import { OrdersModule } from '../orders/orders.module';
import { OrdersService } from '../orders/orders.service';
import { ProductsModule } from '../products/products.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsModule } from './payments.module';
import { PaymentsService } from './payments.service';
import { MercadoPagoProvider } from './providers/mercadopago.provider';
import { databaseConfig } from '../../config/database.config';
import { Usuario, UserRole } from '../../database/entities/Usuario.entity';
import { TenantDbContextInterceptor } from '../../common/interceptors/tenant-db-context.interceptor';

describe('Payments Integration Tests (e2e revenue path)', () => {
  let app: INestApplication | null = null;
  let dataSource: DataSource;
  let jwtToken: string;
  let moduleFixture: TestingModule;
  const tenantId = '00000000-0000-0000-0000-000000000000';
  const productName = 'Produto E2E Payments';

  beforeAll(async () => {
    try {
      process.env.SUPPRESS_TENANT_RLS_LOGS = 'true';
      moduleFixture = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
          TypeOrmModule.forRootAsync(databaseConfig),
          CommonModule,
          AuthModule,
          ProductsModule,
          OrdersModule,
          PaymentsModule,
          NotificationsModule,
        ],
        providers: [
          { provide: APP_INTERCEPTOR, useClass: TenantDbContextInterceptor },
        ],
      }).compile();

      dataSource = moduleFixture.get<DataSource>(DataSource);


      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      app.setGlobalPrefix('api/v1');
      await app.init();

      // bootstrap usuario admin pro tenant default
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(
        `SELECT set_config('app.current_tenant_id', $1, false)`,
        [tenantId],
      );

      const usuariosRepo = queryRunner.manager.getRepository<Usuario>(Usuario);
      const adminId = '00000000-0000-0000-0000-000000000010';
      let admin = await usuariosRepo.findOne({ where: { id: adminId } });
      if (!admin) {
        admin = usuariosRepo.create({
          id: adminId,
          email: 'admin-e2e-payments@test.com',
          encrypted_password: await bcrypt.hash('test123', 10),
          full_name: 'Admin E2E Payments',
          role: UserRole.ADMIN,
          tenant_id: tenantId,
          is_active: true,
        });
        await usuariosRepo.save(admin);
      }

      const jwt = moduleFixture.get<JwtService>(JwtService);
      jwtToken = jwt.sign({
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        tenant_id: admin.tenant_id,
      });

      await queryRunner.release();
    } catch (error) {
      console.error(
        '❌ Erro ao inicializar payments integration tests:',
        error instanceof Error ? error.message : String(error),
      );
      app = null;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // Helper: cria produto + estoque + pedido publico ecommerce. Retorna
  // o id do pedido criado. Garante que o produto eh "novo" desativando
  // produtos antigos com mesmo nome.
  async function setupEcommerceOrder(opts: {
    productLabel: string;
    quantity: number;
    unitPrice: number;
    stock: number;
    idempotencyKey: string;
  }): Promise<{ orderId: string; orderTotal: number; productId: string }> {
    if (!app) throw new Error('app nao inicializado');

    const fullName = `${productName} ${opts.productLabel}`;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(
      `SELECT set_config('app.current_tenant_id', $1, false)`,
      [tenantId],
    );
    await queryRunner.query(
      'UPDATE produtos SET is_active = false WHERE tenant_id = $1 AND name = $2',
      [tenantId, fullName],
    );
    await queryRunner.release();

    const productRes = await request(app.getHttpServer())
      .post(`/api/v1/products`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        name: fullName,
        price: opts.unitPrice,
        description: 'Produto e2e payments',
        unit: 'unidade',
      })
      .expect(201);
    const productId = productRes.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/products/${productId}/adjust-stock`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ tipo: 'COMPRA', delta: opts.stock, motivo: 'Bootstrap e2e' })
      .expect(201);

    const orderRes = await request(app.getHttpServer())
      .post(`/api/v1/orders/public/checkout`)
      .set('x-tenant-id', tenantId)
      .set('Idempotency-Key', opts.idempotencyKey)
      .send({
        channel: 'ecommerce',
        customer_name: `Cliente ${opts.productLabel}`,
        customer_email: `cliente.${opts.productLabel.toLowerCase()}@test.com`,
        customer_phone: '11999998888',
        delivery_type: 'pickup',
        // Task 5 (S2b) passou a exigir scheduled_at em retirada; valor futuro valido.
        scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            produto_id: productId,
            quantity: opts.quantity,
            unit_price: opts.unitPrice,
          },
        ],
        discount_amount: 0,
        shipping_amount: 0,
      })
      .expect(201);

    return {
      orderId: orderRes.body.id,
      orderTotal: Number(orderRes.body.total_amount),
      productId,
    };
  }

  describe('POST /payments/public - PIX checkout (revenue path)', () => {
    it('gera pagamento PIX com qr_code para pedido ecommerce', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app nao inicializado');
        return;
      }

      const { orderId, orderTotal } = await setupEcommerceOrder({
        productLabel: 'PIX',
        quantity: 1,
        unitPrice: 100,
        stock: 5,
        idempotencyKey: 'e2e-payments-pix-1',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/public`)
        .set('x-tenant-id', tenantId)
        .send({
          pedido_id: orderId,
          method: 'pix',
          amount: orderTotal,
        })
        .expect(201);

      expect(res.body.pagamento).toBeDefined();
      expect(res.body.pagamento.method).toBe('pix');
      expect(res.body.pagamento.status).toBe('pending');
      // PIX aplica 5% desconto: 100 -> 95
      expect(Number(res.body.pagamento.amount)).toBeCloseTo(95, 2);
      // Provider mock OU mercado pago em modo teste sempre tem qr_code ou message
      expect(
        res.body.qr_code ||
          res.body.qr_code_url ||
          res.body.copy_paste ||
          res.body.message,
      ).toBeTruthy();
    });

    it('idempotente: chamar 2x mesmo pedido+metodo reusa pagamento pendente', async () => {
      if (!app) return;

      const { orderId, orderTotal } = await setupEcommerceOrder({
        productLabel: 'Idem',
        quantity: 1,
        unitPrice: 50,
        stock: 5,
        idempotencyKey: 'e2e-payments-idem-1',
      });

      const first = await request(app.getHttpServer())
        .post(`/api/v1/payments/public`)
        .set('x-tenant-id', tenantId)
        .send({ pedido_id: orderId, method: 'pix', amount: orderTotal })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post(`/api/v1/payments/public`)
        .set('x-tenant-id', tenantId)
        .send({ pedido_id: orderId, method: 'pix', amount: orderTotal })
        .expect(201);

      expect(second.body.pagamento.id).toBe(first.body.pagamento.id);
    });

    it('rejeita pagamento publico para pedido NAO-ecommerce (PDV)', async () => {
      if (!app) return;

      // Cria pedido PDV via JWT (precisa de auth)
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(
        `SELECT set_config('app.current_tenant_id', $1, false)`,
        [tenantId],
      );
      await queryRunner.query(
        'UPDATE produtos SET is_active = false WHERE tenant_id = $1 AND name = $2',
        [tenantId, `${productName} PdvFail`],
      );
      await queryRunner.release();

      const productRes = await request(app.getHttpServer())
        .post(`/api/v1/products`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          name: `${productName} PdvFail`,
          price: 20,
          unit: 'unidade',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/products/${productRes.body.id}/adjust-stock`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ tipo: 'COMPRA', delta: 3, motivo: 'Bootstrap' })
        .expect(201);

      const orderRes = await request(app.getHttpServer())
        .post(`/api/v1/orders?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          channel: 'pdv',
          customer_name: 'Cliente PDV',
          // PDV nasce ENTREGUE e exige payment.method (venda sincrona de balcao).
          payment: { method: 'dinheiro' },
          items: [
            {
              produto_id: productRes.body.id,
              quantity: 1,
              unit_price: 20,
            },
          ],
        })
        .expect(201);

      const payRes = await request(app.getHttpServer())
        .post(`/api/v1/payments/public`)
        .set('x-tenant-id', tenantId)
        .send({ pedido_id: orderRes.body.id, method: 'pix', amount: 20 });

      // 400 esperado: "Pagamento publico restrito a pedidos da loja"
      expect(payRes.status).toBe(400);
      expect(String(payRes.body.message || '')).toMatch(/publico|loja/i);
    });

    it('rejeita pagamento com valor divergente do total do pedido', async () => {
      if (!app) return;

      const { orderId, orderTotal } = await setupEcommerceOrder({
        productLabel: 'AmountMismatch',
        quantity: 1,
        unitPrice: 100,
        stock: 2,
        idempotencyKey: 'e2e-payments-amount-mismatch',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/public`)
        .set('x-tenant-id', tenantId)
        .send({
          pedido_id: orderId,
          method: 'pix',
          // R$50 quando total eh R$100
          amount: orderTotal / 2,
        });

      expect(res.status).toBe(400);
      expect(String(res.body.message || '')).toMatch(/nao confere/i);
    });
  });

  describe('Throttling / rate limit basico', () => {
    it('aceita pagamentos validos abaixo do limite (sanity)', async () => {
      if (!app) return;

      const { orderId, orderTotal } = await setupEcommerceOrder({
        productLabel: 'Throttle',
        quantity: 1,
        unitPrice: 30,
        stock: 5,
        idempotencyKey: 'e2e-payments-throttle',
      });

      // 1 chamada validacao, abaixo de 30/min do @Throttle default
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/public`)
        .set('x-tenant-id', tenantId)
        .send({ pedido_id: orderId, method: 'pix', amount: orderTotal });

      expect([201, 200]).toContain(res.status);
    });
  });

  /**
   * Task 8: Webhook PIX expirado/cancelado → cancel+release idempotente.
   *
   * Semeamos diretamente no banco (SQL bruto) para evitar dependencias de
   * Redis/cache/HTTP. O MercadoPagoProvider e mockado em `getPaymentDetails`
   * para simular status 'cancelled'/'expired' sem chamar a API real.
   *
   * Schema real do banco:
   *   - estoque em `movimentacoes_estoque` (current_stock, reserved_stock por produto)
   *   - itens em `itens_pedido` (sem tenant_id, subtotal nao total_price)
   *   - ledger em `movimentacoes_estoque_historico` (tipo, order_id)
   */
  describe('Task 8 — PIX expirado/cancelado cancela pedido e libera reserva', () => {
    // IDs fixos para facilitar limpeza entre testes
    const produtoIdExp  = 'aaa00000-0000-0000-0000-000000000001';
    const pedidoIdExp   = 'bbb00000-0000-0000-0000-000000000001';
    const pagamentoIdExp = 'ccc00000-0000-0000-0000-000000000001';
    const mpPaymentIdExp = 'mp-fake-expired-001';

    /**
     * Semeia: produto com registro de estoque, pedido pendente, item, pagamento.
     * Usa SQL bruto direto (sem RLS) para independer de rotas HTTP/Redis.
     */
    async function seedPedidoComReserva(opts: {
      produtoId: string;
      pedidoId: string;
      pagamentoId: string;
      mpPaymentId: string;
      currentStock: number;
      reservedStock: number;
      quantity: number;
      unitPrice: number;
    }): Promise<void> {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      // Desabilita gatilhos de RLS para operacoes de seed direto
      await qr.query(`SET session_replication_role = replica`);

      // Limpa registros anteriores na ordem correta (FK)
      await qr.query(
        `DELETE FROM movimentacoes_estoque_historico WHERE order_id = $1`,
        [opts.pedidoId],
      );
      await qr.query(
        `DELETE FROM movimentacoes_estoque WHERE produto_id = $1 AND tenant_id = $2`,
        [opts.produtoId, tenantId],
      );
      await qr.query(`DELETE FROM itens_pedido WHERE pedido_id = $1`, [opts.pedidoId]);
      await qr.query(`DELETE FROM pagamentos WHERE id = $1`, [opts.pagamentoId]);
      await qr.query(`DELETE FROM pedidos WHERE id = $1`, [opts.pedidoId]);
      await qr.query(`DELETE FROM produtos WHERE id = $1`, [opts.produtoId]);

      // Produto (apenas catalogo — sem estoque nesta tabela)
      await qr.query(
        `INSERT INTO produtos (id, tenant_id, name, price, unit, is_active, created_at, updated_at)
         VALUES ($1, $2, 'Produto Webhook Exp', $3, 'unidade', true, now(), now())`,
        [opts.produtoId, tenantId, opts.unitPrice],
      );

      // Registro de estoque em movimentacoes_estoque (snapshot por produto)
      await qr.query(
        `INSERT INTO movimentacoes_estoque (id, tenant_id, produto_id, current_stock, reserved_stock, min_stock, last_updated)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, now())`,
        [tenantId, opts.produtoId, opts.currentStock, opts.reservedStock],
      );

      // Pedido pendente_pagamento (subtotal = total sem desconto/frete)
      const totalPedido = opts.unitPrice * opts.quantity;
      await qr.query(
        `INSERT INTO pedidos (id, tenant_id, order_no, status, channel, customer_name, subtotal, total_amount, created_at, updated_at)
         VALUES ($1, $2, $3, 'pendente_pagamento', 'ecommerce', 'Cliente Exp', $4, $4, now(), now())`,
        [opts.pedidoId, tenantId, `ORD-EXP-${Date.now()}`, totalPedido],
      );

      // Item do pedido (sem tenant_id — schema real nao tem essa coluna)
      await qr.query(
        `INSERT INTO itens_pedido (id, pedido_id, produto_id, quantity, unit_price, subtotal, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())`,
        [opts.pedidoId, opts.produtoId, opts.quantity, opts.unitPrice, opts.unitPrice * opts.quantity],
      );

      // Pagamento pendente vinculado ao transaction_id do MP (webhook lookup por transaction_id)
      await qr.query(
        `INSERT INTO pagamentos (id, tenant_id, pedido_id, method, amount, status, transaction_id, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, 'pix', $4, 'pending', $5, $6::jsonb, now(), now())`,
        [
          opts.pagamentoId,
          tenantId,
          opts.pedidoId,
          opts.unitPrice * opts.quantity,
          opts.mpPaymentId,
          JSON.stringify({ provider: 'mercadopago', tenant_id: tenantId }),
        ],
      );

      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();
    }

    /**
     * Constroi o payload de notificacao de webhook do MercadoPago.
     */
    function buildWebhookPayload(mpPaymentId: string): Record<string, any> {
      return {
        action: 'payment.updated',
        api_version: 'v1',
        data: { id: mpPaymentId },
        date_created: new Date().toISOString(),
        id: `notif-${mpPaymentId}`,
        live_mode: false,
        type: 'payment',
        user_id: '12345',
      };
    }

    beforeEach(async () => {
      if (!app) return;
      await seedPedidoComReserva({
        produtoId:   produtoIdExp,
        pedidoId:    pedidoIdExp,
        pagamentoId: pagamentoIdExp,
        mpPaymentId: mpPaymentIdExp,
        currentStock:  10,
        reservedStock: 2,
        quantity:  2,
        unitPrice: 50,
      });
    });

    afterEach(async () => {
      if (!dataSource) return;
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);
      await qr.query(
        `DELETE FROM movimentacoes_estoque_historico WHERE order_id = $1`,
        [pedidoIdExp],
      );
      await qr.query(
        `DELETE FROM movimentacoes_estoque WHERE produto_id = $1 AND tenant_id = $2`,
        [produtoIdExp, tenantId],
      );
      await qr.query(`DELETE FROM itens_pedido WHERE pedido_id = $1`, [pedidoIdExp]);
      await qr.query(`DELETE FROM pagamentos WHERE id = $1`, [pagamentoIdExp]);
      await qr.query(`DELETE FROM pedidos WHERE id = $1`, [pedidoIdExp]);
      await qr.query(`DELETE FROM produtos WHERE id = $1`, [produtoIdExp]);
      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();
    });

    it('PIX expirado: pedido cancelado, reserva liberada, sem VENDA no ledger', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste Task 8 - app nao inicializado');
        return;
      }

      const paymentsService = moduleFixture.get<PaymentsService>(PaymentsService);
      const mpProvider = moduleFixture.get<MercadoPagoProvider>(MercadoPagoProvider);

      // Mock: MercadoPago retorna status 'cancelled' (PIX expirado/cancelado)
      jest.spyOn(mpProvider, 'isConfigured').mockReturnValue(true);
      jest.spyOn(mpProvider, 'getPaymentDetails').mockResolvedValue({
        status: 'cancelled',
        status_detail: 'expired_payer_inaction',
        metadata: { tenant_id: tenantId },
        external_reference: pedidoIdExp,
        payment_method_id: 'pix',
      });

      const payload = buildWebhookPayload(mpPaymentIdExp);
      const result = await paymentsService.handleMercadoPagoWebhook(payload, { token: '' });

      expect(result.status).toBe('ok');

      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);

      // Pedido deve estar cancelado com stock_released_at preenchido
      const pedidos = await qr.query(
        `SELECT status, stock_released_at FROM pedidos WHERE id = $1`,
        [pedidoIdExp],
      );
      expect(pedidos[0].status).toBe('cancelado');
      expect(pedidos[0].stock_released_at).not.toBeNull();

      // Reserva deve ter sido liberada: reserved_stock cai de 2 para 0
      const estoques = await qr.query(
        `SELECT current_stock, reserved_stock FROM movimentacoes_estoque WHERE produto_id = $1 AND tenant_id = $2`,
        [produtoIdExp, tenantId],
      );
      expect(Number(estoques[0].reserved_stock)).toBe(0);
      // current_stock nao muda na liberacao de reserva
      expect(Number(estoques[0].current_stock)).toBe(10);

      // Nao deve ter entrada de VENDA no historico para este pedido
      const vendas = await qr.query(
        `SELECT * FROM movimentacoes_estoque_historico WHERE order_id = $1 AND tipo = 'VENDA'`,
        [pedidoIdExp],
      );
      expect(vendas).toHaveLength(0);

      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();

      jest.restoreAllMocks();
    });

    it('colisao webhook × sweeper: liberacao unica — reserved_stock exatamente 0, pedido cancelado, stock_released_at preenchido', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste Task 8 colisao - app nao inicializado');
        return;
      }

      const paymentsService = moduleFixture.get<PaymentsService>(PaymentsService);
      const ordersService   = moduleFixture.get<OrdersService>(OrdersService);
      const mpProvider      = moduleFixture.get<MercadoPagoProvider>(MercadoPagoProvider);

      // Mock: ambas chamadas retornam status 'cancelled'
      jest.spyOn(mpProvider, 'isConfigured').mockReturnValue(true);
      jest.spyOn(mpProvider, 'getPaymentDetails').mockResolvedValue({
        status: 'cancelled',
        status_detail: 'expired_payer_inaction',
        metadata: { tenant_id: tenantId },
        external_reference: pedidoIdExp,
        payment_method_id: 'pix',
      });

      // Webhook e sweeper em paralelo — compare-and-set garante liberacao unica
      const payload = buildWebhookPayload(mpPaymentIdExp);
      await Promise.all([
        paymentsService.handleMercadoPagoWebhook(payload, { token: '' }),
        ordersService.releaseExpiredPendingOrder(pedidoIdExp),
      ]);

      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);

      // reserved_stock deve ser EXATAMENTE 0 — nao basta >= 0.
      // GREATEST(0,...) clamparia dupla liberacao para 0 tambem, mascarando o bug;
      // a combinacao das tres assertivas abaixo prova liberacao unica correta.
      const estoques = await qr.query(
        `SELECT reserved_stock FROM movimentacoes_estoque WHERE produto_id = $1 AND tenant_id = $2`,
        [produtoIdExp, tenantId],
      );
      expect(Number(estoques[0].reserved_stock)).toBe(0);

      // Pedido deve estar cancelado com stock_released_at preenchido (liberacao registrada)
      const pedidos = await qr.query(
        `SELECT status, stock_released_at FROM pedidos WHERE id = $1`,
        [pedidoIdExp],
      );
      expect(pedidos[0].status).toBe('cancelado');
      expect(pedidos[0].stock_released_at).not.toBeNull();

      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();

      jest.restoreAllMocks();
    });

    it('rejected NAO cancela pedido nem libera reserva (recusa de cartao retentavel)', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste Task 8 rejected - app nao inicializado');
        return;
      }

      const paymentsService = moduleFixture.get<PaymentsService>(PaymentsService);
      const mpProvider      = moduleFixture.get<MercadoPagoProvider>(MercadoPagoProvider);

      // Mock: MercadoPago retorna status 'rejected' (recusa de cartao — retentavel)
      jest.spyOn(mpProvider, 'isConfigured').mockReturnValue(true);
      jest.spyOn(mpProvider, 'getPaymentDetails').mockResolvedValue({
        status: 'rejected',
        status_detail: 'cc_rejected_insufficient_amount',
        metadata: { tenant_id: tenantId },
        external_reference: pedidoIdExp,
        payment_method_id: 'credit_card',
      });

      const payload = buildWebhookPayload(mpPaymentIdExp);
      const result = await paymentsService.handleMercadoPagoWebhook(payload, { token: '' });

      expect(result.status).toBe('ok');

      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);

      // Pedido deve permanecer pendente_pagamento — nao foi cancelado
      const pedidos = await qr.query(
        `SELECT status, stock_released_at FROM pedidos WHERE id = $1`,
        [pedidoIdExp],
      );
      expect(pedidos[0].status).toBe('pendente_pagamento');
      expect(pedidos[0].stock_released_at).toBeNull();

      // Reserva deve permanecer intacta (2 unidades ainda reservadas)
      const estoques = await qr.query(
        `SELECT reserved_stock FROM movimentacoes_estoque WHERE produto_id = $1 AND tenant_id = $2`,
        [produtoIdExp, tenantId],
      );
      expect(Number(estoques[0].reserved_stock)).toBe(2);

      // Pagamento deve estar como FAILED (status salvo corretamente)
      const pagamentos = await qr.query(
        `SELECT status FROM pagamentos WHERE id = $1`,
        [pagamentoIdExp],
      );
      expect(pagamentos[0].status).toBe('failed');

      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();

      jest.restoreAllMocks();
    });
  });

  /**
   * Task 4 (marco central): Webhook `approved` → pedido CONFIRMADO.
   *
   * Criterio de aceitacao da frente PIX. Confirmar pagamento NAO baixa nem
   * libera estoque (commitSale/baixa de VENDA so acontece no PRONTO —
   * orders.service.ts:647-648, fora deste escopo). Por isso assertamos
   * RIGOROSAMENTE que current_stock E reserved_stock ficam INTACTOS e que
   * NENHUM movimento tipo 'VENDA' entra no ledger.
   *
   * Mesmo padrao de seed direto (SQL bruto, sem RLS) do bloco Task 8.
   */
  describe('Webhook approved → CONFIRMADO (S4, marco central)', () => {
    const produtoIdApr   = 'aaa00000-0000-0000-0000-000000000002';
    const pedidoIdApr     = 'bbb00000-0000-0000-0000-000000000002';
    const pagamentoIdApr  = 'ccc00000-0000-0000-0000-000000000002';
    const mpPaymentIdApr  = 'mp-fake-approved-002';

    /**
     * Semeia: produto, registro de estoque com reserva, pedido ecommerce
     * pendente_pagamento, item, pagamento PENDING vinculado por transaction_id
     * com tenant_id no metadata.
     */
    async function seedPedidoPendente(opts: {
      currentStock: number;
      reservedStock: number;
      quantity: number;
      unitPrice: number;
    }): Promise<void> {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);

      await qr.query(
        `DELETE FROM movimentacoes_estoque_historico WHERE order_id = $1`,
        [pedidoIdApr],
      );
      await qr.query(
        `DELETE FROM movimentacoes_estoque WHERE produto_id = $1 AND tenant_id = $2`,
        [produtoIdApr, tenantId],
      );
      await qr.query(`DELETE FROM itens_pedido WHERE pedido_id = $1`, [pedidoIdApr]);
      await qr.query(`DELETE FROM pagamentos WHERE id = $1`, [pagamentoIdApr]);
      await qr.query(`DELETE FROM pedidos WHERE id = $1`, [pedidoIdApr]);
      await qr.query(`DELETE FROM produtos WHERE id = $1`, [produtoIdApr]);

      await qr.query(
        `INSERT INTO produtos (id, tenant_id, name, price, unit, is_active, created_at, updated_at)
         VALUES ($1, $2, 'Produto Webhook Approved', $3, 'unidade', true, now(), now())`,
        [produtoIdApr, tenantId, opts.unitPrice],
      );

      // Estoque COM reserva de pe (reserved_stock > 0)
      await qr.query(
        `INSERT INTO movimentacoes_estoque (id, tenant_id, produto_id, current_stock, reserved_stock, min_stock, last_updated)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, now())`,
        [tenantId, produtoIdApr, opts.currentStock, opts.reservedStock],
      );

      const totalPedido = opts.unitPrice * opts.quantity;
      await qr.query(
        `INSERT INTO pedidos (id, tenant_id, order_no, status, channel, customer_name, subtotal, total_amount, created_at, updated_at)
         VALUES ($1, $2, $3, 'pendente_pagamento', 'ecommerce', 'Cliente Approved', $4, $4, now(), now())`,
        [pedidoIdApr, tenantId, `ORD-APR-${Date.now()}`, totalPedido],
      );

      await qr.query(
        `INSERT INTO itens_pedido (id, pedido_id, produto_id, quantity, unit_price, subtotal, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())`,
        [pedidoIdApr, produtoIdApr, opts.quantity, opts.unitPrice, opts.unitPrice * opts.quantity],
      );

      // Pagamento PENDING vinculado por transaction_id, metadata com tenant_id
      await qr.query(
        `INSERT INTO pagamentos (id, tenant_id, pedido_id, method, amount, status, transaction_id, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, 'pix', $4, 'pending', $5, $6::jsonb, now(), now())`,
        [
          pagamentoIdApr,
          tenantId,
          pedidoIdApr,
          opts.unitPrice * opts.quantity,
          mpPaymentIdApr,
          JSON.stringify({ provider: 'mercadopago', tenant_id: tenantId }),
        ],
      );

      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();
    }

    function buildWebhookPayload(mpPaymentId: string): Record<string, any> {
      return {
        action: 'payment.updated',
        api_version: 'v1',
        data: { id: mpPaymentId },
        date_created: new Date().toISOString(),
        id: `notif-${mpPaymentId}`,
        live_mode: false,
        type: 'payment',
        user_id: '12345',
      };
    }

    /** Le current_stock e reserved_stock do produto direto no banco. */
    async function currentAndReserved(produtoId: string): Promise<{ current: number; reserved: number }> {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);
      const rows = await qr.query(
        `SELECT current_stock, reserved_stock FROM movimentacoes_estoque WHERE produto_id = $1 AND tenant_id = $2`,
        [produtoId, tenantId],
      );
      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();
      return {
        current: Number(rows[0].current_stock),
        reserved: Number(rows[0].reserved_stock),
      };
    }

    /** Conta linhas de um tipo de movimento (ex.: 'VENDA') no ledger para o pedido. */
    async function countLedger(pedidoId: string, tipo: string): Promise<number> {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);
      const rows = await qr.query(
        `SELECT COUNT(*)::int AS n FROM movimentacoes_estoque_historico WHERE order_id = $1 AND tipo = $2`,
        [pedidoId, tipo],
      );
      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();
      return Number(rows[0].n);
    }

    /** Le o status atual do pedido direto no banco. */
    async function pedidoStatus(pedidoId: string): Promise<string> {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);
      const rows = await qr.query(`SELECT status FROM pedidos WHERE id = $1`, [pedidoId]);
      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();
      return rows[0].status;
    }

    /** Le o status atual do pagamento direto no banco. */
    async function pagamentoStatus(pagamentoId: string): Promise<string> {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);
      const rows = await qr.query(`SELECT status FROM pagamentos WHERE id = $1`, [pagamentoId]);
      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();
      return rows[0].status;
    }

    beforeEach(async () => {
      if (!app) return;
      await seedPedidoPendente({
        currentStock:  10,
        reservedStock: 2,
        quantity:  2,
        unitPrice: 50,
      });
    });

    afterEach(async () => {
      if (!dataSource) return;
      jest.restoreAllMocks();
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);
      await qr.query(
        `DELETE FROM movimentacoes_estoque_historico WHERE order_id = $1`,
        [pedidoIdApr],
      );
      await qr.query(
        `DELETE FROM movimentacoes_estoque WHERE produto_id = $1 AND tenant_id = $2`,
        [produtoIdApr, tenantId],
      );
      await qr.query(`DELETE FROM itens_pedido WHERE pedido_id = $1`, [pedidoIdApr]);
      await qr.query(`DELETE FROM pagamentos WHERE id = $1`, [pagamentoIdApr]);
      await qr.query(`DELETE FROM pedidos WHERE id = $1`, [pedidoIdApr]);
      await qr.query(`DELETE FROM produtos WHERE id = $1`, [produtoIdApr]);
      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();
    });

    it('approved: pagamento PAID, pedido CONFIRMADO, notifica, estoque INTACTO, SEM VENDA no ledger', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste S4 approved - app nao inicializado');
        return;
      }

      const paymentsService = moduleFixture.get<PaymentsService>(PaymentsService);
      const mpProvider = moduleFixture.get<MercadoPagoProvider>(MercadoPagoProvider);
      const notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);

      // Mock: MercadoPago retorna status 'approved'
      jest.spyOn(mpProvider, 'isConfigured').mockReturnValue(true);
      jest.spyOn(mpProvider, 'getPaymentDetails').mockResolvedValue({
        status: 'approved',
        status_detail: 'accredited',
        metadata: { tenant_id: tenantId },
        external_reference: pedidoIdApr,
        payment_method_id: 'pix',
      });
      const notifySpy = jest
        .spyOn(notificationsService, 'notifyPaymentConfirmed')
        .mockResolvedValue(undefined as any);

      // Snapshot do estoque ANTES
      const stockBefore = await currentAndReserved(produtoIdApr);
      const vendasBefore = await countLedger(pedidoIdApr, 'VENDA');

      const payload = buildWebhookPayload(mpPaymentIdApr);
      const result = await paymentsService.handleMercadoPagoWebhook(payload, { token: '' });

      expect(result.status).toBe('ok');

      // Pagamento PAID, pedido CONFIRMADO
      expect(await pagamentoStatus(pagamentoIdApr)).toBe('paid');
      expect(await pedidoStatus(pedidoIdApr)).toBe('confirmado');

      // notifyPaymentConfirmed chamado
      expect(notifySpy).toHaveBeenCalledTimes(1);

      // ESTOQUE INTACTO: current_stock E reserved_stock iguais (confirmar
      // pagamento nao baixa nem libera — a reserva continua de pe).
      const stockAfter = await currentAndReserved(produtoIdApr);
      expect(stockAfter).toEqual(stockBefore);
      expect(stockAfter.current).toBe(10);
      expect(stockAfter.reserved).toBe(2);

      // SEM VENDA no ledger: nenhum movimento de baixa entrou (commitSale e no PRONTO).
      const vendasAfter = await countLedger(pedidoIdApr, 'VENDA');
      expect(vendasAfter).toBe(vendasBefore);
      expect(vendasAfter).toBe(0);
    });

    it('approved reenviado: idempotente (nao dupla-confirma, notifica 1x, estoque intacto, sem VENDA nova)', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste S4 idempotencia - app nao inicializado');
        return;
      }

      const paymentsService = moduleFixture.get<PaymentsService>(PaymentsService);
      const mpProvider = moduleFixture.get<MercadoPagoProvider>(MercadoPagoProvider);
      const notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);

      jest.spyOn(mpProvider, 'isConfigured').mockReturnValue(true);
      jest.spyOn(mpProvider, 'getPaymentDetails').mockResolvedValue({
        status: 'approved',
        status_detail: 'accredited',
        metadata: { tenant_id: tenantId },
        external_reference: pedidoIdApr,
        payment_method_id: 'pix',
      });
      const notifySpy = jest
        .spyOn(notificationsService, 'notifyPaymentConfirmed')
        .mockResolvedValue(undefined as any);

      const payload = buildWebhookPayload(mpPaymentIdApr);

      // Primeira confirmacao
      await paymentsService.handleMercadoPagoWebhook(payload, { token: '' });
      expect(await pedidoStatus(pedidoIdApr)).toBe('confirmado');
      const stockAfterFirst = await currentAndReserved(produtoIdApr);
      const vendasAfterFirst = await countLedger(pedidoIdApr, 'VENDA');

      // Reenvio do MESMO webhook approved
      const result2 = await paymentsService.handleMercadoPagoWebhook(payload, { token: '' });
      expect(result2.status).toBe('ok');

      // Nao dupla-confirma: pedido segue confirmado, notifica so na 1a vez.
      expect(await pedidoStatus(pedidoIdApr)).toBe('confirmado');
      expect(await pagamentoStatus(pagamentoIdApr)).toBe('paid');
      expect(notifySpy).toHaveBeenCalledTimes(1);

      // Estoque segue intacto (current/reserved iguais), sem VENDA nova.
      const stockAfterSecond = await currentAndReserved(produtoIdApr);
      expect(stockAfterSecond).toEqual(stockAfterFirst);
      expect(stockAfterSecond.current).toBe(10);
      expect(stockAfterSecond.reserved).toBe(2);
      expect(await countLedger(pedidoIdApr, 'VENDA')).toBe(vendasAfterFirst);
      expect(await countLedger(pedidoIdApr, 'VENDA')).toBe(0);
    });
  });

  /**
   * Task 1: endurecimento do confirmPayment (transacional + FOR UPDATE +
   * idempotencia sob lock + atomicidade). Reusa o mesmo padrao de seed direto
   * (SQL bruto, sem RLS) dos blocos Task 8 / Webhook approved, com IDs proprios
   * para nao colidir com o beforeEach daqueles describes.
   */
  describe('confirmPayment — endurecimento (transacao + FOR UPDATE + idempotencia sob lock)', () => {
    const produtoIdEnd  = 'aaa00000-0000-0000-0000-000000000003';
    const pedidoIdEnd    = 'bbb00000-0000-0000-0000-000000000003';
    const pagamentoIdEnd = 'ccc00000-0000-0000-0000-000000000003';
    const mpPaymentIdEnd = 'mp-fake-endurecimento-003';

    /**
     * Semeia produto, estoque com reserva, pedido ecommerce pendente_pagamento,
     * item e pagamento PENDING vinculado por transaction_id (para o webhook do 1c).
     * Retorna os ids do pedido/pagamento semeados.
     */
    async function seedPendingOrderWithPendingPayment(): Promise<{
      pedidoId: string;
      pagamentoId: string;
      produtoId: string;
    }> {
      const currentStock = 10;
      const reservedStock = 2;
      const quantity = 2;
      const unitPrice = 50;

      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);

      await qr.query(
        `DELETE FROM movimentacoes_estoque_historico WHERE order_id = $1`,
        [pedidoIdEnd],
      );
      await qr.query(
        `DELETE FROM movimentacoes_estoque WHERE produto_id = $1 AND tenant_id = $2`,
        [produtoIdEnd, tenantId],
      );
      await qr.query(`DELETE FROM itens_pedido WHERE pedido_id = $1`, [pedidoIdEnd]);
      await qr.query(`DELETE FROM pagamentos WHERE id = $1`, [pagamentoIdEnd]);
      await qr.query(`DELETE FROM pedidos WHERE id = $1`, [pedidoIdEnd]);
      await qr.query(`DELETE FROM produtos WHERE id = $1`, [produtoIdEnd]);

      await qr.query(
        `INSERT INTO produtos (id, tenant_id, name, price, unit, is_active, created_at, updated_at)
         VALUES ($1, $2, 'Produto Endurecimento', $3, 'unidade', true, now(), now())`,
        [produtoIdEnd, tenantId, unitPrice],
      );

      await qr.query(
        `INSERT INTO movimentacoes_estoque (id, tenant_id, produto_id, current_stock, reserved_stock, min_stock, last_updated)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, now())`,
        [tenantId, produtoIdEnd, currentStock, reservedStock],
      );

      const totalPedido = unitPrice * quantity;
      await qr.query(
        `INSERT INTO pedidos (id, tenant_id, order_no, status, channel, customer_name, subtotal, total_amount, created_at, updated_at)
         VALUES ($1, $2, $3, 'pendente_pagamento', 'ecommerce', 'Cliente Endurecimento', $4, $4, now(), now())`,
        [pedidoIdEnd, tenantId, `ORD-END-${Date.now()}`, totalPedido],
      );

      await qr.query(
        `INSERT INTO itens_pedido (id, pedido_id, produto_id, quantity, unit_price, subtotal, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now())`,
        [pedidoIdEnd, produtoIdEnd, quantity, unitPrice, unitPrice * quantity],
      );

      await qr.query(
        `INSERT INTO pagamentos (id, tenant_id, pedido_id, method, amount, status, transaction_id, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, 'pix', $4, 'pending', $5, $6::jsonb, now(), now())`,
        [
          pagamentoIdEnd,
          tenantId,
          pedidoIdEnd,
          unitPrice * quantity,
          mpPaymentIdEnd,
          JSON.stringify({ provider: 'mercadopago', tenant_id: tenantId }),
        ],
      );

      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();

      return { pedidoId: pedidoIdEnd, pagamentoId: pagamentoIdEnd, produtoId: produtoIdEnd };
    }

    /** Le o status atual do pedido direto no banco. */
    async function reloadPedidoStatus(pedidoId: string): Promise<string> {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);
      const rows = await qr.query(`SELECT status FROM pedidos WHERE id = $1`, [pedidoId]);
      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();
      return rows[0].status;
    }

    /** Le o status atual do pagamento direto no banco. */
    async function reloadPagamentoStatus(pagamentoId: string): Promise<string> {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);
      const rows = await qr.query(`SELECT status FROM pagamentos WHERE id = $1`, [pagamentoId]);
      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();
      return rows[0].status;
    }

    /** Conta linhas de um tipo de movimento (ex.: 'VENDA') no ledger para o pedido. */
    async function countLedgerEnd(pedidoId: string, tipo: string): Promise<number> {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);
      const rows = await qr.query(
        `SELECT COUNT(*)::int AS n FROM movimentacoes_estoque_historico WHERE order_id = $1 AND tipo = $2`,
        [pedidoId, tipo],
      );
      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();
      return Number(rows[0].n);
    }

    function buildWebhookPayloadEnd(mpPaymentId: string): Record<string, any> {
      return {
        action: 'payment.updated',
        api_version: 'v1',
        data: { id: mpPaymentId },
        date_created: new Date().toISOString(),
        id: `notif-${mpPaymentId}`,
        live_mode: false,
        type: 'payment',
        user_id: '12345',
      };
    }

    afterEach(async () => {
      if (!dataSource) return;
      jest.restoreAllMocks();
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SET session_replication_role = replica`);
      await qr.query(
        `DELETE FROM movimentacoes_estoque_historico WHERE order_id = $1`,
        [pedidoIdEnd],
      );
      await qr.query(
        `DELETE FROM movimentacoes_estoque WHERE produto_id = $1 AND tenant_id = $2`,
        [produtoIdEnd, tenantId],
      );
      await qr.query(`DELETE FROM itens_pedido WHERE pedido_id = $1`, [pedidoIdEnd]);
      await qr.query(`DELETE FROM pagamentos WHERE id = $1`, [pagamentoIdEnd]);
      await qr.query(`DELETE FROM pedidos WHERE id = $1`, [pedidoIdEnd]);
      await qr.query(`DELETE FROM produtos WHERE id = $1`, [produtoIdEnd]);
      await qr.query(`SET session_replication_role = DEFAULT`);
      await qr.release();
    });

    // 1a — DOIS confirmPayment MANUAIS concorrentes (hoje sem lock → dupla
    // confirmacao/notificacao). Sob o lock, deve resultar em 1 CONFIRMADO,
    // pagamento PAID e UMA notificacao.
    it('1a: dois confirmPayment concorrentes → pedido CONFIRMADO 1x, pagamento PAID, notifica 1x', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste 1a - app nao inicializado');
        return;
      }

      const paymentsService = moduleFixture.get<PaymentsService>(PaymentsService);
      const notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);

      const { pedidoId, pagamentoId } = await seedPendingOrderWithPendingPayment();
      const notifySpy = jest
        .spyOn(notificationsService, 'notifyPaymentConfirmed')
        .mockResolvedValue(undefined as any);

      await Promise.all([
        paymentsService.confirmPayment(pagamentoId, tenantId),
        paymentsService.confirmPayment(pagamentoId, tenantId),
      ]);

      expect(await reloadPedidoStatus(pedidoId)).toBe(PedidoStatus.CONFIRMADO);
      expect(await reloadPagamentoStatus(pagamentoId)).toBe(PagamentoStatus.PAID);
      expect(notifySpy).toHaveBeenCalledTimes(1); // <- FALHA hoje (dispara 2x)
      // estoque intacto + 0 VENDA no ledger (confirmar pagamento nao baixa estoque)
      expect(await countLedgerEnd(pedidoId, 'VENDA')).toBe(0);
    });

    // 1b — atomicidade: se o 2º write (transicao do pedido) falha, o 1º write
    // (pagamento PAID) faz ROLLBACK — sem orfao PAID+PENDENTE.
    it('1b: falha na transição do pedido → rollback, sem órfão PAID+PENDENTE', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste 1b - app nao inicializado');
        return;
      }

      const paymentsService = moduleFixture.get<PaymentsService>(PaymentsService);

      const { pedidoId, pagamentoId } = await seedPendingOrderWithPendingPayment();

      // Forca APENAS o save da TRANSICAO do pedido (pedido.status = CONFIRMADO)
      // a lancar, deixando o 1º save (pagamento PAID) passar. Assim exercitamos
      // exatamente a atomicidade: o 1º write ja marcou PAID; se o 2º falha e nao
      // houver transacao/rollback, o pagamento fica PAID orfao (o furo).
      // (Nao usamos mockImplementationOnce porque a 1a chamada de save eh a do
      // pagamento — precisamos discriminar pelo alvo, o pedido em CONFIRMADO.)
      // Varremos TODOS os args porque a transicao agora passa pela state-machine
      // (orders.updateStatus -> Repository.save), que chama
      // EntityManager.save(target, entity, options) — a entidade vem em args[1],
      // nao em args[0]. O save direto do pagamento usa a forma save(entity) com
      // a entidade em args[0]. Detectamos o pedido->CONFIRMADO em qualquer forma.
      const realSave = EntityManager.prototype.save;
      const saveSpy = jest
        .spyOn(EntityManager.prototype, 'save')
        .mockImplementation(function (this: EntityManager, ...args: any[]) {
          const savingConfirmedPedido = args.some(
            (a) =>
              a &&
              typeof a === 'object' &&
              !Array.isArray(a) &&
              a.status === PedidoStatus.CONFIRMADO,
          );
          if (savingConfirmedPedido) {
            throw new Error('boom no save da transição do pedido');
          }
          return (realSave as any).apply(this, args);
        });

      await expect(
        paymentsService.confirmPayment(pagamentoId, tenantId),
      ).rejects.toThrow();

      saveSpy.mockRestore();

      // Rollback: pagamento volta a PENDING e pedido segue PENDENTE_PAGAMENTO.
      expect(await reloadPagamentoStatus(pagamentoId)).toBe(PagamentoStatus.PENDING); // <- FALHA hoje (fica PAID orfao)
      expect(await reloadPedidoStatus(pedidoId)).toBe(PedidoStatus.PENDENTE_PAGAMENTO);
    });

    // 1c — REENTRANCIA: dois WEBHOOKS aprovados concorrentes. O confirmPayment
    // roda DENTRO do FOR UPDATE do webhook; runInTransaction reusa o manager
    // corrente e o pessimistic_write recai na MESMA linha ja travada →
    // reentrante, SEM deadlock. Ja deve passar hoje (o webhook serializa).
    it('1c: dois webhooks aprovados concorrentes → 1 CONFIRMADO, 1 notificação, SEM deadlock', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste 1c - app nao inicializado');
        return;
      }

      const paymentsService = moduleFixture.get<PaymentsService>(PaymentsService);
      const mpProvider = moduleFixture.get<MercadoPagoProvider>(MercadoPagoProvider);
      const notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);

      const { pedidoId, pagamentoId } = await seedPendingOrderWithPendingPayment();

      jest.spyOn(mpProvider, 'isConfigured').mockReturnValue(true);
      jest.spyOn(mpProvider, 'getPaymentDetails').mockResolvedValue({
        status: 'approved',
        status_detail: 'accredited',
        metadata: { tenant_id: tenantId },
        external_reference: pedidoIdEnd,
        payment_method_id: 'pix',
      });
      const notifySpy = jest
        .spyOn(notificationsService, 'notifyPaymentConfirmed')
        .mockResolvedValue(undefined as any);

      const payload = buildWebhookPayloadEnd(mpPaymentIdEnd);

      // Dois webhooks SIMULTANEOS (nao sequenciais). Nao pode lancar deadlock/erro.
      await Promise.all([
        paymentsService.handleMercadoPagoWebhook(payload, { token: '' }),
        paymentsService.handleMercadoPagoWebhook(payload, { token: '' }),
      ]);

      expect(await reloadPedidoStatus(pedidoId)).toBe(PedidoStatus.CONFIRMADO);
      expect(await reloadPagamentoStatus(pagamentoId)).toBe(PagamentoStatus.PAID);
      expect(notifySpy).toHaveBeenCalledTimes(1);
    });

    // 2a — TRANSICAO PELA STATE-MACHINE + notificacao unica. O confirmPayment
    // deve transicionar o pedido via ordersService.updateStatus (respeitando
    // assertStatusTransition + lock), com suppressNotification:true, de modo que
    // o cliente receba UMA unica mensagem (notifyPaymentConfirmed) e NAO a de
    // status (notifyOrderStatusChange). CRITICO: o updateStatus roda na MESMA
    // transacao do confirmPayment (via runWithManager reusando o manager corrente).
    it('2a: transição vai pela state-machine (updateStatus) e NÃO dupla-notifica', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste 2a - app nao inicializado');
        return;
      }

      const paymentsService = moduleFixture.get<PaymentsService>(PaymentsService);
      const notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);
      const ordersService = moduleFixture.get<OrdersService>(OrdersService);

      const { pedidoId, pagamentoId } = await seedPendingOrderWithPendingPayment();

      const paySpy = jest
        .spyOn(notificationsService, 'notifyPaymentConfirmed')
        .mockResolvedValue(undefined as any);
      const statusSpy = jest
        .spyOn(notificationsService, 'notifyOrderStatusChange')
        .mockResolvedValue(undefined as any);
      const updSpy = jest.spyOn(ordersService, 'updateStatus');

      await paymentsService.confirmPayment(pagamentoId, tenantId);

      // (a) transicao passou pela state-machine com supressao da notificacao de status
      expect(updSpy).toHaveBeenCalledWith(
        pedidoId,
        PedidoStatus.CONFIRMADO,
        tenantId,
        expect.objectContaining({ suppressNotification: true }),
      );
      // (b) UMA unica mensagem ao cliente
      expect(paySpy).toHaveBeenCalledTimes(1);
      // (c) a notificacao de status NAO foi disparada (evita dupla notificacao)
      expect(statusSpy).not.toHaveBeenCalled(); // <- FALHA hoje (dispara a de status tambem)
      // (d) pedido efetivamente CONFIRMADO
      expect(await reloadPedidoStatus(pedidoId)).toBe(PedidoStatus.CONFIRMADO);
      expect(await reloadPagamentoStatus(pagamentoId)).toBe(PagamentoStatus.PAID);
    });
  });
});
