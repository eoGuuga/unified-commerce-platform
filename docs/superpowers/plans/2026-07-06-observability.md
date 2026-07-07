# Runbook — Observabilidade (o último 🔴)

> **Data:** 2026-07-06 · **Tipo:** operação de servidor (systemd + cron + .env + netdata) · **Status:** plano aprovado-a-revisar; execução passo-a-passo com confirmação do dono, parando nos passos que tocam o servidor.
> **Régua:** o diagnóstico foi **read-only**. O conserto mexe em systemd/cron/.env/netdata → **plano primeiro, execução com aprovação, parar em cada passo que toca o servidor**; mudança de código/config **via git** onde der; **reversível** em cada passo.

## Achado central (do diagnóstico 2026-07-06)
Prod está **cego na entrega**: o watchdog (auto-recovery) está morto e é **silencioso**; o netdata roda mas **não entrega nada** (config stock, sem MTA, 0 canal, bind `127.0.0.1`); os 3 crons de alerta morreram e os **scripts se perderam** (nunca versionados); o único canal (`notify-telegram.sh`, já no repo) está **desligado**. **Hoje, se um pagamento falha / o backend cai / o bot trava — ninguém sabe.** O coração desta frente é **ligar o canal de alerta**.

---

## 🎯 RECOMENDAÇÃO DE ESCOPO (o dono delegou a calibragem)

Julgamento de engenheiro que viu o terreno (VPS única, solo founder, 1 tenant real, baixo volume, netdata já mede infra — só não entrega):

| Nível | O que é | Esforço honesto | Recomendação |
|---|---|---|---|
| **Tier 0 — canal + disponibilidade** | Ligar o Telegram; watchdog consertado **que avisa** quando reergue; netdata apontado pro Telegram (disco/mem/container down) | **BAIXO** — config/ops, ~10 linhas no watchdog, resto é config. ~meio dia incl. o passo do dono (bot) | ✅ **FAZER AGORA** — tira prod de "cego" pra "me avisam quando cai ou a infra estoura". É o 80/20. |
| **Tier 1-lite — alerta de app por log** | Cron a cada 5min: `docker logs ucm-backend --since 5m` → grep de erro de pagamento/webhook/5xx → Telegram | **BAIXO** — ~30 linhas versionadas, reusa `notify-telegram.sh`, **zero código de app** | ✅ **FAZER AGORA (recomendo)** — fecha materialmente o "pagamento falhou, ninguém sabe" (em ≤5min). **Honesto:** é por *padrão de log*, não semântico — pode perder um erro sem log claro; a versão "certa" é o Tier 2. |
| **Tier 2a — notificador semântico in-app** | `NotificationService` chamado no PONTO exato da falha (pagamento/webhook), com throttle, testado | **MÉDIO** — feature de app, TDD, **toca a rota de pagamento** (sensível) | 📋 **REGISTRAR** — merece seu próprio ciclo design→TDD→deploy; substitui o Tier 1-lite quando pronto. |
| **Tier 2b — APM / agregação de log** | Loki+Grafana / Sentry: shipping de log, alertas, dashboards | **ALTO** — infra nova numa VPS única (custo de recurso + manutenção) | 📋 **REGISTRAR** — projeto; só compensa em volume/escala maior. |

**Recomendação em uma linha:** **Tier 0 + Tier 1-lite agora** (juntos, leves, fecham o gap real: disponibilidade + entrega de falha-de-dinheiro), **Tier 2 registrado**. Não misturar o Tier 2a (código na rota de pagamento) neste conserto de infra — dilui os dois.

---

## Componentes do conserto

### A. Watchdog — consertar + versionar (devolve a auto-recuperação)
- **Mover pro repo:** `deploy/scripts/ucm-watchdog.sh` (hoje só em `/usr/local/bin`, não versionado = a raiz que o matou). Correções internas:
  - Path **derivado do local do script** (`REPO_ROOT` via `BASH_SOURCE`, como o `backup-postgres.sh`) — em vez do `cd /opt/ucm` fixo.
  - Alinhar o `docker compose ... up -d` do recovery com o **invocação real do `deploy.sh`** (confirmar o `--env-file` correto em read-only — o script velho usa `env.prod`, hoje é `deploy/.env`).
  - **NOVO — fim do recovery silencioso:** ao reerguer algo, faz `source deploy/.env` e chama `notify-telegram.sh "⚠️ watchdog: reergui <api/frontend/container> (estava down) — recovery=<ok|falhou>"`.
- **Versionar as units:** `deploy/systemd/ucm-watchdog.service` + `.timer` no repo, com `ExecStart=/opt/gtsofthub/deploy/scripts/ucm-watchdog.sh`.
- **Instalar (sudo):** `sudo install -m 644 deploy/systemd/ucm-watchdog.{service,timer} /etc/systemd/system/` → `sudo systemctl daemon-reload` → o timer volta a rodar verde.
- **Reversível:** `git revert` + restaurar a unit antiga / `systemctl disable --now ucm-watchdog.timer`.

### B. Canal Telegram — o coração (o dono liga, eu conecto)
**O que o DONO faz (mundo-real, ~5 min — tipo o cofre):**
1. No Telegram, fala com **@BotFather** → `/newbot` → dá um nome → recebe o **TOKEN** (`123456:ABC...`).
2. Pega o **chat_id**: fala qualquer coisa com o bot novo, depois abre `https://api.telegram.org/bot<TOKEN>/getUpdates` no navegador → o `chat.id` aparece no JSON. (Ou fala com **@userinfobot**.)
3. O TOKEN é um segredo — o dono adiciona as 2 linhas **ele mesmo** no `/opt/gtsofthub/deploy/.env` (não passa por mim):
   ```
   TELEGRAM_BOT_TOKEN=<token>
   TELEGRAM_CHAT_ID=<chat_id>
   ```
