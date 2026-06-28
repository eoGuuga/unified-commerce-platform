# Spec A — Motor de Estoque & Ciclo de Vida

**Data:** 2026-06-28
**Status:** Aprovado (diagnóstico corrigido 2026-06-28) — pronto para plano de implementação
**Escopo:** Backend (NestJS + TypeORM + Postgres). Nenhuma mudança de UI.
**Depende de:** nada. **Habilita:** Spec B (Admin de Operação) sobre um inventário confiável.

---

## 1. Problema

> **Correção de diagnóstico (2026-06-28).** Uma primeira leitura por *grep de call-site* (`.reserveStock(`/`.adjustStock(`) concluiu que o estoque estava "totalmente desengatado / risco de overselling". **Estava errado.** A lógica de estoque do checkout está **inline** dentro da transação de `orders.service.create`, não em chamadas a métodos — por isso o grep não a viu. A leitura direta do código (linhas 137-313) revelou o quadro real abaixo. Lição: grep de call-site não enxerga SQL inline.

**O que `orders.service.create` realmente faz (verificado):** abre transação (`db.runInTransaction`), pega **lock pessimista** (`setLock('pessimistic_write')` = `FOR UPDATE`) nas linhas de estoque, revalida preço/cupom contra o banco, e **abate `current_stock -= qty`** com guarda atômica `WHERE current_stock >= qty` + checagem de `affected`. Ou seja: **a baixa acontece na CRIAÇÃO do pedido (status `PENDENTE_PAGAMENTO`), e é à prova de overselling.** Esse caminho é robusto.

**O bug existencial real não é overselling — é vazamento silencioso de estoque:**

- A baixa ocorre na criação, mas **nada restaura o estoque**: `updateStatus → CANCELADO` não toca estoque, e não há `current_stock + qty` em lugar nenhum do módulo de pedidos (verificado). Como **todos** os canais começam em `PENDENTE_PAGAMENTO` e não há restauração na expiração/cancelamento, **todo PIX abandonado evapora estoque permanentemente.** O número na tela derrete sozinho.
- **Vetor de ataque:** um bot gerando carrinhos com PIX numa sexta à noite esvazia o estoque virtual da loja inteira sem gastar um centavo, e os itens nunca voltam à prateleira. É um DoS de inventário grátis — pior que overselling porque é silencioso.
- **Baixa no momento errado:** abater em `PENDENTE_PAGAMENTO` viola o princípio "`current_stock` = prateleira física" — o item segue na prateleira durante a produção, mas já foi descontado.
- **Sem ledger:** nenhuma movimentação tem rastro/extrato auditável.
- **Carrinho não reserva** (`cart.service` não chama `reserveStock`); a expiração de carrinho (`expireOldCarts`) só vira o status para `expired`.
- **Não existe agendador** (`@nestjs/schedule` está no `package.json` mas não é importado no `AppModule`; só há um `setInterval` de métricas).

**Objetivo deste spec:** corrigir o ciclo de vida do estoque migrando do modelo "baixa na criação que nunca volta" para **reserva→commit no `PRONTO`** (espelho da prateleira física), com **ledger** como fonte da verdade, **idempotência** contra retries de webhook, e **TTL** que libera reservas abandonadas — tudo mantendo o **lock pessimista** já adotado no checkout.

---

## 2. Princípios de arquitetura (inegociáveis)

1. **Ledger é a fonte da verdade.** Toda mudança física de estoque é uma linha imutável em `movimentacoes_estoque_historico`. O `current_stock` é uma **projeção/cache** mantida na mesma transação que insere a linha (event sourcing leve). Invariante: `current_stock == soma(deltas do ledger)` para cada produto, desde o dia zero.
2. **`available = current_stock - reserved_stock`.** É o único número que pode ser vendido.
3. **Regra de ouro da atomicidade.** Nunca ler estoque, calcular na memória e gravar o valor final. A matemática é sempre delegada ao banco, na mesma transação, com guarda na cláusula `WHERE` e checagem de linhas afetadas:
   ```sql
   UPDATE movimentacoes_estoque
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

`MovimentacaoEstoque` (tabela `movimentacoes_estoque`) **é mal nomeada**: apesar do nome, ela guarda o **saldo atual** (uma linha por produto): `current_stock`, `reserved_stock`, `min_stock`. **Não vamos renomear** (risco desnecessário em migration de prod); apenas documentamos: esta é a tabela de **saldo/projeção**, não o histórico.

### 3.2 Nova tabela: `movimentacoes_estoque_historico` (o ledger)

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
CREATE UNIQUE INDEX uq_ledger_venda_por_item
ON movimentacoes_estoque_historico (order_id, produto_id)
WHERE tipo = 'VENDA';
```
Garante **uma e só uma** baixa `VENDA` por (pedido, produto) — permite múltiplos itens no pedido, mas bloqueia baixa dupla do mesmo item. Blindagem definitiva contra retry fantasma de webhook de pagamento.

