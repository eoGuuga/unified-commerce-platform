import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LgpdRequestType, LgpdRequestStatus } from './dto/create-lgpd-request.dto';

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

@Injectable()
export class LgpdService {
  private readonly logger = new Logger(LgpdService.name);
  private readonly requests: LgpdRequest[] = [];

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
}
