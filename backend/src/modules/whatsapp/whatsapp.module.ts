import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { OpenAIService } from './services/openai.service';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService, OpenAIService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
