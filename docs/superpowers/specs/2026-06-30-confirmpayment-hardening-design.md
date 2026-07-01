# Endurecer `PaymentsService.confirmPayment` — Design

**Data:** 2026-06-30
**Tipo:** Conserto de backend (correção de consistência/concorrência)
**Status:** APROVADO (2026-06-30) com as 2 decisões abertas resolvidas (§4.3 e §8). Plano de implementação a seguir. NÃO implementado ainda.

---

## 1. Contexto e problema

`PaymentsService.confirmPayment(pagamentoId, tenantId)` (`backend/src/modules/payments/payments.service.ts`, L659–705) é o ponto que marca um pagamento como **PAID** e transiciona o pedido para **CONFIRMADO**. Investigação read-only (2026-06-30) mostrou que ele é **auto-indefeso** — não provê a própria segurança de concorrência/atomicidade; depende inteiramente do chamador:

1. **Sem lock próprio** — o `findOne` (L660) lê o `Pagamento` (com `relations:['pedido']`) **sem** `pessimistic_write`. Compare com o webhook (L845, `FOR UPDATE`) e `orders.updateStatus` (L665).
2. **Dois `save()` possivelmente não-transacionais** — `save(pagamento)` (L675) e `save(pedido)` (L680) são chamadas separadas; `confirmPayment` **não abre transação própria**. Em autocommit, se o 2º falha → **pagamento PAID + pedido PENDENTE (órfão)**.
3. **Idempotência frágil** — a única guarda é o early-return `if status===PAID` (L669), **sem lock**. Dois `confirmPayment` concorrentes podem ambos ler PENDING e ambos gravar.
4. **Notificação pode duplicar** — `notifyPaymentConfirmed` (L683–688) roda dentro do bloco; sob concorrência sem lock, dispara 2×.
5. **Fura a state-machine** — seta `pedido.status = CONFIRMADO` com `save` cru (L679–680), **sem** `assertStatusTransition` nem `ordersService.updateStatus`.

### O que já está coberto vs exposto (importante pro tamanho do conserto)
- **Caminho do webhook MercadoPago (receita real): já protegido.** `handleMercadoPagoWebhook` chama `confirmPayment` **de dentro** do seu `runInTransaction` + `runWithManager` + `FOR UPDATE` (L837→845→880). Como `confirmPayment` resolve repositórios pelo mesmo `manager` (ALS), os dois saves rodam na transação do webhook (atômicos) e dois webhooks concorrentes serializam no `FOR UPDATE`. Pontos 2 e 3/4 **não se manifestam por essa rota.**
- **Exposto** (fora do lock do webhook):
  - **Cartão mock via `setTimeout(2s)` (L520)** — roda após o request retornar → **sem manager no ALS → autocommit** → ponto 2 real (órfão possível).
  - **Endpoint manual `POST /payments/:id/confirm` (controller L54)** — atômico (transação do interceptor) mas **sem lock** → manual×webhook ou manual×manual concorrentes podem dupla-confirmar/dupla-notificar.

**Nada está em produção real ainda** (o servidor é ambiente de teste), então isto é "endurecer antes de cliente pagante", não incêndio. Mas é a maior inconsistência conhecida do backend e deve ser fechada antes do go-live.

---

## 2. Objetivo

Tornar `confirmPayment` **auto-defensivo** — correto sozinho, sem depender do chamador prover lock/transação — de forma **compatível** com o lock que o webhook já tem (sem quebrá-lo nem duplicar trabalho). Concretamente, garantir para **todos** os call sites:
- **Atomicidade:** pagamento PAID e pedido CONFIRMADO commitam juntos ou nada (sem órfão PAID+PENDENTE).
- **Idempotência sob concorrência:** duas confirmações concorrentes do mesmo pagamento resultam em **1** pedido CONFIRMADO e **1** notificação.
- **Respeito à state-machine:** a transição PENDENTE→CONFIRMADO passa por `assertStatusTransition`.

---

