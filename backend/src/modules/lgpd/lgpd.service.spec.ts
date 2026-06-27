import { LgpdService } from './lgpd.service';
import { LgpdRequestType, LgpdRequestStatus } from './dto/create-lgpd-request.dto';

/**
 * Cria um LgpdService com dependencias mockadas.
 * O mock de db permite testar tanto as solicitacoes (in-memory) quanto a
 * exclusao real por anonimizacao (L1).
 */
function buildService(opts?: {
  usuario?: any;
  pedidoAffected?: number;
  convAffected?: number;
}) {
  const usuarioRecord =
    opts?.usuario === undefined
      ? { id: 'user-1', tenant_id: 'tenant-1', full_name: 'Maria Silva', phone: '5511999999999' }
      : opts.usuario;

  const pedidoUpdateExec = jest.fn().mockResolvedValue({ affected: opts?.pedidoAffected ?? 2 });
  const convUpdateExec = jest.fn().mockResolvedValue({ affected: opts?.convAffected ?? 1 });
  let usuarioSaved: any;

  const makeUpdateBuilder = (exec: jest.Mock) => {
    const qb: any = {};
    qb.update = jest.fn().mockReturnValue(qb);
    qb.set = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.execute = exec;
    return qb;
  };

  let updateCall = 0;
  const manager = {
    query: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn().mockImplementation(() => {
      updateCall += 1;
      return makeUpdateBuilder(updateCall === 1 ? pedidoUpdateExec : convUpdateExec);
    }),
  };

  const usuarioRepo = {
    findOne: jest.fn().mockResolvedValue(usuarioRecord),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((u: any) => {
      usuarioSaved = u;
      return Promise.resolve(u);
    }),
  };

  const db = {
    runInTransaction: jest.fn().mockImplementation((fn: any) => fn(manager)),
    runWithManager: jest.fn().mockImplementation((_m: any, fn: any) => fn()),
    getRepository: jest.fn().mockReturnValue(usuarioRepo),
  };

  const auditLog = { log: jest.fn().mockResolvedValue(undefined) };

  const service = new LgpdService(db as any, auditLog as any);
  return { service, auditLog, pedidoUpdateExec, convUpdateExec, getUsuarioSaved: () => usuarioSaved };
}

describe('LgpdService', () => {
  describe('createRequest (solicitacoes)', () => {
    it('cria solicitacao de acesso com status pending', async () => {
      const { service } = buildService();
      const result = await service.createRequest(
        'tenant-1',
        'user-1',
        'user@example.com',
        LgpdRequestType.ACCESS,
        'Quero meus dados',
      );

      expect(result.id).toBeDefined();
      expect(result.tenant_id).toBe('tenant-1');
      expect(result.status).toBe(LgpdRequestStatus.PENDING);
      expect(result.details).toBe('Quero meus dados');
    });
  });

  describe('getRequestsByUser', () => {
    it('retorna apenas solicitacoes do usuario no tenant', async () => {
      const { service } = buildService();
      await service.createRequest('tenant-1', 'user-1', 'a@x.com', LgpdRequestType.ACCESS);
      await service.createRequest('tenant-1', 'user-2', 'b@x.com', LgpdRequestType.DELETION);
      await service.createRequest('tenant-2', 'user-1', 'a@x.com', LgpdRequestType.PORTABILITY);

      const results = await service.getRequestsByUser('tenant-1', 'user-1');
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe(LgpdRequestType.ACCESS);
    });
  });

  describe('getRequestById', () => {
    it('nao retorna solicitacao de outro tenant', async () => {
      const { service } = buildService();
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
      const { service } = buildService();
      expect(service.getDeadlineDays(LgpdRequestType.ACCESS)).toBe(15);
      expect(service.getDeadlineDays(LgpdRequestType.DELETION)).toBe(15);
    });
  });

  // ---------- L1: exclusao real por anonimizacao ----------
  describe('processDeletion (L1 - exclusao real)', () => {
    it('anonimiza pedidos, conversas e usuario, retornando a contagem', async () => {
      const { service, pedidoUpdateExec, convUpdateExec } = buildService();
      const result = await service.processDeletion('tenant-1', 'user-1', 'maria@email.com');

      expect(result.anonymizedOrders).toBe(2);
      expect(result.anonymizedConversations).toBe(1);
      expect(result.anonymizedUser).toBe(true);
      expect(pedidoUpdateExec).toHaveBeenCalledTimes(1);
      expect(convUpdateExec).toHaveBeenCalledTimes(1);
    });

    it('substitui o PII do usuario por marcador e remove telefone', async () => {
      const { service, getUsuarioSaved } = buildService();
      await service.processDeletion('tenant-1', 'user-1', 'maria@email.com');

      const saved = getUsuarioSaved();
      expect(saved.full_name).toContain('REMOVIDO');
      expect(saved.phone).toBeNull();
    });

    it('registra a exclusao no audit log como prova de cumprimento', async () => {
      const { service, auditLog } = buildService();
      await service.processDeletion('tenant-1', 'user-1', 'maria@email.com');

      expect(auditLog.log).toHaveBeenCalledTimes(1);
      const logArg = auditLog.log.mock.calls[0][0];
      expect(logArg.action).toBe('DELETE');
      expect(String(logArg.metadata.reason)).toContain('Art. 18');
    });

    it('marca solicitacoes de exclusao pendentes como concluidas', async () => {
      const { service } = buildService();
      await service.createRequest('tenant-1', 'user-1', 'maria@email.com', LgpdRequestType.DELETION);
      await service.processDeletion('tenant-1', 'user-1', 'maria@email.com');

      const requests = await service.getRequestsByUser('tenant-1', 'user-1');
      expect(requests[0].status).toBe(LgpdRequestStatus.COMPLETED);
      expect(requests[0].resolved_at).toBeDefined();
    });

    it('pula conversas quando o usuario nao tem telefone', async () => {
      const { service, convUpdateExec } = buildService({
        usuario: { id: 'user-1', tenant_id: 'tenant-1', full_name: 'Maria', phone: null },
      });
      const result = await service.processDeletion('tenant-1', 'user-1', 'maria@email.com');

      expect(result.anonymizedConversations).toBe(0);
      expect(convUpdateExec).not.toHaveBeenCalled();
      expect(result.anonymizedUser).toBe(true);
    });
  });
});
