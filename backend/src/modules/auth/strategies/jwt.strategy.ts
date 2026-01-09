import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    config: ConfigService,
  ) {
    const jwtSecret = config.get<string>('JWT_SECRET');
    
    const normalized = (jwtSecret || '').trim();
    const looksInsecure =
      !normalized ||
      normalized.length < 32 ||
      normalized === 'change-me-in-production' ||
      normalized.toLowerCase().includes('change-me') ||
      normalized.toLowerCase().includes('dev-secret') ||
      normalized.toLowerCase().includes('change-in-production');

    if (looksInsecure) {
      throw new Error(
        'JWT_SECRET deve ser definido e seguro em .env. ' +
          'Use 32+ caracteres aleatórios e evite placeholders (ex.: "change-me"). ' +
          'Gere uma chave segura com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: normalized,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.validateUser(payload);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
