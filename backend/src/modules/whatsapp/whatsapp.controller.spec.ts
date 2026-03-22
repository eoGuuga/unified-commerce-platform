import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from '../tenants/tenants.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappController', () => {
  let controller: WhatsappController;
  let whatsappService: { processIncomingMessage: jest.Mock; sendMessage: jest.Mock };
  let tenantsService: {
    findOneById: jest.Mock;
    validateWhatsAppNumber: jest.Mock;
  };

  beforeEach(async () => {
    whatsappService = {
      processIncomingMessage: jest.fn().mockResolvedValue('ok'),
      sendMessage: jest.fn().mockResolvedValue(undefined),
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
    expect(whatsappService.sendMessage).toHaveBeenCalledWith('5511991234567', 'ok');
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

    expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    expect(response).toEqual({
      success: true,
      response: '',
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
});
