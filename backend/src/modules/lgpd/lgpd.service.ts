import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LgpdRequestType, LgpdRequestStatus } from './dto/create-lgpd-request.dto';
import { DbContextService } from '../common/services/db-context.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { Pedido } from '../../database/entities/Pedido.entity';
import { Usuario } from '../../database/entities/Usuario.entity';
import { WhatsappConversation } from '../../database/entities/WhatsappConversation.entity';

export interface LgpdRequest {
  id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  type: LgpdRequestType;
  status: LgpdRequestStatus;
  details?: string;
  created_at: Date;
  resolved_at?: Date;
}

/**
 * Resultado de uma operacao de exclusao/anonimizacao LGPD.
 */
export interface LgpdDeletionResult {
  anonymizedOrders: number;
  anonymizedConversations: number;
  anonymizedUser: boolean;
}

/**
 * Valor usado para substituir PII na anonimizacao.
 * Mantemos o registro (pedido) por obrigacao fiscal (nota fiscal por 5 anos),
 * mas removemos o dado pessoal — abordagem padrao LGPD para comercio.
 */
const ANON = 'REMOVIDO (LGPD)';

@Injectable()
export class LgpdService {
  private readonly logger = new Logger(LgpdService.name);
  private readonly requests: LgpdRequest[] = [];

  constructor(
    private readonly db: DbContextService,
    private readonly auditLog: AuditLogService,
  ) {}

  async createRequest(
    tenantId: string,
    userId: string,
    userEmail: string,
    type: LgpdRequestType,
    details?: string,
  ): Promise<LgpdRequest> {
    const request: LgpdRequest = {
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: userId,
      user_email: userEmail,
      type,
      status: LgpdRequestStatus.PENDING,
      details,
      created_at: new Date(),
    };

    this.requests.push(request);

    this.logger.log(
      `Solicitacao LGPD criada: ${request.id} tipo=${type} usuario=${userEmail} tenant=${tenantId}`,
    );

    return request;
  }

  async getRequestsByUser(tenantId: string, userId: string): Promise<LgpdRequest[]> {
    return this.requests.filter(
      (r) => r.tenant_id === tenantId && r.user_id === userId,
    );
  }

  async getRequestsByTenant(tenantId: string): Promise<LgpdRequest[]> {
    return this.requests.filter((r) => r.tenant_id === tenantId);
  }

  async getRequestById(tenantId: string, requestId: string): Promise<LgpdRequest | undefined> {
    return this.requests.find(
      (r) => r.tenant_id === tenantId && r.id === requestId,
    );
  }

  getDeadlineDays(type: LgpdRequestType): number {
    switch (type) {
      case LgpdRequestType.ACCESS:
      case LgpdRequestType.PORTABILITY:
        return 15;
      case LgpdRequestType.CORRECTION:
      case LgpdRequestType.DELETION:
      case LgpdRequestType.REVOCATION:
        return 15;
    }
  }

  /**
   * Exporta todos os dados pessoais do titular (Art. 18, II — direito de acesso/portabilidade).
   * Retorna um objeto com os dados que o sistema guarda sobre o usuario e seus pedidos.
   */
  async exportPersonalData(
    tenantId: string,
    userId: string,
    userEmail: string,
  ): Promise<Record<string, unknown>> {
    return this.db.runInTransaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      return this.db.runWithManager(manager, async () => {
        const usuario = await this.db.getRepository(Usuario).findOne({
          where: { id: userId, tenant_id: tenantId },
        });

        const pedidos = await this.db.getRepository(Pedido).find({
          where: [
            { tenant_id: tenantId, customer_email: userEmail },
          ],
        });

        return {
          exportadoEm: new Date().toISOString(),
          usuario: usuario
            ? {
                id: usuario.id,
                email: usuario.email,
                nome: usuario.full_name,
                telefone: usuario.phone,
                criadoEm: usuario.created_at,
              }
            : null,
          pedidos: pedidos.map((p) => ({
            id: p.id,
            numero: p.order_no,
            nome: p.customer_name,
            email: p.customer_email,
            telefone: p.customer_phone,
            total: p.total_amount,
            criadoEm: p.created_at,
          })),
        };
      });
    });
  }

  /**
   * Executa a exclusao (anonimizacao) dos dados pessoais do titular — Art. 18, VI.
   *
   * Estrategia: ANONIMIZAR, nao apagar. Substitui nome/email/telefone por marcador,
   * preservando o registro do pedido para obrigacao fiscal (nota por 5 anos).
   * Tudo em transacao + registrado no audit log (prova de cumprimento).
   */
  async processDeletion(
    tenantId: string,
    userId: string,
    userEmail: string,
  ): Promise<LgpdDeletionResult> {
    const result = await this.db.runInTransaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);

      return this.db.runWithManager(manager, async () => {
        // 1. Anonimizar pedidos do titular (por email), preservando dado fiscal/contabil.
        const pedidoUpdate = await manager
          .createQueryBuilder()
          .update(Pedido)
          .set({
            customer_name: ANON,
            customer_email: null as never,
            customer_phone: null as never,
            customer_notes: null as never,
            delivery_address: null as never,
          })
          .where('tenant_id = :tenantId', { tenantId })
          .andWhere('customer_email = :email', { email: userEmail })
          .execute();

        // 2. Anonimizar conversas de WhatsApp do titular (por telefone do usuario).
        const usuario = await this.db.getRepository(Usuario).findOne({
          where: { id: userId, tenant_id: tenantId },
        });

        let conversationsAffected = 0;
        if (usuario?.phone) {
          const convUpdate = await manager
            .createQueryBuilder()
            .update(WhatsappConversation)
            .set({ customer_name: ANON })
            .where('tenant_id = :tenantId', { tenantId })
            .andWhere('customer_phone = :phone', { phone: usuario.phone })
            .execute();
          conversationsAffected = convUpdate.affected || 0;
        }

        // 3. Anonimizar o proprio usuario (mantem id para integridade referencial).
        let userAnonymized = false;
        if (usuario) {
          usuario.full_name = ANON;
          usuario.phone = null as never;
          await this.db.getRepository(Usuario).save(usuario);
          userAnonymized = true;
        }

        return {
          anonymizedOrders: pedidoUpdate.affected || 0,
          anonymizedConversations: conversationsAffected,
          anonymizedUser: userAnonymized,
        };
      });
    });

    // 4. Registrar no audit log — prova de cumprimento do direito (fora da transacao de dados).
    await this.auditLog.log({
      tenantId,
      userId,
      action: 'DELETE',
      tableName: 'lgpd_anonymization',
      recordId: userId,
      metadata: {
        reason: 'LGPD Art. 18 VI - exclusao de dados pessoais (anonimizacao)',
        anonymizedOrders: result.anonymizedOrders,
        anonymizedConversations: result.anonymizedConversations,
        anonymizedUser: result.anonymizedUser,
      },
    });

    this.logger.log(
      `Exclusao LGPD executada para usuario=${userId} tenant=${tenantId}: ` +
        `${result.anonymizedOrders} pedidos, ${result.anonymizedConversations} conversas anonimizados.`,
    );

    // Marcar solicitacoes de exclusao do usuario como resolvidas (in-memory).
    this.requests
      .filter(
        (r) =>
          r.tenant_id === tenantId &&
          r.user_id === userId &&
          r.type === LgpdRequestType.DELETION &&
          r.status === LgpdRequestStatus.PENDING,
      )
      .forEach((r) => {
        r.status = LgpdRequestStatus.COMPLETED;
        r.resolved_at = new Date();
      });

    return result;
  }
}
