# Handoff — Frente `feat/pix-no-bot` (PIX no bot, provado localmente)

**Escrito para quem não estava aqui.** A frente está **code-complete e aprovada na revisão de branch**; falta só o Step 8 (prova real, manual, do dono) e o merge (do dono).

**Spec:** `docs/superpowers/specs/2026-06-29-pix-no-bot-design.md`
**Plano:** `docs/superpowers/plans/2026-06-29-pix-no-bot.md`
**Runbook do Step 8:** `scripts/test/pix-sandbox-roundtrip.md`

---

## 1. Estado factual

- **Branch:** `feat/pix-no-bot` (saiu da `main`, desacoplada do Admin).
- **Range:** `e0a8c0d..cdfe138` — 6 commits de código (+ commits de docs). `e0a8c0d` = merge-base com `main`.
- **NÃO mergeada.** Espera o Step 8 + o sinal do dono.
- **Revisão de branch (whole-front): PASSOU** — 4 costuras sólidas, **zero Critical, zero Important**, 1 Minor by-design (ver §4).
- Decisão de produto travada: **PIX exclusivamente** (cartão/boleto fora de escopo). **Provar local com token `TEST-` antes de qualquer deploy** — `APP_USR` (produção) é proibido em dev.

### Como re-verificar (comandos)
| O quê | Comando | Nota |
|---|---|---|
| Guarda de token (S1) | `cd backend && npm test -- mercadopago.provider.spec.ts` | 9/9 (8 guarda + 1 formato expiração) |
| Entrega + endereço (S2a) | `npm test -- whatsapp-checkout-collection.spec.ts` | unit, mocks |
| Bot PIX (S3) | `npm test -- whatsapp-pix-message.spec.ts` | unit, mocks |
| Webhook approved→CONFIRMADO (S4) | `npm test -- payments.integration.spec.ts` | precisa túnel `ucm_test_motor`; 5 falhas pré-existentes são por falta de Redis local (não regressão) |
| Retirada + slots (S5) | `npm test -- whatsapp-pickup.spec.ts` | unit, 14 testes |

---

## 2. O que cada task entregou (S1→S5)

- **S1 (Task 1) — Guarda bidirecional de token.** `MercadoPagoProvider`: `assertTokenMatchesEnv` no **construtor** (universal, fail-closed — token errado pro ambiente derruba o boot) **e** no início de `createPixPayment` (backstop). `APP_USR` fora de prod → lança; `TEST-` em prod → lança; token vazio nunca lança. Commit `8c6a0f1`.
- **S2a (Task 2) — Entrega.** `handleCheckout` para de criar pedido direto; coleta nome→telefone→endereço, **monta e mostra o endereço pro cliente confirmar** antes de criar. Pedido só nasce após confirmação. Guarda em `orders.service.create`: entrega exige endereço completo (fail-fast). **Fix de roteamento** (`7bfe355`): precedência do checkout ativo no topo de `detectIntent` (senão "entrega"/"confirmar" eram sequestrados). Commits `33f5445`+`7bfe355`.
- **S3 (Task 3) — Bot sem buracos.** Envia imagem do QR (`sendImage`) + copia-e-cola; mostra o **desconto PIX explícito** ("de R$X por R$Y", 5%); falha de PIX → mensagem honesta + `payment_issue=true` (coluna booleana INDEXADA, consultável por WHERE — Admin "atenção" acha de graça ao mergear) + `notifyMerchantPaymentIssue` (best-effort, catch externo que jamais propaga). Commit `a6cf52c`.
- **S4 (Task 4) — Marco.** Teste de integração `approved → CONFIRMADO`: pagamento PAID, pedido confirmado, notifica, **estoque INTACTO + zero VENDA no ledger** (commitSale é no PRONTO), idempotente. `formatPixExpiration` (offset `-03:00` via Intl, NÃO o `.toISOString()` UTC nem o date-only do boleto) ligado a `ORDER_PAYMENT_TTL_MINUTES` (60). Commit `d7e1dc2`.
- **S5 (Task 5) — Retirada com slots.** `scheduled_at timestamptz` (migration). O bot oferece **slots gerados do `business_hours`** (cliente escolhe número — nunca digita data); slot válido por construção, `isWithinBusinessHours` vira backstop. Fonte: `tenant.settings.business_hours` (`{ days, open, close, tz }`). **Default RESTRITIVO:** sem config → retirada não é oferecida ("só entregas"). Fuso da loja via Intl (respeita DST). Commit `cdfe138`.

