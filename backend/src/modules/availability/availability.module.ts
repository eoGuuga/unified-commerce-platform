import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { StoreAvailabilityException } from '../../database/entities/StoreAvailabilityException.entity';
import { Tenant } from '../../database/entities/Tenant.entity';
import { AuthModule } from '../auth/auth.module';

/**
 * Camada 2 — modulo de disponibilidade (exceçoes por-data). Exporta o
 * AvailabilityService para o WhatsappModule consumir no gate (T3) — sem ciclo.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([StoreAvailabilityException, Tenant]),
    AuthModule,
  ],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
