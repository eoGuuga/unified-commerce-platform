import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { databaseConfig } from './config/database.config';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AuthModule } from './modules/auth/auth.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthModule } from './modules/health/health.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { LgpdModule } from './modules/lgpd/lgpd.module';
import { StockSchedulerModule } from './modules/products/stock-scheduler.module';
import { TenantDbContextInterceptor } from './common/interceptors/tenant-db-context.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Em dev/test, aumentamos o limite para nao atrapalhar scripts automatizados.
    // Em prod, mantemos limites conservadores e usamos policy "strict" em rotas sensiveis (login/register).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: process.env.NODE_ENV === 'production' ? 100 : 1000, // dev/test: mais folga
      },
      {
        name: 'strict',
        ttl: 60000, // 1 minute
        limit: process.env.NODE_ENV === 'production' ? 10 : 200, // dev/test: mais folga
      },
      {
        name: 'webhook',
        ttl: 60000, // 1 minute
        limit: process.env.NODE_ENV === 'production' ? 60 : 600, // protege webhooks publicos de flood
      },
    ]),
    TypeOrmModule.forRootAsync(databaseConfig),
    ScheduleModule.forRoot(),
    StockSchedulerModule,
    ProductsModule,
    OrdersModule,
    AuthModule,
    WhatsappModule,
    PaymentsModule,
    NotificationsModule,
    HealthModule,
    CouponsModule,
    TenantsModule,
    LgpdModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantDbContextInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}