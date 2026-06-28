import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappController } from './whatsapp.controller';
import { WhatsAppCartController } from './whatsapp-cart.controller';
import { WhatsappService } from './whatsapp.service';

// Services existentes
import { OpenAIService } from './services/openai.service';
import { MessageIntelligenceService } from './services/message-intelligence.service';
import { ConversationalIntelligenceService } from './services/conversational-intelligence.service';
import { ConversationPlannerService } from './services/conversation-planner.service';
import { SalesIntelligenceService } from './services/sales-intelligence.service';
import { SalesPlaybookService } from './services/sales-playbook.service';
import { SalesSegmentStrategyService } from './services/sales-segment-strategy.service';
import { SalesVerticalPackService } from './services/sales-vertical-pack.service';
import { CatalogSalesContextService } from './services/catalog-sales-context.service';
import { ProductOfferIntelligenceService } from './services/product-offer-intelligence.service';
import { ConversationService } from './services/conversation.service';
import { LLMRouterService } from './services/llm-router.service';
import { ActionExecutorService } from './services/action-executor.service';
import { BotConfigService } from './services/bot-config.service';

// NOVOS SERVICES - FASE 1
import { CartService } from './services/cart.service';
import { WhatsAppErrorHandler } from './services/error-handler.service';
import { WhatsAppAnalyticsService } from './services/analytics.service';
import { ConversationManagerService } from './services/conversation-manager.service';

// NOVOS SERVICES - FASE 3 (Refatoração)
import { MessageProcessorService } from './services/message-processor.service';
import { CatalogManagerService } from './services/catalog-manager.service';
import { ResponseBuilderService } from './services/response-builder.service';
import { NLPService } from './services/nlp.service';
import { SalesOrchestratorService } from './services/sales-orchestrator.service';
import { InteractiveMessageService } from './services/interactive-message.service';
import { WhatsappSendingModule } from './config/whatsapp-sending.module';

// Entities
import { WhatsappConversation } from '../../database/entities/WhatsappConversation.entity';
import { WhatsappMessage } from '../../database/entities/WhatsappMessage.entity';
import { WhatsAppCart, WhatsAppMessageMetrics, WhatsAppConversationMetrics, WhatsAppConversionEvent, WhatsAppAbandonmentEvent } from '../../database/entities/WhatsappCart.entity';

// Modules
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { TenantsModule } from '../tenants/tenants.module';
import { CouponsModule } from '../coupons/coupons.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WhatsappConversation,
      WhatsappMessage,
      WhatsAppCart,
      WhatsAppMessageMetrics,
      WhatsAppConversationMetrics,
      WhatsAppConversionEvent,
      WhatsAppAbandonmentEvent,
    ]),
    CommonModule,
    ProductsModule,
    TenantsModule,
    WhatsappSendingModule,
    forwardRef(() => OrdersModule),
    forwardRef(() => PaymentsModule),
    NotificationsModule,
    CouponsModule,
  ],
  controllers: [WhatsappController, WhatsAppCartController],
  providers: [
    // Services existentes
    OpenAIService,
    MessageIntelligenceService,
    ConversationalIntelligenceService,
    ConversationPlannerService,
    SalesIntelligenceService,
    SalesPlaybookService,
    SalesSegmentStrategyService,
    SalesVerticalPackService,
    CatalogSalesContextService,
    ProductOfferIntelligenceService,
    ConversationService,
    LLMRouterService,
    ActionExecutorService,
    BotConfigService,

    // NOVOS SERVICES - FASE 1
    CartService,
    WhatsAppErrorHandler,
    WhatsAppAnalyticsService,
    ConversationManagerService,

    // NOVOS SERVICES - FASE 3 (Refatoração)
    MessageProcessorService,
    CatalogManagerService,
    ResponseBuilderService,
    NLPService,
    SalesOrchestratorService,
    InteractiveMessageService,

    // Providers de WhatsApp (Evolution/Mock/CloudApi) vêm do WhatsappSendingModule
    // — instancia unica, sem dupla-registracao.

    // Service principal
    WhatsappService,
  ],
  exports: [
    // Services existentes
    ConversationService,

    // R2: reexporta o envio tenant-aware (vem do WhatsappSendingModule)
    WhatsappSendingModule,

    // NOVOS SERVICES
    CartService,
    WhatsAppErrorHandler,
    WhatsAppAnalyticsService,
    ConversationManagerService,

    // NOVOS SERVICES - FASE 3 (Refatoração)
    MessageProcessorService,
    CatalogManagerService,
    ResponseBuilderService,
    NLPService,
    SalesOrchestratorService,
  ],
})
export class WhatsappModule {}