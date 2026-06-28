# Motor de Estoque & Ciclo de Vida — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o ciclo de vida do estoque — migrar da "baixa na criação que nunca volta" (vazamento silencioso) para **reserva→commit no `PRONTO`** com ledger auditável, TTL de reservas abandonadas e idempotência contra retries de webhook.

**Architecture:** Um `StockEngineService` centraliza as primitivas atômicas (reserve/release/commitSale/recordManualMovement) operando sobre a tabela de saldo `movimentacoes_estoque` e gravando um ledger imutável `movimentacoes_estoque_historico`. O `orders.service.create` é refatorado para **reservar** em vez de baixar; a baixa real migra para a transição `→ PRONTO`; o cancelamento libera a reserva. Um `StockSweeperService` (`@nestjs/schedule`) libera reservas de carrinhos/pedidos expirados. Mantém-se o **lock pessimista** já adotado no checkout.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL 15, Jest. Spec: `docs/superpowers/specs/2026-06-28-motor-de-estoque-design.md`.

## Global Constraints

- Código e comentários em **português**; mensagens de commit em **inglês** (Conventional Commits); trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Nenhuma chamada externa** (pagamento, frete HTTP, WhatsApp) dentro de transação que segura lock de estoque. I/O externo fica **antes** ou **depois** da transação.
- **Manter** o lock pessimista existente (`setLock('pessimistic_write')`) no `create`; somar guardas atômicas, não substituir.
- Toda mutação de estoque é via `UPDATE ... SET col = col ± :delta ... WHERE <guarda>` com checagem de `affected`. **Nunca** ler-em-JS-e-gravar.
- Após `UPDATE` por expressão, ler saldo só via `RETURNING` ou `manager.findOneBy` — nunca do estado em memória pré-update (Entity State Mismatch).
- Tabela de saldo existente: `movimentacoes_estoque` (colunas `current_stock`, `reserved_stock`, `min_stock`). **Não renomear.**
- Multi-tenant com RLS: operações em transação de teste precisam de `SELECT set_config('app.current_tenant_id', $1, false)`.
- `available = current_stock - reserved_stock`. Invariante: `current_stock == soma(deltas do ledger)` por produto.
- Commit da baixa **somente** na transição genuína para `PRONTO`. Idempotência por índice único `(order_id, produto_id) WHERE tipo='VENDA'`.
- Rodar um teste único: `npm test -- <arquivo>.spec.ts` (a partir de `backend/`). Migrations: `npm run migration:run` / `npm run migration:revert`.

---

## Mapa de arquivos

**Criar:**
- `backend/src/database/entities/MovimentacaoEstoqueHistorico.entity.ts` — entidade do ledger.
- `backend/src/database/migrations/1751300000000-AddStockLedgerAndReleaseTracking.ts` — tabela ledger + colunas `stock_released_at` + índice único + backfill.
- `backend/src/modules/products/stock-engine.service.ts` — primitivas atômicas.
- `backend/src/modules/products/stock-engine.service.integration.spec.ts` — testes com banco real.
- `backend/src/modules/products/stock-sweeper.service.ts` — varredor de TTL.
- `backend/src/modules/products/stock-sweeper.service.integration.spec.ts` — testes.

**Modificar:**
- `backend/src/database/entities/Pedido.entity.ts` — coluna `stock_released_at`.
- `backend/src/database/entities/WhatsappCart.entity.ts` — coluna `stock_released_at`.
- `backend/src/modules/products/products.module.ts` — registrar entidade + providers + export.
- `backend/src/modules/orders/orders.service.ts` — `create` (baixa→reserva), `updateStatus` (commit no `PRONTO`, release no `CANCELADO`).
- `backend/src/modules/orders/orders.module.ts` — importar `ProductsModule` (para `StockEngineService`).
- `backend/src/modules/whatsapp/services/cart.service.ts` — reserve/release no carrinho.
- `backend/src/modules/payments/<webhook>.ts` — PIX expirado → cancel+release (Task 8 localiza o arquivo).
- `backend/src/app.module.ts` — `ScheduleModule.forRoot()`.

---

## Task 1: Ledger — entidade, migration, colunas de release, backfill

**Files:**
- Create: `backend/src/database/entities/MovimentacaoEstoqueHistorico.entity.ts`
- Create: `backend/src/database/migrations/1751300000000-AddStockLedgerAndReleaseTracking.ts`
- Modify: `backend/src/database/entities/Pedido.entity.ts` (adicionar coluna)
- Modify: `backend/src/database/entities/WhatsappCart.entity.ts` (adicionar coluna)
- Test: `backend/src/modules/products/stock-engine.service.integration.spec.ts` (esqueleto + 1 teste de schema)

**Interfaces:**
- Produces: tabela `movimentacoes_estoque_historico` com colunas `(id, tenant_id, produto_id, tipo, delta, saldo_resultante, motivo, order_id, usuario_id, created_at)`; índice único `uq_ledger_venda_por_item (order_id, produto_id) WHERE tipo='VENDA'`; colunas `pedidos.stock_released_at` e `whatsapp_carts.stock_released_at`. Enum `LedgerTipo` exportado da entidade.

- [ ] **Step 1: Criar a entidade do ledger**

Criar `backend/src/database/entities/MovimentacaoEstoqueHistorico.entity.ts`:

```typescript
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from './Tenant.entity';
import { Produto } from './Produto.entity';

export enum LedgerTipo {
  INVENTARIO_INICIAL = 'INVENTARIO_INICIAL',
  VENDA = 'VENDA',
  COMPRA = 'COMPRA',
  AJUSTE = 'AJUSTE',
  PERDA = 'PERDA',
  DEVOLUCAO = 'DEVOLUCAO',
}

/**
 * Ledger imutável de movimentações físicas de estoque (fonte da verdade).
 * Registra apenas mudanças de current_stock; reservas NÃO entram aqui.
 * Invariante: current_stock == soma(delta) por produto.
 */
@Entity('movimentacoes_estoque_historico')
@Index(['tenant_id', 'produto_id'])
export class MovimentacaoEstoqueHistorico {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column('uuid')
  produto_id: string;

  @ManyToOne(() => Produto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'produto_id' })
  produto: Produto;

  @Column({ type: 'enum', enum: LedgerTipo })
  tipo: LedgerTipo;

  @Column('int')
  delta: number;

  @Column('int')
  saldo_resultante: number;

  @Column('text', { nullable: true })
  motivo: string | null;

  @Column('uuid', { nullable: true })
  order_id: string | null;

  @Column('uuid', { nullable: true })
  usuario_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
```