## 3. Escopo / Não-escopo

**Escopo (backend apenas):**
- Reescrever o corpo de `confirmPayment` para ser transacional + travado + passar pela state-machine + notificar uma vez.
- Testes de concorrência/atomicidade provando as garantias.

**NÃO-escopo:**
- **Não tocar no frontend.**
- **Não alterar o fluxo do `handleMercadoPagoWebhook`** que já funciona (assinatura, `FOR UPDATE`, idempotência de reenvio, liberação de reserva). O conserto deve ser **compatível por dentro** com o lock existente — o webhook continua chamando `confirmPayment` exatamente como hoje.
- Não mexer em estoque: confirmar pagamento **não** baixa estoque de propósito (reserva segue de pé; VENDA só no PRONTO). Isso permanece.
- Não redesenhar notificações (só garantir unicidade da que já existe).

---

## 4. Design do conserto

Três mudanças dentro de `confirmPayment`:

### 4.1 Envolver em transação + lock + re-checagem sob o lock
Envolver o corpo em `this.db.runInTransaction(async (manager) => { ... })`. Logo no início, **reler o `Pagamento` com `pessimistic_write` (`FOR UPDATE`)** — mesmo padrão do webhook (L845–850) e de `orders.updateStatus` (L665–670) — em vez de usar o snapshot pré-lock.
- **Dupla-checagem sob o lock:** após adquirir o lock, reavaliar `if (pagamento.status === PAID) return` (idempotência agora protegida pelo lock — fecha o ponto 3).
- Só então setar PAID e persistir.

Isso corrige atomicidade (ponto 2) e corrida (ponto 3) em **todos** os call sites, inclusive `setTimeout` e endpoint manual — sem depender do lock do webhook.

### 4.2 Transição do pedido pela state-machine
Trocar o `save(pedido)` cru (L679–680) por **`ordersService.updateStatus(pedido.id, CONFIRMADO, tenantId)`**, que já faz `assertStatusTransition` (orders L659), lock do pedido (L665) e no-op idempotente se já no alvo (L679–681). Fecha os pontos 1 (parte pedido) e 5.
- Como isso roda dentro do mesmo `runInTransaction`/manager, o lock do pedido do `updateStatus` recai na transação corrente (ver §5).

### 4.3 Notificação única, pós-commit
- Disparar `notifyPaymentConfirmed` **depois do commit** da transação, e **condicionada a "fui eu quem efetivamente transicionou"** (o pedido estava PENDENTE e este processo, sob o lock, gravou CONFIRMADO). Sob o lock de 4.1, só o vencedor entra no bloco → notifica 1×. Fecha o ponto 4.
- **Decisão (APROVADA 2026-06-30):** suprimir a notificação de mudança de status do `updateStatus` **na transição para CONFIRMADO**; manter **apenas** `notifyPaymentConfirmed` (a mensagem específica de pagamento). O cliente recebe **UMA** mensagem na confirmação de pagamento. Implementação: `updateStatus` não deve emitir `notifyOrderStatusChange` nesse caminho — via opção/flag de supressão ou tratando essa transição específica sem notificar.

---

## 5. A nuance do aninhamento (considerada explicitamente)

Quando `confirmPayment` é chamado **de dentro do webhook** (que já abriu `runInTransaction` + `runWithManager` + segura o `FOR UPDATE` do pagamento):
- `this.db.runInTransaction` **reusa o manager corrente** do ALS store em vez de abrir uma transação nova (`db-context.service.ts` L33–39: se já há manager no contexto, roda dentro dele). Não há transação aninhada real nem novo `BEGIN`.
- O novo `FOR UPDATE` de 4.1 recai sobre a **mesma linha de `Pagamento` já travada** pela transação do webhook → é reentrante na própria transação (o lock já é nosso), **sem deadlock**.
- O `updateStatus` de 4.2 também roda no mesmo manager; seu `FOR UPDATE` do pedido idem.

