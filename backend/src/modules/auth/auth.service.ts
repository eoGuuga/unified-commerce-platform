import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Usuario, UserRole } from '../../database/entities/Usuario.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { DbContextService } from '../common/services/db-context.service';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  tenant_id: string;
}

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    full_name?: string;
    role: UserRole;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Usuario)
    private usuariosRepository: Repository<Usuario>,
    private jwtService: JwtService,
    private auditLogService: AuditLogService,
    private readonly db: DbContextService,
  ) {}

  async login(loginDto: LoginDto, tenantId?: string): Promise<LoginResponse> {
    let usuario: Usuario | null = null;

    if (tenantId) {
      usuario = await this.db.getRepository(Usuario).findOne({
        where: { email: loginDto.email, tenant_id: tenantId },
      });
    } else {
      const matches = await this.db.getRepository(Usuario).find({
        where: { email: loginDto.email },
      });

      if (matches.length > 1) {
        throw new BadRequestException(
          'Email pertence a mais de um tenant. Use o fluxo de login por tenant.',
        );
      }

      usuario = matches[0] || null;
    }

    if (!usuario) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    if (!usuario.is_active) {
      throw new UnauthorizedException('Usuario inativo');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      usuario.encrypted_password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    // Atualizar last_login
    usuario.last_login = new Date();
    await this.db.getRepository(Usuario).save(usuario);

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      role: usuario.role,
      tenant_id: usuario.tenant_id,
    };

    // ✅ AUDIT LOG: Registrar login
    try {
      await this.auditLogService.log({
        tenantId: usuario.tenant_id,
        userId: usuario.id,
        action: 'LOGIN',
        tableName: 'usuarios',
        recordId: usuario.id,
        newData: { last_login: usuario.last_login },
        metadata: { email: usuario.email },
      });
    } catch (error) {
      // Não falhar se audit log falhar
      this.logger.error('Erro ao registrar audit log de login', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: { tenantId: usuario.tenant_id, userId: usuario.id, action: 'LOGIN', email: usuario.email },
      });
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: usuario.id,
        email: usuario.email,
        full_name: usuario.full_name,
        role: usuario.role,
      },
    };
  }

  async register(registerDto: RegisterDto, tenantId: string): Promise<LoginResponse> {
    const existingUser = await this.db.getRepository(Usuario).findOne({
      where: { email: registerDto.email, tenant_id: tenantId },
    });

    if (existingUser) {
      // ✅ Correto semântico: email duplicado é erro de validação (400), não auth (401)
      throw new BadRequestException('Email ja cadastrado');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const usuario = this.db.getRepository(Usuario).create({
      ...registerDto,
      encrypted_password: hashedPassword,
      tenant_id: tenantId,
      role: registerDto.role || UserRole.SELLER,
    });

    const savedUser = await this.db.getRepository(Usuario).save(usuario);

    const payload: JwtPayload = {
      sub: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
      tenant_id: savedUser.tenant_id,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: savedUser.id,
        email: savedUser.email,
        full_name: savedUser.full_name,
        role: savedUser.role,
      },
    };
  }

  async validateUser(payload: JwtPayload): Promise<Usuario> {
    const tenantId = (payload.tenant_id || '').trim();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!tenantId || !uuidRegex.test(tenantId)) {
      throw new UnauthorizedException('Tenant invalido');
    }

    const usuario = await this.db.getRepository(Usuario).findOne({
      where: { id: payload.sub, tenant_id: tenantId },
    });

    if (!usuario || !usuario.is_active) {
      throw new UnauthorizedException('Usuario invalido');
    }

    return usuario;
  }
}