- [ ] **Step 2: Adicionar `stock_released_at` às entidades Pedido e WhatsAppCart**

Em `backend/src/database/entities/Pedido.entity.ts`, adicionar a coluna (junto às demais `@Column`):

```typescript
  @Column({ type: 'timestamptz', nullable: true })
  stock_released_at: Date | null;
```

Em `backend/src/database/entities/WhatsappCart.entity.ts`, adicionar a mesma coluna:

```typescript
  @Column({ type: 'timestamptz', nullable: true })
  stock_released_at: Date | null;
```

- [ ] **Step 3: Criar a migration**

Criar `backend/src/database/migrations/1751300000000-AddStockLedgerAndReleaseTracking.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStockLedgerAndReleaseTracking1751300000000
  implements MigrationInterface
{
  name = 'AddStockLedgerAndReleaseTracking1751300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enum de tipos de movimentação
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ledger_tipo_enum" AS ENUM (
          'INVENTARIO_INICIAL','VENDA','COMPRA','AJUSTE','PERDA','DEVOLUCAO'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // Tabela ledger
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "movimentacoes_estoque_historico" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "produto_id" uuid NOT NULL,
        "tipo" "ledger_tipo_enum" NOT NULL,
        "delta" integer NOT NULL,
        "saldo_resultante" integer NOT NULL,
        "motivo" text,
        "order_id" uuid,
        "usuario_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_movimentacoes_estoque_historico" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ledger_tenant_produto"
      ON "movimentacoes_estoque_historico" ("tenant_id", "produto_id")
    `);

    // Idempotência: uma baixa VENDA por (pedido, produto)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_ledger_venda_por_item"
      ON "movimentacoes_estoque_historico" ("order_id", "produto_id")
      WHERE "tipo" = 'VENDA'
    `);

    // Colunas de rastreio de liberação de reserva
    await queryRunner.query(`
      ALTER TABLE "pedidos"
      ADD COLUMN IF NOT EXISTS "stock_released_at" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      ALTER TABLE "whatsapp_carts"
      ADD COLUMN IF NOT EXISTS "stock_released_at" TIMESTAMP WITH TIME ZONE
    `);

    // Backfill INVENTARIO_INICIAL — atômico (INSERT ... SELECT), idempotente
    await queryRunner.query(`
      INSERT INTO "movimentacoes_estoque_historico"
        (id, tenant_id, produto_id, tipo, delta, saldo_resultante, created_at)
      SELECT gen_random_uuid(), me.tenant_id, me.produto_id,
             'INVENTARIO_INICIAL', me.current_stock, me.current_stock, now()
      FROM "movimentacoes_estoque" me
      WHERE me.current_stock > 0
        AND NOT EXISTS (
          SELECT 1 FROM "movimentacoes_estoque_historico" h
          WHERE h.produto_id = me.produto_id AND h.tipo = 'INVENTARIO_INICIAL'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "whatsapp_carts" DROP COLUMN IF EXISTS "stock_released_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" DROP COLUMN IF EXISTS "stock_released_at"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "movimentacoes_estoque_historico"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "ledger_tipo_enum"`);
  }
}
```

> Nota: `uuid_generate_v4()`/`gen_random_uuid()` — usar a função já disponível no banco (as migrations existentes usam `uuid_generate_v4()`; `gen_random_uuid()` exige `pgcrypto`). Se `gen_random_uuid()` falhar ao rodar, trocar por `uuid_generate_v4()` no backfill.

- [ ] **Step 4: Registrar a entidade no data source / módulo**

Confirmar como as entidades são carregadas. Em `backend/src/database/data-source.ts` e no `databaseConfig` (`backend/src/config/database.config.ts`), as entidades costumam ser carregadas por glob (`entities: [__dirname + '/../**/*.entity.{ts,js}']`). Se for glob, nada a fazer. Se for lista explícita, adicionar `MovimentacaoEstoqueHistorico`. Verificar com:

Run: `grep -n "entities" backend/src/config/database.config.ts backend/src/database/data-source.ts`

- [ ] **Step 5: Rodar a migration e verificar**

Run (a partir de `backend/`): `npm run migration:run`
Expected: aplica `AddStockLedgerAndReleaseTracking1751300000000` sem erro; cria tabela, índice único parcial e colunas.

Verificar o índice e backfill:
Run: `docker exec ucm-postgres psql -U postgres -d ucm -c "\d movimentacoes_estoque_historico"`
Expected: tabela existe com o índice `uq_ledger_venda_por_item`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/database/entities/MovimentacaoEstoqueHistorico.entity.ts \
        backend/src/database/entities/Pedido.entity.ts \
        backend/src/database/entities/WhatsappCart.entity.ts \
        backend/src/database/migrations/1751300000000-AddStockLedgerAndReleaseTracking.ts
git commit -m "feat(stock): add stock ledger table, release-tracking columns, initial backfill"
```

---

## Task 2: StockEngineService — `reserve` e `release`

**Files:**
- Create: `backend/src/modules/products/stock-engine.service.ts`
- Modify: `backend/src/modules/products/products.module.ts`
- Test: `backend/src/modules/products/stock-engine.service.integration.spec.ts`

**Interfaces:**
- Consumes: tabela `movimentacoes_estoque` (Task existente), `DbContextService`.
- Produces:
  - `reserve(manager: EntityManager, tenantId: string, produtoId: string, qty: number): Promise<void>` — lança `BadRequestException` se `available < qty`.
  - `release(manager: EntityManager, tenantId: string, produtoId: string, qty: number): Promise<void>` — nunca negativa.

- [ ] **Step 1: Escrever os testes de integração (falham)**

Criar `backend/src/modules/products/stock-engine.service.integration.spec.ts`. Usa o bootstrap de integração (banco real, RLS via `set_config`). Se o banco não estiver disponível, os testes são pulados (padrão do projeto).

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { databaseConfig } from '../../config/database.config';
import { CommonModule } from '../common/common.module';
import { ProductsModule } from './products.module';
import { StockEngineService } from './stock-engine.service';

const tenantId = '00000000-0000-0000-0000-000000000000';

describe('StockEngineService (integration)', () => {
  let dataSource: DataSource | null = null;
  let engine: StockEngineService;
  let produtoId: string;

  beforeAll(async () => {
    try {
      process.env.SUPPRESS_TENANT_RLS_LOGS = 'true';
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
          TypeOrmModule.forRootAsync(databaseConfig),
          CommonModule,
          ProductsModule,
        ],
      }).compile();
      dataSource = moduleRef.get<DataSource>(DataSource);
      engine = moduleRef.get<StockEngineService>(StockEngineService);
    } catch {
      dataSource = null;
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  // Cria um produto + saldo zerado e devolve o produto_id
  async function seedProduto(current: number, reserved = 0): Promise<string> {
    const qr = dataSource!.createQueryRunner();
    await qr.connect();
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
    const prod = await qr.query(
      `INSERT INTO produtos (id, tenant_id, name, price, is_active, created_at, updated_at)
       VALUES (uuid_generate_v4(), $1, 'Teste Estoque', 10.0, true, now(), now()) RETURNING id`,
      [tenantId],
    );
    const pid = prod[0].id;
    await qr.query(
      `INSERT INTO movimentacoes_estoque (id, tenant_id, produto_id, current_stock, reserved_stock, min_stock, last_updated)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, 0, now())`,
      [tenantId, pid, current, reserved],
    );
    await qr.release();
    return pid;
  }

  async function saldo(pid: string): Promise<{ current: number; reserved: number }> {
    const qr = dataSource!.createQueryRunner();
    await qr.connect();
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);
    const r = await qr.query(
      `SELECT current_stock, reserved_stock FROM movimentacoes_estoque WHERE produto_id = $1`,
      [pid],
    );
    await qr.release();
    return { current: Number(r[0].current_stock), reserved: Number(r[0].reserved_stock) };
  }

  it('reserve aumenta reserved_stock quando há disponível', async () => {
    if (!dataSource) return;
    produtoId = await seedProduto(5);
    await dataSource.transaction(async (m: EntityManager) => {
      await engine.reserve(m, tenantId, produtoId, 3);
    });
    expect(await saldo(produtoId)).toEqual({ current: 5, reserved: 3 });
  });

  it('reserve rejeita quando available < qty', async () => {
    if (!dataSource) return;
    const pid = await seedProduto(2);
    await expect(
      dataSource.transaction((m: EntityManager) => engine.reserve(m, tenantId, pid, 5)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await saldo(pid)).toEqual({ current: 2, reserved: 0 });
  });

  it('release reduz reserved_stock sem ir abaixo de zero', async () => {
    if (!dataSource) return;
    const pid = await seedProduto(5, 3);
    await dataSource.transaction((m: EntityManager) => engine.release(m, tenantId, pid, 10));
    expect(await saldo(pid)).toEqual({ current: 5, reserved: 0 });
  });

  it('concorrência: a guarda atômica impede reservar o último item duas vezes', async () => {
    if (!dataSource) return;
    const pid = await seedProduto(1); // só 1 disponível
    // 1ª reserva (transação própria, commitada) consome o disponível
    await dataSource.transaction((m: EntityManager) => engine.reserve(m, tenantId, pid, 1));
    // 2ª reserva, em transação separada, deve falhar — available agora é 0
    await expect(
      dataSource.transaction((m: EntityManager) => engine.reserve(m, tenantId, pid, 1)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await saldo(pid)).toEqual({ current: 1, reserved: 1 }); // reservado só uma vez
  });
});
```

