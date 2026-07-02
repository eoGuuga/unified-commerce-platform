# Follow-ups pós-faxina do servidor (VPS gtsofthub.com.br)

**Origem:** frente "Faxina completa do servidor" (spec/plano `2026-07-01-server-cleanup*`).
**Contexto:** o swap (Etapa 4) foi concluído — prod roda de `/opt/gtsofthub` (código = `origin/main`, reproduzível). Estes são os pendentes que **não** entraram no swap.

**STATUS 2026-07-02 — FAXINA COMPLETA (Etapas 4→7).** ✅ FEITOS: swap, banco limpo + seed da doceria (UUID `2675a300-…`), backdoor removido, dev aposentado, **F1** (cert deploy-hook — `certbot renew --dry-run` passou), **F5** (servidor = espelho fiel do GitHub), **`deploy.sh`** (deploy num comando, testado). ⏳ PENDENTES INFRA (não-urgente): **F8** (mover `scripts/migrations` p/ `backend/` + `COPY` no Dockerfile), **F6, F9, F10, F12**, **F16** (confiabilidade do `deploy.sh`). **F11 SUBIU de prioridade** (trocar senha admin antes da prod real). **F13** e **F14** resolvidos no polimento.

**STATUS 2026-07-02 — FRENTE DE POLIMENTO (22 bugs) CONCLUÍDA, DEPLOYADA E VALIDADA.** ✅ Os 22 itens do mapa fechados em 4 blocos temáticos (branches `fix/polish-bloco1..4`, mergeadas na `main` com `--no-ff`, ordem 1→2→3→4):
- **Reais consertados:** K1 (logout redireciona), K3 (horário abre<fecha), A4/A5 (reset de estado), B1–B6 (normalização central de erros de API — nunca vaza técnico), C1–C4 (validações: checkout com CPF/CNPJ/e-mail/telefone, margem negativa, feedback do mínimo, ajuste valida antes), D1 (estados de botão "Atualizando…"/"Salvando…").
- **Falso-positivos PROVADOS com teste-guarda** (não "consertados" à toa): A1/A2/A3/A6 (React reseta por desmontagem), C5 (máscara BR de moeda já existia e testada).
- **Voz do produto** (D2/D3/K2): zero jargão "workspace/UUID/end-to-end/ecossistema/bot" no app do lojista; capacidade multi-loja PRESERVADA (só a UI recolhida).
- **Estado:** código na `main` (`b5bf26b`), pushado, **deployado no ar com build limpo `--no-cache`**, **validado pelo dono no navegador** (login limpo, logout redireciona de verdade, erro amigável "E-mail ou senha incorretos"). **471 testes verdes**, type-check limpo. Detalhe durável nos commits + mensagens de merge.

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

### F16 — `deploy.sh` faz build CACHEADO + `apply-and-health.sh` aponta pro `/opt/ucm` removido 🟠 (confiabilidade do deploy)
Descoberto no deploy do polimento (2026-07-02). Dois defeitos que tornam o deploy "num comando" não-confiável:
- **(a) build cacheado:** `deploy/scripts/deploy.sh` roda `docker compose ... build` **sem `--no-cache`** → risco de subir versão meio-velha (o gotcha Turbopack/cache). No deploy do polimento rodei os passos manualmente com `--no-cache` pra garantir a versão certa no ar. **Fix:** `--no-cache` (ou um flag `--fresh`) no build do deploy.sh, ou garantir rebuild total de backend+frontend.
- **(b) path morto:** `deploy/scripts/apply-and-health.sh` usa `repo_root="/opt/ucm"` — dir **removido na faxina** (prod agora é `/opt/gtsofthub`). O script está quebrado. **Fix:** atualizar o path pra `/opt/gtsofthub` ou remover o script (o `deploy.sh` já cobre o deploy).

Sem isso, o próximo deploy automático ou sobe cacheado (a) ou falha (b).

## 🟢 Follow-ups de produto (frente de polimento — ✅ CONCLUÍDA 2026-07-02; resta só F15 pra frente futura)

