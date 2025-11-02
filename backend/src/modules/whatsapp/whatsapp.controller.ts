import { Controller, Post, Body, Get } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook do Twilio para receber mensagens' })
  async webhook(@Body() body: any) {
    const message = {
      from: body.From,
      body: body.Body,
      timestamp: body.Timestamp,
    };

    await this.whatsappService.processIncomingMessage(message);
    return { success: true };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check do bot' })
  health() {
    return { status: 'ok', bot: 'WhatsApp Bot is running' };
  }
}
