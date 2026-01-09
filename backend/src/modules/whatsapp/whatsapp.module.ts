import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { OpenAIService } from './services/openai.service';
import { ConversationService } from './services/conversation.service';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { TenantsModule } from '../tenants/tenants.module';
import { CouponsModule } from '../coupons/coupons.module';
import { WhatsappConversation } from '../../database/entities/WhatsappConversation.entity';
import { WhatsappMessage } from '../../database/entities/WhatsappMessage.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsappConversation, WhatsappMessage]),
    ProductsModule,
    TenantsModule, // Importar TenantsModule para validar tenant e número de WhatsApp
    forwardRef(() => OrdersModule), // forwardRef para evitar dependência circular
    forwardRef(() => PaymentsModule), // forwardRef para evitar dependência circular
    CouponsModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService, OpenAIService, ConversationService],
  exports: [WhatsappService, ConversationService],
})
export class WhatsappModule {}
