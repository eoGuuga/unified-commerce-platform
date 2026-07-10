import { WhatsappService } from './whatsapp.service';

/**
 * Fase 2 — roteamento `stateTransition` → handler real. **Tipo A** (as 3 ações
 * que roteiam pra um handler já pronto: show_catalog / check_order_status /
 * select_payment).
 *
 * Esta é a PRIMEIRA cobertura do caminho action-executor→orquestrador. Hoje as
 * 8 ações de negócio retornam `{response:'', stateTransition}` e o
 * `handleFallback` só usa `.response` → o cliente é ghosteado (resposta vazia).
 * O RED→GREEN aqui documenta o comportamento que não existia: prova que HOJE a
 * ação retorna vazio, e depois que ela retorna a resposta do handler real.
 *
 * Instanciação: mesmo padrão do `whatsapp-outbound.spec` / `ia-prereqs.spec` —
 * service com deps undefined + Object.assign só do que o caminho usa.
 */
function buildService(overrides: Record<string, unknown> = {}): any {
  const service: any = new (WhatsappService as any)(...new Array(40).fill(undefined));
  Object.assign(service, overrides);
  return service;
}

/**
 * Dirige `handleFallback` pela porta da frente ATÉ o caminho do LLM:
 * - mensagem neutra (sem keyword de preço/disponib./compra/produto) + `search→[]`
 *   + `isProductIntent→false` garantem que os blocos de keyword upstream FALHAM
 *   e a mensagem chega no router;
 * - o router mockado devolve `action`; o executor mockado devolve o
 *   `{response:'', stateTransition:action}` — que é o comportamento REAL de hoje
 *   das 8 ações de negócio.
 */
function driveFallback(
  action: string,
  opts: { params?: Record<string, any>; search?: any[]; cart?: any } = {},
): any {
  return buildService({
    isProductIntent: () => false,
    productsService: { search: jest.fn().mockResolvedValue(opts.search ?? []) },
    cartService: opts.cart ?? { addItem: jest.fn().mockResolvedValue({}) },
    botConfigService: { loadConfig: jest.fn().mockResolvedValue({}) },
    llmRouterService: {
      route: jest.fn().mockResolvedValue({ action, params: opts.params ?? {}, confidence: 0.9 }),
    },
    actionExecutorService: {
      execute: jest.fn().mockResolvedValue({ response: '', stateTransition: action }),
    },
  });
}

const NEUTRAL_MSG = 'me conta uma novidade ai';
const conversation: any = {
  id: 'c1',
  customer_phone: '5511999998888',
  customer_name: 'Ana',
  context: { state: 'idle' },
};

describe('WhatsappService — Fase 2 Tipo A: roteia stateTransition → handler pronto', () => {
  it('🎯 show_catalog → handleCatalog(tenantId, message) e retorna a resposta dele', async () => {
    const service = driveFallback('show_catalog');
    service.handleCatalog = jest.fn().mockResolvedValue('CATALOGO_AQUI');

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(service.handleCatalog).toHaveBeenCalledWith('t1', NEUTRAL_MSG);
    expect(res).toBe('CATALOGO_AQUI');
  });

  it('🎯 check_order_status → handleOrderStatus(tenantId, phone, message, conversation)', async () => {
    const service = driveFallback('check_order_status');
    service.handleOrderStatus = jest.fn().mockResolvedValue('STATUS_DO_PEDIDO');

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(service.handleOrderStatus).toHaveBeenCalledWith(
      't1',
      '5511999998888',
      NEUTRAL_MSG,
      conversation,
    );
    expect(res).toBe('STATUS_DO_PEDIDO');
  });

  it('🎯 select_payment → handlePayment(tenantId, phone, message, conversation) [STUB: PIX fake, mas roteia certo]', async () => {
    const service = driveFallback('select_payment');
    service.handlePayment = jest.fn().mockResolvedValue('OPCOES_DE_PAGAMENTO');

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(service.handlePayment).toHaveBeenCalledWith(
      't1',
      '5511999998888',
      NEUTRAL_MSG,
      conversation,
    );
    expect(res).toBe('OPCOES_DE_PAGAMENTO');
  });

  it('🎯 default: stateTransition desconhecido (fora das 8) NÃO vira silêncio — cai no fallback amigável', async () => {
    const service = driveFallback('acao_desconhecida_xyz');
    // Nenhum handler do Tipo A pode ser chamado por uma ação de outro tipo.
    service.handleCatalog = jest.fn();
    service.handleOrderStatus = jest.fn();
    service.handlePayment = jest.fn();

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(String(res)).toContain('Não entendi');
    expect(String(res).length).toBeGreaterThan(0);
    expect(service.handleCatalog).not.toHaveBeenCalled();
    expect(service.handleOrderStatus).not.toHaveBeenCalled();
    expect(service.handlePayment).not.toHaveBeenCalled();
  });
});

const PROD = { id: 'p1', name: 'Brigadeiro Gourmet', price: 5, description: 'Delícia' };

