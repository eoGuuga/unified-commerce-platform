import { PedidoStatus } from '../../database/entities/Pedido.entity';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappService defensive WhatsApp flow', () => {
  const catalog = [
    {
      id: 'p1',
      name: 'Brigadeiro Gourmet',
      price: 10.5,
      available_stock: 10,
      created_at: '2026-03-15T00:00:00.000Z',
      categoria: { name: 'Doces' },
    },
    {
      id: 'p2',
      name: 'Brownie Premium',
      price: 15,
      available_stock: 8,
      created_at: '2026-03-15T00:00:00.000Z',
      categoria: { name: 'Doces' },
    },
    {
      id: 'p3',
      name: 'Bolo de Cenoura',
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

  const createFixture = (
    products: Array<Record<string, unknown>> = [],
    overrides?: {
      config?: Record<string, unknown>;
      conversation?: Record<string, jest.Mock>;
      orders?: Record<string, jest.Mock>;
      payments?: Record<string, jest.Mock>;
      productsService?: Record<string, jest.Mock>;
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

    const service = new WhatsappService(
      config as any,
      openAIService as any,
      conversationService as any,
      productsService as any,
      ordersService as any,
      paymentsService as any,
      {
        validateCoupon: jest.fn(),
      } as any,
      {
        sendOrderCreatedNotification: jest.fn(),
      } as any,
    );

    return {
      service: service as any,
      config,
      conversationService,
      ordersService,
      paymentsService,
      productsService,
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
});
