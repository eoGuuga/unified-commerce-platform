import { OpenAIService, ToolCallingResult } from './openai.service';

/**
 * Fatia 0 do tool-calling pleno (Fase 2 da IA-vendedora): o cliente estendido
 * pra function-calling NATIVO. **ADITIVO e INERTE** — nenhum caminho de produção
 * chama `callWithTools` ainda. O método antigo (`callChatCompletions` /
 * `response_format`) segue intacto; o router e o Fix 3 NÃO podem regredir.
 *
 * TDD sem LLM vivo: mocka o `global.fetch`, assere o parse de `tool_calls` vs
 * `content`. Shape esperado = o padrão OpenAI/OpenRouter (choices[0].message
 * .tool_calls[].function.{name,arguments}; `arguments` é STRING JSON).
 */
function buildService(): any {
  return new (OpenAIService as any)(undefined, undefined);
}

function mockFetchOnce(jsonBody: unknown, ok = true, status = 200) {
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => jsonBody,
    text: async () => JSON.stringify(jsonBody),
  });
}

const INPUT = {
  apiKey: 'k',
  baseUrl: 'https://openrouter.example/api/v1',
  timeoutMs: 5000,
  body: {
    model: 'gpt-4o-mini',
    messages: [],
    tools: [{ type: 'function', function: { name: 'check_price' } }],
    tool_choice: 'auto',
  },
};

describe('OpenAIService.callWithTools — Fatia 0 (function-calling nativo, aditivo/inerte)', () => {
  const realFetch = global.fetch;
  afterAll(() => {
    (global as any).fetch = realFetch;
  });

  it('🎯 tool_calls → extrai name + args estruturados (arguments é JSON string)', async () => {
    mockFetchOnce({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'check_price', arguments: '{"product":"brigadeiro"}' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    });
    const service = buildService();
    const r: ToolCallingResult | null = await service.callWithTools(INPUT);
    expect(r).toEqual({
      kind: 'tool_calls',
      toolCalls: [{ id: 'call_1', name: 'check_price', args: { product: 'brigadeiro' } }],
    });
  });

  it('🎯 content (sem tool_calls) → retorna a narração final', async () => {
    mockFetchOnce({
      choices: [{ message: { content: 'Oi! Como posso ajudar? 🙂' }, finish_reason: 'stop' }],
    });
    const service = buildService();
    const r = await service.callWithTools(INPUT);
    expect(r).toEqual({ kind: 'content', content: 'Oi! Como posso ajudar? 🙂' });
  });

  it('múltiplos tool_calls → todos extraídos', async () => {
    mockFetchOnce({
      choices: [
        {
          message: {
            tool_calls: [
              { id: 'c1', function: { name: 'check_price', arguments: '{"product":"a"}' } },
              { id: 'c2', function: { name: 'check_stock', arguments: '{"product":"b"}' } },
            ],
          },
        },
      ],
    });
    const service = buildService();
    const r = await service.callWithTools(INPUT);
    expect(r).toEqual({
      kind: 'tool_calls',
      toolCalls: [
        { id: 'c1', name: 'check_price', args: { product: 'a' } },
        { id: 'c2', name: 'check_stock', args: { product: 'b' } },
      ],
    });
  });

  it('args malformado (JSON inválido) → args {} (defensivo, não quebra)', async () => {
    mockFetchOnce({
      choices: [
        { message: { tool_calls: [{ id: 'c1', function: { name: 'check_price', arguments: 'not-json' } }] } },
      ],
    });
    const service = buildService();
    const r = await service.callWithTools(INPUT);
    expect(r).toEqual({
      kind: 'tool_calls',
      toolCalls: [{ id: 'c1', name: 'check_price', args: {} }],
    });
  });

  it('resposta HTTP não-ok → null', async () => {
    mockFetchOnce({ error: 'boom' }, false, 500);
    const service = buildService();
    const r = await service.callWithTools(INPUT);
    expect(r).toBeNull();
  });

  it('passa `tools` e `tool_choice` no body da requisição', async () => {
    mockFetchOnce({ choices: [{ message: { content: 'ok' } }] });
    const service = buildService();
    await service.callWithTools(INPUT);
    const call = (global as any).fetch.mock.calls[0];
    const sentBody = JSON.parse(call[1].body);
    expect(sentBody.tools).toEqual(INPUT.body.tools);
    expect(sentBody.tool_choice).toBe('auto');
  });
});
