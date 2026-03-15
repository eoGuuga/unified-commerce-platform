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
    expect(service.isOrderIntent('nao vou querer mais')).toBe(false);
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
});
