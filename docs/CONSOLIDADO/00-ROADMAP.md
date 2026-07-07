# GTSoftHub — Roadmap Vivo

> **Doc de referência entre sessões.** Organizado por **decisão e ação**, não por lista.
> Leia o topo pra agir; o Apêndice é a enciclopédia. Atualize os status ao concluir.
>
> **Legenda:** status `⬜ a fazer` · `🔄 em andamento` · `✅ feito` · `🚫 bloqueado (mundo-real)` — gravidade `🔴 morde cedo` · `🟡 importante` · `🟢 pode esperar` — dono `👤 mundo-real (dono + profissional)` · `🔧 técnico (nós)`.
>
> _Última atualização: 2026-07-06 (auditoria empírica de segurança — 7 blocos)._

---

## 🧭 Estado atual (leia isto primeiro)

Prod (`origin/main`, servidor `/opt/gtsofthub` = espelho limpo, site 200) roda: **multi-tenancy RLS + segurança HIGH fechada + PDV/venda de balcão + admin produtos&estoque + PIX no bot**. **1 tenant real** (a doceria "Loucas por Brigadeiro"). Quatro frentes prontas em branch, **esperando o mundo-real**: cupom de venda (teste na bobina da mãe), pagamentos Asaas (**Rota 1 PIX provada AO VIVO ✅ 2026-07-07**; falta CNPJ+prod = Fase 4), bot WhatsApp (**Meta ✅ criada**, falta ativar). **O gargalo central não é código — é os 3 destravamentos de mundo-real (Asaas, Meta, CNPJ):** o código está adiante do que o mundo-real permite ligar.

> ### 🔴 BLOQUEADORES ATIVOS — ler ANTES de mergear qualquer código
> Dois achados de 2026-07-07 (a régua "verifica, não confia" pescou os dois contra suposições nossas). O #1 já foi **resolvido**; o #2 **segue ativo** — pré-requisito, não nota de rodapé:
>
> 1. **✅ LANDMINE DESARMADA (2026-07-07).** O auto-deploy `.github/workflows/deploy-prod.yml` tinha `on: push` (backend/frontend) que subia container com **env incompleto → quebraria o boot em prod sozinho** (e parava o container bom antes). **Desarmado:** trigger trocado para `workflow_dispatch` (só manual, **nunca dispara sozinho**) + cabeçalho explicativo no arquivo; arquivo **preservado como referência** (reversível por `git revert`). Merges de backend/frontend **não disparam mais** deploy automático. *(Melhoria futura OPCIONAL, não urgente: reativar como auto-deploy CORRETO — mesmo compose/env completo + health-check com rollback + teste em staging.)*
> 2. **🔴 Pagamentos NÃO são dormentes — NÃO podem ir pra main até a Fase 4.** O `payments.service` na branch já **re-roteia o MP** via `resolveForCharge` **fail-closed** (exige credencial por-tenant na tabela nova `tenant_payment_credentials`, **sem fallback pro env**). Mergear+deployar sem a migration `1752200000000` + a credencial MP da doceria **QUEBRA o PIX que funciona hoje** — não é "não-ativa-antes-da-hora", é **quebrar o que já funciona**. A Fase 4 é quem trata migration + credenciais por-tenant + a transição do MP existente. *(Correção da leitura anterior do dono, verificada na branch.)*

---

## 🌍 Ações do mundo real (só o dono resolve, fora do código)

