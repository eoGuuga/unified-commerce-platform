import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Pedido } from '../../database/entities/Pedido.entity';
import { ItemPedido } from '../../database/entities/ItemPedido.entity';
import { MovimentacaoEstoque } from '../../database/entities/MovimentacaoEstoque.entity';
import { Produto } from '../../database/entities/Produto.entity';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pedido, ItemPedido, MovimentacaoEstoque, Produto]),
    CommonModule, // Importar CommonModule para usar IdempotencyService e AuditLogService
    forwardRef(() => NotificationsModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
