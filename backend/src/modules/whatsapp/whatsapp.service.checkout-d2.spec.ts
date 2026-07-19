import { WhatsappService } from './whatsapp.service';

/**
 * Fatia 4 / Passo 1 — a INVARIANTE D2, provada empiricamente (antes só vivia
 * no docstring :937-939): "o pedido SÓ é criado no estágio confirming_address
 * APÓS o cliente responder sim/confirmar; rejeição volta pra collecting_address
 * e NÃO cria pedido."
 *
 * A Fatia 4 inteira depende disto: iniciar checkout (start_checkout) é seguro
 * PORQUE fechar exige confirmação interna da FSM. Se alguém quebrar a D2 no
 * futuro, este arquivo fica vermelho.
 *
 * Entra pela PORTA DA FRENTE do turno de coleta (handleCollectionStage — o alvo
 * do intent 'collection'), nunca pela FSM direto (regra do projeto).
 */
function buildService(overrides: Record<string, unknown> = {}): any {
  const service: any = new (WhatsappService as any)(...new Array(40).fill(undefined));
  Object.assign(service, overrides);
  return service;
}

const PHONE = '5511999998888';

function checkoutAtConfirmingAddress(): any {
  return {
    id: 'c1',
    customer_phone: PHONE,
    context: {
      state: 'collecting_order',
      checkout: {
        stage: 'confirming_address',
        delivery_type: 'delivery',
        customer_phone: PHONE,
        delivery_address: {
          street: 'Rua A', number: '1', neighborhood: 'Centro',
          city: 'SP', state: 'SP', zipcode: '01000-000',
        },
      },
    },
  };
}

function harness() {
  const create = jest.fn().mockResolvedValue({ id: 'o1', order_no: 'PED-1', total_amount: 20 });
  const updateContext = jest.fn().mockResolvedValue(undefined);
  const service = buildService({
    conversationService: { updateContext },
    ordersService: { create },
    cartService: {
      getOrCreateCart: jest.fn().mockResolvedValue({
        id: 'cart1',
        items: [{ produto_id: 'p1', quantity: 2, unit_price: 10 }],
        shipping_amount: 0, discount_amount: 0, coupon_code: null,
      }),
      markAsConverted: jest.fn().mockResolvedValue(undefined),
    },
    paymentsService: {
      // Sem qr_code de propósito: pula o envio de imagem (best-effort) no finalize.
      createPayment: jest.fn().mockResolvedValue({ pagamento: { amount: 19 }, copy_paste: 'chave-pix' }),
    },
  });
  return { service, create, updateContext };
}

describe('WhatsappService — INVARIANTE D2: pedido só nasce com confirmação explícita', () => {
  it('🎯 D2: rejeição no confirming_address → NENHUM pedido criado + volta pra collecting_address', async () => {
    const { service, create, updateContext } = harness();
    const conv = checkoutAtConfirmingAddress();

    const res = await service.handleCollectionStage('t1', 'não, o endereço tá errado', conv);

    expect(create).not.toHaveBeenCalled(); // o coração da D2
    expect(String(res)).toContain('corrigir');
    expect(updateContext).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        checkout: expect.objectContaining({ stage: 'collecting_address' }),
      }),
    );
  });

  it('🎯 D2: resposta NEUTRA (nem sim nem não) → NENHUM pedido criado', async () => {
    const { service, create } = harness();
    const conv = checkoutAtConfirmingAddress();

    await service.handleCollectionStage('t1', 'hmm deixa eu pensar', conv);

    expect(create).not.toHaveBeenCalled();
  });

  it('controle-positivo: "sim" no confirming_address → ordersService.create É chamado (o teste dirige o caminho real)', async () => {
    const { service, create } = harness();
    const conv = checkoutAtConfirmingAddress();

    await service.handleCollectionStage('t1', 'sim', conv);

    expect(create).toHaveBeenCalledTimes(1);
    // O pedido nasce dos dados do CARRINHO (code-owned), nunca de texto da IA.
    expect(create.mock.calls[0][0].items).toEqual([
      { produto_id: 'p1', quantity: 2, unit_price: 10 },
    ]);
  });
});
