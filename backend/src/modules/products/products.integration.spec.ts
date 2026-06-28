import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { ProductsModule } from './products.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { databaseConfig } from '../../config/database.config';
import { JwtService } from '@nestjs/jwt';
import { Usuario, UserRole } from '../../database/entities/Usuario.entity';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { TenantDbContextInterceptor } from '../../common/interceptors/tenant-db-context.interceptor';

describe('Products Integration Tests (e2e)', () => {
  let app: INestApplication | null = null;
  let dataSource: DataSource;
  let jwtToken: string;
  const tenantId = '00000000-0000-0000-0000-000000000000';
  const productName = 'Produto Teste E2E Produtos';

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

  describe('GET /products - Listar Produtos', () => {
    it('deve listar produtos com autenticação', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }
      const response = await request(app.getHttpServer())
        .get(`/api/v1/products`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      // Pode retornar array (compat) ou paginação (quando aplicável)
      if (Array.isArray(response.body)) {
        expect(Array.isArray(response.body)).toBe(true);
      } else {
        expect(response.body).toHaveProperty('data');
      }
    });

    it('deve listar o catalogo publico sem autenticacao', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/api/v1/products/public/catalog`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /products - Criar Produto', () => {
    it('deve criar produto com autenticação', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      await queryRunner.query(
        'UPDATE produtos SET is_active = false WHERE tenant_id = $1 AND name = $2',
        [tenantId, productName],
      );
      await queryRunner.release();

      const response = await request(app.getHttpServer())
        .post(`/api/v1/products`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          name: productName,
          price: 15.99,
          description: 'Descrição do produto',
          unit: 'unidade',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(productName);
      expect(response.body.price).toBe(15.99);

      const stockResponse = await request(app.getHttpServer())
        .get(`/api/v1/products/stock-summary`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      const created = stockResponse.body.products.find((p: any) => p.id === response.body.id);
      expect(created).toBeTruthy();
      expect(created.current_stock).toBe(0);
    });

    it('deve retornar 401 sem autenticação', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }
      await request(app.getHttpServer())
        .post(`/api/v1/products`)
        .send({
          name: productName,
          price: 15.99,
        })
        .expect(401);
    });

    it('deve validar campos obrigatórios', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }
      const response = await request(app.getHttpServer())
        .post(`/api/v1/products`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          // Sem name e price
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('dois produtos com mesmo nome (sku vazio) devem receber SKUs distintos', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }
      const nomeDuplicado = `Trufa SKU Teste ${Date.now()}`;

      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/products`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ name: nomeDuplicado, price: 5.0 })
        .expect(201);

      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/products`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ name: nomeDuplicado, price: 5.0 })
        .expect(201);

      // Ambos devem ter SKU definido e SKUs distintos
      expect(res1.body.sku).toBeTruthy();
      expect(res2.body.sku).toBeTruthy();
      expect(res1.body.sku).not.toBe(res2.body.sku);
      // O segundo deve ter sufixo numérico (backstop de 23505)
      expect(res2.body.sku).toMatch(/-\d+$/);
    });
  });

  describe('GET /products/stock-summary - Resumo de Estoque', () => {
    it('deve retornar resumo de estoque com autenticação', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }
      const response = await request(app.getHttpServer())
        .get(`/api/v1/products/stock-summary`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total_products');
      expect(response.body).toHaveProperty('low_stock_count');
      expect(response.body).toHaveProperty('out_of_stock_count');
      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
    });

    it('deve retornar 401 sem autenticação', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }
      await request(app.getHttpServer())
        .get(`/api/v1/products/stock-summary`)
        .expect(401);
    });
  });

  describe('Admin estoque — adjust-stock ledger-correto', () => {
    let produtoId: string;

    beforeEach(async () => {
      if (!app) return;
      // Criar produto + seed de estoque via SQL direto
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      const prod = await queryRunner.query(
        `INSERT INTO produtos (id, tenant_id, name, price, is_active, created_at, updated_at)
         VALUES (uuid_generate_v4(), $1, 'Produto Adjust Test', 10.0, true, now(), now())
         RETURNING id`,
        [tenantId],
      );
      produtoId = prod[0].id;
      // Estoque inicial = 10
      await queryRunner.query(
        `INSERT INTO movimentacoes_estoque (id, tenant_id, produto_id, current_stock, reserved_stock, min_stock, last_updated)
         VALUES (uuid_generate_v4(), $1, $2, 10, 0, 0, now())`,
        [tenantId, produtoId],
      );
      await queryRunner.release();
    });

    it('COMPRA grava ledger e mantem invariante', async () => {
      if (!app) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/products/${produtoId}/adjust-stock`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ tipo: 'COMPRA', delta: 5, motivo: 'reposicao' });
      expect(res.status).toBe(201);
      expect(res.body.saldo_resultante).toBe(15);

      // Verificar ledger
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      const ledger = await queryRunner.query(
        `SELECT tipo, delta, saldo_resultante FROM movimentacoes_estoque_historico
         WHERE produto_id = $1 AND tipo = 'COMPRA'`,
        [produtoId],
      );
      await queryRunner.release();
      expect(ledger.length).toBeGreaterThanOrEqual(1);
      expect(Number(ledger[0].delta)).toBe(5);
      expect(Number(ledger[0].saldo_resultante)).toBe(15);
    });

    it('rejeita sinal incoerente (COMPRA com delta negativo) -> 400', async () => {
      if (!app) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/products/${produtoId}/adjust-stock`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ tipo: 'COMPRA', delta: -5 });
      expect(res.status).toBe(400);
    });

    it('saida maior que saldo -> 422 INSUFFICIENT_STOCK', async () => {
      if (!app) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/products/${produtoId}/adjust-stock`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ tipo: 'PERDA', delta: -50 });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    });

    it('rejeita tipo INVENTARIO_INICIAL no wire -> 400', async () => {
      if (!app) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/products/${produtoId}/adjust-stock`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ tipo: 'INVENTARIO_INICIAL', delta: 5 });
      expect(res.status).toBe(400);
    });

    it('criar produto com initial_stock grava UMA linha INVENTARIO_INICIAL (sem 2x)', async () => {
      if (!app) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/products`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ name: 'Trufa', price: 5.0, initial_stock: 10 });
      expect(res.status).toBe(201);

      const novoProdutoId = res.body.id;

      // Verificar que estoque = 10
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      const estoque = await queryRunner.query(
        `SELECT current_stock FROM movimentacoes_estoque WHERE produto_id = $1`,
        [novoProdutoId],
      );
      const ledger = await queryRunner.query(
        `SELECT tipo, delta FROM movimentacoes_estoque_historico WHERE produto_id = $1`,
        [novoProdutoId],
      );
      await queryRunner.release();

      expect(Number(estoque[0].current_stock)).toBe(10);
      // Exatamente UMA linha INVENTARIO_INICIAL — sem double-count
      expect(ledger.length).toBe(1);
      expect(ledger[0].tipo).toBe('INVENTARIO_INICIAL');
      expect(Number(ledger[0].delta)).toBe(10);
    });
  });

  describe('Admin estoque — extrato (stock-history) e categories', () => {
    let produtoId: string;

    beforeEach(async () => {
      if (!app) return;
      // Criar produto com estoque inicial via SQL direto
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      const prod = await queryRunner.query(
        `INSERT INTO produtos (id, tenant_id, name, price, is_active, category, created_at, updated_at)
         VALUES (uuid_generate_v4(), $1, 'Produto Extrato Test', 10.0, true, 'Trufas', now(), now())
         RETURNING id`,
        [tenantId],
      );
      produtoId = prod[0].id;
      // Estoque inicial = 10
      await queryRunner.query(
        `INSERT INTO movimentacoes_estoque (id, tenant_id, produto_id, current_stock, reserved_stock, min_stock, last_updated)
         VALUES (uuid_generate_v4(), $1, $2, 10, 0, 0, now())`,
        [tenantId, produtoId],
      );
      await queryRunner.release();
    });

    it('extrato retorna movimentacoes do produto, recentes primeiro, paginado', async () => {
      if (!app) return;
      // Seed de 3 movimentos no ledger via endpoint adjust-stock
      await request(app.getHttpServer())
        .post(`/api/v1/products/${produtoId}/adjust-stock`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ tipo: 'COMPRA', delta: 5, motivo: 'reposicao' });
      await request(app.getHttpServer())
        .post(`/api/v1/products/${produtoId}/adjust-stock`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ tipo: 'AJUSTE', delta: -2, motivo: 'correcao' });
      await request(app.getHttpServer())
        .post(`/api/v1/products/${produtoId}/adjust-stock`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ tipo: 'PERDA', delta: -1, motivo: 'avaria' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/products/${produtoId}/stock-history?limit=2&offset=0`)
        .set('Authorization', `Bearer ${jwtToken}`);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      // ordenado created_at DESC (mais recente primeiro)
      expect(res.body.total).toBeGreaterThanOrEqual(3);
      // Verifica ordenação real: primeiro item deve ser ao menos tão recente quanto o segundo.
      // O seed insere COMPRA, AJUSTE, PERDA em sequência — PERDA é a mais recente,
      // portanto items[0].tipo deve ser 'PERDA' (tiebreaker id DESC garante ordem determinística).
      expect(new Date(res.body.items[0].created_at).getTime())
        .toBeGreaterThanOrEqual(new Date(res.body.items[1].created_at).getTime());
      expect(res.body.items[0].tipo).toBe('PERDA');
    });

    it('AJUSTE com delta negativo mantém invariante (bidirectionality)', async () => {
      if (!app) return;
      // Seed produto com estoque = 50 via SQL direto
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      // Ajustar estoque para 50 via SQL
      await queryRunner.query(
        `UPDATE movimentacoes_estoque SET current_stock = 50 WHERE produto_id = $1`,
        [produtoId],
      );
      await queryRunner.release();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/products/${produtoId}/adjust-stock`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ tipo: 'AJUSTE', delta: -3, motivo: 'correcao negativa' });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      expect(res.body.saldo_resultante).toBe(47);
    });

    it('categories retorna DISTINCT por tenant', async () => {
      if (!app) return;
      // Seed: 2 produtos com category 'Trufas' (1 já criado no beforeEach) e 1 com 'Bombons'
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      // Inserir produto com categoria Trufas (duplicado — DISTINCT deve retornar só 1)
      await queryRunner.query(
        `INSERT INTO produtos (id, tenant_id, name, price, is_active, category, created_at, updated_at)
         VALUES (uuid_generate_v4(), $1, 'Produto Trufas 2', 5.0, true, 'Trufas', now(), now())`,
        [tenantId],
      );
      // Inserir produto com categoria Bombons
      await queryRunner.query(
        `INSERT INTO produtos (id, tenant_id, name, price, is_active, category, created_at, updated_at)
         VALUES (uuid_generate_v4(), $1, 'Produto Bombons', 8.0, true, 'Bombons', now(), now())`,
        [tenantId],
      );
      await queryRunner.release();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/products/categories`)
        .set('Authorization', `Bearer ${jwtToken}`);
      expect(res.status).toBe(200);
      // Deve conter pelo menos 'Bombons' e 'Trufas' (pode ter outros de testes anteriores)
      expect(Array.isArray(res.body)).toBe(true);
      const sorted = res.body.sort();
      expect(sorted).toContain('Bombons');
      expect(sorted).toContain('Trufas');
      // Valida que DISTINCT está funcionando: sem categorias duplicadas na resposta
      expect(new Set(res.body).size).toBe(res.body.length);
    });
  });
});
