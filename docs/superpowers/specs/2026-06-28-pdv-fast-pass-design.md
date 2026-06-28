# Spec — PDV Fast-Pass (venda de balcão)

**Data:** 2026-06-28
**Status:** Aprovado — pronto para plano de implementação
**Escopo:** Backend (NestJS + TypeORM + Postgres). Nenhuma mudança de UI.
**Depende de:** Motor de Estoque (`2026-06-28-motor-de-estoque-design.md`, já mergeado na main) — usa `StockEngineService.reserve`/`commitSale`.
**Fecha:** o follow-up de PDV apontado na revisão final do motor (settlement de balcão).

---

## 1. Problema

O Motor de Estoque cobre os canais order-driven (ecommerce/WhatsApp): `orders.create` **reserva**, e a baixa só ocorre na transição para `PRONTO`. O **PDV (balcão)** é diferente: o cliente aponta o produto, **paga e leva na hora** — não há fase pendente nem produção.

Hoje (verificado): `CanalVenda.PDV` existe no enum, mas `orders.create` põe **todos** os canais em `PENDENTE_PAGAMENTO` (linha 251, sem ramo por canal). Consequência (apontada na revisão final do motor): uma venda PDV via `create` **reservaria mas nunca chegaria a `PRONTO`** → estoque nunca baixa **e** o sweeper cancelaria o pedido após o TTL, liberando reserva de mercadoria que já saiu. Não dispara hoje (o PDV não está plugado a nenhuma UI — `frontend/components/pdv/PdvPaymentModal.tsx` é órfão), mas é **crítico antes de lançar o PDV**.

**Objetivo:** um **fast-pass atômico** — quando `channel='pdv'`, a mesma transação de `create` reserva, comita a baixa no ledger, registra o pagamento já PAGO e nasce com status `ENTREGUE`. Tudo num único `db.runInTransaction`, com rollback automático como rede de segurança.

**Premissa de realidade:** quando este endpoint é chamado, a liquidação **física** já ocorreu (maquininha aprovou / PIX confirmado visualmente no balcão). O backend é o **settlement definitivo** daquela venda — não inicia cobrança externa.

---

## 2. Abordagem (decidida): ramo `channel='pdv'` dentro de `orders.create`

Reusar a artéria `create` em vez de criar um `PdvService`/endpoint separado.

- **Por quê:** o `create` já tem o **lock pessimista**, a revalidação de preço (rejeita divergência > 0.01), o cupom e a criação de itens. Um serviço separado duplicaria esse andaime (DRY) e criaria duas fontes da verdade para imposto/preço/cupom.
- **Concorrência de graça:** o cliente do balcão concorre pelo último item com o cliente do WhatsApp **sob o mesmo lock transacional**.
- **Sem eventos fantasmas:** o PDV nasce `ENTREGUE` diretamente (não percorre `confirmado`/`em_producao`), mantendo a trilha de auditoria limpa — uma venda de balcão nunca esteve "em produção", ela simplesmente aconteceu.

Rejeitadas: (B) serviço/endpoint dedicado — duplica a artéria; (C) criar `PENDENTE` e auto-avançar pela máquina — polui a auditoria com estados falsos.

---

## 3. Contrato de entrada (DTO)

`CreateOrderDto` ganha um campo **opcional aninhado**:

```ts
payment?: { method: MetodoPagamento }   // dinheiro | pix | debito | credito
```

Regras de validação (class-validator + checagem no service):

| Regra | Comportamento |
|---|---|
| `channel='pdv'` | `payment.method` **obrigatório**, ∈ `{dinheiro, pix, debito, credito}` (boleto excluído — não é pagamento de balcão instantâneo) |
| `payment` presente em canal **não-PDV** | **rejeitado** (`BadRequestException`) — blinda contra injeção de pagamento pré-aprovado em canais que exigem conciliação |
| Cliente | PDV permite **anônimo**: `customer_name`/`customer_phone` opcionais (default "Cliente Balcão"). Demais canais inalterados |
| Entrega | PDV força `delivery_type` de retirada/balcão, **sem** `delivery_address` |
| Valor | **Não** vem do cliente — `amount` do pagamento = `total` recalculado no servidor (anti-adulteração). Valor recebido/troco **fora** do backend (cálculo de tela; YAGNI) |

