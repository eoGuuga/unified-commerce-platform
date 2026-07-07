import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Envelope encryption (Fase 1) — tabela das DEKs (data keys) por-tenant.
 *
 * Cada tenant tem uma DEK (chave de dados de 32 bytes) que cifra os segredos
 * dele. A DEK e guardada aqui EMBRULHADA (wrapped) pela master key
 * (ENCRYPTION_MASTER_KEY, no env — nunca no banco). Assim um dump do banco da
 * as DEKs embrulhadas + o ciphertext, mas SEM a master key nao decifra nada.
 *
 * `key_version` deixa a porta da rotacao aberta (a DEK "atual" = maior version;
 * o ciphertext v2 carrega a version pra achar a DEK certa).
 *
 * RLS+FORCE+policy no padrao do Bloco 2 — material de chave = isolamento MAXIMO
 * imposto pelo banco: o app so le a DEK do tenant cujo contexto ele setou.
 */
export class AddTenantDataKeys1752100000000 implements MigrationInterface {
  name = 'AddTenantDataKeys1752100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_data_keys" (
        "tenant_id"   uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "key_version" integer NOT NULL DEFAULT 1,
        "wrapped_dek" text NOT NULL,
        "created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_data_keys" PRIMARY KEY ("tenant_id", "key_version")
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "tenant_data_keys" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenant_data_keys" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_data_keys_tenant_isolation" ON "tenant_data_keys"`,
    );
    await queryRunner.query(`
      CREATE POLICY "tenant_data_keys_tenant_isolation" ON "tenant_data_keys"
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "tenant_data_keys_tenant_isolation" ON "tenant_data_keys"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_data_keys"`);
  }
}
