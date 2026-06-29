/**
 * Teste da FSM de checkout com coleta de identidade + endereco de ENTREGA (S2a).
 *
 * INVARIANTE CRITICA (D2): o pedido SO e criado depois que o cliente CONFIRMA
 * o endereco montado. Estes testes dirigem a FSM mensagem-a-mensagem e provam:
 *  - confirmacao -> ordersService.create chamado com delivery_type='delivery'
 *    e delivery_address completo;
 *  - rejeicao apos o endereco montado -> ordersService.create NUNCA chamado.
 *
 * Estrategia: instanciar WhatsAppService sem o DI do Nest, injetando apenas os
 * colaboradores tocados pela FSM de checkout (cartService, ordersService,
 * paymentsService, conversationService). O resto fica undefined.
 */
import { WhatsAppService } from './whatsapp.service';

// ---- Conversa em memoria (simula conversationService.updateContext) ----
function makeConversation() {
  return {
    id: 'conv-1',
    customer_name: undefined as string | undefined,
    context: {} as Record<string, any>,
  };
}

describe('Checkout: coleta de entrega (S2a)', () => {
  const tenantId = 'tenant-1';
  const phone = '5511999999999';
  let service: any;
  let conversation: ReturnType<typeof makeConversation>;
  let createSpy: jest.Mock;

  beforeEach(() => {
    conversation = makeConversation();

    // Carrinho com 1 item.
    const cartService = {
      getOrCreateCart: jest.fn().mockResolvedValue({
        id: 'cart-1',
        items: [
          { produto_id: 'prod-1', produto_name: 'Brigadeiro', quantity: 2, unit_price: 5 },
        ],
        shipping_amount: 10,
        discount_amount: 0,
        coupon_code: null,
        total_amount: 20,
      }),
      markAsConverted: jest.fn().mockResolvedValue(undefined),
    };

    // Captura o input de criacao do pedido.
    createSpy = jest.fn().mockResolvedValue({ id: 'order-123', total_amount: 20 });
    const ordersService = { create: createSpy };

    // PIX nao e o foco desta task; so nao pode quebrar.
    const paymentsService = {
      createPayment: jest.fn().mockResolvedValue({
        qr_code: 'data:image/png;base64,AAA',
        copy_paste: '000201BR',
      }),
    };

    // updateContext: aplica os updates no contexto em memoria (merge raso, como o real).
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
    service.conversationService = conversationService;
    service.logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn(), debug: jest.fn() };
  });

  // Dirige a FSM passo-a-passo, roteando cada mensagem como o processByIntent faria:
  // "finalizar" inicia o checkout; as mensagens seguintes caem em handleCollectionStage.
  async function start(): Promise<string> {
    return service.handleCheckout(tenantId, phone, conversation);
  }
  async function step(message: string): Promise<string> {
    return service.handleCollectionStage(tenantId, message, conversation);
  }

  it('entrega: coleta endereco, mostra montado, confirma e cria pedido com delivery_address', async () => {
    // 1) checkout -> pergunta "Entrega ou retirada?"
    const r1 = await start();
    expect(String(r1).toLowerCase()).toMatch(/entrega|retirada/);
    expect(createSpy).not.toHaveBeenCalled();

    // 2) "entrega" -> bot pede o nome (identidade)
    await step('entrega');
    // 3) nome
    await step('Maria Souza');
    // 4) telefone
    await step('11988887777');
    // 5) endereco numa unica mensagem (poucas perguntas)
    const rAddr = await step(
      'Rua das Flores, 123, Centro, Sao Paulo, SP, 01001-000',
    );
    // bot MOSTRA o endereco montado e pede confirmacao
    expect(String(rAddr).toLowerCase()).toMatch(/confirm/);
    expect(String(rAddr)).toContain('Rua das Flores');
    // ainda NAO criou o pedido
    expect(createSpy).not.toHaveBeenCalled();

    // 6) "confirmar" -> cria o pedido
    await step('confirmar');

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_name: expect.any(String),
        delivery_type: 'delivery',
        delivery_address: expect.objectContaining({
          street: expect.any(String),
          number: expect.any(String),
          neighborhood: expect.any(String),
          city: expect.any(String),
          state: expect.any(String),
          zipcode: expect.any(String),
        }),
      }),
      tenantId,
    );
  });

  it('entrega: usuario rejeita o endereco montado -> recoleta, NAO cria pedido', async () => {
    await start();
    await step('entrega');
    await step('Maria Souza');
    await step('11988887777');
    await step('Rua das Flores, 123, Centro, Sao Paulo, SP, 01001-000');

    // usuario rejeita o endereco montado
    const r = await step('nao');

    // NAO pode ter criado o pedido
    expect(createSpy).not.toHaveBeenCalled();
    // e deve pedir o endereco de novo
    expect(String(r).toLowerCase()).toMatch(/endere/);
  });

  it('retirada: responde placeholder honesto e NAO cria pedido', async () => {
    await start();
    const r = await step('retirada');
    expect(createSpy).not.toHaveBeenCalled();
    expect(String(r).toLowerCase()).toMatch(/entrega/);
  });
});