### Destravamentos (na ordem de impacto)
1. **✅ 👤 Chamado ao Asaas — ENVIADO E RESOLVIDO (chamado 1356594, Isadora/Integrações, 2026-07-07).** O time liberou o PIX de subconta White Label no sandbox. **🎉 Rota 1 da Fase 2 PROVADA AO VIVO (2026-07-07)** — round-trip PIX completo com subconta **REAL** (`accountId 1e694b22`): cobrança **400→200** (gate destravado) + QR real gerado + pagamento recebido + **webhook roteou pra subconta certa (roteamento reverso ao vivo)** + pedido fechou sozinho (`confirmado`→`paid`) + **Risco A confirmado AO VIVO** (chave "só cobrança" → **403 no saque**: recebe mas não saca). O diferencial central do produto, provado de ponta a ponta. *(Sandbox; banco de teste limpo pós-prova; reversível.)*
2. **✅ 👤 Conta Meta (WhatsApp Cloud API) — CRIADA (2026-07-07). Bot DESTRAVADO; casa limpa pra ativar.** Código pronto/verde na branch `feat/whatsapp-cloud-api-webhook`. **🔒 Pré-requisito ATENDIDO:** o fix de PII nos logs está **no ar em prod** — o vazamento que ligaria junto com o bot está estancado. **▶️ PRÓXIMA SESSÃO — ativar o bot em prod (falta só isto; runbook completo em [[bot-fase1-pausada]]):**
   - a) **Plugar as credenciais Meta** — 5 env vars no `deploy/.env`: `WHATSAPP_PROVIDER=cloud_api`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID`, `WHATSAPP_CLOUD_ACCESS_TOKEN` (**token permanente** via Usuário de Sistema, não o temporário de 24h), `WHATSAPP_WEBHOOK_SECRET`(=App Secret), `WHATSAPP_WEBHOOK_VERIFY_TOKEN`(dono inventa).
   - b) **Deploy `--no-cache`** + allowlist do número (`bash deploy/scripts/whatsapp-allow-number.sh`).
   - c) **Configurar o webhook em prod na Meta:** URL `…/whatsapp/webhook?tenantId=2675a300-…` + verify token → verificar → subscrever `messages`.
   - d) **Testar "oi"** (round-trip real) → só então **mergear a branch** (mergear o provado, não o "deve funcionar").
   - *(Na prova, usar `MERCADOPAGO_ACCESS_TOKEN=TEST-` pra PIX de teste, sem dinheiro real.)*
3. **⬜ 👤 Abrir o CNPJ (com o contador).** **Destrava:** **produção de pagamentos** — a conta-plataforma Asaas EXIGE CNPJ (é a Fase 4). **Estado:** pendente. Sem CNPJ, pagamentos ficam presos ao sandbox. (Ver a pauta do contador abaixo antes de decidir MEI vs empresa.)

### 📋 Pauta pro CONTADOR (a conversa que o CNPJ exige)
- **Enquadramento:** você é **SaaS que cobra mensalidade** (fee) ou você **"toca" o dinheiro** do lojista? Muda tudo (obrigações, risco).
- **CNAE** certo para a atividade (software/plataforma).
- **Obrigação fiscal de intermediar recebimento de terceiros** — gera obrigação sua? Nota/imposto sobre **a sua receita** (a mensalidade), não sobre a venda do lojista.
- **MEI vs empresa:** o MEI tem **teto (~R$81k/ano)** — a plataforma escala além disso? Se sim, já nascer empresa.

### ⚖️ Pauta pro ADVOGADO (para quando houver lojistas de verdade — **NÃO agora**)
- **Responsabilidade perante o cliente final** quando um pagamento some/atrasa (sua exposição como facilitador; o white-label tem responsabilidade solidária → preferir subconta PADRÃO).
- **Termos de uso:** dono↔lojista (SLA, fee, responsabilidade, dados) **e** loja↔cliente final.
- **LGPD:** você é **controlador ou operador** dos dados dos clientes dos lojistas? DPA com cada lojista; direito de exclusão (hoje é stub).
- **KYC/AML:** quem vet­a o lojista? (subconta pode ser vetor de lavagem — papel da plataforma).

---

## 🔧 Técnico — ATACAR EM BREVE (nós, priorizado)

Os 3 pontos cegos 🔴 são **baratos de mitigar e caros de ignorar** — fazer primeiro.

1. **✅ 🔴 🔧 Backup — CONSERTADO e validado (2026-07-06)** ([runbook](../superpowers/plans/2026-07-06-backup-fix.md)). Diagnóstico: prod estava **sem backup automático** (cron nunca agendado no path novo). Feito, na régua de servidor (só-leitura em prod, sem restart, tudo reversível): backup fresco → **restore provado byte-fiel** no `ucm-postgres-test` (contagens batem com prod) → script corrigido (`BACKUP_DIR` **derivado do local do script = mata o F20 na raiz** + pre-flight de container + tmp→final atômico anti-gzip-vazio) mergeado na `main` e deployado (servidor == origin/main, sem drift) → **cron versionado** em `/etc/cron.d/gtsofthub-backup` (03:00 BRT, rotação 14d) → 1 run validado (dump no path certo, log, rotação sã). **Fast-follow ABERTO 🟡:** cópia **off-site** dos dumps (hoje no mesmo disco da VPS = não protege contra a VPS morrer). *(Achado colateral ABERTO 🔴: watchdog + 3 crons de monitoramento mortos apontando pro `/opt/ucm` velho → frente de Observabilidade abaixo.)*
2. **✅ 🔴 👤+🔧 Custódia da `ENCRYPTION_MASTER_KEY` — RESOLVIDA (2026-07-06).** As 3 chaves críticas (`ENCRYPTION_MASTER_KEY` KEK, `ENCRYPTION_KEY` legado v1, `JWT_SECRET`) — antes só no `.env` da VPS — foram **custodiadas off-server pelo dono num gerenciador de senhas real (Bitwarden)** e **verificadas por fingerprint** (sha256 da cópia bateu com o do servidor, sem a chave passar por lugar nenhum). Risco irreversível fechado: se a VPS morrer, as chaves (que nem o backup do banco desfaz) estão salvas. **Rotação = Fase 4 (KMS: chave sai do `.env` p/ cofre gerenciado; depende de CNPJ/prod).** **Higiene ABERTA 🟢:** `deploy/.env.bak-20260703-131517` (cópia de segredos no MESMO disco, sobra da faxina) — remover **depois**, com cuidado (arquivo de segredo, passa pelo dono); NÃO agora.
3. **✅ 🔴 🔧 Observabilidade — RESOLVIDO (2026-07-07)** ([runbook](../superpowers/plans/2026-07-06-observability.md)). Raiz: a faxina de path matou a automação de monitoramento + prod estava **cego na entrega** (nada chegava ao dono). **Fechado — 4 camadas no ar, todas provadas:**
   - ✅ **Canal Telegram LIGADO** — achei um bot de teste **já criado** (aplicando a régua "já existe?"), reaproveitado (vars no `deploy/.env`, cópia arquivo→arquivo sem expor valor), provado ponta a ponta.
   - ✅ **Watchdog CONSERTADO + versionado + NO AR com alerta** — repontado (path derivado); recovery corrigido (`-p deploy --env-file .env`, igual ao `deploy.sh` — o velho usava `env.prod` → teria FALHADO); checks → **HTTPS do domínio** (batiam em `http://localhost`/301 → 3 bugs: 1 falso-positivo + 2 falso-negativos); **avisa no Telegram** ao cair/recuperar (fim do recovery silencioso); versionado em `deploy/scripts/ucm-watchdog.sh` + `deploy/systemd/`; timer active/enabled, **3 ciclos automáticos `all_good` sem recovery**. *(Lição registrada: um blip real — rodei contra prod com checks não-verificados e reiniciou containers 2x → virou a régua "verificar COMPORTAMENTO antes de agir".)*
   **As 3 pontas que faltavam — TODAS fechadas (2026-07-07):**
   - ✅ **netdata → Telegram (2026-07-07)**: ligado o método Telegram nativo (mesmo bot do watchdog), escopo **só role `sysadmin`** (disco/inode/ram/memória — sem ruído de CPU; os alarmes chatos já são `to: silent`), config **HOT** em `/etc/netdata/health_alarm_notify.conf` (server-only, token `640 root:netdata`) + template versionado (`deploy/netdata/health_alarm_notify.telegram.example`, sem segredo). Teste nativo (warning/critical/clear) chegou no Telegram; netdata não reiniciou. Anti-spam: thresholds+histerese+só-transição.
   - ✅ **3 crons mortos REMOVIDOS (2026-07-07)** — `monitor.sh` (monitor geral → coberto por watchdog+netdata), `disk-alert.sh` (→ coberto por netdata), `security-alert.sh` (o log provou: era só um **contador de bans do fail2ban**, não proteção — o fail2ban está **ativo**, 2 jails `sshd`+`nginx-http-auth`, banindo). Removidos do crontab do `ubuntu` (backup em `/home/ubuntu/crontab.bak-*`; `/etc/cron.d`+watchdog+netdata **intocados**); `monitor.log` truncado. **Opcional pra depois (NÃO é gap):** se quiser visibilidade de segurança, um **resumo DIÁRIO** do fail2ban ou alerta só em **anomalia** (pico de bans) — nunca o contador de 15min (=spam, 1-3 bans/15min é ruído de fundo normal); o fail2ban protege independente disso.
   - ✅ **Alerta de app Tier 1-lite (2026-07-07)**: cron `*/5` versionado (`deploy/scripts/app-alert.sh` + `deploy/cron/gtsofthub-app-alert`) varre o log do backend por `"level":"error"` (o formato JSON REAL — grep por `ERROR` maiúsculo pegaria NADA, achado no diagnóstico) na janela `--since 6m` (1min de sobreposição → nunca perde) → Telegram. Anti-flood (1 msg c/ contagem + distintas) + sanitizado (só context+message, truncado 200c). Provado com os 5 erros reais (dry-run→envio→run silencioso→cron automático limpo). **Achou de brinde:** o bug do audit-log de login falhando (registrado em Segurança). **Tier 2** (notificador semântico in-app + APM Loki/Sentry) registrado pra depois.
   - *(Edge achado na revisão: o watchdog pode disparar recovery no meio de um deploy manual — mitigar com o `deploy.sh` parando o timer durante o deploy.)*
