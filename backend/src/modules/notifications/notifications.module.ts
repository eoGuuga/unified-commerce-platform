import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { WhatsappConversation } from '../../database/entities/WhatsappConversation.entity';
import { WhatsappMessage } from '../../database/entities/WhatsappMessage.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappConversation, WhatsappMessage])],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
