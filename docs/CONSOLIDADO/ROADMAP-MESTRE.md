# ROADMAP MESTRE — Caminho para vender o UCM/GTSoftHub

Fonte unica da verdade do esforco de "deixar o projeto vendavel para varios clientes".
Criado em 2026-06-26 a partir de auditoria multi-agente (6 dimensoes) verificada manualmente contra o codigo.
Meta real (acordada com Gustavo): **vendavel, confiavel, manutenivel, apresentavel** — nao "perfeicao infinita".
Contexto: 2 clientes esperando; um e a mae do Gustavo (loja de doces) = primeiro teste real (cardapio + WhatsApp reais).

**Como ler:** P0 = bloqueia venda ou expoe juridicamente/financeiramente. P1 = qualidade/robustez para escalar. P2 = polimento/luxo.
Cada item: `[ ]` pendente / `[x]` feito (com data + commit). Status atualizado a cada sessao.

---

## Veredito honesto do estado atual

O projeto **funciona em partes, mas NAO esta vendavel hoje** — e a causa nao e "bagunca" no sentido que assusta; e **trabalho incompleto em pontos criticos** + arquitetura cansada de tanto iterar. A boa noticia: a fundacao e solida (RLS multi-tenant correto, DI, validacao, idempotencia em pedidos, paginas legais existem, CI roda). Os bloqueadores sao finitos e conhecidos.

**Mitos derrubados pela verificacao (NAO gaste tempo com isso):**
- `.env` NAO vazou no git (3 auditores erraram; confirmado limpo).
- Paginas legais (privacidade, termos, cookies) JA existem em `frontend/app/info/`.
- O "monolito de 16k linhas" e codigo morto, nao divida a refatorar.

---

## P0 — BLOQUEADORES DE VENDA (nada vende sem isto)

### Receita / fluxo central
- [ ] **R1. Bot nao envia mensagem nenhuma.** `whatsapp.service.ts:278` `sendOutboundResponse` so loga; `EvolutionApiProvider` existe mas nao esta injetado nem chamado. Sem isso o cliente manda msg e o bot fica mudo. → Injetar provider e despachar cada tipo de resposta. (FIX RAPIDO, alto impacto)
- [ ] **R2. WhatsApp e config GLOBAL, nao por-tenant.** `evolution-api.provider.ts:25` le credenciais de env unicas. Impossivel 2 clientes com numeros diferentes. → Provider tenant-aware: buscar credenciais do tenant antes de enviar. (BLOQUEIA 2o cliente)
- [ ] **R3. Loja mostra produtos FALSOS.** `frontend/hooks/useProducts.ts:102` retorna `PRODUTOS_DEMO` hardcoded, nunca chama a API. → Conectar a `getPublicStoreProducts(tenantId)` com loading/error.
- [ ] **R4. Sem provisionamento de tenant self-service.** Checkout (`frontend/app/checkout`) promete "equipe entra em contato em 24h" — setup manual. → Onboarding que cria tenant, gera secrets, coleta numero WhatsApp + chave MercadoPago do cliente.

### Seguranca / fraude (verificado no codigo)
- [x] **S1. Webhook WhatsApp fail-open.** FEITO 2026-06-26 (Sprint Cofre): fail-closed em prod — exige secret + assinatura valida; sem isso, rejeita. Testado.
- [x] **S2. Webhook MercadoPago fail-open com token vazio.** FEITO 2026-06-26: exige token E secret em prod; unsigned proibido em prod (ignora flag `MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED`).
- [x] **S3. `/whatsapp/test` sem guard.** FEITO 2026-06-26: bloqueado em producao (`ForbiddenException`); permanece util em dev/test. Testado.
- [x] **S4. `/whatsapp/metrics` auth opcional em dev.** FEITO 2026-06-26 (commit Sprint Cofre): API key sempre obrigatoria (fail-closed) + comparacao timing-safe.
- [x] **S5. PIX cai em chave mock se `PIX_KEY` ausente.** FEITO 2026-06-26: lanca em prod se `PIX_KEY` ausente; nunca gera QR com chave mock.
- [x] **S6. Fallback de senha real no compose.** VERIFICADO 2026-06-26: `docker-compose.prod.yml` JA usa `${POSTGRES_PASSWORD}`/`${JWT_SECRET}` puros (sem fallback). Auditor viu versao antiga. Nada a fazer.

### Integridade financeira
- [x] **F1. Race condition de estoque.** VERIFICADO 2026-06-26: codigo JA seguro — `orders.service.ts:144` usa `setLock('pessimistic_write')` (FOR UPDATE) + decremento atomico condicional (`current_stock >= quantity`, checa `affected`). Auditor superestimou. Nada a fazer.
- [x] **F2. Webhook de pagamento sem dedup.** FEITO 2026-06-26: lock pessimista (FOR UPDATE) na linha do Pagamento serializa retries concorrentes do MercadoPago, evitando dupla confirmacao.
- [ ] **F3. Checkout confia no total do carrinho.** `whatsapp.service.ts:~754` usa `total_amount` do carrinho. → recalcular do banco no checkout. (orders.service ja recalcula; fechar a ponte)

