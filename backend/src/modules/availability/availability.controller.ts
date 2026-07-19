import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { Usuario, UserRole } from '../../database/entities/Usuario.entity';
import { AvailabilityService } from './availability.service';
import { CreateStoreExceptionDto } from './dto/create-store-exception.dto';
import { StoreAvailabilityException } from '../../database/entities/StoreAvailabilityException.entity';

/**
 * Camada 2 — CRUD das exceçoes de disponibilidade da loja.
 *
 * TODAS as rotas: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN)`.
 * `tenantId = user.tenant_id` do JWT — NUNCA do body/param (escopo + RLS).
 */
@ApiTags('Availability Exceptions')
@ApiBearerAuth('JWT-auth')
@Controller('availability-exceptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as exceçoes futuras (date >= hoje no fuso da loja)' })
  @ApiResponse({ status: 200, description: 'Exceçoes futuras ordenadas por data' })
  @ApiResponse({ status: 401, description: 'Nao autorizado' })
  @ApiResponse({ status: 403, description: 'Requer role admin' })
  findFuture(@CurrentUser() user: Usuario): Promise<StoreAvailabilityException[]> {
    return this.availabilityService.findFuture(user.tenant_id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria (ou sobrescreve — upsert R1) uma exceçao por data' })
  @ApiResponse({ status: 201, description: 'Exceçao criada/atualizada' })
  @ApiResponse({ status: 400, description: 'Payload invalido (date passada, open/close × kind)' })
  @ApiResponse({ status: 401, description: 'Nao autorizado' })
  @ApiResponse({ status: 403, description: 'Requer role admin' })
  create(
    @CurrentUser() user: Usuario,
    @Body() dto: CreateStoreExceptionDto,
  ): Promise<StoreAvailabilityException> {
    return this.availabilityService.create(user.tenant_id, dto);
  }

  @Post('close-today')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Atalho — cria `closed` para hoje (fuso da loja)' })
  @ApiResponse({ status: 201, description: 'Exceçao `closed` de hoje criada/atualizada' })
  @ApiResponse({ status: 401, description: 'Nao autorizado' })
  @ApiResponse({ status: 403, description: 'Requer role admin' })
  closeToday(@CurrentUser() user: Usuario): Promise<StoreAvailabilityException> {
    return this.availabilityService.closeToday(user.tenant_id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove uma exceçao (escopada por tenant)' })
  @ApiResponse({ status: 200, description: 'Exceçao removida' })
  @ApiResponse({ status: 401, description: 'Nao autorizado' })
  @ApiResponse({ status: 403, description: 'Requer role admin' })
  @ApiResponse({ status: 404, description: 'Exceçao nao encontrada neste tenant' })
  async remove(@CurrentUser() user: Usuario, @Param('id', ParseUUIDPipe) id: string): Promise<{ deleted: boolean }> {
    await this.availabilityService.remove(user.tenant_id, id);
    return { deleted: true };
  }
}