**O que EU faço (wiring + prova):**
- Verifico presença (metadados, sem valor): `grep -q '^TELEGRAM_BOT_TOKEN=.' .env` → SET/MISSING.
- **Teste "chega mesmo?":** `cd /opt/gtsofthub && set -a && source deploy/.env && set +a && bash deploy/scripts/notify-telegram.sh "✅ canal de alerta ligado — teste"` → o dono confirma que recebeu no Telegram. **Prova o canal ANTES de ligar o resto nele.**
- **Reversível:** remover as 2 vars do `.env` desliga tudo (o `notify-telegram.sh` faz exit 0 silencioso sem elas).

### C. Netdata → Telegram (infra crítica entregue)
- Netdata tem método **Telegram nativo** (não precisa de MTA). No `/etc/netdata/health_alarm_notify.conf` (server-only; **contém o token = NÃO versionar, fica como o `.env`**):
  ```
  SEND_TELEGRAM="YES"
  TELEGRAM_BOT_TOKEN="<token>"
  DEFAULT_RECIPIENT_TELEGRAM="<chat_id>"
  ```
- Reload: `sudo netdatacli reload-health` (ou restart do netdata). **Teste nativo:** `sudo /usr/libexec/netdata/plugins.d/alarm-notify.sh test <chat_id>`.
- Versionar um **template** `deploy/netdata/health_alarm_notify.telegram.example` (placeholders, sem segredo) + doc de install, pra reprodutibilidade.
- Cobre: disco cheio, memória, CPU, **container down** (alarmes stock do netdata) → chegam no Telegram. *(Duplica o token em 2 arquivos server-only — .env + netdata conf; aceitável. Refinamento futuro: `custom_sender` do netdata chamando o `notify-telegram.sh` pra ter fonte única.)*
- **Reversível:** `SEND_TELEGRAM="NO"` + reload.

### D. Os 3 crons mortos — REMOVER (recomendação)
Os scripts se perderam (irrecuperáveis). Recomendação, item a item:
- **`monitor.sh`** (monitor geral) → **REMOVER.** Função hoje **coberta pelo watchdog consertado** (containers + health) + netdata. Reescrever = redundante.
- **`disk-alert.sh`** (alerta de disco) → **REMOVER.** **Coberto pelo netdata** (alarme stock de disco) assim que ele entrega no Telegram.
- **`security-alert.sh`** (a cada 15min) → **REMOVER agora + REGISTRAR revisita.** É o único cuja função pode não estar coberta (o que ele alertava? falha de SSH? fail2ban?). Como a lógica se foi, **não reescrever às cegas**; se o dono lembrar que fazia algo específico, a gente reescreve leve e versionado depois.
- Ação: remover as 3 linhas do `crontab -l` do `ubuntu` → param os fails em loop. **Reversível:** re-adicionar (mas não há pra quê — scripts sumidos).

### E. (Tier 1-lite, opcional-recomendado) Alerta de app por log
- Novo script versionado `deploy/scripts/app-alert.sh`: `docker logs ucm-backend --since 5m 2>&1 | grep -iE 'pagament.*(falh|erro)|webhook.*(falh|erro)|ERROR|statusCode":5'` → se achou, `notify-telegram.sh` com resumo + contagem (head -5 + "e mais N"). Janela `--since 5m` alinhada ao cron `*/5` = sem overlap/gap, sem cursor.
- Cron versionado `deploy/cron/gtsofthub-app-alert` → `/etc/cron.d/` (igual ao backup).
- **Honesto:** pega erro de pagamento/webhook/5xx em ≤5min; é por padrão de log (não semântico) → pode perder um erro sem log claro, ou contar 2x num edge de restart. Rede de segurança real e barata; a versão precisa é o Tier 2a.
- **Reversível:** `rm /etc/cron.d/gtsofthub-app-alert`.

---

## Ordem de execução + o que toca o servidor
| # | Passo | Toca servidor | Reversível por |
|---|---|---|---|
| 1 | **Dono:** criar bot + token + chat_id + colar no `.env` | ele edita o `.env` | remover as 2 vars |
| 2 | **Testar o canal** (`notify-telegram.sh "teste"`) → dono confirma "chegou" | só leitura + 1 msg | — |
| 3 | Watchdog: repo (script→deploy/, units, +notify) → commit → **git pull** → **sudo install units + daemon-reload** | git pull + sudo systemd | `git revert` + restaurar unit |
| 4 | Netdata → Telegram (conf server-only + reload) → teste nativo | sudo edit + reload netdata | `SEND_TELEGRAM=NO` + reload |
| 5 | Remover os 3 crons mortos | `crontab -e` (remove 3 linhas) | re-adicionar |
| 6 | *(opcional)* app-alert.sh + cron.d → git pull + sudo install | git pull + sudo cron.d | `rm` do cron.d |

**Régua em todos:** nenhum `restart`/`down` dos containers de prod (o watchdog só reergue **se algo já estiver down**; o resto é systemd/cron/config). Sudo passwordless do `ubuntu` está disponível (confirmado no cron do backup). Parar pra confirmação antes de cada passo que toca o servidor.

## Registrar pra depois (Tier 2)
- **Tier 2a — notificador semântico in-app** (design→TDD, toca pagamento): alerta no evento exato, com throttle. Substitui o Tier 1-lite.
- **Tier 2b — APM/agregação** (Loki+Grafana / Sentry): projeto de infra; só em escala maior.
- **security-alert.sh:** se o dono lembrar o que fazia, reescrever leve e versionado.
