import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LgpdService } from './lgpd.service';
import { LgpdRequestType, LgpdRequestStatus } from './dto/create-lgpd-request.dto';

describe('LgpdService', () => {
  let service: LgpdService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LgpdService],
    }).compile();

    service = module.get<LgpdService>(LgpdService);
  });

  describe('createRequest', () => {
    it('cria solicitacao de acesso com status pending', async () => {
      const result = await service.createRequest(
        'tenant-1',
        'user-1',
        'user@example.com',
        LgpdRequestType.ACCESS,
        'Quero meus dados',
      );

      expect(result.id).toBeDefined();
      expect(result.tenant_id).toBe('tenant-1');
      expect(result.user_id).toBe('user-1');
      expect(result.user_email).toBe('user@example.com');
      expect(result.type).toBe(LgpdRequestType.ACCESS);
      expect(result.status).toBe(LgpdRequestStatus.PENDING);
      expect(result.details).toBe('Quero meus dados');
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('cria solicitacao sem detalhes opcionais', async () => {
      const result = await service.createRequest(
        'tenant-1',
        'user-1',
        'user@example.com',
        LgpdRequestType.DELETION,
      );

      expect(result.type).toBe(LgpdRequestType.DELETION);
      expect(result.details).toBeUndefined();
    });
  });

  describe('getRequestsByUser', () => {
    it('retorna apenas solicitacoes do usuario no tenant', async () => {
      await service.createRequest('tenant-1', 'user-1', 'a@x.com', LgpdRequestType.ACCESS);
      await service.createRequest('tenant-1', 'user-2', 'b@x.com', LgpdRequestType.DELETION);
      await service.createRequest('tenant-2', 'user-1', 'a@x.com', LgpdRequestType.PORTABILITY);

      const results = await service.getRequestsByUser('tenant-1', 'user-1');

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe(LgpdRequestType.ACCESS);
    });
  });

  describe('getRequestsByTenant', () => {
    it('retorna todas solicitacoes do tenant', async () => {
      await service.createRequest('tenant-1', 'user-1', 'a@x.com', LgpdRequestType.ACCESS);
      await service.createRequest('tenant-1', 'user-2', 'b@x.com', LgpdRequestType.DELETION);
      await service.createRequest('tenant-2', 'user-3', 'c@x.com', LgpdRequestType.CORRECTION);

      const results = await service.getRequestsByTenant('tenant-1');

      expect(results).toHaveLength(2);
    });
  });

  describe('getRequestById', () => {
    it('retorna solicitacao quando encontrada no tenant', async () => {
      const created = await service.createRequest(
        'tenant-1',
        'user-1',
        'a@x.com',
        LgpdRequestType.REVOCATION,
      );

      const result = await service.getRequestById('tenant-1', created.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(created.id);
    });

    it('retorna undefined para id inexistente', async () => {
      const result = await service.getRequestById('tenant-1', 'nao-existe');

      expect(result).toBeUndefined();
    });

    it('nao retorna solicitacao de outro tenant', async () => {
      const created = await service.createRequest(
        'tenant-1',
        'user-1',
        'a@x.com',
        LgpdRequestType.ACCESS,
      );

      const result = await service.getRequestById('tenant-2', created.id);

      expect(result).toBeUndefined();
    });
  });

  describe('getDeadlineDays', () => {
    it('retorna 15 dias para todos os tipos (prazo LGPD)', () => {
      expect(service.getDeadlineDays(LgpdRequestType.ACCESS)).toBe(15);
      expect(service.getDeadlineDays(LgpdRequestType.CORRECTION)).toBe(15);
      expect(service.getDeadlineDays(LgpdRequestType.DELETION)).toBe(15);
      expect(service.getDeadlineDays(LgpdRequestType.PORTABILITY)).toBe(15);
      expect(service.getDeadlineDays(LgpdRequestType.REVOCATION)).toBe(15);
    });
  });
});