### F13 — Logout zumbi ✅ RESOLVIDO (Bloco 2 do polimento — K1)
Clicar em "sair" mudava o nome pro genérico "usuário" mas **não redirecionava nem limpava a sessão** — só saía de fato recarregando a página. **Raiz (K1):** `useAuth` é estado **POR-INSTÂNCIA** (não há context/store compartilhado), então o `logout` resetava só a instância do botão, deixando o resto da tela "zumbi". **Fix:** o `logout` em `useAuth.ts` agora faz `window.location.replace('/login')` (limpa `token`/`tenant_id` + navega pra fora, garantindo o logout limpo). **Validado pelo dono no navegador (2026-07-02).**

### F14 — Link "informar workspace" no login (UX, NÃO bug — reclassificado 2026-07-02) ✅ RESOLVIDO
Validação do dono: o T3 **funcionou** — o workspace está recolhido num **link opcional** "INFORMAR WORKSPACE" (não um campo aberto), e o login funciona sem tocá-lo. Não é bug. **Resolvido no Bloco 4 do polimento (voz):** o toggle "Informar workspace" + o campo agora só aparecem no modo **multi-tenant** (`TENANT_ID === SENTINEL`); no single-tenant atual ficam **recolhidos**, com a **lógica multi-loja preservada** (`workspaceSelectable` em `LoginExperience.tsx`). Reativa sozinho se o tenant voltar ao sentinel.

### F15 — Ligar ou remover o OnboardingPanel (código morto) 🔵 (frente futura)
`components/admin/OnboardingPanel.tsx` é um painel de onboarding pós-login COMPLETO (welcomeName, trilha de passos, progresso, atalhos PDV/vitrine) mas **não é renderizado em lugar nenhum** (sem import, sem `<OnboardingPanel`). Descoberto na varredura de copy do Bloco 4. Contém o jargão inglês **"command center"** (L74) — que só importa se o painel for ligado. **A fazer (frente futura):** decidir entre **ligar** no AdminShell (onboarding guiado ao lojista) ou **remover** o componente. Se ligar: trocar "command center" por linguagem do lojista e garantir `workspaceLabel` = nome da loja (não UUID). Baixa prioridade.

---

### F12 — Remover a criação do admin default do código da migration 🟠 (segurança)
`scripts/migrations/001-initial-schema.sql:365-382` semeia um tenant "Loja de Exemplo" (`000…000`) + admin `admin@exemplo.com` com `crypt('admin123', gen_salt('bf'))` — **backdoor de credencial conhecida** em **qualquer** banco novo (provado na T1: apareceu no banco fresco). O T2.5b remove pra ESTE servidor (DELETE), mas o **código** ainda criaria em bancos futuros. **A fazer:** remover esse INSERT do `001-initial-schema.sql` (ou condicioná-lo a um env de dev, nunca em prod). Fecha o furo na origem, não só neste servidor.

### F11 — Trocar a senha do admin por uma definitiva antes da produção real 🔴 (SUBIU 2026-07-02 — tudo público agora)
**⬆️ Prioridade elevada:** com o polimento **no ar e público**, a doceria pode ir pra produção real a qualquer momento — esta virou a **próxima ação de segurança antes de clientes reais**. A senha do admin (`admin@loja.com`) gerada na Etapa 5 **passou pelo chat** — serve só pra **QA/testes**. Trocar por uma definitiva que **nunca** passou por canal registrado (o dono define e aplica via `SEED_ADMIN_PASSWORD` ou troca de senha no app).

---

## ✅ Receita da Etapa 5 PROVADA (2026-07-02, em banco de teste descartável)
`migration:run` do zero roda **limpo**: 11/11 migrations aplicadas, 23 tabelas criadas (incl. `store_availability_exceptions`), RLS enabled+forced, e o `ucm_app` (restrito) lê sob RLS sem permission denied. Sequência validada:
1. Zerar schema (`DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ... postgres`).
2. Migrar como admin: container one-off da imagem `deploy-backend:latest`, `--network container:ucm-postgres`, `DATABASE_URL=postgresql://postgres@127.0.0.1:5432/ucm`, `-v /opt/gtsofthub/scripts:/app/scripts:ro`, `node_modules/.bin/typeorm -d dist/database/data-source.js migration:run`.
3. Restaurar grants do `ucm_app` (`provision-db-user.sh` — GRANTs + ALTER DEFAULT PRIVILEGES) pós-schema.
4. Seed da doceria com **UUID real (não `000…000`)** — amarra o fix do login (NEXT_PUBLIC_TENANT_ID).
