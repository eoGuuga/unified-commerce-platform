/**
 * TypeORM DataSource standalone usado pela CLI (`typeorm migration:*`).
 *
 * Le DATABASE_URL do .env e aponta pras entities + migrations no
 * src/database/. Em runtime da app o NestJS usa databaseConfig em
 * config/database.config.ts (com mesmas entities), entao o schema
 * gerado por migration:generate fica compativel.
 *
 * Uso:
 *   npm run migration:run        # aplica migrations pendentes
 *   npm run migration:generate -- src/database/migrations/MyName
 *   npm run migration:revert
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { resolve } from 'node:path';

// Carrega .env do root do backend antes de instanciar DataSource.
// dotenv eh dep transitiva (via @nestjs/config); o require sob try/catch
// evita quebrar caso esteja ausente - em CI as env vars vem do processo.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const dotenv = require('dotenv') as { config: (opts: { path: string }) => void };
  dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });
} catch {
  // dotenv ausente - usa env vars do processo direto.
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL nao definido. Copie deploy/env.dev.example para backend/.env ' +
      'antes de rodar migrations.',
  );
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  // Glob aponta pra src/ em dev (ts-node) e dist/ em prod (compilado).
  // Usar ambos garante que CLI roda em qualquer ambiente.
  entities: [
    resolve(__dirname, '..', 'database', 'entities', '*.entity.{ts,js}'),
  ],
  migrations: [
    resolve(__dirname, 'migrations', '*.{ts,js}'),
  ],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl: databaseUrl.includes('supabase')
    ? { rejectUnauthorized: false }
    : false,
});

// Permite rodar `ts-node src/database/data-source.ts` para sanity check.
if (require.main === module) {
  AppDataSource.initialize()
    .then(() => {
      console.log('✓ DataSource conectado:', databaseUrl.replace(/:[^:@]+@/, ':***@'));
      return AppDataSource.destroy();
    })
    .catch((err) => {
      console.error('✗ Falha ao conectar:', err.message);
      process.exit(1);
    });
}
