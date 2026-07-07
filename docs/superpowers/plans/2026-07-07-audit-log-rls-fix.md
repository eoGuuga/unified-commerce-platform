# Runbook — Fix do audit-log sem contexto RLS (com TDD)

> **Data:** 2026-07-07 · **Branch:** `fix/audit-log-rls-context` (commit `0558d66`, **verde**) · **Status:** código verde e provado; **deploy em prod é passo separado** (decisão do dono) com validação.
> Achado pela observabilidade (o alerta de app Tier 1-lite de 2026-07-07 pescou `AuthService: "Erro ao registrar audit log de login"`).

## Causa raiz (provada)
`audit_log` tem **RLS FORCE** + policy `WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)`. O `AuditLogService.log()` rodava no manager ambiente; de um fluxo **@Public sem contexto de tenant** (login, checkout público em prod) caía no `dataSource.manager` default (conexão do pool **sem** `app.current_tenant_id`) → o **INSERT era rejeitado pelo RLS** e o audit se perdia. Em prod: **0 audits de LOGIN em 10 dias** (o login funciona; o rastro não grava).
- **Não é intermitente — é 100% quebrado** em prod. O "5 erros/7d" era só o volume de login (5 logins, todos falharam). Prova: `audit_log` tinha 6 linhas (4 CREATE + 2 UPDATE, de fluxos **autenticados** que TÊM contexto), **0 LOGIN**.
- **Invisível em teste:** os `*.integration.spec` conectam como **superuser (postgres), que BYPASSA RLS** → nunca reproduziam.

## O fix (Opção 1 — na raiz)
`AuditLogService.log()` seta o **próprio contexto RLS** a partir do `tenantId` do parâmetro:
```ts
return this.db.runInTransaction(async (manager) => {
  await manager.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [params.tenantId]);
  const repo = manager.getRepository(AuditLog);
  return repo.save(repo.create({ tenant_id: params.tenantId, /* ... */ }));
});
```
- **`runInTransaction` reusa a transação ambiente se houver** (fluxos autenticados = comportamento igual) ou **abre uma nova** (fluxos @Public = fixados). Conserta **login + checkout público + LGPD de uma vez**.
- `tenantId` é fonte confiável (no login = `usuario.tenant_id` recarregado do banco). O `set_config` grava com o tenant **do dono do evento** — sem brecha; ao contrário, força o tenant certo.
- **+ logging:** o `logger.error('msg', {obj})` dropava o 2º arg (o logger JSON não serializa) → a causa do banco ia NA string da mensagem. Sem PII (uuids + o texto do erro do RLS).

## Varredura dos 6 call-sites
| Call-site | Antes | Com o fix |
|---|---|---|
| `auth.service.ts:126` (login, @Public) | ❌ quebrado 100% | ✅ |
| `orders.service.ts:399` (checkout `@Public`) | ❌ quebrado no público | ✅ |
| `lgpd.service.ts:216` (anonimização, fora da tx) | ⚠️ risco | ✅ |
| `products.service.ts:302/356/410` (autenticado) | ✅ já funcionava | ✅ (no-op seguro) |
O fix cobre os 3 quebrados/risco de uma vez.

## TDD (RED→GREEN sob papel RLS-enforced)
`backend/src/modules/common/services/audit-log.service.integration.spec.ts` — roda sob **`ucm_rls_probe`** (NOSUPERUSER NOBYPASSRLS, espelho do `ucm_app`), não o superuser dos outros specs.
- **RED (antes):** `audit.log()` sem contexto → `QueryFailedError: new row violates row-level security policy for table "audit_log"`.
- **GREEN (depois):** grava com o tenant certo.
- + teste de CONTRASTE (INSERT direto sem contexto é rejeitado) documenta o mecanismo.

## Baseline / regressão (verde)
- `npm run build` ✅ · `eslint` (arquivos tocados) ✅.
- `audit-log.service.integration` ✅ (RED→GREEN) · `auth.service.spec` ✅ · `products.integration` ✅ · `lgpd.service.spec` ✅ (9/9).
- `orders.integration`: **3 falhas = BASELINE conhecido** (`duplicate key idx_produtos_tenant_sku_unique` — SKU acumulado no `ucm_test_motor`, já no roadmap; criação de produto, **nada** de audit/RLS). NÃO é regressão deste fix.

## Deploy em prod (passo SEPARADO — dono decide) + validação
1. Merge `fix/audit-log-rls-context` → `main` → push → `git pull` no servidor (deploy de código = rebuild do backend). *(Este fix mexe no app → precisa rebuild/restart do container backend, diferente dos scripts dormentes.)*
2. **Validação (sem esperar dias):** um **login de teste** → `SELECT count(*) FROM audit_log WHERE action='LOGIN' AND created_at > now()-interval '5 min'` deve dar **≥1** → prova que grava agora.
3. **Regressão em prod:** editar um produto → confirmar audit CREATE/UPDATE ainda grava.

## Gap histórico (irrecuperável — documentado)
Os logins de prod **de ~2026-07-04 (primeiro erro visto) até a data do deploy do fix** não têm rastro de auditoria (o audit nunca gravou). **Perda histórica não recuperável** — o evento se foi. A partir do fix, grava.
