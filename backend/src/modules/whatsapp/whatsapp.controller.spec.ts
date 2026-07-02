import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'crypto';
import { TenantsService } from '../tenants/tenants.service';
import {
  WhatsappController,
  normalizeMetaCloudPayload,
} from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappController', () => {
  let controller: WhatsappController;
  let whatsappService: {
    processIncomingMessage: jest.Mock;
    sendOutboundResponse: jest.Mock;
  };
  let tenantsService: {
    findOneById: jest.Mock;
    validateWhatsAppNumber: jest.Mock;
  };

  beforeEach(async () => {
    whatsappService = {
      processIncomingMessage: jest.fn().mockResolvedValue('ok'),
      sendOutboundResponse: jest.fn().mockResolvedValue(undefined),
    };

    tenantsService = {
      findOneById: jest.fn().mockResolvedValue({
        id: 'tenant-loucas',
        settings: {
          whatsappInstance: 'loucas-teste',
        },
      }),
      validateWhatsAppNumber: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappController],
      providers: [
        { provide: WhatsappService, useValue: whatsappService },
        { provide: TenantsService, useValue: tenantsService },
      ],
    }).compile();

    controller = module.get<WhatsappController>(WhatsappController);
  });

  afterEach(() => {
    delete process.env.WHATSAPP_IGNORED_PHONES;
  });

  it('processes a raw Evolution messages.upsert payload', async () => {
    const response = await controller.webhook(
      {
        event: 'messages.upsert',
        instance: 'loucas-teste',
        data: {
          key: {
            remoteJid: '5511991234567@s.whatsapp.net',
            fromMe: false,
            id: 'msg-1',
          },
          message: {
            conversation: 'Quero 2 brigadeiros',
          },
          messageTimestamp: 1711021200,
        },
      },
      'tenant-loucas',
    );

    expect(tenantsService.findOneById).toHaveBeenCalledWith('tenant-loucas');
    expect(tenantsService.validateWhatsAppNumber).not.toHaveBeenCalled();
    expect(whatsappService.processIncomingMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '5511991234567',
        body: 'Quero 2 brigadeiros',
        tenantId: 'tenant-loucas',
        messageId: 'msg-1',
        metadata: expect.objectContaining({
          webhookEvent: 'MESSAGES_UPSERT',
          whatsappInstance: 'loucas-teste',
        }),
      }),
    );
    expect(whatsappService.sendOutboundResponse).toHaveBeenCalledWith(
      '5511991234567',
      'ok',
      'tenant-loucas',
    );
    expect(response).toEqual({
      success: true,
      response: 'ok',
    });
  });

  it('does not dispatch an outbound message when the bot response is empty', async () => {
    whatsappService.processIncomingMessage.mockResolvedValueOnce('');

    const response = await controller.webhook(
      {
        event: 'messages.upsert',
        instance: 'loucas-teste',
        data: {
          key: {
            remoteJid: '5511991234567@s.whatsapp.net',
            fromMe: false,
            id: 'msg-empty',
          },
          message: {
            conversation: 'teste vazio',
          },
          messageTimestamp: 1711021200,
        },
      },
      'tenant-loucas',
    );

    expect(whatsappService.sendOutboundResponse).not.toHaveBeenCalled();
    expect(response).toEqual({
      success: true,
      response: '',
    });
  });

  it('dispatches an interactive catalog response when the bot returns a list payload', async () => {
    const interactiveResponse = {
      kind: 'interactive_list',
      previewText: 'Abri o cardapio interativo para voce.',
      list: {
        title: 'Cardapio da loja',
        description: 'Escolha uma categoria',
        buttonText: 'Abrir cardapio',
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
    };
    whatsappService.processIncomingMessage.mockResolvedValueOnce(interactiveResponse);

    const response = await controller.webhook(
      {
        event: 'messages.upsert',
        instance: 'loucas-teste',
        data: {
          key: {
            remoteJid: '5511991234567@s.whatsapp.net',
            fromMe: false,
            id: 'msg-list-1',
          },
          message: {
            conversation: 'cardapio',
          },
          messageTimestamp: 1711021200,
        },
      },
      'tenant-loucas',
    );

    expect(whatsappService.sendOutboundResponse).toHaveBeenCalledWith(
      '5511991234567',
      interactiveResponse,
      'tenant-loucas',
    );
    expect(response).toEqual({
      success: true,
      response: interactiveResponse,
    });
  });

  it('ignores non-message Evolution events', async () => {
    const response = await controller.webhook(
      {
        event: 'connection.update',
        instance: 'loucas-teste',
        data: {
          state: 'open',
        },
      },
      'tenant-loucas',
    );

    expect(response).toEqual({
      success: true,
      ignored: true,
      reason: 'evento CONNECTION_UPDATE ignorado',
    });
    expect(whatsappService.processIncomingMessage).not.toHaveBeenCalled();
  });

  it('ignores WhatsApp group messages', async () => {
    const response = await controller.webhook(
      {
        event: 'messages.upsert',
        instance: 'loucas-teste',
        data: {
          key: {
            remoteJid: '120363022222222222@g.us',
            participant: '5511991234567@s.whatsapp.net',
            fromMe: false,
          },
          message: {
            conversation: 'oi grupo',
          },
        },
      },
      'tenant-loucas',
    );

    expect(response).toEqual({
      success: true,
      ignored: true,
      reason: 'grupo ou broadcast ignorado',
    });
    expect(whatsappService.processIncomingMessage).not.toHaveBeenCalled();
  });

  it('ignores WhatsApp broadcast messages', async () => {
    const response = await controller.webhook(
      {
        event: 'messages.upsert',
        instance: 'loucas-teste',
        data: {
          key: {
            remoteJid: 'status@broadcast',
            fromMe: false,
          },
          message: {
            conversation: 'status update',
          },
        },
      },
      'tenant-loucas',
    );

    expect(response).toEqual({
      success: true,
      ignored: true,
      reason: 'grupo ou broadcast ignorado',
    });
    expect(whatsappService.processIncomingMessage).not.toHaveBeenCalled();
  });

  it('ignores configured blocked direct numbers', async () => {
    process.env.WHATSAPP_IGNORED_PHONES = '5511953511566';

    const response = await controller.webhook(
      {
        event: 'messages.upsert',
        instance: 'loucas-teste',
        data: {
          key: {
            remoteJid: '5511953511566@s.whatsapp.net',
            fromMe: false,
          },
          message: {
            conversation: 'oi',
          },
        },
      },
      'tenant-loucas',
    );

    expect(response).toEqual({
      success: true,
      ignored: true,
      reason: 'numero ignorado',
    });
    expect(whatsappService.processIncomingMessage).not.toHaveBeenCalled();
  });

  it('ignores direct self-messages that are not admin commands', async () => {
    const response = await controller.webhook(
      {
        event: 'messages.upsert',
        instance: 'loucas-teste',
        data: {
          key: {
            remoteJid: '5511991234567@s.whatsapp.net',
            fromMe: true,
          },
          message: {
            conversation: 'oi eu mesmo',
          },
        },
      },
      'tenant-loucas',
    );

    expect(response).toEqual({
      success: true,
      ignored: true,
      reason: 'mensagem propria ignorada',
    });
    expect(whatsappService.processIncomingMessage).not.toHaveBeenCalled();
  });

  it('allows direct self-messages that match the admin bot-control syntax', async () => {
    const response = await controller.webhook(
      {
        event: 'messages.upsert',
        instance: 'loucas-teste',
        data: {
          key: {
            remoteJid: '5511991234567@s.whatsapp.net',
            fromMe: true,
            id: 'msg-admin-1',
          },
          message: {
            conversation: 'bot 4321 status',
          },
          messageTimestamp: 1711021200,
        },
      },
      'tenant-loucas',
    );

    expect(whatsappService.processIncomingMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '5511991234567',
        body: 'bot 4321 status',
        tenantId: 'tenant-loucas',
      }),
    );
    expect(response).toEqual({
      success: true,
      response: 'ok',
    });
  });

  it('blocks messages from an unexpected Evolution instance', async () => {
    await expect(
      controller.webhook(
        {
          event: 'messages.upsert',
          instance: 'instancia-errada',
          data: {
            key: {
              remoteJid: '5511991234567@s.whatsapp.net',
              fromMe: false,
            },
            message: {
              conversation: 'oi',
            },
          },
        },
        'tenant-loucas',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(whatsappService.processIncomingMessage).not.toHaveBeenCalled();
  });

  it('falls back to phone validation when no Evolution instance is present', async () => {
    await controller.webhook(
      {
        tenantId: 'tenant-loucas',
        from: '5511988887777',
        body: 'oi',
      },
      undefined,
    );

    expect(tenantsService.validateWhatsAppNumber).toHaveBeenCalledWith(
      'tenant-loucas',
      '5511988887777',
    );
  });

  it('accepts phone as an alias for phoneNumber in the test endpoint', async () => {
    const response = await controller.test({
      message: 'oi',
      tenantId: 'tenant-loucas',
      phone: '5511977776666',
    });

    expect(tenantsService.findOneById).toHaveBeenCalledWith('tenant-loucas');
    expect(whatsappService.processIncomingMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '5511977776666',
        body: 'oi',
        tenantId: 'tenant-loucas',
      }),
    );
    expect(response).toEqual({
      success: true,
      request: 'oi',
      response: 'ok',
    });
  });

  // Peca 1 — GET verify (handshake do WhatsApp Cloud API / Meta)
  describe('GET webhook — verificacao da Meta', () => {
    const original = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    afterEach(() => {
      if (original === undefined) {
        delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
      } else {
        process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = original;
      }
    });

    it('ecoa o hub.challenge quando o verify_token bate com o do .env', () => {
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'segredo-doceria';
      const result = controller.verifyWebhook({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'segredo-doceria',
        'hub.challenge': '1158201444',
      });
      expect(result).toBe('1158201444');
    });

    it('rejeita (403) quando o verify_token nao bate', () => {
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'segredo-doceria';
      expect(() =>
        controller.verifyWebhook({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'errado',
          'hub.challenge': '1158201444',
        }),
      ).toThrow(ForbiddenException);
    });

    it('rejeita (403) quando nosso verify_token nao esta configurado', () => {
      delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
      expect(() =>
        controller.verifyWebhook({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'qualquer',
          'hub.challenge': '1158201444',
        }),
      ).toThrow(ForbiddenException);
    });

    it('rejeita (403) quando o hub.mode nao e subscribe', () => {
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'segredo-doceria';
      expect(() =>
        controller.verifyWebhook({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'segredo-doceria',
          'hub.challenge': '1158201444',
        }),
      ).toThrow(ForbiddenException);
    });
  });

  // Peca 2 — parser do formato aninhado da Meta (WhatsApp Cloud API)
  describe('normalizeMetaCloudPayload — formato da Meta', () => {
    const metaText = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_ID',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550001111',
                  phone_number_id: 'PNID-123',
                },
                contacts: [{ profile: { name: 'Ana' }, wa_id: '5511988887777' }],
                messages: [
                  {
                    from: '5511988887777',
                    id: 'wamid.ABC',
                    timestamp: '1730000000',
                    type: 'text',
                    text: { body: 'oi' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    it('achata mensagem de texto da Meta para From/Body/MessageSid', () => {
      const { body, ignore } = normalizeMetaCloudPayload(metaText as any);
      expect(ignore).toBeFalsy();
      expect(body.From).toBe('5511988887777');
      expect(body.Body).toBe('oi');
      expect(body.MessageSid).toBe('wamid.ABC');
      expect((body.metadata as any).phoneNumberId).toBe('PNID-123');
    });

    it('ignora recibo de status (statuses, sem messages)', () => {
      const receipt = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  statuses: [
                    { id: 'wamid.X', status: 'delivered', recipient_id: '5511988887777' },
                  ],
                },
              },
            ],
          },
        ],
      };
      const res = normalizeMetaCloudPayload(receipt as any);
      expect(res.ignore).toBe(true);
      expect(res.reason).toBe('meta_status_receipt');
    });

    it('resposta interativa (list_reply) vira o id da opcao no Body', () => {
      const interactive = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '5511988887777',
                      id: 'wamid.INT',
                      type: 'interactive',
                      interactive: {
                        type: 'list_reply',
                        list_reply: { id: 'prod-42', title: 'Brigadeiro' },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const { body } = normalizeMetaCloudPayload(interactive as any);
      expect(body.Body).toBe('prod-42');
      expect(body.From).toBe('5511988887777');
    });

    it('payload NAO-Meta (Evolution) passa intacto', () => {
      const evo = {
        event: 'messages.upsert',
        data: { key: { remoteJid: '5511991234567@s.whatsapp.net' } },
      };
      const res = normalizeMetaCloudPayload(evo as any);
      expect(res.ignore).toBeFalsy();
      expect(res.body).toBe(evo);
    });

    it('via webhook: texto da Meta chega no processIncomingMessage', async () => {
      await controller.webhook(metaText as any, 'tenant-loucas');
      expect(whatsappService.processIncomingMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '5511988887777',
          body: 'oi',
          tenantId: 'tenant-loucas',
        }),
      );
    });
  });

  // Peca 3 — assinatura HMAC sobre o corpo CRU (como a Meta assina de verdade)
  describe('POST webhook — HMAC por raw-body', () => {
    const OLD_ENV = process.env.NODE_ENV;
    const OLD_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET;
    afterEach(() => {
      process.env.NODE_ENV = OLD_ENV;
      if (OLD_SECRET === undefined) {
        delete process.env.WHATSAPP_WEBHOOK_SECRET;
      } else {
        process.env.WHATSAPP_WEBHOOK_SECRET = OLD_SECRET;
      }
    });

    const sign = (raw: string, secret: string): string =>
      'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');

    it('aceita quando a assinatura bate com o RAW body (nao com JSON.stringify)', async () => {
      process.env.NODE_ENV = 'production';
      process.env.WHATSAPP_WEBHOOK_SECRET = 'app-secret-teste';
      // Espacos/ordem que JSON.stringify(body) NAO reproduz -> so o raw bate.
      const raw = '{"from":"5511988887777" ,  "body":"oi"}';
      const req = { rawBody: Buffer.from(raw, 'utf8') } as any;
      const res: any = await controller.webhook(
        JSON.parse(raw),
        'tenant-loucas',
        sign(raw, 'app-secret-teste'),
        req,
      );
      expect(res.success).toBe(true);
      expect(whatsappService.processIncomingMessage).toHaveBeenCalled();
    });

    it('rejeita (403) quando a assinatura nao bate', async () => {
      process.env.NODE_ENV = 'production';
      process.env.WHATSAPP_WEBHOOK_SECRET = 'app-secret-teste';
      const raw = '{"from":"5511988887777","body":"oi"}';
      const req = { rawBody: Buffer.from(raw, 'utf8') } as any;
      await expect(
        controller.webhook(JSON.parse(raw), 'tenant-loucas', 'sha256=deadbeef', req),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejeita (403) em producao sem WHATSAPP_WEBHOOK_SECRET (fail-closed)', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.WHATSAPP_WEBHOOK_SECRET;
      const raw = '{"from":"5511988887777","body":"oi"}';
      const req = { rawBody: Buffer.from(raw, 'utf8') } as any;
      await expect(
        controller.webhook(JSON.parse(raw), 'tenant-loucas', 'sha256=whatever', req),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
