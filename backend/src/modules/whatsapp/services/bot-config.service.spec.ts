import { Test, TestingModule } from '@nestjs/testing';
import { BotConfigService } from './bot-config.service';
import { TenantsService } from '../../tenants/tenants.service';

describe('BotConfigService', () => {
  let service: BotConfigService;
  let findOneById: jest.Mock;

  beforeEach(async () => {
    findOneById = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotConfigService,
        { provide: TenantsService, useValue: { findOneById } },
      ],
    }).compile();

    service = module.get<BotConfigService>(BotConfigService);
  });

  describe('loadConfig — business hours as single source', () => {
    it('(a) derives store.business_hours (prompt string) from settings.business_hours (per-day object)', async () => {
      findOneById.mockResolvedValue({
        name: 'Doceria da Ana',
        settings: {
          business_hours: {
            tz: 'America/Sao_Paulo',
            days: {
              '1': { open: '09:00', close: '18:00' },
              '2': { open: '09:00', close: '18:00' },
              '3': { open: '09:00', close: '18:00' },
              '4': { open: '09:00', close: '18:00' },
              '5': { open: '09:00', close: '18:00' },
              '6': { open: '09:00', close: '13:00' },
            },
          },
          // Legacy free-string on the bot config MUST be ignored (single source).
          whatsapp_bot: {
            store: { business_hours: 'STRING LIVRE ANTIGA — NAO USAR' },
          },
        },
      });

      const config = await service.loadConfig('tenant-1');

      // Derived from describeBusinessHours(): groups contiguous same-range days.
      expect(config.store.business_hours).toContain('seg');
      expect(config.store.business_hours).toContain('sáb 09:00-13:00');
      // Must NOT read the old free string.
      expect(config.store.business_hours).not.toContain('STRING LIVRE ANTIGA');
    });

    it('(b) KEY: without settings.business_hours → store.business_hours is EMPTY and never the hardcoded default', async () => {
      findOneById.mockResolvedValue({
        name: 'Loja sem horario',
        settings: {},
      });

      const config = await service.loadConfig('tenant-1');

      // The hardcoded default 'Seg-Sex 9h-18h' must be gone: bot does not assert hours.
      expect(config.store.business_hours).toBe('');
      expect(config.store.business_hours).not.toContain('Seg-Sex 9h-18h');
    });

    it('(c) derives store.name/description from settings.store_name/settings.description', async () => {
      findOneById.mockResolvedValue({
        name: 'Nome do Tenant',
        settings: {
          store_name: 'Doceria Canonica',
          description: 'A melhor doceria da cidade',
        },
      });

      const config = await service.loadConfig('tenant-1');

      expect(config.store.name).toBe('Doceria Canonica');
      expect(config.store.description).toBe('A melhor doceria da cidade');
    });

    it('(c) falls back store.name to tenant.name when settings.store_name absent', async () => {
      findOneById.mockResolvedValue({
        name: 'Nome do Tenant',
        settings: {},
      });

      const config = await service.loadConfig('tenant-1');

      expect(config.store.name).toBe('Nome do Tenant');
    });
  });

  describe('loadConfig — payment_methods wired to settings.metodos', () => {
    it('(d) KEY: derives store.payment_methods from settings.metodos (what the shopkeeper marked)', async () => {
      findOneById.mockResolvedValue({
        name: 'Doceria da Ana',
        settings: {
          // Distinct from DEFAULT_STORE.payment_methods (['pix','dinheiro']) so a
          // passing assertion proves settings.metodos was READ, not the default.
          metodos: ['pix', 'cartao'],
        },
      });

      const config = await service.loadConfig('tenant-1');

      // The screen saves settings.metodos; it MUST reach the bot (prompt via
      // llm-router / action-executor). Before the fix this array was ignored.
      expect(config.store.payment_methods).toEqual(['pix', 'cartao']);
    });

    it('(d) falls back to default payment_methods when settings.metodos absent', async () => {
      findOneById.mockResolvedValue({
        name: 'Loja sem metodos',
        settings: {},
      });

      const config = await service.loadConfig('tenant-1');

      expect(config.store.payment_methods).toEqual(['pix', 'dinheiro']);
    });

    it('(d) falls back to default when settings.metodos is an empty array', async () => {
      findOneById.mockResolvedValue({
        name: 'Loja metodos vazio',
        settings: { metodos: [] },
      });

      const config = await service.loadConfig('tenant-1');

      expect(config.store.payment_methods).toEqual(['pix', 'dinheiro']);
    });
  });
});
