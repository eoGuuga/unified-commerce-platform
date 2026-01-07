import { Controller, Post, Body, Get, BadRequestException } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WhatsappWebhookDto } from './dto/whatsapp-webhook.dto';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook do Twilio/Evolution API para receber mensagens' })
  async webhook(@Body() body: Partial<WhatsappWebhookDto> & Record<string, any>) {
    // ⚠️ Suporta múltiplos formatos de webhook (Twilio, Evolution API, etc)
    const from = body.From || body.from || body.phoneNumber;
    const messageBody = body.Body || body.body || body.message || body.text;
    
    if (!from || !messageBody) {
      throw new BadRequestException('Campos obrigatórios: from/From/phoneNumber e body/Body/message/text');
    }

    // ⚠️ CRÍTICO: tenantId deve vir obrigatoriamente do webhook, nunca usar default hardcoded
    const tenantId = body.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenantId é obrigatório para processar mensagens WhatsApp');
    }

    const message = {
      from,
      body: messageBody,
      timestamp: body.Timestamp || body.timestamp || body.timestamp || new Date().toISOString(),
      tenantId,
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
    description: 'Endpoint para testar o bot WhatsApp sem precisar de webhook real. Envie uma mensagem e receba a resposta do bot. ⚠️ Requer tenantId obrigatório.',
  })
  @ApiResponse({ status: 200, description: 'Resposta do bot retornada com sucesso' })
  async test(@Body() body: { message: string; tenantId: string }) {
    // ⚠️ CRÍTICO: Em desenvolvimento, tenantId deve ser fornecido explicitamente
    if (!body.tenantId) {
      throw new BadRequestException('tenantId é obrigatório. Em desenvolvimento, use um tenant_id válido.');
    }

    const message = {
      from: '5511999999999', // Mock phone para testes
      body: body.message,
      timestamp: new Date().toISOString(),
      tenantId: body.tenantId,
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
