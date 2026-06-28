# PDV Fast-Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando `channel='pdv'`, `orders.create` liquida a venda de balcão atomicamente — reserva, comita a baixa no ledger, registra um Pagamento já PAGO e nasce em `ENTREGUE` — numa única transação com rollback automático.

**Architecture:** Ramo `channel='pdv'` dentro da transação existente de `orders.service.create` (reusa lock pessimista + revalidação de preço + cupom + criação de itens). Reusa `StockEngineService.commitSale` do motor de estoque já mergeado. Pagamento PDV é interno (sem MercadoPago/external_id), o que blinda contra webhooks por ausência de gancho.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL 15, Jest. Spec: `docs/superpowers/specs/2026-06-28-pdv-fast-pass-design.md`.

## Global Constraints

- `channel='pdv'` → `payment.method` **obrigatório**, ∈ `{dinheiro, pix, debito, credito}` (NÃO `boleto`). `payment` presente em canal **não-PDV** → `BadRequestException`.
- PDV nasce em `PedidoStatus.ENTREGUE` (status setado direto no create, não via `updateStatus`/máquina de estados).
- Sequência atômica no PDV: `reserve` (passo já existente) → salvar Pedido → salvar Itens → `commitSale(manager, tenantId, pedido.id, items)` → inserir `Pagamento` PAGO. Tudo no mesmo `db.runInTransaction`. Qualquer erro → rollback total.
- Pagamento PDV: `{ tenant_id, pedido_id, method, status: PagamentoStatus.PAID, amount: total, metadata: { pdv: true, confirmed_at_counter: true } }`. **Sem** `transaction_id`/`stripe_payment_id`. **Nenhuma** chamada externa (MercadoPago/provider) dentro da transação.
- `amount` do pagamento = `total` recalculado no servidor (NÃO vem do cliente).
- PDV pula notificação (cliente presente): gate `channel !== CanalVenda.PDV` no bloco pós-transação.
- Cliente anônimo permitido (sem `customer_name` → default "Cliente Balcão"); sem entrega.
- Reusa `StockEngineService` (não duplica o andaime de criação de pedido).
- Código/comentários em **português**; commits em **inglês** (Conventional Commits) + trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Banco de teste: `ucm_test_motor` via `backend/.env` (túnel `localhost:5544`); rodar 1 teste `npm test -- <arquivo>.spec.ts` a partir de `backend/`. Os testes de `orders.integration.spec.ts` rodam o app HTTP completo (interceptor seta RLS) — seed de produto/estoque via SQL bruto (Redis indisponível; NÃO usar HTTP de criação de produto). Há 2 falhas Redis PRE-EXISTENTES em orders.integration (alheias).

---

## Mapa de arquivos

**Modificar:**
- `backend/src/modules/orders/dto/create-order.dto.ts` — adicionar `PdvPaymentDto` + campo `payment?`.
- `backend/src/modules/orders/orders.service.ts` — validação cruzada no `create` (payment required/forbidden/no-boleto), status inicial por canal, ramo PDV (commitSale + Pagamento), gate de notificação.
- `backend/src/modules/orders/orders.integration.spec.ts` — testes de integração do fast-pass.

**Sem novos arquivos** (o Pagamento usa `manager.getRepository(Pagamento)`; `StockEngineService` já injetado no OrdersService pelo motor).

---

## Task 1: DTO + validação cruzada do pagamento PDV

**Files:**
- Modify: `backend/src/modules/orders/dto/create-order.dto.ts`
- Modify: `backend/src/modules/orders/orders.service.ts` (guardas no início de `create`, antes da transação)
- Test: `backend/src/modules/orders/orders.service.spec.ts` (testes unitários das guardas)

**Interfaces:**
- Produces: `CreateOrderDto.payment?: PdvPaymentDto` onde `PdvPaymentDto = { method: MetodoPagamento }`. Guardas no `create` que lançam `BadRequestException` para: payment ausente no PDV, payment presente fora do PDV, method `boleto` no PDV.

- [ ] **Step 1: Adicionar o DTO de pagamento e o campo opcional**

Em `create-order.dto.ts`, importar `MetodoPagamento` e adicionar a classe + campo:

```typescript
// adicionar aos imports do topo:
import { MetodoPagamento } from '../../../database/entities/Pagamento.entity';

// adicionar antes de CreateOrderDto:
export class PdvPaymentDto {
  @ApiProperty({ description: 'Metodo de pagamento fisico no balcao', enum: MetodoPagamento })
  @IsEnum(MetodoPagamento)
  method: MetodoPagamento;
}

// adicionar como campo de CreateOrderDto (apos shipping_amount):
  @ApiProperty({
    description: 'Pagamento sincrono (apenas canal PDV/balcao)',
    required: false,
    type: PdvPaymentDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PdvPaymentDto)
  payment?: PdvPaymentDto;
```

- [ ] **Step 2: Escrever os testes unitários das guardas (falham)**

Em `orders.service.spec.ts`, adicionar um `describe('create - validacao PDV')`. O service já tem `mockStockEngineService.reserve` etc. (do motor). Estes testes verificam que as guardas lançam ANTES de abrir transação. Use o padrão de mocks já existente no arquivo (mockManager, etc.). Exemplo dos casos (adapte aos mocks/helpers do arquivo):

```typescript
it('rejeita pedido PDV sem payment.method', async () => {
  await expect(
    service.create({ ...baseDto, channel: CanalVenda.PDV, payment: undefined } as any, tenantId),
  ).rejects.toBeInstanceOf(BadRequestException);
});

it('rejeita payment em canal nao-PDV', async () => {
  await expect(
    service.create({ ...baseDto, channel: CanalVenda.ECOMMERCE, payment: { method: MetodoPagamento.DINHEIRO } } as any, tenantId),
  ).rejects.toBeInstanceOf(BadRequestException);
});

it('rejeita method boleto no PDV', async () => {
  await expect(
    service.create({ ...baseDto, channel: CanalVenda.PDV, payment: { method: MetodoPagamento.BOLETO } } as any, tenantId),
  ).rejects.toBeInstanceOf(BadRequestException);
});
```

(`baseDto` = um DTO válido mínimo com `items` — reusar o `createOrderDto` já definido no describe de `create`. Importar `CanalVenda` e `MetodoPagamento`.)

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- orders.service.spec.ts -t "validacao PDV"`
Expected: FAIL — as guardas ainda não existem (os pedidos passam ou falham por outro motivo).

- [ ] **Step 4: Implementar as guardas no início de `create`**

Em `orders.service.ts`, no método `create`, **antes** do `db.runInTransaction` (junto às validações iniciais, ex.: perto da checagem de `discount_amount`), adicionar:

```typescript
    // Validacao do pagamento sincrono de balcao (PDV).
    const PDV_METODOS_VALIDOS = [
      MetodoPagamento.DINHEIRO,
      MetodoPagamento.PIX,
      MetodoPagamento.DEBITO,
      MetodoPagamento.CREDITO,
    ];
    if (createOrderDto.channel === CanalVenda.PDV) {
      if (!createOrderDto.payment?.method) {
        throw new BadRequestException('Venda PDV exige payment.method.');
      }
      if (!PDV_METODOS_VALIDOS.includes(createOrderDto.payment.method)) {
        throw new BadRequestException(
          `Metodo de pagamento invalido para PDV: ${createOrderDto.payment.method}.`,
        );
      }
    } else if (createOrderDto.payment) {
      throw new BadRequestException('payment so e permitido no canal PDV.');
    }
