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
  it('🎯 show_catalog → handleShowCatalogViaLoop (loop Fatia 2/Mov A) e retorna a resposta dele', async () => {
    const service = driveFallback('show_catalog');
    // Fatia 2: show_catalog agora vai pelo LOOP (narração + cinturão de N preços),
    // não mais direto pro handleCatalog (que virou o determinístico do loop).
    service.handleShowCatalogViaLoop = jest.fn().mockResolvedValue('CATALOGO_AQUI');

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(service.handleShowCatalogViaLoop).toHaveBeenCalledWith('t1', NEUTRAL_MSG);
    expect(res).toBe('CATALOGO_AQUI');
  });

  it('🎯 check_order_status → handleOrderStatusViaLoop (loop Fatia 2/Mov B, status determinístico)', async () => {
    const service = driveFallback('check_order_status');
    // Fatia 2/Mov B: agora vai pelo LOOP (frase-fato code-owned + IA embrulha).
    service.handleOrderStatusViaLoop = jest.fn().mockResolvedValue('STATUS_DO_PEDIDO');

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(service.handleOrderStatusViaLoop).toHaveBeenCalledWith(
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

  // Fatia 3 (Passo 2): process_order NÃO escreve mais direto — ele PROPÕE
  // (persiste pending_cart_add) e a escrita só acontece no turno seguinte, pelo
  // handlePendingCartAdd (o único executor). A falha de estoque no addItem
  // migrou pro momento da confirmação (coberta em pending-cart-add.spec).
  it('🎯 process_order com {product, quantity} → PROPÕE (pending com o produto REAL) e addItem = 0 neste turno', async () => {
    const addItem = jest.fn().mockResolvedValue({});
    const updateContext = jest.fn().mockResolvedValue(undefined);
    const service = driveFallback('process_order', {
      params: { product: 'brigadeiro', quantity: 2 },
      search: [PROD],
      cart: { addItem },
    });
    service.conversationService = { updateContext };
    const conv: any = { id: 'c1', customer_phone: '5511999998888', context: { state: 'idle' } };

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conv);

    expect(addItem).not.toHaveBeenCalled(); // a escrita NÃO acontece neste turno
    expect(updateContext).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        pending_cart_add: expect.objectContaining({
          produto_id: 'p1',
          produto_name: 'Brigadeiro Gourmet',
          quantity: 2,
          unit_price: 5,
        }),
      }),
    );
    expect(String(res)).toContain('2x Brigadeiro Gourmet');
    expect(String(res).toLowerCase()).toContain('confirm');
  });

  it('process_order sem quantity → propõe o default inteiro ≥1 (1x)', async () => {
    const updateContext = jest.fn().mockResolvedValue(undefined);
    const service = driveFallback('process_order', {
      params: { product: 'brigadeiro' },
      search: [PROD],
    });
    service.conversationService = { updateContext };
    const conv: any = { id: 'c1', customer_phone: '5511999998888', context: { state: 'idle' } };

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conv);

    expect(updateContext.mock.calls[0][1].pending_cart_add.quantity).toBe(1);
    expect(String(res)).toContain('1x');
  });

  it('🎯 PONTA-A-PONTA (2 turnos): propõe (addItem=0) → "sim" → addItem=1 com os params PERSISTIDOS → "✅"', async () => {
    const addItem = jest.fn().mockResolvedValue({});
    const updateContext = jest.fn().mockResolvedValue(undefined);
    const service = driveFallback('process_order', {
      params: { product: 'brigadeiro', quantity: 2 },
      search: [PROD],
      cart: { addItem },
    });
    service.conversationService = { updateContext };
    const conv: any = { id: 'c1', customer_phone: '5511999998888', context: { state: 'idle' } };

    // Turno 1: a IA entendeu "quero 2 brigadeiros" (params do router) → PROPÕE.
    const res1 = await service.handleFallback('t1', NEUTRAL_MSG, conv);
    expect(addItem).not.toHaveBeenCalled();
    expect(String(res1).toLowerCase()).toContain('confirm');

    // Turno 2 entra pela porta da frente do roteamento: o gate detecta o pending...
    expect(service.detectIntent('sim', conv)).toBe('pending_cart_add');

    // ...e o executor único escreve com os params PERSISTIDOS.
    const res2 = await service.handlePendingCartAdd('t1', 'sim', conv);
    expect(addItem).toHaveBeenCalledTimes(1);
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
    expect(String(res2)).toContain('✅ Adicionado 2x Brigadeiro Gourmet');
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
  // Peça 3: cancel_order agora CANCELA de verdade — mas só o pedido do PRÓPRIO
  // cliente (ownership por construção via findLatestByCustomerPhone, escopado por
  // telefone) e só quando PENDENTE. Dupla-trava: a query + updateStatus(actor:customer).
  it('🎯 cancel_order: pedido PENDENTE próprio → cancela (actor customer; estoque volta pelo updateStatus)', async () => {
    const updateStatus = jest.fn().mockResolvedValue({});
    const findLatestByCustomerPhone = jest.fn().mockResolvedValue({
      id: 'ped-1',
      order_no: 'PED-1234',
      status: 'pendente_pagamento',
    });
    const service = driveFallback('cancel_order');
    service.ordersService = { findLatestByCustomerPhone, updateStatus };

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    // resolve pelo telefone DO CLIENTE (ownership por construção)
    expect(findLatestByCustomerPhone).toHaveBeenCalledWith('t1', '5511999998888');
    // cancela com actor 'customer' (a Peça 1 valida PENDENTE→CANCELADO)
    expect(updateStatus).toHaveBeenCalledWith('ped-1', 'cancelado', 't1', { actor: 'customer' });
    expect(String(res).toLowerCase()).toContain('cancelei');
  });

  it('🎯 cancel_order (OWNERSHIP): pedido de OUTRO telefone não aparece na query → admite, NÃO cancela', async () => {
    const updateStatus = jest.fn();
    // A query é escopada pelo telefone do cliente → o pedido de outro NUNCA retorna.
    const findLatestByCustomerPhone = jest.fn().mockResolvedValue(null);
    const service = driveFallback('cancel_order');
    service.ordersService = { findLatestByCustomerPhone, updateStatus };

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(findLatestByCustomerPhone).toHaveBeenCalledWith('t1', '5511999998888');
    expect(updateStatus).not.toHaveBeenCalled(); // ownership: não toca pedido de ninguém
    expect(String(res).toLowerCase()).toMatch(/não achei|cardápio|ver produtos/);
  });

  it('🎯 cancel_order: pedido PAGO/em andamento → escala pra loja, NÃO cancela', async () => {
    const updateStatus = jest.fn();
    const findLatestByCustomerPhone = jest.fn().mockResolvedValue({
      id: 'ped-2',
      order_no: 'PED-5678',
      status: 'confirmado',
    });
    const service = driveFallback('cancel_order');
    service.ordersService = { findLatestByCustomerPhone, updateStatus };

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(findLatestByCustomerPhone).toHaveBeenCalled(); // olhou o pedido (RED: hoje não olha)
    expect(updateStatus).not.toHaveBeenCalled(); // NÃO cancela pago
    expect(String(res).toLowerCase()).toMatch(/loja|andamento|confirm/);
  });

  it('cancel_order: nenhum pedido ativo → admite (§5), não cancela', async () => {
    const updateStatus = jest.fn();
    const findLatestByCustomerPhone = jest.fn().mockResolvedValue(null);
    const service = driveFallback('cancel_order');
    service.ordersService = { findLatestByCustomerPhone, updateStatus };

    const res = await service.handleFallback('t1', NEUTRAL_MSG, conversation);

    expect(updateStatus).not.toHaveBeenCalled();
    expect(String(res).length).toBeGreaterThan(0);
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
