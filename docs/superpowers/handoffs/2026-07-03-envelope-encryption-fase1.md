# Envelope Encryption — Fase 1 (per-tenant DEKs) — ✅ APROVADA (fundação pronta, não deployada)

**Branch:** `security/envelope-encryption-phase1` (a partir da `main`=`d3b4b9b`, 3 commits: `384746c`+`f9b3912`+`047135b`). **Guardada localmente, NÃO pushada, NÃO mergeada, NÃO deployada.**
**Data:** 2026-07-03. **Status:** revisada e **aprovada pelo dono**; a fundação de envelope está pronta e provada na branch. Aguarda a **etapa dedicada de deploy** (plano escrito em `2026-07-03-envelope-deploy-plan.md` — tem a pegadinha do boot fail-closed na master key). **Fase 2 = KMS junto da frente de pagamentos.**

## O quê e por quê

Substituir a **`ENCRYPTION_KEY` única global** por **envelope encryption**: uma **master key** (`ENCRYPTION_MASTER_KEY`, KEK, só no env) que **embrulha (wrap)** uma **DEK de 32 bytes por-tenant** (guardada embrulhada em `tenant_data_keys`, sob RLS). Cada segredo do lojista é cifrado com a DEK dele.

- **Raio de dano isolado por-tenant:** a chave de um lojista não abre a de outro.
- **Dump do banco sozinho é inútil:** o dump entrega DEKs *embrulhadas* + ciphertext, mas **sem a master** (que nunca toca o banco) não decifra nada.
- **Abre a porta da rotação** (impossível com a chave única): `key_version` na tabela + no formato v2.
- **Por que agora:** ZERO dado cifrado em prod hoje (`whatsapp_cloud_token` 0/1 tenants; colunas/funções legadas nem existem) → é o momento **mais seguro** para montar a fundação, **antes** de existir credencial de pagamento. Vira **crítico** na frente de recebimento por-lojista.

## O que foi feito (ordem TDD)

1. **Migration** `1752100000000-AddTenantDataKeys.ts`: tabela `tenant_data_keys` (`PK(tenant_id, key_version)`, FK→tenants ON DELETE CASCADE) com **ENABLE + FORCE ROW LEVEL SECURITY** + policy `tenant_data_keys_tenant_isolation` (`USING`/`WITH CHECK` no `app.current_tenant_id`), padrão do Bloco 2.
2. **Teste de isolamento de chave PRIMEIRO** (o coração): `encryption.envelope.spec.ts` — A cifra → B **não** decifra (DEK de B ≠ DEK de A → tag falha → `null`). Guiou a implementação.
3. **Camada envelope** em `encryption.service.ts`:
   - `ENCRYPTION_MASTER_KEY` validada no **boot (fail-closed)**: 32+ chars, sem placeholder; em **prod** recusa subir se **igual** à `ENCRYPTION_KEY` (não reusar).
   - `wrapDek`/`unwrapDek` (master embrulha/desembrulha a DEK). `unwrapDek` **LANÇA** se a master estiver errada (não silencia — é erro de config).
   - `getTenantDek(tenantId, create)`: get-or-create sob RLS (seta contexto → lê/insere só a DEK do tenant). **Cache** de DEK desembrulhada com **TTL (10 min) + bounded (1000) + zeroize** (evicção e `onModuleDestroy` zeram o plaintext em RAM).
4. **API tenant-aware + formato v2 + dual-format:**
   - `encrypt(plaintext, tenantId)` → `v2.<version>.b64(iv).b64(tag).b64(ct)`.
   - `decrypt(ciphertext, tenantId)`: detecta `v2.` (envelope) vs v1 legado (chave única). `null` em falha de **dado** (adulteração / DEK de outro tenant); master errada **propaga** (fica fora do try/catch).
