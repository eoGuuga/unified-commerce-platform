import { ConfigService } from '@nestjs/config';
import { DbContextService } from '../common/services/db-context.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('sends Evolution interactive lists with sections payload', async () => {
    process.env.WHATSAPP_PROVIDER = 'evolution';
    process.env.EVOLUTION_API_URL = 'http://evolution.local';
    process.env.EVOLUTION_API_KEY = 'test-key';
    process.env.EVOLUTION_INSTANCE = 'loucas-teste';

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => '',
    } as Response);

    const whatsappSenderMock = {
      sendText: jest.fn().mockResolvedValue(undefined),
      sendButtons: jest.fn().mockResolvedValue(undefined),
    };

    const service = new NotificationsService(
      {} as DbContextService,
      {
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as ConfigService,
      whatsappSenderMock as never,
    );

    await service.sendWhatsAppMessage({
      to: '5511999999999',
      message: 'Abri o cardapio interativo para voce.',
      interactiveList: {
        title: 'Cardapio da loja',
        description: 'Escolha uma categoria',
        buttonText: 'Abrir cardapio',
        footerText: 'Se preferir, digite o nome do item.',
        sections: [
          {
            title: 'Categorias',
            rows: [
              {
                id: 'catalog_category:docinhos',
                title: 'Docinhos',
                description: '4 itens com estoque ativo',
              },
            ],
          },
        ],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://evolution.local/message/sendList/loucas-teste',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'test-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          number: '5511999999999',
          title: 'Cardapio da loja',
          description: 'Escolha uma categoria',
          buttonText: 'Abrir cardapio',
          footerText: 'Se preferir, digite o nome do item.',
          sections: [
            {
              title: 'Categorias',
              rows: [
                {
                  title: 'Docinhos',
                  description: '4 itens com estoque ativo',
                  rowId: 'catalog_category:docinhos',
                },
              ],
            },
          ],
        }),
      }),
    );
  });
});
