import { WhatsappService } from './whatsapp.service';

/**
 * Fatia 3 / Passo 1 — o GATE de confirmação de escrita no carrinho.
 *
 * Princípio: a IA/keyword PROPÕE (persiste `pending_cart_add`, não escreve);
 * o `handlePendingCartAdd` é o ÚNICO executor de `cartService.addItem`, e só
 * escreve com os params PERSISTIDOS após o "sim" do cliente. Correção com
 * número re-propõe (nova confirmação); negativo limpa; ambíguo pede clareza.
 * O pending EXPIRA (TTL próprio — o timeout de conversa não cobre state 'idle',
 * então sem TTL um "sim" de horas depois ressuscitaria a escrita).
 *
 * Aqui provamos o gate isolado, determinístico, sem IA. (Passo 2 religou o
 * process_order do caminho da IA a este gate — ver stateTransition-routing.spec;
 * keyword/botão religam no Passo 3.)
 */
function buildService(overrides: Record<string, unknown> = {}): any {
  const service: any = new (WhatsappService as any)(...new Array(40).fill(undefined));
  Object.assign(service, overrides);
  return service;
}

const PROD = { id: 'p1', name: 'Brigadeiro Gourmet', price: 5 };

const freshPending = (over: Record<string, unknown> = {}) => ({
  produto_id: 'p1',
  produto_name: 'Brigadeiro Gourmet',
  quantity: 2,
  unit_price: 5,
  proposed_at: new Date().toISOString(),
  ...over,
});

function harness(pending: Record<string, unknown> | null) {
  const updateContext = jest.fn().mockResolvedValue(undefined);
  const addItem = jest.fn().mockResolvedValue({ id: 'cart1' });
  const service = buildService({
    conversationService: { updateContext },
    cartService: { addItem },
    // detectIntent sem pending segue o fluxo normal e consulta o catálogo.
    catalogManager: { isCatalogCommand: () => false },
  });
  const conversation: any = {
    id: 'c1',
    customer_phone: '5511999998888',
    context: { state: 'idle', pending_cart_add: pending },
  };
  return { service, conversation, updateContext, addItem };
}

describe('WhatsappService — Fatia 3 Passo 1: proposeCartAdd (persiste, NÃO escreve)', () => {
  it('🎯 TESTE-CHAVE 1: propõe → persiste pending → addItem = 0 calls neste turno', async () => {
    const { service, conversation, updateContext, addItem } = harness(null);

    const res = await service.proposeCartAdd(conversation, PROD, 2);

    expect(addItem).not.toHaveBeenCalled(); // NADA foi escrito
    expect(updateContext).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        pending_cart_add: expect.objectContaining({
          produto_id: 'p1',
          produto_name: 'Brigadeiro Gourmet',
          quantity: 2,
          unit_price: 5,
          proposed_at: expect.any(String),
        }),
      }),
    );
    expect(String(res)).toContain('2x Brigadeiro Gourmet');
    expect(String(res)).toContain('10.00'); // total REAL (2×5), computado pelo código
    expect(String(res).toLowerCase()).toContain('confirm');
  });

  it('quantity inválida (H6): fração/negativo/lixo → propõe 1', async () => {
    const { service, conversation, updateContext } = harness(null);
    await service.proposeCartAdd(conversation, PROD, 2.5);
    await service.proposeCartAdd(conversation, PROD, -1);
    await service.proposeCartAdd(conversation, PROD, 'abc');
    for (const call of updateContext.mock.calls) {
      expect(call[1].pending_cart_add.quantity).toBe(1);
    }
  });

  it('preço decimal-string do TypeORM ("12.90") vira número no pending', async () => {
    const { service, conversation, updateContext } = harness(null);
    await service.proposeCartAdd(conversation, { id: 'p2', name: 'Bolo de Pote', price: '12.90' }, 1);
    expect(updateContext.mock.calls[0][1].pending_cart_add.unit_price).toBe(12.9);
  });
});

