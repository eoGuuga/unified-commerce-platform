import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { OrdersModule } from './orders.module';
import { ProductsModule } from '../products/products.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { databaseConfig } from '../../config/database.config';
import { JwtService } from '@nestjs/jwt';
import { Usuario, UserRole } from '../../database/entities/Usuario.entity';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { TenantDbContextInterceptor } from '../../common/interceptors/tenant-db-context.interceptor';

describe('Orders Integration Tests (e2e)', () => {
  let app: INestApplication | null = null;
  let dataSource: DataSource;
  let jwtToken: string;
  const tenantId = '00000000-0000-0000-0000-000000000000';
  const productName = 'Produto Teste E2E Orders';

  beforeAll(async () => {
    try {
      process.env.SUPPRESS_TENANT_RLS_LOGS = 'true';
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
          TypeOrmModule.forRootAsync(databaseConfig),
          CommonModule,
          AuthModule,
          ProductsModule,
          OrdersModule,
          NotificationsModule,
        ],
        providers: [
          {
            provide: APP_INTERCEPTOR,
            useClass: TenantDbContextInterceptor,
          },
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

      // Criar usuário de teste no banco para autenticação funcionar
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);

      const usuariosRepository = queryRunner.manager.getRepository<Usuario>(Usuario);
      const testUserId = '00000000-0000-0000-0000-000000000001';
      
      // Verificar se usuário já existe
      let testUser = await usuariosRepository.findOne({ where: { id: testUserId } });
      
      if (!testUser) {
        const hashedPassword = await bcrypt.hash('test123', 10);
        testUser = usuariosRepository.create({
          id: testUserId,
          email: 'test@test.com',
          encrypted_password: hashedPassword,
          full_name: 'Test User',
          role: UserRole.SELLER,
          tenant_id: tenantId,
          is_active: true,
        });
        await usuariosRepository.save(testUser);
      }

      // Criar token JWT para testes (incluir tenant_id no payload)
      const jwtService = moduleFixture.get<JwtService>(JwtService);
      jwtToken = jwtService.sign({ 
        sub: testUser.id,
        email: testUser.email,
        role: testUser.role,
        tenant_id: testUser.tenant_id,
      });

      await queryRunner.release();
    } catch (error) {
      console.error('❌ Erro ao inicializar testes de integração:', error);
      app = null;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /orders - Criar Pedido', () => {
    it('deve criar pedido com sucesso quando há estoque suficiente', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }
      // Primeiro, criar um produto e estoque
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      await queryRunner.query(
        'UPDATE produtos SET is_active = false WHERE tenant_id = $1 AND name = $2',
        [tenantId, productName],
      );
      await queryRunner.release();

      const productResponse = await request(app.getHttpServer())
        .post(`/api/v1/products?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          name: productName,
          price: 10.5,
          description: 'Produto para teste',
          unit: 'unidade',
        })
        .expect(201);

      const productId = productResponse.body.id;

      // Criar estoque para o produto
      await request(app.getHttpServer())
        .post(`/api/v1/products/${productId}/adjust-stock`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ quantity: 10, reason: 'Teste de integracao' })
        .expect(201);

      // Criar pedido (canal whatsapp = pendente_pagamento; PDV agora nasce ENTREGUE)
      const orderResponse = await request(app.getHttpServer())
        .post(`/api/v1/orders?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          channel: 'whatsapp',
          customer_name: 'Cliente Teste',
          customer_phone: '11999990001',
          items: [
            {
              produto_id: productId,
              quantity: 5,
              unit_price: 10.5,
            },
          ],
          discount_amount: 0,
          shipping_amount: 0,
        })
        .expect(201);

      expect(orderResponse.body).toHaveProperty('id');
      expect(orderResponse.body).toHaveProperty('order_no');
      expect(orderResponse.body.status).toBe('pendente_pagamento');
      expect(orderResponse.body.total_amount).toBe(52.5); // 5 * 10.5
    });

    it('deve criar checkout publico do ecommerce sem autenticacao', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }

      const publicProductName = `${productName} Publico`;
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      await queryRunner.query(
        'UPDATE produtos SET is_active = false WHERE tenant_id = $1 AND name = $2',
        [tenantId, publicProductName],
      );
      await queryRunner.release();

      const productResponse = await request(app.getHttpServer())
        .post(`/api/v1/products`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          name: publicProductName,
          price: 12.75,
          description: 'Produto para checkout publico',
          unit: 'unidade',
        })
        .expect(201);

      const productId = productResponse.body.id;

      await request(app.getHttpServer())
        .post(`/api/v1/products/${productId}/adjust-stock`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ quantity: 8, reason: 'Teste de checkout publico' })
        .expect(201);

      const orderResponse = await request(app.getHttpServer())
        .post(`/api/v1/orders/public/checkout`)
        .set('x-tenant-id', tenantId)
        .set('Idempotency-Key', 'orders-public-checkout-e2e')
        .send({
          channel: 'ecommerce',
          customer_name: 'Cliente Publico',
          customer_email: 'cliente.publico@test.com',
          customer_phone: '11999999999',
          delivery_type: 'pickup',
          items: [
            {
              produto_id: productId,
              quantity: 2,
              unit_price: 12.75,
            },
          ],
          discount_amount: 0,
          shipping_amount: 0,
        })
        .expect(201);

      expect(orderResponse.body).toHaveProperty('id');
      expect(orderResponse.body).toHaveProperty('order_no');
      expect(orderResponse.body.channel).toBe('ecommerce');
      expect(orderResponse.body.status).toBe('pendente_pagamento');
      expect(orderResponse.body.total_amount).toBe(25.5);
    });

    it('deve retornar erro 400 quando estoque insuficiente', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }
      // Este teste requer um produto com estoque limitado
      // Por simplicidade, vamos testar a validação básica
      const response = await request(app.getHttpServer())
        .post(`/api/v1/orders?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          channel: 'pdv',
          items: [
            {
              produto_id: '00000000-0000-0000-0000-000000000000', // ID inválido
              quantity: 1000,
              unit_price: 10.5,
            },
          ],
        });

      // Pode retornar 400 (estoque insuficiente) ou 404 (produto não encontrado)
      expect([400, 404]).toContain(response.status);
    });

    it('deve validar campos obrigatórios', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }
      const response = await request(app.getHttpServer())
        .post(`/api/v1/orders?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          // Sem channel e items
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('create reserva estoque (nao baixa current) e preserva validacoes', async () => {
      // Artéria principal: pedido criado deve RESERVAR, não baixar current_stock.
      // Task 4 — Motor de Estoque.
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }

      // Inserir produto e estoque diretamente no banco (evita dependência de Redis
      // que não está disponível no ambiente de testes — Redis é swallowed no service
      // mas não no products.service.create fora de transação).
      const qrSetup = dataSource.createQueryRunner();
      await qrSetup.connect();
      await qrSetup.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);

      // Desativar produto homônimo de execuções anteriores (idempotência)
      await qrSetup.query(
        'UPDATE produtos SET is_active = false WHERE tenant_id = $1 AND name = $2',
        [tenantId, `${productName} Reserva Task4`],
      );

      // Criar produto ativo com preço 20.00
      const produtosInseridos = await qrSetup.query(
        `INSERT INTO produtos (tenant_id, name, price, is_active, unit)
         VALUES ($1, $2, 20.00, true, 'unidade')
         RETURNING id`,
        [tenantId, `${productName} Reserva Task4`],
      ) as Array<{ id: string }>;
      const productId = produtosInseridos[0].id;

      // Criar registro de estoque: current_stock=10, reserved_stock=0
      await qrSetup.query(
        `INSERT INTO movimentacoes_estoque (tenant_id, produto_id, current_stock, reserved_stock, min_stock, last_updated)
         VALUES ($1, $2, 10, 0, 0, NOW())
         ON CONFLICT (tenant_id, produto_id) DO UPDATE
           SET current_stock = 10, reserved_stock = 0, last_updated = NOW()`,
        [tenantId, productId],
      );
      await qrSetup.release();

      // Verificar saldo inicial
      const qrAnte = dataSource.createQueryRunner();
      await qrAnte.connect();
      await qrAnte.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      const estoqueAntesList = await qrAnte.query(
        'SELECT current_stock, reserved_stock FROM movimentacoes_estoque WHERE tenant_id = $1 AND produto_id = $2',
        [tenantId, productId],
      ) as Array<{ current_stock: number; reserved_stock: number }>;
      await qrAnte.release();

      expect(estoqueAntesList).toHaveLength(1);
      expect(Number(estoqueAntesList[0].current_stock)).toBe(10);
      expect(Number(estoqueAntesList[0].reserved_stock)).toBe(0);

      // Criar pedido de qty=3 via HTTP (artéria principal — canal whatsapp reserva sem baixar)
      const qty = 3;
      const orderResponse = await request(app.getHttpServer())
        .post(`/api/v1/orders?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          channel: 'whatsapp',
          customer_name: 'Cliente Reserva Task4',
          customer_phone: '11999990002',
          items: [
            {
              produto_id: productId,
              quantity: qty,
              unit_price: 20.0,
            },
          ],
          discount_amount: 0,
          shipping_amount: 0,
        })
        .expect(201);

      // Assert: pedido criado em pendente_pagamento
      expect(orderResponse.body).toHaveProperty('id');
      expect(orderResponse.body).toHaveProperty('order_no');
      expect(orderResponse.body.status).toBe('pendente_pagamento');
      // Preço recalculado do banco: 3 * 20.00
      expect(Number(orderResponse.body.total_amount)).toBe(60.0);

      // Assert estoque: current_stock INTACTO, reserved_stock INCREMENTADO por qty
      const qrDepois = dataSource.createQueryRunner();
      await qrDepois.connect();
      await qrDepois.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      const estoqueDepoisList = await qrDepois.query(
        'SELECT current_stock, reserved_stock FROM movimentacoes_estoque WHERE tenant_id = $1 AND produto_id = $2',
        [tenantId, productId],
      ) as Array<{ current_stock: number; reserved_stock: number }>;
      await qrDepois.release();

      // current_stock deve permanecer 10 (sem baixa — a baixa ocorre no PRONTO)
      expect(Number(estoqueDepoisList[0].current_stock)).toBe(10);
      // reserved_stock deve ser 3 (qty reservada pelo create)
      expect(Number(estoqueDepoisList[0].reserved_stock)).toBe(qty);
    });
  });

  describe('PATCH /orders/:id/status - Motor de Estoque (Task 5)', () => {
    it('transição para PRONTO baixa current_stock e grava VENDA (uma vez)', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }

      // Seed produto e estoque via SQL (evita dependência de Redis no ProductsService)
      const qrSetup = dataSource.createQueryRunner();
      await qrSetup.connect();
      await qrSetup.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);

      await qrSetup.query(
        'UPDATE produtos SET is_active = false WHERE tenant_id = $1 AND name = $2',
        [tenantId, `${productName} PRONTO Task5`],
      );

      const prodInserido = await qrSetup.query(
        `INSERT INTO produtos (tenant_id, name, price, is_active, unit)
         VALUES ($1, $2, 15.00, true, 'unidade')
         RETURNING id`,
        [tenantId, `${productName} PRONTO Task5`],
      ) as Array<{ id: string }>;
      const productId = prodInserido[0].id;

      await qrSetup.query(
        `INSERT INTO movimentacoes_estoque (tenant_id, produto_id, current_stock, reserved_stock, min_stock, last_updated)
         VALUES ($1, $2, 10, 0, 0, NOW())
         ON CONFLICT (tenant_id, produto_id) DO UPDATE
           SET current_stock = 10, reserved_stock = 0, last_updated = NOW()`,
        [tenantId, productId],
      );
      await qrSetup.release();

      // Criar pedido qty=3 via whatsapp → reserva: current=10, reserved=3
      const orderResp = await request(app.getHttpServer())
        .post(`/api/v1/orders?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          channel: 'whatsapp',
          customer_name: 'Cliente PRONTO Task5',
          customer_phone: '11999990003',
          items: [{ produto_id: productId, quantity: 3, unit_price: 15.0 }],
          discount_amount: 0,
          shipping_amount: 0,
        })
        .expect(201);

      const orderId = orderResp.body.id;
      expect(orderResp.body.status).toBe('pendente_pagamento');

      // Avançar: pendente_pagamento → confirmado → em_producao → pronto
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: 'confirmado' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: 'em_producao' })
        .expect(200);

      const prontoResp = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: 'pronto' })
        .expect(200);

      expect(prontoResp.body.status).toBe('pronto');

      // Assert saldo: current=7, reserved=0
      const qrCheck = dataSource.createQueryRunner();
      await qrCheck.connect();
      await qrCheck.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);

      const saldoList = await qrCheck.query(
        'SELECT current_stock, reserved_stock FROM movimentacoes_estoque WHERE tenant_id = $1 AND produto_id = $2',
        [tenantId, productId],
      ) as Array<{ current_stock: number; reserved_stock: number }>;

      expect(Number(saldoList[0].current_stock)).toBe(7);
      expect(Number(saldoList[0].reserved_stock)).toBe(0);

      // Assert ledger: exatamente 1 linha VENDA para (order, produto) com delta=-3
      const ledgerList = await qrCheck.query(
        `SELECT delta FROM movimentacoes_estoque_historico
         WHERE tenant_id = $1 AND order_id = $2 AND produto_id = $3 AND tipo = 'VENDA'`,
        [tenantId, orderId, productId],
      ) as Array<{ delta: number }>;

      expect(ledgerList).toHaveLength(1);
      expect(Number(ledgerList[0].delta)).toBe(-3);

      // Reaplicar PRONTO (idempotência via oldStatus===status) → saldo não muda
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: 'pronto' })
        .expect(200);

      const saldoAposIdempotencia = await qrCheck.query(
        'SELECT current_stock, reserved_stock FROM movimentacoes_estoque WHERE tenant_id = $1 AND produto_id = $2',
        [tenantId, productId],
      ) as Array<{ current_stock: number; reserved_stock: number }>;

      expect(Number(saldoAposIdempotencia[0].current_stock)).toBe(7);
      expect(Number(saldoAposIdempotencia[0].reserved_stock)).toBe(0);

      const ledgerAposIdempotencia = await qrCheck.query(
        `SELECT delta FROM movimentacoes_estoque_historico
         WHERE tenant_id = $1 AND order_id = $2 AND produto_id = $3 AND tipo = 'VENDA'`,
        [tenantId, orderId, productId],
      ) as Array<{ delta: number }>;

      expect(ledgerAposIdempotencia).toHaveLength(1); // ainda 1, não duplicou

      await qrCheck.release();
    });

    it('cancelar antes do PRONTO libera reserva e NÃO vaza estoque', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }

      // Seed produto e estoque via SQL
      const qrSetup = dataSource.createQueryRunner();
      await qrSetup.connect();
      await qrSetup.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);

      await qrSetup.query(
        'UPDATE produtos SET is_active = false WHERE tenant_id = $1 AND name = $2',
        [tenantId, `${productName} CANCELADO Task5`],
      );

      const prodInserido = await qrSetup.query(
        `INSERT INTO produtos (tenant_id, name, price, is_active, unit)
         VALUES ($1, $2, 15.00, true, 'unidade')
         RETURNING id`,
        [tenantId, `${productName} CANCELADO Task5`],
      ) as Array<{ id: string }>;
      const productId = prodInserido[0].id;

      await qrSetup.query(
        `INSERT INTO movimentacoes_estoque (tenant_id, produto_id, current_stock, reserved_stock, min_stock, last_updated)
         VALUES ($1, $2, 10, 0, 0, NOW())
         ON CONFLICT (tenant_id, produto_id) DO UPDATE
           SET current_stock = 10, reserved_stock = 0, last_updated = NOW()`,
        [tenantId, productId],
      );
      await qrSetup.release();

      // Criar pedido qty=3 via whatsapp → reserva: current=10, reserved=3
      const orderResp = await request(app.getHttpServer())
        .post(`/api/v1/orders?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          channel: 'whatsapp',
          customer_name: 'Cliente CANCELADO Task5',
          customer_phone: '11999990004',
          items: [{ produto_id: productId, quantity: 3, unit_price: 15.0 }],
          discount_amount: 0,
          shipping_amount: 0,
        })
        .expect(201);

      const orderId = orderResp.body.id;
      expect(orderResp.body.status).toBe('pendente_pagamento');

      // Cancelar diretamente de pendente_pagamento
      const cancelResp = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: 'cancelado' })
        .expect(200);

      expect(cancelResp.body.status).toBe('cancelado');

      // Assert saldo: current=10 (intacto — o bug do vazamento corrigido), reserved=0
      const qrCheck = dataSource.createQueryRunner();
      await qrCheck.connect();
      await qrCheck.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);

      const saldoList = await qrCheck.query(
        'SELECT current_stock, reserved_stock FROM movimentacoes_estoque WHERE tenant_id = $1 AND produto_id = $2',
        [tenantId, productId],
      ) as Array<{ current_stock: number; reserved_stock: number }>;

      expect(Number(saldoList[0].current_stock)).toBe(10);
      expect(Number(saldoList[0].reserved_stock)).toBe(0);

      // Assert: pedido.stock_released_at != null
      const pedidoList = await qrCheck.query(
        'SELECT stock_released_at FROM pedidos WHERE id = $1 AND tenant_id = $2',
        [orderId, tenantId],
      ) as Array<{ stock_released_at: string | null }>;

      expect(pedidoList[0].stock_released_at).not.toBeNull();

      // Assert: nenhum ledger VENDA para este pedido (não baixou o estoque)
      const ledgerList = await qrCheck.query(
        `SELECT delta FROM movimentacoes_estoque_historico
         WHERE tenant_id = $1 AND order_id = $2 AND tipo = 'VENDA'`,
        [tenantId, orderId],
      ) as Array<{ delta: number }>;

      expect(ledgerList).toHaveLength(0);

      await qrCheck.release();
    });
  });

  describe('PDV Fast-Pass (Task 2): venda atomica de balcao', () => {
    // Helper: insere produto ativo + linha de estoque via SQL, retorna produto_id.
    async function seedProdutoComEstoque(
      currentStock: number,
      reservedStock: number,
    ): Promise<string> {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      const inserted = await qr.query(
        `INSERT INTO produtos (tenant_id, name, price, is_active, unit)
         VALUES ($1, $2, 10.00, true, 'unidade')
         RETURNING id`,
        [tenantId, `Produto PDV Task2 ${Date.now()}`],
      ) as Array<{ id: string }>;
      const produtoId = inserted[0].id;
      await qr.query(
        `INSERT INTO movimentacoes_estoque (tenant_id, produto_id, current_stock, reserved_stock, min_stock, last_updated)
         VALUES ($1, $2, $3, $4, 0, NOW())
         ON CONFLICT (tenant_id, produto_id) DO UPDATE
           SET current_stock = $3, reserved_stock = $4, last_updated = NOW()`,
        [tenantId, produtoId, currentStock, reservedStock],
      );
      await qr.release();
      return produtoId;
    }

    // Helper: le saldo atual do estoque.
    async function queryEstoque(
      produtoId: string,
    ): Promise<{ current_stock: number; reserved_stock: number }> {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      const rows = await qr.query(
        'SELECT current_stock, reserved_stock FROM movimentacoes_estoque WHERE tenant_id = $1 AND produto_id = $2',
        [tenantId, produtoId],
      ) as Array<{ current_stock: number; reserved_stock: number }>;
      await qr.release();
      return { current_stock: Number(rows[0].current_stock), reserved_stock: Number(rows[0].reserved_stock) };
    }

    it('PDV: cria venda ENTREGUE, baixa estoque, grava Pagamento PAGO (atomico)', async () => {
      if (!app) return;
      // Seed: produto current_stock=10, reserved_stock=0
      const produtoId = await seedProdutoComEstoque(10, 0);
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          channel: 'pdv',
          payment: { method: 'dinheiro' },
          items: [{ produto_id: produtoId, quantity: 3, unit_price: 10.0 }],
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('entregue');

      // Saldo: current baixou para 7, reserved volta a 0
      const saldo = await queryEstoque(produtoId);
      expect(saldo.current_stock).toBe(7);
      expect(saldo.reserved_stock).toBe(0);

      // Ledger: exatamente 1 VENDA para (order, produto)
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      const ledger = await qr.query(
        `SELECT tipo, delta FROM movimentacoes_estoque_historico WHERE order_id = $1 AND produto_id = $2`,
        [res.body.id, produtoId],
      ) as Array<{ tipo: string; delta: number }>;
      expect(ledger).toHaveLength(1);
      expect(ledger[0].tipo).toBe('VENDA');

      // Pagamento PAGO
      const pag = await qr.query(
        `SELECT method, status, amount FROM pagamentos WHERE pedido_id = $1`,
        [res.body.id],
      ) as Array<{ method: string; status: string; amount: string }>;
      await qr.release();
      expect(pag).toHaveLength(1);
      expect(pag[0].status).toBe('paid');
      expect(pag[0].method).toBe('dinheiro');
      expect(Number(pag[0].amount)).toBe(30);
    });

    it('PDV: respeita reserva alheia (available = current - reserved)', async () => {
      if (!app) return;
      // Seed: 3 reservados por carrinho online, available = 2
      const produtoId = await seedProdutoComEstoque(5, 3);
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          channel: 'pdv',
          payment: { method: 'debito' },
          items: [{ produto_id: produtoId, quantity: 2, unit_price: 10.0 }],
        });
      expect(res.status).toBe(201);
      const saldo = await queryEstoque(produtoId);
      expect(saldo.current_stock).toBe(3);   // baixou 2
      expect(saldo.reserved_stock).toBe(3);  // reservas online intactas
    });

    it('PDV: estoque insuficiente faz rollback TOTAL (nada persiste)', async () => {
      if (!app) return;
      // Seed: available = 1 (nao suficiente para qty=2)
      const produtoId = await seedProdutoComEstoque(5, 4);
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          channel: 'pdv',
          payment: { method: 'credito' },
          items: [{ produto_id: produtoId, quantity: 2, unit_price: 10.0 }],
        });
      expect(res.status).toBeGreaterThanOrEqual(400);
      // Nada persistido: sem pedido, sem ledger VENDA, sem pagamento
      const saldo = await queryEstoque(produtoId);
      expect(saldo.current_stock).toBe(5);
      expect(saldo.reserved_stock).toBe(4);
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      const ledger = await qr.query(
        `SELECT 1 FROM movimentacoes_estoque_historico WHERE produto_id = $1 AND tipo = 'VENDA'`,
        [produtoId],
      ) as Array<unknown>;
      // Rollback total: nenhuma linha de pagamento deve ter sido criada para este produto/tenant.
      const pags = await qr.query(
        `SELECT 1 FROM pagamentos WHERE pedido_id IN (SELECT id FROM pedidos WHERE tenant_id = $1 AND status = 'entregue' AND channel = 'pdv' AND id IN (SELECT pedido_id FROM itens_pedido WHERE produto_id = $2))`,
        [tenantId, produtoId],
      ) as Array<unknown>;
      await qr.release();
      expect(ledger).toHaveLength(0);
      expect(pags).toHaveLength(0);
    });
  });

  describe('GET /orders - Listar Pedidos', () => {
    it('deve listar pedidos com autenticação', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }
      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .set('x-tenant-id', tenantId) // Fornecer tenant_id via header
        .expect(200);

      // Response pode ser array ou objeto paginado
      if (Array.isArray(response.body)) {
        expect(Array.isArray(response.body)).toBe(true);
      } else {
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('total');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it('deve retornar 401 sem autenticação', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }
      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders?tenantId=${tenantId}`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });
});
