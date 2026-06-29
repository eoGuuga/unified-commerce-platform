import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona `scheduled_at timestamptz NULL` em `pedidos` (S2b / Task 5).
 *
 * POR QUE timestamptz NULLABLE:
 * O agendamento so existe para pedidos de RETIRADA (pickup) — o cliente escolhe
 * a hora que vai buscar. Pedidos de entrega/PDV nao tem horario marcado, entao a
 * coluna e NULLABLE. Guardamos o INSTANTE (timestamptz, com timezone) e nao um
 * horario "solto", para que a comparacao com o horario de funcionamento da loja
 * (em business_hours.tz) seja feita sobre um ponto no tempo bem-definido, sem
 * ambiguidade de fuso.
 */
export class AddScheduledAtToPedidos1751700000000
  implements MigrationInterface
{
  name = 'AddScheduledAtToPedidos1751700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pedidos"
      ADD COLUMN IF NOT EXISTS "scheduled_at" timestamptz NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pedidos" DROP COLUMN IF EXISTS "scheduled_at"`,
    );
  }
}
