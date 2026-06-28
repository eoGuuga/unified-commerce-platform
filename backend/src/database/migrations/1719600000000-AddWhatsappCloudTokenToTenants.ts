import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona coluna para o access token (criptografado) da WhatsApp Cloud API
 * por tenant. Cada cliente conecta o proprio numero/credencial da Meta.
 *
 * O token e segredo -> armazenado criptografado via encrypt_api_key (mesma
 * infra usada para openai/twilio/stripe). Dados nao-secretos (phoneNumberId,
 * provider escolhido) ficam em tenants.settings (JSONB).
 */
export class AddWhatsappCloudTokenToTenants1719600000000 implements MigrationInterface {
  name = 'AddWhatsappCloudTokenToTenants1719600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "whatsapp_cloud_token_encrypted" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "whatsapp_cloud_token_encrypted"`,
    );
  }
}
