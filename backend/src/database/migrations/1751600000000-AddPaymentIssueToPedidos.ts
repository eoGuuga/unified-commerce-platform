import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona o flag tipado `payment_issue` em `pedidos` (Ajuste 3 / S3).
 *
 * POR QUE UMA COLUNA BOOLEANA DEDICADA, E NAO UM VALOR DE STATUS:
 * `PedidoStatus` e um enum de COLUNA UNICA que rastreia o CICLO DE VIDA do pedido
 * (pendente_pagamento -> confirmado -> em_producao -> ...). Uma falha ao gerar o PIX
 * e ORTOGONAL a esse ciclo: o pedido continua `pendente_pagamento`, apenas SINALIZADO
 * de que algo deu errado na cobranca. Colocar isso como um valor de status conflitaria
 * com as transicoes do ciclo (qual transicao sai de "payment_issue"?). Por isso usamos
 * um flag booleano ortogonal e CONSULTAVEL: "achar pedidos com falha de PIX" vira um
 * WHERE estruturado e INDEXADO, nao um LIKE '%...%' em customer_notes.
 *
 * INDICE PARCIAL: indexa apenas as linhas com payment_issue = true (a minoria),
 * para que o filtro do Admin ("pedidos que precisam de atencao") seja um lookup
 * indexado barato em vez de um scan na tabela inteira.
 */
export class AddPaymentIssueToPedidos1751600000000
  implements MigrationInterface
{
  name = 'AddPaymentIssueToPedidos1751600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pedidos"
      ADD COLUMN IF NOT EXISTS "payment_issue" boolean NOT NULL DEFAULT false
    `);

    // Indice parcial: so as linhas sinalizadas entram no indice. Torna o filtro
    // "WHERE payment_issue = true" (por tenant) um lookup indexado, nao um scan.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pedidos_payment_issue"
      ON "pedidos" ("tenant_id")
      WHERE "payment_issue" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_pedidos_payment_issue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" DROP COLUMN IF EXISTS "payment_issue"`,
    );
  }
}
