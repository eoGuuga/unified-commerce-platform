import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './services/cache.service';
import { UsageLogService } from './services/usage-log.service';
import { EncryptionService } from './services/encryption.service';
import { IdempotencyService } from './services/idempotency.service';
import { AuditLogService } from './services/audit-log.service';
import { CsrfService } from '../../common/services/csrf.service';
import { DbContextService } from './services/db-context.service';
import { UsageLog } from '../../database/entities/UsageLog.entity';
import { IdempotencyKey } from '../../database/entities/IdempotencyKey.entity';
import { AuditLog } from '../../database/entities/AuditLog.entity';

@Global() // Torna módulo global para não precisar importar em todos os lugares
@Module({
  imports: [
    TypeOrmModule.forFeature([UsageLog, IdempotencyKey, AuditLog]),
    ConfigModule,
  ],
  providers: [
    CacheService,
    UsageLogService,
    EncryptionService,
    IdempotencyService,
    AuditLogService,
    CsrfService,
    DbContextService,
  ],
  exports: [
    CacheService,
    UsageLogService,
    EncryptionService,
    IdempotencyService,
    AuditLogService,
    CsrfService,
    DbContextService,
  ],
})
export class CommonModule {}

