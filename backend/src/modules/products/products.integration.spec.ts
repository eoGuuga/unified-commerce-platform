import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { ProductsModule } from './products.module';
import { AuthModule } from '../auth/auth.module';
import { databaseConfig } from '../../config/database.config';
import { JwtService } from '@nestjs/jwt';

describe('Products Integration Tests (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;
  const tenantId = '00000000-0000-0000-0000-000000000000';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync(databaseConfig),
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

    const jwtService = moduleFixture.get<JwtService>(JwtService);
    jwtToken = jwtService.sign({ sub: 'test-user', email: 'test@test.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /products - Listar Produtos', () => {
    it('deve listar produtos sem autenticação (endpoint público)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/products?tenantId=${tenantId}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /products - Criar Produto', () => {
    it('deve criar produto com autenticação', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/products?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          name: 'Produto Teste',
          price: 15.99,
          description: 'Descrição do produto',
          unit: 'unidade',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Produto Teste');
      expect(response.body.price).toBe(15.99);
    });

    it('deve retornar 401 sem autenticação', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/products?tenantId=${tenantId}`)
        .send({
          name: 'Produto Teste',
          price: 15.99,
        })
        .expect(401);
    });

    it('deve validar campos obrigatórios', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/products?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          // Sem name e price
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /products/stock-summary - Resumo de Estoque', () => {
    it('deve retornar resumo de estoque com autenticação', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/products/stock-summary?tenantId=${tenantId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total_products');
      expect(response.body).toHaveProperty('low_stock_count');
      expect(response.body).toHaveProperty('out_of_stock_count');
      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
    });

    it('deve retornar 401 sem autenticação', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/products/stock-summary?tenantId=${tenantId}`)
        .expect(401);
    });
  });
});
