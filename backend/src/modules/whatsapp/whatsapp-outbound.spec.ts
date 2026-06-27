/**
 * Teste cirurgico do despacho de respostas (R1).
 * Prova que sendOutboundResponse REALMENTE chama o provider (antes so logava),
 * e que flattenOutboundResponse converte cada tipo de resposta em texto enviavel.
 *
 * Estrategia: instanciar WhatsappService sem o DI do Nest, passando apenas os
 * providers reais (mock) e stubs vazios para o resto — so exercitamos o metodo de envio.
 */
import { WhatsappService } from './whatsapp.service';
import { MockWhatsappProvider } from './providers/mock-whatsapp.provider';
import { ConfigService } from '@nestjs/config';

describe('WhatsappService.sendOutboundResponse (R1 - despacho real)', () => {
  let service: any;
  let mockProvider: MockWhatsappProvider;
  let sendMessageSpy: jest.SpyInstance;
  let sendButtonsSpy: jest.SpyInstance;

  beforeEach(() => {
    mockProvider = new MockWhatsappProvider();
    sendMessageSpy = jest.spyOn(mockProvider, 'sendMessage');
    sendButtonsSpy = jest.spyOn(mockProvider, 'sendInteractiveButtons');

    // ConfigService stub: sem WHATSAPP_PROVIDER=evolution -> usa mock
    const config = { get: (_key: string) => undefined } as unknown as ConfigService;

    // Construtor tem muitas deps, mas sendOutboundResponse so usa config + providers.
    // Passamos undefined para o resto (nao sao tocados neste caminho).
    const deps: any[] = new Array(30).fill(undefined);
    service = new (WhatsappService as any)(...deps);
    // Injeta manualmente os campos usados pelo metodo sob teste.
    (service as any).config = config;
    (service as any).evolutionProvider = { isConfigured: () => false, getProviderType: () => 'evolution' };
    (service as any).mockProvider = mockProvider;
  });

  it('envia texto simples pelo provider (nao apenas loga)', async () => {
    await service.sendOutboundResponse('5511999999999', 'Ola, tudo bem?');

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ to: '5511999999999', body: 'Ola, tudo bem?' }),
    );
  });

  it('nao envia nada quando a resposta e vazia', async () => {
    await service.sendOutboundResponse('5511999999999', '   ');
    expect(sendMessageSpy).not.toHaveBeenCalled();
    expect(sendButtonsSpy).not.toHaveBeenCalled();
  });

  it('envia mensagem com botoes via sendInteractiveButtons', async () => {
    await service.sendOutboundResponse('5511999999999', {
      kind: 'interactive_with_buttons',
      previewText: 'Seu carrinho',
      cartContent: 'Carrinho: 1x Brigadeiro - R$ 5,00',
      buttons: [
        { id: 'btn_finalize', title: 'Finalizar' },
        { id: 'btn_add', title: 'Adicionar mais' },
      ],
    });

    expect(sendButtonsSpy).toHaveBeenCalledTimes(1);
    const arg = sendButtonsSpy.mock.calls[0][0];
    expect(arg.to).toBe('5511999999999');
    expect(arg.body).toContain('Brigadeiro');
    expect(arg.buttons).toHaveLength(2);
  });

  it('degrada para texto quando o envio interativo falha', async () => {
    sendButtonsSpy.mockRejectedValueOnce(new Error('provider sem suporte a botoes'));

    await service.sendOutboundResponse('5511999999999', {
      kind: 'interactive_with_buttons',
      previewText: 'Seu carrinho',
      cartContent: 'Carrinho: 1x Bolo - R$ 30,00',
      buttons: [{ id: 'btn_finalize', title: 'Finalizar' }],
    });

    expect(sendButtonsSpy).toHaveBeenCalledTimes(1);
    // Apos falhar no interativo, deve cair para texto
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][0].body).toContain('Bolo');
  });

  it('converte lista interativa em texto legivel com itens', async () => {
    await service.sendOutboundResponse('5511999999999', {
      kind: 'interactive_list',
      previewText: 'Nosso cardapio',
      list: {
        sections: [
          {
            title: 'Doces',
            rows: [
              { id: 'p1', title: 'Brigadeiro', description: 'R$ 5,00' },
              { id: 'p2', title: 'Beijinho', description: 'R$ 5,00' },
            ],
          },
        ],
      },
    });

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    const body = sendMessageSpy.mock.calls[0][0].body;
    expect(body).toContain('Nosso cardapio');
    expect(body).toContain('Brigadeiro');
    expect(body).toContain('Beijinho');
  });

  it('monta o corpo do pedido com subtotal, frete e total', async () => {
    await service.sendOutboundResponse('5511999999999', {
      kind: 'interactive_order',
      previewText: 'Pedido #123',
      orderId: '123',
      items: '1x Brigadeiro',
      subtotal: 5,
      shipping: 10,
      total: 15,
      buttons: [{ id: 'btn_pay', title: 'Pagar' }],
    });

    // Tem botao -> vai por sendInteractiveButtons
    expect(sendButtonsSpy).toHaveBeenCalledTimes(1);
    const body = sendButtonsSpy.mock.calls[0][0].body;
    expect(body).toContain('Pedido #123');
    expect(body).toContain('Total: R$ 15.00');
  });
});
