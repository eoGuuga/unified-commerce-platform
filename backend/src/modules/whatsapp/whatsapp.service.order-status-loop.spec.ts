import { WhatsappService } from './whatsapp.service';

/**
 * Fatia 2 / Movimento B — check_order_status pelo LOOP com STATUS DETERMINÍSTICO
 * (opção a). O CÓDIGO é dono da frase-fato do status; a IA só embrulha com tom.
 * O cinturão cobre DUAS coisas: (1) containment — a frase-fato tem que sair
 * íntegra (senão → determinístico); (2) números — total/nº do pedido autorizados,
 * qualquer outro número (ex. "10 min") é invenção. `runToolStep` MOCKADO.
 *
 * FRONTEIRA HONESTA: um fato-novo NÃO-numérico e NÃO-status ("entregador a
 * caminho") NÃO é pego pelo cinturão — só o prompt + a frase garantida o barram.
 */
function buildService(overrides: Record<string, unknown> = {}): any {
  const service: any = new (WhatsappService as any)(...new Array(40).fill(undefined));
  Object.assign(service, overrides);
  return service;
}

const PEDIDO = { id: 'o1', order_no: 'PED-1234', status: 'em_producao', total_amount: 50 };
const FACT = 'Seu pedido está em preparo 👩‍🍳';
const DET = '👨‍🍳 *Pedido PED-1234*\nStatus: Preparando\n\nEstamos preparando com carinho!';
const conv: any = { id: 'c1', customer_phone: '5511999998888', context: {} };

const twoStep = (narration: string) =>
  jest
    .fn()
    .mockResolvedValueOnce({
      kind: 'tool_calls',
      toolCalls: [{ id: 'c1', name: 'check_order_status', args: {} }],
    })
    .mockResolvedValueOnce({ kind: 'content', content: narration });

function svc(narration: string): any {
  return buildService({
    ordersService: {
      findLatestByCustomerPhone: jest.fn().mockResolvedValue(PEDIDO),
      findByOrderNo: jest.fn().mockResolvedValue(PEDIDO),
    },
    responseBuilder: {
      buildOrderStatusFactPhrase: jest.fn().mockReturnValue(FACT),
      buildOrderStatusMessage: jest.fn().mockReturnValue(DET),
    },
    openAIService: { runToolStep: twoStep(narration) },
  });
}

describe('WhatsappService — Fatia 2/Mov B: check_order_status pelo loop (status determinístico)', () => {
  it('IA embrulha e mantém a frase-fato íntegra → resposta contém a frase real', async () => {
    const service = svc('Oi! Seu pedido está em preparo 👩‍🍳 Qualquer dúvida é só chamar! 😊');
    const res = await service.handleOrderStatusViaLoop('t1', '5511999998888', 'cadê meu pedido?', conv);
    expect(res).toContain('em preparo');
  });

  it('🎯 IA troca o status ("saiu pra entrega" quando é preparo) → containment falha → determinístico', async () => {
    const service = svc('Boas notícias! Seu pedido saiu para entrega 🛵 já já chega!');
    const res = await service.handleOrderStatusViaLoop('t1', '5511999998888', 'status?', conv);
    expect(res).toBe(DET);
  });

  it('🎯 IA inventa tempo ("10 min") mas mantém a frase → cinturão-número pega o 10 → determinístico', async () => {
    const service = svc('Seu pedido está em preparo 👩‍🍳 e sai em 10 min!');
    const res = await service.handleOrderStatusViaLoop('t1', '5511999998888', 'status?', conv);
    expect(String(res)).not.toContain('10 min');
    expect(res).toBe(DET);
  });

  it('números reais do pedido (total R$ 50,00) → autorizados → passa', async () => {
    const service = svc('Seu pedido está em preparo 👩‍🍳 no total de R$ 50,00. Qualquer dúvida chama!');
    const res = await service.handleOrderStatusViaLoop('t1', '5511999998888', 'status?', conv);
    expect(res).toContain('50,00');
  });

  it('FRONTEIRA HONESTA: fato-novo NÃO-numérico ("entregador a caminho") passa — só o prompt o barra', async () => {
    const service = svc('Seu pedido está em preparo 👩‍🍳 e o entregador já está a caminho!');
    const res = await service.handleOrderStatusViaLoop('t1', '5511999998888', 'status?', conv);
    // Documenta a fronteira: containment + cinturão-de-número NÃO pegam fato-texto
    // novo sem número. Limitação conhecida, mitigada só pelo prompt.
    expect(res).toContain('a caminho');
  });

  it('nenhum pedido → admissão honesta direta (não narra status)', async () => {
    const service = buildService({
      ordersService: {
        findLatestByCustomerPhone: jest.fn().mockResolvedValue(null),
        findByOrderNo: jest.fn().mockResolvedValue(null),
      },
      responseBuilder: {},
      openAIService: { runToolStep: twoStep('...') },
    });
    const res = await service.handleOrderStatusViaLoop('t1', '5511999998888', 'cadê?', conv);
    expect(String(res).toLowerCase()).toContain('não encontrei');
  });

  it('degrada pro determinístico se o LLM não pedir a tool (sem chave)', async () => {
    const service = buildService({
      ordersService: {
        findLatestByCustomerPhone: jest.fn().mockResolvedValue(PEDIDO),
        findByOrderNo: jest.fn().mockResolvedValue(PEDIDO),
      },
      responseBuilder: {
        buildOrderStatusFactPhrase: jest.fn().mockReturnValue(FACT),
        buildOrderStatusMessage: jest.fn().mockReturnValue(DET),
      },
      openAIService: { runToolStep: jest.fn().mockResolvedValue(null) },
    });
    const res = await service.handleOrderStatusViaLoop('t1', '5511999998888', 'status?', conv);
    expect(res).toBe(DET);
  });
});
