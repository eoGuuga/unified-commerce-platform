import { PedidoStatus } from '../../database/entities/Pedido.entity';
import { WhatsappService } from './whatsapp.service';
import { MessageIntelligenceService } from './services/message-intelligence.service';
import { ConversationalIntelligenceService } from './services/conversational-intelligence.service';
import { ConversationPlannerService } from './services/conversation-planner.service';
import { SalesIntelligenceService } from './services/sales-intelligence.service';
import { SalesPlaybookService } from './services/sales-playbook.service';
import { SalesSegmentStrategyService } from './services/sales-segment-strategy.service';
import { SalesVerticalPackService } from './services/sales-vertical-pack.service';
import { CatalogSalesContextService } from './services/catalog-sales-context.service';
import { ProductOfferIntelligenceService } from './services/product-offer-intelligence.service';

describe('WhatsappService defensive WhatsApp flow', () => {
  const catalog = [
    {
      id: 'p1',
      name: 'Brigadeiro Gourmet',
      description: 'Doce gourmet individual para presente e venda rapida.',
      metadata: {
        sales_pitch: 'chocolate artesanal com boa leitura para mimo individual',
        sales_tags: ['chocolate', 'presente', 'mimo'],
      },
      price: 10.5,
      available_stock: 10,
      created_at: '2026-03-15T00:00:00.000Z',
      categoria: { name: 'Doces' },
    },
    {
      id: 'p2',
      name: 'Brownie Premium',
      description: 'Brownie mais intenso, com leitura premium e otimo para presente.',
      metadata: {
        sales_pitch: 'brownie de chocolate mais intenso para presente e ticket premium',
        sales_tags: ['brownie', 'chocolate', 'premium', 'presente'],
      },
      price: 15,
      available_stock: 8,
      created_at: '2026-03-15T00:00:00.000Z',
      categoria: { name: 'Doces' },
    },
    {
      id: 'p3',
      name: 'Bolo de Cenoura',
      description: 'Opcao forte para festa e comemoracao.',
      metadata: {
        sales_tags: ['bolo', 'festa', 'compartilhar'],
      },
      price: 40,
      available_stock: 3,
      created_at: '2026-03-15T00:00:00.000Z',
      categoria: { name: 'Bolos' },
    },
  ];

  const ambiguousCatalog = [
    ...catalog,
    {
      id: 'p4',
      name: 'Brigadeiro Branco',
      price: 11,
      available_stock: 9,
      created_at: '2026-03-15T00:00:00.000Z',
      categoria: { name: 'Doces' },
    },
  ];

  const loucasCatalog = [
    {
      id: 'l1',
      name: 'Bala de brigadeiro',
      price: 12,
      available_stock: 40,
      created_at: '2026-03-21T00:00:00.000Z',
      categoria: { name: 'Delicias' },
    },
    {
      id: 'l2',
      name: 'Bala de coco beijinho',
      price: 12,
      available_stock: 60,
      created_at: '2026-03-22T00:00:00.000Z',
      categoria: { name: 'Docinhos' },
    },
    {
      id: 'l3',
      name: 'Bolo no pote trufado de maracuja',
      price: 16,
      available_stock: 25,
      created_at: '2026-03-21T00:00:00.000Z',
      categoria: { name: 'Bolo no Pote 220 ml' },
    },
    {
      id: 'l4',
      name: 'Banoffe ( torta de banana)',
      price: 18,
      available_stock: 40,
      created_at: '2026-03-21T00:00:00.000Z',
      categoria: { name: 'Delicias' },
    },
  ];

  const interactiveCatalog = [
    {
      id: 'ic1',
      name: 'Brigadeiro Tradicional',
      price: 12,
      available_stock: 10,
      created_at: '2026-03-22T00:00:00.000Z',
      categoria: { name: 'Docinhos' },
    },
    {
      id: 'ic2',
      name: 'Caixa Presenteavel',
      price: 34,
      available_stock: 8,
      created_at: '2026-03-22T00:00:00.000Z',
      categoria: { name: 'Presentear' },
    },
    {
      id: 'ic3',
      name: 'Bolo no Pote',
      price: 16,
      available_stock: 9,
      created_at: '2026-03-22T00:00:00.000Z',
      categoria: { name: 'Bolo no Pote 220 ml' },
    },
    {
      id: 'ic4',
      name: 'Acaí 400 ml',
      price: 16,
      available_stock: 7,
      created_at: '2026-03-22T00:00:00.000Z',
      categoria: { name: 'Açaí' },
    },
    {
      id: 'ic5',
      name: 'Banoffe',
      price: 18,
      available_stock: 6,
      created_at: '2026-03-22T00:00:00.000Z',
      categoria: { name: 'Delicias' },
    },
    {
      id: 'ic6',
      name: 'Cafe Gelado',
      price: 11,
      available_stock: 5,
      created_at: '2026-03-22T00:00:00.000Z',
      categoria: { name: 'Bebidas' },
    },
    {
      id: 'ic7',
      name: 'Pudim',
      price: 14,
      available_stock: 4,
      created_at: '2026-03-22T00:00:00.000Z',
      categoria: { name: 'Sobremesas' },
    },
  ];

  const giftingCatalogWithAccessories = [
    {
      id: 'g1',
      name: 'Brigadeiro individual mimo',
      description: 'Doce individual com boa leitura para presente rapido.',
      price: 6,
      available_stock: 20,
      created_at: '2026-03-22T00:00:00.000Z',
      categoria: { name: 'Presentear' },
    },
    {
      id: 'g2',
      name: 'Caixa presenteavel com 3 brigadeiros',
      description: 'Caixa pronta para presentear com chocolate artesanal.',
      price: 12,
      available_stock: 15,
      created_at: '2026-03-22T00:00:00.000Z',
      categoria: { name: 'Presentear' },
    },
    {
      id: 'g3',
      name: 'Cartao recadinho',
      description: 'Complemento para acompanhar o presente.',
      price: 2.5,
      available_stock: 30,
      created_at: '2026-03-22T00:00:00.000Z',
      categoria: { name: 'Presentear' },
    },
    {
      id: 'g4',
      name: 'Sacola Kraft personalizada G',
      description: 'Embalagem de apoio para montar o presente.',
      price: 3,
      available_stock: 30,
      created_at: '2026-03-22T00:00:00.000Z',
      categoria: { name: 'Presentear' },
    },
  ];

  const fashionCatalog = [
    {
      id: 'f1',
      name: 'Blazer Premium',
      description: 'Peca marcante para noite e ocasiões especiais.',
      price: 189.9,
      available_stock: 6,
      created_at: '2026-03-20T00:00:00.000Z',
      categoria: { name: 'Moda Feminina' },
    },
    {
      id: 'f2',
      name: 'Camiseta Basica Versatil',
      description: 'Malha leve para uso do dia a dia com encaixe facil.',
      price: 69.9,
      available_stock: 12,
      created_at: '2026-03-20T00:00:00.000Z',
      categoria: { name: 'Roupas' },
    },
  ];

  const petCatalog = [
    {
      id: 'pet1',
      name: 'Racao Premium Porte Medio',
      description: 'Nutricao equilibrada para rotina do pet adulto.',
      price: 129.9,
      available_stock: 7,
      created_at: '2026-03-20T00:00:00.000Z',
      categoria: { name: 'Pet' },
    },
    {
      id: 'pet2',
      name: 'Petisco Natural Filhote',
      description: 'Snack pratico para reforco e recompensa.',
      price: 34.9,
      available_stock: 15,
      created_at: '2026-03-20T00:00:00.000Z',
      categoria: { name: 'Petiscos' },
    },
  ];

  const restaurantCatalog = [
    {
      id: 'r1',
      name: 'Combo Executivo',
      description: 'Refeicao completa para almoco com mais sustancia.',
      price: 34.9,
      available_stock: 10,
      created_at: '2026-03-20T00:00:00.000Z',
      categoria: { name: 'Executivo' },
    },
    {
      id: 'r2',
      name: 'Lanche Rapido Artesanal',
      description: 'Opcao pratica para correria sem perder sabor.',
      price: 24.9,
      available_stock: 12,
      created_at: '2026-03-20T00:00:00.000Z',
      categoria: { name: 'Lanches' },
    },
    {
      id: 'r3',
      name: 'Suco Natural',
      description: 'Bebida leve para acompanhar refeicao completa.',
      price: 9.9,
      available_stock: 15,
      created_at: '2026-03-20T00:00:00.000Z',
      categoria: { name: 'Bebidas' },
    },
  ];

  const electronicsCatalog = [
    {
      id: 'e1',
      name: 'Cabo Lightning Turbo',
      description: 'Compatibilidade segura com iPhone e celular, com carga rapida.',
      price: 59.9,
      available_stock: 15,
      created_at: '2026-03-20T00:00:00.000Z',
      categoria: { name: 'Cabos' },
    },
    {
      id: 'e2',
      name: 'Carregador USB-C Turbo',
      description: 'Carregador de celular Android e USB-C com mais potencia.',
      price: 79.9,
      available_stock: 11,
      created_at: '2026-03-20T00:00:00.000Z',
      categoria: { name: 'Carregadores' },
    },
  ];

  const servicesCatalog = [
    {
      id: 's1',
      name: 'Pacote de Manutencao Mensal',
      description: 'Servico com assistencia, revisao e agendamento.',
      price: 199.9,
      available_stock: 10,
      created_at: '2026-03-20T00:00:00.000Z',
      categoria: { name: 'Servicos' },
    },
    {
      id: 's2',
      name: 'Visita Tecnica de Avaliacao',
      description: 'Avaliacao inicial para fechar o melhor escopo.',
      price: 79.9,
      available_stock: 10,
      created_at: '2026-03-20T00:00:00.000Z',
      categoria: { name: 'Atendimento' },
    },
  ];

  const createFixture = (
    products: Array<Record<string, unknown>> = [],
    overrides?: {
      config?: Record<string, unknown>;
      cacheService?: Record<string, any>;
      conversation?: Record<string, jest.Mock>;
      notifications?: Record<string, jest.Mock>;
      orders?: Record<string, jest.Mock>;
      payments?: Record<string, jest.Mock>;
      productsService?: Record<string, jest.Mock>;
      tenants?: Record<string, jest.Mock>;
    },
  ) => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://gtsofthub.com.br';
        return undefined;
      }),
      ...(overrides?.config || {}),
    };

    const openAIService = {
      processMessage: jest.fn().mockResolvedValue({ intent: 'outro', confidence: 0.5 }),
    };

    const cacheService = {
      withConversationLock: jest.fn(async (_tenantId: string, _customerPhone: string, handler: () => Promise<unknown>) => {
        return await handler();
      }),
      ...(overrides?.cacheService || {}),
    };

    const conversationService = {
      updateState: jest.fn(),
      clearPendingOrder: jest.fn(),
      clearPedido: jest.fn(),
      clearCustomerData: jest.fn(),
      saveCustomerData: jest.fn(),
      savePendingOrder: jest.fn(),
      getOrCreateConversation: jest.fn(),
      saveMessage: jest.fn(),
      updateContext: jest.fn(),
      setPedidoId: jest.fn(),
      findById: jest.fn(),
      ...(overrides?.conversation || {}),
    };

    const tenantsService = {
      findOneById: jest.fn().mockResolvedValue({
        id: 'tenant-id',
        settings: {
          whatsappBotEnabled: true,
        },
      }),
      updateSettings: jest.fn().mockImplementation(async (_tenantId: string, partial: Record<string, unknown>) => ({
        id: 'tenant-id',
        settings: {
          whatsappBotEnabled: true,
          ...partial,
        },
      })),
      ...(overrides?.tenants || {}),
    };

    const productsService = {
      findAll: jest.fn().mockResolvedValue(products),
      ...(overrides?.productsService || {}),
    };

    const ordersService = {
      findOne: jest.fn(),
      findByOrderNo: jest.fn(),
      findLatestByCustomerPhone: jest.fn(),
      findLatestPendingByCustomerPhone: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      ...(overrides?.orders || {}),
    };

    const paymentsService = {
      createPayment: jest.fn(),
      ...(overrides?.payments || {}),
    };

    const notificationsService = {
      sendWhatsAppMessage: jest.fn(),
      sendOrderCreatedNotification: jest.fn(),
      ...(overrides?.notifications || {}),
    };

    const messageIntelligenceService = new MessageIntelligenceService();
    const conversationalIntelligenceService = new ConversationalIntelligenceService(
      messageIntelligenceService,
    );
    const conversationPlannerService = new ConversationPlannerService();
    const salesIntelligenceService = new SalesIntelligenceService(messageIntelligenceService);
    const salesPlaybookService = new SalesPlaybookService(messageIntelligenceService);
    const salesSegmentStrategyService = new SalesSegmentStrategyService(
      messageIntelligenceService,
    );
    const salesVerticalPackService = new SalesVerticalPackService(
      messageIntelligenceService,
    );
    const catalogSalesContextService = new CatalogSalesContextService(
      messageIntelligenceService,
    );
    const productOfferIntelligenceService = new ProductOfferIntelligenceService(
      messageIntelligenceService,
    );

    const service = new WhatsappService(
      config as any,
      openAIService as any,
      messageIntelligenceService as any,
      conversationalIntelligenceService as any,
      conversationPlannerService as any,
      salesIntelligenceService as any,
      salesPlaybookService as any,
      salesSegmentStrategyService as any,
      salesVerticalPackService as any,
      catalogSalesContextService as any,
      productOfferIntelligenceService as any,
      cacheService as any,
      conversationService as any,
      tenantsService as any,
      productsService as any,
      ordersService as any,
      paymentsService as any,
      {
        validateCoupon: jest.fn(),
      } as any,
      notificationsService as any,
    );

    return {
      service: service as any,
      config,
      cacheService,
      conversationService,
      tenantsService,
      ordersService,
      paymentsService,
      productsService,
      notificationsService,
    };
  };

  const createService = (products: Array<Record<string, unknown>> = []) =>
    createFixture(products).service;

  const pendingOrder = {
    id: 'ord-1',
    order_no: 'PED-20260315-CACE',
    status: PedidoStatus.PENDENTE_PAGAMENTO,
    delivery_type: 'pickup',
    total_amount: 25,
    customer_name: 'Cliente Perfeito',
    itens: [],
  };

  const confirmedOrder = {
    ...pendingOrder,
    status: PedidoStatus.CONFIRMADO,
  };

  const cancelledOrder = {
    ...pendingOrder,
    status: PedidoStatus.CANCELADO,
  };

  const pendingConversationOrder = {
    items: [
      {
        produto_id: 'p1',
        produto_name: 'Brigadeiro Gourmet',
        quantity: 1,
        unit_price: 10.5,
      },
    ],
    subtotal: 10.5,
    discount_amount: 0,
    shipping_amount: 0,
    total_amount: 10.5,
  };

  const createConversation = (overrides?: Record<string, unknown>) => ({
    id: 'conv-1',
    tenant_id: 'tenant-id',
    customer_phone: '5511999999999',
    customer_name: undefined,
    status: 'active',
    context: {
      state: 'idle',
    },
    pedido_id: undefined,
    started_at: new Date('2026-03-15T00:00:00.000Z'),
    last_message_at: new Date('2026-03-15T00:00:00.000Z'),
    completed_at: undefined,
    metadata: {},
    ...(overrides || {}),
  });

  it('rejects command words as customer name', () => {
    const service = createService() as any;

    expect(service.validateName('sim')).toEqual(
      expect.objectContaining({
        valid: false,
      }),
    );
    expect(service.validateName('pix')).toEqual(
      expect.objectContaining({
        valid: false,
      }),
    );
  });

  it('extracts natural name phrases before saving the customer name', async () => {
    const { service, conversationService } = createFixture(catalog);

    const response = await service.processCustomerNamePremium(
      'me chamo Ana Paula',
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_name',
          pending_order: pendingConversationOrder,
          customer_data: {},
        },
      }),
    );

    expect(conversationService.saveCustomerData).toHaveBeenCalledWith('conv-1', {
      name: 'Ana Paula',
    });
    expect(response).toContain('Como voce prefere receber esse pedido?');
  });

  it('does not accept a partial street as a complete delivery address', async () => {
    const { service, conversationService } = createFixture(catalog);

    const response = await service.processCustomerAddressPremium(
      'Rua das Flores',
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_address',
          pending_order: pendingConversationOrder,
          customer_data: {
            name: 'Ana Paula',
            delivery_type: 'delivery',
          },
        },
      }),
    );

    expect(conversationService.saveCustomerData).not.toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        address: expect.anything(),
      }),
    );
    expect(conversationService.updateContext).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        address_draft_parts: ['Rua das Flores'],
      }),
    );
    expect(response).toContain('Estou montando o endereco por etapas');
    expect(response).toContain('Agora me envie o numero');
  });

  it('does not guess a stock item when an important qualifier is missing from the catalog match', async () => {
    const { service } = createFixture(loucasCatalog);

    const response = await service.getPremiumStockResponse(
      'estoque de bolo de chocolate',
      'tenant-id',
    );

    expect(response).toContain('Nao achei o item "bolo chocolate"');
    expect(response).not.toContain('Aqui esta a leitura mais util deste item agora.');
  });

  it('assembles interrupted address fragments before moving on', async () => {
    const { service, conversationService } = createFixture(catalog);

    const response = await service.processCustomerAddressPremium(
      'Centro, Sao Paulo, SP',
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_address',
          pending_order: pendingConversationOrder,
          customer_data: {
            name: 'Ana Paula',
            delivery_type: 'delivery',
          },
          address_draft_parts: ['Rua das Flores', '123'],
        },
      }),
    );

    expect(conversationService.saveCustomerData).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        delivery_type: 'delivery',
        address: expect.objectContaining({
          street: 'Rua das Flores',
          number: '123',
          neighborhood: 'Centro',
          city: 'Sao Paulo',
          state: 'SP',
        }),
      }),
    );
    expect(response).toContain('TELEFONE DE CONTATO');
  });

  it('does not treat a full delivery address with CEP as a phone number', async () => {
    const { service, conversationService } = createFixture(loucasCatalog);

    const response = await service.processCustomerAddressPremium(
      'Rua joana darc, 14, casa, icoaraci, pará. PA, 66814-000',
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_address',
          pending_order: pendingConversationOrder,
          customer_data: {
            name: 'Jordan Lincoln Vasconcelos Kzan',
            delivery_type: 'delivery',
          },
        },
      }),
    );

    expect(response).not.toContain('Recebi um telefone');
    expect(response).toContain('Estou montando o endereco por etapas');
    expect(conversationService.updateContext).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        address_draft_parts: expect.any(Array),
      }),
    );
  });

  it('parses loose audio-like addresses without commas', async () => {
    const { service, conversationService } = createFixture(catalog);

    const response = await service.processCustomerAddressPremium(
      'meu endereco e rua das flores 123 centro sao paulo sp',
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_address',
          pending_order: pendingConversationOrder,
          customer_data: {
            name: 'Ana Paula',
            delivery_type: 'delivery',
          },
        },
      }),
    );

    expect(conversationService.saveCustomerData).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        delivery_type: 'delivery',
        address: expect.objectContaining({
          street: 'rua das flores',
          number: '123',
          neighborhood: 'centro',
          city: 'sao paulo',
          state: 'SP',
        }),
      }),
    );
    expect(response).toContain('TELEFONE DE CONTATO');
  });

  it('keeps multi-item orders exact instead of swapping items from the catalog', async () => {
    const { service, conversationService } = createFixture(loucasCatalog);

    const response = await service.generateResponse(
      'Quero 5 bala de brigadeiro, 2 bolo de pote trufado de maracuja',
      'tenant-id',
      createConversation(),
    );

    expect(conversationService.savePendingOrder).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            produto_name: 'Bala de brigadeiro',
            quantity: 5,
          }),
          expect.objectContaining({
            produto_name: 'Bolo no pote trufado de maracuja',
            quantity: 2,
          }),
        ]),
      }),
    );
    expect(response).toContain('PEDIDO PREPARADO');
  });

  it('adjusts the pending order during name collection instead of treating the message as address noise', async () => {
    const { service, conversationService } = createFixture(loucasCatalog);

    const response = await service.generateResponse(
      'vc nao entendeu que faltou 2 bolo de pote trufado de maracuja',
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_name',
          pending_order: {
            items: [
              {
                produto_id: 'l1',
                produto_name: 'Bala de brigadeiro',
                quantity: 5,
                unit_price: 12,
              },
            ],
            subtotal: 60,
            discount_amount: 0,
            shipping_amount: 0,
            total_amount: 60,
          },
          customer_data: {},
        },
      }),
    );

    expect(conversationService.savePendingOrder).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            produto_name: 'Bala de brigadeiro',
            quantity: 5,
          }),
          expect.objectContaining({
            produto_name: 'Bolo no pote trufado de maracuja',
            quantity: 2,
          }),
        ]),
      }),
    );
    expect(response).toContain('Pedido ajustado com seguranca.');
    expect(response).toContain('nome completo');
  });

  it('realigns the flow when an address is sent during phone collection', async () => {
    const service = createService(catalog) as any;

    const response = await service.generateResponse(
      'Rua das Flores, 123, Centro, Sao Paulo, SP',
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_phone',
          pending_order: pendingConversationOrder,
          customer_data: {
            name: 'Ana Paula',
            delivery_type: 'delivery',
          },
        },
      }),
    );

    expect(response).toContain('preciso do telefone de contato');
  });

  it('does not cancel the whole order when the customer says the final review is not correct', async () => {
    const { service, conversationService } = createFixture(loucasCatalog);

    const response = await service.processOrderConfirmationPremium(
      'nao ta certo',
      'tenant-id',
      createConversation({
        context: {
          state: 'confirming_order',
          pending_order: {
            items: [
              {
                produto_id: 'l1',
                produto_name: 'Bala de brigadeiro',
                quantity: 5,
                unit_price: 12,
              },
            ],
            subtotal: 60,
            discount_amount: 0,
            shipping_amount: 10,
            total_amount: 70,
          },
          customer_data: {
            name: 'Jordan Lincoln Vasconcelos Kzan',
            delivery_type: 'delivery',
            phone: '+5591985198675',
            notes: '',
            address: {
              street: 'Rua joana darc',
              number: '14',
              neighborhood: 'Icoaraci',
              city: 'Belem',
              state: 'PA',
              zipCode: '66814000',
            },
          },
        },
      }),
    );

    expect(conversationService.clearPendingOrder).not.toHaveBeenCalled();
    expect(response).toContain('vamos ajustar o pedido');
  });

  it('recovers loose collection fragments without context instead of guessing intent', async () => {
    const service = createService(catalog) as any;

    await expect(service.generateResponse('123', 'tenant-id')).resolves.toContain(
      'Ainda nao tenho um pedido em andamento',
    );
    await expect(service.generateResponse('centro', 'tenant-id')).resolves.toContain(
      'Ainda nao tenho um pedido em andamento',
    );
  });

  it('returns safe guidance for bare order intents', async () => {
    const service = createService() as any;

    const response = await service.generateResponse('quero???', 'tenant-id');

    expect(response).toContain('quantidade + produto');
  });

  it('returns a soft reset message for negative replies without context', async () => {
    const service = createService() as any;

    const response = await service.generateResponse('nao vou querer mais', 'tenant-id');

    expect(response).toContain('Sem problema.');
  });

  it('normalizes colloquial negative phrases without context', async () => {
    const service = createService() as any;

    const response = await service.generateResponse('num vou querer mais', 'tenant-id');

    expect(response).toContain('Sem problema.');
  });

  it('rejects zero and negative quantities before product lookup', async () => {
    const service = createService() as any;

    await expect(service.processOrder('quero 0 brigadeiros', 'tenant-id')).resolves.toContain('Quantidade minima e 1');
    await expect(service.processOrder('quero -1 brigadeiro', 'tenant-id')).resolves.toContain('Quantidade minima e 1');
  });

  it('does not keep meaningless product names after parsing', () => {
    const service = createService() as any;

    expect(service.extractOrderInfo('quero???')).toEqual({
      quantity: null,
      productName: null,
    });
  });

  it('sanitizes hostile payloads before processing', () => {
    const service = createService() as any;

    expect(service.sanitizeInput('<script>alert(1)</script> quero "2" brigadeiros')).toBe('quero 2 brigadeiros');
  });

  it('understands low-literacy variations of order intent', () => {
    const service = createService() as any;

    expect(service.isOrderIntent('qro 2 brigadeiro')).toBe(true);
    expect(service.isOrderIntent('kero 1 bolo')).toBe(true);
    expect(service.isOrderIntent('precizo 3 brigadeiro')).toBe(true);
    expect(service.isOrderIntent('me ve meia dz de brigadeiro pra retirar no pix')).toBe(true);
    expect(service.isOrderIntent('nao vou querer mais')).toBe(false);
  });

  it('extracts audio-like order phrases without keeping payment or delivery noise', () => {
    const service = createService() as any;

    expect(service.extractOrderInfo('me ve meia dz de brigadeiro pra retirar no pix')).toEqual({
      quantity: 6,
      productName: 'brigadeiro',
    });
  });

  it('normalizes chaotic audio transcripts into a valid multi-item order', async () => {
    const { service, conversationService } = createFixture(catalog, {
      conversation: {
        getOrCreateConversation: jest.fn().mockResolvedValue(createConversation()),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'oi bom dia queria ver se tem como separar pra mim 1 brigadeiro gourmet e um brownie premium pra retirar no pix ta',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'audio-chaos-1',
      messageType: 'audio',
      metadata: {
        audio: true,
        transcriptionSource: 'mock-stt',
      },
    });

    expect(conversationService.savePendingOrder).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ produto_name: 'Brigadeiro Gourmet', quantity: 1 }),
          expect.objectContaining({ produto_name: 'Brownie Premium', quantity: 1 }),
        ]),
      }),
    );
    expect(conversationService.saveMessage).toHaveBeenCalledWith(
      'conv-1',
      'inbound',
      expect.stringContaining('1 brigadeiro gourmet e um brownie premium'),
      'audio',
      expect.objectContaining({
        messageId: 'audio-chaos-1',
        transcriptionSource: 'mock-stt',
      }),
    );
    expect(response).toContain('PEDIDO PREPARADO');
  });

  it('understands heavily regional audio-like phrasing without paid AI', async () => {
    const { service, conversationService } = createFixture(catalog, {
      conversation: {
        getOrCreateConversation: jest.fn().mockResolvedValue(createConversation()),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'oxe meu fi mim ve 2 brigadeiro gourmet e 1 brownie premium pra viagem no pix visse',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'audio-regional-1',
      messageType: 'audio',
      metadata: {
        audio: true,
        transcriptionSource: 'mock-stt-regional',
      },
    });

    expect(conversationService.savePendingOrder).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ produto_name: 'Brigadeiro Gourmet', quantity: 2 }),
          expect.objectContaining({ produto_name: 'Brownie Premium', quantity: 1 }),
        ]),
      }),
    );
    expect(response).toContain('PEDIDO PREPARADO');
  });

  it('understands extremely noisy regional audio transcripts without paid AI', async () => {
    const { service, conversationService } = createFixture(catalog, {
      conversation: {
        getOrCreateConversation: jest.fn().mockResolvedValue(createConversation()),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'eita meu rei seguinte kkk me arruma 2 brigadeiro gourmet e 1 brownie premium pra nois retirar no piks hein',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'audio-regional-2',
      messageType: 'audio',
      metadata: {
        audio: true,
        transcriptionSource: 'mock-stt-regional-noisy',
      },
    });

    expect(conversationService.savePendingOrder).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ produto_name: 'Brigadeiro Gourmet', quantity: 2 }),
          expect.objectContaining({ produto_name: 'Brownie Premium', quantity: 1 }),
        ]),
      }),
    );
    expect(response).toContain('PEDIDO PREPARADO');
  });

  it('matches uniquely truncated product prefixes without guessing the wrong item', () => {
    const service = createService(catalog) as any;

    expect(service.findProductByName(catalog, 'brigadeir').produto?.name).toBe('Brigadeiro Gourmet');
    expect(service.findProductByName(catalog, 'brownie pr').produto?.name).toBe('Brownie Premium');
  });

  it('detects multi-item orders with written quantities and colloquial connectors', () => {
    const service = createService() as any;

    expect(service.looksLikeMultiItemOrder('quero 2 brigadeiros e um brownie')).toBe(true);
    expect(service.looksLikeMultiItemOrder('me ve 2 brigadeiros mais 1 brownie no pix')).toBe(true);
    expect(service.extractMultipleOrderInfos('quero 2 brigadeiros e um brownie')).toEqual([
      { quantity: 2, productName: 'brigadeiros' },
      { quantity: 1, productName: 'brownie' },
    ]);
    expect(service.extractMultipleOrderInfos('porra quero 2 brigadeiros e um brownie')).toEqual([
      { quantity: 2, productName: 'brigadeiros' },
      { quantity: 1, productName: 'brownie' },
    ]);
  });

  it('finds products even with common misspellings', () => {
    const service = createService(catalog) as any;

    expect(service.findProductByName(catalog, 'brigadero').produto?.name).toBe('Brigadeiro Gourmet');
    expect(service.findProductByName(catalog, 'brounie').produto?.name).toBe('Brownie Premium');
    expect(service.findProductByName(catalog, 'bolo de cenora').produto?.name).toBe('Bolo de Cenoura');
  });

  it('returns similar suggestions when the typo is still ambiguous', () => {
    const service = createService(ambiguousCatalog) as any;

    const result = service.findProductByName(ambiguousCatalog, 'brigad');

    expect(result.produto).toBeNull();
    expect(result.sugestoes?.length).toBeGreaterThan(0);
  });

  it('recognizes noisy status questions and flexible order codes', () => {
    const service = createService() as any;

    expect(service.looksLikeOrderStatusQuery('cade meu pedido')).toBe(true);
    expect(service.looksLikeOrderStatusQuery('onde ta minha encomeda')).toBe(true);
    expect(service.looksLikeOrderStatusQuery('cade')).toBe(false);
    expect(service.looksLikeOrderStatusQuery('cancela meu pedido')).toBe(false);
    expect(service.extractOrderNo('status ped 20260315 cace')).toBe('PED-20260315-CACE');
  });

  it('uses live order context for short status messages', () => {
    const service = createService() as any;

    expect(
      service.looksLikeOrderStatusQuery('ja saiu?', {
        pedido_id: 'ord-1',
        context: { state: 'waiting_payment' },
      }),
    ).toBe(true);
    expect(
      service.looksLikeOrderStatusQuery('cade o motoboy', {
        pedido_id: 'ord-1',
        context: { state: 'order_confirmed' },
      }),
    ).toBe(true);
  });

  it('understands soft cancellation only when there is order context', () => {
    const service = createService() as any;

    expect(service.isCancelIntent('nao vou querer mais')).toBe(false);
    expect(service.isCancelIntent('cancela meu pedido')).toBe(true);
    expect(
      service.isCancelIntent(
        'nao vou querer mais',
        { pedido_id: 'ord-1', context: { state: 'waiting_payment' } },
        'waiting_payment',
      ),
    ).toBe(true);
  });

  it('detects conversational resume intent without depending on a single hardcoded sentence', () => {
    const service = createService() as any;

    expect(service.isReopenIntent('bora continuar meu pedido de onde parei')).toBe(true);
    expect(service.isReopenIntent('pode retomar aqui pra mim')).toBe(true);
    expect(service.isReopenIntent('reabri pedid')).toBe(true);
  });

  it('detects natural order intent from noisy free-form messages', () => {
    const service = createService() as any;

    expect(service.isOrderIntent('to querendo 2 brigadeiro gourmet pfv')).toBe(true);
    expect(service.isOrderIntent('quero 1 brownie premium')).toBe(true);
  });

  it('does not confuse conversational order phrasing with loose context recovery', () => {
    const service = createService() as any;

    expect(service.isLooseReplyWithoutContext('to querendo 2 brigadeiro gourmet por favor')).toBe(false);
  });

  it('continues the last ordered product when the customer only asks for more units', async () => {
    const { service, conversationService } = createFixture(catalog);

    const response = await service.generateResponse(
      'mais 2',
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
          intelligence_memory: {
            last_intent: 'order',
            last_product_name: 'Brigadeiro Gourmet',
            last_product_names: ['Brigadeiro Gourmet'],
            last_quantity: 1,
          },
        },
      }),
    );

    expect(conversationService.savePendingOrder).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ produto_name: 'Brigadeiro Gourmet', quantity: 2 }),
        ]),
      }),
    );
    expect(response).toContain('PEDIDO PREPARADO');
  });

  it('turns a numeric reply into the intended order when there is remembered suggestion context', async () => {
    const { service, conversationService } = createFixture(catalog);

    const response = await service.generateResponse(
      '2',
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
          intelligence_memory: {
            last_intent: 'suggestion',
            last_product_names: ['Brigadeiro Gourmet', 'Brownie Premium'],
            last_quantity: 3,
            last_query: 'brounie',
          },
        },
      }),
    );

    expect(conversationService.savePendingOrder).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ produto_name: 'Brownie Premium', quantity: 3 }),
        ]),
      }),
    );
    expect(response).toContain('PEDIDO PREPARADO');
  });

  it('defaults numeric recommendation selection to one unit when the suggested product name contains numbers', async () => {
    const recommendationCatalog = [
      {
        id: 'gift1',
        name: 'Caixa presenteavel 12 brigadeiros tradicionais',
        price: 48,
        available_stock: 10,
        created_at: '2026-03-21T00:00:00.000Z',
        categoria: { name: 'Presentear' },
      },
      {
        id: 'gift2',
        name: 'Caixa presenteavel com 6 brigadeiros tradicionais',
        price: 26,
        available_stock: 12,
        created_at: '2026-03-21T00:00:00.000Z',
        categoria: { name: 'Presentear' },
      },
    ];

    const { service, conversationService } = createFixture(recommendationCatalog);

    const response = await service.generateResponse(
      '2',
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
          intelligence_memory: {
            last_intent: 'recommendation',
            last_product_names: recommendationCatalog.map((product) => product.name),
            last_query: 'algo para presente',
          },
        },
      }),
    );

    expect(conversationService.savePendingOrder).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            produto_name: 'Caixa presenteavel com 6 brigadeiros tradicionais',
            quantity: 1,
          }),
        ]),
      }),
    );
    expect(response).toContain('PEDIDO PREPARADO');
  });

  it('keeps consultation mode when selecting a remembered price suggestion by number', async () => {
    const { service } = createFixture(catalog);

    const response = await service.generateResponse(
      '1',
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
          intelligence_memory: {
            last_intent: 'price',
            last_product_names: ['Brigadeiro Gourmet', 'Brownie Premium'],
            last_query: 'brigad premium',
          },
        },
      }),
    );

    expect(response).toContain('Aqui esta a leitura mais clara deste item.');
    expect(response).toContain('Brigadeiro Gourmet');
  });

  it('reuses recommendation context when the customer points to a suggested item', async () => {
    const { service } = createFixture(catalog);

    const response = await service.generateResponse(
      'esse',
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
          intelligence_memory: {
            last_intent: 'recommendation',
            last_product_name: 'Brownie Premium',
            last_product_names: ['Brownie Premium', 'Brigadeiro Gourmet'],
          },
        },
      }),
    );

    expect(response.toLowerCase()).toContain('quantos *brownie premium*');
  });

  it('treats budget-led messages as consultative selling instead of direct order capture', async () => {
    const { service, conversationService } = createFixture(catalog);

    const response = await service.generateResponse('quero algo ate 12 reais', 'tenant-id');

    expect(conversationService.savePendingOrder).not.toHaveBeenCalled();
    expect(response).toContain('teto de ate R$ 12,00');
    expect(response).toContain('Brigadeiro Gourmet');
  });

  it('compares products with a commercial recommendation', async () => {
    const { service } = createFixture(catalog);

    const response = await service.generateResponse(
      'qual vale mais a pena brigadeiro gourmet ou brownie premium',
      'tenant-id',
    );

    expect(response).toContain('Vou te comparar do jeito mais util.');
    expect(response).toContain('Brigadeiro Gourmet');
    expect(response).toContain('Brownie Premium');
    expect(response).toContain('Se a prioridade for economizar');
  });

  it('answers price objections with safer alternatives from the catalog', async () => {
    const { service } = createFixture(catalog);

    const response = await service.generateResponse(
      'ta caro, tem algo mais em conta?',
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
          intelligence_memory: {
            last_intent: 'price',
            last_product_name: 'Brownie Premium',
            last_product_names: ['Brownie Premium'],
          },
        },
      }),
    );

    expect(response).toContain('preocupacao com custo');
    expect(response).toContain('Brigadeiro Gourmet');
    expect(response).toContain('Brownie Premium');
  });

  it('handles recommendation requests as guided selling instead of greeting fallback', async () => {
    const { service } = createFixture(catalog);

    const response = await service.generateResponse(
      'oi, nao sei qual escolher para presente',
      'tenant-id',
    );

    expect(response).toContain('presentear bem');
    expect(response).toContain('Brownie Premium');
  });

  it('reads the configured chocolate catalog before recommending', async () => {
    const { service } = createFixture(catalog);

    const response = await service.generateResponse(
      'me indica algo para presente',
      'tenant-id',
    );

    expect(response).toContain('Dentro do catalogo atual da loja');
    expect(response).toContain('chocolates e doces');
    expect(response).toContain('chocolate');
    expect(response).toContain('presente');
  });

  it('reflects combined intent with recipient, budget, trust and urgency in the sales answer', async () => {
    const { service } = createFixture(catalog);

    const response = await service.generateResponse(
      'me indica um presente pra minha mae ate 14 reais, sem erro e sem perder tempo',
      'tenant-id',
    );

    expect(response).toContain('presentear sua mae');
    expect(response).toContain('um presente para sua mae');
    expect(response).toContain('um teto de ate R$ 14,00');
    expect(response).toContain('vontade de acertar sem erro');
    expect(response).toContain('Brigadeiro Gourmet');
  });

  it('uses configured product descriptions and metadata to qualify the chocolate sale', async () => {
    const { service } = createFixture(catalog);

    const response = await service.generateResponse(
      'quero algo mais premium de chocolate para presente',
      'tenant-id',
    );

    expect(response).toContain('Brownie Premium');
    expect(response).toContain('Dentro do catalogo atual');
    expect(response).toContain('boa leitura para presente');
    expect(response).toContain('Voce quer um presente mais marcante na caixa');
  });

  it('guides chocolate gift-box conversations with a stronger presentation qualifier', async () => {
    const { service } = createFixture(catalog);

    const response = await service.generateResponse(
      'me indica algo mais premium para presente',
      'tenant-id',
    );

    expect(response).toContain('presente pronto para entregar');
    expect(response).toContain('marcante na caixa');
  });

  it('guides chocolate-heavy conversations with an intensity qualifier', async () => {
    const { service } = createFixture(catalog);

    const response = await service.generateResponse(
      'me indica algo mais chocolatudo e intenso',
      'tenant-id',
    );

    expect(response).toContain('bate mais forte em chocolate e desejo');
    expect(response).toContain('mais intenso no chocolate');
    expect(response).toContain('Brownie Premium');
  });

  it('guides sharing conversations with a divide-or-table qualifier', async () => {
    const { service } = createFixture(catalog);

    const response = await service.generateResponse(
      'me indica algo pra dividir com mais gente',
      'tenant-id',
    );

    expect(response).toContain('compartilhamento');
    expect(response).toContain('dividir facil');
    expect(response).toContain('Bolo de Cenoura');
  });

  it('guides self-treat conversations with a desire-first qualifier', async () => {
    const { service } = createFixture(catalog);

    const response = await service.generateResponse(
      'quero um mimo pra mim, mais chocolatudo',
      'tenant-id',
    );

    expect(response).toContain('mimo individual');
    expect(response).toContain('mais intenso');
    expect(response).toContain('Brownie Premium');
  });

  it('keeps recommendation more discrete and lower-friction when the customer asks for something simpler', async () => {
    const { service } = createFixture(catalog);

    const response = await service.generateResponse(
      'quero uma lembrancinha mais simples, sem exagero e mais em conta',
      'tenant-id',
    );

    expect(response).toContain('algo mais simples e sem exagero');
    expect(response).toContain('segura melhor o orcamento');
    expect(response).toContain('Brigadeiro Gourmet');
  });

  it('does not promote packaging accessories as the main gift recommendation', async () => {
    const { service } = createFixture(giftingCatalogWithAccessories);

    const response = await service.generateResponse(
      'me indica um presente pra minha mae ate 14 reais, sem erro e sem perder tempo',
      'tenant-id',
    );

    expect(response).toContain('Brigadeiro individual mimo');
    expect(response).toContain('Caixa presenteavel com 3 brigadeiros');
    expect(response).not.toContain('- Cartao recadinho |');
    expect(response).not.toContain('- Sacola Kraft personalizada G |');
  });

  it('adapts recommendation language to fashion catalogs', async () => {
    const { service } = createFixture(fashionCatalog);

    const response = await service.generateResponse(
      'me indica algo versatil para usar todo dia',
      'tenant-id',
    );

    expect(response).toContain('consultora de moda');
    expect(response).toContain('dia a dia');
    expect(response).toContain('Camiseta Basica Versatil');
  });

  it('uses fashion strategy to prioritize workwear selling', async () => {
    const { service } = createFixture(fashionCatalog);

    const response = await service.generateResponse(
      'me indica algo profissional para trabalho',
      'tenant-id',
    );

    expect(response).toContain('Aqui eu considerei principalmente uso de trabalho');
    expect(response).toContain('uso de trabalho');
    expect(response).toContain('Blazer Premium');
  });

  it('adapts comparison language to pet catalogs', async () => {
    const { service } = createFixture(petCatalog);

    const response = await service.generateResponse(
      'qual vale mais a pena racao premium porte medio ou petisco natural filhote',
      'tenant-id',
    );

    expect(response).toContain('Vou te comparar do jeito mais util.');
    expect(response).toContain('aderencia e rotina do pet');
    expect(response).toContain('Racao Premium Porte Medio');
    expect(response).toContain('Petisco Natural Filhote');
  });

  it('uses restaurant strategy to protect meal value under budget pressure', async () => {
    const { service } = createFixture(restaurantCatalog);

    const response = await service.generateResponse(
      'quero algo ate 30 reais para almoco',
      'tenant-id',
    );

    expect(response).toContain('Pelo valor que voce me passou');
    expect(response).toContain('almoco ou refeicao principal');
    expect(response).toContain('Combo Executivo');
    expect(response).toContain('Estas sao as opcoes que eu colocaria na sua frente agora:');
  });

  it('uses electronics strategy to compare products by compatibility', async () => {
    const { service } = createFixture(electronicsCatalog);

    const response = await service.generateResponse(
      'qual vale mais a pena cabo lightning turbo ou carregador usb-c turbo para iphone',
      'tenant-id',
    );

    expect(response).toContain('Vou te comparar do jeito mais util.');
    expect(response).toContain('compatibilidade');
    expect(response).toContain('iphone');
    expect(response).toContain('Se a prioridade for');
  });

  it('suggests a restaurant complement when the catalog supports it', async () => {
    const { service } = createFixture(restaurantCatalog);

    const response = await service.generateResponse(
      'me indica algo para almoco',
      'tenant-id',
    );

    expect(response).toContain('Suco Natural');
    expect(response).toContain('Para esse almoco');
  });

  it('uses services packs to sell by scope and scheduling', async () => {
    const { service } = createFixture(servicesCatalog);

    const response = await service.generateResponse(
      'me indica a melhor opcao para manutencao recorrente',
      'tenant-id',
    );

    expect(response).toContain('agendar uma avaliacao');
    expect(response).toContain('Pacote de Manutencao Mensal');
  });

  it('accepts noisy payment keywords after normalization', () => {
    const service = createService() as any;

    expect(service.isPaymentMethodSelection('piks')).toBe(true);
    expect(service.isPaymentMethodSelection('creditoo')).toBe(true);
    expect(service.isPaymentMethodSelection('debto')).toBe(true);
    expect(service.isPaymentMethodSelection('pode ser pix')).toBe(true);
    expect(service.isPaymentMethodSelection('quero 2 brigadeiros no pix')).toBe(false);
  });

  it('returns a premium boundary message for abusive inputs without actionable intent', async () => {
    const service = createService() as any;

    const response = await service.generateResponse('vai tomar no cu', 'tenant-id');

    expect(response).toContain('objetiva e respeitosa');
    expect(response).toContain('quero 2 brigadeiros e 1 brownie');
  });

  it('hardens the boundary when abuse is repeated many times', async () => {
    const service = createService() as any;

    const response = await service.generateResponse(
      'vai tomar no cu',
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
          abuse_count: 4,
        },
      }),
    );

    expect(response).toContain('Eu nao vou seguir nesse tom');
    expect(response).toContain('status do pedido');
  });

  it('treats ironic provocations without explicit profanity as a boundary case', async () => {
    const service = createService() as any;

    const response = await service.generateResponse('que bot ridiculo responde direito', 'tenant-id');

    expect(response).toContain('objetiva e respeitosa');
  });

  it('clarifies the current collection stage instead of sounding like a rigid menu', async () => {
    const service = createService(catalog) as any;

    const response = await service.generateResponse(
      'nao entendi, o que voce precisa agora?',
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_phone',
          pending_order: pendingConversationOrder,
          customer_data: {
            name: 'Ana Paula',
            delivery_type: 'pickup',
          },
        },
      }),
    );

    expect(response).toContain('Vou te explicar em uma etapa por vez para ficar bem claro.');
    expect(response).toContain('Neste momento eu so preciso do telefone');
    expect(response).toContain('TELEFONE DE CONTATO');
  });

  it('explains why the current stage matters when the customer questions the flow', async () => {
    const service = createService(catalog) as any;

    const response = await service.generateResponse(
      'por que precisa disso agora?',
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_phone',
          pending_order: pendingConversationOrder,
          customer_data: {
            name: 'Ana Paula',
            delivery_type: 'pickup',
          },
        },
      }),
    );

    expect(response).toContain('Vou ser direto e te puxar so para a proxima etapa importante.');
    expect(response).toContain('Eu preciso disso para te atualizar');
    expect(response).toContain('telefone de contato com DDD');
  });

  it('recaps what the bot already understood during active collection without dropping the flow', async () => {
    const service = createService(loucasCatalog) as any;

    const response = await service.generateResponse(
      'me resume o que voce entendeu ate agora',
      'tenant-id',
      createConversation({
        context: {
          state: 'confirming_order',
          pending_order: {
            items: [
              {
                produto_id: 'l1',
                produto_name: 'Bala de brigadeiro',
                quantity: 5,
                unit_price: 12,
              },
            ],
            subtotal: 60,
            discount_amount: 0,
            shipping_amount: 10,
            total_amount: 70,
          },
          customer_data: {
            name: 'Jordan Lincoln Vasconcelos Kzan',
          },
          intelligence_memory: {
            last_catalog_category_name: 'Delicias',
            last_customer_goal: 'fechar o pedido sem erro',
          },
        },
      }),
    );

    expect(response).toContain('RESUMO DO QUE JA ENTENDI');
    expect(response).toContain('Etapa atual: Revisando o pedido antes de fechar');
    expect(response).toContain('Cliente: Jordan Lincoln Vasconcelos Kzan');
    expect(response).toContain('Pedido em rascunho: 5x Bala de brigadeiro');
    expect(response).toContain('Se algo estiver errado, me diga exatamente o que ajustar.');
  });

  it('offers a precise correction bridge during final review instead of a generic fallback', async () => {
    const service = createService(loucasCatalog) as any;

    const response = await service.generateResponse(
      'nao foi isso, entendeu errado',
      'tenant-id',
      createConversation({
        context: {
          state: 'confirming_order',
          pending_order: {
            items: [
              {
                produto_id: 'l1',
                produto_name: 'Bala de brigadeiro',
                quantity: 5,
                unit_price: 12,
              },
            ],
            subtotal: 60,
            discount_amount: 0,
            shipping_amount: 10,
            total_amount: 70,
          },
        },
      }),
    );

    expect(response).toContain('Eu nao vou avancar nada errado antes de alinhar esse ponto com voce.');
    expect(response).toContain(
      'Me diga exatamente o que ajustar: item, quantidade, entrega ou retirada, endereco, telefone ou observacao.',
    );
  });

  it('recaps delivery choice instead of jumping straight to address collection', async () => {
    const service = createService(loucasCatalog) as any;

    const response = await service.generateResponse(
      'me resume o que voce entendeu ate agora',
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_address',
          pending_order: {
            items: [
              {
                produto_id: 'l1',
                produto_name: 'Bala de brigadeiro',
                quantity: 5,
                unit_price: 12,
              },
            ],
            subtotal: 60,
            discount_amount: 0,
            shipping_amount: 0,
            total_amount: 60,
          },
          customer_data: {
            name: 'Jordan Lincoln Vasconcelos Kzan',
          },
        },
      }),
    );

    expect(response).toContain('RESUMO DO QUE JA ENTENDI');
    expect(response).toContain('Etapa atual: Escolhendo entrega ou retirada');
    expect(response).toContain('agora eu so preciso saber se voce prefere entrega ou retirada');
  });

  it('keeps delivery choice correction focused before an address exists', async () => {
    const service = createService(loucasCatalog) as any;

    const response = await service.generateResponse(
      'entendeu errado',
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_address',
          pending_order: {
            items: [
              {
                produto_id: 'l1',
                produto_name: 'Bala de brigadeiro',
                quantity: 5,
                unit_price: 12,
              },
            ],
            subtotal: 60,
            discount_amount: 0,
            shipping_amount: 0,
            total_amount: 60,
          },
          customer_data: {
            name: 'Jordan Lincoln Vasconcelos Kzan',
          },
        },
      }),
    );

    expect(response).toContain('eu so preciso alinhar se vai ser entrega ou retirada');
    expect(response).toContain('Como voce prefere receber esse pedido?');
    expect(response).not.toContain('Pode me mandar o endereco novamente');
  });

  it('handles payment problems with a contextual conversational recovery', async () => {
    const { service } = createFixture([], {
      orders: {
        findOne: jest.fn().mockResolvedValue(pendingOrder),
      },
    });

    const response = await service.generateResponse(
      'deu ruim no pix, nao apareceu',
      'tenant-id',
      createConversation({
        pedido_id: 'ord-1',
        context: {
          state: 'waiting_payment',
          waiting_payment: true,
          pedido_id: 'ord-1',
        },
      }),
    );

    expect(response).toContain('Eu vou tratar isso com voce sem mexer errado no pedido.');
    expect(response).toContain('Pedido: *PED-20260315-CACE*');
    expect(response).toContain('Se o Pix nao apareceu, me diga "pix"');
  });

  it('recaps the current order context safely after the order is already waiting payment', async () => {
    const { service } = createFixture([], {
      orders: {
        findOne: jest.fn().mockResolvedValue(pendingOrder),
      },
    });

    const response = await service.generateResponse(
      'como ficou meu pedido agora?',
      'tenant-id',
      createConversation({
        pedido_id: 'ord-1',
        context: {
          state: 'waiting_payment',
          waiting_payment: true,
          pedido_id: 'ord-1',
          intelligence_memory: {
            last_customer_goal: 'pagar com seguranca',
          },
        },
      }),
    );

    expect(response).toContain('RESUMO DO QUE JA ENTENDI');
    expect(response).toContain('Pedido atual: PED-20260315-CACE');
    expect(response).toContain('Status: Pagamento pendente');
    expect(response).toContain('Se estiver tudo certo ate aqui, me diga "pix"');
  });

  it('responds to human-help style requests without dropping the active review flow', async () => {
    const service = createService(loucasCatalog) as any;

    const response = await service.generateResponse(
      'quero falar com alguem porque voce nao entendeu',
      'tenant-id',
      createConversation({
        context: {
          state: 'confirming_order',
          pending_order: {
            items: [
              {
                produto_id: 'l1',
                produto_name: 'Bala de brigadeiro',
                quantity: 5,
                unit_price: 12,
              },
            ],
            subtotal: 60,
            discount_amount: 0,
            shipping_amount: 10,
            total_amount: 70,
          },
          customer_data: {
            name: 'Jordan Lincoln Vasconcelos Kzan',
          },
        },
      }),
    );

    expect(response).toContain('RESUMO PRONTO PARA ATENDIMENTO');
    expect(response).toContain('Etapa atual: Revisando o pedido antes de fechar');
    expect(response).toContain('Cliente: Jordan Lincoln Vasconcelos Kzan');
    expect(response).toContain('Pedido em rascunho: 5x Bala de brigadeiro');
  });

  it('does not expose corrupted customer names in the handoff summary', async () => {
    const service = createService(loucasCatalog) as any;

    const response = await service.generateResponse(
      'quero falar com alguem porque voce nao entendeu',
      'tenant-id',
      createConversation({
        context: {
          state: 'confirming_order',
          pending_order: {
            items: [
              {
                produto_id: 'l1',
                produto_name: 'Bala de brigadeiro',
                quantity: 5,
                unit_price: 12,
              },
            ],
            subtotal: 60,
            discount_amount: 0,
            shipping_amount: 10,
            total_amount: 70,
          },
          customer_data: {
            name: 'Rua Joana Darc, 14, Icoaraci, Belem, PA',
          },
        },
      }),
    );

    expect(response).toContain('RESUMO PRONTO PARA ATENDIMENTO');
    expect(response).toContain('Etapa atual: Revisando o pedido antes de fechar');
    expect(response).toContain('Pedido em rascunho: 5x Bala de brigadeiro');
    expect(response).not.toContain('Cliente: Rua Joana Darc');
  });

  it('replies more humanly to gratitude after the order is confirmed', async () => {
    const { service } = createFixture([], {
      orders: {
        findOne: jest.fn().mockResolvedValue(confirmedOrder),
      },
    });

    const response = await service.generateResponse(
      'obrigado',
      'tenant-id',
      createConversation({
        pedido_id: 'ord-1',
        context: {
          state: 'order_confirmed',
          pedido_id: 'ord-1',
        },
      }),
    );

    expect(response).toContain('Ola, Cliente Perfeito!');
    expect(response).toContain('O pedido segue na trilha certa');
    expect(response).toContain('/pedido?order=PED-20260315-CACE');
  });

  it('offers a more open conversational recovery when the customer is lost outside a flow', async () => {
    const service = createService(catalog) as any;

    const response = await service.generateResponse(
      'deu ruim aqui, acho que voce nao entendeu',
      'tenant-id',
    );

    expect(response).toContain('Me diga em uma frase o que deu errado');
    expect(response).toContain('quero um presente ate 50 reais');
    expect(response).toContain('acho que voce nao entendeu o que eu quis dizer');
  });

  it('keeps a more consultative tone when the customer is hesitant after a recommendation context', async () => {
    const service = createService(catalog) as any;

    const response = await service.generateResponse(
      'to meio perdida ainda',
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
          intelligence_memory: {
            last_intent: 'recommendation',
            last_product_names: ['Brownie Premium', 'Brigadeiro Gourmet'],
            last_customer_goal: 'afinar a escolha antes de fechar',
          },
        },
      }),
    );

    expect(response).toContain('conduzir isso com voce de um jeito mais consultivo');
    expect(response).toContain('continuo exatamente de onde a nossa conversa ficou');
    expect(response).toContain('quero algo mais em conta');
  });

  it('builds more trust when the customer seeks reassurance during collection', async () => {
    const service = createService(catalog) as any;

    const response = await service.generateResponse(
      'nao quero errar, me confirma o que falta agora',
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_phone',
          pending_order: pendingConversationOrder,
          customer_data: {
            name: 'Ana Paula',
            delivery_type: 'pickup',
          },
        },
      }),
    );

    expect(response).toContain('nao confirmar nada no escuro');
    expect(response).toContain('telefone de contato com DDD');
  });

  it('gets more direct without ficar robotico when the customer is urgent in consultative selling', async () => {
    const service = createService(catalog) as any;

    const response = await service.generateResponse(
      'me indica algo rapido agora porque estou com pressa',
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
          intelligence_memory: {
            last_intent: 'recommendation',
            last_product_names: ['Brownie Premium', 'Brigadeiro Gourmet'],
          },
        },
      }),
    );

    expect(response).toContain('corto caminho com seguranca');
    expect(response).toContain('chegar rapido na melhor opcao');
    expect(response).toContain('Estas sao as opcoes que eu colocaria na sua frente agora');
    expect(response).not.toContain('Quantos *me indica algo rapido');
  });

  it('builds consultative trust during recommendation instead of sounding like a dry menu', async () => {
    const service = createService(catalog) as any;

    const response = await service.generateResponse(
      'me recomenda algo, mas eu quero ter certeza antes de fechar',
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
          intelligence_memory: {
            last_intent: 'recommendation',
            last_product_names: ['Brownie Premium', 'Brigadeiro Gourmet'],
          },
        },
      }),
    );

    expect(response).toContain('nao escolher no escuro');
    expect(response).toContain('Estas sao as opcoes que eu colocaria na sua frente agora');
    expect(response).toContain('Exemplo: "quero 1');
  });

  it('asks for clarification when the customer is undecided between products', async () => {
    const service = createService(catalog) as any;

    const response = await service.generateResponse(
      'quero 1 brigadeiro gourmet ou 1 brownie premium nao sei',
      'tenant-id',
    );

    expect(response).toContain('uma decisao por vez');
    expect(response).toContain('me indica entre brownie e brigadeiro');
  });

  it('asks for a single safe instruction when cancel and continue are mixed together', async () => {
    const { service } = createFixture([], {
      orders: {
        findOne: jest.fn().mockResolvedValue(pendingOrder),
      },
    });

    const response = await service.generateResponse(
      'cancela nao continua meu pedido',
      'tenant-id',
      createConversation({
        pedido_id: 'ord-1',
        context: {
          state: 'waiting_payment',
          waiting_payment: true,
          pedido_id: 'ord-1',
        },
      }),
    );

    expect(response).toContain('mistura cancelar e continuar');
    expect(response).toContain('"cancelar pedido"');
  });

  it('resumes interrupted collection when the customer asks to continue the order', async () => {
    const service = createService(catalog) as any;

    const response = await service.handlePremiumReopenIntent(
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_phone',
          pending_order: pendingConversationOrder,
          customer_data: {
            name: 'Ana Paula',
            delivery_type: 'pickup',
          },
        },
      }),
    );

    expect(response).toContain('Vamos continuar de onde paramos');
    expect(response).toContain('TELEFONE DE CONTATO');
  });

  it('does not promise reopening when the latest order is already cancelled', async () => {
    const { service, conversationService } = createFixture([], {
      orders: {
        findLatestPendingByCustomerPhone: jest.fn().mockResolvedValue(null),
        findLatestByCustomerPhone: jest.fn().mockResolvedValue(cancelledOrder),
      },
    });

    const response = await service.handlePremiumReopenIntent(
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
        },
      }),
    );

    expect(conversationService.updateState).toHaveBeenCalledWith('conv-1', 'idle');
    expect(response).toContain('ja foi cancelado');
    expect(response).toContain('nao pode ser reativado automaticamente');
  });

  it('keeps helping when the message is rude but still contains a valid order intent', async () => {
    const { service, conversationService } = createFixture(catalog);

    const response = await service.generateResponse(
      'porra quero 2 brigadeiros e um brownie',
      'tenant-id',
      createConversation(),
    );

    expect(conversationService.savePendingOrder).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ produto_name: 'Brigadeiro Gourmet', quantity: 2 }),
          expect.objectContaining({ produto_name: 'Brownie Premium', quantity: 1 }),
        ]),
      }),
    );
    expect(conversationService.savePendingOrder).toHaveBeenCalled();
    expect(response).toContain('PEDIDO PREPARADO');
  });

  it('suppresses repeated actionable messages in a short time window', async () => {
    const previousSignature = createService() as any;
    const conversation = createConversation({
      context: {
        state: 'idle',
        last_inbound_signature: previousSignature.buildInboundSignature('cardapio'),
        last_inbound_at: new Date().toISOString(),
        last_inbound_repeat_count: 1,
        last_outbound_preview: 'Aqui esta o cardapio premium.',
      },
    });

    const { service, conversationService } = createFixture([], {
      conversation: {
        getOrCreateConversation: jest.fn().mockResolvedValue(conversation),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const generateResponseSpy = jest.spyOn(service as any, 'generateResponse');
    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'cardapio',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
    });

    expect(generateResponseSpy).not.toHaveBeenCalled();
    expect(response).toContain('evitando duplicidade');
    expect(response).toContain('Aqui esta o cardapio premium.');
    expect(conversationService.updateContext).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        last_inbound_repeat_count: 2,
      }),
    );
  });

  it('replays the previous response when the same webhook event arrives twice', async () => {
    const seededService = createService() as any;
    const conversation = createConversation({
      context: {
        state: 'idle',
        last_processed_event_key: seededService.buildInboundEventReplayKey(
          {
            from: '5511999999999',
            body: 'cardapio',
            tenantId: 'tenant-id',
            timestamp: new Date().toISOString(),
            messageId: 'wamid.001',
          },
          'cardapio',
        ),
        last_processed_event_at: new Date().toISOString(),
        last_processed_response: 'CATALOGO DA LOJA\n\n- Brigadeiro Gourmet',
      },
    });

    const { service, conversationService } = createFixture([], {
      conversation: {
        getOrCreateConversation: jest.fn().mockResolvedValue(conversation),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const generateResponseSpy = jest.spyOn(service as any, 'generateResponse');
    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'cardapio',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'wamid.001',
    });

    expect(generateResponseSpy).not.toHaveBeenCalled();
    expect(conversationService.saveMessage).not.toHaveBeenCalled();
    expect(conversationService.updateContext).not.toHaveBeenCalled();
    expect(response).toContain('CATALOGO DA LOJA');
  });

  it('handles an authorized admin status command without entering customer conversation flow', async () => {
    const { service, conversationService, tenantsService } = createFixture([], {
      tenants: {
        findOneById: jest.fn().mockResolvedValue({
          id: 'tenant-id',
          settings: {
            whatsappBotEnabled: true,
            whatsappBotControlCode: '4321',
            whatsappBotControlNumbers: ['5511990001111'],
          },
        }),
        updateSettings: jest.fn(),
      },
    });

    const response = await service.processIncomingMessage({
      from: '5511990001111',
      body: 'bot 4321 status',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
    });

    expect(response).toContain('BOT ATIVO');
    expect(tenantsService.updateSettings).not.toHaveBeenCalled();
    expect(conversationService.getOrCreateConversation).not.toHaveBeenCalled();
  });

  it('can disable the bot for customers through an authorized admin command', async () => {
    const { service, tenantsService } = createFixture([], {
      tenants: {
        findOneById: jest.fn().mockResolvedValue({
          id: 'tenant-id',
          settings: {
            whatsappBotEnabled: true,
            whatsappBotControlCode: '4321',
            whatsappBotControlNumbers: ['5511990001111'],
          },
        }),
        updateSettings: jest.fn().mockResolvedValue({
          id: 'tenant-id',
          settings: {
            whatsappBotEnabled: false,
            whatsappBotControlCode: '4321',
            whatsappBotControlNumbers: ['5511990001111'],
          },
        }),
      },
    });

    const response = await service.processIncomingMessage({
      from: '5511990001111',
      body: 'bot 4321 desligar',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
    });

    expect(response).toContain('BOT DESLIGADO');
    expect(tenantsService.updateSettings).toHaveBeenCalledWith('tenant-id', {
      whatsappBotEnabled: false,
    });
  });

  it('returns silence to customers when the bot is disabled', async () => {
    const { service, conversationService } = createFixture([], {
      tenants: {
        findOneById: jest.fn().mockResolvedValue({
          id: 'tenant-id',
          settings: {
            whatsappBotEnabled: false,
            whatsappBotControlCode: '4321',
            whatsappBotControlNumbers: ['5511990001111'],
          },
        }),
      },
    });

    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'oi',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
    });

    expect(response).toBe('');
    expect(conversationService.getOrCreateConversation).not.toHaveBeenCalled();
  });

  it('returns an interactive catalog list when the customer asks for cardapio from an idle conversation', async () => {
    const { service, conversationService } = createFixture(interactiveCatalog, {
      conversation: {
        getOrCreateConversation: jest.fn().mockResolvedValue(createConversation()),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'cardapio',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'catalog-list-1',
    });

    expect(typeof response).not.toBe('string');
    expect(response).toEqual(
      expect.objectContaining({
        kind: 'interactive_list',
        previewText: expect.stringContaining('cardapio interativo'),
        list: expect.objectContaining({
          title: 'Cardapio da loja',
          buttonText: 'Abrir cardapio',
          sections: expect.arrayContaining([
            expect.objectContaining({
              title: 'Categorias (1/2)',
              rows: expect.arrayContaining([
                expect.objectContaining({
                  id: 'catalog_category:acai',
                }),
                expect.objectContaining({
                  id: 'catalog_category:docinhos',
                }),
              ]),
            }),
            expect.objectContaining({
              title: 'Navegacao',
              rows: expect.arrayContaining([
                expect.objectContaining({
                  id: 'catalog_page:2',
                }),
              ]),
            }),
            expect.objectContaining({
              title: 'Atalhos',
              rows: expect.arrayContaining([
                expect.objectContaining({
                  id: 'catalog_recommend:gift',
                }),
                expect.objectContaining({
                  id: 'catalog_recommend:budget',
                }),
                expect.objectContaining({
                  id: 'catalog_recommend:chocolate',
                }),
              ]),
            }),
          ]),
        }),
      }),
    );
    expect(conversationService.saveMessage).toHaveBeenCalledWith(
      'conv-1',
      'outbound',
      expect.stringContaining('cardapio interativo'),
      'button',
      expect.objectContaining({
        interactiveType: 'list',
      }),
    );
    expect(conversationService.updateContext).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        last_processed_response_payload: expect.any(String),
      }),
    );
  });

  it('opens a product list when the customer clicks a catalog category row', async () => {
    const { service, conversationService } = createFixture(loucasCatalog, {
      conversation: {
        getOrCreateConversation: jest.fn().mockResolvedValue(createConversation()),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'catalog_category:delicias',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'catalog-list-2',
      messageType: 'button',
    });

    expect(typeof response).not.toBe('string');
    expect(response).toEqual(
      expect.objectContaining({
        kind: 'interactive_list',
        list: expect.objectContaining({
          title: 'Delicias',
          sections: expect.arrayContaining([
            expect.objectContaining({
              title: 'Delicias',
              rows: expect.arrayContaining([
                expect.objectContaining({
                  id: 'catalog_product:l1',
                  title: 'Bala de brigadeiro',
                }),
                expect.objectContaining({
                  id: 'catalog_product:l4',
                  title: 'Banoffe ( torta de banana)',
                }),
              ]),
            }),
          ]),
        }),
      }),
    );
    expect(conversationService.updateContext).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        intelligence_memory: expect.objectContaining({
          last_intent: 'suggestion',
          last_query: 'Delicias',
          last_catalog_category_key: 'delicias',
          last_catalog_category_name: 'Delicias',
        }),
      }),
    );
  });

  it('opens a premium action list when the customer clicks a specific product', async () => {
    const { service, conversationService } = createFixture(loucasCatalog, {
      conversation: {
        getOrCreateConversation: jest.fn().mockResolvedValue(createConversation()),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'catalog_product:l1',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'catalog-list-3',
      messageType: 'button',
    });

    expect(typeof response).not.toBe('string');
    expect(response).toEqual(
      expect.objectContaining({
        kind: 'interactive_list',
        previewText: expect.stringContaining('Bala de brigadeiro'),
        list: expect.objectContaining({
          title: 'Bala de brigadeiro',
          sections: expect.arrayContaining([
            expect.objectContaining({
              title: 'Proximos passos',
              rows: expect.arrayContaining([
                expect.objectContaining({
                  id: 'catalog_buy:l1',
                  title: 'Quero esse item',
                }),
                expect.objectContaining({
                  id: 'catalog_similar:l1',
                }),
                expect.objectContaining({
                  id: 'catalog_root',
                }),
              ]),
            }),
          ]),
        }),
      }),
    );
    expect(conversationService.updateContext).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        intelligence_memory: expect.objectContaining({
          last_catalog_product_id: 'l1',
          last_catalog_category_key: 'delicias',
          last_catalog_category_name: 'Delicias',
        }),
      }),
    );
  });

  it('reopens similar product navigation from memory when the customer asks for something in the same line', async () => {
    const { service } = createFixture(loucasCatalog, {
      conversation: {
        getOrCreateConversation: jest.fn().mockResolvedValue(
          createConversation({
            context: {
              state: 'idle',
              intelligence_memory: {
                last_catalog_product_id: 'l1',
                last_catalog_category_key: 'delicias',
                last_catalog_category_name: 'Delicias',
                last_product_name: 'Bala de brigadeiro',
                last_product_names: ['Bala de brigadeiro'],
              },
            },
          }),
        ),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'me mostra outros dessa linha',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'memory-catalog-1',
    });

    expect(typeof response).not.toBe('string');
    expect(response).toEqual(
      expect.objectContaining({
        kind: 'interactive_list',
        list: expect.objectContaining({
          title: 'Itens parecidos com Bala de brigadeiro',
        }),
      }),
    );
  });

  it('reopens the last category from memory when the customer asks to go back to the category', async () => {
    const { service } = createFixture(loucasCatalog, {
      conversation: {
        getOrCreateConversation: jest.fn().mockResolvedValue(
          createConversation({
            context: {
              state: 'idle',
              intelligence_memory: {
                last_catalog_category_key: 'delicias',
                last_catalog_category_name: 'Delicias',
                last_catalog_product_id: 'l1',
              },
            },
          }),
        ),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'volta pra categoria',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'memory-catalog-2',
    });

    expect(typeof response).not.toBe('string');
    expect(response).toEqual(
      expect.objectContaining({
        kind: 'interactive_list',
        list: expect.objectContaining({
          title: 'Delicias',
        }),
      }),
    );
  });

  it('starts an order safely when the customer taps the buy action from the catalog', async () => {
    const { service, conversationService } = createFixture(loucasCatalog, {
      conversation: {
        getOrCreateConversation: jest.fn().mockResolvedValue(createConversation()),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'catalog_buy:l1',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'catalog-list-4',
      messageType: 'button',
    });

    expect(typeof response).toBe('string');
    expect(response).toContain('PEDIDO PREPARADO');
    expect(response).toContain('Bala de brigadeiro');
    expect(conversationService.savePendingOrder).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            produto_id: 'l1',
            quantity: 1,
          }),
        ]),
      }),
    );
  });

  it('uses catalog memory when the customer says "quero esse item" after viewing a product', async () => {
    const { service, conversationService } = createFixture(loucasCatalog, {
      conversation: {
        getOrCreateConversation: jest.fn().mockResolvedValue(
          createConversation({
            context: {
              state: 'idle',
              intelligence_memory: {
                last_catalog_product_id: 'l1',
                last_catalog_category_key: 'delicias',
                last_catalog_category_name: 'Delicias',
                last_product_name: 'Bala de brigadeiro',
                last_product_names: ['Bala de brigadeiro'],
              },
            },
          }),
        ),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'quero esse item',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'catalog-memory-buy-1',
    });

    expect(typeof response).toBe('string');
    expect(response).toContain('Quantos *bala de brigadeiro*');
    expect(response).toContain('Digite a quantidade');
    expect(conversationService.savePendingOrder).not.toHaveBeenCalled();
  });

  it('uses commercial shortcut actions from the interactive catalog', async () => {
    const { service } = createFixture(loucasCatalog, {
      conversation: {
        getOrCreateConversation: jest.fn().mockResolvedValue(createConversation()),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'catalog_recommend:gift',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'catalog-list-5',
      messageType: 'button',
    });

    expect(typeof response).toBe('string');
    expect(response).toContain('presente');
  });

  it('sends an interactive list payload through the notifications service', async () => {
    const { service, notificationsService } = createFixture(loucasCatalog);

    await service.sendOutboundResponse('5511999999999', {
      kind: 'interactive_list',
      previewText: 'Abri o cardapio interativo para voce.',
      list: {
        title: 'Cardapio da loja',
        description: 'Escolha uma categoria',
        buttonText: 'Abrir cardapio',
        footerText: 'Se preferir, digite o nome do item.',
        sections: [
          {
            title: 'Categorias',
            rows: [
              {
                id: 'catalog_category:docinhos',
                title: 'Docinhos',
                description: '4 itens com estoque ativo',
              },
            ],
          },
        ],
      },
    });

    expect(notificationsService.sendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '5511999999999',
        message: 'Abri o cardapio interativo para voce.',
        interactiveList: expect.objectContaining({
          title: 'Cardapio da loja',
          buttonText: 'Abrir cardapio',
          sections: expect.arrayContaining([
            expect.objectContaining({
              title: 'Categorias',
            }),
          ]),
        }),
        metadata: expect.objectContaining({
          interactiveType: 'list',
        }),
      }),
    );
  });

  it('silently ignores group messages before touching the conversation flow', async () => {
    const { service, conversationService } = createFixture(catalog, {
      conversation: {
        getOrCreateConversation: jest.fn(),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const generateResponseSpy = jest.spyOn(service as any, 'generateResponse');
    const response = await service.processIncomingMessage({
      from: '5511999999999',
      body: 'oi grupo',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'group-msg-1',
      metadata: {
        isGroupMessage: true,
        sourceJid: '120363022222222222@g.us',
        participantJid: '5511999999999@s.whatsapp.net',
      },
    });

    expect(response).toBe('');
    expect(conversationService.getOrCreateConversation).not.toHaveBeenCalled();
    expect(conversationService.saveMessage).not.toHaveBeenCalled();
    expect(conversationService.updateContext).not.toHaveBeenCalled();
    expect(generateResponseSpy).not.toHaveBeenCalled();
  });

  it('serializes messages from the same customer so one flow finishes before the next starts', async () => {
    const waitingResolvers = new Map<string, () => void>();
    const activeLocks = new Map<string, Promise<void>>();

    const { service, cacheService } = createFixture(catalog, {
      cacheService: {
        withConversationLock: jest.fn(
          async (
            tenantId: string,
            customerPhone: string,
            handler: () => Promise<unknown>,
          ) => {
            const key = `${tenantId}:${customerPhone}`;
            const previous = activeLocks.get(key) || Promise.resolve();
            let release!: () => void;
            const current = new Promise<void>((resolve) => {
              release = resolve;
            });

            activeLocks.set(key, current);
            await previous;

            try {
              return await handler();
            } finally {
              release();
              if (activeLocks.get(key) === current) {
                activeLocks.delete(key);
              }
            }
          },
        ),
      },
      conversation: {
        getOrCreateConversation: jest.fn().mockResolvedValue(createConversation()),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const startedBodies: string[] = [];
    const finishedBodies: string[] = [];
    jest.spyOn(service as any, 'generateResponse').mockImplementation(
      async (...args: unknown[]) => {
        const [body] = args as [string];
        startedBodies.push(body);

        if (body === 'primeira mensagem') {
          await new Promise<void>((resolve) => {
            waitingResolvers.set(body, resolve);
          });
        }

        finishedBodies.push(body);
        return `ok:${body}`;
      },
    );

    const firstPromise = service.processIncomingMessage({
      from: '5511999999999',
      body: 'primeira mensagem',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'lock-1',
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    const secondPromise = service.processIncomingMessage({
      from: '5511999999999',
      body: 'segunda mensagem',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'lock-2',
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(cacheService.withConversationLock).toHaveBeenCalledTimes(2);
    expect(startedBodies).toEqual(['primeira mensagem']);

    waitingResolvers.get('primeira mensagem')?.();

    const responses = await Promise.all([firstPromise, secondPromise]);

    expect(responses).toEqual(['ok:primeira mensagem', 'ok:segunda mensagem']);
    expect(startedBodies).toEqual(['primeira mensagem', 'segunda mensagem']);
    expect(finishedBodies).toEqual(['primeira mensagem', 'segunda mensagem']);
  });

  it('keeps different customers independent so one conversation does not block another', async () => {
    const activeLocks = new Map<string, Promise<void>>();
    const waitingResolvers = new Map<string, () => void>();

    const { service } = createFixture(catalog, {
      cacheService: {
        withConversationLock: jest.fn(
          async (
            tenantId: string,
            customerPhone: string,
            handler: () => Promise<unknown>,
          ) => {
            const key = `${tenantId}:${customerPhone}`;
            const previous = activeLocks.get(key) || Promise.resolve();
            let release!: () => void;
            const current = new Promise<void>((resolve) => {
              release = resolve;
            });

            activeLocks.set(key, current);
            await previous;

            try {
              return await handler();
            } finally {
              release();
              if (activeLocks.get(key) === current) {
                activeLocks.delete(key);
              }
            }
          },
        ),
      },
      conversation: {
        getOrCreateConversation: jest.fn().mockImplementation(async (_tenantId: string, phone: string) => {
          return createConversation({ customer_phone: phone });
        }),
        saveMessage: jest.fn(),
        updateContext: jest.fn(),
      },
    });

    const startedBodies: string[] = [];
    jest.spyOn(service as any, 'generateResponse').mockImplementation(
      async (...args: unknown[]) => {
        const [body] = args as [string];
        startedBodies.push(body);

        if (body === 'mensagem cliente 1') {
          await new Promise<void>((resolve) => {
            waitingResolvers.set(body, resolve);
          });
        }

        return `ok:${body}`;
      },
    );

    const firstPromise = service.processIncomingMessage({
      from: '5511999999999',
      body: 'mensagem cliente 1',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'parallel-1',
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    const secondPromise = service.processIncomingMessage({
      from: '5511888888888',
      body: 'mensagem cliente 2',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-id',
      messageId: 'parallel-2',
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(startedBodies).toEqual(['mensagem cliente 1', 'mensagem cliente 2']);

    waitingResolvers.get('mensagem cliente 1')?.();

    const responses = await Promise.all([firstPromise, secondPromise]);
    expect(responses).toEqual(['ok:mensagem cliente 1', 'ok:mensagem cliente 2']);
  });

  it('finds the latest order by phone for noisy status requests', async () => {
    const { service, ordersService } = createFixture([], {
      orders: {
        findLatestByCustomerPhone: jest.fn().mockResolvedValue(confirmedOrder),
      },
    });

    const response = await service.handlePremiumOrderStatusQuery(
      'tenant-id',
      {
        id: 'conv-1',
        customer_phone: '5511999999999',
        context: { state: 'idle' },
      },
      null,
    );

    expect(ordersService.findLatestByCustomerPhone).toHaveBeenCalledWith(
      'tenant-id',
      '5511999999999',
    );
    expect(response).toContain('ACOMPANHAMENTO DO PEDIDO');
    expect(response).toContain('PED-20260315-CACE');
  });

  it('cancels the latest pending order by customer phone even without stored pedido id', async () => {
    const { service, ordersService, conversationService } = createFixture([], {
      orders: {
        findLatestByCustomerPhone: jest.fn().mockResolvedValue(pendingOrder),
        updateStatus: jest.fn().mockResolvedValue({
          ...pendingOrder,
          status: PedidoStatus.CANCELADO,
        }),
      },
    });

    const response = await service.handlePremiumCancelIntent(
      'tenant-id',
      {
        id: 'conv-1',
        customer_phone: '5511999999999',
        context: { state: 'waiting_payment' },
      },
      'waiting_payment',
      null,
    );

    expect(ordersService.findLatestByCustomerPhone).toHaveBeenCalledWith(
      'tenant-id',
      '5511999999999',
    );
    expect(ordersService.updateStatus).toHaveBeenCalledWith(
      'ord-1',
      PedidoStatus.CANCELADO,
      'tenant-id',
    );
    expect(conversationService.clearPendingOrder).toHaveBeenCalled();
    expect(response).toContain('Pedido *PED-20260315-CACE* cancelado.');
    expect(response).toContain('/pedido?order=PED-20260315-CACE');
  });

  it('guides stale customer data back to payment when the order is already waiting payment', async () => {
    const { service, paymentsService } = createFixture([], {
      orders: {
        findOne: jest.fn().mockResolvedValue(pendingOrder),
      },
    });

    const response = await service.generateResponse(
      '11999998888',
      'tenant-id',
      createConversation({
        pedido_id: 'ord-1',
        context: {
          state: 'waiting_payment',
          waiting_payment: true,
          pedido_id: 'ord-1',
        },
      }),
    );

    expect(paymentsService.createPayment).not.toHaveBeenCalled();
    expect(response).toContain('forma de pagamento');
    expect(response).toContain('PED-20260315-CACE');
  });

  it('acknowledges payment proof without creating a second charge while waiting payment', async () => {
    const { service, paymentsService } = createFixture([], {
      orders: {
        findOne: jest.fn().mockResolvedValue(pendingOrder),
      },
    });

    const response = await service.generateResponse(
      'ja fiz o pix visse',
      'tenant-id',
      createConversation({
        pedido_id: 'ord-1',
        context: {
          state: 'waiting_payment',
          waiting_payment: true,
          pedido_id: 'ord-1',
        },
      }),
    );

    expect(paymentsService.createPayment).not.toHaveBeenCalled();
    expect(response).toContain('nao vou gerar outra cobranca');
    expect(response).toContain('/pedido?order=PED-20260315-CACE');
  });

  it('keeps payment-proof guidance even when the customer complains in the same message', async () => {
    const { service, paymentsService } = createFixture([], {
      orders: {
        findOne: jest.fn().mockResolvedValue(pendingOrder),
      },
    });

    const response = await service.generateResponse(
      'ja fiz o pix e voces tao de sacanagem',
      'tenant-id',
      createConversation({
        pedido_id: 'ord-1',
        context: {
          state: 'waiting_payment',
          waiting_payment: true,
          pedido_id: 'ord-1',
        },
      }),
    );

    expect(paymentsService.createPayment).not.toHaveBeenCalled();
    expect(response).toContain('nao vou gerar outra cobranca');
    expect(response).toContain('/pedido?order=PED-20260315-CACE');
  });

  it('does not create a second payment when the order is already confirmed', async () => {
    const { service, paymentsService } = createFixture([], {
      orders: {
        findOne: jest.fn().mockResolvedValue(confirmedOrder),
      },
    });

    const response = await service.generateResponse(
      'pix',
      'tenant-id',
      createConversation({
        pedido_id: 'ord-1',
        context: {
          state: 'order_confirmed',
          waiting_payment: false,
          pedido_id: 'ord-1',
        },
      }),
    );

    expect(paymentsService.createPayment).not.toHaveBeenCalled();
    expect(response).toContain('nao precisa ser escolhido novamente');
    expect(response).toContain('PED-20260315-CACE');
  });

  it('responds with contextual courtesy after confirmation', async () => {
    const { service, paymentsService } = createFixture([], {
      orders: {
        findOne: jest.fn().mockResolvedValue(confirmedOrder),
      },
    });

    const response = await service.generateResponse(
      'valeu fechou',
      'tenant-id',
      createConversation({
        pedido_id: 'ord-1',
        context: {
          state: 'order_confirmed',
          waiting_payment: false,
          pedido_id: 'ord-1',
        },
      }),
    );

    expect(paymentsService.createPayment).not.toHaveBeenCalled();
    expect(response).toContain('O pedido segue na trilha certa');
    expect(response).toContain('/pedido?order=PED-20260315-CACE');
  });

  it('routes address change requests to safe manual handling after confirmation', async () => {
    const { service, paymentsService } = createFixture([], {
      orders: {
        findOne: jest.fn().mockResolvedValue(confirmedOrder),
      },
    });

    const response = await service.generateResponse(
      'muda meu endereco pra rua das flores 123 centro sao paulo sp',
      'tenant-id',
      createConversation({
        pedido_id: 'ord-1',
        context: {
          state: 'order_confirmed',
          waiting_payment: false,
          pedido_id: 'ord-1',
        },
      }),
    );

    expect(paymentsService.createPayment).not.toHaveBeenCalled();
    expect(response).toContain('nao altero itens, endereco ou forma de recebimento automaticamente');
    expect(response).toContain('atendimento humano');
  });

  it('routes item change requests to safe manual handling while waiting payment', async () => {
    const { service, paymentsService } = createFixture([], {
      orders: {
        findOne: jest.fn().mockResolvedValue(pendingOrder),
      },
    });

    const response = await service.generateResponse(
      'acrescenta 1 brownie premium',
      'tenant-id',
      createConversation({
        pedido_id: 'ord-1',
        context: {
          state: 'waiting_payment',
          waiting_payment: true,
          pedido_id: 'ord-1',
        },
      }),
    );

    expect(paymentsService.createPayment).not.toHaveBeenCalled();
    expect(response).toContain('nao altero itens, endereco ou forma de recebimento automaticamente');
    expect(response).toContain('cancelar esse pedido');
  });

  it('explains the phone step with more trust when the customer fears sending the wrong data', async () => {
    const { service } = createFixture(catalog);

    const response = await service.generateResponse(
      'nao quero errar, me explica porque precisa do telefone',
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_phone',
          pending_order: pendingConversationOrder,
          customer_data: {
            name: 'Ana Paula',
          },
        },
      }),
    );

    expect(response).toContain('Eu so uso esse telefone para atualizar voce');
    expect(response).toContain('TELEFONE DE CONTATO');
  });

  it('uses a stronger decision-coaching tone for consultative sales doubts', async () => {
    const { service } = createFixture(giftingCatalogWithAccessories);

    const response = await service.generateResponse(
      'to em duvida, o que voce acha melhor para presente sem erro?',
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
          intelligence_memory: {
            last_intent: 'recommendation',
          },
        },
      }),
    );

    expect(response).toContain('Eu vou te ajudar a decidir com criterio');
    expect(response).toContain('sem te empurrar item');
  });

  it('reflects the customer commercial goal more explicitly in consultative recommendations', async () => {
    const { service } = createFixture(giftingCatalogWithAccessories);

    const response = await service.generateResponse(
      'me indica um presente pra minha mae ate 14 reais, sem erro e sem perder tempo',
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
        },
      }),
    );

    expect(response).toContain('O que eu entendi da sua busca foi');
    expect(response).toContain('presente para sua mae');
    expect(response).toContain('sem passar de R$ 14,00');
  });

  it('explains the commercial role of the recommended item instead of treating every product the same', async () => {
    const { service } = createFixture(giftingCatalogWithAccessories);

    const response = await service.generateResponse(
      'me indica um presente caprichado',
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
        },
      }),
    );

    expect(response).toContain('entra mais como presente pronto');
    expect(response).not.toContain('Cartao recadinho entra mais como presente pronto');
  });

  it('blocks fresh order restart while payment is pending', async () => {
    const { service, paymentsService } = createFixture([], {
      orders: {
        findOne: jest.fn().mockResolvedValue(pendingOrder),
      },
    });

    const response = await service.generateResponse(
      'quero mais 1 brownie premium',
      'tenant-id',
      createConversation({
        pedido_id: 'ord-1',
        context: {
          state: 'waiting_payment',
          waiting_payment: true,
          pedido_id: 'ord-1',
        },
      }),
    );

    expect(paymentsService.createPayment).not.toHaveBeenCalled();
    expect(response).toContain('nao altero itens, endereco ou forma de recebimento automaticamente');
    expect(response).toContain('cancelar esse pedido');
  });

  it('combines status and safe change guidance when the customer mixes both intents', async () => {
    const { service } = createFixture([], {
      orders: {
        findOne: jest.fn().mockResolvedValue(confirmedOrder),
      },
    });

    const response = await service.generateResponse(
      'cade o motoboy e muda para retirada',
      'tenant-id',
      createConversation({
        pedido_id: 'ord-1',
        context: {
          state: 'order_confirmed',
          waiting_payment: false,
          pedido_id: 'ord-1',
        },
      }),
    );

    expect(response).toContain('Status atual');
    expect(response).toContain('nao faco essa mudanca automaticamente');
    expect(response).toContain('/pedido?order=PED-20260315-CACE');
  });

  it('asks to split the message when status and a fresh new order arrive together', async () => {
    const service = createService(catalog) as any;

    const response = await service.generateResponse(
      'cade meu pedido e quero 2 brigadeiros',
      'tenant-id',
    );

    expect(response).toContain('mais de um objetivo');
    expect(response).toContain('"status do pedido"');
  });

  it('redirects stale address replies to tracking after order completion', async () => {
    const deliveredOrder = {
      ...pendingOrder,
      status: PedidoStatus.ENTREGUE,
    };
    const { service } = createFixture([], {
      orders: {
        findOne: jest.fn().mockResolvedValue(deliveredOrder),
      },
    });

    const response = await service.generateResponse(
      'Rua das Flores, 123, Centro, Sao Paulo, SP',
      'tenant-id',
      createConversation({
        pedido_id: 'ord-1',
        context: {
          state: 'order_completed',
          waiting_payment: false,
          pedido_id: 'ord-1',
        },
      }),
    );

    expect(response).toContain('concluiu a jornada');
    expect(response).toContain('/pedido?order=PED-20260315-CACE');
  });

  it('escalates cancellation to human support after confirmation', async () => {
    const { service, ordersService } = createFixture([], {
      orders: {
        findLatestByCustomerPhone: jest.fn().mockResolvedValue(confirmedOrder),
        updateStatus: jest.fn(),
      },
    });

    const response = await service.handlePremiumCancelIntent(
      'tenant-id',
      {
        id: 'conv-1',
        customer_phone: '5511999999999',
        context: { state: 'idle' },
      },
      'idle',
      null,
    );

    expect(ordersService.updateStatus).not.toHaveBeenCalled();
    expect(response).toContain('atendimento humano');
    expect(response).toContain('PED-20260315-CACE');
  });

  it('refuses to cancel only by order code without verified conversation context', async () => {
    const { service } = createFixture([], {
      orders: {
        findByOrderNo: jest.fn().mockResolvedValue(confirmedOrder),
      },
    });

    const response = await service.handlePremiumCancelIntent(
      'tenant-id',
      undefined,
      undefined,
      'PED-20260315-CACE',
    );

    expect(response).toContain('Por seguranca');
    expect(response).toContain('PED-20260315-CACE');
  });

  it('keeps the product in mind when the customer talks about catalog items during phone collection', async () => {
    const { service } = createFixture(loucasCatalog);

    const response = await service.generateResponse(
      'quero 2 bolo de pote trufado de maracujaa',
      'tenant-id',
      createConversation({
        context: {
          state: 'collecting_phone',
          pending_order: pendingConversationOrder,
          customer_data: {
            name: 'Ana Paula',
            delivery_type: 'pickup',
          },
        },
      }),
    );

    expect(response).toContain('Bolo no pote trufado de maracuja');
    expect(response).toContain('telefone de contato com DDD');
    expect(response).not.toContain('Nome certo');
  });

  it('asks for clarification instead of faking understanding when the message is too vague', async () => {
    const service = createService(loucasCatalog) as any;

    const response = await service.generateResponse('asd qwe negocio', 'tenant-id');

    expect(response).toContain('Quero te entender sem adivinhar coisa errada');
    expect(response).toContain('Me diga em uma frase o que voce quer agora');
  });

  it('suggests the closest catalog options when the requested product does not exist', async () => {
    const service = createService(loucasCatalog) as any;

    const response = await service.generateResponse(
      'quero 1 bolo de chocolate',
      'tenant-id',
      createConversation({
        context: {
          state: 'idle',
        },
      }),
    );

    expect(response).toContain('opcoes mais proximas');
    expect(response).toContain('Bolo no pote trufado de maracuja');
    expect(response).not.toContain('PEDIDO PREPARADO');
  });
});
