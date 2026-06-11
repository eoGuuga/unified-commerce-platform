import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NLPService, IntentType } from './nlp.service';

describe('NLPService', () => {
  let service: NLPService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NLPService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NLPService>(NLPService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processMessage', () => {
    it('should classify VIEW_CATALOG intent', async () => {
      const result = await service.processMessage('Quero ver os produtos');

      expect(result.intent).toBe(IntentType.VIEW_CATALOG);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.processedText).toContain('ver');
      expect(result.processedText).toContain('produtos');
    });

    it('should classify ADD_TO_CART intent', async () => {
      const result = await service.processMessage('Adicionar produto 5 ao carrinho');

      expect(result.intent).toBe(IntentType.ADD_TO_CART);
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.entities.productId).toBe('5');
    });

    it('should classify GREETING intent', async () => {
      const result = await service.processMessage('Olá, bom dia!');

      expect(result.intent).toBe(IntentType.GREETING);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify HELP intent', async () => {
      const result = await service.processMessage('Preciso de ajuda');

      expect(result.intent).toBe(IntentType.HELP);
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should classify CHECKOUT intent', async () => {
      const result = await service.processMessage('Finalizar pedido');

      expect(result.intent).toBe(IntentType.CHECKOUT);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify VIEW_CART intent', async () => {
      const result = await service.processMessage('Ver meu carrinho');

      expect(result.intent).toBe(IntentType.VIEW_CART);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify TALK_TO_HUMAN intent', async () => {
      const result = await service.processMessage('Quero falar com um atendente');

      expect(result.intent).toBe(IntentType.TALK_TO_HUMAN);
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should classify GOODBYE intent', async () => {
      const result = await service.processMessage('Tchau, obrigado!');

      expect(result.intent).toBe(IntentType.GOODBYE);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should extract quantity from message', async () => {
      const result = await service.processMessage('Quero 3 unidades');

      expect(result.entities.quantity).toBe(3);
    });

    it('should extract coupon code', async () => {
      const result = await service.processMessage('Quero usar o cupom DESCONTO20');

      expect(result.entities.couponCode).toBe('DESCONTO20');
    });

    it('should extract phone number', async () => {
      const result = await service.processMessage('Meu telefone é 11999998888');

      expect(result.entities.phoneNumber).toBe('11999998888');
    });

    it('should handle unknown intent', async () => {
      const result = await service.processMessage('asdfghjklqwerty');

      expect(result.intent).toBe(IntentType.UNKNOWN);
      expect(result.confidence).toBeLessThan(0.3);
    });

    it('should normalize text (remove accents)', async () => {
      const result = await service.processMessage('Quero ver catálógo');

      expect(result.processedText).not.toContain('á');
      expect(result.processedText).not.toContain('ó');
    });

    it('should handle abbreviations', async () => {
      const result = await service.processMessage('vc pode me ajudar?');

      expect(result.processedText).toContain('voce');
    });

    it('should return rawText and processedText', async () => {
      const message = 'Olá, quero ver produtos';
      const result = await service.processMessage(message);

      expect(result.rawText).toBe(message);
      expect(result.processedText).toBeTruthy();
      expect(result.processedText.length).toBeGreaterThan(0);
    });
  });

  describe('getResponseSuggestion', () => {
    it('should return appropriate suggestion for VIEW_CATALOG', () => {
      const suggestion = service.getResponseSuggestion(IntentType.VIEW_CATALOG, {});

      expect(suggestion).toContain('catálogo');
    });

    it('should return appropriate suggestion for GREETING', () => {
      const suggestion = service.getResponseSuggestion(IntentType.GREETING, {});

      expect(suggestion).toContain('Olá');
    });

    it('should return appropriate suggestion for UNKNOWN', () => {
      const suggestion = service.getResponseSuggestion(IntentType.UNKNOWN, {});

      expect(suggestion).toContain('não entendi');
    });
  });

  describe('requiresHumanIntervention', () => {
    it('should return true for TALK_TO_HUMAN', () => {
      expect(service.requiresHumanIntervention(IntentType.TALK_TO_HUMAN)).toBe(true);
    });

    it('should return true for COMPLAIN', () => {
      expect(service.requiresHumanIntervention(IntentType.COMPLAIN)).toBe(true);
    });

    it('should return false for other intents', () => {
      expect(service.requiresHumanIntervention(IntentType.VIEW_CATALOG)).toBe(false);
      expect(service.requiresHumanIntervention(IntentType.ADD_TO_CART)).toBe(false);
      expect(service.requiresHumanIntervention(IntentType.CHECKOUT)).toBe(false);
    });
  });

  describe('isCheckoutIntent', () => {
    it('should return true for checkout-related intents', () => {
      expect(service.isCheckoutIntent(IntentType.CHECKOUT)).toBe(true);
      expect(service.isCheckoutIntent(IntentType.PAYMENT)).toBe(true);
      expect(service.isCheckoutIntent(IntentType.CONFIRM_ORDER)).toBe(true);
    });

    it('should return false for non-checkout intents', () => {
      expect(service.isCheckoutIntent(IntentType.VIEW_CATALOG)).toBe(false);
      expect(service.isCheckoutIntent(IntentType.GREETING)).toBe(false);
    });
  });
});