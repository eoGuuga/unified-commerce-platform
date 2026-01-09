import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  // ✅ Tratamento de erros não capturados para evitar crashes
  process.on('uncaughtException', (error: Error) => {
    console.error('❌ UNCAUGHT EXCEPTION - Backend pode crashar:', error);
    console.error('Stack:', error.stack);
    // Não fazer exit imediato - deixar NestJS lidar
  });

  process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
    console.error('❌ UNHANDLED REJECTION - Backend pode crashar:', reason);
    if (reason instanceof Error) {
      console.error('Stack:', reason.stack);
    }
    // Não fazer exit imediato - deixar NestJS lidar
  });

  const app = await NestFactory.create(AppModule);

  const isProd = process.env.NODE_ENV === 'production';
  const enableSwagger = !isProd || process.env.ENABLE_SWAGGER === 'true';

  // ✅ Hardening básico do Express/Nest
  // INestApplication não expõe `disable`, mas o Express instance expõe.
  try {
    const instance = app.getHttpAdapter().getInstance() as any;
    instance?.disable?.('x-powered-by');
  } catch {
    // Se não for Express (ou adapter não suportar), ignorar.
  }
  app.enableShutdownHooks();
  app.use(cookieParser());
  app.use(
    helmet(
      enableSwagger
        ? {
            // Swagger UI usa inline scripts/styles
            contentSecurityPolicy: false,
            // Evita quebras com Swagger em dev
            crossOriginEmbedderPolicy: false,
          }
        : {
            // Produção: CSP/COEP mais restritivos
            contentSecurityPolicy: true,
            crossOriginEmbedderPolicy: { policy: 'require-corp' },
          },
    ),
  );

  // ✅ CORS - Validação robusta e segura
  const frontendUrl = process.env.FRONTEND_URL?.trim();
  const extraOriginsRaw = process.env.CORS_ORIGINS?.trim() || '';
  const extraOrigins = extraOriginsRaw
    ? extraOriginsRaw.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  // ✅ CRÍTICO: Em produção, FRONTEND_URL é obrigatório
  if (isProd && !frontendUrl) {
    console.error('❌ ERRO CRÍTICO: FRONTEND_URL não definido em produção!');
    console.error('   Configure: FRONTEND_URL=https://app.suaempresa.com');
    throw new Error(
      'FRONTEND_URL deve ser definido em produção (CORS). ' +
        'Ex.: FRONTEND_URL=https://app.suaempresa.com',
    );
  }

  // Validar URLs (básico)
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
      'Nenhuma origem CORS válida configurada. Verifique FRONTEND_URL e CORS_ORIGINS.',
    );
  }

  console.log(`✅ CORS configurado: ${allowedOrigins.length} origem(ns) permitida(s)`);
  if (isProd) {
    console.log(`   Produção: ${allowedOrigins.join(', ')}`);
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sem Origin (curl, health checks, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      
      // Log de tentativa bloqueada (apenas em dev para debug)
      if (!isProd) {
        console.warn(`⚠️ CORS bloqueado para origin: ${origin}`);
      }
      
      return callback(new Error(`CORS bloqueado para origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key', 'x-tenant-id'],
    exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  });

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (enableSwagger) {
    // Swagger/OpenAPI Configuration (desativado em producao por padrao)
    const config = new DocumentBuilder()
      .setTitle('Unified Commerce Platform API')
      .setDescription(
        'API completa para gestão de vendas multi-canal com controle de estoque em tempo real',
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
      .addTag('Auth', 'Autenticação e autorização')
      .addTag('Products', 'Gestão de produtos e estoque')
      .addTag('Orders', 'Gestão de pedidos e vendas')
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

  // API prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Backend running on http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();