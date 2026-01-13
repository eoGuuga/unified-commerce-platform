import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { MercadoPagoProvider } from './providers/mercadopago.provider';
import { PaymentsController } from './payments.controller';
import { Pagamento } from '../../database/entities/Pagamento.entity';
import { Pedido } from '../../database/entities/Pedido.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pagamento, Pedido]),
    forwardRef(() => NotificationsModule),
  ],
  providers: [PaymentsService, MercadoPagoProvider],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