---

## 3. Invariantes (não desfazer sem reabrir o spec)

1. **Guarda de token é o único caminho pro PIX.** O guarda do construtor é universal; `createPixPayment` é o único ponto que cobra PIX e tem o backstop. NÃO remova nenhum dos dois. NÃO crie um caminho a `payment.create` que pule o construtor.
2. **`commitSale` (baixa/VENDA) é no PRONTO, não no pagamento.** Confirmar pagamento muda o pedido pra CONFIRMADO e **não toca estoque** (a reserva continua). O teste central da S4 assere isso.
3. **`date_of_expiration` do PIX = `ORDER_PAYMENT_TTL_MINUTES` (60), formato com offset `-03:00`.** Não use `.toISOString()` cru (UTC `Z`) nem o formato date-only do boleto.
4. **Pedido só nasce com os dados do seu tipo.** Entrega → `delivery_address` completo; retirada → `scheduled_at` válido. Confirmação do endereço (entrega) e slot escolhido (retirada) acontecem ANTES da criação.
5. **Slots de retirada são válidos por construção.** Gerados do `business_hours`, sem passado. `isWithinBusinessHours` é backstop, não a primeira linha.
6. **Testes de fluxo conversacional entram pelo roteador (porta da frente), nunca pela FSM direto.** Foi o furo da Task 2; ver memória `feedback-test-through-front-door`.

---

## 4. Dívida conhecida (registrada, NÃO bloqueia)

**Validação de janela de retirada no `orders.service` (Minor, inativa hoje).** A guarda de pickup em `orders.service.create` valida que `scheduled_at` existe e é válido, **mas não que cai dentro do `business_hours`**. Hoje isso é seguro: o **único caller é o bot**, que só passa slot gerado do `business_hours` (válido por construção), então a janela está garantida na origem.

**Ativa-se SE surgir um segundo caller de pickup** (API pública, import, PDV) que monte `scheduled_at` por fora do bot — aí a janela não seria checada no service. **Ação no dia que isso acontecer:** adicionar `isWithinBusinessHours` (no fuso da loja) na guarda de `orders.service.create`. Há um comentário no código, no ponto exato da guarda (`orders.service.ts`, guarda de pickup), apontando isto. Não otimizar pra esse caller enquanto ele não existe.

---

## 5. Pendente — Step 8 (do DONO) + merge (do DONO)

**O Step 8 é manual e do dono — não há como o agente executá-lo** (precisa de `docker`, do painel do MercadoPago e do clique no ambiente do dono). O agente acompanha lendo o resultado checkpoint por checkpoint.

**Pré-requisitos (o dono põe de pé):**
1. **Redis local:** `docker run -d --name ucm-redis -p 6379:6379 redis:7`. *(Necessário porque esta branch saiu da main ANTES do fix "cache não-fatal" que vive na branch do Admin não-mergeada; sem Redis, `POST /products`/checkout dá 500. Quando PIX e Admin convergirem no deploy, o fix entra junto e isso some.)*
2. **Credenciais `TEST-`** do MercadoPago (painel → credenciais de teste; começa com `TEST-`, nunca `APP_USR-`). O guarda da S1 impede subir com `APP_USR` em dev.

**Procedimento:** seguir `scripts/test/pix-sandbox-roundtrip.md`. O que o Step 8 prova (e por quê vale): o handler **re-consulta o status no MP** (`getPaymentDetails`), não confia no corpo do POST — então só confirma se o MP realmente disser `approved`. É o caminho real, não mock.

**Provar o PORQUÊ, não só o verde:**
- **"Confirmou porque o MP disse approved, não porque aceitou o POST":** dispare o POST do webhook ANTES de aprovar no sandbox (pagamento ainda `pending`) → NÃO confirma (pedido segue `pendente_pagamento`). Depois aprove e dispare de novo → confirma. A diferença entre os dois POSTs idênticos é o status real no MP.
- **"Estoque intacto porque o commitSale não rodou, não por acaso":** olhe `movimentacoes_estoque_historico` do pedido — **zero linhas `tipo='VENDA'`**. A ausência da VENDA é a prova (o commitSale é o que a grava, e só roda no PRONTO).

**Merge (do dono, depois do Step 8 provar):** a frente PIX **inteira** (não fragmentada). Checklist antes do merge: branch `feat/pix-no-bot`, árvore limpa, Step 8 provado localmente com `TEST-`. O merge do Admin (`feat/admin-inventory`) é separado e também espera o dono.