5. **Callers migrados** (interno, assinatura intacta): `saveWhatsappCloudToken`/`getWhatsappCloudToken` agora usam `encrypt`/`decrypt` (envelope + dual-format). `whatsapp-config.resolver.ts` inalterado.
6. **Código morto removido:** `encryptAndSaveApiKey`/`decryptApiKey`/`usesOwnKey` (referenciavam colunas/funções SQL inexistentes) + o campo `encryptionKey`. Zero callers (verificado por grep).
7. **Testes restantes:** round-trip v2, IV não-determinístico, dual-format (lê v1), adulteração→null, formato inválido→null, **master errada→propaga**, idempotência da DEK (cifrar 2x reusa a mesma DEK), boot fail-closed. **RLS integration** (`tenant-data-keys-rls.integration.spec.ts`) sob papel restrito: estrutural (FORCE+policy), READ (sem contexto→0, com A→só A), **WITH CHECK** (sob A, INSERT com tenant_id=B **rejeitado**), fim-a-fim (o `EncryptionService` real sob o papel restrito cifra pra A; B não lê).

## Provas (as duas que o dono pediu)

- **Isolamento de chave (código):** `encryption.envelope.spec.ts` — teste "🎯 a DEK de um tenant NAO decifra o dado de outro" **verde**. Suíte de cripto **15/15** (6 v1 + 9 envelope).
- **RLS na tabela de DEKs (banco):** `tenant-data-keys-rls.integration.spec.ts` **4/4 verde** contra o `ucm_test_motor` (papel restrito NOSUPERUSER/NOBYPASSRLS) — sem contexto→0, WITH CHECK bloqueia plantar chave em outro tenant, e o serviço real isola A de B.

## Segurança da `ENCRYPTION_MASTER_KEY` (o segredo mais poderoso do sistema)

Protege as chaves de **TODOS** os lojistas. Regras:
- **Forte de verdade:** 32+ bytes **aleatórios**, não derivada de nada previsível. Gere: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- **Distinta da `ENCRYPTION_KEY`** (o boot recusa subir em prod se forem iguais).
- **Nunca em log, nunca em git.** Só no `.env` (gitignored) / secret manager. **Backup seguro SEPARADO** (se perder a master, perde acesso a TODAS as DEKs → a todos os segredos cifrados).
- **Boot fail-closed:** o app **recusa subir** sem uma master forte.
- **Fase 2 (pagamentos):** migra para um **KMS**. Enquanto for env, é **alvo de alto valor** — máximo cuidado.

## Limitação honesta (registrada)

O modelo env-master (Fase 1) **NÃO** protege contra vazamento de **env + banco juntos** (quem tem a master + o dump decifra). Isso exige **KMS** (Fase 2, junto com pagamentos), onde a master nunca sai do módulo.

## Config de deploy (para quando o dono aprovar)

- **`.env` de prod precisa de `ENCRYPTION_MASTER_KEY`** (aleatório forte, distinto). Documentado em `deploy/env.prod.example`, `deploy/env.dev.example`, e mapeado no `docker-compose.prod.yml`.
- **Migration em prod:** como admin (`DATABASE_ADMIN_URL`) via `dist/database/data-source.js` (não `npm run migration:run`).
- **Dual-format garante deploy sem migração de dados:** o `whatsapp_cloud_token` v1 existente (se houver) continua legível; só o próximo save vira v2.

## Estado dos testes

- `npm run build`: **OK**.
- Cripto (unit): **15/15**.
- Integração RLS DEKs: **4/4** (+ rls-fase-a/b seguem verdes).
- `.env` de teste ganhou `ENCRYPTION_MASTER_KEY` (test-only) — sem isso o boot fail-closed derruba as suítes que sobem o AppModule (health/idempotency), que é o comportamento **correto**.

## Próximos passos (não nesta fase)

- Revisão do dono → merge `--no-ff` + deploy (setar `ENCRYPTION_MASTER_KEY` no `.env` de prod ANTES do `up`).
- Fase 2: KMS + credenciais de pagamento por-lojista (frente de recebimento).
