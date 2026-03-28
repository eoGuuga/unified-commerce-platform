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
    });
    expect(fetchMock).toHaveBeenCalled();
  });
});
