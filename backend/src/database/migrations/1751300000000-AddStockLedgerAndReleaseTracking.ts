import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStockLedgerAndReleaseTracking1751300000000
  implements MigrationInterface
{
  name = 'AddStockLedgerAndReleaseTracking1751300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enum de tipos de movimentação
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ledger_tipo_enum" AS ENUM (
          'INVENTARIO_INICIAL','VENDA','COMPRA','AJUSTE','PERDA','DEVOLUCAO'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // Tabela ledger
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "movimentacoes_estoque_historico" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "produto_id" uuid NOT NULL,
        "tipo" "ledger_tipo_enum" NOT NULL,
        "delta" integer NOT NULL,
        "saldo_resultante" integer NOT NULL,
        "motivo" text,
        "order_id" uuid,
        "usuario_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_movimentacoes_estoque_historico" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_tenant_produto"
      ON "movimentacoes_estoque_historico" ("tenant_id", "produto_id")
    `);

    // Idempotência: uma baixa VENDA por (pedido, produto)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_ledger_venda_por_item"
      ON "movimentacoes_estoque_historico" ("order_id", "produto_id")
      WHERE "tipo" = 'VENDA'
    `);

    // Colunas de rastreio de liberação de reserva
    await queryRunner.query(`
      ALTER TABLE "pedidos"
      ADD COLUMN IF NOT EXISTS "stock_released_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      ALTER TABLE "whatsapp_carts"
      ADD COLUMN IF NOT EXISTS "stock_released_at" TIMESTAMP WITH TIME ZONE
    `);

    // Backfill INVENTARIO_INICIAL — atômico (INSERT ... SELECT), idempotente
    await queryRunner.query(`
      INSERT INTO "movimentacoes_estoque_historico"
        (id, tenant_id, produto_id, tipo, delta, saldo_resultante, created_at)
      SELECT uuid_generate_v4(), me.tenant_id, me.produto_id,
             'INVENTARIO_INICIAL', me.current_stock, me.current_stock, now()
      FROM "movimentacoes_estoque" me
      WHERE me.current_stock > 0
        AND NOT EXISTS (
          SELECT 1 FROM "movimentacoes_estoque_historico" h
          WHERE h.produto_id = me.produto_id AND h.tipo = 'INVENTARIO_INICIAL'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "whatsapp_carts" DROP COLUMN IF EXISTS "stock_released_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" DROP COLUMN IF EXISTS "stock_released_at"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "movimentacoes_estoque_historico"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "ledger_tipo_enum"`);
  }
}