4. **✅ 🔧 LANDMINE DESARMADA (2026-07-07).** O auto-deploy `.github/workflows/deploy-prod.yml` fazia `docker run` de imagem ghcr com env INCOMPLETO (faltava `ENCRYPTION_KEY` etc.) num push de `backend/**`/`frontend/**`, e **parava o container bom antes** → quebraria prod sozinho. Já disparou no passado (falhava cedo — prod sobreviveu a ~30 gatilhos). **Desarmado:** `on: push` removido → só `workflow_dispatch` (manual); cabeçalho no arquivo documenta o porquê + como reativar com segurança. Arquivo **preservado como referência** (não apagado; `git revert` reverte). Merges de backend/frontend **não disparam mais** deploy automático → destrava (com segurança) os próximos merges de código. **Melhoria futura OPCIONAL (não urgente):** reativar como auto-deploy CORRETO — alinhar com o deploy manual (mesmo compose/env completo) + health-check pós-deploy com rollback + testar em staging.
5. **⬜ 🟡 🔧 F11 — rotacionar a senha admin** (`admin@loja.com`) — pré-requisito de produção real.

---

## 📋 Técnico — REGISTRADO PRA DEPOIS (backlog — referência, não cobrança)

**Segurança**
- 🟡 Bloco B: `JwtAuthGuard` global fail-open → **fail-closed**.
- ✅ **Audit log de login — CONSERTADO + DEPLOYADO + VALIDADO em prod (2026-07-07)** ([runbook](../superpowers/plans/2026-07-07-audit-log-rls-fix.md)). Causa raiz: `audit_log` tem **RLS FORCE**; o `AuditLogService.log()` do login `@Public` rodava **sem contexto de tenant** → RLS rejeitava o INSERT → **100% quebrado, não intermitente** (0 audits de LOGIN em 10d). **Invisível em teste** (specs conectam como superuser, que bypassa RLS). **Fix** (commit `0558d66`, no ar): o `AuditLogService` seta o próprio contexto RLS (`runInTransaction` + `set_config` do `tenantId`) — conserta login + **checkout público** + LGPD de uma vez + logging da causa na string (bônus: parou de logar email/PII). **TDD RED→GREEN sob papel `ucm_rls_probe`** (RLS-enforced, não superuser). **Deploy validado em prod:** rebuild+restart do backend (~6s downtime, health 200), login de teste → **LOGIN audit gravou (=1)**, regressão → **CREATE audit gravou (=1)**, dados de teste limpos. **Gap histórico irrecuperável (documentado):** logins de prod de ~2026-07-04 até o deploy **sem rastro de auditoria** — perda não recuperável.
- 🟢 **Debug ligado em prod** (achado via Ponta 3): 8.6k linhas `"level":"debug"`/7d → setar `LOG_LEVEL=info`; verboso (enche log) + risco de vazar detalhe em debug.
- 🟢 `/whatsapp/test` **agora fail-closed em prod (403)** — provado empíricamente 2026-07-06 · 🟡 `/whatsapp/metrics` ainda sem guard.
- 🟡 Vazamento cross-tenant **além do RLS** (cache Redis / logs / prompts do LLM) — auditar.
- 🟢 JWT em localStorage → httpOnly cookie (delicado; já mitigado por CSP+revogação+TTL).
- 🟢 Dead code: `whatsapp.service.legacy.ts` (14.8k linhas) + `*.service.ts.disabled` + branch `chore/preserve-server-snapshot` (arquivo morto — descartar após revisar `email/`, `subscriptions/`, `whatsapp-cart.controller`).
- ❓ Round-trip autenticado do envelope (verificação end-to-end pendente) · "rotação de senha fraca" (provável = F11).

