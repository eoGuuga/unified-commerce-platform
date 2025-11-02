import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Unified Commerce Platform API v1.0.0';
  }
}
