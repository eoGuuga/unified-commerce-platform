import { Module } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { OrdersModule } from '../orders/orders.module';
import { StockSweeperService } from './stock-sweeper.service';

/**
 * Módulo de agendamento de varredura de estoque (TTL sweeper).
 *
 * Importa WhatsappModule (fornece CartService) e OrdersModule (fornece OrdersService).
 * Não há dependência circular: nem WhatsappModule nem OrdersModule importam
 * StockSchedulerModule, portanto forwardRef não é necessário.
 *
 * Registrado em AppModule junto com ScheduleModule.forRoot().
 */
@Module({
  imports: [WhatsappModule, OrdersModule],
  providers: [StockSweeperService],
  exports: [StockSweeperService],
})
export class StockSchedulerModule {}
