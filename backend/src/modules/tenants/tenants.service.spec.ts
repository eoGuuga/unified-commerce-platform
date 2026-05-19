import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { Tenant } from '../../database/entities/Tenant.entity';
import { DbContextService } from '../common/services/db-context.service';

describe('TenantsService', () => {
  let service: TenantsService;

  const mockTenant: Tenant = {
    id: 'tenant-123',
    name: 'Test Tenant',
    slug: 'test-tenant',
    owner_id: undefined,
    settings: {
      whatsappNumbers: ['5511999999999', '5511888888888'],
    },
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    usuarios: [],
    produtos: [],
  };

  const mockRepository = {
    findOne: jest.fn(),
  };

  const mockDbContextService = {
    getRepository: jest.fn(() => mockRepository),
    runInTransaction: jest.fn(async (callback) => {
      const mockManager = {
        query: jest.fn().mockResolvedValue(undefined),
        getRepository: jest.fn(() => mockRepository),
      };
      return callback(mockManager as any);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: DbContextService,
          useValue: mockDbContextService,
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOneById', () => {
    it('deve retornar tenant quando encontrado e ativo', async () => {
      mockRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.findOneById('tenant-123');

      expect(result).toEqual(mockTenant);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
      });
    });

    it('deve lancar NotFoundException quando tenant nao encontrado', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneById('tenant-invalido')).rejects.toThrow(NotFoundException);
      await expect(service.findOneById('tenant-invalido')).rejects.toThrow(
        'Tenant com ID tenant-invalido não encontrado',
      );
    });

    it('deve lancar ForbiddenException quando tenant inativo', async () => {
      const inactiveTenant = { ...mockTenant, is_active: false };
      mockRepository.findOne.mockResolvedValue(inactiveTenant);

      await expect(service.findOneById('tenant-123')).rejects.toThrow(ForbiddenException);
      await expect(service.findOneById('tenant-123')).rejects.toThrow(
        'Tenant tenant-123 está inativo',
      );
    });
  });

  describe('validateWhatsAppNumber', () => {
    it('deve retornar true quando numero esta autorizado (exata)', async () => {
      mockRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.validateWhatsAppNumber('tenant-123', '5511999999999');

      expect(result).toBe(true);
    });

    it('deve retornar true quando numero esta autorizado (ultimos 9 digitos)', async () => {
      mockRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.validateWhatsAppNumber('tenant-123', '999999999');

      expect(result).toBe(true);
    });

    it('deve retornar true quando numero esta autorizado (ultimos 11 digitos)', async () => {
      mockRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.validateWhatsAppNumber('tenant-123', '5511999999999');

      expect(result).toBe(true);
    });

    it('deve retornar true em desenvolvimento quando numeros nao configurados', async () => {
      const tenantSemNumeros = {
        ...mockTenant,
        settings: {},
      };
      mockRepository.findOne.mockResolvedValue(tenantSemNumeros);

      const result = await service.validateWhatsAppNumber('tenant-123', '5511999999999');

      expect(result).toBe(true);
    });

    it('deve lancar ForbiddenException quando numero nao autorizado', async () => {
      mockRepository.findOne.mockResolvedValue(mockTenant);

      await expect(
        service.validateWhatsAppNumber('tenant-123', '5511777777777'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.validateWhatsAppNumber('tenant-123', '5511777777777'),
      ).rejects.toThrow('nao esta autorizado para este tenant');
    });

    it('deve lancar NotFoundException quando tenant nao encontrado', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.validateWhatsAppNumber('tenant-invalido', '5511999999999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateTenantAndPhone', () => {
    it('deve retornar tenant quando validacao passa', async () => {
      mockRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.validateTenantAndPhone('tenant-123', '5511999999999');

      expect(result).toEqual(mockTenant);
    });

    it('deve lancar excecao quando validacao falha', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.validateTenantAndPhone('tenant-invalido', '5511999999999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSettings', () => {
    it('deve mesclar novas configuracoes sem perder as existentes', async () => {
      mockRepository.findOne
        .mockResolvedValueOnce({ ...mockTenant })
        .mockResolvedValueOnce({
          ...mockTenant,
          settings: {
            ...mockTenant.settings,
            whatsappBotEnabled: false,
            whatsappBotControlCode: '4321',
          },
        });

      const result = await service.updateSettings('tenant-123', {
        whatsappBotEnabled: false,
        whatsappBotControlCode: '4321',
      });

      expect(mockDbContextService.runInTransaction).toHaveBeenCalled();
      expect(result.settings).toEqual(
        expect.objectContaining({
          whatsappNumbers: ['5511999999999', '5511888888888'],
          whatsappBotEnabled: false,
          whatsappBotControlCode: '4321',
        }),
      );
    });
  });

  describe('createTenantWithAdmin', () => {
    const signupDto = {
      company_name: 'Padaria do Joao',
      slug: 'padaria-do-joao',
      admin_email: 'joao@padaria.com',
      admin_password: 'senhaSegura123',
      admin_name: 'Joao Silva',
    };

    it('cria tenant e admin com sucesso quando slug e email sao unicos', async () => {
      const savedTenant = { id: 'new-tenant-uuid', name: signupDto.company_name, slug: signupDto.slug };
      const savedAdmin = { id: 'new-admin-uuid', email: signupDto.admin_email, full_name: signupDto.admin_name, role: 'admin' };

      const tenantRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(savedTenant),
        save: jest.fn().mockResolvedValue(savedTenant),
        update: jest.fn().mockResolvedValue(undefined),
      };

      const userRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(savedAdmin),
        save: jest.fn().mockResolvedValue(savedAdmin),
      };

      mockDbContextService.runInTransaction.mockImplementation(async (callback) => {
        const manager = {
          query: jest.fn().mockResolvedValue(undefined),
          getRepository: jest.fn((entity: any) => {
            const name = typeof entity === 'function' ? entity.name : entity;
            return name === 'Tenant' ? tenantRepo : userRepo;
          }),
        };
        return callback(manager as any);
      });

      const result = await service.createTenantWithAdmin(signupDto);

      expect(result.tenant.id).toBe('new-tenant-uuid');
      expect(result.tenant.slug).toBe('padaria-do-joao');
      expect(result.admin.email).toBe('joao@padaria.com');
      expect(result.admin.role).toBe('admin');
      expect(tenantRepo.update).toHaveBeenCalledWith('new-tenant-uuid', { owner_id: 'new-admin-uuid' });
    });

    it('lanca ConflictException se slug ja esta em uso', async () => {
      const tenantRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 'existing', slug: signupDto.slug }),
      };

      mockDbContextService.runInTransaction.mockImplementation(async (callback) => {
        const manager = {
          query: jest.fn(),
          getRepository: jest.fn(() => tenantRepo),
        };
        return callback(manager as any);
      });

      await expect(service.createTenantWithAdmin(signupDto)).rejects.toThrow(ConflictException);
      await expect(service.createTenantWithAdmin(signupDto)).rejects.toThrow('ja esta em uso');
    });

    it('lanca ConflictException se email ja existe no tenant criado', async () => {
      const savedTenant = { id: 'new-tenant-uuid', name: signupDto.company_name, slug: signupDto.slug };

      const tenantRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(savedTenant),
        save: jest.fn().mockResolvedValue(savedTenant),
      };

      const userRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 'existing-user' }),
      };

      mockDbContextService.runInTransaction.mockImplementation(async (callback) => {
        const manager = {
          query: jest.fn(),
          getRepository: jest.fn((entity: any) => {
            const name = typeof entity === 'function' ? entity.name : entity;
            return name === 'Tenant' ? tenantRepo : userRepo;
          }),
        };
        return callback(manager as any);
      });

      await expect(service.createTenantWithAdmin(signupDto)).rejects.toThrow(ConflictException);
      await expect(service.createTenantWithAdmin(signupDto)).rejects.toThrow('ja cadastrado');
    });
  });
});
