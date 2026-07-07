import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Tenant } from '../../database/entities/Tenant.entity';
import { Usuario, UserRole } from '../../database/entities/Usuario.entity';
import { DbContextService } from '../common/services/db-context.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { BusinessHours } from '../whatsapp/utils/business-hours';
import { BCRYPT_COST } from '../auth/auth.constants';
import { maskPhone, maskEmail } from '../../common/utils/mask.util';

/**
 * Projecao ALLOW-LIST das configuracoes do tenant (§2.1 do spec).
 *
 * REGRA DE OURO (§6): a leitura NUNCA retorna o `settings` bruto nem qualquer
 * segredo (whatsapp.apiKey, bot_control_code, tokens, colunas *_encrypted).
 * Apenas as chaves explicitamente listadas abaixo sao mapeadas. Campos ausentes
 * viram null/[]. Booleanos de `status` sinalizam presenca — nunca expoem o valor.
 */
export interface TenantSettingsProjection {
  loja: {
    store_name: string | null;
    tagline: string | null;
    description: string | null;
    logo_url: string | null;
    favicon_url: string | null;
    primary_color: string | null;
  };
  horario: {
    business_hours: BusinessHours | null;
  };
  pagamento: {
    metodos: string[];
    pix_key: string | null;
    pix_merchant_name: string | null;
  };
  status: {
    hasBusinessHours: boolean;
    hasPixKey: boolean;
    hasPixMerchantName: boolean;
    hasWhatsappNumber: boolean;
  };
}

export interface TenantBranding {
  tenant_id: string;
  slug: string;
  store_name: string;
  tagline?: string;
  logo_url?: string;
  favicon_url?: string;
  primary_color?: string;
}

