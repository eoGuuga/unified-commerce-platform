import { WhatsappService } from './whatsapp.service';

/**
 * Fatia 2 / Movimento A — check_stock (B1, paridade honesta) pelo LOOP + cinturão
 * §5 no modo `forbidBareNumbers`. A tool devolve só disponibilidade (SEM
 * quantidade), então o conjunto autorizado é [] → QUALQUER número na narração é
 * invenção. "Temos sim" (sem número) passa; "temos uns 20" (quantidade inventada)
 * bloqueia → determinístico. `runToolStep` MOCKADO (sem LLM vivo).
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
      toolCalls: [{ id: 'c1', name: 'check_stock', args: toolArgs }],
    })
    .mockResolvedValueOnce({ kind: 'content', content: narration });

describe('WhatsappService — Fatia 2/Mov A: check_stock pelo loop + cinturão B1', () => {
  it('IA narra disponibilidade SEM número → passa (o answer B1 esperado)', async () => {
    const service = buildService({
      productsService: { search: jest.fn().mockResolvedValue([PROD]) },
      openAIService: { runToolStep: twoStep('Temos sim! 🍫 Quer que eu adicione ao carrinho?') },
    });
    const res = await service.handleCheckStockViaLoop(
      't1',
      { product: 'brigadeiro' },
      'tem brigadeiro?',
      '5511999',
    );
    expect(res).toBe('Temos sim! 🍫 Quer que eu adicione ao carrinho?');
  });

  it('🎯 IA inventa quantidade ("temos uns 20") → BLOQUEIA → determinístico (sem o número da IA)', async () => {
    const service = buildService({
      productsService: { search: jest.fn().mockResolvedValue([PROD]) },
      openAIService: { runToolStep: twoStep('Temos uns 20 em estoque, garantido!') },
    });
    const res = await service.handleCheckStockViaLoop(
      't1',
      { product: 'brigadeiro' },
      'quantos tem?',
      '5511999',
    );
    expect(String(res)).not.toContain('20');
    expect(String(res)).toContain('Brigadeiro Gourmet'); // determinístico (formatProductAvailability)
  });

  it('produto não existe → admissão honesta (não inventa, nem narra disponibilidade falsa)', async () => {
    const service = buildService({
      productsService: { search: jest.fn().mockResolvedValue([]) },
      openAIService: { runToolStep: twoStep('Temos sim, com certeza!', { product: 'dragão' }) },
    });
    const res = await service.handleCheckStockViaLoop(
      't1',
      { product: 'dragão' },
      'tem dragão de ouro?',
      '5511999',
    );
    expect(String(res).toLowerCase()).toContain('não achei');
  });

  it('degrada pro Fix 3 (routeProductAction) se o LLM não pedir a tool', async () => {
    const service = buildService({
      productsService: { search: jest.fn().mockResolvedValue([PROD]) },
      openAIService: { runToolStep: jest.fn().mockResolvedValue(null) },
    });
    const res = await service.handleCheckStockViaLoop(
      't1',
      { product: 'brigadeiro' },
      'tem?',
      '5511999',
    );
    expect(String(res)).toContain('Brigadeiro Gourmet');
  });
});
