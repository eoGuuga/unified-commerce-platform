import { Controller, Post, Patch, Get, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { Usuario } from '../../database/entities/Usuario.entity';
import {
  TenantsService,
  TenantSignupResult,
  TenantBranding,
  TenantSettingsProjection,
} from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';

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

  @Patch('branding')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Atualizar branding do tenant autenticado',
    description: 'Atualiza logo, cor primaria, nome e tagline. Requer role admin.',
  })
  @ApiResponse({ status: 200, description: 'Branding atualizado' })
  @ApiResponse({ status: 401, description: 'Nao autorizado' })
  async updateBranding(
    @CurrentUser() user: Usuario,
    @Body() dto: UpdateBrandingDto,
  ): Promise<TenantBranding> {
    return this.tenantsService.updateBranding(user.tenant_id, dto);
  }
}