**Auditoria empírica adversarial (2026-07-06)** — dossiê completo em [`docs/security/2026-07-06-auditoria-empirica.md`](../security/2026-07-06-auditoria-empirica.md). 7 blocos, ataques REAIS contra o teste. **Zero 🔴 explorável.** Achados de hardening 🟡 registrados aqui:
- 🟡 **H1** revogação **fail-open com Redis fora** (logout não revoga se o Redis cai; válido até expirar em 15min) — o mais "real"; mitigado por TTL curto.
- 🟡 **H7** `POST /payments/:id/confirm` é **staff-wide** (sem `@Roles('admin')`) e não verifica o provedor — OK no modelo dono-único; revisar se surgir staff de menor confiança.
- 🟡 **H2** timing-oracle ~70ms no login (enumeração de email; mitigável com dummy-hash) · **H3** enumeração via `send-confirmation` (campo `success`).
- 🟡 **H8** latência degrada sob alta concorrência (amplificado pelo túnel de teste; em prod há throttle 100/min + nginx edge; sem 5xx/queda) · **H9** `JwtAuthGuard` não-global ("aberto por padrão"; footgun p/ endpoint futuro — mesmo item do "Bloco B" acima).
- 🟡 **H4** body >100kb → 500 em vez de 413 (quick-win; o limite protege a memória) · **H5** `@Get(':id')` sem `ParseUUIDPipe` → 500 (quick-win) · **H6** `quantity` aceita fracionado (deveria ser `@IsInt`; quick-win).
- ⚪ **A1 — a-provar:** prompt-injection no bot **não testado** (OpenAI unset no teste → bot cai em canned). Rodar a bateria no LLM ao vivo **quando a chave OpenAI estiver no ambiente de teste**.
- ✅ **RESOLVIDO/ESCLARECIDO pela auditoria:** multi-tenant **provado sob ataque real** (não só RLS no código: cross-tenant read/write/IDOR/webhook-forge todos bloqueados) · Asaas webhook **fail-closed token provado** (403) + MP webhook usa metadata autoritativo (forja → ignored) · `/whatsapp/test` **fail-closed em prod** (403, acima) · segredos **ausentes do log** (JWT_SECRET/senha DB = 0 ocorrências) · injeção clássica limpa · fluxo de dinheiro à prova (preço/amount server-side, cupom clampado, race de estoque+idempotência seguras) · CSRF N/A hoje (Bearer puro). *(Nota: o webhook do **WhatsApp** teve forja rejeitada no teste, mas o fail-open em prod de `if (webhookSecret && signature)` — CLAUDE.md §9 — NÃO foi re-verificado; segue aberto.)*

