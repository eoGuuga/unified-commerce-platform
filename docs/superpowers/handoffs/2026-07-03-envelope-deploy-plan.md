# Plano de deploy — Envelope Encryption Fase 1 — COM MIGRATION + segredo novo no boot

> ✅✅ **EXECUTADO E VALIDADO EM PROD (2026-07-04, `origin/main`=prod=`83b0157`).** Deploy em blocos, seguindo este plano. Boot limpo com a master (health 200, sem erro de master), `tenant_data_keys` com FORCE_RLS=t + `ucm_app` sem contexto→0 + grants ok, dual-format (0 tokens em risco), doceria intacta.
> **LIÇÃO (corrigir o plano/infra):** o passo 4 (migration como ADMIN) **falhou na 1ª tentativa** com `permission denied for schema public` porque o `docker-compose.prod.yml` **não mapeia `DATABASE_ADMIN_URL`** no serviço `backend` — o `run --rm` herdou só `DATABASE_URL` (ucm_app restrito). Estado ficou limpo (TypeORM roda migration em transação → reverteu). **Correção usada:** `DATABASE_ADMIN_URL=<do .env> ; export DATABASE_ADMIN_URL ; docker compose ... run --rm -T -e DATABASE_ADMIN_URL backend node_modules/.bin/typeorm -d dist/database/data-source.js migration:run`. O **`-T` é obrigatório** em script/heredoc (senão o `run` consome o stdin do heredoc e os comandos seguintes não rodam). **Follow-up:** mapear `DATABASE_ADMIN_URL` no compose (ou documentar este padrão) + corrigir o default `/opt/ucm` do `backup-postgres.sh` para `/opt/gtsofthub/backups`.

**Branch:** `security/envelope-encryption-phase1` (mergeada `--no-ff` na main como `83b0157`). **DEPLOYADA.**
**Escopo:** backend (envelope) + 1 migration (`tenant_data_keys`) + 1 segredo novo obrigatório no boot (`ENCRYPTION_MASTER_KEY`) + mapeamento no compose. **Sem mudança de frontend, sem mudança de nginx.**

> ⚠️ **A PEGADINHA SÉRIA (a razão desta etapa ser dedicada):** o boot é **fail-closed** na `ENCRYPTION_MASTER_KEY`. O `docker-compose.prod.yml` já mapeia `ENCRYPTION_MASTER_KEY: ${ENCRYPTION_MASTER_KEY}` — se a var **não estiver no `.env` de prod** na hora do `up`, o Compose substitui por **string vazia**, o `EncryptionService` **recusa subir**, e o backend fica em loop de restart → **502**. Logo: **a master key TEM que estar no `.env` de prod ANTES de qualquer `up` do novo backend.** Este é o passo 1, e não é negociável.

---

## Pré-requisito (ANTES de tocar em qualquer container): a master key

1. **Gerar um aleatório forte, NO SERVIDOR, sem passar pelo chat/histórico.** No servidor:
   ```bash
   openssl rand -hex 32        # 32 bytes = 64 hex chars
   # (ou) node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   - **32+ bytes aleatórios**, não derivado de nada. **DISTINTO** da `ENCRYPTION_KEY` atual (o boot recusa em prod se forem iguais).
2. **Setar no `.env` de prod** (`/opt/gtsofthub/deploy/.env`), sem ecoar o valor em log:
   ```bash
   # anexa a linha sem imprimir o valor:
   printf 'ENCRYPTION_MASTER_KEY=%s\n' "$(openssl rand -hex 32)" >> /opt/gtsofthub/deploy/.env
   ```
   - Conferir que entrou (sem imprimir o valor): `grep -c '^ENCRYPTION_MASTER_KEY=' .env` → `1`.
   - Conferir que é **distinta** da `ENCRYPTION_KEY` (sem imprimir): comparar hashes —
     `awk -F= '/^ENCRYPTION_KEY=/{print $2}' .env | sha256sum` vs `awk -F= '/^ENCRYPTION_MASTER_KEY=/{print $2}' .env | sha256sum` → **hashes diferentes**.
3. **Backup seguro SEPARADO da master key** (fora do servidor, fora do git — ex.: gerenciador de senhas). Se perder a master, perde acesso a **TODAS** as DEKs → a todos os segredos cifrados. **Guardar antes de seguir.**
4. Confirmar que `.env` está gitignored (já está) — a master **nunca** vai pro git.

> A master é o segredo mais poderoso do sistema (protege as chaves de todos os lojistas). Nunca em log, nunca em git, nunca no chat. Na Fase 2 (pagamentos) migra pra um KMS.

---

## Sequência do deploy

### Passo 0 — Backup do banco (rede de segurança da migration)
```bash
cd /opt/gtsofthub/deploy && bash scripts/backup-postgres.sh   # ou o backup canônico em uso
```
Confirmar que o dump tem dados (`tenants`, `produtos`) antes de seguir.

### Passo 1 — Master key no `.env` de prod
Fazer TODO o **Pré-requisito** acima. **PARA e confirma** que a master está no `.env`, forte, distinta, e com backup separado, antes de mexer em container.

### Passo 2 — Merge + push + pull no servidor
```bash
# local:
git checkout main && git merge --no-ff security/envelope-encryption-phase1 && git push origin main
# servidor:
git -C /opt/gtsofthub pull --ff-only
```
O pull traz o `docker-compose.prod.yml` novo (com o mapeamento `ENCRYPTION_MASTER_KEY`) + o código do envelope + a migration.

### Passo 3 — Build `--no-cache` do backend (zero downtime; não toca containers rodando)
```bash
cd /opt/gtsofthub/deploy
docker compose -p deploy -f docker-compose.prod.yml --env-file .env build --no-cache backend
```
**Se o build falhar, PARA** — não sobe imagem quebrada.

### Passo 4 — Migration da `tenant_data_keys` como ADMIN (não como ucm_app)
`ucm_app` não faz DDL. A migration roda como admin, via a data-source **compilada** (`dist`), não `npm run migration:run`.
1. Garantir `DATABASE_ADMIN_URL` no `.env` (admin/superuser; o data-source prefere ela pras migrations).
2. Rodar:
   ```bash
   docker compose -p deploy -f docker-compose.prod.yml --env-file .env run --rm backend \
     node_modules/.bin/typeorm -d dist/database/data-source.js migration:run
   ```
3. Confirmar: log `Migration AddTenantDataKeys1752100000000 has been executed successfully.`
4. **PARA e reporta** o resultado da migration antes do `up`.

### Passo 5 — `up -d` (recria o backend, que agora sobe COM a master key)
```bash
docker compose -p deploy -f docker-compose.prod.yml --env-file .env up -d
```
- Janela breve (~15-30s) de 502 no recreate single-replica (igual aos deploys anteriores).
- O backend novo boota lendo `ENCRYPTION_MASTER_KEY` do `.env` (setada no passo 1) → **não** cai no fail-closed.

---

## Validação pós-deploy (rodar cada uma e reportar)

1. **O app subiu COM a master (o boot fail-closed passou):**
   - `docker compose -p deploy -f docker-compose.prod.yml logs --tail=50 backend` → **sem** `ENCRYPTION_MASTER_KEY deve ser definido`; app "Nest application successfully started".
   - `curl -sf https://gtsofthub.com.br/api/v1/health` → **200** (se o boot tivesse falhado, seria 502 em loop).
