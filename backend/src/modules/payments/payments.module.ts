import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { MercadoPagoProvider } from './providers/mercadopago.provider';
import { PaymentsController } from './payments.controller';
import { Pagamento } from '../../database/entities/Pagamento.entity';
import { Pedido } from '../../database/entities/Pedido.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pagamento, Pedido]),
    forwardRef(() => NotificationsModule),
    // Task 8: importa OrdersModule para reusar releaseExpiredPendingOrder no webhook.
    // OrdersModule nao importa PaymentsModule, portanto nao ha ciclo real aqui.
    OrdersModule,
  ],
  providers: [PaymentsService, MercadoPagoProvider],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
