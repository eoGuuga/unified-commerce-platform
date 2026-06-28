# Spec A — Motor de Estoque & Ciclo de Vida

**Data:** 2026-06-28
**Status:** Em revisão arquitetural
**Escopo:** Backend (NestJS + TypeORM + Postgres). Nenhuma mudança de UI.
**Depende de:** nada. **Habilita:** Spec B (Admin de Operação) sobre um inventário confiável.

---

## 1. Problema

Os blocos de manipulação de estoque (`reserveStock`, `releaseStock`, `adjustStock`) existem, são **atômicos e corretos**, mas estão **desengatados de todo o fluxo de venda**. Hoje só são invocados pelos próprios endpoints HTTP (`products.controller`); nenhuma regra de negócio os chama.

Consequências verificadas no código (2026-06-28):

- O carrinho do WhatsApp **não reserva** estoque ao adicionar item (`cart.service.ts` — nenhuma chamada a `reserveStock`).
- A criação de pedido **não reserva** (`orders.service.ts` — nenhuma chamada).
- As transições de status (`assertStatusTransition`) **não dão baixa** no estoque.
- O cancelamento de pedido **não libera** reserva.
- A expiração do carrinho (`expireOldCarts`) apenas vira o status para `expired`; **não libera** nada.
- **Não existe agendador** no projeto (`@nestjs/schedule` ausente; só há um `setInterval` de métricas).

**Risco existencial:** não há "reserva fantasma travando estoque" — porque não há reserva nenhuma. O risco real é o oposto e pior: **overselling**. Em operação multicanal (PDV no balcão concorrendo em milissegundos com pedido do WhatsApp), dois canais vendem o último item porque ninguém reserva. Se o número na tela perde credibilidade, o software é abandonado na primeira semana.

**Objetivo deste spec:** plugar o ciclo de vida completo de estoque nos fluxos reais de venda, com um **ledger** como fonte da verdade, **garantias de atomicidade** contra concorrência, **idempotência** contra retries de webhook, e **TTL** que libera reservas abandonadas.

---

## 2. Princípios de arquitetura (inegociáveis)

1. **Ledger é a fonte da verdade.** Toda mudança física de estoque é uma linha imutável em `movimentacao_estoque_historico`. O `current_stock` é uma **projeção/cache** mantida na mesma transação que insere a linha (event sourcing leve). Invariante: `current_stock == soma(deltas do ledger)` para cada produto, desde o dia zero.
2. **`available = current_stock - reserved_stock`.** É o único número que pode ser vendido.
3. **Regra de ouro da atomicidade.** Nunca ler estoque, calcular na memória e gravar o valor final. A matemática é sempre delegada ao banco, na mesma transação, com guarda na cláusula `WHERE` e checagem de linhas afetadas:
   ```sql
   UPDATE movimentacao_estoque
   SET current_stock = current_stock + :delta,
       reserved_stock = GREATEST(0, reserved_stock - :reservaConsumida)
   WHERE tenant_id = :t AND produto_id = :p
     AND current_stock + :delta >= 0;
   -- affected < 1  =>  aborta a transação (guarda anti-inconsistência/oversell)
   ```
   Sem locks aplicativos. O `UPDATE ... WHERE` com guarda É o controle de concorrência.
4. **Idempotência por design.** Operações disparáveis por retry (webhooks, sweeper) carregam chave única e usam *compare-and-set* atômico. Reprocessar é sempre no-op.

---

## 3. Modelo de dados

### 3.1 Tabela existente (mantida, papel esclarecido)

`MovimentacaoEstoque` (tabela `movimentacao_estoque`) **é mal nomeada**: apesar do nome, ela guarda o **saldo atual** (uma linha por produto): `current_stock`, `reserved_stock`, `min_stock`. **Não vamos renomear** (risco desnecessário em migration de prod); apenas documentamos: esta é a tabela de **saldo/projeção**, não o histórico.