**Infra** (F-items registrados em [server-infra-debt])
- 🟡 F12 remover admin-default do CÓDIGO das migrations · F18 compose não mapeia `DATABASE_ADMIN_URL`.
- 🟡 Banco de teste (`ucm-postgres-test`/`redis-test`) rodando na VPS de **prod** (consome recurso).
- 🟡 VPS única = ponto único de falha (sem HA/failover/staging-espelho).
- 🟢 F19 (`run` sem `-T`) · F20 (backup path velho) · F6/F8/F10 (sweeper cron / scripts na imagem / migrations faltando) · F13 (logout zumbi) · `.env.bak-20260703` solto no `/opt/gtsofthub`.
- 🟢 Branches remotas `fix/*` (0 à frente da main) → **descartáveis**.

**Produto / UX**
- 🟡 Branding **"GTSoftHub" hardcoded (~60 ocorrências)** — separar contexto-PLATAFORMA (landing/legal/login = ok) do contexto-TENANT (checkout/loja = deveria ser a marca do lojista).
- 🟡 Notificação de **novo pedido ao lojista** (ele não sabe que vendeu sem olhar a tela).
- 🟡 Bot só **LOGA o envio** (não entrega — falta ligar o provider; atrás da Meta).
- 🟢 Reimprimir cupom do histórico (Fase 3 do cupom) · F14 link workspace no login (UX).

