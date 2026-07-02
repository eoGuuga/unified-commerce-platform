# Follow-ups pós-faxina do servidor (VPS gtsofthub.com.br)

**Origem:** frente "Faxina completa do servidor" (spec/plano `2026-07-01-server-cleanup*`).
**Contexto:** o swap (Etapa 4) foi concluído — prod roda de `/opt/gtsofthub` (código = `origin/main`, reproduzível). Estes são os pendentes que **não** entraram no swap.

---

## 🔴 ESSENCIAL — fechar ANTES de 10/set/2026 (senão o site cai)

### F1 — Deploy-hook do certbot p/ recarregar o nginx em container
**Problema:** o nginx roda em container e monta a árvore real do certbot (`/etc/letsencrypt` → `live/gtsofthub.com.br/`). O certbot **renova os arquivos** do cert automaticamente (~11/ago, cert válido até **10/set**), **mas o nginx só carrega o cert novo após um `nginx -s reload`**. Sem um hook de renovação, o certbot renova, o nginx continua servindo o cert velho, e em **10/set/2026 o HTTPS cai** (cert expirado).

**O que fazer:** adicionar um `deploy-hook` do certbot que recarrega o nginx do container após cada renovação. Ex.:
- `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` com:
  ```sh
  #!/bin/sh
  docker exec ucm-nginx nginx -s reload
  ```
  (`chmod +x`) — roda automaticamente após toda renovação bem-sucedida.
- **Validar:** `certbot renew --dry-run` e conferir que o hook dispara o reload.

**Urgência:** não é urgente HOJE (cert válido até 10/set), mas é **obrigatório** fechar antes disso.

---

## 🟡 Limpeza (Etapa 6 da faxina — quando chegar lá)

### F2 — Snapshot de certs órfão
`/opt/gtsofthub/certs/` (cert.pem/chain/fullchain/privkey, SAN só gtsofthub+www) virou **órfão**: o compose voltou a montar `/etc/letsencrypt` e não referencia mais esse dir. Remover na Etapa 6.

### F3 — Upstreams `_test` mortos no nginx.conf (ruído no log)
`ucm.conf` ainda define `upstream ucm_backend_test`/`ucm_frontend_test` (apontam pra `ucm-backend-test`/`ucm-frontend-test`, que nunca sobem). Com `resolve`, o `resolver 127.0.0.11` tenta re-resolvê-los a cada ~5s e loga `could not be resolved` — **puro ruído** (nenhum request usa mais esses upstreams após o fix do D1). Remover os 2 blocos `upstream *_test` do `ucm.conf` pra silenciar o log.

### F4 — Backups temporários do swap
No `/opt/gtsofthub/deploy/`: `docker-compose.prod.yml.bak-preswap`, `.bak-certfix`, `nginx/ucm.conf.bak-certfix`, `nginx/ucm.conf.bak-devfix`. Remover quando o swap estiver 100% consolidado.

---

## 🟢 Débito de configuração (rastreabilidade)

### F5 — Sincronizar o `ucm.conf` do repo (abordagem B)
**Atualização 2026-07-02:** o `ucm.conf` do servidor diverge do repo por 3 edições ao vivo: (a) cert paths → `/etc/letsencrypt/live/gtsofthub.com.br/`; (b) upstreams do dev → prod (D1); (c) **server-block do dev REMOVIDO (dev aposentado)**. Sincronizar tudo isso pro repo numa frente própria. *(O `docker-compose.prod.yml` já está em sync — o cert-mount reverteu ao original e o build-arg do T3 foi commitado/pushado.)*

O `ucm.conf` e o `docker-compose.prod.yml` que estão rodando (em `/opt/gtsofthub/deploy`, com as correções de cert + D1 do dev) **divergem do repo**. Trazer essas mudanças pro repo (`origin/main`) pra o deploy ser 100% reproduzível a partir de um `git pull` limpo. **Sem** copiar certs/segredos pro repo. Vira frente própria (spec→plano).

### F6 — Cron `StockSweeperService` logando "falhou" a cada minuto
`sweepExpiredCarts`/`sweepExpiredPendingOrders` falham periodicamente (log não mostra o motivo). **Investigar DEPOIS da Etapa 5** — o banco vai ser zerado/reseedado, o que pode mudar o comportamento. Não trava nada agora (app serve normal).

### F7 — Warning `listen ... http2` deprecado
`ucm.conf` usa `listen 443 ssl http2;` (sintaxe antiga; nginx 1.27 recomenda `http2 on;`). Só um `[warn]`, cosmético. Ajustar junto com o F5.

### F8 — Dockerfile do backend não embute `scripts/migrations/` 🟡 (pré-req da Etapa 7)
Os 14 SQLs do baseline vivem na **raiz do repo** (`scripts/migrations/`), **fora** do contexto de build do backend (`backend/`) → nunca entram na imagem. O `BaselineFromSqlMigrations` lê esses arquivos → sem eles, `migration:run` lança erro e não cria tabela.
**Contorno usado na prova/Etapa 5:** montar `-v /opt/gtsofthub/scripts:/app/scripts:ro` no container que roda a migration. **Fix definitivo (p/ deploy.sh):** mudar o contexto de build pra raiz do repo (+ `COPY scripts`) OU mover `scripts/migrations` pra `backend/scripts/migrations` (+ ajustar `findSqlDir`) + `COPY` no Dockerfile. Sem isso o `deploy.sh` depende do mount manual.

