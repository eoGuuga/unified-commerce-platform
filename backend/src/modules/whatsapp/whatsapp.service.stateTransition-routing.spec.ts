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
function driveFallback(action: string): any {
  return buildService({
    isProductIntent: () => false,
    productsService: { search: jest.fn().mockResolvedValue([]) },
    botConfigService: { loadConfig: jest.fn().mockResolvedValue({}) },
    llmRouterService: {
      route: jest.fn().mockResolvedValue({ action, params: {}, confidence: 0.9 }),
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

  it('🎯 default: ação ainda-não-cabeada (ex. process_order/Tipo B) NÃO vira silêncio — cai no fallback amigável', async () => {
    const service = driveFallback('process_order');
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
