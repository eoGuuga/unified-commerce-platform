import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Tenant } from '../../database/entities/Tenant.entity';
import { DbContextService } from '../common/services/db-context.service';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(private readonly dbContext: DbContextService) {}

  private normalizePhone(phoneNumber: string): string {
    return String(phoneNumber || '').replace(/[\s\-\(\)]/g, '');
  }

  private matchesConfiguredPhone(phoneNumber: string, configuredNumbers: string[]): boolean {
    const normalizedPhone = this.normalizePhone(phoneNumber);

    return configuredNumbers.some((configuredNumber: string) => {
      const normalizedConfigured = this.normalizePhone(configuredNumber);

      if (normalizedPhone === normalizedConfigured) {
        return true;
      }

      const last9Phone = normalizedPhone.slice(-9);
      const last9Configured = normalizedConfigured.slice(-9);
      if (last9Phone === last9Configured && last9Phone.length === 9) {
        return true;
      }

      const last11Phone = normalizedPhone.slice(-11);
      const last11Configured = normalizedConfigured.slice(-11);
      if (last11Phone === last11Configured && last11Phone.length === 11) {
        return true;
      }

      return false;
    });
  }

  /**
   * Busca um tenant por ID e valida se está ativo
   */
  async findOneById(tenantId: string): Promise<Tenant> {
    const tenant = await this.dbContext.runInTransaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      return manager.getRepository(Tenant).findOne({
        where: { id: tenantId },
      });
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant com ID ${tenantId} não encontrado`);
    }

    if (!tenant.is_active) {
      throw new ForbiddenException(`Tenant ${tenantId} está inativo`);
    }

    return tenant;
  }

  /**
   * Valida se um número de WhatsApp está autorizado para um tenant
   * @param tenantId ID do tenant
   * @param phoneNumber Número de WhatsApp (pode ter ou não código do país)
   * @returns true se autorizado, lança exceção se não autorizado
   */
  async validateWhatsAppNumber(tenantId: string, phoneNumber: string): Promise<boolean> {
    const tenant = await this.findOneById(tenantId);

    const whatsappNumbers = tenant.settings?.whatsappNumbers || tenant.settings?.whatsapp_numbers || [];

    if (!Array.isArray(whatsappNumbers) || whatsappNumbers.length === 0) {
      const isProduction = process.env.NODE_ENV === 'production';

      if (isProduction) {
        this.logger.error(
          `[SEGURANCA] Tenant ${tenantId} nao tem numeros de WhatsApp configurados em PRODUCAO. Bloqueando acesso.`,
        );
        throw new ForbiddenException(
          `Tenant ${tenantId} nao tem numeros de WhatsApp configurados. Contate o administrador para configurar os numeros autorizados.`,
        );
      }

      this.logger.warn(
        `[DEV] Tenant ${tenantId} nao tem numeros de WhatsApp configurados. Permitindo em desenvolvimento apenas.`,
      );
      return true;
    }

    const isAuthorized = this.matchesConfiguredPhone(phoneNumber, whatsappNumbers);

    if (!isAuthorized) {
      this.logger.warn(`Numero de WhatsApp ${phoneNumber} nao autorizado para tenant ${tenantId}`);
      throw new ForbiddenException(
        `Numero de WhatsApp ${phoneNumber} nao esta autorizado para este tenant. Contate o administrador.`,
      );
    }

    return true;
  }

  /**
   * Valida tenant e número de WhatsApp em uma única chamada
   * Método mais seguro que aceita apenas tenantId válido e número autorizado
   */
  async validateTenantAndPhone(tenantId: string, phoneNumber: string): Promise<Tenant> {
    await this.validateWhatsAppNumber(tenantId, phoneNumber);
    return await this.findOneById(tenantId);
  }

  async updateSettings(
    tenantId: string,
    partialSettings: Record<string, unknown>,
  ): Promise<Tenant> {
    return await this.dbContext.runInTransaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      const repository = manager.getRepository(Tenant);
      const tenant = await repository.findOne({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant com ID ${tenantId} não encontrado`);
      }

      await manager.query(
        `
          UPDATE tenants
          SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb
          WHERE id = $1
        `,
        [tenantId, JSON.stringify(partialSettings)],
      );

      const updatedTenant = await repository.findOne({
        where: { id: tenantId },
      });

      if (!updatedTenant) {
        throw new NotFoundException(`Tenant com ID ${tenantId} não encontrado`);
      }

      return updatedTenant;
    });
  }
}
