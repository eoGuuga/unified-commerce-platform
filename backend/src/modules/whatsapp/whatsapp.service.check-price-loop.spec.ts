import { WhatsappService } from './whatsapp.service';

/**
 * Fatia 1 — check_price pelo LOOP de tool-calling + o cinturão §5. Prova o fluxo
 * inteiro (tool_call → executa a tool real → resultado → IA narra → cinturão)
 * com `openAIService.runToolStep` MOCKADO (sem LLM vivo). SÓ check_price migra;
 * o resto fica no Fix 3.
 *
 * ⚠️ Validação ponta-a-ponta com o LLM REAL fica PENDENTE (o Gustavo roda com a
 * chave) — aqui a lógica do cinturão está provada por mock.
 */
function buildService(overrides: Record<string, unknown> = {}): any {
  const service: any = new (WhatsappService as any)(...new Array(40).fill(undefined));
  Object.assign(service, overrides);
  return service;
}

const PROD = { id: 'p1', name: 'Brigadeiro Gourmet', price: 5 };

const twoStep = (narration: string, toolArgs: Record<string, unknown> = { product: 'brigadeiro' }) =>
  jest
    .fn()
    .mockResolvedValueOnce({
      kind: 'tool_calls',
      toolCalls: [{ id: 'c1', name: 'check_price', args: toolArgs }],
    })
    .mockResolvedValueOnce({ kind: 'content', content: narration });

describe('WhatsappService — Fatia 1: check_price pelo loop + cinturão §5', () => {
  it('🎯 O TESTE-CHAVE: tool devolve 5, IA narra "R$ 8,00" → enviado é o DETERMINÍSTICO (5,00); a invenção NÃO sai', async () => {
    const service = buildService({
      productsService: { search: jest.fn().mockResolvedValue([PROD]) },
      openAIService: { runToolStep: twoStep('Ótima escolha! Custa R$ 8,00.') },
    });

    const res = await service.handleCheckPriceViaLoop('t1', { product: 'brigadeiro' }, 'quanto custa brigadeiro?');

    expect(String(res)).not.toContain('8,00');
    expect(String(res)).not.toContain('8.00');
    expect(String(res)).toContain('5.00'); // determinístico (formatProductPrice)
    expect(String(res)).toContain('Brigadeiro Gourmet');
  });

  it('narração fiel (R$ 5,00) → enviada como está (a IA narra)', async () => {
    const service = buildService({
      productsService: { search: jest.fn().mockResolvedValue([PROD]) },
      openAIService: { runToolStep: twoStep('O Brigadeiro Gourmet sai por R$ 5,00! Quer? 🙂') },
    });
    const res = await service.handleCheckPriceViaLoop('t1', { product: 'brigadeiro' }, 'preço?');
    expect(res).toBe('O Brigadeiro Gourmet sai por R$ 5,00! Quer? 🙂');
  });

  it('tool found:false + IA inventa preço → admissão determinística (não vaza preço)', async () => {
    const service = buildService({
      productsService: { search: jest.fn().mockResolvedValue([]) }, // não achou
      openAIService: { runToolStep: twoStep('Esse custa R$ 12,00!', { product: 'inexistente' }) },
    });
    const res = await service.handleCheckPriceViaLoop('t1', { product: 'inexistente' }, 'preço do inexistente?');
    expect(String(res)).not.toContain('12,00');
    expect(String(res).toLowerCase()).toContain('não achei');
  });

  it('narração só-tom (sem número) → passa (nada a verificar)', async () => {
    const service = buildService({
      productsService: { search: jest.fn().mockResolvedValue([PROD]) },
      openAIService: { runToolStep: twoStep('Que delícia! É um dos nossos queridinhos. 🍫') },
    });
    const res = await service.handleCheckPriceViaLoop('t1', { product: 'brigadeiro' }, 'me fala do brigadeiro');
    expect(res).toBe('Que delícia! É um dos nossos queridinhos. 🍫');
  });

  it('o loop executou a tool REAL com o arg estruturado E devolveu o resultado pra IA narrar', async () => {
    const runToolStep = twoStep('R$ 5,00');
    const search = jest.fn().mockResolvedValue([PROD]);
    const service = buildService({ productsService: { search }, openAIService: { runToolStep } });

    await service.handleCheckPriceViaLoop('t1', { product: 'brigadeiro' }, 'quanto?');

    expect(search).toHaveBeenCalledWith('t1', 'brigadeiro'); // tool real, arg do LLM
    expect(runToolStep).toHaveBeenCalledTimes(2); // pedir tool + narrar
    const secondCallMessages = runToolStep.mock.calls[1][0];
    const toolMsg = secondCallMessages.find((m: any) => m.role === 'tool');
    expect(toolMsg).toBeTruthy();
    expect(JSON.parse(toolMsg.content)).toEqual({ found: true, name: 'Brigadeiro Gourmet', price: 5 });
  });

  it('degrada pro Fix 3 (determinístico) se o LLM não pedir a tool (ex.: sem chave)', async () => {
    const service = buildService({
      productsService: { search: jest.fn().mockResolvedValue([PROD]) },
      openAIService: { runToolStep: jest.fn().mockResolvedValue(null) }, // sem LLM
    });
    const res = await service.handleCheckPriceViaLoop('t1', { product: 'brigadeiro' }, 'preço?');
    // cai no routeProductAction (Fix 3) → preço real formatado
    expect(String(res)).toContain('5.00');
    expect(String(res)).toContain('Brigadeiro Gourmet');
  });
});
