import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class EncryptionService {
  private readonly encryptionKey: string;

  constructor(
    private configService: ConfigService,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {
    // ✅ Chave de encriptação do .env (obrigatória e forte)
    // Importante: esta chave precisa ser estável; se mudar, não será possível descriptografar chaves já salvas.
    const key = (this.configService.get<string>('ENCRYPTION_KEY') || '').trim();
    const looksInsecure =
      !key ||
      key.length < 32 ||
      key.toLowerCase().includes('change-me') ||
      key.toLowerCase().includes('dev-secret');

    if (looksInsecure) {
      throw new Error(
        'ENCRYPTION_KEY deve ser definido e seguro em backend/.env (32+ caracteres). ' +
          'Gere uma chave segura com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }

    this.encryptionKey = key;
  }

  /**
   * Encripta API Key e salva no tenant
   */
  async encryptAndSaveApiKey(
    tenantId: string,
    keyType: 'openai' | 'twilio_sid' | 'twilio_token' | 'stripe',
    apiKey: string,
  ): Promise<void> {
    // Usa função SQL do PostgreSQL para encriptar
    const columnMap = {
      openai: 'openai_api_key_encrypted',
      twilio_sid: 'twilio_account_sid_encrypted',
      twilio_token: 'twilio_auth_token_encrypted',
      stripe: 'stripe_api_key_encrypted',
    };

    const column = columnMap[keyType];

    await this.dataSource.query(
      `UPDATE tenants 
       SET ${column} = encrypt_api_key($1, $2)
       WHERE id = $3`,
      [apiKey, this.encryptionKey, tenantId],
    );
  }

  /**
   * Descriptografa e retorna API Key
   */
  async decryptApiKey(
    tenantId: string,
    keyType: 'openai' | 'twilio_sid' | 'twilio_token' | 'stripe',
  ): Promise<string | null> {
    const columnMap = {
      openai: 'openai_api_key_encrypted',
      twilio_sid: 'twilio_account_sid_encrypted',
      twilio_token: 'twilio_auth_token_encrypted',
      stripe: 'stripe_api_key_encrypted',
    };

    const column = columnMap[keyType];

    const result = await this.dataSource.query(
      `SELECT decrypt_api_key(${column}, $1) as decrypted_key
       FROM tenants 
       WHERE id = $2`,
      [this.encryptionKey, tenantId],
    );

    return result[0]?.decrypted_key || null;
  }

  /**
   * Verifica se tenant usa BYOK para um serviço
   */
  async usesOwnKey(
    tenantId: string,
    service: 'openai' | 'twilio' | 'stripe',
  ): Promise<boolean> {
    const columnMap = {
      openai: 'use_own_openai_key',
      twilio: 'use_own_twilio_creds',
      stripe: 'use_own_stripe_key',
    };

    const column = columnMap[service];

    const result = await this.dataSource.query(
      `SELECT ${column} FROM tenants WHERE id = $1`,
      [tenantId],
    );

    return result[0]?.[column] || false;
  }
}

