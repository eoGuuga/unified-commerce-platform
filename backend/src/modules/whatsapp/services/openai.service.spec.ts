import { OpenAIService } from './openai.service';
import { MessageIntelligenceService } from './message-intelligence.service';

describe('OpenAIService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const createService = (overrides?: Record<string, unknown>) => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'OPENAI_BASE_URL') return 'http://ollama:11434/v1';
        if (key === 'OPENAI_MODEL') return 'qwen3:4b';
        if (key === 'OPENAI_ALLOW_NO_KEY') return 'true';
        if (key === 'OPENAI_TIMEOUT_MS') return '2000';
        if (key === 'WHATSAPP_LLM_ASSIST_ENABLED') return 'true';
        if (key === 'WHATSAPP_LLM_ASSIST_TIMEOUT_MS') return '1800';
        return undefined;
      }),
      ...(overrides || {}),
    };

    return new OpenAIService(config as any, new MessageIntelligenceService());
  };

  it('parses structured purchase intent from an OpenAI-compatible reply', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: 'fazer_pedido',
                product: 'Banoffe ( torta de banana)',
                quantity: 2,
                confidence: 0.93,
              }),
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as any;

    const service = createService();
    const response = await service.processMessage('quero 2 banoffes');

    expect(response).toEqual({
      intent: 'fazer_pedido',
      product: 'Banoffe ( torta de banana)',
      quantity: 2,
      confidence: 0.93,
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('returns structured conversational assist when the local AI layer is enabled', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                safeReply:
                  'Entendi. Se quiser, eu te ajudo com o cardapio, com o pedido ou com o pagamento sem te fazer repetir tudo.',
                confidence: 0.87,
                detectedGoal: 'ser orientado de forma humana',
                detectedEmotion: 'confused',
                shouldStayInCurrentStage: false,
                mentionsProduct: null,
                responseMode: 'freeform_support',
                salesPreferenceProfile: {
                  occasion: 'gift',
                  style: 'safe',
                  taste: null,
                  recipientHint: 'mae',
                },
              }),
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as any;

    const service = createService();
    const response = await service.generateConversationalAssist({
      message: 'vou fazer omelete',
      currentState: 'idle',
      stageLabel: null,
      catalogSummary: ['Banoffe ( torta de banana) (Delicias) - R$ 18,00'],
      memory: {
        lastIntent: 'suggestion',
      },
    });

    expect(response).toEqual({
      safeReply:
        'Entendi. Se quiser, eu te ajudo com o cardapio, com o pedido ou com o pagamento sem te fazer repetir tudo.',
      confidence: 0.87,
      detectedGoal: 'ser orientado de forma humana',
      detectedEmotion: 'confused',
      shouldStayInCurrentStage: false,
      mentionsProduct: undefined,
      responseMode: 'freeform_support',
      salesPreferenceProfile: {
        occasion: 'gift',
        style: 'safe',
        taste: null,
        recipientHint: 'mae',
      },
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('injects Loucas-specific store context into the conversational assist prompt', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                safeReply: 'Entendi. Posso te ajudar a decidir sem sair da cara da Loucas.',
                confidence: 0.9,
                detectedGoal: 'escolher melhor dentro da Loucas',
                detectedEmotion: 'hesitant',
                shouldStayInCurrentStage: false,
                mentionsProduct: 'Banoffe ( torta de banana)',
                responseMode: 'sales_consultative',
                salesPreferenceProfile: {
                  occasion: 'gift',
                  style: 'delicate',
                  taste: 'less_sweet',
                  recipientHint: 'mae',
                },
              }),
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as any;

    const service = createService();
    await service.generateConversationalAssist({
      message: 'quero algo bonito pra presente',
      currentState: 'idle',
      stageLabel: null,
      catalogSummary: ['Brigadeiro individual mimo (Presentear) - R$ 6,00'],
      memory: {
        lastIntent: 'suggestion',
        salesPreferenceProfile: {
          occasion: 'gift',
          style: 'safe',
          taste: null,
          recipientHint: 'mae',
        },
      },
      storeContext: {
        storeName: 'Loucas por Brigadeiro',
        storePersona: 'loucas_brigadeiro',
        storeLabel: 'brigadeiros, sobremesas cremosas e presentes',
        catalogReading:
          'hoje a Loucas gira em brigadeiros, sobremesas cremosas e presentes.',
        qualificationQuestion:
          'Voce quer ir mais para brigadeiro e docinho, para sobremesa cremosa ou para algo de presentear?',
        focusThemes: ['presente', 'brigadeiro', 'sobremesa cremosa'],
        paymentMethods: ['pix', 'dinheiro'],
        operationRules: ['nao inventar produto fora do catalogo real'],
      },
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.messages[0].content).toContain('Loucas por Brigadeiro');
    expect(payload.messages[1].content).toContain('loja: Loucas por Brigadeiro');
    expect(payload.messages[1].content).toContain('leitura_catalogo_loja');
    expect(payload.messages[1].content).toContain('meios_pagamento_disponiveis_no_whatsapp: pix, dinheiro');
    expect(payload.messages[1].content).toContain('pergunta_consultiva_preferida');
    expect(payload.messages[1].content).toContain('preferencia_ocasião: gift');
  });
});
