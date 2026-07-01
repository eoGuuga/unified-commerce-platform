import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Camada 2 — exceçoes pontuais de disponibilidade da loja (por-data).
 * Tabela `store_availability_exceptions` (RLS por tenant) + enum
 * `store_exception_kind`. Idempotente (IF NOT EXISTS / DO $$ pg_type / pg_policies).
 *
 * Molde: 1751300000000-AddStockLedgerAndReleaseTracking.ts (CREATE TABLE/enum) +
 * scripts/migrations/009-rls-force-and-extra-policies.sql (policy _tenant_isolation).
 */
export class AddStoreAvailabilityExceptions1751800000000
  implements MigrationInterface
{
  name = 'AddStoreAvailabilityExceptions1751800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enum do tipo de exceçao — guardado por pg_type (idempotente).
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_exception_kind') THEN
          CREATE TYPE "store_exception_kind" AS ENUM ('closed', 'custom_hours');
        END IF;
      END $$;
    `);

    // Tabela: date = data civil no fuso da loja (nao UTC).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "store_availability_exceptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "date" date NOT NULL,
        "kind" "store_exception_kind" NOT NULL,
        "open" time NULL,
        "close" time NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_store_availability_exceptions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_exception_tenant_date" UNIQUE ("tenant_id", "date"),
        CONSTRAINT "chk_exception_hours" CHECK (
          ("kind" = 'closed'       AND "open" IS NULL     AND "close" IS NULL) OR
          ("kind" = 'custom_hours' AND "open" IS NOT NULL AND "close" IS NOT NULL)
        )
      )
    `);

    // RLS: isolamento por tenant (padrao 009-rls-force-*.sql).
    await queryRunner.query(
      `ALTER TABLE "store_availability_exceptions" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_availability_exceptions" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename = 'store_availability_exceptions'
             AND policyname = 'store_availability_exceptions_tenant_isolation'
        ) THEN
          EXECUTE $p$
            CREATE POLICY store_availability_exceptions_tenant_isolation
              ON store_availability_exceptions
              FOR ALL
              USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
              WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
          $p$;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "store_availability_exceptions_tenant_isolation" ON "store_availability_exceptions"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "store_availability_exceptions"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "store_exception_kind"`);
  }
}
