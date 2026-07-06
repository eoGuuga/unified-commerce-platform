# GTSoftHub — Roadmap Vivo

> **Doc de referência entre sessões.** Organizado por **decisão e ação**, não por lista.
> Leia o topo pra agir; o Apêndice é a enciclopédia. Atualize os status ao concluir.
>
> **Legenda:** status `⬜ a fazer` · `🔄 em andamento` · `✅ feito` · `🚫 bloqueado (mundo-real)` — gravidade `🔴 morde cedo` · `🟡 importante` · `🟢 pode esperar` — dono `👤 mundo-real (dono + profissional)` · `🔧 técnico (nós)`.
>
> _Última atualização: 2026-07-06 (auditoria empírica de segurança — 7 blocos)._

---

## 🧭 Estado atual (leia isto primeiro)

Prod (`origin/main`, servidor `/opt/gtsofthub` = espelho limpo, site 200) roda: **multi-tenancy RLS + segurança HIGH fechada + PDV/venda de balcão + admin produtos&estoque + PIX no bot**. **1 tenant real** (a doceria "Loucas por Brigadeiro"). Quatro frentes prontas em branch, **esperando o mundo-real**: cupom de venda (teste na bobina da mãe), pagamentos Asaas (CNPJ + Asaas liberar PIX de subconta), bot WhatsApp (conta Meta). **O gargalo central não é código — é os 3 destravamentos de mundo-real (Asaas, Meta, CNPJ):** o código está adiante do que o mundo-real permite ligar.

---

## 🌍 Ações do mundo real (só o dono resolve, fora do código)

### Destravamentos (na ordem de impacto)
1. **⬜ 👤 Enviar o chamado ao Asaas.** Texto pronto/guardado (runbook da Fase 2). **Destrava:** subconta escopada real fazendo PIX ao vivo (fecha a Rota 1 — hoje o PIX de subconta é gate do lado do Asaas). **Estado:** NÃO enviado. Barato e rápido; é o próximo passo lógico da frente de pagamentos.
2. **🚫 👤 Criar a conta Meta (WhatsApp Cloud API).** **Destrava:** o bot **enviar/receber de verdade** (hoje o envio só loga) + o merge da branch `feat/whatsapp-cloud-api-webhook` (código pronto/verde). **Estado:** bloqueado — conta não criada. Precisa: app/conta Meta + número + teste real.
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
3. **⬜ 🔴 🔧 Observabilidade — log/alerta.** Hoje **sem APM/alerta**: erros só vão pro `docker logs`. Montar o mínimo pra **saber quando um pagamento falha ou o bot trava** sem esperar o lojista reclamar (ex.: agregação de log + alerta em erro 5xx/pagamento-falho).
4. **⬜ 🟡 🔧 F11 — rotacionar a senha admin** (`admin@loja.com`) — pré-requisito de produção real.

---

## 📋 Técnico — REGISTRADO PRA DEPOIS (backlog — referência, não cobrança)

**Segurança**
- 🟡 Bloco B: `JwtAuthGuard` global fail-open → **fail-closed**.
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

**Em produção** (`origin/main` `a10b58a`; servidor `/opt/gtsofthub` HEAD == main; site + `/api/v1/health` = 200):
- Multi-tenancy RLS (core).
- Segurança HIGH fechada: envelope encryption Fase 1 + auth Bloco A (logout com revogação por-token provada no ar, privesc do register fechado, política de senha, bcrypt 12, branding só-admin) + Blocos 1-3.
- PDV / venda de balcão (tela caixa + fast-pass).
- Admin — Produtos & Estoque + motor de estoque + configurações da loja + disponibilidade. *(✅ MERGEADA — a memória antiga dizia "não", estava velha.)*
- Pagamento no PDV (confirmpayment endurecido) + PIX no bot (provado local).
- Bot WhatsApp (fluxo/orquestrador) — **mas o envio só loga** (não entrega; ver Meta).
- Polimento 22 bugs (4 blocos).

**Construído mas não integrado (branches abertas):**
| Branch | Contém | Provado? | Espera |
|---|---|---|---|
| `feat/pdv-cupom-venda` (7c) | Cupom não-fiscal Fase 1 (builder + CupomVenda + portal + botão + store_name) | ✅ 107 testes | Teste na bobina real + preview PDF do dono |
| `feat/asaas-phase1-subaccount` (19c) | **Frente Asaas inteira** (⊃ `payments-neutral`): fundação neutra + Fase 1 (subconta escopada + 🎯 Risco A) + Fase 2 (PIX + roteamento reverso + Option B provado ao vivo) | ✅ sandbox | Gate Fase 4 (CNPJ + KMS + revisão adversarial) + Asaas liberar PIX de subconta |
| `feat/payments-neutral-foundation` (7c) | Fundação neutra sozinha (subconjunto da de cima) | ✅ | Entra junto com a `asaas-phase1` |
| `feat/whatsapp-cloud-api-webhook` (1c) | Webhook WhatsApp Cloud API (Meta): verify + parser + HMAC | ✅ código | Conta Meta + teste real |
| `chore/preserve-server-snapshot` (1c) | Arquivo histórico da faxina (código server-only) — **NÃO é pra merge** | — | Descartar após revisão item-a-item |

**Bloqueado por mundo real:** Asaas (chamado não enviado), Meta (conta não criada), CNPJ (não aberto) — ver seção "Ações do mundo real".

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
