import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bloco 2 / Fase A — liga RLS+FORCE + policy de isolamento por tenant nas
 * tabelas que tinham tenant_id mas ficaram sem RLS (defesa-em-profundidade:
 * mesmo que uma query esqueca o filtro de tenant, o banco nao vaza cross-tenant).
 *
 * Cobre so as 6 tabelas VERDES do levantamento (acesso sempre no escopo do
 * tenant, nenhum job de fundo as varre cross-tenant):
 *   - as 4 tabelas de metricas/eventos do WhatsApp (acesso via contexto ALS);
 *   - movimentacoes_estoque_historico (writers/reader ja setam contexto);
 *   - reservas_estoque (tabela morta; estava ENABLE-sem-policy/sem-FORCE).
 *
 * FORA daqui (frentes proprias, ver handoff): whatsapp_carts (job cross-tenant
 * + CartService no DataSource cru) e email_confirmations (sem tenant_id, fluxo
 * pre-login). Ligar RLS nelas sem preparar o codigo quebraria o app em prod.
 *
 * Usa a GUC real do projeto `current_setting('app.current_tenant_id', true)`
 * (missing_ok=true => NULL quando nao setada => 0 linhas, sem erro).
 */
export class EnableRlsOnRemainingTables1751900000000
  implements MigrationInterface
{
  name = 'EnableRlsOnRemainingTables1751900000000';

  private readonly tables = [
    'whatsapp_message_metrics',
    'whatsapp_conversation_metrics',
    'whatsapp_conversion_events',
    'whatsapp_abandonment_events',
    'movimentacoes_estoque_historico',
    'reservas_estoque',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}"`,
      );
      await queryRunner.query(`
        CREATE POLICY "${table}_tenant_isolation" ON "${table}"
          USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
          WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(
        `DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`,
      );
    }
  }
}
