import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { HealthModule } from './health.module';
import { databaseConfig } from '../../config/database.config';

describe('Health Integration Tests (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync(databaseConfig),
        HealthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health - Health Check Completo', () => {
    it('deve retornar status de todos os serviços', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('redis');
    });
  });

  describe('GET /health/ready - Readiness Probe', () => {
    it('deve retornar status de readiness', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');
    });
  });

  describe('GET /health/live - Liveness Probe', () => {
    it('deve retornar status de liveness', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('alive');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
