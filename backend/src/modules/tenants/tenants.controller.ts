import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { TenantsService, TenantSignupResult } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

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
}