```

Garantir imports no topo de `orders.service.ts`: `MetodoPagamento` (de `../../database/entities/Pagamento.entity`) e `CanalVenda` (já importado de `Pedido.entity`).

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- orders.service.spec.ts`
Expected: PASS — os 3 novos testes + todos os pré-existentes do arquivo.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/orders/dto/create-order.dto.ts backend/src/modules/orders/orders.service.ts backend/src/modules/orders/orders.service.spec.ts
git commit -m "feat(pdv): add synchronous payment DTO and PDV channel validation guards"
```

---

## Task 2: Ramo PDV no `create` (ENTREGUE + commitSale + Pagamento) + testes core

**Files:**
- Modify: `backend/src/modules/orders/orders.service.ts` (status inicial por canal; ramo PDV após salvar itens; gate de notificação)
- Test: `backend/src/modules/orders/orders.integration.spec.ts`

**Interfaces:**
- Consumes: `StockEngineService.commitSale(manager, tenantId, orderId, items: Array<{produto_id, quantity}>)` (já existe, injetado como `this.stockEngine`); `Pagamento` entity + `PagamentoStatus.PAID`; guardas da Task 1.
- Produces: pedido PDV persistido com `status=ENTREGUE`, baixa no ledger (`VENDA`), e um `Pagamento` PAGO — atômico.

- [ ] **Step 1: Escrever o teste de integração core (falha)**

Em `orders.integration.spec.ts`, adicionar (seguindo o padrão dos testes de pedido do motor — seed de produto/estoque via SQL bruto, POST HTTP autenticado, asserção no banco):

```typescript
it('PDV: cria venda ENTREGUE, baixa estoque, grava Pagamento PAGO (atomico)', async () => {
  if (!app) return;
  // seed: produto current_stock=10, reserved_stock=0 (helper SQL existente do arquivo)
  const produtoId = await seedProdutoComEstoque(10, 0); // usar o helper do arquivo
  const res = await request(app.getHttpServer())
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${jwtToken}`)
    .send({
      channel: 'pdv',
      payment: { method: 'dinheiro' },
      items: [{ produto_id: produtoId, quantity: 3, unit_price: 10.0 }],
    });
  expect(res.status).toBe(201);
  expect(res.body.status).toBe('entregue');

  // saldo: current baixou para 7, reserved volta a 0
  const saldo = await queryEstoque(produtoId); // helper SQL do arquivo
  expect(saldo.current_stock).toBe(7);
  expect(saldo.reserved_stock).toBe(0);

  // ledger: exatamente 1 VENDA para (order, produto)
  const ledger = await dataSource.query(
    `SELECT tipo, delta FROM movimentacoes_estoque_historico WHERE order_id = $1 AND produto_id = $2`,
    [res.body.id, produtoId],
  );
  expect(ledger).toHaveLength(1);
  expect(ledger[0].tipo).toBe('VENDA');

  // pagamento PAGO
  const pag = await dataSource.query(
    `SELECT method, status, amount FROM pagamentos WHERE pedido_id = $1`,
    [res.body.id],
  );
  expect(pag).toHaveLength(1);
  expect(pag[0].status).toBe('paid');
  expect(pag[0].method).toBe('dinheiro');
  expect(Number(pag[0].amount)).toBe(30);
});

it('PDV: respeita reserva alheia (available = current - reserved)', async () => {
  if (!app) return;
  const produtoId = await seedProdutoComEstoque(5, 3); // 3 reservados por carrinho online
  const res = await request(app.getHttpServer())
    .post('/api/v1/orders').set('Authorization', `Bearer ${jwtToken}`)
    .send({ channel: 'pdv', payment: { method: 'debito' }, items: [{ produto_id: produtoId, quantity: 2, unit_price: 10.0 }] });
  expect(res.status).toBe(201);
  const saldo = await queryEstoque(produtoId);
  expect(saldo.current_stock).toBe(3);   // baixou 2
  expect(saldo.reserved_stock).toBe(3);  // reservas online intactas
});

it('PDV: estoque insuficiente faz rollback TOTAL (nada persiste)', async () => {
  if (!app) return;
  const produtoId = await seedProdutoComEstoque(5, 4); // available = 1
  const res = await request(app.getHttpServer())
    .post('/api/v1/orders').set('Authorization', `Bearer ${jwtToken}`)
    .send({ channel: 'pdv', payment: { method: 'credito' }, items: [{ produto_id: produtoId, quantity: 2, unit_price: 10.0 }] });
  expect(res.status).toBeGreaterThanOrEqual(400);
  // nada persistido: sem pedido, sem ledger VENDA, sem pagamento
  const saldo = await queryEstoque(produtoId);
  expect(saldo.current_stock).toBe(5);
  expect(saldo.reserved_stock).toBe(4);
  const ledger = await dataSource.query(`SELECT 1 FROM movimentacoes_estoque_historico WHERE produto_id = $1 AND tipo = 'VENDA'`, [produtoId]);
  expect(ledger).toHaveLength(0);
});
```

> Use os helpers REAIS do arquivo `orders.integration.spec.ts` para seed/query (procure como os testes do motor seedaram `produtos` + `movimentacoes_estoque` e leram saldo). Se não houver helper, inline o INSERT via `dataSource.query` com `set_config` de tenant, como nos specs do motor. NÃO invente endpoints.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- orders.integration.spec.ts -t "PDV:"`
Expected: FAIL — hoje o PDV nasce `pendente_pagamento`, sem baixa nem pagamento.

- [ ] **Step 3: Status inicial por canal**

Em `orders.service.ts`, dentro da transação do `create`, trocar a definição do status inicial (hoje `const initialStatus: PedidoStatus = PedidoStatus.PENDENTE_PAGAMENTO;`) por:

```typescript
      const isPdv = createOrderDto.channel === CanalVenda.PDV;
      // PDV nasce ENTREGUE (pago e levado no balcao); demais canais, pendente de pagamento.
      const initialStatus: PedidoStatus = isPdv
        ? PedidoStatus.ENTREGUE
        : PedidoStatus.PENDENTE_PAGAMENTO;
```

- [ ] **Step 4: Ramo PDV — commitSale + Pagamento (após salvar os itens)**

Em `orders.service.ts`, logo após `await manager.save(itens);` (e antes/junto do consumo de cupom, ainda dentro da transação), adicionar:

```typescript
      // Fast-pass PDV: baixa imediata + pagamento sincrono, tudo atomico.
      if (isPdv) {
        const stockItems = createOrderDto.items.map((i) => ({
          produto_id: i.produto_id,
          quantity: i.quantity,
        }));
        // Baixa real (current -= qty, reserved -= qty) + VENDA no ledger.
        await this.stockEngine.commitSale(manager, tenantId, savedPedido.id, stockItems);

        // Pagamento interno, ja PAGO (liquidacao fisica ocorreu no balcao).
        const pagamento = manager.create(Pagamento, {
          tenant_id: tenantId,
          pedido_id: savedPedido.id,
          method: createOrderDto.payment!.method,
          status: PagamentoStatus.PAID,
          amount: total,
          metadata: { pdv: true, confirmed_at_counter: true },
        });
        await manager.save(pagamento);
      }
```

Garantir imports no topo: `Pagamento`, `PagamentoStatus` (de `../../database/entities/Pagamento.entity`).

- [ ] **Step 5: Gate de notificação para pular PDV**

No bloco PÓS-transação que chama a notificação (ex.: o trecho que notifica `PENDENTE_PAGAMENTO`/status), envolver com guarda de canal para que o PDV não notifique:

```typescript
      if (createOrderDto.channel !== CanalVenda.PDV) {
        // ... chamada de notificacao existente ...
      }
```

(Localize o bloco de notificação pós-transação no `create` e aplique o gate. Se a notificação já estiver dentro de um try/catch que tolera falha, apenas adicione a condição de canal.)

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- orders.integration.spec.ts`
Expected: PASS nos 3 novos testes PDV. As 2 falhas Redis pré-existentes permanecem (não suas). Nenhum teste antes verde pode quebrar.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/orders/orders.service.ts backend/src/modules/orders/orders.integration.spec.ts
git commit -m "feat(pdv): atomic counter sale in orders.create (born ENTREGUE, commit baixa, paid payment)"
```

---

## Task 3: Garantias (blindagem, idempotência, concorrência) + regressão

**Files:**
- Test: `backend/src/modules/orders/orders.integration.spec.ts`

**Interfaces:**
- Consumes: o ramo PDV da Task 2; `OrdersService.updateStatus`, `OrdersService.releaseExpiredPendingOrder` (do motor).

- [ ] **Step 1: Escrever os testes de garantia (falham/ou já passam por design)**

Adicionar a `orders.integration.spec.ts`:

```typescript
it('PDV: ENTREGUE e terminal — updateStatus rejeita transicao', async () => {
  if (!app) return;
  const produtoId = await seedProdutoComEstoque(10, 0);
  const res = await request(app.getHttpServer())
    .post('/api/v1/orders').set('Authorization', `Bearer ${jwtToken}`)
    .send({ channel: 'pdv', payment: { method: 'pix' }, items: [{ produto_id: produtoId, quantity: 1, unit_price: 10.0 }] });
  expect(res.body.status).toBe('entregue');
  // qualquer transicao a partir de ENTREGUE deve falhar (maquina de estados)
  await expect(
    ordersService.updateStatus(res.body.id, 'confirmado' as any, tenantId),
  ).rejects.toBeInstanceOf(BadRequestException);
});

it('PDV: releaseExpiredPendingOrder e no-op num pedido ENTREGUE', async () => {
  if (!app) return;
  const produtoId = await seedProdutoComEstoque(10, 0);
  const res = await request(app.getHttpServer())
    .post('/api/v1/orders').set('Authorization', `Bearer ${jwtToken}`)
    .send({ channel: 'pdv', payment: { method: 'dinheiro' }, items: [{ produto_id: produtoId, quantity: 4, unit_price: 10.0 }] });
  const antes = await queryEstoque(produtoId); // current=6
  await ordersService.releaseExpiredPendingOrder(res.body.id); // status nao e pendente -> no-op
  const depois = await queryEstoque(produtoId);
  expect(depois.current_stock).toBe(antes.current_stock); // inalterado
  expect(depois.reserved_stock).toBe(antes.reserved_stock);
});

it('PDV: invariante current_stock == soma(deltas) apos a venda', async () => {
  if (!app) return;
  const produtoId = await seedProdutoComEstoque(0, 0); // sem saldo nao-ledgerado
  // entrada via ledger seria por COMPRA; aqui validamos so que a VENDA bate.
  // alternativa: seed via INVENTARIO_INICIAL no ledger + current; ou checar igualdade direta:
  // (se seed inicial=0, a venda exigiria estoque; ajuste o seed para current=10 + INVENTARIO_INICIAL=10 no ledger)
  const pid = await seedProdutoComLedgerInicial(10); // current=10 + ledger INVENTARIO_INICIAL=+10
  await request(app.getHttpServer())
    .post('/api/v1/orders').set('Authorization', `Bearer ${jwtToken}`)
    .send({ channel: 'pdv', payment: { method: 'credito' }, items: [{ produto_id: pid, quantity: 4, unit_price: 10.0 }] });
  const ok = await dataSource.query(
    `SELECT (SELECT current_stock FROM movimentacoes_estoque WHERE produto_id=$1)
          = (SELECT COALESCE(SUM(delta),0) FROM movimentacoes_estoque_historico WHERE produto_id=$1) AS ok`,
    [pid],
  );
  expect(ok[0].ok).toBe(true);
});
```

> Para o teste de invariante, seede o produto com `current_stock=10` E uma linha de ledger `INVENTARIO_INICIAL` de `+10` (use um helper ou INSERT direto), para que a soma do ledger reflita o saldo inicial; a venda PDV adiciona `VENDA -4`, e a igualdade `6 == 10-4` valida. Se preferir, o teste do motor (`stock-engine.service.integration.spec.ts`) já prova o invariante isoladamente — este caso só confirma que o PDV não o quebra.

- [ ] **Step 2: Rodar**

Run: `npm test -- orders.integration.spec.ts -t "PDV:"`
Expected: PASS (estes verificam garantias já implementadas pelo design da Task 2 + máquina de estados existente).

- [ ] **Step 3: Regressão — garantir que nada quebrou**

Run: `npm test -- --runInBand orders.integration stock-engine.service.integration cart.service.integration stock-sweeper.service.integration`
Expected: motor 24/24 + os testes PDV passam; as 2 falhas Redis pré-existentes em orders.integration permanecem (e SÓ elas). Build: `npm run build` limpo.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/orders/orders.integration.spec.ts
git commit -m "test(pdv): assert ENTREGUE terminality, release no-op, ledger invariant + regression"
```

---

## Self-review (cobertura do spec)

- §3 DTO + validação (required/forbidden/no-boleto) → Task 1. ✔
- §4 fluxo atômico (reserve→save→commitSale→Pagamento) → Task 2 (steps 3-4). ✔
- §5 blindagem (ENTREGUE terminal, release no-op, sweeper inerente) → Task 2 (status) + Task 3 (testes). ✔
- §6 pagamento sem I/O externo (insert direto PAID) → Task 2 step 4. ✔
- §7 rollback (insuficiente→nada persiste) → Task 2 step 1 (3º teste); notificação pulada → Task 2 step 5; idempotência → coberta pelo `idempotencyKey` existente do create (validar no review que envolve o ramo PDV; teste de idempotência opcional se o harness expuser a chave). ✔
- §8 testes (happy/reserva/insuficiente/blindagem/invariante) → Tasks 2-3. Concorrência PDV×online: a guarda atômica + lock pessimista já são exercidos pelos testes de concorrência do motor; um teste PDV×online determinístico pode ser adicionado se o harness permitir (senão, documentado como coberto pelo lock compartilhado). ✔
- §9 YAGNI (frontend, troco, PIX-MP, caixa) → fora do plano. ✔
