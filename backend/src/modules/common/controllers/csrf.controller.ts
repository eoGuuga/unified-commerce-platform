import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CsrfService } from '../../../common/services/csrf.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Security')
@Controller('csrf')
export class CsrfController {
  constructor(
    private readonly csrfService: CsrfService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Gerar token CSRF e setar cookie' })
  getToken(@Res({ passthrough: true }) res: Response) {
    const token = this.csrfService.generateToken();
    const cookieName = this.configService.get<string>('CSRF_COOKIE_NAME') || 'csrf-token';
    const headerName = this.configService.get<string>('CSRF_HEADER_NAME') || 'x-csrf-token';
    const sameSiteRaw = (this.configService.get<string>('CSRF_COOKIE_SAMESITE') || 'lax').toLowerCase();
    const sameSite = sameSiteRaw === 'none' || sameSiteRaw === 'strict' ? sameSiteRaw : 'lax';
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: isProd,
      sameSite,
      path: '/',
    });

    return {
      token,
      headerName,
      cookieName,
    };
  }
}
