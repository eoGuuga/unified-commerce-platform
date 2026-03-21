import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { OpenAIService } from './services/openai.service';
import { MessageIntelligenceService } from './services/message-intelligence.service';
import { SalesIntelligenceService } from './services/sales-intelligence.service';
import { SalesPlaybookService } from './services/sales-playbook.service';
import { SalesSegmentStrategyService } from './services/sales-segment-strategy.service';
import { SalesVerticalPackService } from './services/sales-vertical-pack.service';
import { CatalogSalesContextService } from './services/catalog-sales-context.service';
import { ConversationService } from './services/conversation.service';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { TenantsModule } from '../tenants/tenants.module';
import { CouponsModule } from '../coupons/coupons.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsappConversation } from '../../database/entities/WhatsappConversation.entity';
import { WhatsappMessage } from '../../database/entities/WhatsappMessage.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsappConversation, WhatsappMessage]),
    ProductsModule,
    TenantsModule, // Importar TenantsModule para validar tenant e número de WhatsApp
    forwardRef(() => OrdersModule), // forwardRef para evitar dependência circular
    forwardRef(() => PaymentsModule), // forwardRef para evitar dependência circular
    NotificationsModule,
    CouponsModule,
  ],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    OpenAIService,
    MessageIntelligenceService,
    SalesIntelligenceService,
    SalesPlaybookService,
    SalesSegmentStrategyService,
    SalesVerticalPackService,
    CatalogSalesContextService,
    ConversationService,
  ],
  exports: [WhatsappService, ConversationService],
})
export class WhatsappModule {}
