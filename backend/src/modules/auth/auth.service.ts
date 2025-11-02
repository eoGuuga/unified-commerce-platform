import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Usuario, UserRole } from '../../database/entities/Usuario.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

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
  constructor(
    @InjectRepository(Usuario)
    private usuariosRepository: Repository<Usuario>,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const usuario = await this.usuariosRepository.findOne({
      where: { email: loginDto.email },
    });

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
    await this.usuariosRepository.save(usuario);

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      role: usuario.role,
      tenant_id: usuario.tenant_id,
    };

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
    const existingUser = await this.usuariosRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new UnauthorizedException('Email ja cadastrado');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const usuario = this.usuariosRepository.create({
      ...registerDto,
      encrypted_password: hashedPassword,
      tenant_id: tenantId,
      role: registerDto.role || UserRole.SELLER,
    });

    const savedUser = await this.usuariosRepository.save(usuario);

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
    const usuario = await this.usuariosRepository.findOne({
      where: { id: payload.sub },
    });

    if (!usuario || !usuario.is_active) {
      throw new UnauthorizedException('Usuario invalido');
    }

    return usuario;
  }
}
