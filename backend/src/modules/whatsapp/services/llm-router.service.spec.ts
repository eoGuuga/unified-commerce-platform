import { Test, TestingModule } from '@nestjs/testing';
import { LLMRouterService, RouterInput } from './llm-router.service';
import { OpenAIService } from './openai.service';
import { BotConfig } from './bot-config.service';

describe('LLMRouterService — prompt carries store name/description', () => {
  let service: LLMRouterService;
  let routeMessage: jest.Mock;

  beforeEach(async () => {
    routeMessage = jest.fn().mockResolvedValue({
      action: 'greeting',
      params: {},
      confidence: 0.9,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMRouterService,
        { provide: OpenAIService, useValue: { routeMessage } },
      ],
    }).compile();

    service = module.get<LLMRouterService>(LLMRouterService);
  });

  const buildInput = (overrides: Partial<BotConfig['store']> = {}): RouterInput => {
    const botConfig: BotConfig = {
      persona: {
        name: 'Ana',
        role: 'vendedora consultiva',
        tone: 'acolhedora',
        greeting_style: 'Oi!',
      },
      store: {
        name: 'Doceria Canonica',
        description: 'Doces artesanais desde 2020',
        payment_methods: ['pix', 'dinheiro'],
        delivery_options: ['entrega', 'retirada'],
        business_hours: 'seg-sex 09:00-18:00',
        ...overrides,
      },
      rules: ['Nunca invente precos.'],
      model: 'gpt-4o-mini',
      temperature: 0.3,
    };

    return {
      message: 'oi',
      botConfig,
      catalogSummary: [],
      currentState: null,
      recentMessages: [],
    };
  };

  it('KEY: the system prompt built for the LLM CONTAINS the configured store name AND description', async () => {
    await service.route(buildInput());

    // route() -> buildSystemPrompt() -> openAIService.routeMessage(systemPrompt, ...)
    expect(routeMessage).toHaveBeenCalledTimes(1);
    const systemPrompt: string = routeMessage.mock.calls[0][0];

    // Proves store.name / store.description (derived from settings.store_name /
    // settings.description in T2) actually reach the prompt sent to the model.
    expect(systemPrompt).toContain('Doceria Canonica');
    expect(systemPrompt).toContain('Doces artesanais desde 2020');
  });

  it('the system prompt also carries store.payment_methods (marked by the shopkeeper)', async () => {
    await service.route(buildInput({ payment_methods: ['pix', 'dinheiro'] }));

    const systemPrompt: string = routeMessage.mock.calls[0][0];
    expect(systemPrompt).toContain('pix, dinheiro');
  });
});
