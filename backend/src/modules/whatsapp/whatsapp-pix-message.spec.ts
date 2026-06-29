/**
 * Teste do fluxo PIX no bot (S3 / Task 3): imagem do QR, valor cobrado exato,
 * e caminho de falha honesto com estado TIPADO.
 *
 * Cobre os DOIS pontos sob lupa:
 *  - PONTO 2 (valor): a mensagem exibe o VALOR COBRADO (95% = pagamento.amount),
 *    formatado no padrao BRL do sistema (R$ 95,00), ANCORADO no rotulo do PIX —
 *    nunca o total cheio (R$ 100,00).
 *  - PONTO 1 (estado tipado): em falha, o pedido recebe payment_issue=true (flag
 *    booleano consultavel), NAO texto em customer_notes; e o lojista e avisado.
 *
 * Estrategia (igual a whatsapp-checkout-collection.spec): instancia o
 * WhatsAppService sem o DI do Nest, injetando so os colaboradores tocados.
 */
import { WhatsAppService } from './whatsapp.service';

// Formatador BRL do sistema (mesmo de generatePixMessage e do service): R$ 95,00.
const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

function makeConversation() {
  return {
    id: 'conv-1',
    customer_phone: '5511999999999',
    customer_name: undefined as string | undefined,
    context: {} as Record<string, any>,
  };
}

// Dirige a FSM ate criar o pedido + gerar o PIX (confirmando o endereco).
async function driveToPixGeneration(service: any, tenantId: string, phone: string, conversation: any) {
  await service.handleCheckout(tenantId, phone, conversation);
  await service.handleCollectionStage(tenantId, 'entrega', conversation);
  await service.handleCollectionStage(tenantId, 'Maria Souza', conversation);
  await service.handleCollectionStage(tenantId, '11988887777', conversation);
  await service.handleCollectionStage(
    tenantId,
    'Rua das Flores, 123, Centro, Sao Paulo, SP, 01001-000',
    conversation,
  );
  // "confirmar" -> finalizeDeliveryCheckout -> cria pedido + gera PIX
  return service.handleCollectionStage(tenantId, 'confirmar', conversation);
}

describe('PIX no bot: imagem, falha honesta, valor (S3)', () => {
  const tenantId = 'tenant-1';
  const phone = '5511999999999';
  let service: any;
  let conversation: ReturnType<typeof makeConversation>;
  let sendImageSpy: jest.Mock;
  let createPaymentSpy: jest.Mock;
  let notifyMerchantSpy: jest.Mock;
  let orderSaveSpy: jest.Mock;

  // Pedido total 100; PIX cobra 95 (5% desconto) — o que o createPayment retorna.
  const ORDER = { id: 'order-123', order_no: 'WA-0001', total_amount: 100 };

  beforeEach(() => {
    conversation = makeConversation();

    const cartService = {
      getOrCreateCart: jest.fn().mockResolvedValue({
        id: 'cart-1',
        items: [
          { produto_id: 'prod-1', produto_name: 'Brigadeiro', quantity: 1, unit_price: 100 },
        ],
        shipping_amount: 0,
        discount_amount: 0,
        coupon_code: null,
        total_amount: 100,
      }),
      markAsConverted: jest.fn().mockResolvedValue(undefined),
    };

    const ordersService = {
      create: jest.fn().mockResolvedValue({ ...ORDER }),
    };

    sendImageSpy = jest.fn().mockResolvedValue(undefined);
    const whatsappSender = {
      sendImage: sendImageSpy,
      sendText: jest.fn().mockResolvedValue(undefined),
    };

    notifyMerchantSpy = jest.fn().mockResolvedValue(undefined);
    const notificationsService = { notifyMerchantPaymentIssue: notifyMerchantSpy };

    orderSaveSpy = jest.fn().mockImplementation(async (p: any) => p);
    const db = { getRepository: jest.fn().mockReturnValue({ save: orderSaveSpy }) };

    createPaymentSpy = jest.fn();
    const paymentsService = { createPayment: createPaymentSpy };

    const conversationService = {
      updateContext: jest.fn().mockImplementation(async (_id: string, updates: Record<string, any>) => {
        conversation.context = { ...conversation.context, ...updates };
      }),
    };

    const deps: any[] = new Array(30).fill(undefined);
    service = new (WhatsAppService as any)(...deps);
    service.cartService = cartService;
    service.ordersService = ordersService;
    service.paymentsService = paymentsService;
    service.notificationsService = notificationsService;
    service.whatsappSender = whatsappSender;
    service.db = db;
    service.conversationService = conversationService;
    service.logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn(), debug: jest.fn() };
  });

  it('sucesso: envia a imagem do QR via sendImage E a copia-e-cola em texto', async () => {
    createPaymentSpy.mockResolvedValue({
      qr_code: 'data:image/png;base64,AAA',
      copy_paste: '000201BR',
      pagamento: { amount: 95 },
    });

    const textOut = String(await driveToPixGeneration(service, tenantId, phone, conversation));

    // imagem do QR enviada com a data-URL e uma legenda
    expect(sendImageSpy).toHaveBeenCalledWith(
      tenantId,
      phone,
      'data:image/png;base64,AAA',
      expect.any(String),
    );
    // copia-e-cola presente no texto
    expect(textOut).toContain('000201BR');
  });

  it('sucesso: exibe o desconto PIX (de 100 por 95), com o cobrado ancorado no contexto', async () => {
    createPaymentSpy.mockResolvedValue({
      qr_code: 'data:image/png;base64,AAA',
      copy_paste: '000201BR',
      pagamento: { amount: 95 },
    });

    const textOut = String(await driveToPixGeneration(service, tenantId, phone, conversation));

    // VALOR COBRADO (95) ancorado no contexto do PIX — nao um "95" solto que CEP/nº casaria.
    // Falha se o cobrado nao for o pagamento.amount.
    expect(textOut).toMatch(/por \*?R\$ 95,00\*? no PIX/);
    // O total cheio (100) aparece SO como referencia ("De ..."), nunca como valor a pagar.
    expect(textOut).toMatch(/De R\$ 100,00 por/);
    // Desconto explicito como argumento de venda: o cliente ve quanto economiza.
    expect(textOut).toContain(`economiza ${brl(5)}`); // R$ 5,00
  });

  it('falha: createPayment lanca -> honesto + payment_issue=true (tipado) + notifica lojista', async () => {
    createPaymentSpy.mockRejectedValue(new Error('MercadoPago indisponivel'));

    const textOut = String(await driveToPixGeneration(service, tenantId, phone, conversation));

    // mensagem honesta, sem "aguarde o link"
    expect(textOut).toMatch(/problema ao gerar (o )?pagamento/i);
    expect(textOut).not.toMatch(/aguarde o link/i);

    // ESTADO TIPADO consultavel: payment_issue=true no save do pedido (nao customer_notes).
    expect(orderSaveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ payment_issue: true }),
    );

    // lojista avisado diretamente (best-effort)
    expect(notifyMerchantSpy).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({ id: expect.any(String) }),
    );

    // imagem NAO foi enviada no caminho de falha
    expect(sendImageSpy).not.toHaveBeenCalled();
  });
});
