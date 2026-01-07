import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health check completo (verifica DB, Redis, etc)' })
  @ApiResponse({ status: 200, description: 'Todos os serviços estão funcionando' })
  @ApiResponse({ status: 503, description: 'Algum serviço está indisponível' })
  async check() {
    return this.healthService.check();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (Kubernetes)' })
  @ApiResponse({ status: 200, description: 'Aplicação pronta para receber tráfego' })
  @ApiResponse({ status: 503, description: 'Aplicação não está pronta' })
  async ready() {
    return this.healthService.ready();
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (Kubernetes)' })
  @ApiResponse({ status: 200, description: 'Aplicação está viva' })
  async live() {
    return this.healthService.live();
  }
}