### LGPD / juridico (cliente real = PII real)
- [x] **L1. Exclusao de dados.** FEITO 2026-06-26 (branch `feat/lgpd-compliance`): `processDeletion` anonimiza PII em cascata (pedidos/conversas/usuario) preservando registro fiscal, + audit log + endpoints `DELETE`/`GET /lgpd/meus-dados`. 9 testes.
- [x] **L2. Captura de consentimento.** FEITO 2026-06-26: registro exige `accept_terms`; grava `consent_at`+`consent_policy_version` (migration `AddLgpdConsentToUsuarios`). Tipo do frontend atualizado.
- [x] **L3. PII em texto puro.** DECISAO DOCUMENTADA 2026-06-26 (risco aceito para MVP — ver `05-SEGURANCA-COMPLIANCE.md` secao Postura LGPD). RLS + acesso restrito + TLS + backup cripto mitigam; criptografia de coluna fica para fase de escala.
- [ ] **L4 (P1, novo). Persistir solicitacoes LGPD em tabela.** Hoje as SOLICITACOES ficam em memoria (a exclusao em si ja e real/persistida). Criar entidade + migration.

---

## P1 — QUALIDADE PARA ESCALAR (depois que vende o 1o, antes de crescer)

- [ ] **Q1. CI nao bloqueia merge quebrado.** `ci.yml` tem `continue-on-error` em integration e `npm audit`. → remover; gate de merge real.
- [ ] **Q2. Pagamento sem teste unitario.** `payments.service.ts` sem `.spec`. → cobrir criacao, confirmacao, idempotencia, erro.
- [ ] **Q3. Isolamento de tenant (RLS) sem teste e2e.** → suite que tenta cross-tenant e espera vazio/403.
- [ ] **Q4. Sem observabilidade.** Sem Sentry/APM/alerta. Dono fica cego a falha em prod. → Sentry (free) + alerta de erro.
- [ ] **Q5. Branding hardcoded "GTSoftHub".** ~53 ocorrencias no frontend. → `useTenant()` com nome/logo/cores por loja.
- [ ] **Q6. Dois clientes HTTP no frontend** (`api-client.ts` axios + `api.ts` fetch) + sem refresh de token. → consolidar 1 + refresh JWT silencioso.
- [ ] **Q7. Estados orfaos de pedido** (pago mas nao confirmado). → state machine + job de limpeza/retry.
- [ ] **Q8. Migrations nao validadas no CI.** → `migration:show` no pipeline + teste de rollback.

---

## P2 — POLIMENTO / DIVIDA TECNICA (nao bloqueia venda)

- [ ] **D1. Apagar codigo morto:** `whatsapp.service.legacy.ts` (14.817L) + `*.service.ts.disabled` (~8k L) + `docs/LEGADO/`. ~24k linhas. (rapido, alivia o "bagunca")
- [ ] **D2. Decompor `whatsapp.service.ts`** (orquestrador com 20+ deps) em sub-modulos.
- [ ] **D3. Quebrar dependencias circulares** WhatsApp↔Orders↔Payments (forwardRef).
- [ ] **D4. Reduzir `any`** (263 backend / ~13 frontend), priorizando pagamentos e webhook (validar payload).
- [ ] **D5. Padronizar tratamento de erro** (excecoes Nest, nunca swallow).
- [ ] **D6. Decompor god components frontend** (`loja` 2549L, `pdv`, `pedido`, `checkout` 456L).
- [ ] **D7. bcrypt rounds 10 → 12.** `auth.service.ts:158`.
- [ ] **D8. UX:** skeletons de loading, a11y (ARIA/alt), responsividade mobile, error boundary no tema.
- [ ] **D9. Tipos do frontend gerados do OpenAPI/Swagger.**

---

## Ordem de execucao sugerida (sprints curtas, cada uma entregavel)

1. **Sprint "Bot fala" (P0 receita):** R1 → R2 → R3. Resultado: bot responde de verdade no WhatsApp da loja da mae (1o teste real).
2. **Sprint "Cofre" (P0 seguranca):** S1–S6 + F1–F3. Resultado: sem fail-open, sem fraude, sem oversell.
3. **Sprint "Legal" (P0 LGPD):** L1–L3. Resultado: pode tocar PII de cliente real sem risco juridico.
4. **Sprint "Onboarding" (P0 receita):** R4 + Q5 (branding). Resultado: 2o cliente entra sozinho com a propria marca.
5. **P1** (qualidade/observabilidade) → **P2** (limpeza/polimento) conforme folega.

> Nota: D1 (apagar codigo morto) pode ser feito a qualquer momento — e rapido e melhora muito a sensacao de "organizado". Bom candidato para o primeiro commit de cada sessao ociosa.
