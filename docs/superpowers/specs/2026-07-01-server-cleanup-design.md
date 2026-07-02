# Faxina do Servidor (VPS gtsofthub.com.br) — Design

**Data:** 2026-07-01
**Tipo:** Infra (execução no servidor via SSH) — limpar, rastrear, tornar confiável.
**Status:** Proposta — aguardando aprovação do dono. NÃO executar nada até o "ok".
**Handoff:** `docs/superpowers/handoffs/2026-07-01-faxina-servidor.md` (estado + investigação).

---

## 1. Objetivo
Deixar o servidor **limpo, rastreável, confiável e acessível**: o app rodando de UM diretório limpo que rastreia `origin/main` (código reproduzível, não órfão), banco recriado limpo, disco liberado, deploy virando "um comando", e o lixo removido — **sem perder trabalho nem segredos**.

## 2. Decisões travadas (dono)
- **D1 — UM ambiente só:** `dev = prod` aceito. Sem stack de teste separado por agora (`dev.gtsofthub.com.br` continua apontando pros mesmos containers).
- **D2 — Banco ZERADO e recriado limpo:** migrations do zero (prova reprodutibilidade) + seed da doceria ("Loucas por Brigadeiro") como lojista de exemplo. Os 16 tenants dummy somem. Nada real a preservar (investigação confirmou: 3 pedidos, 0 pagos, 0 entregues, zero dinheiro).

## 3. Princípio ordenador (inviolável)
**Publicar e preservar ANTES de destruir. Nunca apagar o antigo antes do novo estar no ar e validado.** Cada passo destrutivo é confirmado antes de rodar e reversível quando possível.

## 4. Estado atual (resumo — detalhe no handoff)
- Prod builda de `/opt/ucm` (HEAD `b30fa0b` 13/jun + **44 sujos**) → **código órfão**. `origin/main` está em `02deaae`; a **main local está 46 commits à frente, não pushada**.
- `/opt`: `ucm` (prod, sujo) · `ucm/unified-commerce-platform` (clone fresco aninhado, redundante) · `ucm-test-repo` (9 sujos) · `ucm-repo`, `ucm-test` (lixo não-git).
- nginx: `gtsofthub` e `dev.gtsofthub` → mesmos containers de prod.
- Containers lixo: `ucm-redis-new` (Created), `ucm-ollama-test`, `ucm-backend-dev` (Exited).
- Disco **80%** (build cache 49GB + imagens reclaimáveis → prune libera ~55GB).

## 5. 🔑 SECRETS — o ponto mais crítico (extrair antes de apagar)
Os segredos de PROD vivem **só no servidor**, fora do repo (gitignored):
- **`/opt/ucm/deploy/.env`** (62 linhas, mode 0600) — **a fonte de verdade dos secrets de prod**: `JWT_SECRET`, `ENCRYPTION_KEY`, `POSTGRES_PASSWORD`, `DB_APP_USER`/`DB_APP_PASSWORD`, `REDIS_PASSWORD`, `MERCADOPAGO_ACCESS_TOKEN`/`_PUBLIC_KEY`/`_WEBHOOK_TOKEN`/`_WEBHOOK_SECRET`, `PIX_KEY`, `MERCHANT_NAME`, `TWILIO_*`, `EVOLUTION_*`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `TELEGRAM_*`, `DATABASE_URL`, `DATABASE_ADMIN_URL`, etc.
- **`/opt/ucm/backend/.env`** (38 linhas) — inclui `ENCRYPTION_KEY`, `JWT_SECRET`, `DATABASE_URL`, `DATABASE_ADMIN_URL` (admin p/ migrations vs `DB_APP_USER` p/ o app sob RLS).

**Regra:** o dir novo (Etapa 3) recebe uma **CÓPIA** desses `.env`; e o `/opt/ucm` velho **só é apagado (Etapa 6) depois** de o novo estar no ar com esses secrets funcionando. **Se qualquer secret existir só no velho e não for copiado, o app novo quebra.** Backup dos 2 `.env` para fora de `/opt` antes de qualquer remoção.

## 6. Alvo (mapa final)
- **`/opt/gtsofthub`** — clone limpo de `origin/main` (deploy/ + backend/ + frontend/), com `deploy/.env` = cópia do prod. **Única** fonte de build.
- Containers de prod rodando dessa fonte, código = `origin/main` (reproduzível). `dev.` e `gtsofthub` no mesmo app.
- Banco `ucm` limpo (migrations do zero + seed doceria).
- `deploy.sh` (git pull --ff-only + build + up + health).
- `/opt` sem os 3 dirs velhos/lixo; sem containers/redes lixo; disco ~25%.

## 7. Riscos & decisões residuais (pro dono confirmar no plano)
- **R-A — Volumes do banco/redis:** ao subir o app novo (mesmo project name `deploy`, mesmos container_names), reusar os volumes existentes (`postgres_data`/`redis_data`, dados dummy → zerados na Etapa 5) **ou** volumes frescos? **Recomendo reusar** (a Etapa 5 zera o schema de qualquer forma; menos churn). *(Se preferir 100% limpo, volumes frescos — mais radical.)*
- **R-B — Colisão de nomes (1 ambiente):** como os container_names são os mesmos (`ucm-backend` etc.) e é 1 ambiente só, **não dá pra rodar velho e novo simultâneos**. A Etapa 4 faz **down do velho → up do novo** (breve indisponibilidade, aceitável — nada real). O "ao lado" é: **o dir novo + as imagens buildadas** ficam prontos com o velho ainda no ar; o swap é rápido; **rollback = up do velho** (dir velho intacto até a Etapa 6).
- **R-C — Rede externa `ucmtest-net`:** o compose de prod referencia `networks: ucmtest-net: external: true` (acoplamento herdado ao stack de teste). O plano **mantém** essa rede externa viva pra o `up` não quebrar; a limpeza de redes (Etapa 6) preserva as em uso. *(Refatorar o compose pra soltar esse acoplamento é fora de escopo.)*
- **R-D — `frontend/.dockerignore` não existe no repo:** a Etapa 1 **adiciona e commita** (vai no push), pra o clone novo já ter (evita cache velho no build do front).

## 8. Escopo / Não-escopo
- **Escopo:** consolidar dir + build reproduzível + banco limpo + disco + deploy script + remover lixo.
- **Não-escopo:** CD via GitHub Actions/GHCR, observabilidade (Sentry/uptime), backups offsite/restore drill, refatorar o compose (rede externa), stack de teste separado, HTTPS/certs (já funciona). Ativar CSRF em prod = frente de segurança à parte.