**O ledger registra apenas mudanças físicas de `current_stock`.** Reservas **não** entram no ledger (reserva mexe só em `reserved_stock`, e cancelamento de reserva "não tira da prateleira", logo não gera movimento — consistente com a decisão de negócio). O rastreio de reservas vive no contador `reserved_stock` + nos registros de carrinho/pedido.

### 3.3 Colunas novas para idempotência do TTL

- `whatsapp_carts.stock_released_at` (timestamptz null)
- `pedidos.stock_released_at` (timestamptz null)

Marcam que a reserva daquele registro já foi devolvida — base do *compare-and-set* do §6.

### 3.4 Migração de dados (backfill do invariante)

Para honrar "ledger soma a `current_stock` desde o dia zero": migration que, para cada linha de `movimentacoes_estoque` com `current_stock > 0`, insere **uma** linha `INVENTARIO_INICIAL` no ledger com `delta = current_stock`, `saldo_resultante = current_stock`. Idempotente (não insere se já houver `INVENTARIO_INICIAL` para o produto).

**Concorrência no backfill (salvaguarda).** Se a migration rodar com o sistema ativo, um produto pode ter o `current_stock` alterado entre a leitura e a inserção. **Não** ler em JS e inserir depois. Usar **uma única `INSERT INTO ... SELECT ...`** atômica, para que o `current_stock` lido seja exatamente o `delta`/`saldo_resultante` gravado no mesmo comando:
```sql
INSERT INTO movimentacoes_estoque_historico
  (id, tenant_id, produto_id, tipo, delta, saldo_resultante, created_at)
SELECT gen_random_uuid(), me.tenant_id, me.produto_id,
       'INVENTARIO_INICIAL', me.current_stock, me.current_stock, now()
FROM movimentacoes_estoque me
WHERE me.current_stock > 0
  AND NOT EXISTS (
    SELECT 1 FROM movimentacoes_estoque_historico h
    WHERE h.produto_id = me.produto_id AND h.tipo = 'INVENTARIO_INICIAL'
  );
```
Idealmente rodar na janela de deploy (tráfego chaveado), mas o `INSERT ... SELECT` mantém o invariante mesmo sob escrita concorrente.

---

## 4. O ciclo de vida do estoque (a costura)

Mapa de cada momento do fluxo de venda → ação no estoque. **Toda operação multi-passo roda dentro de uma transação** (`db.runInTransaction`).

> **Esta é uma REFATORAÇÃO, não um greenfield.** Hoje `orders.service.create` **abate `current_stock` na criação** (§1). O alvo migra essa baixa da criação para a transição `PRONTO`, transformando a operação de criação em **reserva**. É a mudança mais sensível do spec — mexe na artéria principal (checkout) — e por isso exige regressão forte (§9).

| Momento | Origem | Ação | Mudança |
|---|---|---|---|
| Adicionar item ao carrinho | `cart.service.addItem` | `reserve` atômico; rejeita se `available < qty`. | **novo** |
| Remover item / limpar carrinho | `cart.service.removeItem/clearCart` | `release` dos itens afetados. | **novo** |
| Carrinho expira | sweeper + fast-path preguiçoso (§6) | libera a reserva de todos os itens. | **novo** |
| Pedido criado (WhatsApp/online) | `orders.service.create` | **REFATOR:** trocar `current_stock -= qty` por `reserved_stock += qty` (guarda `current - reserved >= qty`). `current_stock` fica intacto. Mantém o lock pessimista. | **refator** |
| Pedido → **`PRONTO`** | `orders.service.updateStatus` | **COMMIT:** `current_stock -= qty` **e** `reserved_stock -= qty` (1 transação) + insere `VENDA` no ledger (idempotente). | **novo** |
| Pedido cancelado (**pré-`PRONTO`**) | `orders.service.updateStatus` → `CANCELADO` | `release` (`reserved_stock -= qty`, sem ledger). **Tapa o vazamento.** | **novo** |
| Problema **pós-`PRONTO`** | ajuste manual (Spec B) | nova linha no ledger: `DEVOLUCAO` (volta à prateleira) ou `PERDA`. Nunca release automático. | **novo** |
| Venda no **PDV** (balcão) | fluxo PDV (provavelmente `create` com `channel='pdv'`) | `reserve` + `commit` na **mesma transação**, sem fase pendente. Verificar na implementação se o PDV usa `create`. | **novo** |

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

**Mantém o lock pessimista já adotado no checkout** (`setLock('pessimistic_write')` = `FOR UPDATE`) **somado** às guardas atômicas no `WHERE` — cinto e suspensório. O projeto já escolheu esse padrão; não o removemos.

- **Dois canais, último item:** o lock serializa o acesso à linha de estoque durante a validação; a guarda atômica garante que o `UPDATE` de reserva só sucede se `current - reserved >= qty`. O segundo recebe negativa limpa. Sem overselling.
- **Commit:** o `UPDATE` guardado impede `current_stock` negativo; o índice único `(order_id, produto_id) WHERE tipo='VENDA'` impede baixa dupla.
- **Isolamento:** cada `UPDATE ... WHERE` é atômico no nível de linha do Postgres.

