/**
 * Bug "Failed to track message metrics": os metodos de ESCRITA do analytics
 * (track*) nunca funcionaram — o nome do repositorio nao bate com a
 * entidade/tabela → cada chamada lancava, caia no catch e logava em nivel
 * `error`, disparando o app-alert no Telegram a cada mensagem do bot.
 *
 * Decisao (analytics "de verdade" adiado ate o bot ao vivo): curto-circuitar a
 * escrita — nenhum write e tentado, nenhum `error` e logado, o alarme cala.
 * Estes testes provam o comportamento no-op das 4 escritas.
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { WhatsAppAnalyticsService, MessageMetrics } from './analytics.service';

// Um db cujo getRepository EXPLODE se for chamado — assim provamos que a escrita
// nem chega a tocar o repositorio (early-return), e nao apenas "engole" o erro.
function explodingDb() {
  const getRepository = jest.fn(() => {
    throw new Error('EntityMetadataNotFoundError (nao deveria ser chamado)');
  });
  return { db: { getRepository } as any, getRepository };
}

const sampleMessageMetrics: MessageMetrics = {
  tenantId: '2675a300-1f03-4c74-b462-99754fd70eb2',
  timestamp: new Date(),
  messageId: 'wamid.ABC',
  customerPhone: '5511999998888',
  direction: 'inbound',
  messageType: 'text',
  processingTimeMs: 42,
  success: true,
};

describe('WhatsAppAnalyticsService — escrita desligada nao dispara alarme', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('🎯 trackMessage: nao toca o repositorio e nao loga error', async () => {
    const { db, getRepository } = explodingDb();
    const service = new WhatsAppAnalyticsService(db);

    await service.trackMessage(sampleMessageMetrics);

    expect(getRepository).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('trackConversion: nao toca o repositorio e nao loga error', async () => {
    const { db, getRepository } = explodingDb();
    const service = new WhatsAppAnalyticsService(db);

    await service.trackConversion('tenant', '5511999998888', 'cart-1', 'order-1', 100);

    expect(getRepository).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('trackAbandonment: nao toca o repositorio e nao loga error', async () => {
    const { db, getRepository } = explodingDb();
    const service = new WhatsAppAnalyticsService(db);

    await service.trackAbandonment('tenant', '5511999998888', 'cart-1', 'checkout', 100);

    expect(getRepository).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('trackConversation: nao toca o repositorio e nao loga error', async () => {
    const { db, getRepository } = explodingDb();
    const service = new WhatsAppAnalyticsService(db);

    await service.trackConversation({
      conversationId: 'conv-1',
      tenantId: 'tenant',
      customerPhone: '5511999998888',
      startedAt: new Date(),
      messageCount: 3,
      inboundCount: 2,
      outboundCount: 1,
      intentDistribution: {},
      actionDistribution: {},
      conversionEvents: [],
      averageResponseTimeMs: 10,
    });

    expect(getRepository).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('trackMessage resolve sem lancar (no-op silencioso)', async () => {
    const { db } = explodingDb();
    const service = new WhatsAppAnalyticsService(db);

    await expect(service.trackMessage(sampleMessageMetrics)).resolves.toBeUndefined();
  });
});
