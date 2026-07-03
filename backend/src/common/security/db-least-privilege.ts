import type { DataSource } from 'typeorm';

/**
 * Falha-fechado: recusa subir se o app estiver conectado ao Postgres como um
 * papel PRIVILEGIADO (superuser ou BYPASSRLS). Papeis assim IGNORAM o RLS, o
 * que anularia todo o isolamento multi-tenant — o app tem que rodar como um
 * papel restrito (ex.: ucm_app: NOSUPERUSER NOBYPASSRLS).
 *
 * Defesa-em-profundidade: mesmo que alguem aponte o DATABASE_URL para o
 * superuser por engano, o boot em producao aborta em vez de rodar com o
 * isolamento silenciosamente desligado.
 */
export async function assertDatabaseLeastPrivilege(
  dataSource: Pick<DataSource, 'query'>,
): Promise<void> {
  const rows: Array<{
    is_superuser: string;
    bypassrls: boolean | null;
    usr: string;
  }> = await dataSource.query(
    `SELECT current_setting('is_superuser') AS is_superuser,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypassrls,
            current_user AS usr`,
  );

  const row = rows?.[0];
  if (!row) {
    throw new Error(
      '[SECURITY] Nao foi possivel verificar o privilegio do papel do banco.',
    );
  }

  const isSuperuser = String(row.is_superuser).toLowerCase() === 'on';
  const bypassesRls = row.bypassrls === true;
  if (isSuperuser || bypassesRls) {
    throw new Error(
      `[SECURITY] App conectado ao Postgres como papel privilegiado ` +
        `(user=${row.usr}, superuser=${row.is_superuser}, bypassrls=${row.bypassrls}). ` +
        `Papeis privilegiados IGNORAM o RLS e quebram o isolamento multi-tenant. ` +
        `Use um papel NOSUPERUSER NOBYPASSRLS (ex.: ucm_app).`,
    );
  }
}
