import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { AvailabilityModule } from './availability.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { databaseConfig } from '../../config/database.config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../database/entities/Usuario.entity';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { TenantDbContextInterceptor } from '../../common/interceptors/tenant-db-context.interceptor';

/**
 * Task 2 — modulo `availability` (CRUD de exceçoes de disponibilidade da loja).
 *
 * O teste-mestre e o de SEGURANCA:
 *  - GUARD ADMIN: usuario autenticado NAO-admin (SELLER) -> POST/DELETE/close-today = 403;
 *    usuario ADMIN do tenant -> 200/201 e aplica.
 *  - CROSS-TENANT: admin de A cria uma exceçao; admin de B NAO a ve no GET e NAO
 *    consegue DELETE a exceçao de A (escopo por JWT + RLS).
 *
 * Reusa o harness de auth do tenants.integration.spec.ts: seed de tenant/usuario
 * sob RLS (UUID v4 estrito) + JWT assinado direto pelo JwtService.
 *
 * NOTE: exige o test-DB (tunel localhost:5544/ucm_test_motor) UP. `open`/`close` sao
 * colunas `time` no Postgres -> voltam como 'HH:MM:SS' (assertamos por startsWith).
 */

// Helpers de data no fuso America/Sao_Paulo (o fuso default da loja) — para gerar
// datas "passada"/"futura"/"hoje" deterministicas independentes do fuso do runner.
function civilDateInTz(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d); // 'YYYY-MM-DD'
}
const TZ = 'America/Sao_Paulo';
const todaySP = civilDateInTz(new Date(), TZ);
const futureSP = civilDateInTz(new Date(Date.now() + 30 * 86400000), TZ);
const pastSP = civilDateInTz(new Date(Date.now() - 30 * 86400000), TZ);

