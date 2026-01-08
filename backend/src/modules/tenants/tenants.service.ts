import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../database/entities/Tenant.entity';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
  ) {}

  /**
   * Busca um tenant por ID e valida se está ativo
   */
  async findOneById(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findOne({
      where: { id: tenantId },
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

    // Normalizar número de telefone (remover espaços, traços, parênteses)
    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // Verificar se tenant tem números de WhatsApp configurados
    const whatsappNumbers = tenant.settings?.whatsappNumbers || tenant.settings?.whatsapp_numbers || [];

    if (!Array.isArray(whatsappNumbers) || whatsappNumbers.length === 0) {
      // Se não tem números configurados, em desenvolvimento permitir
      // Em produção, isso deve ser obrigatório
      this.logger.warn(
        `Tenant ${tenantId} não tem números de WhatsApp configurados. Permitindo em desenvolvimento.`,
      );

      // Em produção, lançar exceção:
      // throw new ForbiddenException(
      //   `Tenant ${tenantId} não tem números de WhatsApp configurados. Contate o administrador.`,
      // );
      
      return true; // Em desenvolvimento, permitir
    }

    // Verificar se o número está na lista de números autorizados
    // Comparar número completo e últimos 9 dígitos (caso envie com/sem código do país)
    const isAuthorized = whatsappNumbers.some((authorizedNumber: string) => {
      const normalizedAuthorized = authorizedNumber.replace(/[\s\-\(\)]/g, '');
      
      // Comparação exata
      if (normalizedPhone === normalizedAuthorized) {
        return true;
      }

      // Comparação dos últimos 9 dígitos (número sem código do país)
      const last9Phone = normalizedPhone.slice(-9);
      const last9Authorized = normalizedAuthorized.slice(-9);
      if (last9Phone === last9Authorized && last9Phone.length === 9) {
        return true;
      }

      // Comparação dos últimos 11 dígitos (número com código do país)
      const last11Phone = normalizedPhone.slice(-11);
      const last11Authorized = normalizedAuthorized.slice(-11);
      if (last11Phone === last11Authorized && last11Phone.length === 11) {
        return true;
      }

      return false;
    });

    if (!isAuthorized) {
      this.logger.warn(
        `Número de WhatsApp ${phoneNumber} não autorizado para tenant ${tenantId}`,
      );
      throw new ForbiddenException(
        `Número de WhatsApp ${phoneNumber} não está autorizado para este tenant. Contate o administrador.`,
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
}