---

## 4. Fluxo da transação (ramo PDV no `create`)

Tudo dentro do **mesmo** `db.runInTransaction` (uma transação, um rollback):

```
1.  Lock pessimista nas linhas de estoque                       [compartilhado]
2.  Valida produtos ativos + recalcula preço + rejeita divergência >0.01  [compartilhado]
3.  Valida e aplica cupom (PDV aceita desconto de balcão)       [compartilhado]
4.  Calcula subtotal / desconto / total                         [compartilhado]
5.  reserve(item) por item → guarda available = current - reserved >= qty  [compartilhado]
6.  Cria + salva o Pedido (gera order_id)
        status = ENTREGUE            ← [ramo PDV]   (demais canais: PENDENTE_PAGAMENTO)
7.  Cria + salva os ItemPedido
8.  [ramo PDV] commitSale(manager, tenantId, pedido.id, items)
        → current -= qty, reserved -= qty, injeta VENDA(order_id) no ledger
9.  [ramo PDV] insere Pagamento { pedido_id, method, status=PAGO (PagamentoStatus.PAID),
        amount=total (nome real do campo conforme entidade Pagamento),
        metadata: { pdv: true, confirmed_at_counter: true } }
10. Consome cupom (used_count++ guardado)                       [compartilhado]
11. return pedido    → COMMIT (ou ROLLBACK total em qualquer erro)
```

**reserve *seguido de* commit (não baixa direta):** o `reserve` (passo 5) faz a checagem de disponibilidade que **respeita reservas alheias** (carrinhos/pedidos online pendentes). Exemplo: `current=5, reserved=3` (online); PDV de 2 → `5-3=2 >= 2` ✓; depois `commitSale` baixa `current→3` e devolve `reserved→3` (as 3 reservas online **intactas**, via `GREATEST(0, reserved-qty)`). O balcão consome só o que está realmente livre.

**Ordem importa:** o Pedido é salvo (passo 6) **antes** do `commitSale` (passo 8) porque a linha `VENDA` do ledger referencia `order_id`.

---

## 5. Máquina de estados & blindagem contra webhook externo

O PDV **nasce em `ENTREGUE`** — o `create` seta o status inicial diretamente, **sem** passar por `assertStatusTransition` (que governa apenas `updateStatus`). Blindagem em camadas:

1. **Raiz — sem porta externa:** o pagamento PDV é **interno** (insert direto, sem `createPayment`/MercadoPago, sem `external_id`). `handleMercadoPagoWebhook` só age sobre pagamentos que ele criou no MP (resolve por id externo). Sem id externo, **nenhum webhook do MP referencia** a venda PDV. Não há porta para invadir.
2. **`ENTREGUE` é terminal** em `assertStatusTransition` (`[ENTREGUE]: []`). Qualquer `updateStatus(entregue → *)` **lança** "transição inválida" → impossível re-confirmar/re-pagar.
3. **Caminhos de release escopados a `pendente_pagamento`:** `releaseExpiredPendingOrder` e o sweeper usam `WHERE status='pendente_pagamento'` → no pedido PDV (`ENTREGUE`) retornam **0 linhas → no-op**.
4. **Sweeper:** como o PDV nunca fica `pendente_pagamento`, o varredor **nunca o vê** — o gap de PDV-no-sweeper se resolve **inerentemente** ao nascer `ENTREGUE`. Nenhuma exclusão especial necessária.

Resumo: o pedido **nasce e morre como `ENTREGUE`**, imutável pós-criação **por design** — não por trava ad-hoc.

---

## 6. Pagamento sem I/O externo

O `Pagamento` do PDV é um **insert direto** dentro da transação, já `PAGO` — operação de banco, **não** chamada de rede. Nenhum provider é tocado (sem `createPayment`, sem QR, sem polling). `metadata: { pdv: true, confirmed_at_counter: true }` (marcador semântico, espelhando o `requires_manual_confirmation` do fluxo de dinheiro existente, mas **nascendo PAGO**). `amount = total` recalculado no servidor.

Assim a transação travada (lock pessimista) **permanece livre de I/O externo** — só DB, rápida, honrando a regra de ouro do motor ("nenhuma chamada externa sob lock").

---

## 7. Erros, rollback e edge cases