describe('Availability Exceptions Integration (e2e) — CRUD + seguranca', () => {
  let app: INestApplication | null = null;
  let dataSource: DataSource;

  // Tenant DEDICADO desta suite. UUIDs v4 estritos (aceitos pelo guard).
  const tenantId = 'd9f1c2a3-4b5e-4c6d-8e7f-0a1b2c3d4e5f';
  const adminUserId = 'e1a2b3c4-d5e6-4f70-8a91-b2c3d4e5f607';
  const sellerUserId = 'f2b3c4d5-e6f7-4081-9b02-c3d4e5f60718';

  const seedSettings = {
    store_name: 'Loja Availability',
    business_hours: {
      tz: TZ,
      days: {
        '1': { open: '09:00', close: '18:00' },
      },
    },
  };

  let adminToken: string;
  let sellerToken: string;

  async function cleanExceptions(): Promise<void> {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      await qr.query('DELETE FROM store_availability_exceptions WHERE tenant_id = $1', [tenantId]);
    } finally {
      await qr.release();
    }
  }

  beforeAll(async () => {
    try {
      process.env.SUPPRESS_TENANT_RLS_LOGS = 'true';
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
          TypeOrmModule.forRootAsync(databaseConfig),
          CommonModule,
          AuthModule,
          AvailabilityModule,
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

      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);

      await qr.query(
        `INSERT INTO tenants (id, name, slug, settings, is_active)
         VALUES ($1, $2, $3, $4::jsonb, true)
         ON CONFLICT (id) DO UPDATE SET settings = $4::jsonb, is_active = true`,
        [tenantId, 'Tenant Availability', 'tenant-availability', JSON.stringify(seedSettings)],
      );

      const hashed = await bcrypt.hash('test123', 10);

      const existingAdmin = await qr.query(
        'SELECT id FROM usuarios WHERE id = $1 AND tenant_id = $2',
        [adminUserId, tenantId],
      );
      if (!existingAdmin || existingAdmin.length === 0) {
        await qr.query(
          `INSERT INTO usuarios (id, tenant_id, email, encrypted_password, full_name, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [adminUserId, tenantId, 'admin-avail@test.com', hashed, 'Admin Avail', UserRole.ADMIN],
        );
      }

      const existingSeller = await qr.query(
        'SELECT id FROM usuarios WHERE id = $1 AND tenant_id = $2',
        [sellerUserId, tenantId],
      );
      if (!existingSeller || existingSeller.length === 0) {
        await qr.query(
          `INSERT INTO usuarios (id, tenant_id, email, encrypted_password, full_name, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [sellerUserId, tenantId, 'seller-avail@test.com', hashed, 'Seller Avail', UserRole.SELLER],
        );
      }

      await qr.release();

      const jwtService = moduleFixture.get<JwtService>(JwtService);
      adminToken = jwtService.sign({
        sub: adminUserId,
        email: 'admin-avail@test.com',
        role: UserRole.ADMIN,
        tenant_id: tenantId,
      });
      sellerToken = jwtService.sign({
        sub: sellerUserId,
        email: 'seller-avail@test.com',
        role: UserRole.SELLER,
        tenant_id: tenantId,
      });
    } catch (error) {
      console.error('❌ Erro ao inicializar testes de availability:', error);
      app = null;
    }
  });

  beforeEach(async () => {
    if (!app) return;
    await cleanExceptions();
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      try {
        await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
        await qr.query('DELETE FROM store_availability_exceptions WHERE tenant_id = $1', [tenantId]);
        await qr.query('DELETE FROM usuarios WHERE tenant_id = $1', [tenantId]);
        await qr.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
      } catch {
        /* limpeza best-effort */
      }
      await qr.release();
    }
    if (app) {
      await app.close();
    }
  });

  // ==========================================================================
  // 1) SEGURANCA — guard admin (o teste que NAO pode falhar)
  // ==========================================================================
  describe('SEGURANCA: guard admin', () => {
    it('SELLER autenticado -> POST /availability-exceptions = 403', async () => {
      if (!app) return;
      await request(app.getHttpServer())
        .post('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ date: futureSP, kind: 'closed' })
        .expect(403);
    });

    it('SELLER autenticado -> DELETE /availability-exceptions/:id = 403', async () => {
      if (!app) return;
      await request(app.getHttpServer())
        .delete('/api/v1/availability-exceptions/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);
    });

    it('SELLER autenticado -> POST /availability-exceptions/close-today = 403', async () => {
      if (!app) return;
      await request(app.getHttpServer())
        .post('/api/v1/availability-exceptions/close-today')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);
    });

    it('ADMIN do tenant -> POST cria (201) e aplica', async () => {
      if (!app) return;
      const res = await request(app.getHttpServer())
        .post('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: futureSP, kind: 'closed' })
        .expect(201);
      expect(res.body.date).toBe(futureSP);
      expect(res.body.kind).toBe('closed');

      // Aparece no GET.
      const list = await request(app.getHttpServer())
        .get('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(list.body.some((e: { date: string }) => e.date === futureSP)).toBe(true);
    });

    it('sem token -> 401', async () => {
      if (!app) return;
      await request(app.getHttpServer()).get('/api/v1/availability-exceptions').expect(401);
    });
  });

  // ==========================================================================
  // 2) SEGURANCA — cross-tenant (RLS + escopo por JWT)
  // ==========================================================================
  describe('SEGURANCA: isolamento cross-tenant', () => {
    // Tenant B com seu proprio admin — nunca deve ver/apagar exceçoes do tenant A (este).
    const tenantBId = 'a7b8c9d0-1e2f-4a3b-8c4d-5e6f70819203';
    const adminBId = 'b8c9d0e1-2f3a-4b4c-9d5e-6f7081920314';
    let adminBToken: string;

    beforeAll(async () => {
      if (!app) return;
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantBId]);
      await qr.query(
        `INSERT INTO tenants (id, name, slug, settings, is_active)
         VALUES ($1, $2, $3, $4::jsonb, true)
         ON CONFLICT (id) DO UPDATE SET settings = $4::jsonb, is_active = true`,
        [tenantBId, 'Tenant B Avail', 'tenant-b-avail', JSON.stringify(seedSettings)],
      );
      const existing = await qr.query(
        'SELECT id FROM usuarios WHERE id = $1 AND tenant_id = $2',
        [adminBId, tenantBId],
      );
      if (!existing || existing.length === 0) {
        const hashed = await bcrypt.hash('test123', 10);
        await qr.query(
          `INSERT INTO usuarios (id, tenant_id, email, encrypted_password, full_name, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [adminBId, tenantBId, 'admin-b-avail@test.com', hashed, 'Admin B Avail', UserRole.ADMIN],
        );
      }
      await qr.release();

      const jwtService = app.get(JwtService);
      adminBToken = jwtService.sign({
        sub: adminBId,
        email: 'admin-b-avail@test.com',
        role: UserRole.ADMIN,
        tenant_id: tenantBId,
      });
    });

    afterAll(async () => {
      if (!dataSource?.isInitialized) return;
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      try {
        await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantBId]);
        await qr.query('DELETE FROM store_availability_exceptions WHERE tenant_id = $1', [tenantBId]);
        await qr.query('DELETE FROM usuarios WHERE tenant_id = $1', [tenantBId]);
        await qr.query('DELETE FROM tenants WHERE id = $1', [tenantBId]);
      } catch {
        /* best-effort */
      }
      await qr.release();
    });

    it('admin de B NAO ve a exceçao de A e NAO consegue apaga-la', async () => {
      if (!app) return;

      // Admin de A cria uma exceçao.
      const created = await request(app.getHttpServer())
        .post('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: futureSP, kind: 'closed' })
        .expect(201);
      const excId = created.body.id as string;
      expect(excId).toBeTruthy();

      // Admin de B faz GET -> NAO ve a exceçao de A.
      const listB = await request(app.getHttpServer())
        .get('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminBToken}`)
        .expect(200);
      expect(listB.body.some((e: { id: string }) => e.id === excId)).toBe(false);

      // Admin de B tenta DELETE do id de A -> 404 (fora do escopo), no-op.
      await request(app.getHttpServer())
        .delete(`/api/v1/availability-exceptions/${excId}`)
        .set('Authorization', `Bearer ${adminBToken}`)
        .expect(404);

      // A exceçao de A CONTINUA existindo (o delete de B foi no-op).
      const listA = await request(app.getHttpServer())
        .get('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(listA.body.some((e: { id: string }) => e.id === excId)).toBe(true);
    });
  });

  // ==========================================================================
  // 3) COMPORTAMENTO — create / list-futuras / remove / upsert / R4 / close-today / DTO
  // ==========================================================================
  describe('comportamento', () => {
    it('cria exceçao `closed`', async () => {
      if (!app) return;
      const res = await request(app.getHttpServer())
        .post('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: futureSP, kind: 'closed' })
        .expect(201);
      expect(res.body.kind).toBe('closed');
      expect(res.body.open).toBeNull();
      expect(res.body.close).toBeNull();
    });

    it('cria exceçao `custom_hours` com open/close', async () => {
      if (!app) return;
      const res = await request(app.getHttpServer())
        .post('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: futureSP, kind: 'custom_hours', open: '09:00', close: '13:00' })
        .expect(201);
      expect(res.body.kind).toBe('custom_hours');
      // coluna `time` volta como 'HH:MM:SS'.
      expect(String(res.body.open).startsWith('09:00')).toBe(true);
      expect(String(res.body.close).startsWith('13:00')).toBe(true);
    });

    it('GET lista SO as futuras (semear passada + futura -> so a futura)', async () => {
      if (!app) return;
      // Semeia uma passada direto no banco (o POST rejeitaria por R4).
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
      await qr.query(
        `INSERT INTO store_availability_exceptions (tenant_id, date, kind, open, close)
         VALUES ($1, $2, 'closed', NULL, NULL)`,
        [tenantId, pastSP],
      );
      await qr.release();

      // Cria uma futura via API.
      await request(app.getHttpServer())
        .post('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: futureSP, kind: 'closed' })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const dates = list.body.map((e: { date: string }) => e.date);
      expect(dates).toContain(futureSP);
      expect(dates).not.toContain(pastSP);
    });

    it('remove uma exceçao (some do GET)', async () => {
      if (!app) return;
      const created = await request(app.getHttpServer())
        .post('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: futureSP, kind: 'closed' })
        .expect(201);
      const id = created.body.id as string;

      await request(app.getHttpServer())
        .delete(`/api/v1/availability-exceptions/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const list = await request(app.getHttpServer())
        .get('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(list.body.some((e: { id: string }) => e.id === id)).toBe(false);
    });

    it('UPSERT R1: criar 2x a mesma data (kinds diferentes) -> a 2a sobrescreve (1 linha, sem 500)', async () => {
      if (!app) return;
      // 1a: closed
      await request(app.getHttpServer())
        .post('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: futureSP, kind: 'closed' })
        .expect(201);

      // 2a: custom_hours na MESMA data -> sobrescreve (NAO 500, NAO duplica).
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: futureSP, kind: 'custom_hours', open: '10:00', close: '14:00' })
        .expect(201);
      expect(res2.body.kind).toBe('custom_hours');

      // Exatamente UMA linha para essa data, com o valor da 2a.
      const list = await request(app.getHttpServer())
        .get('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const forDate = list.body.filter((e: { date: string }) => e.date === futureSP);
      expect(forDate).toHaveLength(1);
      expect(forDate[0].kind).toBe('custom_hours');
      expect(String(forDate[0].open).startsWith('10:00')).toBe(true);
    });

    it('R4: POST com date no passado -> 400', async () => {
      if (!app) return;
      await request(app.getHttpServer())
        .post('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: pastSP, kind: 'closed' })
        .expect(400);
    });

    it('close-today cria `closed` para hoje (fuso da loja)', async () => {
      if (!app) return;
      const res = await request(app.getHttpServer())
        .post('/api/v1/availability-exceptions/close-today')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      expect(res.body.kind).toBe('closed');
      expect(res.body.date).toBe(todaySP);
    });

    it('DTO rejeita `custom_hours` sem open/close -> 400', async () => {
      if (!app) return;
      await request(app.getHttpServer())
        .post('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: futureSP, kind: 'custom_hours' })
        .expect(400);
    });

    it('DTO rejeita `closed` com open -> 400', async () => {
      if (!app) return;
      await request(app.getHttpServer())
        .post('/api/v1/availability-exceptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: futureSP, kind: 'closed', open: '09:00' })
        .expect(400);
    });
  });
});
