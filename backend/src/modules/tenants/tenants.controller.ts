import { Controller, Post, Patch, Get, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { Usuario, UserRole } from '../../database/entities/Usuario.entity';
import {
  TenantsService,
  TenantSignupResult,
  TenantBranding,
  TenantSettingsProjection,
} from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post('signup')
  @Public()
  @Throttle({ strict: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastro self-service de nova empresa',
    description:
      'Cria um novo tenant + usuario administrador em uma unica operacao atomica. ' +
      'Endpoint publico com rate-limit rigoroso (3 req/min).',
  })
  @ApiResponse({ status: 201, description: 'Tenant e admin criados com sucesso' })
  @ApiResponse({ status: 409, description: 'Slug ja em uso ou email duplicado' })
  @ApiResponse({ status: 429, description: 'Rate limit excedido' })
  async signup(@Body() dto: CreateTenantDto): Promise<TenantSignupResult> {
    return this.tenantsService.createTenantWithAdmin(dto);
  }

  @Get(':slug/branding')
  @Public()
  @ApiOperation({
    summary: 'Obter branding publico de um tenant pelo slug',
    description: 'Retorna logo, cor, nome e tagline para renderizar a vitrine.',
  })
  @ApiResponse({ status: 200, description: 'Branding do tenant' })
  @ApiResponse({ status: 404, description: 'Tenant nao encontrado' })
  async getBranding(@Param('slug') slug: string): Promise<TenantBranding> {
    return this.tenantsService.getBrandingBySlug(slug);
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Obter configuracoes do tenant autenticado (projecao allow-list)',
    description:
      'Retorna a projecao allow-list das configuracoes (loja/horario/pagamento/status) ' +
      'do tenant do usuario autenticado. NUNCA retorna o settings bruto nem segredos ' +
      '(apiKey, bot_control_code, tokens, colunas *_encrypted). Escopado por user.tenant_id.',
  })
  @ApiResponse({ status: 200, description: 'Projecao das configuracoes do tenant' })
  @ApiResponse({ status: 401, description: 'Nao autorizado' })
  async getSettings(@CurrentUser() user: Usuario): Promise<TenantSettingsProjection> {
    return this.tenantsService.getSettingsForTenant(user.tenant_id);
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Atualizar configuracoes do tenant autenticado (DTO por secao, requer admin)',
    description:
      'Atualiza as configuracoes (loja/horario/pagamento) do tenant do usuario autenticado ' +
      'via DTO por secao — cada secao e opcional e apenas as secoes presentes sao mescladas ' +
      '(merge JSONB, secao ausente = nao toca). REQUER role ADMIN (guard). ' +
      'Escopado por user.tenant_id (nunca body). Retorna a mesma projecao allow-list do GET.',
  })
  @ApiResponse({ status: 200, description: 'Configuracoes atualizadas (projecao allow-list)' })
  @ApiResponse({ status: 400, description: 'Payload invalido (validacao fail-closed)' })
  @ApiResponse({ status: 401, description: 'Nao autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso restrito: requer role admin' })
  async updateSettings(
    @CurrentUser() user: Usuario,
    @Body() dto: UpdateTenantSettingsDto,
  ): Promise<TenantSettingsProjection> {
    return this.tenantsService.updateSettingsSectioned(user.tenant_id, dto);
  }

  @Patch('branding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Atualizar branding do tenant autenticado (requer admin)',
    description: 'Atualiza logo, cor primaria, nome e tagline. REQUER role ADMIN (guard).',
  })
  @ApiResponse({ status: 200, description: 'Branding atualizado' })
  @ApiResponse({ status: 401, description: 'Nao autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso restrito: requer role admin' })
  async updateBranding(
    @CurrentUser() user: Usuario,
    @Body() dto: UpdateBrandingDto,
  ): Promise<TenantBranding> {
    return this.tenantsService.updateBranding(user.tenant_id, dto);
  }
}