> **Diretriz crítica de implementação:** o lock pessimista só é eficiente se a transação for **ultrarrápida**. **Nenhuma chamada externa** (API de pagamento/MercadoPago, cálculo de frete via HTTP, envio de WhatsApp, etc.) pode rodar **dentro** da transação que segura o lock de estoque. Validação de preço/cupom contra o banco é permitida (é local). Qualquer I/O externo acontece **antes** (entrada da transação) ou **depois** (commitada a transação). Isso vale tanto para o `create` refatorado quanto para o commit no `PRONTO`.

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

1. Criar enum + tabela `movimentacoes_estoque_historico` + índice único parcial `uq_ledger_venda_por_pedido`.
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
- **Vazamento (regressão do bug original):** criar pedido → cancelar/expirar → `current_stock` volta ao valor inicial (não vaza). Era o bug existencial; tem que ter teste dedicado.
- **Regressão forte no `create` (artéria principal):** o `create` é o caminho mais crítico do sistema. Bateria que cobre o comportamento atual preservado **exceto** a baixa→reserva: preço recalculado do banco, rejeição de preço divergente (>0.01), validação de cupom/limite, lock pessimista ativo, rejeição por estoque insuficiente, criação de itens, geração de `order_no`, audit log. Rodar a suíte de integração existente de pedidos (`orders.integration.spec.ts`) e garantir que passa com a nova semântica (estado pós-`create`: `reserved_stock += qty`, `current_stock` intacto).
- **Sem I/O externo sob lock:** teste/asserção de que a transação de `create` e a de commit não fazem chamada de rede (revisar que notificação WhatsApp e chamada de pagamento ficam fora da transação).

Meta: cobertura alta nos caminhos de concorrência, idempotência e na regressão do `create`.

---

## 10. Fora de escopo (YAGNI)

Lotes, validade, múltiplos depósitos/locais, custo médio móvel, tabela dedicada de reservas por linha (`reserva_estoque`). Reserva fica como contador + registro de carrinho/pedido. Migrar para fila/worker dedicado de sweep só sob escala muito maior.

---

## 11. Decisões travadas nesta sessão

- **Diagnóstico corrigido:** a baixa já ocorre na criação (oversell-safe); o bug existencial é **vazamento de estoque** em pedido não-pago/cancelado (nunca restaura). Vetor de ataque: DoS de inventário via PIX abandonado.
- **Refatorar** `create`: baixa na criação → **reserva** na criação; baixa real migra para o `PRONTO`.
- **Manter o lock pessimista** existente (`pessimistic_write`) + guardas atômicas.
- **Nenhuma chamada externa dentro da transação travada** (transação ultrarrápida).
- Ledger = fonte da verdade; `current_stock` = projeção transacional.
- Commit da baixa no **`PRONTO`** (ponto de não-retorno físico).
- Pós-`PRONTO`: devolução/perda = movimento **manual** no ledger.
- PDV = reserve+commit atômico, sem fase pendente.
- Idempotência da venda por índice único `(order_id, produto_id) WHERE tipo='VENDA'`.
- TTL por sweeper `@nestjs/schedule` a **60s** + fast-path preguiçoso + webhook.
- Colisão webhook×sweeper resolvida por **compare-and-set** na linha do pedido (sem corrida).
- `MovimentacaoEstoque` (saldo) **não** será renomeada; papéis documentados.
- Regressão forte obrigatória no `create` (artéria principal) — §9.

---

## 12. Salvaguardas de implementação (armadilhas conhecidas)

Anotadas para nascerem blindadas no plano e na codificação.

### 12.1 Estado de entidade no TypeORM (Entity State Mismatch)

A regra de ouro usa `UPDATE ... SET current_stock = current_stock + :delta` via QueryBuilder/SQL bruto. **Perigo:** instâncias de entidade já carregadas em memória naquela mesma requisição (ex.: um `Produto`/saldo lido no início do caso de uso) **não** refletem a mutação — o atributo em memória fica defasado.

**Diretriz:** após `commitSale`/`reserve`/`release`/qualquer mutação por expressão matemática, se o fluxo precisar **ler ou retornar** o saldo, ou (a) confiar **estritamente** no valor da cláusula `RETURNING` do próprio `UPDATE`, ou (b) **recarregar** do banco (`manager.findOneBy`). **Nunca** usar o estado em memória pré-`UPDATE`. Preferir `RETURNING` (uma ida ao banco a menos) e expor esse valor como retorno do método do `StockEngineService`.

### 12.2 Concorrência no backfill da migration

Detalhado em §3.4: usar `INSERT INTO ... SELECT ...` atômico (nunca ler-em-JS-e-inserir), garantindo que `current_stock` lido == `saldo_resultante` gravado no mesmo comando, mesmo sob escrita concorrente. Idealmente na janela de deploy com tráfego chaveado.
