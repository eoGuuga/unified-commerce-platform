import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService, JwtPayload } from './auth.service';
import { Usuario, UserRole } from '../../database/entities/Usuario.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuditLogService } from '../common/services/audit-log.service';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let usuariosRepository: Repository<Usuario>;
  let jwtService: JwtService;
  let auditLogService: AuditLogService;

  const mockUsuariosRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(Usuario),
          useValue: mockUsuariosRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usuariosRepository = module.get<Repository<Usuario>>(getRepositoryToken(Usuario));
    jwtService = module.get<JwtService>(JwtService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const tenantId = '00000000-0000-0000-0000-000000000000';
    const loginDto: LoginDto = {
      email: 'test@test.com',
      password: 'password123',
    };

    const mockUsuario = {
      id: 'user-id',
      email: 'test@test.com',
      encrypted_password: bcrypt.hashSync('password123', 10),
      role: UserRole.SELLER,
      tenant_id: tenantId,
      is_active: true,
      last_login: null,
      created_at: new Date(),
      updated_at: new Date(),
      tenant: null,
    } as unknown as Usuario;

    it('deve fazer login com sucesso quando credenciais são válidas', async () => {
      // Arrange
      mockUsuariosRepository.findOne.mockResolvedValue(mockUsuario);
      mockUsuariosRepository.save.mockResolvedValue({
        ...mockUsuario,
        last_login: new Date(),
      } as Usuario);

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(loginDto.email);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUsuario.id,
          email: mockUsuario.email,
          role: mockUsuario.role,
          tenant_id: mockUsuario.tenant_id,
        }),
      );
      expect(mockUsuariosRepository.save).toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException quando usuário não existe', async () => {
      // Arrange
      mockUsuariosRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Credenciais invalidas');
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException quando usuário está inativo', async () => {
      // Arrange
      mockUsuariosRepository.findOne.mockResolvedValue({
        ...mockUsuario,
        is_active: false,
      });

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Usuario inativo');
    });

    it('deve lançar UnauthorizedException quando senha é inválida', async () => {
      // Arrange
      mockUsuariosRepository.findOne.mockResolvedValue({
        ...mockUsuario,
        encrypted_password: bcrypt.hashSync('wrong-password', 10),
      });

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Credenciais invalidas');
    });
  });

  describe('register', () => {
    const tenantId = '00000000-0000-0000-0000-000000000000';
    const registerDto: RegisterDto = {
      email: 'newuser@test.com',
      password: 'password123',
      full_name: 'New User',
      role: UserRole.SELLER,
    };

    const mockNewUsuario: Partial<Usuario> = {
      id: 'new-user-id',
      email: registerDto.email,
      encrypted_password: 'hashed-password',
      full_name: registerDto.full_name,
      role: registerDto.role,
      tenant_id: tenantId,
      is_active: true,
    } as Usuario;

    it('deve criar novo usuário com sucesso', async () => {
      // Arrange
      mockUsuariosRepository.findOne.mockResolvedValue(null); // Email não existe
      mockUsuariosRepository.create.mockReturnValue(mockNewUsuario);
      mockUsuariosRepository.save.mockResolvedValue(mockNewUsuario);

      // Act
      const result = await service.register(registerDto, tenantId);

      // Assert
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(registerDto.email);
      expect(mockUsuariosRepository.create).toHaveBeenCalled();
      expect(mockUsuariosRepository.save).toHaveBeenCalled();
    });

    it('deve lançar BadRequestException quando email já existe', async () => {
      // Arrange
      mockUsuariosRepository.findOne.mockResolvedValue(mockNewUsuario); // Email já existe

      // Act & Assert
      await expect(service.register(registerDto, tenantId)).rejects.toThrow(BadRequestException);
      await expect(service.register(registerDto, tenantId)).rejects.toThrow('Email ja cadastrado');
      expect(mockUsuariosRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    const payload: JwtPayload = {
      sub: 'user-id',
      email: 'test@test.com',
      role: UserRole.SELLER,
      tenant_id: '00000000-0000-0000-0000-000000000000',
    };

    const mockUsuario: Partial<Usuario> = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenant_id: payload.tenant_id,
      is_active: true,
    } as Usuario;

    it('deve retornar usuário quando válido', async () => {
      // Arrange
      mockUsuariosRepository.findOne.mockResolvedValue(mockUsuario);

      // Act
      const result = await service.validateUser(payload);

      // Assert
      expect(result).toEqual(mockUsuario);
      expect(mockUsuariosRepository.findOne).toHaveBeenCalledWith({
        where: { id: payload.sub },
      });
    });

    it('deve lançar UnauthorizedException quando usuário não existe', async () => {
      // Arrange
      mockUsuariosRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.validateUser(payload)).rejects.toThrow(UnauthorizedException);
      await expect(service.validateUser(payload)).rejects.toThrow('Usuario invalido');
    });

    it('deve lançar UnauthorizedException quando usuário está inativo', async () => {
      // Arrange
      mockUsuariosRepository.findOne.mockResolvedValue({
        ...mockUsuario,
        is_active: false,
      });

      // Act & Assert
      await expect(service.validateUser(payload)).rejects.toThrow(UnauthorizedException);
      await expect(service.validateUser(payload)).rejects.toThrow('Usuario invalido');
    });
  });
});
