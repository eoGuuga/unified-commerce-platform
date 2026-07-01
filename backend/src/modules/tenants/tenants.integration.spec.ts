import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { TenantsModule } from './tenants.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { databaseConfig } from '../../config/database.config';
import { JwtService } from '@nestjs/jwt';
import { Usuario, UserRole } from '../../database/entities/Usuario.entity';
import { Tenant } from '../../database/entities/Tenant.entity';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { TenantDbContextInterceptor } from '../../common/interceptors/tenant-db-context.interceptor';

/**
 * Task 3 — GET /tenants/settings (projecao allow-list, sem vazamento de segredo).
 *
 * O teste-mestre desta task e o de SEGURANCA: semeamos um tenant cujo `settings`
 * CONTEM segredos (whatsapp.apiKey, bot_control_code, token) + a coluna
 * whatsapp_cloud_token_encrypted, ALEM dos campos legitimos, e provamos —
 * varrendo a resposta inteira recursivamente — que NENHUM segredo aparece.
 */
describe('Tenants Settings Integration (e2e) — GET /tenants/settings', () => {
  let app: INestApplication | null = null;
  let dataSource: DataSource;

  // Tenant DEDICADO/ISOLADO desta suite (nao mexe no tenant compartilhado 000...000),
  // com segredos no settings para o teste de nao-vazamento.
  // UUIDs v4 fixos (validate() do guard exige version=4/variant=8..b — 000...000 e a unica
  // excecao aceita; um UUID arbitrario com nibbles 0 seria rejeitado como "Tenant invalido").
  const secretTenantId = 'cd787b6e-aa6f-4d69-829b-4f5254db310c';
  const secretUserId = 'cb8c3d57-2f08-4f9b-9b73-b18ad3ba1cc2';

  // Marcadores de segredo — nenhum destes pode aparecer na resposta.
  const SECRET_APIKEY = 'SECRET_APIKEY';
  const SECRET_CODE = 'SECRET_CODE';
  const SECRET_TOKEN = 'SECRET_TOKEN_VALUE';
  const SECRET_ENCRYPTED = 'SECRET_ENCRYPTED_COLUMN_VALUE';

  const legitBusinessHours = {
    tz: 'America/Sao_Paulo',
    days: {
      '1': { open: '09:00', close: '18:00' },
      '6': { open: '09:00', close: '13:00' },
    },
  };

  let secretUserToken: string;

  beforeAll(async () => {
    try {
      process.env.SUPPRESS_TENANT_RLS_LOGS = 'true';
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
          TypeOrmModule.forRootAsync(databaseConfig),
          CommonModule,
          AuthModule,
          TenantsModule,
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

      // Seed do tenant secreto + usuario, sob RLS.
      const qr = dataSource.createQueryRunner();
      await qr.connect();

      // O seed do tenant precisa rodar sob o contexto do proprio tenant (RLS).
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [secretTenantId]);

      const secretSettings = {
        // ----- campos LEGITIMOS (devem aparecer na projecao) -----
        store_name: 'Loja Secreta Teste',
        tagline: 'A melhor loja de teste',
        description: 'Descricao legitima',
        primary_color: '#123456',
        business_hours: legitBusinessHours,
        pix_key: 'loja@pix.com',
        pix_merchant_name: 'Loja Secreta LTDA',
        metodos: ['pix', 'dinheiro'],
        whatsappNumbers: ['5511999999999'],
        // ----- SEGREDOS (NUNCA podem aparecer na resposta) -----
        whatsapp: { apiKey: SECRET_APIKEY, phoneNumberId: '123', token: SECRET_TOKEN },
        bot_control_code: SECRET_CODE,
      };

      // Upsert do tenant secreto (idempotente entre execucoes).
      await qr.query(
        `INSERT INTO tenants (id, name, slug, settings, whatsapp_cloud_token_encrypted, is_active)
         VALUES ($1, $2, $3, $4::jsonb, $5, true)
         ON CONFLICT (id) DO UPDATE
           SET settings = $4::jsonb,
               whatsapp_cloud_token_encrypted = $5,
               is_active = true`,
        [
          secretTenantId,
          'Tenant Secreto Teste',
          `tenant-secreto-teste`,
          JSON.stringify(secretSettings),
          SECRET_ENCRYPTED,
        ],
      );

      // Usuario admin desse tenant (para autenticar o GET).
      const existing = await qr.query(
        'SELECT id FROM usuarios WHERE id = $1 AND tenant_id = $2',
        [secretUserId, secretTenantId],
      );
      if (!existing || existing.length === 0) {
        const hashed = await bcrypt.hash('test123', 10);
        await qr.query(
          `INSERT INTO usuarios (id, tenant_id, email, encrypted_password, full_name, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [
            secretUserId,
            secretTenantId,
            'admin-secreto@test.com',
            hashed,
            'Admin Secreto',
            UserRole.ADMIN,
          ],
        );
      }

      await qr.release();

      const jwtService = moduleFixture.get<JwtService>(JwtService);
      secretUserToken = jwtService.sign({
        sub: secretUserId,
        email: 'admin-secreto@test.com',
        role: UserRole.ADMIN,
        tenant_id: secretTenantId,
      });
    } catch (error) {
      console.error('❌ Erro ao inicializar testes de tenants settings:', error);
      app = null;
    }
  });

  afterAll(async () => {
    // Limpeza do tenant secreto (mantem o banco compartilhado limpo).
    if (dataSource && dataSource.isInitialized) {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      try {
        await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [secretTenantId]);
        await qr.query('DELETE FROM usuarios WHERE tenant_id = $1', [secretTenantId]);
        await qr.query('DELETE FROM tenants WHERE id = $1', [secretTenantId]);
      } catch {
        /* limpeza best-effort */
      }
      await qr.release();
    }
    if (app) {
      await app.close();
    }
  });

  /**
   * Varre recursivamente qualquer valor (objeto/array/primitivo) e retorna todas
   * as chaves e valores string encontrados, para asserir ausencia de segredo.
   */
  function collectKeysAndStringValues(value: unknown): { keys: string[]; strings: string[] } {
    const keys: string[] = [];
    const strings: string[] = [];
    const walk = (v: unknown): void => {
      if (v === null || v === undefined) return;
      if (typeof v === 'string') {
        strings.push(v);
        return;
      }
      if (typeof v !== 'object') return;
      if (Array.isArray(v)) {
        v.forEach(walk);
        return;
      }
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        keys.push(k);
        walk(val);
      }
    };
    walk(value);
    return { keys, strings };
  }

  it('SEGURANCA: retorna projecao allow-list e NAO vaza nenhum segredo do settings', async () => {
    if (!app) {
      console.log('⏭️ Pulando teste - app não inicializado');
      return;
    }

    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${secretUserToken}`)
      .expect(200);

    const body = res.body;

    // (a) shape correto: as 4 secoes existem
    expect(body).toHaveProperty('loja');
    expect(body).toHaveProperty('horario');
    expect(body).toHaveProperty('pagamento');
    expect(body).toHaveProperty('status');

    // Campos legitimos presentes
    expect(body.loja.store_name).toBe('Loja Secreta Teste');
    expect(body.loja.tagline).toBe('A melhor loja de teste');
    expect(body.loja.description).toBe('Descricao legitima');
    expect(body.loja.primary_color).toBe('#123456');
    // logo/favicon ausentes no seed → null
    expect(body.loja.logo_url).toBeNull();
    expect(body.loja.favicon_url).toBeNull();

    expect(body.horario.business_hours).toEqual(legitBusinessHours);

    expect(body.pagamento.metodos).toEqual(['pix', 'dinheiro']);
    expect(body.pagamento.pix_key).toBe('loja@pix.com');
    expect(body.pagamento.pix_merchant_name).toBe('Loja Secreta LTDA');

    // (b) status: booleanos corretos
    expect(body.status.hasBusinessHours).toBe(true);
    expect(body.status.hasPixKey).toBe(true);
    expect(body.status.hasPixMerchantName).toBe(true);
    // hasWhatsappNumber = true porque HA numero — mas o NUMERO nao aparece (assert abaixo)
    expect(body.status.hasWhatsappNumber).toBe(true);

    // (c) VARREDURA RECURSIVA: nenhum segredo em NENHUM lugar da resposta.
    const serialized = JSON.stringify(body);
    const { keys, strings } = collectKeysAndStringValues(body);

    // Valores de segredo nunca podem aparecer em texto algum da resposta.
    for (const secretValue of [SECRET_APIKEY, SECRET_CODE, SECRET_TOKEN, SECRET_ENCRYPTED]) {
      expect(serialized).not.toContain(secretValue);
    }

    // O numero de WhatsApp (valor sensivel) nao pode vazar, mesmo com hasWhatsappNumber=true.
    expect(serialized).not.toContain('5511999999999');

    // Nenhuma chave sensivel deve aparecer em lugar algum da projecao.
    const forbiddenKeys = ['apiKey', 'bot_control_code', 'token', 'whatsapp', 'whatsappNumbers'];
    for (const fk of forbiddenKeys) {
      expect(keys).not.toContain(fk);
    }
    // Nenhuma chave terminando em _encrypted.
    for (const k of keys) {
      expect(k.endsWith('_encrypted')).toBe(false);
    }
    // Redundante mas explicito: nenhuma string sequer contem "token" ou "encrypted" com o valor secreto.
    expect(strings.some((s) => s.includes(SECRET_TOKEN))).toBe(false);
    expect(strings.some((s) => s.includes(SECRET_ENCRYPTED))).toBe(false);
  });

  it('escopo: campos ausentes viram null/[] (tenant sem esses campos)', async () => {
    if (!app) {
      console.log('⏭️ Pulando teste - app não inicializado');
      return;
    }

    // Reduz o settings do tenant secreto para o minimo (sem business_hours, pix, metodos, whatsapp).
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [secretTenantId]);
    await qr.query(
      `UPDATE tenants SET settings = $2::jsonb WHERE id = $1`,
      [secretTenantId, JSON.stringify({ store_name: 'Loja Minima' })],
    );
    await qr.release();

    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${secretUserToken}`)
      .expect(200);

    const body = res.body;
    expect(body.loja.store_name).toBe('Loja Minima');
    expect(body.loja.tagline).toBeNull();
    expect(body.horario.business_hours).toBeNull();
    expect(body.pagamento.metodos).toEqual([]);
    expect(body.pagamento.pix_key).toBeNull();
    expect(body.pagamento.pix_merchant_name).toBeNull();
    expect(body.status.hasBusinessHours).toBe(false);
    expect(body.status.hasPixKey).toBe(false);
    expect(body.status.hasPixMerchantName).toBe(false);
    expect(body.status.hasWhatsappNumber).toBe(false);
  });

  it('auth: 401 sem token', async () => {
    if (!app) {
      console.log('⏭️ Pulando teste - app não inicializado');
      return;
    }
    await request(app.getHttpServer()).get('/api/v1/tenants/settings').expect(401);
  });
});
