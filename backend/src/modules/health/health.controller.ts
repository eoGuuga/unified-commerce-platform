import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health check completo (verifica DB, Redis, etc)' })
  @ApiResponse({ status: 200, description: 'Todos os serviços estão funcionando' })
  @ApiResponse({ status: 503, description: 'Algum serviço está indisponível' })
  async check(@Res() res: Response) {
    const health = await this.healthService.check();
    const status = health.status === 'ok' ? 200 : 503;
    return res.status(status).json(health);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (Kubernetes)' })
  @ApiResponse({ status: 200, description: 'Aplicação pronta para receber tráfego' })
  @ApiResponse({ status: 503, description: 'Aplicação não está pronta' })
  async ready(@Res() res: Response) {
    const health = await this.healthService.ready();
    const status = health.status === 'ready' ? 200 : 503;
    return res.status(status).json(health);
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (Kubernetes)' })
  @ApiResponse({ status: 200, description: 'Aplicação está viva' })
  async live(@Res() res: Response) {
    const health = await this.healthService.live();
    return res.status(200).json(health);
  }
}
