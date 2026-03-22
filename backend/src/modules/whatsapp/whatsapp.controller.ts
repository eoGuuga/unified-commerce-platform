import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TenantsService } from '../tenants/tenants.service';
import { WhatsappWebhookDto } from './dto/whatsapp-webhook.dto';
import { WhatsappService } from './whatsapp.service';

type RawWhatsappWebhookBody = Partial<WhatsappWebhookDto> & Record<string, any>;

function normalizeDigits(value?: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

function getPayloadRoot(body: RawWhatsappWebhookBody): Record<string, any> {
  if (body.data && typeof body.data === 'object') {
    return body.data;
  }

  return body;
}

function normalizeEventName(body: RawWhatsappWebhookBody): string | null {
  const eventName = body.event || body.eventName || body.event_type;
  if (!eventName || typeof eventName !== 'string') {
    return null;
  }

  return eventName.replace(/[.\s-]+/g, '_').toUpperCase();
}

function extractRemoteJid(body: RawWhatsappWebhookBody): string | null {
  const root = getPayloadRoot(body);
  const candidate =
    root.key?.remoteJid ||
    body.key?.remoteJid ||
    root.remoteJid ||
    body.remoteJid ||
    body.From ||
    body.from ||
    body.phoneNumber;

  return typeof candidate === 'string' ? candidate : null;
}

function extractParticipantJid(body: RawWhatsappWebhookBody): string | null {
  const root = getPayloadRoot(body);
  const candidate =
    root.key?.participant ||
    body.key?.participant ||
    root.participant ||
    body.participant ||
    root.sender ||
    body.sender;

  return typeof candidate === 'string' ? candidate : null;
}

function isGroupOrBroadcastMessage(body: RawWhatsappWebhookBody): boolean {
  const root = getPayloadRoot(body);
  const remoteJid = extractRemoteJid(body) || '';
  const explicitGroupFlag =
    root.isGroup === true ||
    body.isGroup === true ||
    root.chatType === 'group' ||
    body.chatType === 'group';

  return explicitGroupFlag || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast';
}

function extractMessageContent(message: Record<string, any> | null | undefined): string | null {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const directCandidates = [
    message.conversation,
    message.extendedTextMessage?.text,
    message.imageMessage?.caption,
    message.videoMessage?.caption,
    message.documentMessage?.caption,
    message.buttonsResponseMessage?.selectedDisplayText,
    message.templateButtonReplyMessage?.selectedDisplayText,
    message.listResponseMessage?.title,
    message.listResponseMessage?.singleSelectReply?.selectedRowId,
    message.listResponseMessage?.singleSelectReply?.title,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return (
    extractMessageContent(message.ephemeralMessage?.message) ||
    extractMessageContent(message.viewOnceMessage?.message) ||
    extractMessageContent(message.viewOnceMessageV2?.message) ||
    null
  );
}

function inferMessageType(body: RawWhatsappWebhookBody): 'text' | 'image' | 'document' | 'button' | 'audio' {
  const root = getPayloadRoot(body);
  const rawType = body.messageType || root.messageType || body.type;
  if (rawType === 'audio' || root.message?.audioMessage || root.message?.ptvMessage) {
    return 'audio';
  }
  if (rawType === 'image' || root.message?.imageMessage) {
    return 'image';
  }
  if (rawType === 'document' || root.message?.documentMessage) {
    return 'document';
  }
  if (
    rawType === 'button' ||
    root.message?.buttonsResponseMessage ||
    root.message?.templateButtonReplyMessage ||
    root.message?.listResponseMessage
  ) {
    return 'button';
  }

  return 'text';
}

function extractTimestamp(body: RawWhatsappWebhookBody): string {
  const root = getPayloadRoot(body);
  const rawTimestamp =
    body.Timestamp ||
    body.timestamp ||
    body.date_time ||
    root.messageTimestamp ||
    root.timestamp;

  if (typeof rawTimestamp === 'number') {
    const milliseconds = rawTimestamp > 10_000_000_000 ? rawTimestamp : rawTimestamp * 1000;
    return new Date(milliseconds).toISOString();
  }

  if (typeof rawTimestamp === 'string' && rawTimestamp.trim()) {
    const asNumber = Number(rawTimestamp);
    if (Number.isFinite(asNumber) && rawTimestamp.trim().match(/^\d+$/)) {
      const milliseconds = asNumber > 10_000_000_000 ? asNumber : asNumber * 1000;
      return new Date(milliseconds).toISOString();
    }

    return rawTimestamp;
  }

  return new Date().toISOString();
}

function extractMessageBody(body: RawWhatsappWebhookBody): string | null {
  const root = getPayloadRoot(body);
  const directCandidates = [
    body.Body,
    body.body,
    typeof body.message === 'string' ? body.message : null,
    body.text,
    body.transcript,
    body.transcription,
    body.audioTranscription,
    body.audio?.transcription,
    body.media?.transcription,
    root.text,
    root.transcript,
    root.transcription,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return extractMessageContent(root.message);
}

function looksLikeBotControlCommand(messageBody?: string | null): boolean {
  const normalized = String(messageBody || '')
    .trim()
    .toLowerCase();

  return /^#?bot\s+\S+\s+(ligar|desligar|status|on|off)$/i.test(normalized);
}

function shouldIgnoreWebhook(body: RawWhatsappWebhookBody): { ignore: boolean; reason?: string } {
  const eventName = normalizeEventName(body);
  const root = getPayloadRoot(body);

  if (eventName && eventName !== 'MESSAGES_UPSERT') {
    return { ignore: true, reason: `evento ${eventName} ignorado` };
  }

  if (isGroupOrBroadcastMessage(body)) {
    return { ignore: true, reason: 'grupo ou broadcast ignorado' };
  }

  if (root.key?.fromMe || body.key?.fromMe) {
    const messageBody = extractMessageBody(body);
    if (looksLikeBotControlCommand(messageBody)) {
      return { ignore: false };
    }

    return { ignore: true, reason: 'mensagem propria ignorada' };
  }

  return { ignore: false };
}

function getOutboundPreview(response: unknown): string {
  if (typeof response === 'string') {
    return response;
  }

  if (
    response &&
    typeof response === 'object' &&
    'kind' in response &&
    (response as any).kind === 'interactive_list'
  ) {
    return String((response as any).previewText || '').trim();
  }

  return '';
}

function shouldDispatchOutboundResponse(response: unknown): boolean {
  if (typeof response === 'string') {
    return response.trim().length > 0;
  }

  if (
    response &&
    typeof response === 'object' &&
    'kind' in response &&
    (response as any).kind === 'interactive_list'
  ) {
    const preview = String((response as any).previewText || '').trim();
    const sections = Array.isArray((response as any).list?.sections)
      ? (response as any).list.sections
      : [];

    return preview.length > 0 && sections.length > 0;
  }

  return false;
}

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Post('webhook')
  @ApiOperation({
    summary: 'Webhook do Twilio/Evolution API para receber mensagens',
    description:
      'Aceita payloads de provedores diferentes e vincula a mensagem ao tenant correto.',
  })
  async webhook(
    @Body() body: RawWhatsappWebhookBody,
    @Query('tenantId') tenantIdFromQuery?: string,
  ) {
    const ignoreDecision = shouldIgnoreWebhook(body);
    if (ignoreDecision.ignore) {
      return {
        success: true,
        ignored: true,
        reason: ignoreDecision.reason,
      };
    }

    const from = normalizeDigits(extractRemoteJid(body));
    const messageBody = extractMessageBody(body);
    const tenantId =
      body.tenantId || body.data?.tenantId || body.metadata?.tenantId || tenantIdFromQuery;

    if (!from || !messageBody) {
      throw new BadRequestException(
        'Campos obrigatorios: remetente valido e texto da mensagem.',
      );
    }

    if (!tenantId) {
      throw new BadRequestException('tenantId e obrigatorio para processar mensagens WhatsApp');
    }

    const tenant = await this.tenantsService.findOneById(tenantId);
    const configuredInstance =
      tenant.settings?.whatsappInstance || tenant.settings?.whatsapp_instance || null;
    const incomingInstance = body.instance || body.data?.instance || null;
    const canTrustInstance =
      Boolean(configuredInstance) &&
      Boolean(incomingInstance) &&
      configuredInstance === incomingInstance;

    if (configuredInstance && incomingInstance && configuredInstance !== incomingInstance) {
      throw new ForbiddenException(
        `Instancia ${incomingInstance} nao autorizada para o tenant ${tenantId}`,
      );
    }

    if (!canTrustInstance) {
      await this.tenantsService.validateWhatsAppNumber(tenantId, from);
    }

    const messageId =
      body.MessageSid ||
      body.messageId ||
      body.id ||
      body.key?.id ||
      body.data?.key?.id ||
      body.data?.id;
    const mediaUrl = body.MediaUrl0 || body.mediaUrl || body.media?.url || body.audio?.url;
    const message = {
      from,
      body: messageBody,
      timestamp: extractTimestamp(body),
      tenantId,
      messageId,
      messageType: inferMessageType(body),
      mediaUrl,
      metadata: {
        ...(body.metadata || {}),
        provider: body.provider || body.data?.provider || null,
        transcriptionSource: body.transcriptionSource || null,
        webhookEvent: normalizeEventName(body),
        whatsappInstance: incomingInstance,
        sourceJid: extractRemoteJid(body),
        participantJid: extractParticipantJid(body),
        isGroupMessage: isGroupOrBroadcastMessage(body),
      },
    };

    const response = await this.whatsappService.processIncomingMessage(message);
    const shouldDispatchResponse = shouldDispatchOutboundResponse(response);

    if (shouldDispatchResponse) {
      await this.whatsappService.sendOutboundResponse(message.from, response);
    }

    return {
      success: true,
      response,
      ...(body.From && {
        Message: getOutboundPreview(response),
        To: message.from,
      }),
    };
  }

  @Post('test')
  @ApiOperation({
    summary: 'Testar bot WhatsApp (desenvolvimento)',
    description:
      'Endpoint para testar o bot sem webhook real. Requer tenantId explicito.',
  })
  @ApiResponse({ status: 200, description: 'Resposta do bot retornada com sucesso' })
  @ApiResponse({ status: 403, description: 'Tenant ID invalido ou numero nao autorizado' })
  async test(@Body() body: {
    message: string;
    tenantId: string;
    phoneNumber?: string;
    phone?: string;
    messageId?: string;
    messageType?: 'text' | 'image' | 'document' | 'button' | 'audio';
    mediaUrl?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!body.tenantId) {
      throw new BadRequestException('tenantId e obrigatorio. Use um tenant valido.');
    }

    const phoneNumber = body.phoneNumber || body.phone || '5511999999999';
    await this.tenantsService.findOneById(body.tenantId);

    const message = {
      from: phoneNumber,
      body: body.message,
      timestamp: new Date().toISOString(),
      tenantId: body.tenantId,
      messageId: body.messageId,
      messageType: body.messageType,
      mediaUrl: body.mediaUrl,
      metadata: body.metadata,
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
