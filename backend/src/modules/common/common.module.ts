import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './services/cache.service';
import { UsageLogService } from './services/usage-log.service';
import { EncryptionService } from './services/encryption.service';
import { IdempotencyService } from './services/idempotency.service';
import { UsageLog } from '../../database/entities/UsageLog.entity';
import { IdempotencyKey } from '../../database/entities/IdempotencyKey.entity';

@Global() // Torna módulo global para não precisar importar em todos os lugares
@Module({
  imports: [
    TypeOrmModule.forFeature([UsageLog, IdempotencyKey]),
    ConfigModule,
  ],
  providers: [
    CacheService,
    UsageLogService,
    EncryptionService,
    IdempotencyService,
  ],
  exports: [
    CacheService,
    UsageLogService,
    EncryptionService,
    IdempotencyService,
  ],
})
export class CommonModule {}

