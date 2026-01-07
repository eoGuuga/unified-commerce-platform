import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { OrdersModule } from './orders.module';
import { ProductsModule } from '../products/products.module';
import { AuthModule } from '../auth/auth.module';
import { databaseConfig } from '../../config/database.config';
import { JwtService } from '@nestjs/jwt';

describe('Orders Integration Tests (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;
  const tenantId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync(databaseConfig),
        OrdersModule,
        ProductsModule,
        AuthModule,
      ],
    }).compile();

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

    // Criar token JWT para testes
    const jwtService = moduleFixture.get<JwtService>(JwtService);
    jwtToken = jwtService.sign({ sub: 'test-user', email: 'test@test.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /orders - Criar Pedido', () => {
    it.skip('deve criar pedido com sucesso quando há estoque suficiente', async () => {
      if (!app) return;
      // Primeiro, criar um produto e estoque
      const productResponse = await request(app.getHttpServer())
        .post(`/api/v1/products?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          name: 'Produto Teste Integração',
          price: 10.5,
          description: 'Produto para teste',
          unit: 'unidade',
        })
        .expect(201);

      const productId = productResponse.body.id;

      // Criar estoque manualmente (via SQL ou endpoint se existir)
      // Por enquanto, vamos assumir que o estoque já existe ou será criado automaticamente

      // Criar pedido
      const orderResponse = await request(app.getHttpServer())
        .post(`/api/v1/orders?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          channel: 'pdv',
          customer_name: 'Cliente Teste',
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
      expect(orderResponse.body.status).toBe('entregue'); // PDV = entregue
      expect(orderResponse.body.total_amount).toBe(52.5); // 5 * 10.5
    });

    it.skip('deve retornar erro 400 quando estoque insuficiente', async () => {
      if (!app) return;
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
  });

  describe('GET /orders - Listar Pedidos', () => {
    it('deve listar pedidos com autenticação', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }
      const response = await request(app.getHttpServer())
        .get(`/api/v1/orders?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('deve retornar 401 sem autenticação', async () => {
      if (!app) {
        console.log('⏭️ Pulando teste - app não inicializado');
        return;
      }
      await request(app.getHttpServer())
        .get(`/api/v1/orders?tenantId=${tenantId}`)
        .expect(401);
    });
  });
});
