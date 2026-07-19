import { ActionExecutorService } from './action-executor.service';

/**
 * PRIMEIRO spec direto do ActionExecutorService — o 🔴 nº1 do mapa de calor de
 * testes (GRAFO-DO-CODIGO.md §5.2: "o hub das ações da IA, 0 spec direto").
 * Semente paga junto com a Fatia 4 (que adicionou o case start_checkout).
 *
 * Cobre o contrato central: (1) as ações de NEGÓCIO são passthrough
 * {response:'', stateTransition} e NUNCA consultam o LLM (quem executa é o
 * routeBusinessAction do orquestrador); (2) ação desconhecida degrada pro
 * clarify amigável (nunca silêncio, nunca crash); (3) as conversacionais
 * respondem via generateTextReply.
 */
const BOT_CONFIG: any = {
  persona: { name: 'Ana', role: 'vendedora consultiva', tone: 'acolhedora', greeting_style: 'Oi!' },
  store: {
    name: 'Doceria', description: 'Doces artesanais',
    payment_methods: ['pix'], delivery_options: ['entrega'], business_hours: '9-18',
  },
  rules: [],
  model: 'gpt-4o-mini',
  temperature: 0.3,
};

const ctx = (over: Record<string, unknown> = {}): any => ({
  tenantId: 't1',
  message: 'oi',
  customerName: 'Ana',
  conversation: { context: {} },
  botConfig: BOT_CONFIG,
  ...over,
});

function build(reply: string | null = 'resposta-do-llm') {
  const generateTextReply = jest.fn().mockResolvedValue(reply);
  const service = new ActionExecutorService({ generateTextReply } as any);
  return { service, generateTextReply };
}

const BUSINESS_ACTIONS = [
  'show_catalog', 'process_order', 'check_price', 'check_stock',
  'check_order_status', 'cancel_order', 'select_payment',
  'start_checkout', // Fatia 4
  'collect_info',
] as const;

describe('ActionExecutorService — passthrough das ações de negócio', () => {
  it.each(BUSINESS_ACTIONS)(
    '🎯 %s → {response:"", stateTransition} SEM consultar o LLM',
    async (action) => {
      const { service, generateTextReply } = build();

      const res = await service.execute({ action, params: {}, confidence: 0.9 } as any, ctx());

      expect(res).toEqual({ response: '', stateTransition: action });
      expect(generateTextReply).not.toHaveBeenCalled();
    },
  );
});

describe('ActionExecutorService — degradação e conversacionais', () => {
  it('🎯 ação DESCONHECIDA → clarify amigável (nunca silêncio, nunca crash)', async () => {
    const { service, generateTextReply } = build('Pode me contar mais? 🙂');

    const res = await service.execute(
      { action: 'acao_que_nao_existe', params: {}, confidence: 0.2 } as any,
      ctx(),
    );

    expect(generateTextReply).toHaveBeenCalledTimes(1);
    expect(res.response).toBe('Pode me contar mais? 🙂');
    expect(res.stateTransition).toBeUndefined();
  });

  it('greeting → responde via generateTextReply', async () => {
    const { service, generateTextReply } = build('Oi, Ana! Que bom te ver 🙂');

    const res = await service.execute(
      { action: 'greeting', params: {}, confidence: 0.9 } as any,
      ctx(),
    );

    expect(generateTextReply).toHaveBeenCalledTimes(1);
    expect(res.response).toBe('Oi, Ana! Que bom te ver 🙂');
  });

  it('LLM devolve vazio → fallback interno ("Oi! Como posso ajudar?"), nunca resposta vazia', async () => {
    const { service } = build(null);

    const res = await service.execute(
      { action: 'greeting', params: {}, confidence: 0.9 } as any,
      ctx(),
    );

    expect(String(res.response).length).toBeGreaterThan(0);
  });
});
