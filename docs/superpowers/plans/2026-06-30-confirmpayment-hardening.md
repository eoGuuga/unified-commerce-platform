# Endurecer `confirmPayment` — Plano de Implementação

> **Para executores agênticos:** SUB-SKILL: usar superpowers:subagent-driven-development (recomendado) para executar task-a-task, com review de concorrência entre elas. Steps usam checkbox (`- [ ]`).

**Goal:** Tornar `PaymentsService.confirmPayment` auto-defensivo (transação própria + `FOR UPDATE` + idempotência sob lock), transicionar o pedido pela state-machine, e garantir **uma** notificação — sem quebrar o fluxo do webhook que já funciona.

**Arquitetura:** Backend NestJS + TypeORM + Postgres. O conserto é interno ao `confirmPayment` (+ uma opção nova em `orders.updateStatus` + um método novo de notificação ao lojista). Compatível com o lock que o `handleMercadoPagoWebhook` já detém (reentrância na mesma transação).

**Tech Stack:** NestJS, TypeORM (`pessimistic_write`), Jest (integração via túnel SSH ao Postgres de teste `ucm_test_motor` em `localhost:5544`).

Spec: `docs/superpowers/specs/2026-06-30-confirmpayment-hardening-design.md` (APROVADO).

## Global Constraints (valem para TODAS as tasks)
- **Backend só. ZERO frontend.**
- **NÃO alterar o fluxo do `handleMercadoPagoWebhook`** (assinatura HMAC, `FOR UPDATE` L845, idempotência de reenvio, liberação de reserva). Ele continua chamando `confirmPayment(id, tenant)` exatamente como hoje. O conserto deve ser **reentrante** dentro da transação/lock dele.
- **NÃO mexer em estoque** no caminho de confirmação (confirmar pagamento não baixa nem libera estoque; reserva segue; VENDA só no PRONTO).
- **Cliente recebe UMA notificação** na confirmação de pagamento (só `notifyPaymentConfirmed`; a notificação de status do `updateStatus` é suprimida nessa transição — decisão §4.3).
- **Pagamento para pedido já cancelado: NÃO ressuscitar** (decisão §8) — logar + não confirmar + notificar o lojista.
- Testes de integração rodam via `cd backend && npx jest --testPathPattern="payments.integration" --runInBand` (túnel de teste UP). Nenhum teste existente pode regredir.
- Commits: Conventional Commits em inglês, atômicos, trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Branch: `fix/confirmpayment-hardening` (já criada).

## File Structure (arquivos tocados)
- **Modify:** `backend/src/modules/payments/payments.service.ts` — reescrever `confirmPayment` (L659–705).
- **Modify:** `backend/src/modules/orders/orders.service.ts` — `updateStatus` ganha opção de suprimir notificação.
- **Modify:** `backend/src/modules/notifications/notifications.service.ts` — método novo `notifyMerchantPaymentForCancelledOrder` (ou reuso do `notifyMerchantPaymentIssue` com motivo específico).
- **Test:** `backend/src/modules/payments/payments.integration.spec.ts` — 5 testes novos (concorrência + reentrância + rollback + dedupe + pedido-cancelado).

## Ordem das tasks (racional pedido pelo dono)
Segue **TDD por task** — o teste de concorrência de cada task vem JUNTO com o conserto dela (escreve o teste que falha → implementa → passa). **T1 primeiro** porque é o núcleo transacional/lock sobre o qual as garantias das demais se apoiam. T2 (state-machine + dedupe) e T3 (pedido cancelado) constroem sobre a transação de T1.

- **T1** — Núcleo: transação + `FOR UPDATE` + idempotência sob lock + atomicidade. *(Inclui o teste explícito de reentrância do lock.)*
- **T2** — Transição pela state-machine (`updateStatus`) + supressão da notificação duplicada.
- **T3** — Tratamento explícito de "pagamento para pedido já cancelado".

---

### Task 1: `confirmPayment` transacional, travado e idempotente sob lock

**Files:**
- Modify: `backend/src/modules/payments/payments.service.ts` (`confirmPayment` L659–705)
- Test: `backend/src/modules/payments/payments.integration.spec.ts`