**Higiene de teste**
- 🟡 `ucm_test_motor` acumula SKU duplicado → testes de order/payment integration falham (colisão `idx_produtos_tenant_sku_unique`) — limpar/isolar o banco de teste entre rodadas.
- 🟡 **39 falhas baseline** em whatsapp/products (6 suítes) — mock drift pré-existente que **mascara regressões futuras**.

**Escala / consistência de dinheiro**
- 🟡 Reconciliação de pagamento: só há o **StockSweeper** (cancela não-pago no TTL → `paidForCancelled` → aviso de reembolso manual); **sem polling ativo** ("gateway, pagou?").
- 🟡 Estados de borda: MercadoPago reconhece chargeback/refund mas **sem fluxo de reembolso no app** (manual); **Asaas: nenhum estado de borda tratado** (cego pra go-live).
- 🟡 Tetos externos: Asaas 20 subcontas/dia (já batido), Meta tiers de mensagem, custo de **LLM por conversa × volume**; pool de conexões do Postgres em escala.
- ❓ Idempotência do webhook do **bot** (Meta re-entrega em retry — deduplica?) — verificar.

**Bugs conhecidos**
- 🟡 BUG-CART-2 (`/whatsapp/cart/add` → 401, lê `id` em vez de `sub`) · BUG-CART-1 (`GET .../cart` → 500 sem carrinho) — **latentes atrás do bloqueio Meta**.
- 🟢 logout 201→200 (cosmético).

---

## 💼 Decisão de negócio a fazer (dono, sozinho ou comigo)

- **⬜ Unit economics.** A mensalidade **cobre o custo por-tenant**? Somar: VPS + Asaas (R$0,99/cobrança) + LLM/mensagem + Meta. Se custo > fee, **perde-se dinheiro ao escalar.** Fazer a conta **antes** de vender pra 50.
- **⬜ Posicionamento vs Cardápio Web.** Qual o **diferencial** que justifica escolher você? (Inferência: bot WhatsApp com IA + PDV + estoque + **recebimento por-lojista** integrado, vs. cardápio/pedido online.) É decisão de **narrativa do dono** — precisa ser articulada, não só técnica.

---

## 📎 Apêndice — Inventário completo (as 3 camadas)

### Camada 1 — Estado real

**Em produção** (`origin/main` `0558d66`; servidor `/opt/gtsofthub` HEAD == main; site + `/api/v1/health` = 200):
- Multi-tenancy RLS (core).
- Segurança HIGH fechada: envelope encryption Fase 1 + auth Bloco A (logout com revogação por-token provada no ar, privesc do register fechado, política de senha, bcrypt 12, branding só-admin) + Blocos 1-3.
- PDV / venda de balcão (tela caixa + fast-pass).
- Admin — Produtos & Estoque + motor de estoque + configurações da loja + disponibilidade. *(✅ MERGEADA — a memória antiga dizia "não", estava velha.)*
- Pagamento no PDV (confirmpayment endurecido) + PIX no bot (provado local).
- Bot WhatsApp (fluxo/orquestrador) — **mas o envio só loga** (não entrega; ver Meta).
- Polimento 22 bugs (4 blocos).
- Observabilidade (watchdog HTTPS + netdata→Telegram + app-alert Tier 1-lite + backup automático 03:00 BRT) + correção do audit-log de login (RLS, `0558d66`).
- **Fix de PII nos logs (LGPD) — DEPLOYADO 2026-07-07 (`79ff822`):** parou de logar o **conteúdo da mensagem** do cliente (Camada 1) + **mascara telefone/email** em ~17 sites (`maskPhone`/`maskEmail`, Camada 2) + auditoria **estruturada + IP mascarado** no cart-controller (Camada 4 — **eventos de segurança agora chegam no app-alert**) + máscara do telefone na **exceção** de número não-autorizado (que reaparecia cru via o http-exception-filter). *(Camada 3 — payload MercadoPago — verificada limpa, sem fix.)* **Provado vivo no container** (leak velho `[DEBUG handleCart]` sumiu, máscaras compiladas presentes, exceção mascara). Fechado **ANTES** do bot ir pra prod — o vazamento que ligaria junto está estancado. Watchdog blindado no deploy (parado/religado). Reversível (`git revert 79ff822`).