Ou seja: **onde já há lock (webhook), reusamos**; **onde falta (setTimeout, manual), adicionamos**. O comportamento do webhook não muda — ele continua serializando e commitando como hoje; só que agora `confirmPayment` seria correto mesmo se o webhook não tivesse o lock.

**A confirmar na implementação:** que `runInTransaction` de fato detecta e reusa o manager do ALS (esperado por L33–39) e que o `pessimistic_write` reentrante na mesma transação não gera erro/deadlock no Postgres (é o mesmo lock já detido). Cobrir com o teste de webhooks concorrentes (§6).

---

## 6. Testes que provam a correção

Adicionar a `payments.integration.spec.ts` (DB real, via túnel de teste):

1. **Dois webhooks aprovados CONCORRENTES** (o furo hoje sem teste): semear pedido PENDENTE + pagamento PENDING; mockar `getPaymentDetails → approved`; disparar `Promise.all([handleMercadoPagoWebhook(payload), handleMercadoPagoWebhook(payload)])` (**simultâneos**, não sequenciais como o L936 atual). Asserir: pedido **CONFIRMADO uma vez**, pagamento **PAID**, **`notifyPaymentConfirmed` chamado exatamente 1×**, estoque **intacto**, **0 VENDA** no ledger.
2. **Manual × webhook concorrentes:** `Promise.all([confirmPayment(id, tenant), handleMercadoPagoWebhook(payload)])`. Asserir mesmas garantias (1 CONFIRMADO, 1 notificação) — cobre a exposição fora do lock do webhook.
3. **Caminho autocommit/atômico (regressão do órfão):** exercitar `confirmPayment` fora de transação externa (simulando o `setTimeout`) e **forçar falha no 2º passo** (transição do pedido); asserir **rollback** — o pagamento **não** fica PAID com pedido PENDENTE (sem órfão).
4. **Regressão:** os testes existentes continuam verdes — webhook approved (L884), reenvio sequencial idempotente (L936), rejected não cancela (L640), PIX expirado libera reserva (L528).

**Prova de aceite:** os cenários 1–3 falham com o código atual e passam depois do conserto.

---

## 7. Critérios de aceite

- `confirmPayment` roda em transação única, com `FOR UPDATE` no pagamento e re-checagem de idempotência sob o lock.
- Transição do pedido via `ordersService.updateStatus` (state-machine respeitada), sem `save` cru de status.
- Exatamente **uma** notificação ao cliente por confirmação, disparada **após o commit**; sem dupla notificação com `updateStatus` (decisão de §4.3 aplicada).
- Comportamento do webhook inalterado (assinatura, lock, reenvio, liberação de reserva).
- Testes 1–3 novos verdes + suíte de pagamentos/orders/estoque sem regressão.
- Zero mudança no frontend.

---

## 8. Riscos e considerações

- **Dupla notificação** (§4.3) — o principal risco funcional; resolvido pela decisão de qual caminho notifica.
- **Reentrância do lock** (§5) — a confirmar em teste que o `FOR UPDATE` reentrante na transação do webhook não gera erro.
- **Pagamento para pedido já cancelado — DECISÃO (APROVADA 2026-06-30): NÃO ressuscitar.** Se o pedido não estiver em PENDENTE (ex.: cancelado por expiração antes do webhook chegar), **não** transicionar para CONFIRMADO. Tratamento explícito: (a) **logar** o evento; (b) **não confirmar** o pedido (segue cancelado); (c) **notificar o lojista** de que entrou um pagamento para um pedido cancelado (provável **reembolso** — o cliente pagou, o pedido não existe mais e o estoque já foi liberado). O pagamento reflete que o dinheiro entrou (marcado PAID), mas o pedido permanece cancelado e o humano decide o reembolso. Tratado como **task explícita no plano** (não nota de rodapé).
- **Ordem commit→notifica** — mover a notificação para depois do commit significa que uma falha de notificação (WhatsApp fora) não desfaz a confirmação (correto: a venda está registrada; a notificação é best-effort, como já é hoje via try/catch).
