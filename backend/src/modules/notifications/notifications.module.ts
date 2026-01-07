import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { WhatsappConversation } from '../../database/entities/WhatsappConversation.entity';
import { WhatsappMessage } from '../../database/entities/WhatsappMessage.entity';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsappConversation, WhatsappMessage]),
    forwardRef(() => WhatsappModule), // Para usar ConversationService
  ],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