**Construído mas não integrado (branches abertas):**
| Branch | Contém | Provado? | Espera |
|---|---|---|---|
| `feat/pdv-cupom-venda` (7c) | Cupom não-fiscal Fase 1 (builder + CupomVenda + portal + botão + store_name) | ✅ 107 testes | Teste na bobina real + preview PDF do dono |
| `feat/asaas-phase1-subaccount` (19c) | **Frente Asaas inteira** (⊃ `payments-neutral`): fundação neutra + Fase 1 (subconta escopada + 🎯 Risco A) + Fase 2 (PIX + roteamento reverso + **🎉 Rota 1 PROVADA AO VIVO com subconta REAL 2026-07-07**: 400→200, QR, roteamento reverso, Risco A 403) | ✅ **sandbox ao vivo** | 🔴 Gate Fase 4 (CNPJ+prod + migration + credenciais por-tenant + KMS + revisão adversarial) — **NÃO mergear antes** |
| `feat/payments-neutral-foundation` (7c) | Fundação neutra sozinha (subconjunto da de cima) | ✅ | Entra junto com a `asaas-phase1` |
| `feat/whatsapp-cloud-api-webhook` (1c) | Webhook WhatsApp Cloud API (Meta): verify + parser + HMAC | ✅ código | **Meta ✅ criada** — falta ativar em prod + teste real |
| `chore/preserve-server-snapshot` (1c) | Arquivo histórico da faxina (código server-only) — **NÃO é pra merge** | — | Descartar após revisão item-a-item |

**Bloqueado por mundo real:** **Asaas ✅ chamado 1356594 resolvido — PIX de subconta destravado + Rota 1 provada ao vivo (falta CNPJ+prod=Fase 4)**, **Meta ✅ conta criada — bot destravado, falta ativar em prod**, CNPJ (não aberto) — ver seção "Ações do mundo real".

#### 🔀 Decisão de merge (2026-07-07) — o que entra agora vs. o que espera gate
Diagnóstico das branches abertas (a régua "verifica antes de agir"): todas partem da mesma base `a10b58a`; a main andou 6 commits (audit-fix + observabilidade) **sem conflitar** com nenhuma.
- **✅ MERGEADA AGORA:** `docs/roadmap-vivo` — doc pura (0 código, 0 toque em prod, sem conflito, não espera nada). Trouxe roadmap + runbooks + dossiê da auditoria pro tronco.
- **Pilha real:** `feat/asaas-phase1-subaccount` **contém** `feat/payments-neutral-foundation` (empilhadas — entram juntas). `feat/pdv-cupom-venda` e `feat/whatsapp-cloud-api-webhook` são **independentes** (não carregam pagamentos).
- **🚨 Correção de leitura — os pagamentos NÃO são dormentes:** o `payments.service` na branch **re-roteia o MP** pelo `credentialResolver.resolveForCharge('mercadopago', tenant)` (tabela nova `tenant_payment_credentials`, **fail-closed sem credencial — nunca fallback pro env**). **Deployar isso sem a migration + a credencial por-tenant QUEBRA o PIX da doceria.** Por isso a fundação de pagamentos (Fase 0/1/2, **provada em sandbox**) é **🔴 pré-requisito da Fase 4 (não só "aguarda gate"): NÃO pode ir pra main antes** de a Fase 4 tratar migration + credenciais por-tenant + a transição do MP existente (CNPJ + KMS + revisão adversarial). Merge ≠ deploy (deploy é manual), mas deixá-la na main viraria bomba pro próximo deploy manual.
- **✅ Landmine `deploy-prod.yml` DESARMADA (2026-07-07):** `on: push` removido → só `workflow_dispatch` manual. Merges de backend/frontend não disparam mais auto-deploy (provado: o merge do fix de PII em backend não disparou).
- **Gates dos que ficam:** cupom → teste na bobina real da mãe · pagamentos → **Fase 4 (CNPJ+prod; PIX de subconta ✅ destravado + Rota 1 provada AO VIVO)** · bot → conta Meta (✅ criada) · `chore/preserve-server-snapshot` → descartar após revisão.

