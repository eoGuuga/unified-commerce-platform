import { MigrationInterface, QueryRunner } from 'typeorm';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Migration baseline (sessao 35) - empacota as 14 migrations SQL
 * legadas em scripts/migrations/ dentro de uma migration TypeORM unica,
 * para que clientes novos consigam reproduzir o schema com:
 *
 *   npm run migration:run
 *
 * Antes dela cada migration era rodada manualmente com
 * `docker exec ucm-postgres psql -f <file>`, sem registro automatizado
 * de "qual ja foi aplicada". Esta migration faz a transicao: aplica
 * todas em ordem, idempotente (cada SQL ja usa IF NOT EXISTS / DROP IF
 * EXISTS quando relevante).
 *
 * IMPORTANTE: para tenants ja em producao (gtsofthub.com.br) que
 * rodaram as 14 SQLs manualmente, a tabela typeorm_migrations ainda
 * vai estar vazia. Eles precisam marcar essa migration como aplicada
 * sem reexecutar:
 *
 *   INSERT INTO typeorm_migrations (timestamp, name) VALUES
 *     (1700000000000, 'BaselineFromSqlMigrations1700000000000');
 *
 * Isto eh idempotente em todos os SQLs (CREATE TABLE IF NOT EXISTS,
 * etc), entao reexecutar tambem nao quebra - so cria ruido em logs.
 */

const SQL_FILES: ReadonlyArray<string> = [
  '001-initial-schema.sql',
  '002-security-and-performance.sql',
  '003-whatsapp-conversations.sql',
  '004-audit-log-metadata.sql',
  '005-audit-action-enum-values.sql',
  '006-idempotency.sql',
  '007-add-coupon-code-to-pedidos.sql',
  '008-usuarios-email-unique-por-tenant.sql',
  '009-rls-force-and-extra-policies.sql',
  '010-idempotency-unique-tenant-operation.sql',
  '011-create-pagamentos-table.sql',
  '012-tenants-rls-policy.sql',
  '013-add-customer-notes-to-pedidos.sql',
  '014-tenants-update-policy.sql',
];

function findSqlDir(): string {
  // Em dev: backend/src/database/migrations -> ../../../../scripts/migrations
  // Em prod (dist): backend/dist/database/migrations -> ../../../../scripts/migrations
  const candidates = [
    resolve(__dirname, '..', '..', '..', '..', 'scripts', 'migrations'),
    resolve(__dirname, '..', '..', '..', 'scripts', 'migrations'),
  ];
  for (const dir of candidates) {
    if (existsSync(resolve(dir, SQL_FILES[0]))) {
      return dir;
    }
  }
  throw new Error(
    `Diretorio scripts/migrations nao encontrado a partir de ${__dirname}. ` +
      'Verifique a raiz do repo.',
  );
}

export class BaselineFromSqlMigrations1700000000000 implements MigrationInterface {
  name = 'BaselineFromSqlMigrations1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const sqlDir = findSqlDir();

    for (const file of SQL_FILES) {
      const path = resolve(sqlDir, file);
      const sql = readFileSync(path, 'utf8');
      // eslint-disable-next-line no-console
      console.log(`[migration baseline] aplicando ${file}...`);
      await queryRunner.query(sql);
    }
  }

  public async down(): Promise<void> {
    // A migration baseline NAO pode ser revertida automaticamente -
    // ela engloba 14 mudancas de schema legadas (criacao de tabelas,
    // RLS policies, indices). Para fazer rollback, restaurar dump
    // anterior ou descartar a DB.
    throw new Error(
      'BaselineFromSqlMigrations nao tem down automatico. Restaure backup ' +
        'em vez de tentar reverter.',
    );
  }
}
