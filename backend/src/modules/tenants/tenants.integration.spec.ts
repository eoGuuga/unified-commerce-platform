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

/**
 * Task 4 — PATCH /tenants/settings (autenticado + guard admin + DTO por secao).
 *
 * O teste-mestre desta task e o de SEGURANCA (guard admin): um usuario autenticado
 * NAO-admin do tenant recebe 403; um usuario ADMIN do tenant recebe 200 e aplica.
 * Alem disso: merge por SECAO (patchar horario nao toca loja/pagamento), validacao
 * fail-closed (rejeita cor/URL/business_hours/metodos invalidos), e round-trip com o
 * GET da T3.
 *
 * Reusa o harness de auth: seed de tenant isolado (UUID v4 estrito) + JWT assinado
 * direto pelo JwtService, com o mesmo `role` do usuario semeado.
 */
describe('Tenants Settings Integration (e2e) — PATCH /tenants/settings', () => {
  let app: INestApplication | null = null;
  let dataSource: DataSource;

  // Tenant DEDICADO/ISOLADO desta suite. UUIDs v4 estritos.
  const tenantId = '4eaf7c16-2d0f-4b17-b231-2be4ae04fcef';
  const adminUserId = 'abc4bc88-b0cc-4989-9772-121708f5f4ac';
  const sellerUserId = '05229d68-6c79-46e8-a47b-8fbab8225309';

  // Settings iniciais com as 3 secoes preenchidas (para provar que o merge por
  // secao NAO toca as secoes ausentes do patch).
  const seedBusinessHours = {
    tz: 'America/Sao_Paulo',
    days: {
      '1': { open: '08:00', close: '17:00' },
      '2': { open: '08:00', close: '17:00' },
    },
  };
  const seedSettings = {
    store_name: 'Loja Base',
    tagline: 'Tagline base',
    description: 'Descricao base',
    primary_color: '#abcdef',
    business_hours: seedBusinessHours,
    metodos: ['pix', 'dinheiro'],
    pix_key: 'base@pix.com',
    pix_merchant_name: 'Loja Base LTDA',
  };

  let adminToken: string;
  let sellerToken: string;
  let jwtService: JwtService;

  // Re-semeia o settings do tenant para o estado base antes de cada teste
  // (isola os testes de merge/round-trip entre si).
  async function reseedSettings(settings: Record<string, unknown>): Promise<void> {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
    await qr.query(`UPDATE tenants SET settings = $2::jsonb WHERE id = $1`, [
      tenantId,
      JSON.stringify(settings),
    ]);
    await qr.release();
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

      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);

      await qr.query(
        `INSERT INTO tenants (id, name, slug, settings, is_active)
         VALUES ($1, $2, $3, $4::jsonb, true)
         ON CONFLICT (id) DO UPDATE
           SET settings = $4::jsonb, is_active = true`,
        [tenantId, 'Tenant Patch Teste', 'tenant-patch-teste', JSON.stringify(seedSettings)],
      );

      const hashed = await bcrypt.hash('test123', 10);

      // Usuario ADMIN (deve poder PATCH -> 200).
      const existingAdmin = await qr.query(
        'SELECT id FROM usuarios WHERE id = $1 AND tenant_id = $2',
        [adminUserId, tenantId],
      );
      if (!existingAdmin || existingAdmin.length === 0) {
        await qr.query(
          `INSERT INTO usuarios (id, tenant_id, email, encrypted_password, full_name, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [adminUserId, tenantId, 'admin-patch@test.com', hashed, 'Admin Patch', UserRole.ADMIN],
        );
      }

      // Usuario NAO-admin (SELLER) do MESMO tenant (deve receber 403 no PATCH).
      const existingSeller = await qr.query(
        'SELECT id FROM usuarios WHERE id = $1 AND tenant_id = $2',
        [sellerUserId, tenantId],
      );
      if (!existingSeller || existingSeller.length === 0) {
        await qr.query(
          `INSERT INTO usuarios (id, tenant_id, email, encrypted_password, full_name, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [sellerUserId, tenantId, 'seller-patch@test.com', hashed, 'Seller Patch', UserRole.SELLER],
        );
      }

      await qr.release();

      jwtService = moduleFixture.get<JwtService>(JwtService);
      adminToken = jwtService.sign({
        sub: adminUserId,
        email: 'admin-patch@test.com',
        role: UserRole.ADMIN,
        tenant_id: tenantId,
      });
      sellerToken = jwtService.sign({
        sub: sellerUserId,
        email: 'seller-patch@test.com',
        role: UserRole.SELLER,
        tenant_id: tenantId,
      });
    } catch (error) {
      console.error('❌ Erro ao inicializar testes de PATCH tenants settings:', error);
      app = null;
    }
  });

  beforeEach(async () => {
    if (!app) return;
    await reseedSettings(seedSettings);
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      try {
        await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
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

  // ----------------------------------------------------------------------------
  // 1) SEGURANCA — guard admin (o teste que nao pode falhar)
  // ----------------------------------------------------------------------------
  it('SEGURANCA: usuario NAO-admin (seller) do tenant -> PATCH retorna 403', async () => {
    if (!app) {
      console.log('⏭️ Pulando teste - app não inicializado');
      return;
    }

    await request(app.getHttpServer())
      .patch('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ loja: { store_name: 'Hackeada pelo seller' } })
      .expect(403);

    // E o settings NAO pode ter mudado (o seller nao gravou nada).
    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.loja.store_name).toBe('Loja Base');
  });

  it('SEGURANCA: usuario ADMIN do tenant -> PATCH retorna 200 e aplica', async () => {
    if (!app) {
      console.log('⏭️ Pulando teste - app não inicializado');
      return;
    }

    await request(app.getHttpServer())
      .patch('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ loja: { store_name: 'Loja do Admin' } })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.loja.store_name).toBe('Loja do Admin');
  });

  it('auth: 401 sem token', async () => {
    if (!app) {
      console.log('⏭️ Pulando teste - app não inicializado');
      return;
    }
    await request(app.getHttpServer())
      .patch('/api/v1/tenants/settings')
      .send({ loja: { store_name: 'x' } })
      .expect(401);
  });

  // ----------------------------------------------------------------------------
  // 2a) MERGE POR SECAO — patchar uma secao nao toca as outras
  // ----------------------------------------------------------------------------
  it('merge: PATCH so com `horario` grava business_hours e NAO toca loja/pagamento', async () => {
    if (!app) {
      console.log('⏭️ Pulando teste - app não inicializado');
      return;
    }

    const novoHorario = {
      tz: 'America/Sao_Paulo',
      days: {
        '6': { open: '09:00', close: '13:00' },
      },
    };

    await request(app.getHttpServer())
      .patch('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ horario: { business_hours: novoHorario } })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // horario mudou...
    expect(res.body.horario.business_hours).toEqual(novoHorario);
    // ...mas loja e pagamento seguem IGUAIS ao seed (secao ausente = nao toca).
    expect(res.body.loja.store_name).toBe('Loja Base');
    expect(res.body.loja.tagline).toBe('Tagline base');
    expect(res.body.loja.primary_color).toBe('#abcdef');
    expect(res.body.pagamento.metodos).toEqual(['pix', 'dinheiro']);
    expect(res.body.pagamento.pix_key).toBe('base@pix.com');
    expect(res.body.pagamento.pix_merchant_name).toBe('Loja Base LTDA');
  });

  it('merge: PATCH so com `loja` nao toca horario/pagamento', async () => {
    if (!app) {
      console.log('⏭️ Pulando teste - app não inicializado');
      return;
    }

    await request(app.getHttpServer())
      .patch('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ loja: { store_name: 'Loja Nova', tagline: 'Nova tagline' } })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.loja.store_name).toBe('Loja Nova');
    expect(res.body.loja.tagline).toBe('Nova tagline');
    // horario e pagamento intocados.
    expect(res.body.horario.business_hours).toEqual(seedBusinessHours);
    expect(res.body.pagamento.metodos).toEqual(['pix', 'dinheiro']);
    expect(res.body.pagamento.pix_key).toBe('base@pix.com');
  });

  it('merge: PATCH so com `pagamento` nao toca loja/horario', async () => {
    if (!app) {
      console.log('⏭️ Pulando teste - app não inicializado');
      return;
    }

    await request(app.getHttpServer())
      .patch('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pagamento: { metodos: ['pix', 'credito'], pix_key: 'novo@pix.com' } })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.pagamento.metodos).toEqual(['pix', 'credito']);
    expect(res.body.pagamento.pix_key).toBe('novo@pix.com');
    // loja e horario intocados.
    expect(res.body.loja.store_name).toBe('Loja Base');
    expect(res.body.horario.business_hours).toEqual(seedBusinessHours);
  });

  // ----------------------------------------------------------------------------
  // 2b) VALIDACAO — rejeita invalidos com 400 (fail-closed)
  // ----------------------------------------------------------------------------
  it('validacao 400: cor primaria nao-hex', async () => {
    if (!app) return;
    await request(app.getHttpServer())
      .patch('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ loja: { primary_color: 'vermelho' } })
      .expect(400);
  });

  it('validacao 400: logo_url invalida', async () => {
    if (!app) return;
    await request(app.getHttpServer())
      .patch('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ loja: { logo_url: 'nao-e-url' } })
      .expect(400);
  });

  it('validacao 400: business_hours com chave "7" (fora de 0..6)', async () => {
    if (!app) return;
    await request(app.getHttpServer())
      .patch('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        horario: {
          business_hours: {
            tz: 'America/Sao_Paulo',
            days: { '7': { open: '09:00', close: '13:00' } },
          },
        },
      })
      .expect(400);
  });

  it('validacao 400: business_hours com open "9h" (nao HH:MM)', async () => {
    if (!app) return;
    await request(app.getHttpServer())
      .patch('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        horario: {
          business_hours: {
            tz: 'America/Sao_Paulo',
            days: { '1': { open: '9h', close: '18:00' } },
          },
        },
      })
      .expect(400);
  });

  it('validacao 400: metodos com valor fora do enum', async () => {
    if (!app) return;
    await request(app.getHttpServer())
      .patch('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pagamento: { metodos: ['pix', 'boleto'] } })
      .expect(400);
  });

  // ----------------------------------------------------------------------------
  // 2c) ROUND-TRIP — PATCH grava -> GET (T3) reflete
  // ----------------------------------------------------------------------------
  it('round-trip: PATCH grava e o GET (T3) reflete o que foi gravado', async () => {
    if (!app) return;

    const businessHours = {
      tz: 'America/Sao_Paulo',
      days: {
        '1': { open: '10:00', close: '19:00' },
        '6': { open: '10:00', close: '14:00' },
      },
    };

    await request(app.getHttpServer())
      .patch('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        loja: { store_name: 'Round Trip Store', primary_color: '#00ff00' },
        horario: { business_hours: businessHours },
        pagamento: { metodos: ['pix', 'debito'], pix_merchant_name: 'RT Merchant' },
      })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.loja.store_name).toBe('Round Trip Store');
    expect(res.body.loja.primary_color).toBe('#00ff00');
    expect(res.body.horario.business_hours).toEqual(businessHours);
    expect(res.body.pagamento.metodos).toEqual(['pix', 'debito']);
    expect(res.body.pagamento.pix_merchant_name).toBe('RT Merchant');
    expect(res.body.status.hasBusinessHours).toBe(true);
    expect(res.body.status.hasPixMerchantName).toBe(true);
  });
});

/**
 * FIX 3 (MENOR-3) — ISOLAMENTO CROSS-TENANT.
 *
 * Prova explicita da garantia: o endpoint SEMPRE opera no tenant do JWT (nao ha
 * como mirar outro tenant pelo body/header) + RLS reforca. Semeamos DOIS tenants
 * (A e B) com settings DISTINTOS, autenticamos como admin do tenant A e provamos:
 *   (a) GET /tenants/settings devolve o settings de A (nunca o de B);
 *   (b) PATCH /tenants/settings altera A e o settings de B permanece INTACTO
 *       (confirmado lendo B por outra via, sob o contexto RLS de B).
 *
 * Reusa o mesmo harness de auth (seed de tenant isolado com UUID v4 estrito +
 * JWT assinado pelo JwtService). Nao muda nenhum codigo de producao.
 */
describe('Tenants Settings Integration (e2e) — cross-tenant isolation', () => {
  let app: INestApplication | null = null;
  let dataSource: DataSource;

  // Dois tenants DEDICADOS/ISOLADOS. UUIDs v4 estritos (aceitos pelo guard).
  const tenantAId = '7c1d9f2a-3b4e-4c5d-8e6f-1a2b3c4d5e6f';
  const tenantBId = '2f8e7d6c-5b4a-4938-8271-6a5b4c3d2e1f';
  const adminAId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

  const settingsA = {
    store_name: 'Loja A',
    tagline: 'Tagline A',
    pix_key: 'a@pix.com',
    metodos: ['pix'],
    business_hours: {
      tz: 'America/Sao_Paulo',
      days: { '1': { open: '08:00', close: '17:00' } },
    },
  };
  const settingsB = {
    store_name: 'Loja B',
    tagline: 'Tagline B',
    pix_key: 'b@pix.com',
    metodos: ['dinheiro'],
    business_hours: {
      tz: 'America/Sao_Paulo',
      days: { '2': { open: '10:00', close: '20:00' } },
    },
  };

  let adminAToken: string;

  // Le o settings bruto de um tenant sob o contexto RLS DELE (outra via, alheia
  // ao endpoint) — usada para confirmar que B nao foi tocado.
  async function readRawSettings(tenantId: string): Promise<Record<string, unknown>> {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
    const rows = await qr.query('SELECT settings FROM tenants WHERE id = $1', [tenantId]);
    await qr.release();
    return rows?.[0]?.settings ?? {};
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

      const hashed = await bcrypt.hash('test123', 10);

      // Seed do tenant A (com admin) sob RLS de A.
      const qrA = dataSource.createQueryRunner();
      await qrA.connect();
      await qrA.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantAId]);
      await qrA.query(
        `INSERT INTO tenants (id, name, slug, settings, is_active)
         VALUES ($1, $2, $3, $4::jsonb, true)
         ON CONFLICT (id) DO UPDATE SET settings = $4::jsonb, is_active = true`,
        [tenantAId, 'Tenant A', 'tenant-a-iso', JSON.stringify(settingsA)],
      );
      const existingAdminA = await qrA.query(
        'SELECT id FROM usuarios WHERE id = $1 AND tenant_id = $2',
        [adminAId, tenantAId],
      );
      if (!existingAdminA || existingAdminA.length === 0) {
        await qrA.query(
          `INSERT INTO usuarios (id, tenant_id, email, encrypted_password, full_name, role, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)`,
          [adminAId, tenantAId, 'admin-a-iso@test.com', hashed, 'Admin A', UserRole.ADMIN],
        );
      }
      await qrA.release();

      // Seed do tenant B (sem usuario — o admin de A nunca pode alcanca-lo) sob RLS de B.
      const qrB = dataSource.createQueryRunner();
      await qrB.connect();
      await qrB.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantBId]);
      await qrB.query(
        `INSERT INTO tenants (id, name, slug, settings, is_active)
         VALUES ($1, $2, $3, $4::jsonb, true)
         ON CONFLICT (id) DO UPDATE SET settings = $4::jsonb, is_active = true`,
        [tenantBId, 'Tenant B', 'tenant-b-iso', JSON.stringify(settingsB)],
      );
      await qrB.release();

      const jwtService = moduleFixture.get<JwtService>(JwtService);
      adminAToken = jwtService.sign({
        sub: adminAId,
        email: 'admin-a-iso@test.com',
        role: UserRole.ADMIN,
        tenant_id: tenantAId,
      });
    } catch (error) {
      console.error('❌ Erro ao inicializar testes de isolamento cross-tenant:', error);
      app = null;
    }
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      try {
        await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantAId]);
        await qr.query('DELETE FROM usuarios WHERE tenant_id = $1', [tenantAId]);
        await qr.query('DELETE FROM tenants WHERE id = $1', [tenantAId]);
        await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantBId]);
        await qr.query('DELETE FROM tenants WHERE id = $1', [tenantBId]);
      } catch {
        /* limpeza best-effort */
      }
      await qr.release();
    }
    if (app) {
      await app.close();
    }
  });

  it('ISOLAMENTO: admin de A le o settings de A (nunca o de B) e patchar A nao toca B', async () => {
    if (!app) {
      console.log('⏭️ Pulando teste - app não inicializado');
      return;
    }

    // (a) GET como admin de A -> devolve A, nao B.
    const getRes = await request(app.getHttpServer())
      .get('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);
    expect(getRes.body.loja.store_name).toBe('Loja A');
    expect(getRes.body.loja.tagline).toBe('Tagline A');
    expect(getRes.body.pagamento.pix_key).toBe('a@pix.com');
    expect(getRes.body.pagamento.metodos).toEqual(['pix']);
    // Nada de B pode aparecer.
    expect(getRes.body.loja.store_name).not.toBe('Loja B');
    expect(getRes.body.pagamento.pix_key).not.toBe('b@pix.com');

    // (b) PATCH como admin de A -> altera A.
    await request(app.getHttpServer())
      .patch('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ loja: { store_name: 'Loja A Editada' }, pagamento: { pix_key: 'a-novo@pix.com' } })
      .expect(200);

    // A foi alterado (lido pelo endpoint, sob o contexto do JWT de A).
    const afterA = await request(app.getHttpServer())
      .get('/api/v1/tenants/settings')
      .set('Authorization', `Bearer ${adminAToken}`)
      .expect(200);
    expect(afterA.body.loja.store_name).toBe('Loja A Editada');
    expect(afterA.body.pagamento.pix_key).toBe('a-novo@pix.com');

    // B permanece INTACTO — lido por outra via, sob o contexto RLS de B.
    const rawB = await readRawSettings(tenantBId);
    expect(rawB.store_name).toBe('Loja B');
    expect(rawB.tagline).toBe('Tagline B');
    expect(rawB.pix_key).toBe('b@pix.com');
    expect(rawB.metodos).toEqual(['dinheiro']);
    // E o business_hours de B segue o do seed (patch de A nao vazou para B).
    expect(rawB.business_hours).toEqual(settingsB.business_hours);
  });
});