### 3.2 Nova tabela: `movimentacao_estoque_historico` (o ledger)

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid | isolamento multi-tenant (RLS) |
| `produto_id` | uuid FK | |
| `tipo` | enum | `INVENTARIO_INICIAL`, `VENDA`, `COMPRA`, `AJUSTE`, `PERDA`, `DEVOLUCAO` |
| `delta` | int | sinalizado (+entrada / –saída) |
| `saldo_resultante` | int | `current_stock` após aplicar o delta (auditoria/extrato) |
| `motivo` | text | livre, opcional (ex.: "quebra na geladeira") |
| `order_id` | uuid null | referência ao pedido, quando aplicável |
| `usuario_id` | uuid null | quem originou (null = sistema) |
| `created_at` | timestamptz | |

**Idempotência da baixa de venda:** índice único parcial
```sql
CREATE UNIQUE INDEX uq_ledger_venda_por_pedido
ON movimentacao_estoque_historico (order_id)
WHERE tipo = 'VENDA';
```
Garante **uma e só uma** baixa `VENDA` por pedido — blindagem definitiva contra retry fantasma de webhook de pagamento.

**O ledger registra apenas mudanças físicas de `current_stock`.** Reservas **não** entram no ledger (reserva mexe só em `reserved_stock`, e cancelamento de reserva "não tira da prateleira", logo não gera movimento — consistente com a decisão de negócio). O rastreio de reservas vive no contador `reserved_stock` + nos registros de carrinho/pedido.

### 3.3 Colunas novas para idempotência do TTL

- `whatsapp_carts.stock_released_at` (timestamptz null)
- `pedidos.stock_released_at` (timestamptz null)

Marcam que a reserva daquele registro já foi devolvida — base do *compare-and-set* do §6.

### 3.4 Migração de dados (backfill do invariante)

Para honrar "ledger soma a `current_stock` desde o dia zero": migration que, para cada linha de `movimentacao_estoque` com `current_stock > 0`, insere **uma** linha `INVENTARIO_INICIAL` no ledger com `delta = current_stock`, `saldo_resultante = current_stock`. Idempotente (não insere se já houver `INVENTARIO_INICIAL` para o produto).

---

## 4. O ciclo de vida do estoque (a costura)

Mapa de cada momento do fluxo de venda → ação no estoque. **Toda operação multi-passo roda dentro de uma transação** (`QueryRunner`).

| Momento | Origem | Ação |
|---|---|---|
| Adicionar item ao carrinho | `cart.service.addItem` | `reserveStock` atômico. Rejeita o add se `available < qty`. |
| Remover item / limpar carrinho | `cart.service.removeItem/clearCart` | `releaseStock` dos itens afetados. |
| Carrinho expira | sweeper + fast-path preguiçoso (§6) | libera a reserva de todos os itens. |
| Pedido criado (WhatsApp/online) | `orders.service.create` | garante a reserva (carrega a do carrinho; se não houver, reserva na criação atomicamente; rejeita se faltar saldo). |
| Pedido → **`PRONTO`** | `orders.service.updateStatus` | **COMMIT**: `current_stock -= qty` **e** `reserved_stock -= qty` (1 transação) + insere `VENDA` no ledger (idempotente). |
| Pedido cancelado (**pré-`PRONTO`**) | `orders.service.updateStatus` → `CANCELADO` | `releaseStock` (sem ledger). |
| Problema **pós-`PRONTO`** (motoboy volta, cliente some) | ajuste manual (Spec B) | nova linha no ledger: `DEVOLUCAO` (volta à prateleira) ou `PERDA` (prejuízo auditado). Nunca release automático. |
| Venda no **PDV** (balcão) | fluxo PDV | `reserve` + `commit` na **mesma transação**, sem fase pendente. |

### 4.1 Por que o commit é no `PRONTO`

`current_stock` deve espelhar a prateleira física. No `PRONTO` o item foi embalado, etiquetado e movido para a expedição — saiu do salão de vendas. Antes disso (`EM_PRODUCAO`, `CONFIRMADO`) ainda há caminho de cancelamento, então mantém-se reservado, não baixado. A própria máquina de estados reforça: `PRONTO` e `EM_TRANSITO` **não** transicionam para `CANCELADO`, logo não há release automático após o commit — coerente com tratar devolução/perda como movimento manual.

