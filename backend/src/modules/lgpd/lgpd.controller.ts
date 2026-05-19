import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { Usuario } from '../../database/entities/Usuario.entity';
import { LgpdService, LgpdRequest } from './lgpd.service';
import { CreateLgpdRequestDto } from './dto/create-lgpd-request.dto';

@ApiTags('LGPD')
@Controller('lgpd')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class LgpdController {
  constructor(private readonly lgpdService: LgpdService) {}

  @Post('solicitacao')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Criar solicitacao de direito LGPD',
    description:
      'Permite ao titular exercer seus direitos conforme Art. 18 da LGPD: ' +
      'acesso, correcao, exclusao, portabilidade ou revogacao de consentimento. ' +
      'Prazo legal de resposta: 15 dias.',
  })
  @ApiResponse({ status: 201, description: 'Solicitacao registrada com sucesso' })
  @ApiResponse({ status: 401, description: 'Nao autenticado' })
  async createRequest(
    @CurrentUser() user: Usuario,
    @Body() dto: CreateLgpdRequestDto,
  ): Promise<{ request: LgpdRequest; deadline_days: number }> {
    const request = await this.lgpdService.createRequest(
      user.tenant_id,
      user.id,
      user.email,
      dto.type,
      dto.details,
    );

    return {
      request,
      deadline_days: this.lgpdService.getDeadlineDays(dto.type),
    };
  }

  @Get('solicitacoes')
  @ApiOperation({
    summary: 'Listar minhas solicitacoes LGPD',
    description: 'Retorna todas as solicitacoes de direitos feitas pelo usuario autenticado.',
  })
  @ApiResponse({ status: 200, description: 'Lista de solicitacoes' })
  async listMyRequests(@CurrentUser() user: Usuario): Promise<LgpdRequest[]> {
    return this.lgpdService.getRequestsByUser(user.tenant_id, user.id);
  }

  @Get('solicitacao/:id')
  @ApiOperation({
    summary: 'Consultar status de uma solicitacao',
    description: 'Retorna detalhes e status de uma solicitacao especifica.',
  })
  @ApiResponse({ status: 200, description: 'Detalhes da solicitacao' })
  @ApiResponse({ status: 404, description: 'Solicitacao nao encontrada' })
  async getRequest(
    @CurrentUser() user: Usuario,
    @Param('id') id: string,
  ): Promise<LgpdRequest> {
    const request = await this.lgpdService.getRequestById(user.tenant_id, id);

    if (!request) {
      throw new NotFoundException(`Solicitacao ${id} nao encontrada`);
    }

    return request;
  }
}
