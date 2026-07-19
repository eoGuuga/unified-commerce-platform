import { WhatsappService } from './whatsapp.service';
import { ActionExecutorService } from './services/action-executor.service';

/**
 * Fatia 4 — start_checkout: o handoff do loop de IA pra FSM de ferro (Decisão 3).
 *
 * Molde Tipo A (rotear pra handler pronto): a IA só SINALIZA "fechar o pedido";
 * `handleCheckout` (que JÁ existe) valida o carrinho, arma `checkout.stage` e a
 * precedência do detectIntent sequestra os turnos seguintes pra FSM. Resposta
 * DETERMINÍSTICA (zero narração de IA no handoff — decisão do dono). O gate da
 * Fatia 3 NÃO se aplica: fechar pedido tem confirmação PRÓPRIA e mais forte
 * (invariante D2 — provada em whatsapp.service.checkout-d2.spec.ts).
 *
 * O teste de roteamento usa o ActionExecutorService REAL — prova os DOIS fios
 * (executor passthrough + case do routeBusinessAction) num fluxo de porta da
 * frente. Sem os fios, o executor real cai no default→clarify e morre.
 */
function buildService(overrides: Record<string, unknown> = {}): any {
  const service: any = new (WhatsappService as any)(...new Array(40).fill(undefined));
  Object.assign(service, overrides);
  return service;
}

const PHONE = '5511999998888';
const NEUTRAL_MSG = 'me conta uma novidade ai';

function driveWithRealExecutor(overrides: Record<string, unknown> = {}): any {
  return buildService({
    isProductIntent: () => false,
    productsService: { search: jest.fn().mockResolvedValue([]) },
    cartService: { addItem: jest.fn() },
    botConfigService: { loadConfig: jest.fn().mockResolvedValue({}) },
    llmRouterService: {
      route: jest.fn().mockResolvedValue({ action: 'start_checkout', params: {}, confidence: 0.9 }),
    },
    // EXECUTOR REAL — o passthrough é parte do que está sob teste.
    actionExecutorService: new ActionExecutorService(undefined as any),
    conversationService: { updateContext: jest.fn().mockResolvedValue(undefined) },
    ...overrides,
  });
}

const conv = (): any => ({
  id: 'c1',
  customer_phone: PHONE,
  customer_name: 'Ana',
  context: { state: 'idle' },
});

describe('WhatsappService — Fatia 4: start_checkout roteia pro handleCheckout (Tipo A)', () => {
  it('🎯 router decide start_checkout → executor REAL passa → handleCheckout(t, phone, conv) é chamado', async () => {
    const service = driveWithRealExecutor();
    service.handleCheckout = jest.fn().mockResolvedValue('CHECKOUT_INICIADO');
    const c = conv();

    const res = await service.handleFallback('t1', NEUTRAL_MSG, c);

    expect(service.handleCheckout).toHaveBeenCalledWith('t1', PHONE, c);
    expect(res).toBe('CHECKOUT_INICIADO');
  });

  it('🎯 carrinho VAZIO pela rota nova → guard honesto, FSM NÃO armada', async () => {
    const updateContext = jest.fn().mockResolvedValue(undefined);
    const service = driveWithRealExecutor({
      cartService: {
        addItem: jest.fn(),
        getOrCreateCart: jest.fn().mockResolvedValue({ items: [] }), // vazio
      },
      conversationService: { updateContext },
    });
    const c = conv();

    const res = await service.handleFallback('t1', NEUTRAL_MSG, c);

    expect(String(res)).toContain('carrinho está vazio');
    expect(updateContext).not.toHaveBeenCalled(); // checkout.stage NÃO foi armado
  });

  it('a resposta do handoff é a string DETERMINÍSTICA da FSM (nenhuma narração de IA)', async () => {
    const runToolStep = jest.fn(); // se a IA narrasse, isto seria chamado
    const service = driveWithRealExecutor({
      cartService: {
        addItem: jest.fn(),
        getOrCreateCart: jest.fn().mockResolvedValue({
          items: [{ produto_id: 'p1', quantity: 1, unit_price: 5 }],
        }),
      },
      openAIService: { runToolStep },
    });
    const c = conv();

    const res = await service.handleFallback('t1', NEUTRAL_MSG, c);

    expect(String(res)).toContain('Vamos finalizar seu pedido');
    expect(String(res)).toContain('entrega');
    expect(runToolStep).not.toHaveBeenCalled(); // zero loop de narração no handoff
    // E a FSM foi armada de verdade (o sequestro dos próximos turnos):
    expect(c.context.checkout?.stage).toBe('ask_fulfillment');
  });
});

