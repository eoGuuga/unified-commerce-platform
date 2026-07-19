import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Logger,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { createHmac, timingSafeEqual } from 'crypto';
import { TenantsService } from '../tenants/tenants.service';
import { Public } from '../../common/decorators/public.decorator';
import { WhatsappWebhookDto } from './dto/whatsapp-webhook.dto';
import {
  WhatsAppService,
  type WhatsAppOutboundResponse,
} from './whatsapp.service';

type RawWhatsappWebhookBody = Partial<WhatsappWebhookDto> & Record<string, any>;

/**
 * Verifica assinatura do webhook para garantir autenticidade
 */
function verifyWebhookSignature(
  rawBody: Buffer | string | undefined,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret || rawBody == null) {
    return false;
  }

  // HMAC sobre o corpo CRU (bytes originais). A Meta assina o raw body — usar
  // JSON.stringify(body) nao bate byte-a-byte (ordem/espacos/unicode divergem).
  const expectedSignature = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    const sigBuffer = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

type InteractiveListResponse = Extract<
  WhatsAppOutboundResponse,
  { kind: 'interactive_list' }
>;

function isInteractiveListResponse(
  response: unknown,
): response is InteractiveListResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'kind' in response &&
    (response as { kind?: unknown }).kind === 'interactive_list'
  );
}