### F9 — Senha do superuser `postgres` não bate por TCP 🟡 (latente)
O `pg_hba` tem `host all all all scram-sha-256`, mas a senha guardada do role `postgres` no volume **não** é igual ao `POSTGRES_PASSWORD` atual do env (o volume foi init com outra senha, e o env mudou depois). Sintoma: `postgres` por TCP de outro container → `password authentication failed`. O socket local usa `trust`, então `docker exec … psql -U postgres` sempre funcionou (ignora a senha) e mascarou isso. O **app não é afetado** (conecta como `ucm_app`, cuja senha bate).
**Contorno usado na prova/Etapa 5:** rodar a migration compartilhando o netns do postgres (`--network container:ucm-postgres`) + conectar em `127.0.0.1` (que o pg_hba trata como `trust`, sem senha). **Fix definitivo:** `ALTER ROLE postgres PASSWORD '<POSTGRES_PASSWORD>'` (via socket) pra sincronizar. Não-urgente; só o caminho admin/TCP depende disso.

### F10 — Entidades sem migration: `webhook_events` e `usage_logs` 🟠 (verificar uso)
`WebhookEvent.entity.ts` (`webhook_events`) e `UsageLog.entity.ts` (`usage_logs`) existem no código, mas **nenhuma migration cria essas tabelas** — provado: após um `migration:run` do zero, ambas ficam **MISSING**. Mesma classe de bug do 500 da Camada 2 (entidade × tabela ausente), mas **pré-existente** (o prod legado também não as tem; a Etapa 5 não piora — só não resolve estas duas).
**A fazer:** (1) verificar se o código **consulta** essas entidades em caminho ativo (se sim, esses endpoints hoje dão 500); (2) gerar as migrations que faltam (`migration:generate`) e aplicá-las. Não bloqueia a Etapa 5, mas fecha o mesmo tipo de furo.

## 🟢 Follow-ups de produto (frente de polimento pós-faxina — NÃO agora)

### F13 — Logout zumbi
Clicar em "sair" muda o nome pro genérico "usuário" mas **não redireciona nem limpa a sessão** — só sai de fato recarregando a página. Provável: o handler de logout no front não limpa token/estado (`localStorage` `token`/`tenant_id`) e/ou não faz `redirect` pra `/login`. Corrigir o fluxo de logout (limpar + redirecionar).

### F14 — Campo "informar workspace" ainda aparece no login
Mesmo com o tenant configurado (T3), o campo/botão "informar workspace" ainda aparece no login. O login **funciona** (cosmético). Confirmar se é build/cache velho servido ou lógica remanescente no `LoginExperience.tsx`; ajustar pra o campo ficar oculto no caso single-tenant.

---

### F12 — Remover a criação do admin default do código da migration 🟠 (segurança)
`scripts/migrations/001-initial-schema.sql:365-382` semeia um tenant "Loja de Exemplo" (`000…000`) + admin `admin@exemplo.com` com `crypt('admin123', gen_salt('bf'))` — **backdoor de credencial conhecida** em **qualquer** banco novo (provado na T1: apareceu no banco fresco). O T2.5b remove pra ESTE servidor (DELETE), mas o **código** ainda criaria em bancos futuros. **A fazer:** remover esse INSERT do `001-initial-schema.sql` (ou condicioná-lo a um env de dev, nunca em prod). Fecha o furo na origem, não só neste servidor.

### F11 — Trocar a senha do admin por uma definitiva antes da produção real 🟠 (QA→prod)
A senha do admin (`admin@loja.com`) gerada na Etapa 5 **passou pelo chat** — serve pra fase de **QA/testes**. Antes de a doceria ir pra **produção real** (a mãe operando, clientes reais), trocar por uma senha definitiva que **nunca** passou por canal registrado (o dono define e aplica via `SEED_ADMIN_PASSWORD` ou troca de senha no app). Não-urgente; é higiene de QA→prod.

---

## ✅ Receita da Etapa 5 PROVADA (2026-07-02, em banco de teste descartável)
`migration:run` do zero roda **limpo**: 11/11 migrations aplicadas, 23 tabelas criadas (incl. `store_availability_exceptions`), RLS enabled+forced, e o `ucm_app` (restrito) lê sob RLS sem permission denied. Sequência validada:
1. Zerar schema (`DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ... postgres`).
2. Migrar como admin: container one-off da imagem `deploy-backend:latest`, `--network container:ucm-postgres`, `DATABASE_URL=postgresql://postgres@127.0.0.1:5432/ucm`, `-v /opt/gtsofthub/scripts:/app/scripts:ro`, `node_modules/.bin/typeorm -d dist/database/data-source.js migration:run`.
3. Restaurar grants do `ucm_app` (`provision-db-user.sh` — GRANTs + ALTER DEFAULT PRIVILEGES) pós-schema.
4. Seed da doceria com **UUID real (não `000…000`)** — amarra o fix do login (NEXT_PUBLIC_TENANT_ID).