- **Rollback atômico:** qualquer falha (reserva insuficiente, preço divergente, cupom esgotado, erro de DB) → `throw` → rollback total do `db.runInTransaction`. **Nada** persiste: sem pedido, sem itens, sem `VENDA` no ledger, sem pagamento. (Cliente desiste do cartão no balcão → o operador simplesmente não submete; nada a limpar.)
- **Idempotência:** `create` já aceita `idempotencyKey` (IdempotencyService). Retry da venda PDV (mesma chave) devolve o **mesmo** pedido — baixa única (índice único `(order_id, produto_id) WHERE tipo='VENDA'`) + pagamento único. **Validar na implementação** que a camada de idempotência envolve o ramo PDV inteiro (pedido+ledger+pagamento), não só o pedido.
- **Sem notificação:** cliente está fisicamente presente → o PDV pula `notifyOrderStatusChange` e notificações de pagamento (gate `channel !== CanalVenda.PDV` no bloco pós-transação).
- **Anônimo + sem entrega:** "Cliente Balcão", `delivery_type` de retirada, sem endereço.

---

## 8. Testes (a artéria unificada)

Testes de integração contra Postgres real (mesmo padrão dos testes do motor; RLS via app HTTP+interceptor ou `set_config` conforme o harness do arquivo de pedidos).

1. **Happy path** (parametrizar método `dinheiro/pix/debito/credito`): pedido `ENTREGUE`, `current_stock` baixado, **exatamente 1** `VENDA(order_id, produto_id)` no ledger, `Pagamento` com `status=PAGO`, método e `amount=total` corretos, `reserved_stock` inalterado para reservas alheias.
2. **Respeita reserva alheia:** `current=5, reserved=3` → PDV qty=2 OK → `current=3, reserved=3`.
3. **Insuficiente (available < qty):** `current=5, reserved=4`, PDV qty=2 → **rejeitado**; asserção de que **NADA** foi persistido (sem pedido, sem ledger, sem pagamento) — prova de rollback.
4. **Concorrência:** PDV vs pedido online pelo último item → um sucede, um falha (lock pessimista + guarda atômica).
5. **Idempotência:** retry com a mesma `idempotencyKey` → mesmo pedido, baixa e pagamento únicos.
6. **DTO:** `payment` em canal não-PDV → rejeitado; `channel='pdv'` sem `payment.method` → rejeitado; método `boleto` no PDV → rejeitado; preço divergente (>0.01) no PDV → rejeitado.
7. **Blindagem:** `updateStatus(entregue → confirmado)` lança `BadRequestException`; `releaseExpiredPendingOrder(pdv_id)` é no-op (status não é `pendente_pagamento`); o pedido PDV não aparece na varredura de pendentes do sweeper.
8. **Invariante:** após a venda PDV, `current_stock == SUM(delta)` do ledger para o produto.

---

## 9. Fora de escopo (YAGNI)

- **Frontend de PDV** (conectar o `PdvPaymentModal` órfão a uma tela real) — esforço de UI separado (junto/depois do Admin de Operação, Spec B).
- **Valor recebido / troco** persistido (cálculo de tela; só relevante para conferência de caixa, enhancement futuro).
- **PIX de balcão integrado ao MercadoPago** (geração de QR + confirmação automática) — o fast-pass assume confirmação física pelo operador. Integração real de PIX no balcão é enhancement.
- **Conferência/fechamento de caixa** (relatório de vendas PDV do dia) — feature própria.

---

## 10. Decisões travadas nesta sessão

- Abordagem **A**: ramo `channel='pdv'` dentro de `orders.create` (não serviço separado, não auto-avanço de estados).
- PDV liquida **tudo junto, atômico**: pedido + baixa (`commitSale`) + `Pagamento` PAGO.
- PDV nasce em **`ENTREGUE`** (sem novo status; `channel='pdv'` já distingue nos relatórios).
- Pagamento PDV é **interno** (sem MercadoPago/`external_id`) — blindagem contra webhook por ausência de porta.
- `reserve` **seguido de** `commitSale` na mesma transação (respeita `available = current - reserved`).
- **Nenhum I/O externo** sob o lock; **sem notificação** (cliente presente).
- DTO: `payment.method` obrigatório só no PDV, proibido fora dele; cliente anônimo permitido.
