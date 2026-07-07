import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Usuario, UserRole } from '../../database/entities/Usuario.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import { DbContextService } from '../common/services/db-context.service';
import { CacheService } from '../common/services/cache.service';
import { PRIVACY_POLICY_VERSION } from '../common/constants/lgpd.constants';
import { BCRYPT_COST, REVOKED_TOKEN_PREFIX } from './auth.constants';

export interface SendConfirmationResponse {
  success: boolean;
  message: string;
}

export interface ConfirmEmailResponse {
  success: boolean;
  message: string;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  tenant_id: string;
  jti?: string; // id unico do token (para revogacao no logout); ausente em tokens legados
  exp?: number; // preenchido pelo jsonwebtoken; usado no logout p/ calcular o TTL da denylist
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
    private readonly cacheService: CacheService,
  ) {}

  private async runWithTenantContext<T>(
    tenantId: string,
    fn: (repo: Repository<Usuario>) => Promise<T>,
  ): Promise<T> {
    return this.db.runInTransaction(async (manager) => {
      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      return fn(manager.getRepository(Usuario));
    });
  }

  async login(loginDto: LoginDto, tenantId?: string): Promise<LoginResponse> {
    let usuario: Usuario | null = null;

    if (tenantId) {
      usuario = await this.runWithTenantContext(tenantId, async (repo) => {
        return repo.findOne({
          where: { email: loginDto.email, tenant_id: tenantId },
        });
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
    if (tenantId) {
      await this.runWithTenantContext(tenantId, async (repo) => repo.save(usuario));
    } else {
      await this.db.getRepository(Usuario).save(usuario);
    }

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      role: usuario.role,
      tenant_id: usuario.tenant_id,
      jti: randomUUID(), // id unico -> permite revogar ESTE token no logout
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
      // Não falhar se audit log falhar. A causa vai NA string da mensagem (o
      // logger JSON de prod nao serializa o 2o argumento) — sem PII (uuids + o
      // texto do erro do banco, ex.: "row violates row-level security policy").
      this.logger.error(
        `Erro ao registrar audit log de login (tenant=${usuario.tenant_id}, user=${usuario.id}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
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

    const hashedPassword = await bcrypt.hash(registerDto.password, BCRYPT_COST);

    // Registra o consentimento LGPD no momento do aceite (Art. 7/8) — prova com data + versao.
    // SEGURANCA: o role NUNCA vem do cliente (evita auto-registro como admin). Todo
    // auto-registro nasce SELLER; elevacao de privilegio so por fluxo administrativo.
    const usuario = this.db.getRepository(Usuario).create({
      email: registerDto.email,
      full_name: registerDto.full_name,
      phone: registerDto.phone,
      encrypted_password: hashedPassword,
      tenant_id: tenantId,
      role: UserRole.SELLER,
      consent_at: new Date(),
      consent_policy_version: PRIVACY_POLICY_VERSION,
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
    const zeroTenantId = '00000000-0000-0000-0000-000000000000';
    if (!tenantId || (!uuidRegex.test(tenantId) && tenantId !== zeroTenantId)) {
      throw new UnauthorizedException('Tenant invalido');
    }

    // Revogacao: um token cujo jti esta na denylist (logout) e rejeitado, mesmo
    // valido em assinatura/expiracao. Tokens legados (sem jti) seguem o caminho normal.
    if (payload.jti && (await this.isTokenRevoked(payload.jti))) {
      throw new UnauthorizedException('Sessao encerrada');
    }

    const usuario = await this.db.runInTransaction(async (manager) => {
      // Garantir RLS antes de validar o usuario no guard (mesmo sem interceptor).
      await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      return await manager.getRepository(Usuario).findOne({
        where: { id: payload.sub, tenant_id: tenantId },
      });
    });

    if (!usuario || !usuario.is_active) {
      throw new UnauthorizedException('Usuario invalido');
    }

    return usuario;
  }

  /**
   * Logout real: revoga o token atual pondo o jti dele numa denylist com TTL =
   * vida restante do token. A partir daqui, o validateUser rejeita este token,
   * mesmo que a assinatura/expiracao ainda sejam validas. E por-token: nao afeta
   * outras sessoes ativas do mesmo usuario.
   */
  async logout(token: string): Promise<{ success: boolean; message: string }> {
    try {
      const decoded = this.jwtService.decode(token) as JwtPayload | null;
      const jti = decoded?.jti;
      const exp = decoded?.exp;
      if (jti && exp) {
        const ttl = exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.cacheService.set(`${REVOKED_TOKEN_PREFIX}${jti}`, true, ttl);
        }
      }
    } catch (error) {
      // Nao falhar o logout se o Redis estiver indisponivel: o token expira em <=15min.
      this.logger.error('Falha ao revogar token no logout', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return { success: true, message: 'Logout realizado' };
  }

  /** Consulta a denylist. Fail-open na disponibilidade: um Redis fora do ar NAO
   * pode derrubar toda a autenticacao (o token ainda expira em <=15min). */
  private async isTokenRevoked(jti: string): Promise<boolean> {
    try {
      return (
        (await this.cacheService.get<boolean>(`${REVOKED_TOKEN_PREFIX}${jti}`)) === true
      );
    } catch (error) {
      this.logger.error('Falha ao consultar denylist de tokens', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async sendConfirmationEmail(email: string): Promise<SendConfirmationResponse> {
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

      const user = await this.usuariosRepository.findOne({
        where: { email },
      });

      if (!user) {
        // Mesma mensagem para evitar enumeração de usuários
        return { success: false, message: 'Codigo enviado' };
      }

      // Invalidar códigos anteriores não usados
      await this.usuariosRepository.query(
        'UPDATE email_confirmations SET used=true WHERE user_id=$1 AND used=false',
        [user.id],
      );

      // Inserir no banco
      await this.usuariosRepository.query(
        'INSERT INTO email_confirmations (user_id, code, expires_at) VALUES ($1, $2, $3)',
        [user.id, code, expiresAt],
      );

      this.logger.log(`[EMAIL] Codigo enviado para ${email}`);

      return { success: true, message: 'Codigo enviado' };
    } catch (error) {
      this.logger.error('Erro ao enviar codigo de confirmacao', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, message: 'Erro ao enviar codigo' };
    }
  }

  async confirmEmailCode(email: string, code: string): Promise<ConfirmEmailResponse> {
    try {
      const user = await this.usuariosRepository.findOne({
        where: { email },
      });

      if (!user) {
        // Mesma mensagem para evitar enumeração de usuários
        return { success: false, message: 'Codigo invalido ou expirado' };
      }

      const confirmations = await this.usuariosRepository.query(
        'SELECT * FROM email_confirmations WHERE user_id=$1 AND code=$2 AND used=false AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1',
        [user.id, code],
      );

      if (!confirmations || confirmations.length === 0) {
        return { success: false, message: 'Codigo invalido ou expirado' };
      }

      const confirmation = confirmations[0];

      // Marcar como usado
      await this.usuariosRepository.query(
        'UPDATE email_confirmations SET used=true WHERE id=$1',
        [confirmation.id],
      );

      // Marcar email como confirmado
      await this.usuariosRepository.query(
        'UPDATE usuarios SET email_confirmed=true WHERE id=$1',
        [user.id],
      );

      this.logger.log(`[EMAIL] Email ${email} confirmado com sucesso`);

      return { success: true, message: 'Email confirmado com sucesso' };
    } catch (error) {
      this.logger.error('Erro ao confirmar email', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, message: 'Erro ao confirmar email' };
    }
  }
}