### 4.2 Operações do serviço (`StockEngineService`, novo)

- `reserve(tx, tenantId, produtoId, qty)` — guarda atômica; lança se insuficiente.
- `release(tx, tenantId, produtoId, qty)` — `GREATEST(0, reserved-qty)`.
- `commitSale(tx, tenantId, items, orderId)` — para cada item: `UPDATE` guardado (current e reserved) + insert `VENDA` (respeitando o índice único). Toda a venda numa transação; falha em qualquer item → rollback total.
- `recordManualMovement(tx, ..., tipo, delta, motivo, usuarioId)` — `COMPRA`/`AJUSTE`/`PERDA`/`DEVOLUCAO`; reusa a guarda atômica e grava ledger. (Consumido pela tela de Estoque do Spec B.)

Todas recebem o `QueryRunner` do chamador para compor transações maiores (ex.: criar pedido + reservar no mesmo commit).

---

## 5. Concorrência

Sem locks pessimistas. As garantias vêm das guardas atômicas no `WHERE`:

- **Dois canais, último item:** ambos disparam `reserve`. O primeiro `UPDATE` consome o saldo; o segundo tem `affected = 0` → exceção "estoque insuficiente". Um vende, o outro recebe negativa limpa. Sem overselling.
- **Commit:** o `UPDATE` guardado impede `current_stock` negativo; o índice único impede baixa dupla.
- **Isolamento:** transações curtas; cada `UPDATE ... WHERE` é atômico no nível de linha do Postgres.

---

## 6. TTL de reserva (carrinho/PIX abandonados)

Como `reserved_stock` é um contador agregado, não se expira "uma reserva" olhando o contador. **O carrinho e o pedido são o registro da reserva** (ambos têm `expires_at`). A liberação é dirigida pelo ciclo de vida deles, com três camadas de defesa em profundidade:

### 6.1 Varredor em background (`StockSweeperService`)

- Adicionar `@nestjs/schedule` (`ScheduleModule.forRoot()` no AppModule).
- **Cadência: a cada 60s** (`CronExpression.EVERY_MINUTE`), configurável via env `STOCK_SWEEPER_CRON`.
  - **Racional da cadência:** o TTL de carrinho é 30 min e o PIX expira em ~30–60 min. Um sweep a cada 60s deixa, no pior caso, ~1 min de reserva presa após o vencimento — desprezível diante da janela de TTL — enquanto custa ~1 query/min, carga irrisória. Frescura suficiente sem martelar o banco. (Para escala muito maior, mover para fila/worker dedicado; fora do escopo.)
- Para cada **carrinho** `active` com `expires_at < now()` e cada **pedido** em `PENDENTE_PAGAMENTO` além do **TTL de pagamento** (padrão **60 min**, configurável via env `ORDER_PAYMENT_TTL_MINUTES`; deve ser ≥ janela de expiração do PIX no MercadoPago): executa a rotina idempotente de expirar-e-liberar (§6.3).

### 6.2 Fast-path preguiçoso (mantido e corrigido)

`expireOldCarts` continua rodando quando o mesmo cliente volta a interagir — mas passa a usar a **mesma rotina** de expirar-e-liberar (hoje ela só vira o status; precisa também liberar). Dá frescura imediata na interação sem esperar o tick do cron.

### 6.3 Rotina idempotente de expirar-e-liberar (compare-and-set)

O coração da blindagem. Um único `UPDATE` atômico decide o "dono" da liberação:

```sql
UPDATE whatsapp_carts
SET status = 'expired', stock_released_at = now()
WHERE id = :cartId AND status = 'active' AND stock_released_at IS NULL
RETURNING items;
```
Só quem conseguir o flip (`affected = 1`) executa o `release` dos itens retornados. Qualquer execução concorrente vê `affected = 0` e faz no-op. **Libera exatamente uma vez**, não importa quantos atores corram.