**Interfaces:**
- Consome: `this.db.runInTransaction(fn)` e `this.db.runWithManager` (`common/services/db-context.service.ts` — L33–39 reusa o manager corrente quando já há transação no ALS). `manager.findOne(Pagamento, { where, relations, lock:{ mode:'pessimistic_write' } })`.
- Produz (para T2/T3): `confirmPayment` já roda dentro de `runInTransaction(manager => ...)`; a leitura travada do `Pagamento` e do `pedido` (relation) fica disponível para as próximas tasks.

**Design do corpo novo (esqueleto — o implementer adapta ao arquivo real):**
```ts
async confirmPayment(pagamentoId: string, tenantId: string): Promise<Pagamento> {
  const result = await this.db.runInTransaction(async (manager) => {
    // 1. Relê o pagamento COM lock (FOR UPDATE). Reentrante se o webhook já travou esta linha.
    const pagamento = await manager.findOne(Pagamento, {
      where: { id: pagamentoId, tenant_id: tenantId },
      relations: ['pedido'],
      lock: { mode: 'pessimistic_write' },
    });
    if (!pagamento) throw new NotFoundException(`Pagamento ${pagamentoId} não encontrado`);

    // 2. Idempotência AGORA sob o lock (fecha a corrida).
    if (pagamento.status === PagamentoStatus.PAID) return { pagamento, alreadyPaid: true };

    // 3. Marca pago (1º write, na transação).
    pagamento.status = PagamentoStatus.PAID;
    await manager.save(pagamento);

    // 4. Transição do pedido — nesta task, ainda o save direto (mudará na T2).
    const pedido = pagamento.pedido;
    let didConfirm = false;
    if (pedido && pedido.status === PedidoStatus.PENDENTE_PAGAMENTO) {
      pedido.status = PedidoStatus.CONFIRMADO;
      await manager.save(pedido);   // 2º write, MESMA transação → atômico com o 1º
      didConfirm = true;
    }
    return { pagamento, pedido, didConfirm, alreadyPaid: false };
  });

  // 5. Notificação única, FORA do callback (pós-commit quando standalone; igual ao de hoje quando aninhado no webhook).
  if (result.didConfirm) {
    try { await this.notificationsService.notifyPaymentConfirmed(result.pedido, result.pagamento); }
    catch (e) { this.logger.error(`notifyPaymentConfirmed falhou: ${e.message}`); }
  }
  return result.pagamento;
}
```
> **Nuance da reentrância (a confirmar EM TESTE):** quando o webhook chama `confirmPayment` de dentro do seu `runInTransaction` + `FOR UPDATE`, o `runInTransaction` reusa o manager corrente (db-context L33–39) e o `pessimistic_write` do passo 1 recai na **mesma linha já travada** pela própria transação → reentrante, **sem deadlock nem erro**. O teste 1c abaixo prova isso.

- [ ] **Step 1 — Escrever os testes que FALHAM (concorrência + rollback + reentrância):** em `payments.integration.spec.ts`, novo `describe('confirmPayment — endurecimento')`:

```ts
// 1a — DOIS confirmPayment MANUAIS concorrentes (hoje sem lock → dupla confirmação/notificação)
it('1a: dois confirmPayment concorrentes → pedido CONFIRMADO 1x, pagamento PAID, notifica 1x', async () => {
  const { pedido, pagamento } = await seedPendingOrderWithPendingPayment(); // helper (ver Step 2)
  const notifySpy = jest.spyOn(notificationsService, 'notifyPaymentConfirmed');
  await Promise.all([
    paymentsService.confirmPayment(pagamento.id, TENANT_ID),
    paymentsService.confirmPayment(pagamento.id, TENANT_ID),
  ]);
  const p = await reloadPedido(pedido.id);
  expect(p.status).toBe(PedidoStatus.CONFIRMADO);
  expect((await reloadPagamento(pagamento.id)).status).toBe(PagamentoStatus.PAID);
  expect(notifySpy).toHaveBeenCalledTimes(1);         // <- FALHA hoje (dispara 2x)
  // estoque intacto + 0 VENDA no ledger
  expect(await countVendaMovimentos(pedido.id)).toBe(0);
});

// 1b — atomicidade: se o 2º write falha, o 1º (pagamento) faz ROLLBACK (sem órfão PAID+PENDENTE)
it('1b: falha na transição do pedido → rollback, sem órfão PAID+PENDENTE', async () => {
  const { pedido, pagamento } = await seedPendingOrderWithPendingPayment();
  // força o save do pedido a lançar UMA vez (dentro da transação)
  const saveSpy = jest.spyOn(EntityManager.prototype, 'save')
    .mockImplementationOnce(async () => { throw new Error('boom no 2º save'); });
  await expect(paymentsService.confirmPayment(pagamento.id, TENANT_ID)).rejects.toThrow();
  saveSpy.mockRestore();
  expect((await reloadPagamento(pagamento.id)).status).toBe(PagamentoStatus.PENDING); // <- FALHA hoje (fica PAID órfão)
  expect((await reloadPedido(pedido.id)).status).toBe(PedidoStatus.PENDENTE_PAGAMENTO);
});

// 1c — REENTRÂNCIA: dois WEBHOOKS aprovados concorrentes (confirmPayment roda dentro do FOR UPDATE do webhook)
it('1c: dois webhooks aprovados concorrentes → 1 CONFIRMADO, 1 notificação, SEM deadlock', async () => {
  const { pedido, pagamento } = await seedPendingOrderWithPendingPayment();
  mockGetPaymentDetails('approved', pagamento); // MP retorna approved
  const notifySpy = jest.spyOn(notificationsService, 'notifyPaymentConfirmed');
  const payload = webhookPayloadFor(pagamento);
  await Promise.all([
    paymentsService.handleMercadoPagoWebhook(payload, validHeaders(payload)),
    paymentsService.handleMercadoPagoWebhook(payload, validHeaders(payload)),
  ]); // NÃO pode lançar deadlock/erro
  expect((await reloadPedido(pedido.id)).status).toBe(PedidoStatus.CONFIRMADO);
  expect(notifySpy).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2 — Garantir os helpers de seed** (`seedPendingOrderWithPendingPayment`, `reloadPedido/Pagamento`, `countVendaMovimentos`, `mockGetPaymentDetails`, `webhookPayloadFor`, `validHeaders`): reusar/estender os que já existem no `payments.integration.spec.ts` (o bloco de webhook approved em ~L708/L884 já semeia pedido PENDENTE + pagamento PENDING e mocka `getPaymentDetails`). Não duplicar — extrair helper se necessário.

- [ ] **Step 3 — Rodar os testes e confirmar que 1a e 1b FALHAM (1c pode passar hoje, pois o webhook já trava):**
  `cd backend && npx jest --testPathPattern="payments.integration" -t "endurecimento" --runInBand`
  Esperado: 1a ❌ (notifica 2x), 1b ❌ (órfão PAID), 1c ✅ (já protegido) — provando que o conserto é necessário e que o webhook já serializa.

- [ ] **Step 4 — Implementar** o corpo novo de `confirmPayment` (esqueleto acima): `runInTransaction` + `findOne` com `lock: pessimistic_write` + idempotência sob lock + os dois `save` na mesma transação + notificação única fora do callback.

- [ ] **Step 5 — Rodar e confirmar 1a, 1b, 1c VERDES** + nenhum teste existente de `payments.integration` regrediu:
  `cd backend && npx jest --testPathPattern="payments.integration" --runInBand`

- [ ] **Step 6 — Commit:** `fix(payments): make confirmPayment transactional with FOR UPDATE + idempotency under lock`

---

### Task 2: Transição pela state-machine + supressão da notificação duplicada

**Files:**
- Modify: `backend/src/modules/orders/orders.service.ts` (`updateStatus` L646–734 — adicionar opção de suprimir notificação)
- Modify: `backend/src/modules/payments/payments.service.ts` (`confirmPayment` passo 4 → usar `updateStatus`)
- Test: `payments.integration.spec.ts`

**Interfaces:**
- Consome: `ordersService.updateStatus(orderId, status, tenantId, opts?)` — assinatura estendida com `opts?: { suppressNotification?: boolean }`. `updateStatus` já faz `assertStatusTransition` (L659) + lock do pedido (L665) + no-op idempotente (L679–681).
- Produz: a transição PENDENTE→CONFIRMADO passa a respeitar a state-machine; a notificação de status do `updateStatus` é suprimida nesse caminho.

- [ ] **Step 1 — Teste que FALHA (state-machine + notificação única):**
```ts
it('2a: transição vai pela state-machine (assertStatusTransition) e NÃO dupla-notifica', async () => {
  const { pedido, pagamento } = await seedPendingOrderWithPendingPayment();
  const paySpy = jest.spyOn(notificationsService, 'notifyPaymentConfirmed');
  const statusSpy = jest.spyOn(notificationsService, 'notifyOrderStatusChange'); // a do updateStatus
  const updSpy = jest.spyOn(ordersService, 'updateStatus');
  await paymentsService.confirmPayment(pagamento.id, TENANT_ID);
  expect(updSpy).toHaveBeenCalledWith(pedido.id, PedidoStatus.CONFIRMADO, TENANT_ID, expect.objectContaining({ suppressNotification: true }));
  expect(paySpy).toHaveBeenCalledTimes(1);        // UMA mensagem ao cliente
  expect(statusSpy).not.toHaveBeenCalled();        // <- FALHA hoje (dispara a de status também)
  expect((await reloadPedido(pedido.id)).status).toBe(PedidoStatus.CONFIRMADO);
});
```

- [ ] **Step 2 — Rodar e ver 2a FALHAR** (`-t "2a"`).

- [ ] **Step 3 — Implementar:**
  - Em `orders.service.ts`, `updateStatus` ganha `opts?: { suppressNotification?: boolean }`; quando `true`, **não** chama `notifyOrderStatusChange` (mas continua fazendo a transição + lock + `commitSale`/`release` conforme o alvo). Default `false` → comportamento atual inalterado para todos os outros chamadores.
  - Em `confirmPayment` passo 4, trocar o `save(pedido)` cru por `await this.ordersService.updateStatus(pedido.id, PedidoStatus.CONFIRMADO, tenantId, { suppressNotification: true })` **dentro** do `runWithManager`/manager corrente (para herdar a transação). Manter `didConfirm=true` só quando a transição de fato ocorreu (pedido estava PENDENTE).

- [ ] **Step 4 — Rodar 2a + regressão** (`payments.integration` + `orders.integration` — o `updateStatus` é compartilhado): `cd backend && npx jest --testPathPattern="payments.integration|orders.integration" --runInBand`. Nenhum teste de orders pode regredir (a opção é opt-in, default preserva o comportamento).

- [ ] **Step 5 — Commit:** `fix(payments): route confirmPayment order transition through state-machine + single notification`

---

### Task 3: Pagamento para pedido já cancelado — não ressuscitar

**Files:**
- Modify: `backend/src/modules/payments/payments.service.ts` (`confirmPayment` — branch do pedido não-PENDENTE)
- Modify: `backend/src/modules/notifications/notifications.service.ts` (método `notifyMerchantPaymentForCancelledOrder`, ou reuso do `notifyMerchantPaymentIssue` com motivo)
- Test: `payments.integration.spec.ts`

**Interfaces:**
- Consome: o resultado da transação de T1/T2 sabe se `pedido.status` não é PENDENTE nem CONFIRMADO (ex.: CANCELADO por expiração).
- Produz: nada ressuscita; o lojista é avisado.

**Comportamento (decisão §8):** se, sob o lock, o pedido **não** está em PENDENTE_PAGAMENTO (cancelado por expiração antes do webhook):
1. **Marca o pagamento PAID** (o dinheiro entrou de verdade) — já feito no passo 3 de T1.
2. **NÃO** transiciona o pedido (segue cancelado; `didConfirm=false`).
3. **Loga** o evento (warn com pedido.id, status atual, pagamento.id).
4. **Notifica o lojista**: entrou pagamento para pedido cancelado → provável **reembolso** (cliente pagou, pedido não existe mais, estoque já liberado). Fora do callback, single-fire.

- [ ] **Step 1 — Teste que FALHA:**
```ts
it('3a: pagamento para pedido CANCELADO → não ressuscita, lojista avisado, pagamento PAID, estoque inalterado', async () => {
  const { pedido, pagamento } = await seedPendingOrderWithPendingPayment();
  await cancelOrder(pedido.id); // simula expiração/cancelamento (status CANCELADO, reserva liberada)
  const stockBefore = await readStock(pedido);
  const merchantSpy = jest.spyOn(notificationsService, 'notifyMerchantPaymentForCancelledOrder');
  const custSpy = jest.spyOn(notificationsService, 'notifyPaymentConfirmed');
  await paymentsService.confirmPayment(pagamento.id, TENANT_ID);
  expect((await reloadPedido(pedido.id)).status).toBe(PedidoStatus.CANCELADO); // NÃO ressuscitou
  expect((await reloadPagamento(pagamento.id)).status).toBe(PagamentoStatus.PAID); // dinheiro entrou
  expect(merchantSpy).toHaveBeenCalledTimes(1);   // <- FALHA hoje (não existe)
  expect(custSpy).not.toHaveBeenCalled();          // cliente NÃO recebe "pagamento confirmado"
  expect(await readStock(pedido)).toEqual(stockBefore); // estoque inalterado (nada de VENDA nem re-reserva)
});
```

- [ ] **Step 2 — Rodar e ver 3a FALHAR** (`-t "3a"`).

- [ ] **Step 3 — Implementar:**
  - `notifications.service.ts`: `notifyMerchantPaymentForCancelledOrder(pedido, pagamento)` — resolve `owner_id → Usuario.phone/email` do tenant (mesmo padrão do `notifyMerchantPaymentIssue`) e manda "entrou um pagamento de R$X para o pedido #Y que já foi cancelado — verifique reembolso". Best-effort (try/catch).
  - `confirmPayment`: no branch `pedido && pedido.status !== PENDENTE && status !== CONFIRMADO`, setar um flag `paidForCancelled=true` no resultado; fora do callback, logar + chamar `notifyMerchantPaymentForCancelledOrder`. Não chamar `notifyPaymentConfirmed`.

- [ ] **Step 4 — Rodar 3a + suíte inteira de pagamentos:** `cd backend && npx jest --testPathPattern="payments.integration" --runInBand`. Verde.

- [ ] **Step 5 — Commit:** `fix(payments): handle payment for already-cancelled order (notify merchant, no resuscitate)`

---

## Verificação final (pós-T3)
- Rodar a suíte de integração relevante inteira: `cd backend && npx jest --testPathPattern="payments.integration|orders.integration|stock" --runInBand` — tudo verde, zero regressão.
- **Review whole-branch** (subagent-driven, modelo capaz): focar em (a) reentrância do lock sob o webhook (sem deadlock), (b) que o webhook NÃO mudou de comportamento, (c) atomicidade dos dois writes, (d) notificação única em todos os caminhos.
- **Sem merge/push** até o dono revisar. Frente é backend-only; nenhum arquivo de frontend tocado.

## Self-review do plano (checado)
- **Cobertura do spec:** §4.1 lock+tx+recheck → T1; §4.2 state-machine → T2; §4.3 dedupe notificação → T2; §5 reentrância → T1 (teste 1c); §6 testes (webhook concorrente, manual×webhook, autocommit-rollback) → 1a/1b/1c; §8 pedido cancelado → T3. ✔
- **Ordem:** T1 (núcleo transacional) antes de T2/T3, TDD por task (teste-que-falha primeiro). ✔
- **Reentrância do lock:** teste explícito 1c (dois webhooks concorrentes, sem deadlock). ✔
- **Pedido cancelado:** task explícita T3 (não rodapé). ✔
- **Placeholders:** nenhum — cada task tem teste concreto + esqueleto de implementação.
