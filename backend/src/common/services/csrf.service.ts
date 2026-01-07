import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CsrfService {
  /**
   * Gera um token CSRF seguro
   */
  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Valida um token CSRF
   */
  validateToken(token: string, sessionToken: string): boolean {
    if (!token || !sessionToken) {
      return false;
    }
    
    return token === sessionToken;
  }
}
