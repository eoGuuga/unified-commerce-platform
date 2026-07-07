import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bloco 2 / Fase B — liga RLS+FORCE em whatsapp_carts e cria a primitiva de
 * enumeracao de tenants usada pelo job de fundo (StockSweeper).
 *
 * whatsapp_carts guarda telefone do cliente + financeiro do carrinho e era a
 * ultima tabela sensivel sem RLS. Diferente da Fase A, aqui o acesso NAO era
 * todo no escopo do tenant: o CartService lia/gravava no DataSource cru e o
 * @Cron StockSweeper varria a tabela cross-tenant sem contexto. O codigo foi
 * ajustado (contexto por-tenant) junto com esta migration.
 *
 * `app_list_tenant_ids()` — SECURITY DEFINER: roda com o privilegio do dono da
 * funcao (papel de migration/admin), que enxerga todos os tenants, mas retorna
 * SO os UUIDs (dado nao-sensivel; tenant id ja aparece em URL de webhook). Serve
 * para o sweeper enumerar os tenants a varrer SEM que o papel do app precise de
 * BYPASSRLS — o app segue NOSUPERUSER, sem bypass de RLS em nenhuma tabela.
 * Um papel BYPASSRLS dedicado ao job seria superficie muito maior (bypass de
 * RLS em TUDO). Acesso a funcao e DB-interno (so os papeis do app conectam).
 */
export class EnableRlsOnWhatsappCarts1752000000000 implements MigrationInterface {
  name = 'EnableRlsOnWhatsappCarts1752000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Primitiva de enumeracao de tenants (para jobs de fundo).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION app_list_tenant_ids()
      RETURNS SETOF uuid
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = pg_catalog, public
      STABLE
      AS $fn$ SELECT id FROM public.tenants $fn$
    `);

    // 2) RLS + FORCE + policy de isolamento por tenant em whatsapp_carts.
    await queryRunner.query(
      `ALTER TABLE "whatsapp_carts" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_carts" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `DROP POLICY IF EXISTS "whatsapp_carts_tenant_isolation" ON "whatsapp_carts"`,
    );
    await queryRunner.query(`
      CREATE POLICY "whatsapp_carts_tenant_isolation" ON "whatsapp_carts"
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY IF EXISTS "whatsapp_carts_tenant_isolation" ON "whatsapp_carts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_carts" NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "whatsapp_carts" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS app_list_tenant_ids()`);
  }
}