describe('WhatsappService — Fatia 4: não-reentrância (o sequestro de turnos funciona)', () => {
  it('🎯 checkout ATIVO → detectIntent="collection" e a IA (router) NUNCA é chamada no turno', async () => {
    const route = jest.fn();
    const service = buildService({
      llmRouterService: { route },
      catalogManager: { isCatalogCommand: () => false },
      conversationService: { updateContext: jest.fn().mockResolvedValue(undefined) },
    });
    service.getBusinessHours = jest.fn().mockResolvedValue({ open: '09:00', close: '18:00' });
    const c = conv();
    c.context.checkout = { stage: 'ask_fulfillment', customer_phone: PHONE };

    // Porta da frente: o roteador de intents decide...
    const intent = service.detectIntent('quero mais um brigadeiro', c);
    expect(intent).toBe('collection'); // a FSM é dona do turno (:497-500)

    // ...e o turno inteiro vai pra coleta — resposta determinística, IA intocada.
    const res = await service.processByIntent(intent, {
      message: { tenantId: 't1', from: PHONE, body: 'quero mais um brigadeiro', type: 'text' },
      processed: { sanitizedBody: 'quero mais um brigadeiro', normalizedBody: 'quero mais um brigadeiro' },
      conversation: c,
      tenant: { id: 't1' },
    });

    expect(route).not.toHaveBeenCalled(); // a IA nunca viu o turno
    expect(String(res).length).toBeGreaterThan(0); // a FSM respondeu (re-prompt determinístico)
  });
});

describe('WhatsappService — Fatia 4: precedência com pending_cart_add ativo', () => {
  it('🎯 pending ativo + fala de fechar ("é isso, pode fechar") → o GATE ganha; a IA nunca é consultada', async () => {
    const route = jest.fn();
    const addItem = jest.fn().mockResolvedValue({});
    const updateContext = jest.fn().mockResolvedValue(undefined);
    const service = buildService({
      llmRouterService: { route },
      cartService: { addItem },
      conversationService: { updateContext },
      catalogManager: { isCatalogCommand: () => false },
    });
    const c = conv();
    c.context.pending_cart_add = {
      produto_id: 'p1', produto_name: 'Brigadeiro Gourmet',
      quantity: 2, unit_price: 5, proposed_at: new Date().toISOString(),
    };

    const intent = service.detectIntent('é isso, pode fechar', c);
    expect(intent).toBe('pending_cart_add'); // o gate da Fatia 3 vence (:508-514)

    const res = await service.handlePendingCartAdd('t1', 'é isso, pode fechar', c);

    // COMPORTAMENTO MAPEADO (pro Arquiteto julgar): "isso"/"pode" casam o
    // afirmativo do gate → a proposta pendente é CONFIRMADA e executada.
    // Leitura: o bot acabou de perguntar "confirma 2x?"; uma resposta
    // afirmativa-de-fechamento pertence à pergunta feita — o cliente ainda
    // dirá "finalizar" (ou a IA start_checkout) no turno seguinte.
    expect(route).not.toHaveBeenCalled();
    expect(addItem).toHaveBeenCalledTimes(1);
    expect(String(res)).toContain('✅ Adicionado 2x Brigadeiro Gourmet');
  });
});