### 6.4 PIX expirado: webhook × sweeper sem colisão

Tanto o webhook `payment.expired` quanto o sweeper podem tentar cancelar+liberar o mesmo pedido. **Fallback por compare-and-set no próprio pedido** — o banco é o árbitro:

```sql
UPDATE pedidos
SET status = 'cancelado', stock_released_at = now()
WHERE id = :orderId AND status = 'pendente_pagamento' AND stock_released_at IS NULL
RETURNING id;
```
Quem flipar primeiro (webhook **ou** sweeper, mesmo no mesmo milissegundo) ganha e faz o release; o outro recebe `affected = 0` e não faz nada. O webhook é o caminho rápido (libera segundos após o vencimento); o sweeper é a rede de segurança se o webhook nunca chegar. **Nunca dão baixa/release em dobro nem se chocam** — não há corrida porque o `UPDATE` condicional serializa a decisão na linha.

---

## 7. Pontos de integração (arquivos a tocar)

- `cart.service.ts` — `addItem`/`removeItem`/`clearCart`/expiração → reserve/release; usar rotina idempotente.
- `orders.service.ts` — `create` (reservar), `updateStatus` (commit no `PRONTO`, release no cancelamento pré-`PRONTO`).
- Fluxo **PDV** — reserve+commit atômico (localizar o serviço de venda do PDV; se inexistente, expor método `StockEngineService.sellImmediate`).
- `payments` / webhook MercadoPago — `payment.expired` → compare-and-set §6.4.
- `app.module.ts` — `ScheduleModule.forRoot()`.
- **Novos:** `StockEngineService`, `StockSweeperService`, entidade `MovimentacaoEstoqueHistorico`.

---

## 8. Migrations

1. Criar enum + tabela `movimentacao_estoque_historico` + índice único parcial `uq_ledger_venda_por_pedido`.
2. Adicionar `stock_released_at` a `whatsapp_carts` e `pedidos`.
3. Backfill `INVENTARIO_INICIAL` (§3.4), idempotente.

Todas reversíveis. Rodar com backup prévio (procedimento de deploy já documentado).

---

## 9. Testes (crítico — mexe em dinheiro)

- **Unitário por transição:** reserve, release, commit no `PRONTO`, cancelamento pré-`PRONTO`, PDV imediato, movimento manual.
- **Concorrência:** dois `reserve` simultâneos do último item → um sucede, um falha limpo (simular com transações paralelas).
- **Idempotência da venda:** chamar `commitSale` 2× para o mesmo `order_id` → uma única baixa (índice único).
- **Colisão webhook×sweeper:** disparar os dois caminhos sobre o mesmo pedido → um único release.
- **TTL:** carrinho/pedido vencidos → sweeper libera; rodar 2× → não libera de novo (`stock_released_at`).
- **Invariante:** após uma bateria de operações, `current_stock == soma(deltas do ledger)` por produto.

Meta: cobertura alta nos caminhos de concorrência e idempotência.

---

## 10. Fora de escopo (YAGNI)

Lotes, validade, múltiplos depósitos/locais, custo médio móvel, tabela dedicada de reservas por linha (`reserva_estoque`). Reserva fica como contador + registro de carrinho/pedido. Migrar para fila/worker dedicado de sweep só sob escala muito maior.

---

## 11. Decisões travadas nesta sessão

- Ledger = fonte da verdade; `current_stock` = projeção transacional.
- Commit da baixa no **`PRONTO`** (ponto de não-retorno físico).
- Pós-`PRONTO`: devolução/perda = movimento **manual** no ledger.
- PDV = reserve+commit atômico, sem fase pendente.
- Idempotência da venda por índice único `(order_id) WHERE tipo='VENDA'`.
- TTL por sweeper `@nestjs/schedule` a **60s** + fast-path preguiçoso + webhook.
- Colisão webhook×sweeper resolvida por **compare-and-set** na linha do pedido (sem corrida).
- `MovimentacaoEstoque` (saldo) **não** será renomeada; papéis documentados.
