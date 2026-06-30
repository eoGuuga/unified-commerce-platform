import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona constraint UNIQUE composta (tenant_id, sku) na tabela produtos.
 *
 * O índice simples idx_produtos_sku (não único) existia desde a baseline.
 * Esta migration o substitui pelo índice único composto que o entity
 * @Index(['tenant_id', 'sku'], { unique: true }) declara.
 *
 * O índice é PARTIAL (WHERE sku IS NOT NULL) para que produtos sem SKU
 * não entrem em conflito entre si — só SKUs preenchidos precisam ser únicos
 * por tenant.
 *
 * Antes de criar o índice, deduplicamos SKUs existentes adicionando sufixo
 * numérico nos registros duplicados (mais novos mantêm o SKU original o mais
 * antigo; os subsequentes recebem -2, -3, etc.).
 */
export class AddSkuUniqueConstraintToProdutos1751500000000 implements MigrationInterface {
  name = 'AddSkuUniqueConstraintToProdutos1751500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Passo 1: deduplica SKUs existentes sem alterar o registro mais antigo.
    // Para cada (tenant_id, sku) duplicado, os registros mais novos (rank > 1)
    // recebem sufixo "-<rank>" para resolver a colisão antes de criar o índice.
    await queryRunner.query(`
      WITH duplicatas AS (
        SELECT
          id,
          tenant_id,
          sku,
          ROW_NUMBER() OVER (
            PARTITION BY tenant_id, sku
            ORDER BY created_at ASC, id ASC
          ) AS rn
        FROM produtos
        WHERE sku IS NOT NULL
      )
      UPDATE produtos p
      SET sku = p.sku || '-' || d.rn
      FROM duplicatas d
      WHERE p.id = d.id AND d.rn > 1
    `);

    // Passo 2: remover índice simples legado (não único) se existir
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_produtos_sku
    `);

    // Passo 3: criar índice único composto por tenant (parcial: só quando sku IS NOT NULL)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_tenant_sku_unique
      ON produtos (tenant_id, sku)
      WHERE sku IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_produtos_tenant_sku_unique
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_produtos_sku ON produtos (sku)
    `);
  }
}
