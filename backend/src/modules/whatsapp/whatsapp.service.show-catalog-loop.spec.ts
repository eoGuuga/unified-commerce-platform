import { WhatsappService } from './whatsapp.service';

/**
 * Fatia 2 / Movimento A — show_catalog pelo LOOP de tool-calling + cinturão §5
 * com N preços autorizados (a lista inteira do catálogo). A IA narra o catálogo;
 * o cinturão verifica que todo número narrado ∈ preços reais → pega preço
 * trocado/inventado. Bloqueou → cai no determinístico (a lista interativa
 * code-owned de `handleCatalog`). `runToolStep` MOCKADO (sem LLM vivo).
 *
 * Furo residual conhecido (número-belt): troca de PAR (preço válido no produto
 * errado) e nome de produto inventado NÃO são pegos — só valor de preço fora do
 * conjunto. Registrado pro Movimento B / design de fato-texto.
 */
function buildService(overrides: Record<string, unknown> = {}): any {
  const service: any = new (WhatsappService as any)(...new Array(40).fill(undefined));
  Object.assign(service, overrides);
  return service;
}

const CATALOG = [
  { id: 'p1', name: 'Brigadeiro Gourmet', price: 5 },
  { id: 'p2', name: 'Bolo de Pote', price: 12.9 },
];

const twoStep = (narration: string) =>
  jest
    .fn()
    .mockResolvedValueOnce({
      kind: 'tool_calls',
      toolCalls: [{ id: 'c1', name: 'show_catalog', args: {} }],
    })
    .mockResolvedValueOnce({ kind: 'content', content: narration });

describe('WhatsappService — Fatia 2/Mov A: show_catalog pelo loop + cinturão (N preços)', () => {
  it('narração fiel do catálogo (todos os preços conferem) → enviada como está', async () => {
    const service = buildService({
      catalogManager: { getCatalogProducts: jest.fn().mockResolvedValue(CATALOG) },
      openAIService: {
        runToolStep: twoStep(
          'Temos Brigadeiro Gourmet por R$ 5,00 e Bolo de Pote por R$ 12,90! 🍫',
        ),
      },
    });
    const res = await service.handleShowCatalogViaLoop('t1', 'ver produtos');
    expect(res).toContain('Brigadeiro Gourmet');
    expect(res).toContain('12,90');
  });

  it('🎯 um preço trocado (R$ 99 ∉ catálogo) → cinturão BLOQUEIA → determinístico (lista interativa)', async () => {
    const interactive = { kind: 'interactive_list', previewText: 'Cardápio 🍫' };
    const service = buildService({
      catalogManager: {
        getCatalogProducts: jest.fn().mockResolvedValue(CATALOG),
        parseCatalogSelection: jest.fn().mockReturnValue(null),
        buildInteractiveCatalogResponse: jest.fn().mockResolvedValue(interactive),
      },
      openAIService: { runToolStep: twoStep('Brigadeiro por R$ 5,00 e Bolo por R$ 99,00!') },
    });
    const res = await service.handleShowCatalogViaLoop('t1', 'ver produtos');
    expect(res).toBe(interactive);
  });

  it('degrada pro determinístico (handleCatalog) se o LLM não pedir a tool', async () => {
    const interactive = { kind: 'interactive_list', previewText: 'Cardápio 🍫' };
    const service = buildService({
      catalogManager: {
        getCatalogProducts: jest.fn().mockResolvedValue(CATALOG),
        parseCatalogSelection: jest.fn().mockReturnValue(null),
        buildInteractiveCatalogResponse: jest.fn().mockResolvedValue(interactive),
      },
      openAIService: { runToolStep: jest.fn().mockResolvedValue(null) },
    });
    const res = await service.handleShowCatalogViaLoop('t1', 'ver produtos');
    expect(res).toBe(interactive);
  });

  it('catálogo vazio → determinístico (handleCatalog), não tenta narrar', async () => {
    const service = buildService({
      catalogManager: {
        getCatalogProducts: jest.fn().mockResolvedValue([]),
        parseCatalogSelection: jest.fn().mockReturnValue(null),
        buildInteractiveCatalogResponse: jest.fn().mockResolvedValue(null),
      },
      openAIService: { runToolStep: twoStep('deveria narrar? não') },
    });
    const res = await service.handleShowCatalogViaLoop('t1', 'ver produtos');
    expect(res).toBe('Não temos produtos no momento. 😔');
  });
});
