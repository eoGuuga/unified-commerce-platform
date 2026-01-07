import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { OpenAIService } from './services/openai.service';
import { ConversationService } from './services/conversation.service';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { WhatsappConversation } from '../../database/entities/WhatsappConversation.entity';
import { WhatsappMessage } from '../../database/entities/WhatsappMessage.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsappConversation, WhatsappMessage]),
    ProductsModule,
    forwardRef(() => OrdersModule), // forwardRef para evitar dependência circular
    forwardRef(() => PaymentsModule), // forwardRef para evitar dependência circular
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService, OpenAIService, ConversationService],
  exports: [WhatsappService, ConversationService],
})
export class WhatsappModule {}