#### 💳 Fase 4 — pagamentos em PRODUÇÃO (o caminho que resta, pós-Rota-1-provada)
A Fase 2 (Rota 1) está **provada ao vivo em sandbox** (round-trip PIX real + roteamento reverso + Risco A). Pra ligar pagamentos com lojistas **reais** falta:
1. **👤 CNPJ real** (contador) — a conta-plataforma Asaas de produção **EXIGE CNPJ** (MEI vs empresa: ver pauta do contador).
2. **👤 Conta Asaas de PRODUÇÃO** — subcontas de lojista aprovadas por **KYC/documentos reais** (não o atalho `/sandbox/approve`; em prod é o lojista que envia docs via `onboardingUrl`).
3. **🔧 Migration `1752200000000`** (`tenant_payment_credentials`) rodada em prod.
4. **🔧 Migrar a doceria pras credenciais por-tenant** — hoje o MP é global (env); a Fase 4 move pra credencial por-tenant no cofre + a transição do MP existente **sem quebrar o PIX atual** (o `payments.service` já re-roteia fail-closed → por isso não pode ir pra main antes disto).
5. **🔧 Merge da fundação de pagamentos** (`feat/asaas-phase1-subaccount` ⊃ `payments-neutral`) — 🔴 **segura na branch ATÉ aqui**; mergear antes quebra o PIX da doceria.
6. **🔧 KMS** — a `ENCRYPTION_MASTER_KEY` sai do `.env` pro cofre gerenciado (rotação).
7. **🔧 Revisão adversarial** do fluxo de pagamento em prod (dinheiro real de terceiros).
- **🔎 Achado pra Fase 4 (2026-07-07):** checar se um lojista foi aprovado usa a **chave-plataforma** (`GET /accounts` lista subcontas + status), **NÃO** a chave escopada da subconta (que dá **403 `ACCOUNT_INFO:READ`** — o escopo "só cobrança" não lê dados de conta).

**Servidor (só-leitura, 2026-07-05):** VPS `vps-0e3446f6` (up 23d). Containers: frontend/backend (26h) · nginx (40h) · postgres/redis (saudáveis) · **+ postgres-test/redis-test** (banco de teste `ucm_test_motor` na VPS de prod). Git `/opt/gtsofthub` == `origin/main` limpo (só o `.env.bak` untracked). **Sem divergência de código.**

### Camada 2 — Backlog conhecido
Ver **"Técnico — registrado pra depois"** acima (é a mesma lista, já agrupada por tema com gravidade). Origem: dívidas registradas ([server-infra-debt], [security]), git, docs.

### Camada 3 — Pontos cegos
Ver **"Técnico — atacar em breve"** (os 🔴) + **"Escala / consistência de dinheiro"** (técnico) + **"Ações do mundo real"** e **"Decisão de negócio"** (mundo-real). Os que **não estavam no radar**: KYC/AML, unit economics, continuidade de fornecedor (Meta bane número; Asaas encerrar = todos param), fator ônibus (solo founder), vazamento cross-tenant além do RLS.

---

## Como usar / atualizar este doc
- **Concluiu um item?** troque `⬜`→`✅` (ou `🔄`) e data.
- **Nova frente?** entra em "Atacar em breve" ou "Registrado pra depois" com dono (👤/🔧) + gravidade.
- **Destravou um bloqueio de mundo-real?** move o item e destrava a(s) frente(s) que ele libera.
- Fontes de verdade: git (branches/prod) · `docs/CONSOLIDADO/` · memória do agente.