function normalizeDigits(value?: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

function parseIgnoredDirectPhonesFromEnv(): string[] {
  const rawValue = String(process.env.WHATSAPP_IGNORED_PHONES || '').trim();
  if (!rawValue) {
    return [];
  }

  return Array.from(
    new Set(
      rawValue
        .split(/[\s,;]+/)
        .map((item) => normalizeDigits(item))
        .filter(Boolean),
    ),
  );
}

function matchesIgnoredDirectPhone(phoneNumber: string, configuredPhone: string): boolean {
  const normalizedPhone = normalizeDigits(phoneNumber);
  const normalizedConfigured = normalizeDigits(configuredPhone);

  if (!normalizedPhone || !normalizedConfigured) {
    return false;
  }

  if (normalizedPhone === normalizedConfigured) {
    return true;
  }

  const last11Phone = normalizedPhone.slice(-11);
  const last11Configured = normalizedConfigured.slice(-11);

  return (
    last11Phone.length === 11 &&
    last11Configured.length === 11 &&
    last11Phone === last11Configured
  );
}

function isIgnoredDirectPhone(phoneNumber: string): boolean {
  return parseIgnoredDirectPhonesFromEnv().some((configuredPhone) =>
    matchesIgnoredDirectPhone(phoneNumber, configuredPhone),
  );
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

  if (isInteractiveListResponse(response)) {
    return String(response.previewText || '').trim();
  }

  return '';
}

function shouldDispatchOutboundResponse(response: unknown): boolean {
  if (typeof response === 'string') {
    return response.trim().length > 0;
  }

  if (isInteractiveListResponse(response)) {
    const preview = String(response.previewText || '').trim();
    const sections = Array.isArray(response.list?.sections)
      ? response.list.sections
      : [];

    return preview.length > 0 && sections.length > 0;
  }

  return false;
}

/** Extrai o texto util de uma mensagem da Meta (texto ou resposta interativa). */
function extractMetaMessageText(message: Record<string, any>): string {
  if (message?.type === 'text') {
    return String(message.text?.body || '').trim();
  }
  if (message?.type === 'interactive') {
    const interactive = message.interactive || {};
    const reply = interactive.button_reply || interactive.list_reply || {};
    // Usa o id da opcao (o bot monta botoes/listas com id proprio); cai pro title.
    return String(reply.id || reply.title || '').trim();
  }
  if (message?.type === 'button') {
    // Quick-reply de template (formato legado)
    return String(message.button?.text || message.button?.payload || '').trim();
  }
  return '';
}

/**
 * Normaliza o payload do WhatsApp Cloud API (Meta) para o formato PLANO que o
 * resto do pipeline (extractRemoteJid/extractMessageBody/...) ja entende.
 *
 * Formato da Meta:
 *   { object: 'whatsapp_business_account',
 *     entry: [{ changes: [{ value: {
 *       metadata: { phone_number_id },
 *       contacts: [{ profile: { name } }],
 *       messages: [{ from, id, timestamp, type, text?: { body }, interactive?: {...} }],
 *       statuses?: [...]   // recibos de entrega/leitura -> ignorar
 *     } }] }] }
 *
 * - Nao-Meta -> retorna o body intacto (Evolution/Twilio seguem funcionando).
 * - So `statuses` (ou sem `messages`) -> { ignore: true } (recibo, nao e mensagem).
 * - Com `messages[0]` -> body plano { From, Body, MessageSid, metadata }.
 */
export function normalizeMetaCloudPayload(body: RawWhatsappWebhookBody): {
  body: RawWhatsappWebhookBody;
  ignore?: boolean;
  reason?: string;
} {
  const isMeta =
    body?.object === 'whatsapp_business_account' && Array.isArray(body.entry);
  if (!isMeta) {
    return { body };
  }

  const value = body.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  if (!message) {
    return {
      body,
      ignore: true,
      reason: Array.isArray(value?.statuses)
        ? 'meta_status_receipt'
        : 'meta_evento_sem_mensagem',
    };
  }

  return {
    body: {
      ...body,
      From: message.from,
      Body: extractMetaMessageText(message),
      MessageSid: message.id,
      messageTimestamp: message.timestamp,
      metadata: {
        ...(body.metadata || {}),
        provider: 'cloud_api',
        phoneNumberId: value?.metadata?.phone_number_id,
        contactName: value?.contacts?.[0]?.profile?.name,
        metaMessageType: message.type,
      },
    },
  };
}

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly tenantsService: TenantsService,
  ) {}

  /**
   * GET /whatsapp/webhook — handshake de verificacao do WhatsApp Cloud API (Meta).
   *
   * A Meta chama este endpoint ao registrar o webhook, com:
   *   ?hub.mode=subscribe&hub.verify_token=<nosso token>&hub.challenge=<numero>
   * Se o `hub.verify_token` bater com o `WHATSAPP_WEBHOOK_VERIFY_TOKEN` do .env,
   * devolvemos o `hub.challenge` cru (a Meta confirma a assinatura do webhook).
   * Sem token configurado ou divergente -> 403 (nao registra).
   */
  @Public()
  @Get('webhook')
  @ApiOperation({ summary: 'Verificacao do webhook do WhatsApp Cloud API (Meta)' })
  verifyWebhook(@Query() query: Record<string, string>): string {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && expected && token === expected) {
      this.logger.log('Webhook WhatsApp verificado pela Meta com sucesso.');
      return challenge ?? '';
    }

    if (!expected) {
      this.logger.warn(
        '[SETUP] WHATSAPP_WEBHOOK_VERIFY_TOKEN nao configurado — verificacao do webhook rejeitada. Defina a variavel para registrar o webhook na Meta.',
      );
    }
    throw new ForbiddenException('Falha na verificacao do webhook.');
  }

  /**
   * Comparacao de chaves resistente a timing attack.
   * Retorna false se os tamanhos diferirem (sem vazar o tamanho via tempo).
   */
  private safeKeyEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }

  // Teto de requisicoes: MESMO molde do webhook do Mercado Pago
  // (payments.controller.ts). Sem este decorator a rota herda os TRES
  // throttlers globais do app.module e fica presa ao mais restritivo — o
  // `strict`, de 10/min em producao. Como o tracker e por IP e a Meta entrega
  // de poucos IPs proprios, esse teto e COMPARTILHADO pela loja inteira: um
  // unico cliente conversando gasta metade da cota, e ao estourar a Meta leva
  // 429, re-tenta e DESCARTA a mensagem — cliente sem resposta, e em silencio
  // (429 e 4xx -> "level":"warn", que o app-alert.sh nao caça).
  //
  // 60/min nao e um numero novo: e o mesmo ja em producao no webhook do MP.
  // Segue sendo um teto por IP, nao por cliente — se o volume real da doceria
  // pedir mais, ajustar COM DADO, nao com chute.
  //
  // ⚠️ O @SkipThrottle NAO e decorativo — sem ele o @Throttle acima nao serve
  // pra nada. O guard percorre TODOS os throttlers nomeados e exige `.every()`
  // (throttler.guard.js:67-97): o @Throttle sobrescreve so o `webhook`,
  // enquanto `strict` (10/min) e `default` seguem valendo pelo fallback do
  // modulo. Foi exatamente esse o bug medido em producao — 429 na 11ª
  // requisicao com o @Throttle ja deployado. So o SkipThrottle tira um
  // throttler da conta.
  @Public()
  @Throttle({ webhook: { ttl: 60000, limit: 60 } })
  @SkipThrottle({ strict: true, default: true })
  @Post('webhook')
  @ApiOperation({
    summary: 'Webhook para receber mensagens (WhatsApp Cloud API / Evolution / Twilio)',
    description:
      'Aceita payloads de provedores diferentes (incl. o formato aninhado da Meta Cloud API) e vincula a mensagem ao tenant correto.',
  })
  async webhook(
    @Body() incomingBody: RawWhatsappWebhookBody,
    @Query('tenantId') tenantIdFromQuery?: string,
    @Headers('x-hub-signature-256') signature?: string,
    @Req() req?: RawBodyRequest<Request>,
  ) {
    // Verificacao de assinatura do webhook — FAIL-CLOSED em producao.
    // Em prod, o secret e obrigatorio e a assinatura tem que ser valida;
    // sem isso, qualquer um poderia injetar mensagens para qualquer tenant.
    // A assinatura e conferida sobre o corpo CRU (req.rawBody), como a Meta assina.
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';
    const rawBody = req?.rawBody;

    if (isProduction) {
      if (!webhookSecret) {
        this.logger.error(
          '[SEGURANCA][WHATSAPP] WHATSAPP_WEBHOOK_SECRET ausente em producao — mensagem REJEITADA (fail-closed). Configure o App Secret da Meta para o bot funcionar.',
        );
        throw new ForbiddenException('Webhook nao configurado com seguranca.');
      }
      if (!signature) {
        throw new ForbiddenException('Assinatura do webhook ausente.');
      }
      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        throw new ForbiddenException('Assinatura do webhook invalida.');
      }
    } else if (webhookSecret && signature) {
      // Dev/test: se houver secret e assinatura, ainda assim valida (defesa em profundidade).
      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        throw new ForbiddenException('Assinatura do webhook invalida.');
      }
    }

    // Normaliza o formato aninhado da Meta Cloud API (entry[].changes[].value.messages[])
    // para o formato plano que o restante do pipeline ja entende. Recibos de
    // status (entregue/lido) sao ignorados aqui.
    const metaNormalization = normalizeMetaCloudPayload(incomingBody);
    if (metaNormalization.ignore) {
      return { success: true, ignored: true, reason: metaNormalization.reason };
    }
    const body = metaNormalization.body;

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

    if (isIgnoredDirectPhone(from)) {
      return {
        success: true,
        ignored: true,
        reason: 'numero ignorado',
      };
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
      await this.whatsappService.sendOutboundResponse(message.from, response, message.tenantId);
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
    // Endpoint de teste — bloqueado em producao (acionaria o bot com tenantId arbitrario).
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Endpoint de teste indisponivel em producao.');
    }

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

  @Get('metrics')
  @ApiOperation({ summary: 'Métricas do bot WhatsApp (requer API key)' })
  @ApiResponse({ status: 200, description: 'Métricas retornadas com sucesso' })
  @ApiResponse({ status: 401, description: 'API key inválida' })
  @ApiResponse({ status: 500, description: 'Servidor mal configurado' })
  async getMetrics(
    @Query('tenantId') tenantId: string,
    @Query('days') days: string = '7',
    @Headers('x-api-key') apiKey?: string,
  ) {
    // Verificar API key para proteger o endpoint
    const validApiKey = process.env.WHATSAPP_METRICS_API_KEY;

    // API key SEMPRE obrigatoria (fail-closed) — em qualquer ambiente.
    // Sem ela configurada, o endpoint fica indisponivel; nunca aberto.
    if (!validApiKey) {
      this.logger.error(
        '[SEGURANCA] WHATSAPP_METRICS_API_KEY nao definido. Endpoint de metricas bloqueado (fail-closed).',
      );
      throw new ForbiddenException('Endpoint nao configurado: WHATSAPP_METRICS_API_KEY ausente.');
    }
    if (!apiKey || !this.safeKeyEquals(apiKey, validApiKey)) {
      throw new UnauthorizedException('API key invalida');
    }

    if (!tenantId) {
      throw new BadRequestException('tenantId é obrigatório');
    }

    const daysNum = parseInt(days, 10) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const metrics = await this.whatsappService.getAnalytics(tenantId, startDate);

    return {
      success: true,
      period_days: daysNum,
      metrics,
    };
  }
}
