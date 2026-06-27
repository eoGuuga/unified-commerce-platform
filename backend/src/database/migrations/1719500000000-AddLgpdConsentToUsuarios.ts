import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona colunas de consentimento LGPD (Art. 7/8) em usuarios.
 * - consent_at: quando o usuario aceitou os termos/politica.
 * - consent_policy_version: qual versao da politica foi aceita.
 *
 * Usuarios pre-existentes ficam com NULL (consentimento desconhecido) — o
 * sistema pode solicitar re-aceite no proximo login se necessario.
 */
export class AddLgpdConsentToUsuarios1719500000000 implements MigrationInterface {
  name = 'AddLgpdConsentToUsuarios1719500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "consent_at" TIMESTAMP NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "consent_policy_version" character varying(20) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Preserva o dado de consentimento (prova legal); apenas remove se realmente necessario.
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "consent_policy_version"`);
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "consent_at"`);
  }
}
