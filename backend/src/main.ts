import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { DataSource } from 'typeorm';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CsrfGuard } from './common/guards/csrf.guard';
import { applyExpressHardening, buildHelmetOptions } from './common/security/http-hardening';
import { assertDatabaseLeastPrivilege } from './common/security/db-least-privilege';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { StructuredLogger } from './common/services/structured-logger.service';
import { AppModule } from './app.module';
import { Usuario, UserRole } from './database/entities/Usuario.entity';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  process.on('uncaughtException', (error: Error) => {
    logger.error(`UNCAUGHT EXCEPTION: ${error.message}`, error.stack);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    logger.error(`UNHANDLED REJECTION: ${msg}`, stack);
    process.exit(1);
  });

  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLogger(),
  });

  const isProd = process.env.NODE_ENV === 'production';
  const enableSwagger = !isProd || process.env.ENABLE_SWAGGER === 'true';

  // Hardening do Express/Nest: trust proxy (rate limit por cliente real atras do
  // nginx) + remocao de headers que vazam a stack.
  applyExpressHardening(app);
  app.enableShutdownHooks();
  app.use(cookieParser());
  // Headers de seguranca HTTP (HSTS forte, CSP, X-Frame-Options, nosniff...).
  app.use(helmet(buildHelmetOptions(enableSwagger)));

  // CORS.
  const frontendUrl = process.env.FRONTEND_URL?.trim();
  const extraOriginsRaw = process.env.CORS_ORIGINS?.trim() || '';
  const extraOrigins = extraOriginsRaw
    ? extraOriginsRaw.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  if (isProd && !frontendUrl) {
    logger.error('FRONTEND_URL nao definido em producao! Configure: FRONTEND_URL=https://app.suaempresa.com');
    throw new Error(
      'FRONTEND_URL deve ser definido em producao (CORS). ' +
        'Ex.: FRONTEND_URL=https://app.suaempresa.com',
    );
  }

  const validateUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  const allowedOrigins: string[] = isProd
    ? [frontendUrl!, ...extraOrigins].filter(validateUrl)
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        ...extraOrigins.filter(validateUrl),
      ];

  if (isProd && allowedOrigins.length === 0) {
    throw new Error(
      'Nenhuma origem CORS valida configurada. Verifique FRONTEND_URL e CORS_ORIGINS.',
    );
  }

  logger.log(`CORS configurado: ${allowedOrigins.length} origem(ns) permitida(s)`);
  if (isProd) {
    logger.log(`Producao: ${allowedOrigins.join(', ')}`);
  }

  const allowTenantHeader =
    !isProd && process.env.ALLOW_TENANT_FROM_REQUEST !== 'false';
  const allowedHeaders = [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'Idempotency-Key',
    'Cache-Control',
  ];
  if (allowTenantHeader) {
    allowedHeaders.push('x-tenant-id');
  }

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (!isProd) {
        logger.warn(`CORS bloqueado para origin: ${origin}`);
      }
      return callback(new Error(`CORS bloqueado para origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders,
    exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  });

  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalGuards(new CsrfGuard());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Unified Commerce Platform API')
      .setDescription(
        'API completa para gestao de vendas multi-canal com controle de estoque em tempo real',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Auth', 'Autenticacao e autorizacao')
      .addTag('Products', 'Gestao de produtos e estoque')
      .addTag('Orders', 'Gestao de pedidos e vendas')
      .addTag('WhatsApp', 'Bot WhatsApp e mensagens')
      .addServer('http://localhost:3001/api/v1', 'Development server')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'UCM API Documentation',
      customfavIcon: 'https://nestjs.com/img/logo_text.svg',
      customCss: '.swagger-ui .topbar { display: none }',
    });
  }

  app.setGlobalPrefix('api/v1');
  if (!isProd) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    });
  }

  if (isProd && process.env.SEED_DEV_USER === 'true') {
    throw new Error(
      '[SECURITY] SEED_DEV_USER=true em producao e BLOQUEADO. ' +
        'Remova SEED_DEV_USER do .env de producao (ou defina como "false").',
    );
  }
  const shouldSeedDevUser = !isProd && process.env.SEED_DEV_USER !== 'false';
  if (shouldSeedDevUser) {
    const devTenantId =
      process.env.DEV_TENANT_ID || '00000000-0000-0000-0000-000000000000';
    const devEmail = process.env.DEV_USER_EMAIL || 'dev@gtsofthub.com.br';
    const devName = process.env.DEV_USER_NAME || 'Dev UCM';
    const devRoleRaw = process.env.DEV_USER_ROLE;
    const devRole = Object.values(UserRole).includes(
      String(devRoleRaw || '').toLowerCase() as UserRole,
    )
      ? (String(devRoleRaw).toLowerCase() as UserRole)
      : UserRole.ADMIN;

    const forceReset = process.env.SEED_DEV_USER_FORCE_RESET !== 'false';
    const dataSource = app.get(DataSource);
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.manager.query(
        `SELECT set_config('app.current_tenant_id', $1, true)`,
        [devTenantId],
      );
      const repo = runner.manager.getRepository(Usuario);
      const existing = await repo.findOne({
        where: { email: devEmail, tenant_id: devTenantId },
      });

      if (!existing || forceReset) {
        const defaultHash =
          '$2b$10$lOraQx936asTk3b8crguZOLmW/zZQSN1sGX.ViNgfFx8zy4EXK9wa'; // 12345678
        const devPasswordHash =
          process.env.DEV_USER_PASSWORD_HASH || defaultHash;
        const devPassword = process.env.DEV_USER_PASSWORD;
        if (devPassword && !process.env.DEV_USER_PASSWORD_HASH && devPassword !== '12345678') {
          logger.warn(
            'DEV_USER_PASSWORD informado sem hash. Use DEV_USER_PASSWORD_HASH para alterar a senha.',
          );
        }

        if (!existing) {
          const user = repo.create({
            email: devEmail,
            encrypted_password: devPasswordHash,
            full_name: devName,
            tenant_id: devTenantId,
            role: devRole,
            is_active: true,
          });
          await repo.save(user);
          logger.log(`Usuario de teste criado: ${devEmail}`);
        } else if (forceReset) {
          await repo.update(
            { id: existing.id },
            {
              encrypted_password: devPasswordHash,
              full_name: devName,
              role: devRole,
              is_active: true,
            },
          );
          logger.log(`Usuario de teste atualizado: ${devEmail}`);
        } else {
          logger.log(`Usuario de teste ja existe: ${devEmail}`);
        }
      }

      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      logger.error('[DEV] Falha ao criar usuario de teste', error instanceof Error ? error.stack : String(error));
    } finally {
      await runner.release();
    }
  }

  // Fail-closed: em producao o app tem que rodar como papel de banco restrito
  // (NOSUPERUSER, sem BYPASSRLS). Papel privilegiado ignora o RLS e mata o
  // isolamento multi-tenant — melhor abortar o boot do que rodar sem protecao.
  if (isProd) {
    await assertDatabaseLeastPrivilege(app.get(DataSource));
  }

  const port = process.env.PORT || 3001;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);

  logger.log(`Backend running on http://${host}:${port}/api/v1`);
  logger.log(`Swagger documentation: http://${host}:${port}/api/docs`);
}

bootstrap();