describe('WhatsappService — Fatia 3 Passo 1: handlePendingCartAdd (o ÚNICO executor)', () => {
  it('🎯 TESTE-CHAVE 2: "sim" → addItem = 1 call com os params PERSISTIDOS + limpa o pending', async () => {
    const { service, conversation, updateContext, addItem } = harness(freshPending());

    const res = await service.handlePendingCartAdd('t1', 'sim', conversation);

    expect(addItem).toHaveBeenCalledTimes(1);
    expect(addItem).toHaveBeenCalledWith({
      tenantId: 't1',
      customerPhone: '5511999998888',
      produtoId: 'p1',
      produtoName: 'Brigadeiro Gourmet',
      quantity: 2,
      unitPrice: 5,
    });
    expect(updateContext).toHaveBeenCalledWith('c1', { pending_cart_add: null });
    expect(String(res)).toContain('✅ Adicionado 2x Brigadeiro Gourmet');
  });

  it('🎯 TESTE-CHAVE 3: sem pending persistido → "sim" solto → addItem = 0 ("nada pra confirmar")', async () => {
    const { service, conversation, addItem } = harness(null);
    const res = await service.handlePendingCartAdd('t1', 'sim', conversation);
    expect(addItem).not.toHaveBeenCalled();
    expect(String(res).toLowerCase()).toContain('pendente');
  });

  it('🎯 TESTE-CHAVE 4: propõe 2 → "não, 3" → RE-PROPÕE (não escreve) → "sim" → addItem com qty 3 (nunca 2)', async () => {
    // Turno 1: correção "não, 3" → re-propõe com 3, nada escrito.
    const t1 = harness(freshPending({ quantity: 2 }));
    const res1 = await t1.service.handlePendingCartAdd('t1', 'não, 3', t1.conversation);
    expect(t1.addItem).not.toHaveBeenCalled();
    const rePersisted = t1.updateContext.mock.calls[0][1].pending_cart_add;
    expect(rePersisted.quantity).toBe(3);
    expect(rePersisted.produto_id).toBe('p1'); // produto/preço NUNCA reinterpretados
    expect(rePersisted.unit_price).toBe(5);
    expect(String(res1)).toContain('3x Brigadeiro Gourmet');

    // Turno 2: "sim" sobre o pending re-proposto → escreve 3, nunca 2.
    const t2 = harness(rePersisted);
    await t2.service.handlePendingCartAdd('t1', 'sim', t2.conversation);
    expect(t2.addItem).toHaveBeenCalledTimes(1);
    expect(t2.addItem.mock.calls[0][0].quantity).toBe(3);
  });

  it('negativo ("não") → limpa sem escrever', async () => {
    const { service, conversation, updateContext, addItem } = harness(freshPending());
    const res = await service.handlePendingCartAdd('t1', 'não', conversation);
    expect(addItem).not.toHaveBeenCalled();
    expect(updateContext).toHaveBeenCalledWith('c1', { pending_cart_add: null });
    expect(String(res).toLowerCase()).toContain('não adicionei');
  });

  it('"não confirmo" cancela (negativo checado ANTES do afirmativo — fail-closed)', async () => {
    const { service, conversation, addItem } = harness(freshPending());
    await service.handlePendingCartAdd('t1', 'não confirmo', conversation);
    expect(addItem).not.toHaveBeenCalled();
  });

  it('ambíguo ("e o bolo?") → pede sim/não, NÃO escreve e NÃO limpa (pending mantido)', async () => {
    const { service, conversation, updateContext, addItem } = harness(freshPending());
    const res = await service.handlePendingCartAdd('t1', 'e o bolo?', conversation);
    expect(addItem).not.toHaveBeenCalled();
    expect(updateContext).not.toHaveBeenCalled();
    expect(String(res).toLowerCase()).toContain('sim');
  });

  it('🎯 TIMEOUT: pending EXPIRADO (>5min) → limpa SEM escrever (o "sim" tardio não ressuscita)', async () => {
    const stale = freshPending({
      proposed_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min atrás
    });
    const { service, conversation, updateContext, addItem } = harness(stale);
    const res = await service.handlePendingCartAdd('t1', 'sim', conversation);
    expect(addItem).not.toHaveBeenCalled();
    expect(updateContext).toHaveBeenCalledWith('c1', { pending_cart_add: null });
    expect(String(res).toLowerCase()).toContain('expirou');
  });

  it('addItem lança (estoque/carrinho cheio) → resposta honesta SEM vazar contagem + limpa', async () => {
    const { service, conversation, updateContext } = harness(freshPending());
    service.cartService.addItem = jest
      .fn()
      .mockRejectedValue(new Error('Estoque insuficiente. Disponível: 1'));
    const res = await service.handlePendingCartAdd('t1', 'sim', conversation);
    expect(String(res)).not.toContain('Disponível: 1'); // paridade B1
    expect(updateContext).toHaveBeenCalledWith('c1', { pending_cart_add: null });
  });
});

