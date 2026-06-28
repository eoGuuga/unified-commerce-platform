import { Module, forwardRef } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { OrdersModule } from '../orders/orders.module';
import { StockSweeperService } from './stock-sweeper.service';

/**
 * Módulo de agendamento de varredura de estoque (TTL sweeper).
 *
 * Importa WhatsappModule (fornece CartService) e OrdersModule (fornece OrdersService).
 * Usa forwardRef para romper dependência circular:
 *   WhatsappModule → OrdersModule (forwardRef) → ProductsModule
 *   StockSchedulerModule → WhatsappModule + OrdersModule → ciclo potencial
 *
 * Registrado em AppModule junto com ScheduleModule.forRoot().
 */
@Module({
  imports: [
    forwardRef(() => WhatsappModule),
    forwardRef(() => OrdersModule),
  ],
  providers: [StockSweeperService],
  exports: [StockSweeperService],
})
export class StockSchedulerModule {}
