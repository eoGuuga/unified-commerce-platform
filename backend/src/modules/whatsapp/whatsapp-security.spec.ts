/**
 * Testes das protecoes de seguranca do WhatsappController (Sprint Cofre).
 * Provam o comportamento FAIL-CLOSED em producao:
 *  - S1: webhook exige secret + assinatura valida em prod
 *  - S3: /whatsapp/test bloqueado em prod
 *  - S4: /whatsapp/metrics exige API key sempre
 */
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from '../tenants/tenants.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappController — protecoes de seguranca (Sprint Cofre)', () => {
  let controller: WhatsappController;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(async () => {
    const whatsappService = {
      processIncomingMessage: jest.fn().mockResolvedValue('ok'),
      sendOutboundResponse: jest.fn().mockResolvedValue(undefined),
      getAnalytics: jest.fn().mockResolvedValue({ total: 0 }),
    };
    const tenantsService = {
      findOneById: jest.fn().mockResolvedValue({ id: 't1', settings: {} }),
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
    process.env = { ...ORIGINAL_ENV };
  });

  // ---------- S1: webhook fail-closed ----------
  describe('S1 - webhook WhatsApp fail-closed em producao', () => {
    it('bloqueia quando NODE_ENV=production e WHATSAPP_WEBHOOK_SECRET ausente', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.WHATSAPP_WEBHOOK_SECRET;

      await expect(
        controller.webhook({ from: '5511999999999', body: 'oi' } as any, 't1', undefined),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('bloqueia quando ha secret mas a assinatura esta ausente em producao', async () => {
      process.env.NODE_ENV = 'production';
      process.env.WHATSAPP_WEBHOOK_SECRET = 'um-secret-bem-grande-1234567890';

      await expect(
        controller.webhook({ from: '5511999999999', body: 'oi' } as any, 't1', undefined),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('bloqueia quando a assinatura e invalida em producao', async () => {
      process.env.NODE_ENV = 'production';
      process.env.WHATSAPP_WEBHOOK_SECRET = 'um-secret-bem-grande-1234567890';

      await expect(
        controller.webhook(
          { from: '5511999999999', body: 'oi' } as any,
          't1',
          'sha256=assinatura-invalida',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ---------- S3: /test bloqueado em prod ----------
  describe('S3 - /whatsapp/test bloqueado em producao', () => {
    it('lanca ForbiddenException em producao', async () => {
      process.env.NODE_ENV = 'production';
      await expect(
        controller.test({ message: 'oi', tenantId: 't1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('permite fora de producao', async () => {
      process.env.NODE_ENV = 'test';
      const res = await controller.test({ message: 'oi', tenantId: 't1' });
      expect(res.success).toBe(true);
    });
  });

  // ---------- S4: /metrics exige API key ----------
  describe('S4 - /whatsapp/metrics exige API key sempre', () => {
    it('bloqueia (Forbidden) quando WHATSAPP_METRICS_API_KEY nao esta configurada', async () => {
      delete process.env.WHATSAPP_METRICS_API_KEY;
      await expect(controller.getMetrics('t1', '7', 'qualquer')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('bloqueia (Unauthorized) quando a API key enviada e invalida', async () => {
      process.env.WHATSAPP_METRICS_API_KEY = 'chave-correta-123456';
      await expect(controller.getMetrics('t1', '7', 'chave-errada')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('permite quando a API key confere', async () => {
      process.env.WHATSAPP_METRICS_API_KEY = 'chave-correta-123456';
      const res = await controller.getMetrics('t1', '7', 'chave-correta-123456');
      expect(res.success).toBe(true);
    });
  });
});