describe('WhatsappService — Fatia 3 Passo 3: os 4 call sites keyword/botão propõem (UMA porta)', () => {
  const PROD_ENTITY = { id: 'p1', name: 'Brigadeiro Gourmet', price: 5 };

  function keywordHarness(searchImpl: (q: string) => any[]) {
    const updateContext = jest.fn().mockResolvedValue(undefined);
    const addItem = jest.fn().mockResolvedValue({ id: 'cart1' });
    const service = buildService({
      conversationService: { updateContext },
      cartService: { addItem },
      productsService: {
        search: jest.fn().mockImplementation((_t: string, q: string) =>
          Promise.resolve(searchImpl(q)),
        ),
      },
      catalogManager: { isCatalogCommand: () => false },
    });
    const conversation: any = {
      id: 'c1',
      customer_phone: '5511999998888',
      context: { state: 'idle' },
    };
    return { service, conversation, updateContext, addItem };
  }

  it('🎯 CONSISTÊNCIA (a UX una): a frase LITERAL "quero 2 brigadeiros" → PROPÕE 2x → "sim" → escreve 2', async () => {
    // O buy-block procura "2 brigadeiros" (não acha); o scan-block acha
    // "brigadeiro" — e agora PROPÕE (antes escrevia direto, qty 1 fixa,
    // IGNORANDO o "2" do cliente).
    const { service, conversation, updateContext, addItem } = keywordHarness((q) =>
      q === 'brigadeiro' ? [PROD_ENTITY] : [],
    );

    // Turno 1: intercepta na keyword → propõe com a quantidade DITA (2).
    const res1 = await service.handleFallback('t1', 'quero 2 brigadeiros', conversation);
    expect(addItem).not.toHaveBeenCalled();
    const pending = updateContext.mock.calls[0][1].pending_cart_add;
    expect(pending.quantity).toBe(2);
    expect(pending.produto_id).toBe('p1');
    expect(String(res1)).toContain('2x Brigadeiro Gourmet');
    expect(String(res1).toLowerCase()).toContain('confirm');

    // Turno 2: mesma porta de TODO caminho — o gate roteia, o executor escreve.
    expect(service.detectIntent('sim', conversation)).toBe('pending_cart_add');
    const res2 = await service.handlePendingCartAdd('t1', 'sim', conversation);
    expect(addItem).toHaveBeenCalledTimes(1);
    expect(addItem.mock.calls[0][0].quantity).toBe(2);
    expect(String(res2)).toContain('✅ Adicionado 2x Brigadeiro Gourmet');
  });

  it('#1 handleCart "adicionar brigadeiro" → PROPÕE (addItem=0), não escreve', async () => {
    const { service, conversation, updateContext, addItem } = keywordHarness(() => [PROD_ENTITY]);

    const res = await service.handleCart('t1', '5511999998888', 'adicionar brigadeiro', conversation);

    expect(addItem).not.toHaveBeenCalled();
    expect(updateContext.mock.calls[0][1].pending_cart_add.produto_id).toBe('p1');
    expect(String(res).toLowerCase()).toContain('confirm');
  });

  it('#2 handleFallback buy-block "quero brigadeiro" → PROPÕE 1x (sem número na frase → default H6)', async () => {
    const { service, conversation, updateContext, addItem } = keywordHarness(() => [PROD_ENTITY]);

    const res = await service.handleFallback('t1', 'quero brigadeiro', conversation);

    expect(addItem).not.toHaveBeenCalled();
    expect(updateContext.mock.calls[0][1].pending_cart_add.quantity).toBe(1);
    expect(String(res)).toContain('1x Brigadeiro Gourmet');
  });

  it('#4 botão add_<produto> → carrega a conversa e PROPÕE (addItem=0)', async () => {
    const { service, conversation, updateContext, addItem } = keywordHarness(() => [PROD_ENTITY]);
    service.conversationService.getOrCreateConversation = jest
      .fn()
      .mockResolvedValue(conversation);

    const res = await service.processInteractiveButton('add_brigadeiro', 't1', '5511999998888');

    expect(addItem).not.toHaveBeenCalled();
    expect(updateContext.mock.calls[0][1].pending_cart_add.produto_id).toBe('p1');
    expect(String(res).toLowerCase()).toContain('confirm');
  });

  it('#4 botão com produto inexistente → mensagem honesta, NADA persistido', async () => {
    const { service, updateContext, addItem } = keywordHarness(() => []);
    service.conversationService.getOrCreateConversation = jest.fn();

    const res = await service.processInteractiveButton('add_dragao', 't1', '5511999998888');

    expect(addItem).not.toHaveBeenCalled();
    expect(updateContext).not.toHaveBeenCalled();
    expect(String(res)).toContain('não encontrado');
  });
});

describe('WhatsappService — Fatia 3 Passo 1: o gate de precedência no detectIntent', () => {
  it('pending FRESCO ativo → a mensagem roteia pra pending_cart_add ANTES de qualquer rota', () => {
    const { service, conversation } = harness(freshPending());
    expect(service.detectIntent('sim', conversation)).toBe('pending_cart_add');
    // Até um comando que casaria outra rota pertence à confirmação:
    expect(service.detectIntent('carrinho', conversation)).toBe('pending_cart_add');
  });

  it('sem pending → "sim" solto NÃO roteia pro gate (segue o fluxo normal)', () => {
    const { service, conversation } = harness(null);
    expect(service.detectIntent('sim', conversation)).not.toBe('pending_cart_add');
  });

  it('pending EXPIRADO → gate ignora (inerte; não sequestra a conversa)', () => {
    const stale = freshPending({
      proposed_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    });
    const { service, conversation } = harness(stale);
    expect(service.detectIntent('sim', conversation)).not.toBe('pending_cart_add');
  });

  it('Decisão 3: checkout ativo GANHA do pending (a FSM do dinheiro é dona do turno)', () => {
    const { service, conversation } = harness(freshPending());
    conversation.context.checkout = { stage: 'confirming_address' };
    expect(service.detectIntent('sim', conversation)).toBe('collection');
  });
});
