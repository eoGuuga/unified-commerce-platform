import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly encryptionKey: string;
  /** Chave de 32 bytes derivada de ENCRYPTION_KEY (para AES-256-GCM). */
  private readonly aesKey: Buffer;

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
    // Deriva uma chave de 32 bytes estavel a partir do ENCRYPTION_KEY.
    this.aesKey = createHash('sha256').update(key).digest();
  }

  /**
   * Criptografia AES-256-GCM em TypeScript (autossuficiente, sem funcao SQL).
   * Formato: base64(iv).base64(authTag).base64(ciphertext).
   * Usado para segredos por-tenant (ex.: access token da WhatsApp Cloud API).
   */
  encryptString(plaintext: string): string {
    const iv = randomBytes(12); // GCM recomenda 96 bits
    const cipher = createCipheriv('aes-256-gcm', this.aesKey, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
  }

  /** Reverte encryptString. Retorna null se o formato/tag forem invalidos. */
  decryptString(payload: string | null | undefined): string | null {
    if (!payload) return null;
    try {
      const [ivB64, tagB64, dataB64] = payload.split('.');
      if (!ivB64 || !tagB64 || !dataB64) return null;
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.aesKey,
        Buffer.from(ivB64, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      const dec = Buffer.concat([
        decipher.update(Buffer.from(dataB64, 'base64')),
        decipher.final(),
      ]);
      return dec.toString('utf8');
    } catch {
      return null;
    }
  }

  /**
   * Encripta API Key e salva no tenant
   */
  async encryptAndSaveApiKey(
    tenantId: string,
    keyType: 'openai' | 'twilio_sid' | 'twilio_token' | 'stripe',
    apiKey: string,
  ): Promise<void> {
    // NOTA: este caminho usa a funcao SQL encrypt_api_key (infra legada). Para
    // novos segredos prefira encryptString()/decryptString() (AES em TS, real).
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

  /**
   * Salva o access token da WhatsApp Cloud API de um tenant, criptografado
   * com AES-256-GCM em TypeScript (NAO depende de funcao SQL). Coluna:
   * tenants.whatsapp_cloud_token_encrypted.
   */
  async saveWhatsappCloudToken(tenantId: string, accessToken: string): Promise<void> {
    const encrypted = this.encryptString(accessToken);
    await this.dataSource.query(
      `UPDATE tenants SET whatsapp_cloud_token_encrypted = $1 WHERE id = $2`,
      [encrypted, tenantId],
    );
  }

  /** Le e descriptografa o access token da Cloud API do tenant (null se ausente). */
  async getWhatsappCloudToken(tenantId: string): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT whatsapp_cloud_token_encrypted FROM tenants WHERE id = $1`,
      [tenantId],
    );
    return this.decryptString(rows[0]?.whatsapp_cloud_token_encrypted ?? null);
  }
}

