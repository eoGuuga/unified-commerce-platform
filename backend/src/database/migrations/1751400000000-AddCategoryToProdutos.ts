import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryToProdutos1751400000000 implements MigrationInterface {
  name = 'AddCategoryToProdutos1751400000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "produtos" ADD COLUMN IF NOT EXISTS "category" character varying(100)`,
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "produtos" DROP COLUMN IF EXISTS "category"`);
  }
}
