import { Controller, Post, Body, Get } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook do Twilio/Evolution API para receber mensagens' })
  async webhook(@Body() body: any) {
    const message = {
      from: body.From || body.from || body.phoneNumber,
      body: body.Body || body.body || body.message || body.text,
      timestamp: body.Timestamp || body.timestamp || new Date().toISOString(),
      tenantId: body.tenantId || '00000000-0000-0000-0000-000000000000',
    };

    const response = await this.whatsappService.processIncomingMessage(message);
    
    // Retornar resposta para o webhook (Twilio/Evolution API)
    return { 
      success: true, 
      response,
      // Para Twilio, retornar formato específico
      ...(body.From && { 
        Message: response,
        To: message.from,
      }),
    };
  }

  @Post('test')
  @ApiOperation({ 
    summary: 'Testar bot WhatsApp (desenvolvimento)',
    description: 'Endpoint para testar o bot WhatsApp sem precisar de webhook real. Envie uma mensagem e receba a resposta do bot.',
  })
  @ApiResponse({ status: 200, description: 'Resposta do bot retornada com sucesso' })
  async test(@Body() body: { message: string; tenantId?: string }) {
    const message = {
      from: '5511999999999',
      body: body.message,
      timestamp: new Date().toISOString(),
      tenantId: body.tenantId || '00000000-0000-0000-0000-000000000000',
    };

    const response = await this.whatsappService.processIncomingMessage(message);
    return { 
      success: true, 
      request: body.message,
      response,
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check do bot' })
  health() {
    return { status: 'ok', bot: 'WhatsApp Bot is running' };
  }
}
