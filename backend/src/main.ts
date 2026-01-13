import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CsrfGuard } from './common/guards/csrf.guard';
import { AppModule } from './app.module';

async function bootstrap() {
  // Tratamento de erros nao capturados para evitar crashes.
  process.on('uncaughtException', (error: Error) => {
    console.error('UNCAUGHT EXCEPTION - Backend pode crashar:', error);
    console.error('Stack:', error.stack);
  });

  process.on('unhandledRejection', (reason: any) => {
    console.error('UNHANDLED REJECTION - Backend pode crashar:', reason);
    if (reason instanceof Error) {
      console.error('Stack:', reason.stack);
    }
  });

  const app = await NestFactory.create(AppModule);

  const isProd = process.env.NODE_ENV === 'production';
  const enableSwagger = !isProd || process.env.ENABLE_SWAGGER === 'true';

  // Hardening basico do Express/Nest.
  try {
    const instance = app.getHttpAdapter().getInstance() as any;
    instance?.disable?.('x-powered-by');
  } catch {
    // ignore
  }
  app.enableShutdownHooks();
  app.use(cookieParser());
  app.use(
    helmet(
      enableSwagger
        ? {
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false,
          }
        : {
            contentSecurityPolicy: true,
            crossOriginEmbedderPolicy: { policy: 'require-corp' },
          },
    ),
  );

  // CORS.
  const frontendUrl = process.env.FRONTEND_URL?.trim();
  const extraOriginsRaw = process.env.CORS_ORIGINS?.trim() || '';
  const extraOrigins = extraOriginsRaw
    ? extraOriginsRaw.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  if (isProd && !frontendUrl) {
    console.error('ERRO CRITICO: FRONTEND_URL nao definido em producao!');
    console.error('Configure: FRONTEND_URL=https://app.suaempresa.com');
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

  console.log(`CORS configurado: ${allowedOrigins.length} origem(ns) permitida(s)`);
  if (isProd) {
    console.log(`Producao: ${allowedOrigins.join(', ')}`);
  }

  const allowTenantHeader =
    !isProd && process.env.ALLOW_TENANT_FROM_REQUEST !== 'false';
  const allowedHeaders = [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'Idempotency-Key',
  ];
  if (allowTenantHeader) {
    allowedHeaders.push('x-tenant-id');
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (!isProd) {
        console.warn(`CORS bloqueado para origin: ${origin}`);
      }
      return callback(new Error(`CORS bloqueado para origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders,
    exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  });

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

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`Backend running on http://localhost:${port}/api/v1`);
  console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
