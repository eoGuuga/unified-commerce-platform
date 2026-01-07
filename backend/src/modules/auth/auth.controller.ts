import { Controller, Post, Body, UseGuards, Get, Request, BadRequestException } from '@nestjs/common';
import { AuthService, LoginResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/user.decorator';
import { Usuario } from '../../database/entities/Usuario.entity';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TypedRequest } from '../../common/types/request.types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login de usuario' })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Credenciais invalidas' })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @ApiOperation({ 
    summary: 'Registro de novo usuario',
    description: '⚠️ CRÍTICO: tenantId é obrigatório via header x-tenant-id. Em produção, isso deve vir do contexto JWT.',
  })
  @ApiResponse({ status: 201, description: 'Usuario criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Tenant ID obrigatório' })
  @ApiResponse({ status: 401, description: 'Email ja cadastrado' })
  async register(@Body() registerDto: RegisterDto, @Request() req: TypedRequest): Promise<LoginResponse> {
    // ⚠️ CRÍTICO: tenantId deve vir obrigatoriamente, nunca usar default hardcoded
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      throw new BadRequestException(
        'tenantId é obrigatório para registro. Forneça via header x-tenant-id ou implemente extração do contexto JWT.',
      );
    }
    return this.authService.register(registerDto, tenantId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter usuario atual' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado' })
  @ApiResponse({ status: 401, description: 'Nao autorizado' })
  async getProfile(@CurrentUser() user: Usuario) {
    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      tenant_id: user.tenant_id,
    };
  }
}