> Nota: este teste é determinístico (transações sequenciais commitadas) e prova que a guarda `current - reserved >= qty` holds entre transações. A versão verdadeiramente paralela (dois `UPDATE` simultâneos com bloqueio de linha) é serializada pelo Postgres com o mesmo resultado, mas é flaky em teste automatizado — validar manualmente sob carga se desejado.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- stock-engine.service.integration.spec.ts`
Expected: FAIL — `StockEngineService` não existe / não exportado.

- [ ] **Step 3: Implementar `reserve` e `release`**

Criar `backend/src/modules/products/stock-engine.service.ts`:

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MovimentacaoEstoque } from '../../database/entities/MovimentacaoEstoque.entity';

/**
 * Primitivas atômicas de estoque. Toda mutação é UPDATE guardado no banco,
 * com checagem de linhas afetadas — nunca ler-em-JS-e-gravar.
 * Os métodos recebem o EntityManager da transação do chamador.
 */
@Injectable()
export class StockEngineService {
  /**
   * Reserva `qty` se houver disponível (current - reserved >= qty). Atômico.
   */
  async reserve(
    manager: EntityManager,
    tenantId: string,
    produtoId: string,
    qty: number,
  ): Promise<void> {
    this.assertQty(qty);
    const result = await manager
      .createQueryBuilder()
      .update(MovimentacaoEstoque)
      .set({
        reserved_stock: () => 'reserved_stock + :qty',
        last_updated: () => 'NOW()',
      })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('produto_id = :produtoId', { produtoId })
      .andWhere('current_stock - reserved_stock >= :qty')
      .setParameters({ qty })
      .execute();

    if (!result.affected || result.affected < 1) {
      throw new BadRequestException(
        `Estoque insuficiente para reservar produto ${produtoId} (qtd ${qty}).`,
      );
    }
  }

  /**
   * Libera `qty` de reserva. Nunca deixa reserved_stock negativo.
   */
  async release(
    manager: EntityManager,
    tenantId: string,
    produtoId: string,
    qty: number,
  ): Promise<void> {
    this.assertQty(qty);
    await manager
      .createQueryBuilder()
      .update(MovimentacaoEstoque)
      .set({
        reserved_stock: () => 'GREATEST(0, reserved_stock - :qty)',
        last_updated: () => 'NOW()',
      })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('produto_id = :produtoId', { produtoId })
      .setParameters({ qty })
      .execute();
  }

  private assertQty(qty: number): void {
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException('Quantidade inválida para operação de estoque.');
    }
  }
}
```

- [ ] **Step 4: Registrar no ProductsModule**