2. **App vende (round-trip normal):** login (POST /auth/login → JWT) + uma leitura autenticada → **200**. O fluxo cart/order já foi validado nos blocos anteriores; smoke rápido basta.
3. **Dual-format — o token WhatsApp existente (se houver) ainda decifra:** hoje `whatsapp_cloud_token_encrypted` é `0/1 tenants` (nenhum tenant tem token cifrado), então não há v1 pra migrar — mas SE algum tenant tiver, o `getWhatsappCloudToken` lê o v1 transparente (path v1 usa `ENCRYPTION_KEY`, nem toca a DEK). Conferir (como admin, sem imprimir o token):
   ```sql
   SELECT id, (whatsapp_cloud_token_encrypted IS NOT NULL) AS tem_token,
          left(whatsapp_cloud_token_encrypted, 3) AS prefixo   -- 'v2.' = novo; senão = v1 legado
   FROM tenants;
   ```
   Se algum `tem_token=true`, validar que o resolver do WhatsApp resolve a config desse tenant sem erro (o `whatsapp-config.resolver` chama `getWhatsappCloudToken`). Um token NOVO salvo daqui pra frente sai como `v2.`.
4. **RLS na tabela nova imposto em prod:** `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='tenant_data_keys';` → `t, t`. E `ucm_app` sem contexto lê 0 DEKs.
5. **Doceria intacta:** `tenants=1`, `produtos=69` (sanity de que a migration não mexeu em dado).

---

## Rollback (se algo quebrar)

- **Se o boot cair em fail-closed (502 em loop):** quase sempre é a master ausente/vazia no `.env`. Conferir `grep -c '^ENCRYPTION_MASTER_KEY=' .env` = 1 e que não está vazia; corrigir o `.env` e `up -d` de novo (não precisa rebuild).
- **Se o roteamento/app quebrar por código:** `git revert` do merge na main + `build --no-cache backend` + `up -d` com a imagem anterior.
- **A migration é aditiva e segura de reverter:** o `down()` faz `DROP POLICY` + `DROP TABLE tenant_data_keys` (nenhum dado de negócio nessa tabela ainda). Reverter:
  ```bash
  docker compose ... run --rm backend node_modules/.bin/typeorm -d dist/database/data-source.js migration:revert
  ```
- **Dado:** o backup do passo 0 fica de reserva. Como a mudança **não reescreve** nenhum ciphertext existente (dual-format lê o v1 no lugar), não há migração de dados a desfazer.

---

## Notas

- **Ordem inegociável:** master no `.env` (passo 1) **antes** do `up` (passo 5). É a única pegadinha real desta frente.
- **Sem migração de dados:** o dual-format garante que o que já estava cifrado (v1) continua legível; só o próximo `save` de um segredo vira `v2`. Por isso o deploy é seguro mesmo com token existente.
- **Prioridade:** média — é fundação de segurança (fecha o HIGH da chave única), mas **vira crítica** na frente de recebimento por-lojista (credenciais de pagamento). Deployar quando conveniente, em baixo movimento, com a master já preparada.
- **Fase 2 (depois, junto de pagamentos):** a `ENCRYPTION_MASTER_KEY` migra pra um **KMS** — a master deixa de viver no `.env` (que é o alvo de alto valor enquanto for env).
