import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailConfirmations1718350000000 implements MigrationInterface {
  name = 'AddEmailConfirmations1718350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar tabela de confirmacoes de email
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_confirmations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "code" character varying(6) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP NOT NULL,
        "used" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_email_confirmations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_email_confirmations_user" FOREIGN KEY ("user_id")
          REFERENCES "usuarios"("id") ON DELETE CASCADE
      )
    `);

    // Indice para buscar por user_id e codigo
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_confirmations_user_code"
      ON "email_confirmations" ("user_id", "code", "used")
    `);

    // Indice para buscar por expiracao (cleanup)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_email_confirmations_expires"
      ON "email_confirmations" ("expires_at")
    `);

    // Adicionar coluna email_confirmed na tabela usuarios se ainda nao existir
    await queryRunner.query(`
      ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "email_confirmed" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "email_confirmations"`);
    // Nao remover a coluna email_confirmed para preservar dados
  }
}