import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from './tenants.service';
import { Tenant } from '../../database/entities/Tenant.entity';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
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

    it('deve lançar NotFoundException quando tenant não encontrado', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneById('tenant-invalido')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOneById('tenant-invalido')).rejects.toThrow(
        'Tenant com ID tenant-invalido não encontrado',
      );
    });

    it('deve lançar ForbiddenException quando tenant inativo', async () => {
      const inactiveTenant = { ...mockTenant, is_active: false };
      mockRepository.findOne.mockResolvedValue(inactiveTenant);

      await expect(service.findOneById('tenant-123')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.findOneById('tenant-123')).rejects.toThrow(
        'Tenant tenant-123 está inativo',
      );
    });
  });

  describe('validateWhatsAppNumber', () => {
    it('deve retornar true quando número está autorizado (exata)', async () => {
      mockRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.validateWhatsAppNumber(
        'tenant-123',
        '5511999999999',
      );

      expect(result).toBe(true);
    });

    it('deve retornar true quando número está autorizado (últimos 9 dígitos)', async () => {
      mockRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.validateWhatsAppNumber(
        'tenant-123',
        '999999999',
      );

      expect(result).toBe(true);
    });

    it('deve retornar true quando número está autorizado (últimos 11 dígitos)', async () => {
      mockRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.validateWhatsAppNumber(
        'tenant-123',
        '5511999999999',
      );

      expect(result).toBe(true);
    });

    it('deve retornar true em desenvolvimento quando números não configurados', async () => {
      const tenantSemNumeros = {
        ...mockTenant,
        settings: {},
      };
      mockRepository.findOne.mockResolvedValue(tenantSemNumeros);

      const result = await service.validateWhatsAppNumber(
        'tenant-123',
        '5511999999999',
      );

      expect(result).toBe(true); // Em desenvolvimento, permite
    });

    it('deve lançar ForbiddenException quando número não autorizado', async () => {
      mockRepository.findOne.mockResolvedValue(mockTenant);

      await expect(
        service.validateWhatsAppNumber('tenant-123', '5511777777777'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.validateWhatsAppNumber('tenant-123', '5511777777777'),
      ).rejects.toThrow('não está autorizado para este tenant');
    });

    it('deve lançar NotFoundException quando tenant não encontrado', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.validateWhatsAppNumber('tenant-invalido', '5511999999999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateTenantAndPhone', () => {
    it('deve retornar tenant quando validação passa', async () => {
      mockRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.validateTenantAndPhone(
        'tenant-123',
        '5511999999999',
      );

      expect(result).toEqual(mockTenant);
    });

    it('deve lançar exceção quando validação falha', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.validateTenantAndPhone('tenant-invalido', '5511999999999'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
