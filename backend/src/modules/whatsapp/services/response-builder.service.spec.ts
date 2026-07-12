import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ResponseBuilderService } from './response-builder.service';

describe('ResponseBuilderService', () => {
  let service: ResponseBuilderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResponseBuilderService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<ResponseBuilderService>(ResponseBuilderService);
  });

  describe('buildGreeting', () => {
    it('should build greeting without name', () => {
      const greeting = service.buildGreeting();

      expect(greeting).toMatch(/^(Olá|Oi|Tudo bem)/);
      expect(greeting).toContain('Como posso ajudar?');
    });

    it('should include customer name when provided', () => {
      const greeting = service.buildGreeting('João');

      expect(greeting).toContain('João');
      expect(greeting).toContain('Como posso ajudar?');
    });

    it('should handle null name', () => {
      const greeting = service.buildGreeting(null);

      expect(greeting).toBeTruthy();
      expect(greeting).not.toContain('null');
    });
  });

  describe('buildEmptyCartResponse', () => {
    it('should build empty cart message', () => {
      const message = service.buildEmptyCartResponse();

      expect(message).toContain('🛒');
      expect(message).toContain('vazio');
      expect(message).toContain('cardápio');
    });
  });

  describe('buildProductAddedMessage', () => {
    it('should build product added message', () => {
      const message = service.buildProductAddedMessage('Brigadeiro', 2, 5, 15);

      expect(message).toContain('✅');
      expect(message).toContain('2x Brigadeiro');
      expect(message).toContain('R$ 10,00'); // 2 * 5
      expect(message).toContain('R$ 15,00'); // cart total
    });

    it('should handle single quantity', () => {
      const message = service.buildProductAddedMessage('Beijinho', 1, 5, 15);

      expect(message).toContain('1x Beijinho');
    });
  });

  describe('buildHelpMessage', () => {
    it('should build help message with all commands', () => {
      const message = service.buildHelpMessage();

      expect(message).toContain('🛒');
      expect(message).toContain('carrinho');
      expect(message).toContain('adicionar');
      expect(message).toContain('pedido');
      expect(message).toContain('PIX');
      expect(message).toContain('cartão');
    });
  });

  describe('buildErrorMessage', () => {
    it('should build connection error message', () => {
      const message = service.buildErrorMessage('connection', true);

      expect(message).toContain('conexão');
    });

    it('should build timeout error message', () => {
      const message = service.buildErrorMessage('timeout', true);

      expect(message).toContain('Demorei');
    });

    it('should build not found error message', () => {
      const message = service.buildErrorMessage('not_found', false);

      expect(message).toContain('Não encontrei');
    });

    it('should build out of stock error message', () => {
      const message = service.buildErrorMessage('out_of_stock', false);

      expect(message).toContain('fora de estoque');
    });

    it('should fallback to default error message', () => {
      const message = service.buildErrorMessage('unknown_type', true);

      expect(message).toBeTruthy();
    });
  });

  describe('buildCollectionStageMessage', () => {
    it('should build message for collecting_order state', () => {
      const message = service.buildCollectionStageMessage('collecting_order');

      expect(message).toContain('pedir');
    });

    it('should build message for collecting_name state', () => {
      const message = service.buildCollectionStageMessage('collecting_name');

      expect(message).toContain('nome');
    });

    it('should build message for confirming state', () => {
      const message = service.buildCollectionStageMessage('confirming_order');

      expect(message).toContain('Confirma');
    });

    it('should include guidance when provided', () => {
      const message = service.buildCollectionStageMessage(
        'collecting_address',
        undefined,
        'Digite o endereço completo',
      );

      expect(message).toContain('Digite o endereço completo');
    });
  });

  describe('buildMissingInfoMessage', () => {
    it('should build message for missing name', () => {
      const message = service.buildMissingInfoMessage('name');

      expect(message).toContain('nome');
    });

    it('should build message for missing phone', () => {
      const message = service.buildMissingInfoMessage('phone');

      expect(message).toContain('telefone');
    });

    it('should build message for missing address', () => {
      const message = service.buildMissingInfoMessage('address');

      expect(message).toContain('endereço');
    });

    it('should handle unknown field', () => {
      const message = service.buildMissingInfoMessage('unknown_field');

      expect(message).toBeTruthy();
    });
  });

  describe('buildConfirmationMessage', () => {
    it('should build confirmation with default labels', () => {
      const message = service.buildConfirmationMessage('Confirma?');

      expect(message).toContain('Confirma?');
      expect(message).toContain('sim');
      expect(message).toContain('não');
    });

    it('should build confirmation with custom labels', () => {
      const message = service.buildConfirmationMessage('Continuar?', 'sim', 'cancela');

      expect(message).toContain('sim');
      expect(message).toContain('cancela');
    });
  });

  describe('buildOptionsList', () => {
    it('should build options list', () => {
      const options = [
        { id: '1', label: 'Opção 1', description: 'Descrição 1' },
        { id: '2', label: 'Opção 2' },
      ];

      const message = service.buildOptionsList('Escolha:', options);

      expect(message).toContain('Escolha:');
      expect(message).toContain('1. Opção 1');
      expect(message).toContain('Descrição 1');
      expect(message).toContain('2. Opção 2');
    });

    it('should handle empty options', () => {
      const message = service.buildOptionsList('Vazio:', []);

      expect(message).toContain('Vazio:');
    });
  });

  describe('buildWelcomeMessage', () => {
    it('should build welcome message', () => {
      const message = service.buildWelcomeMessage();

      expect(message).toContain('Bem-vindo');
      expect(message).toContain('assistente');
      expect(message).toContain('pedido'); // copy reworded: "cardápio" saiu; hoje guia "Montar seu pedido"
    });
  });

  describe('buildGoodbyeMessage', () => {
    it('should build goodbye message', () => {
      const message = service.buildGoodbyeMessage();

      expect(message).toContain('Até mais');
      expect(message).toContain('prazer');
      expect(message).toContain('novo pedido');
    });
  });

  describe('buildEscalationMessage', () => {
    it('should build escalation message without conversation', () => {
      const message = service.buildEscalationMessage();

      expect(message).toContain('Encaminhando');
      expect(message).toContain('atendente');
    });

    it('should build escalation message with conversation data', () => {
      const conversation = {
        context: {
          customer_data: { name: 'João' },
          pending_order: { items: [{ produto_name: 'Brigadeiro' }] },
        },
      } as any;

      const message = service.buildEscalationMessage(conversation);

      expect(message).toContain('João');
      expect(message).toContain('Brigadeiro'); // NOME do produto (nao so a contagem) — o atendente sabe O QUE o cliente quer
    });

    it('lists product names, guarding against missing/blank ones', () => {
      const conversation = {
        context: {
          customer_data: { name: 'Ana' },
          pending_order: {
            items: [
              { produto_name: 'Brigadeiro' },
              { produto_name: undefined }, // nome ausente -> filtrado
              { produto_name: '  ' }, // vazio -> filtrado
              { produto_name: 'Beijinho' },
            ],
          },
        },
      } as any;

      const message = service.buildEscalationMessage(conversation);

      expect(message).toContain('Itens: Brigadeiro, Beijinho');
      expect(message).not.toContain(', ,'); // nunca "Itens: , ,"
    });

    it('falls back to count when no product name is available', () => {
      const conversation = {
        context: {
          pending_order: { items: [{ produto_name: undefined }, { produto_name: null }] },
        },
      } as any;

      const message = service.buildEscalationMessage(conversation);

      expect(message).toContain('Itens: 2 produto(s)'); // sem nome valido -> contagem, nao quebra
    });
  });

  // Fatia 2 / Movimento B: a frase-fato do status é a fonte única code-owned.
  describe('buildOrderStatusFactPhrase', () => {
    it('mapeia EM_PRODUCAO para a frase-fato aprovada de preparo', () => {
      const phrase = service.buildOrderStatusFactPhrase({ status: 'em_producao' } as any);
      expect(phrase).toContain('em preparo');
    });

    it('mapeia EM_TRANSITO para "saiu para entrega" (não confunde com preparo)', () => {
      const phrase = service.buildOrderStatusFactPhrase({ status: 'em_transito' } as any);
      expect(phrase).toContain('saiu para entrega');
      expect(phrase).not.toContain('preparo');
    });

    it('status desconhecido → frase genérica com o label (nunca quebra)', () => {
      const phrase = service.buildOrderStatusFactPhrase({ status: 'algo_novo' } as any);
      expect(phrase.toLowerCase()).toContain('status');
    });
  });
});