describe('WhatsappService — Fase 2 Tipo B: helper param-first (§5 centralizado)', () => {
  it('🎯 check_price com params.product válido → preço REAL do banco (nunca a IA origina número)', async () => {
    const service = driveFallback('check_price', { params: { product: 'brigadeiro' }, search: [PROD] });

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(service.productsService.search).toHaveBeenCalledWith('t1', 'brigadeiro');
    expect(res).toContain('Brigadeiro Gourmet');
    expect(res).toContain('R$ 5.00'); // vem de product.price, não inventado
  });

  it('🎯 check_stock com produto encontrado → disponível SEM revelar quantidade (paridade B1)', async () => {
    const service = driveFallback('check_stock', { params: { product: 'brigadeiro' }, search: [PROD] });

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(res).toContain('Brigadeiro Gourmet');
    // B1: confirma que temos, NÃO expõe contagem de estoque.
    expect(String(res)).not.toMatch(/\d+\s*(unidades?|em estoque|dispon[ií]ve[li]s?\s*:?\s*\d)/i);
  });

  it('🎯 process_order com {product, quantity} → cartService.addItem com o produto resolvido', async () => {
    const addItem = jest.fn().mockResolvedValue({});
    const service = driveFallback('process_order', {
      params: { product: 'brigadeiro', quantity: 2 },
      search: [PROD],
      cart: { addItem },
    });

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        customerPhone: '5511999998888',
        produtoId: 'p1',
        produtoName: 'Brigadeiro Gourmet',
        quantity: 2,
        unitPrice: 5,
      }),
    );
    expect(String(res).length).toBeGreaterThan(0);
  });

  it('process_order sem quantity → default inteiro ≥1 (adiciona 1)', async () => {
    const addItem = jest.fn().mockResolvedValue({});
    const service = driveFallback('process_order', {
      params: { product: 'brigadeiro' },
      search: [PROD],
      cart: { addItem },
    });

    await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(addItem).toHaveBeenCalledWith(expect.objectContaining({ quantity: 1 }));
  });

  it('process_order com estoque insuficiente (addItem lança) → amigável, sem crash, sem vazar número', async () => {
    const addItem = jest
      .fn()
      .mockRejectedValue(new Error('Estoque insuficiente: disponível 1, solicitado 5'));
    const service = driveFallback('process_order', {
      params: { product: 'brigadeiro', quantity: 5 },
      search: [PROD],
      cart: { addItem },
    });

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(String(res).length).toBeGreaterThan(0);
    expect(res).toContain('Brigadeiro Gourmet');
    expect(String(res)).not.toContain('Estoque insuficiente'); // não vaza a exceção/número
  });

  // O TESTE DO §5 — o mais importante: produto que NÃO existe → ADMITE, não inventa.
  describe.each(['check_price', 'check_stock', 'process_order'])(
    '🎯 §5: "%s" com params.product inexistente ADMITE (não inventa preço/estoque/pedido)',
    (action) => {
      it('admite honesto, não chama addItem, não emite R$', async () => {
        const addItem = jest.fn();
        const service = driveFallback(action, {
          params: { product: 'produto-que-nao-existe' },
          search: [], // banco não acha
          cart: { addItem },
        });

        const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

        expect(String(res).toLowerCase()).toContain('não achei'); // admissão explícita
        expect(res).not.toContain('R$'); // §5: não inventa preço
        expect(addItem).not.toHaveBeenCalled(); // §5: não cria pedido
      });
    },
  );

  it('🎯 §5: params.product ausente (LLM não extraiu) → mesma admissão, sem nem buscar', async () => {
    const service = driveFallback('check_price', { params: {}, search: [] });

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(service.productsService.search).not.toHaveBeenCalled(); // §5: sem produto, nem busca
    expect(String(res).toLowerCase()).toContain('de qual produto');
    expect(res).not.toContain('R$');
  });
});

describe('WhatsappService — Fase 2 Tipo C: escala honesta (cancel_order / collect_info)', () => {
  it('🎯 cancel_order → escala pedindo o número e NÃO cancela (não abre o furo de ownership do updateStatus)', async () => {
    const updateStatus = jest.fn();
    const service = driveFallback('cancel_order');
    // updateStatus disponível — o teste garante que MESMO ASSIM não é chamado.
    service.ordersService = { updateStatus };

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(String(res).toLowerCase()).toContain('número'); // pede o número do pedido
    expect(updateStatus).not.toHaveBeenCalled(); // SEGURANÇA: não cancela nada aqui
  });

  // Caracterização (NÃO RED→GREEN): collect_info já caía no fallback via `default`;
  // o `case` explícito é documentação. O teste guarda "nunca silêncio" pra ela.
  it('collect_info (morto de fábrica) → cai no fallback amigável, não quebra nem silencia', async () => {
    const service = driveFallback('collect_info');

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(String(res)).toContain('Não entendi');
    expect(String(res).length).toBeGreaterThan(0);
  });
});