export interface TenantSignupResult {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  admin: {
    id: string;
    email: string;
    full_name?: string;
    role: UserRole;
  };
}

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
      this.logger.warn(`Numero de WhatsApp ${maskPhone(phoneNumber)} nao autorizado para tenant ${tenantId}`);
      throw new ForbiddenException(
        `Numero de WhatsApp ${maskPhone(phoneNumber)} nao esta autorizado para este tenant. Contate o administrador.`,
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

  /**
   * Mapeia o tenant para a projecao allow-list (§2.1). SO as chaves listadas.
   * Puro/sincrono: nunca toca o banco, nunca inclui segredo.
   */
  buildSettingsProjection(tenant: Tenant): TenantSettingsProjection {
    const settings = tenant.settings || {};

    const nullIfBlank = (v: unknown): string | null =>
      typeof v === 'string' && v.length > 0 ? v : null;

    // business_hours: aceita SO se for objeto com `days`; senao null (fail-closed).
    const rawBh = settings.business_hours;
    const businessHours: BusinessHours | null =
      rawBh && typeof rawBh === 'object' && !Array.isArray(rawBh) && rawBh.days
        ? (rawBh as BusinessHours)
        : null;

    const rawMetodos = settings.metodos;
    const metodos: string[] = Array.isArray(rawMetodos)
      ? rawMetodos.filter((m): m is string => typeof m === 'string')
      : [];

    const pixKey = nullIfBlank(settings.pix_key);
    const pixMerchantName = nullIfBlank(settings.pix_merchant_name);

    const rawWhatsappNumbers = settings.whatsappNumbers || settings.whatsapp_numbers;
    const hasWhatsappNumber =
      Array.isArray(rawWhatsappNumbers) && rawWhatsappNumbers.length > 0;

    return {
      loja: {
        store_name: nullIfBlank(settings.store_name),
        tagline: nullIfBlank(settings.tagline),
        description: nullIfBlank(settings.description),
        logo_url: nullIfBlank(settings.logo_url),
        favicon_url: nullIfBlank(settings.favicon_url),
        primary_color: nullIfBlank(settings.primary_color),
      },
      horario: {
        business_hours: businessHours,
      },
      pagamento: {
        metodos,
        pix_key: pixKey,
        pix_merchant_name: pixMerchantName,
      },
      status: {
        hasBusinessHours: businessHours !== null,
        hasPixKey: pixKey !== null,
        hasPixMerchantName: pixMerchantName !== null,
        hasWhatsappNumber, // SO o booleano — nunca o numero.
      },
    };
  }

  /**
   * Le o tenant sob RLS (escopado por tenantId) e retorna a projecao allow-list.
   * O tenantId vem SEMPRE do JWT (user.tenant_id), nunca do body/header.
   */
  async getSettingsForTenant(tenantId: string): Promise<TenantSettingsProjection> {
    const tenant = await this.findOneById(tenantId);
    return this.buildSettingsProjection(tenant);
  }

  /**
   * Aplica um PATCH por SECAO (§2.2). Monta o objeto de merge SO com as chaves das
   * secoes PRESENTES no DTO — secao ausente = nao toca; campo ausente na secao =
   * nao toca aquela chave. O objeto resultante e mesclado via `updateSettings`
   * (`settings = COALESCE(settings,'{}') || $2::jsonb`, escopado por RLS).
   *
   * O tenantId vem SEMPRE do JWT (user.tenant_id), nunca do body/header.
   * Retorna a mesma projecao allow-list do GET (T3) — round-trip consistente.
   */
  async updateSettingsSectioned(
    tenantId: string,
    dto: UpdateTenantSettingsDto,
  ): Promise<TenantSettingsProjection> {
    const merge: Record<string, unknown> = {};

    // Secao Loja -> chaves de branding + descricao.
    if (dto.loja) {
      const { store_name, tagline, description, logo_url, favicon_url, primary_color } = dto.loja;
      if (store_name !== undefined) merge.store_name = store_name;
      if (tagline !== undefined) merge.tagline = tagline;
      if (description !== undefined) merge.description = description;
      if (logo_url !== undefined) merge.logo_url = logo_url;
      if (favicon_url !== undefined) merge.favicon_url = favicon_url;
      if (primary_color !== undefined) merge.primary_color = primary_color;
    }

    // Secao Horario -> business_hours (fonte unica). null limpa; ausente nao toca.
    if (dto.horario) {
      if (dto.horario.business_hours !== undefined) {
        merge.business_hours = dto.horario.business_hours;
      }
    }

    // Secao Pagamento -> metodos / pix_key / pix_merchant_name.
    if (dto.pagamento) {
      const { metodos, pix_key, pix_merchant_name } = dto.pagamento;
      if (metodos !== undefined) merge.metodos = metodos;
      if (pix_key !== undefined) merge.pix_key = pix_key;
      if (pix_merchant_name !== undefined) merge.pix_merchant_name = pix_merchant_name;
    }

    // Nada a mesclar (DTO vazio ou secoes sem campos) -> so devolve a projecao atual.
    if (Object.keys(merge).length === 0) {
      return this.getSettingsForTenant(tenantId);
    }

    const updated = await this.updateSettings(tenantId, merge);
    return this.buildSettingsProjection(updated);
  }

  async createTenantWithAdmin(dto: CreateTenantDto): Promise<TenantSignupResult> {
    return await this.dbContext.runInTransaction(async (manager) => {
      const tenantRepo = manager.getRepository(Tenant);
      const userRepo = manager.getRepository(Usuario);

      const existingTenant = await tenantRepo.findOne({
        where: { slug: dto.slug },
      });
      if (existingTenant) {
        throw new ConflictException(`Slug "${dto.slug}" ja esta em uso. Escolha outro.`);
      }

      const tenant = tenantRepo.create({
        name: dto.company_name,
        slug: dto.slug,
        settings: {},
        is_active: true,
      });
      const savedTenant = await tenantRepo.save(tenant);

      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [savedTenant.id]);

      const existingUser = await userRepo.findOne({
        where: { email: dto.admin_email, tenant_id: savedTenant.id },
      });
      if (existingUser) {
        throw new ConflictException(`Email "${dto.admin_email}" ja cadastrado neste tenant.`);
      }

      const hashedPassword = await bcrypt.hash(dto.admin_password, BCRYPT_COST);

      const admin = userRepo.create({
        tenant_id: savedTenant.id,
        email: dto.admin_email,
        encrypted_password: hashedPassword,
        full_name: dto.admin_name,
        phone: dto.admin_phone,
        role: UserRole.ADMIN,
        is_active: true,
      });
      const savedAdmin = await userRepo.save(admin);

      await tenantRepo.update(savedTenant.id, { owner_id: savedAdmin.id });

      this.logger.log(`Novo tenant criado: ${savedTenant.slug} (${savedTenant.id}) por ${maskEmail(dto.admin_email)}`);

      return {
        tenant: {
          id: savedTenant.id,
          name: savedTenant.name,
          slug: savedTenant.slug,
        },
        admin: {
          id: savedAdmin.id,
          email: savedAdmin.email,
          full_name: savedAdmin.full_name,
          role: savedAdmin.role,
        },
      };
    });
  }

  async getBrandingBySlug(slug: string): Promise<TenantBranding> {
    const tenant = await this.dbContext.runInTransaction(async (manager) => {
      return manager.getRepository(Tenant).findOne({ where: { slug } });
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant com slug "${slug}" nao encontrado`);
    }

    if (!tenant.is_active) {
      throw new ForbiddenException(`Tenant "${slug}" esta inativo`);
    }

    const settings = tenant.settings || {};

    return {
      tenant_id: tenant.id,
      slug: tenant.slug,
      store_name: settings.store_name || tenant.name,
      tagline: settings.tagline,
      logo_url: settings.logo_url,
      favicon_url: settings.favicon_url,
      primary_color: settings.primary_color,
    };
  }

  async updateBranding(tenantId: string, dto: UpdateBrandingDto): Promise<TenantBranding> {
    const brandingSettings: Record<string, unknown> = {};
    if (dto.logo_url !== undefined) brandingSettings.logo_url = dto.logo_url;
    if (dto.primary_color !== undefined) brandingSettings.primary_color = dto.primary_color;
    if (dto.store_name !== undefined) brandingSettings.store_name = dto.store_name;
    if (dto.tagline !== undefined) brandingSettings.tagline = dto.tagline;
    if (dto.favicon_url !== undefined) brandingSettings.favicon_url = dto.favicon_url;

    const updated = await this.updateSettings(tenantId, brandingSettings);
    const settings = updated.settings || {};

    return {
      tenant_id: updated.id,
      slug: updated.slug,
      store_name: settings.store_name || updated.name,
      tagline: settings.tagline,
      logo_url: settings.logo_url,
      favicon_url: settings.favicon_url,
      primary_color: settings.primary_color,
    };
  }
}