Em `backend/src/modules/products/products.module.ts`: adicionar `MovimentacaoEstoqueHistorico` ao `TypeOrmModule.forFeature([...])`, adicionar `StockEngineService` aos `providers` e aos `exports`.

```typescript
// imports do arquivo
import { StockEngineService } from './stock-engine.service';
import { MovimentacaoEstoqueHistorico } from '../../database/entities/MovimentacaoEstoqueHistorico.entity';
// ...
// TypeOrmModule.forFeature([..., MovimentacaoEstoqueHistorico])
// providers: [..., StockEngineService]
// exports: [..., StockEngineService]
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- stock-engine.service.integration.spec.ts`
Expected: PASS (4 testes). Se o banco de teste estiver indisponível, os testes retornam cedo (verde) — garantir ao menos uma rodada com banco ativo.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/products/stock-engine.service.ts \
        backend/src/modules/products/stock-engine.service.integration.spec.ts \
        backend/src/modules/products/products.module.ts
git commit -m "feat(stock): add StockEngineService reserve/release with atomic guards"
```

---

## Task 3: StockEngineService — `commitSale` (idempotente) e `recordManualMovement`

**Files:**
- Modify: `backend/src/modules/products/stock-engine.service.ts`
- Test: `backend/src/modules/products/stock-engine.service.integration.spec.ts` (adicionar describe)

**Interfaces:**
- Consumes: `reserve`/`release` (Task 2), entidade `MovimentacaoEstoqueHistorico` + enum `LedgerTipo` (Task 1).
- Produces:
  - `commitSale(manager, tenantId, orderId, items: Array<{ produto_id: string; quantity: number }>): Promise<void>` — baixa `current_stock` e `reserved_stock`, grava `VENDA` no ledger; idempotente por `(order_id, produto_id)`.
  - `recordManualMovement(manager, tenantId, produtoId, tipo: LedgerTipo, delta: number, motivo: string | null, usuarioId: string | null): Promise<{ saldo_resultante: number }>`.

- [ ] **Step 1: Escrever os testes (falham)**

Adicionar ao `stock-engine.service.integration.spec.ts` (dentro do mesmo describe, reusando `seedProduto`/`saldo`):

```typescript
  it('commitSale baixa current e reserved e grava VENDA no ledger', async () => {
    if (!dataSource) return;
    const pid = await seedProduto(10, 4);
    const orderId = (await dataSource.query(`SELECT uuid_generate_v4() AS id`))[0].id;
    await dataSource.transaction((m) =>
      engine.commitSale(m, tenantId, orderId, [{ produto_id: pid, quantity: 4 }]),
    );
    expect(await saldo(pid)).toEqual({ current: 6, reserved: 0 });

    const ledger = await dataSource.query(
      `SELECT tipo, delta, saldo_resultante FROM movimentacoes_estoque_historico
       WHERE order_id = $1 AND produto_id = $2`,
      [orderId, pid],
    );
    expect(ledger).toHaveLength(1);
    expect(ledger[0].tipo).toBe('VENDA');
    expect(Number(ledger[0].delta)).toBe(-4);
    expect(Number(ledger[0].saldo_resultante)).toBe(6);
  });

  it('commitSale é idempotente — 2ª chamada não baixa de novo', async () => {
    if (!dataSource) return;
    const pid = await seedProduto(10, 4);
    const orderId = (await dataSource.query(`SELECT uuid_generate_v4() AS id`))[0].id;
    const items = [{ produto_id: pid, quantity: 4 }];
    await dataSource.transaction((m) => engine.commitSale(m, tenantId, orderId, items));
    await dataSource.transaction((m) => engine.commitSale(m, tenantId, orderId, items));
    expect(await saldo(pid)).toEqual({ current: 6, reserved: 0 });
    const count = await dataSource.query(
      `SELECT COUNT(*)::int AS n FROM movimentacoes_estoque_historico
       WHERE order_id = $1 AND produto_id = $2 AND tipo = 'VENDA'`,
      [orderId, pid],
    );
    expect(count[0].n).toBe(1);
  });

  it('recordManualMovement grava ledger e ajusta saldo', async () => {
    if (!dataSource) return;
    const pid = await seedProduto(5);
    const res = await dataSource.transaction((m) =>
      engine.recordManualMovement(m, tenantId, pid, 'COMPRA' as any, 7, 'reposição', null),
    );
    expect(res.saldo_resultante).toBe(12);
    expect((await saldo(pid)).current).toBe(12);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- stock-engine.service.integration.spec.ts -t commitSale`
Expected: FAIL — `engine.commitSale is not a function`.

- [ ] **Step 3: Implementar `commitSale` e `recordManualMovement`**

Adicionar imports e métodos em `stock-engine.service.ts`:

```typescript
import {
  MovimentacaoEstoqueHistorico,
  LedgerTipo,
} from '../../database/entities/MovimentacaoEstoqueHistorico.entity';
```

```typescript
  /**
   * Baixa real de venda: current -= qty e reserved -= qty, + ledger VENDA.
   * Idempotente: se já existe VENDA para (order_id, produto_id), pula o item.
   */
  async commitSale(
    manager: EntityManager,
    tenantId: string,
    orderId: string,
    items: Array<{ produto_id: string; quantity: number }>,
  ): Promise<void> {
    for (const item of items) {
      this.assertQty(item.quantity);

      // Gate de idempotência: tenta inserir o registro de VENDA primeiro.
      // ON CONFLICT no índice parcial (order_id, produto_id) WHERE tipo='VENDA'.
      const inserted = await manager.query(
        `INSERT INTO movimentacoes_estoque_historico
           (id, tenant_id, produto_id, tipo, delta, saldo_resultante, order_id, created_at)
         VALUES (uuid_generate_v4(), $1, $2, 'VENDA', $3, 0, $4, now())
         ON CONFLICT (order_id, produto_id) WHERE tipo = 'VENDA' DO NOTHING
         RETURNING id`,
        [tenantId, item.produto_id, -item.quantity, orderId],
      );

      // Já existia (retry) → no-op para este item.
      if (!inserted || inserted.length === 0) continue;
      const ledgerId = inserted[0].id;

      // Baixa guardada; RETURNING dá o saldo pós-update (sem ler memória).
      const updated = await manager.query(
        `UPDATE movimentacoes_estoque
         SET current_stock = current_stock - $3,
             reserved_stock = GREATEST(0, reserved_stock - $3),
             last_updated = now()
         WHERE tenant_id = $1 AND produto_id = $2 AND current_stock - $3 >= 0
         RETURNING current_stock`,
        [tenantId, item.produto_id, item.quantity],
      );

      if (!updated || updated.length === 0) {
        throw new BadRequestException(
          `Estoque insuficiente para baixar produto ${item.produto_id} (qtd ${item.quantity}).`,
        );
      }

      // Preenche o saldo_resultante real no ledger.
      await manager.query(
        `UPDATE movimentacoes_estoque_historico SET saldo_resultante = $2 WHERE id = $1`,
        [ledgerId, Number(updated[0].current_stock)],
      );
    }
  }

  /**
   * Movimento manual (COMPRA/AJUSTE/PERDA/DEVOLUCAO). Ajusta current_stock e grava ledger.
   */
  async recordManualMovement(
    manager: EntityManager,
    tenantId: string,
    produtoId: string,
    tipo: LedgerTipo,
    delta: number,
    motivo: string | null,
    usuarioId: string | null,
  ): Promise<{ saldo_resultante: number }> {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new BadRequestException('Delta inválido para movimento manual.');
    }
    const updated = await manager.query(
      `UPDATE movimentacoes_estoque
       SET current_stock = current_stock + $3, last_updated = now()
       WHERE tenant_id = $1 AND produto_id = $2 AND current_stock + $3 >= 0
       RETURNING current_stock`,
      [tenantId, produtoId, delta],
    );
    if (!updated || updated.length === 0) {
      throw new BadRequestException(
        `Movimento inválido: estoque ficaria negativo (produto ${produtoId}).`,
      );
    }
    const saldo = Number(updated[0].current_stock);
    await manager
      .getRepository(MovimentacaoEstoqueHistorico)
      .insert({
        tenant_id: tenantId,
        produto_id: produtoId,
        tipo,
        delta,
        saldo_resultante: saldo,
        motivo,
        order_id: null,
        usuario_id: usuarioId,
      });
    return { saldo_resultante: saldo };
  }
```

> Nota TypeORM: o `ON CONFLICT ... WHERE` com índice parcial é SQL bruto via `manager.query` (o QueryBuilder do TypeORM não expressa `ON CONFLICT` com predicado de índice parcial de forma confiável). Mantemos SQL bruto só onde necessário.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- stock-engine.service.integration.spec.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/products/stock-engine.service.ts \
        backend/src/modules/products/stock-engine.service.integration.spec.ts
git commit -m "feat(stock): add idempotent commitSale and recordManualMovement to StockEngineService"
```

---

## Task 4: Refatorar `orders.service.create` — baixa → reserva (artéria principal)

**Files:**
- Modify: `backend/src/modules/orders/orders.service.ts` (bloco de estoque dentro de `create`, ~linhas 234-255)
- Modify: `backend/src/modules/orders/orders.module.ts` (importar `ProductsModule`)
- Test: `backend/src/modules/orders/orders.integration.spec.ts` (ajustar/expandir expectativas de estoque)

**Interfaces:**
- Consumes: `StockEngineService.reserve` (Task 2).
- Produces: após `create`, o estado de estoque é `reserved_stock += qty`, `current_stock` **intacto** (antes era `current_stock -= qty`).

- [ ] **Step 1: Ajustar/escrever o teste de regressão do `create`**

No `orders.integration.spec.ts`, localizar as asserções que validam estoque após criar pedido. Hoje esperam `current_stock` decrementado. **Mudar** para: `current_stock` inalterado e `reserved_stock` incrementado pela quantidade do pedido. Adicionar também um teste explícito (a artéria preservada):

```typescript
it('create reserva estoque (não baixa current) e preserva validações', async () => {
  if (!app) return;
  // ... criar produto com current_stock = 10, reserved_stock = 0 (helper existente) ...
  // criar pedido de qty=3 via POST /api/v1/orders (ou via service)
  // Assert: resposta 201, pedido em 'pendente_pagamento'
  // Assert saldo: current_stock === 10 (intacto), reserved_stock === 3
  // Assert: preço recalculado do banco; pedido com itens; order_no gerado
});
```

(Preencher com o helper de criação de produto/pedido já usado no arquivo — manter o estilo existente; **não** inventar endpoints.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- orders.integration.spec.ts`
Expected: FAIL — após o create o estoque ainda baixa `current_stock` (comportamento antigo), contrariando a nova asserção.

- [ ] **Step 3: Refatorar o bloco de estoque do `create`**

Em `orders.service.ts`, dentro da transação de `create` (passo "5. Abater estoque e liberar reserva", ~linhas 234-255), **substituir** o `UPDATE` que faz `current_stock - quantity` por uma **reserva** via `StockEngineService`. Injetar o serviço no constructor.

Constructor — adicionar o parâmetro:
```typescript
    private readonly stockEngine: StockEngineService,
```
e o import no topo:
```typescript
import { StockEngineService } from '../products/stock-engine.service';
```

Substituir o bloco (mantendo o lock pessimista do passo 1 e a validação dos passos 3-4):
```typescript
      // 5. RESERVAR estoque (não baixar — a baixa ocorre no PRONTO).
      // O lock pessimista do passo 1 + a guarda atômica do reserve garantem
      // que não há overselling concorrente.
      for (const item of createOrderDto.items) {
        await this.stockEngine.reserve(
          manager,
          tenantId,
          item.produto_id,
          item.quantity,
        );
      }
```

> Remover a validação manual duplicada do passo 4 (que comparava `current_stock < quantity`) **não** é obrigatório, mas a guarda do `reserve` agora cobre `current - reserved >= qty`. Manter o passo 4 como verificação amigável de mensagem é aceitável; se mantido, ajustar para checar `current_stock - reserved_stock < item.quantity`.

- [ ] **Step 4: Importar ProductsModule no OrdersModule**

Em `backend/src/modules/orders/orders.module.ts`, adicionar `ProductsModule` aos `imports` (para resolver `StockEngineService`, que é exportado pelo ProductsModule na Task 2). Se houver dependência circular, usar `forwardRef(() => ProductsModule)`.

```typescript
import { ProductsModule } from '../products/products.module';
// imports: [..., ProductsModule]
```

- [ ] **Step 5: Rodar regressão completa de pedidos**

Run: `npm test -- orders.integration.spec.ts`
Expected: PASS — incluindo todos os testes pré-existentes (preço divergente rejeitado, cupom, estoque insuficiente, criação de itens), agora com a semântica de reserva.

Run também a suíte unit de orders (se existir): `npm test -- orders.service.spec.ts`
Expected: PASS (ajustar mocks se algum esperava o UPDATE de baixa).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/orders/orders.service.ts \
        backend/src/modules/orders/orders.module.ts \
        backend/src/modules/orders/orders.integration.spec.ts
git commit -m "refactor(orders): create reserves stock instead of deducting (baixa moves to PRONTO)"
```

---

## Task 5: `orders.service.updateStatus` — commit no `PRONTO`, release no `CANCELADO`

**Files:**
- Modify: `backend/src/modules/orders/orders.service.ts` (`updateStatus`, ~linhas 564-602)
- Test: `backend/src/modules/orders/orders.integration.spec.ts`

**Interfaces:**
- Consumes: `StockEngineService.commitSale` / `release` (Tasks 2-3); enum `PedidoStatus`; `db.runInTransaction`.
- Produces: transição `→ PRONTO` baixa estoque (ledger VENDA) uma vez; transição `→ CANCELADO` pré-`PRONTO` libera reserva e marca `stock_released_at` (tapa o vazamento).

- [ ] **Step 1: Escrever os testes (falham)**

Adicionar ao `orders.integration.spec.ts`:

```typescript
it('transição para PRONTO baixa current_stock e grava VENDA (uma vez)', async () => {
  if (!app) return;
  // criar produto current=10; criar pedido qty=3 (reserva: current=10, reserved=3)
  // avançar status: pendente_pagamento → confirmado → em_producao → pronto
  // Assert saldo: current=7, reserved=0
  // Assert ledger: 1 linha VENDA (order_id, produto) delta=-3
  // Reaplicar updateStatus(pronto) (idempotência via from===to): saldo continua current=7
});

it('cancelar antes do PRONTO libera reserva e NÃO vaza estoque', async () => {
  if (!app) return;
  // criar produto current=10; criar pedido qty=3 (reserved=3, current=10)
  // updateStatus → cancelado (a partir de pendente_pagamento)
  // Assert saldo: current=10 (intacto), reserved=0  ← o bug do vazamento corrigido
  // Assert: pedido.stock_released_at != null; nenhum ledger VENDA para o pedido
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- orders.integration.spec.ts -t PRONTO`
Expected: FAIL — `updateStatus` não toca estoque ainda.

- [ ] **Step 3: Implementar o ciclo no `updateStatus`**

Reescrever `updateStatus` para envolver a mudança numa transação e disparar a ação de estoque conforme a transição. Carregar os itens do pedido para o commit/release.

```typescript
  async updateStatus(
    id: string,
    status: PedidoStatus,
    tenantId: string,
  ): Promise<Pedido> {
    const pedido = await this.findOne(id, tenantId);
    const oldStatus = pedido.status;

    if (oldStatus === status) {
      return pedido; // no-op idempotente (não reprocessa estoque)
    }
    this.assertStatusTransition(oldStatus, status);

    const updatedPedido = await this.db.runInTransaction(async (manager) => {
      // Lock do pedido para serializar transições concorrentes
      await manager
        .createQueryBuilder(Pedido, 'p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id })
        .andWhere('p.tenant_id = :tenantId', { tenantId })
        .getOne();

      const itens = await manager.find(ItemPedido, { where: { pedido_id: id } });
      const stockItems = itens.map((i) => ({
        produto_id: i.produto_id,
        quantity: i.quantity,
      }));

      // COMMIT da baixa ao entrar em PRONTO
      if (status === PedidoStatus.PRONTO) {
        await this.stockEngine.commitSale(manager, tenantId, id, stockItems);
      }

      // RELEASE da reserva ao cancelar (só pré-PRONTO, e só uma vez)
      if (status === PedidoStatus.CANCELADO && pedido.stock_released_at == null) {
        for (const it of stockItems) {
          await this.stockEngine.release(manager, tenantId, it.produto_id, it.quantity);
        }
        pedido.stock_released_at = new Date();
      }

      pedido.status = status;
      return manager.getRepository(Pedido).save(pedido);
    });

    // Notificação FORA da transação (sem I/O externo sob lock)
    try {
      await this.notificationsService.notifyOrderStatusChange(
        tenantId, updatedPedido, oldStatus, status,
      );
    } catch (error) {
      this.logger.error('Error sending order status notification', {
        error: error instanceof Error ? error.message : String(error),
        context: { tenantId, pedidoId: id, oldStatus, newStatus: status },
      });
    }

    return updatedPedido;
  }
```

Garantir os imports de `ItemPedido` e `PedidoStatus` (já presentes no arquivo) e `StockEngineService` (Task 4).

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- orders.integration.spec.ts`
Expected: PASS — incluindo os dois novos testes e os de Task 4.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/orders/orders.service.ts \
        backend/src/modules/orders/orders.integration.spec.ts
git commit -m "feat(orders): commit stock on PRONTO, release reservation on cancel (fixes stock leak)"
```

---

## Task 6: Carrinho — reservar no add, liberar no remove/clear/expire

**Files:**
- Modify: `backend/src/modules/whatsapp/services/cart.service.ts`
- Test: `backend/src/modules/whatsapp/services/cart.service.integration.spec.ts` (criar se não existir, no padrão de integração)

**Interfaces:**
- Consumes: `StockEngineService` (exportado por ProductsModule); `db.runInTransaction`.
- Produces: `addItem` reserva; `removeItem`/`clearCart`/`expireOldCarts` liberam, marcando `stock_released_at` no carrinho (idempotente).

- [ ] **Step 1: Escrever os testes (falham)**

Criar `cart.service.integration.spec.ts` cobrindo: (a) `addItem` aumenta `reserved_stock`; (b) `clearCart`/`removeItem` libera; (c) `addItem` além do disponível é rejeitado. (Bootstrap de integração igual à Task 2, importando o `WhatsappModule` ou montando `CartService` + `ProductsModule`.)

```typescript
it('addItem reserva estoque do produto', async () => {
  if (!dataSource) return;
  // produto current=5; addItem qty=2 → reserved=2, current=5
});
it('clearCart libera a reserva (idempotente em 2ª chamada)', async () => {
  if (!dataSource) return;
  // após addItem qty=2, clearCart → reserved=0; chamar de novo → reserved=0
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- cart.service.integration.spec.ts`
Expected: FAIL — carrinho ainda não reserva.

- [ ] **Step 3: Injetar StockEngineService e costurar reserve/release**

Em `cart.service.ts`:
- Adicionar ao constructor `private readonly stockEngine: StockEngineService` e `private readonly db: DbContextService` (importar de `../../common/services/db-context.service`); garantir que o `WhatsappModule` importe `ProductsModule` e `CommonModule`.
- Em `addItem`: ao adicionar/incrementar um item, dentro de `db.runInTransaction`, chamar `stockEngine.reserve(manager, tenant_id, produto_id, deltaQty)`. Se lançar, propagar (não adiciona ao carrinho).
- Em `removeItem` e `clearCart`: antes de marcar `abandoned`, liberar a reserva dos itens removidos via `release`, dentro de transação, e setar `stock_released_at`.
- Em `expireOldCarts`: trocar o `UPDATE status='expired'` simples pela **rotina idempotente** — selecionar os carrinhos `active` vencidos com `RETURNING items`, e para cada um liberar as reservas. Ver a rotina compartilhada na Task 7 (`releaseCartReservations`), que o sweeper também usa; extrair para um método reutilizável em `cart.service` e chamá-lo aqui.

> Para evitar duplicação, criar em `cart.service.ts` um método público `releaseExpiredCart(cartId: string): Promise<void>` que faz o compare-and-set (`UPDATE ... SET status='expired', stock_released_at=now() WHERE id=:id AND status='active' AND stock_released_at IS NULL RETURNING items`) e, se `affected=1`, libera as reservas dos `items`. Esse método é chamado tanto pelo fast-path (`expireOldCarts`) quanto pelo sweeper (Task 7).

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- cart.service.integration.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/whatsapp/services/cart.service.ts \
        backend/src/modules/whatsapp/services/cart.service.integration.spec.ts \
        backend/src/modules/whatsapp/whatsapp.module.ts
git commit -m "feat(cart): reserve stock on add, release on remove/clear/expire"
```

---

## Task 7: ScheduleModule + StockSweeperService (TTL)

**Files:**
- Modify: `backend/src/app.module.ts` (`ScheduleModule.forRoot()`)
- Create: `backend/src/modules/products/stock-sweeper.service.ts`
- Modify: `backend/src/modules/products/products.module.ts` (provider) — ou no módulo que reúne cart+orders; ver nota.
- Test: `backend/src/modules/products/stock-sweeper.service.integration.spec.ts`

**Interfaces:**
- Consumes: `cart.service.releaseExpiredCart` (Task 6); um método de release de pedido pendente (criar em `orders.service`: `releaseExpiredPendingOrder(orderId)` usando o compare-and-set §6.4); `ConfigService`.
- Produces: job `@Cron` a cada 60s que varre carrinhos e pedidos vencidos e libera reservas idempotentemente.

- [ ] **Step 1: Habilitar ScheduleModule**

Em `backend/src/app.module.ts`, importar e registrar:
```typescript
import { ScheduleModule } from '@nestjs/schedule';
// imports: [ ScheduleModule.forRoot(), ... ]
```
Run: `npm run build`
Expected: compila (pacote `@nestjs/schedule@^6.1.0` já está em dependencies).

- [ ] **Step 2: Escrever o teste do sweeper (falha)**

Criar `stock-sweeper.service.integration.spec.ts`: criar um carrinho `active` com `expires_at` no passado e reserva de estoque; rodar `sweeper.sweepExpiredCarts()`; esperar `reserved_stock` liberado e carrinho `expired`; rodar de novo → no-op (idempotente).

```typescript
it('sweepExpiredCarts libera reserva de carrinhos vencidos (idempotente)', async () => {
  if (!dataSource) return;
  // produto current=5; criar carrinho active vencido com reserva=2 (reserved_stock=2)
  // sweeper.sweepExpiredCarts()
  // Assert: reserved=0, carrinho.status='expired', stock_released_at != null
  // rodar de novo → reserved continua 0 (sem dupla liberação)
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- stock-sweeper.service.integration.spec.ts`
Expected: FAIL — serviço não existe.

- [ ] **Step 4: Implementar o sweeper**

Criar `backend/src/modules/products/stock-sweeper.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { CartService } from '../whatsapp/services/cart.service';
import { OrdersService } from '../orders/orders.service';

/**
 * Varredor de TTL: libera reservas de carrinhos e pedidos pendentes vencidos.
 * Rede de segurança do fast-path preguiçoso e do webhook de PIX.
 */
@Injectable()
export class StockSweeperService {
  private readonly logger = new Logger(StockSweeperService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly cartService: CartService,
    private readonly ordersService: OrdersService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'stock-sweeper' })
  async run(): Promise<void> {
    try {
      await this.sweepExpiredCarts();
      await this.sweepExpiredPendingOrders();
    } catch (err) {
      this.logger.error('Stock sweeper falhou', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async sweepExpiredCarts(): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT id FROM whatsapp_carts
       WHERE status = 'active' AND expires_at < now() AND stock_released_at IS NULL
       LIMIT 500`,
    );
    for (const r of rows) {
      await this.cartService.releaseExpiredCart(r.id);
    }
  }

  async sweepExpiredPendingOrders(): Promise<void> {
    const ttlMin = Number(this.config.get('ORDER_PAYMENT_TTL_MINUTES')) || 60;
    const rows = await this.dataSource.query(
      `SELECT id FROM pedidos
       WHERE status = 'pendente_pagamento'
         AND created_at < now() - ($1 || ' minutes')::interval
         AND stock_released_at IS NULL
       LIMIT 500`,
      [ttlMin],
    );
    for (const r of rows) {
      await this.ordersService.releaseExpiredPendingOrder(r.id);
    }
  }
}
```

Adicionar em `orders.service.ts` o método de release de pedido pendente (compare-and-set §6.4):
```typescript
  /** Cancela+libera um pedido pendente vencido, de forma idempotente. */
  async releaseExpiredPendingOrder(orderId: string): Promise<void> {
    await this.db.runInTransaction(async (manager) => {
      const flipped = await manager.query(
        `UPDATE pedidos SET status = 'cancelado', stock_released_at = now()
         WHERE id = $1 AND status = 'pendente_pagamento' AND stock_released_at IS NULL
         RETURNING id, tenant_id`,
        [orderId],
      );
      if (!flipped || flipped.length === 0) return; // outro ator já tratou
      const tenantId = flipped[0].tenant_id;
      const itens = await manager.find(ItemPedido, { where: { pedido_id: orderId } });
      for (const it of itens) {
        await this.stockEngine.release(manager, tenantId, it.produto_id, it.quantity);
      }
    });
  }
```

Registrar `StockSweeperService` como provider. **Nota de módulo:** o sweeper depende de `CartService` (WhatsappModule) e `OrdersService` (OrdersModule). Para evitar ciclos, registrá-lo num módulo que importe ambos (ex.: criar um `StockSchedulerModule` que importa `WhatsappModule` + `OrdersModule`, ou colocá-lo no `OrdersModule` importando `WhatsappModule`). Escolher o que não criar dependência circular; se necessário, `forwardRef`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- stock-sweeper.service.integration.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/app.module.ts \
        backend/src/modules/products/stock-sweeper.service.ts \
        backend/src/modules/products/stock-sweeper.service.integration.spec.ts \
        backend/src/modules/orders/orders.service.ts
git commit -m "feat(stock): add TTL sweeper (@nestjs/schedule) releasing expired carts and pending orders"
```

---

## Task 8: Webhook de PIX expirado → cancel+release (sem colisão)

**Files:**
- Modify: o handler de webhook de pagamento (localizar — provavelmente `backend/src/modules/payments/payments.controller.ts` ou um `*.webhook.ts`)
- Test: `backend/src/modules/payments/payments.integration.spec.ts`

**Interfaces:**
- Consumes: `OrdersService.releaseExpiredPendingOrder` (Task 7) — reaproveita o **mesmo** compare-and-set, garantindo que webhook e sweeper nunca liberem em dobro.
- Produces: ao receber evento de PIX expirado/cancelado, o pedido associado é cancelado e a reserva liberada idempotentemente.

- [ ] **Step 1: Localizar o handler do webhook**

Run: `grep -rn "expired\|payment.expired\|webhook\|cancelled\|charge" backend/src/modules/payments --include=*.ts -l`
Identificar o método que processa notificações de status de pagamento e onde mapeia `payment → pedido`.

- [ ] **Step 2: Escrever o teste (falha)**

No `payments.integration.spec.ts`, adicionar: criar pedido pendente com reserva; simular o evento de pagamento expirado; esperar pedido `cancelado`, `reserved_stock` liberado, `current_stock` intacto. Adicionar caso de **colisão**: chamar o handler e `ordersService.releaseExpiredPendingOrder` para o mesmo pedido → liberação única.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- payments.integration.spec.ts -t expirado`
Expected: FAIL.

- [ ] **Step 4: Implementar**

No handler, ao detectar status de expiração/cancelamento do pagamento PIX, resolver o `order_id` associado e chamar:
```typescript
await this.ordersService.releaseExpiredPendingOrder(orderId);
```
(injetar `OrdersService` no módulo de pagamentos se ainda não estiver; cuidar de ciclos com `forwardRef` se necessário). **Não** duplicar a lógica de release — reusar o método idempotente. Garantir que a chamada externa ao provedor (se houver) ocorra fora de qualquer transação de estoque.

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- payments.integration.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/payments/
git commit -m "feat(payments): release stock reservation on expired PIX via idempotent order release"
```

---

## Task 9: Regressão completa + invariante

**Files:**
- Test: rodar todas as suítes de integração tocadas.

- [ ] **Step 1: Rodar a suíte de integração inteira**

Run (a partir de `backend/`): `npm test -- --runInBand orders.integration stock-engine stock-sweeper cart.service payments.integration products.integration`
Expected: PASS em todas. `--runInBand` evita corrida entre suítes no mesmo banco de teste.

- [ ] **Step 2: Teste de invariante de ponta a ponta**

Adicionar (em `stock-engine.service.integration.spec.ts`) um teste que executa uma sequência: backfill/seed → reserva → commit (PRONTO) → movimento manual (COMPRA, PERDA) e, ao final, valida:
```sql
-- para o produto: current_stock == soma(delta) do ledger
SELECT (SELECT current_stock FROM movimentacoes_estoque WHERE produto_id = $1)
     = (SELECT COALESCE(SUM(delta),0) FROM movimentacoes_estoque_historico WHERE produto_id = $1)
```
Expected: `true`.

- [ ] **Step 3: Build e lint**

Run: `npm run build` → Expected: sem erros de tipo.
Run: `npm run lint` (se configurado) → Expected: limpo.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "test(stock): full integration regression + ledger invariant assertion"
```

---

## Self-review (cobertura do spec)

- §1 vazamento corrigido → Task 5 (release no cancel) + Task 7/8 (sweeper/webhook). ✔
- §2 ledger/projeção/regra de ouro → Tasks 1-3 (UPDATE guardado + RETURNING). ✔
- §3 schema/índice único/backfill atômico → Task 1. ✔
- §4 ciclo (reserva no create, commit no PRONTO, release no cancel, PDV) → Tasks 4-6. PDV: verificar na Task 4/5 se usa `create` (channel='pdv'); se sim, herda reserva+commit; documentar caso precise de fast-path próprio. ✔ (com nota)
- §5 lock pessimista mantido + sem I/O sob lock → Tasks 4-5 (notificação fora da transação). ✔
- §6 TTL sweeper 60s + fast-path + webhook + compare-and-set → Tasks 6-8. ✔
- §9 testes (concorrência, idempotência, vazamento, regressão create, invariante) → Tasks 2-5, 9. Concorrência: teste determinístico cross-transaction na Task 2 (4º teste); paralelismo verdadeiro documentado como validação manual sob carga. ✔
- §12 salvaguardas (RETURNING, backfill INSERT...SELECT) → Tasks 1, 3. ✔
