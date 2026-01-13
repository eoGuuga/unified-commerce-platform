import { Controller, Post, Body, UseGuards, Get, Request, BadRequestException } from '@nestjs/common';
import { AuthService, LoginResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtAuthGuardProd } from './guards/jwt-auth-prod.guard';
import { CurrentUser } from './decorators/user.decorator';
import { Usuario } from '../../database/entities/Usuario.entity';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TypedRequest } from '../../common/types/request.types';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  // Protege contra brute force / credential stuffing (por IP).
  @Throttle({ strict: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Login de usuario' })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Credenciais invalidas' })
  async login(@Body() loginDto: LoginDto, @Request() req: TypedRequest): Promise<LoginResponse> {
    const isProd = process.env.NODE_ENV === 'production';
    const headerValue = req.headers['x-tenant-id'];
    const tenantId = !isProd
      ? (Array.isArray(headerValue) ? headerValue[0] : headerValue)
      : undefined;

    if (!tenantId && !isProd) {
      throw new BadRequestException('tenantId e obrigatorio no login em dev/test. Use header x-tenant-id.');
    }

    return this.authService.login(loginDto, tenantId);
  }

  @Post('register')
  @UseGuards(JwtAuthGuardProd)
  // Evita criacao massiva de contas.
  @Throttle({ strict: { ttl: 60000, limit: 3 } })
  @ApiOperation({
    summary: 'Registro de novo usuario',
    description: 'Em producao, o tenant vem do JWT. Em dev/test, usar header x-tenant-id.',
  })
  @ApiResponse({ status: 201, description: 'Usuario criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Tenant ID obrigatorio' })
  @ApiResponse({ status: 401, description: 'Email ja cadastrado' })
  async register(@Body() registerDto: RegisterDto, @Request() req: TypedRequest): Promise<LoginResponse> {
    const isProd = process.env.NODE_ENV === 'production';
    const userTenant = (req as any)?.user?.tenant_id;
    const headerValue = req.headers['x-tenant-id'];
    const headerTenant = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const tenantId = isProd ? userTenant : headerTenant;

    if (!tenantId) {
      throw new BadRequestException(
        isProd
          ? 'tenantId nao encontrado no JWT. Em producao, registre usuarios autenticado.'
          : 'tenantId e obrigatorio para registro em dev/test. Use header x-tenant-id.',
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
