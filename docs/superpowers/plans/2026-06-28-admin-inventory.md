# Admin de Operação (Produtos & Estoque) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar interface operacional ao motor de estoque — o lojista gerencia Produtos e Estoque (com extrato auditável do ledger), ledger-correto e com UX instantânea (optimistic updates).

**Architecture:** Backend completa 3 endpoints (ajuste manual → ledger via `recordManualMovement`; extrato; categorias) + 1 migration (coluna `category`). Frontend monta a casca responsiva do admin e duas fatias verticais (Produtos, Estoque), consumindo o `api-client` existente. Fatias verticais (hook + tela juntos); casca primeiro; selos stubbed e fiados na fonte única.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL 15, Jest (backend); Next.js 16, React 19, Tailwind 4, vitest (frontend). Spec: `docs/superpowers/specs/2026-06-28-admin-inventory-design.md`.

## Global Constraints

- **Validação sinal×tipo DENTRO de `recordManualMovement`** (chokepoint): `COMPRA`/`DEVOLUCAO`/`INVENTARIO_INICIAL` → `delta>0`; `PERDA` → `delta<0`; `AJUSTE` → `delta≠0`. Incoerência → `400`. Guard `current+delta<0` → **`422` com `{ code: 'INSUFFICIENT_STOCK' }`**.
- **Endpoint `adjust-stock` expõe só os 4 tipos manuais** (COMPRA/PERDA/DEVOLUCAO/AJUSTE) via DTO `{tipo, delta, motivo?}`. `INVENTARIO_INICIAL` é uso interno (criação de produto) — rejeitado no wire.
- **A4 sem contagem-dobrada:** produto nasce com linha de estoque `current_stock=0`; o `recordManualMovement(INVENTARIO_INICIAL, +inicial)` traz ao valor inicial. Nunca setar `current=inicial` E gravar `+inicial`.
- **Categoria:** coluna `category` (varchar nullable) no Produto (FK `categoria_id` dormente). Normalização no write: `trim()`, colapsar espaços, vazio→`null`. `GET /products/categories` = DISTINCT por tenant. Combobox com **match case-insensitive** (storage preserva o case).
- **Extrato:** `ORDER BY created_at DESC, id DESC`; paginado `LIMIT/OFFSET`; `usuario_id` fora do payload v1.
- **SKU interno:** gera do nome (slug)+uniquifica se vazio; backstop na constraint única `[tenant_id, sku]` (tratar violação no insert). NÃO gerar EAN.
- **Badges por `available = current - reserved`** via função pura única `lib/stock-status.ts`. **Fonte única** alimenta filtro C1 + selo da aba Estoque + número do Início.
- **Correção em modo-contagem:** UI pede valor contado (alvo); calcula `delta = alvo − atual`. Wire = `delta` sinalizado.
- **Optimistic update fiel:** muta estado local na hora; no erro reverte + feedback; badge otimista recomputa pela mesma `stock-status.ts` com `current` novo + `reserved` inalterado. `422 INSUFFICIENT_STOCK` → "Estoque insuficiente para esta saída".
- **Padrões existentes:** hooks `'use client'` retornam `{data, loading, error, refetch, ...}` (modelo `useOrders.ts`); feedback inline via estado local (padrão `OrdersManager`); `api-client` injeta token+`x-tenant-id`. Tokens: `#f6f3ee`/`#1a1814`/`#b8654a`/`var(--font-display)`.
- Código/comentários **português**; commits **inglês** (Conventional Commits) + trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Banco de teste: `ucm_test_motor` via `backend/.env` (túnel `localhost:5544`). Backend: `npm test -- <arquivo>.spec.ts` em `backend/`. Frontend: `npm test` (vitest) em `frontend/`.

---

## Mapa de arquivos

**Backend (T1, T2):**
- Create: `backend/src/database/migrations/1751400000000-AddCategoryToProdutos.ts`
- Modify: `backend/src/database/entities/Produto.entity.ts` (coluna `category`)
- Modify: `backend/src/modules/products/stock-engine.service.ts` (`recordManualMovement`: validação sinal×tipo + 422)
- Modify: `backend/src/modules/products/products.controller.ts` (adjust-stock novo contrato; novos GET stock-history e categories)
- Modify: `backend/src/modules/products/products.service.ts` (adjust via recordManualMovement; create com estoque inicial+linha de estoque; getStockHistory; getCategories; normalização category; aposenta adjustStock antigo)
- Modify: `backend/src/modules/products/dto/create-product.dto.ts` (`category?`, `initial_stock?`)
- Create: `backend/src/modules/products/dto/adjust-stock.dto.ts`
- Test: `backend/src/modules/products/products.integration.spec.ts` (ou stock-engine.service.integration.spec.ts conforme o caso)

**Frontend (T3-T5b):**
- Create: `frontend/app/admin/layout.tsx`, `frontend/components/admin/shell/AdminShell.tsx`, `frontend/components/admin/shell/AdminNav.tsx`, **`frontend/components/admin/shell/AdminDataProvider.tsx`** (provider único — segura UMA `useOrders` (T3) e UMA `useStock` (T5a); fonte única **de dado**, não só de função)
- Create: `frontend/hooks/useProducts.ts`, `frontend/hooks/useStock.ts`, `frontend/lib/stock-status.ts`
- Create: `frontend/components/admin/ProductsManager.tsx`, `frontend/components/admin/ProductForm.tsx`, `frontend/components/admin/StockManager.tsx`
- Modify: `frontend/lib/api-client.ts` (adjustStock novo body; +getStockHistory; +getCategories), `frontend/lib/types.ts` (tipos novos), `frontend/app/admin/produtos/page.tsx`, `frontend/app/admin/estoque/page.tsx`, `frontend/app/admin/page.tsx` (Início hub), `frontend/components/admin/OrdersManager.tsx` (consome orders do provider; remove auth-gate interno e o `useOrders` próprio)

> **Princípio do provider (a correção estrutural):** hooks hand-rolled (modelo `useOrders`) **não deduplicam** — N chamadas = N estados. Para o selo da aba, o número do Início e a tela operarem sobre o **mesmo** estado (e o optimistic de um ajuste propagar pros três + reverter junto), um único `AdminDataProvider` no `AdminShell` segura uma instância de cada hook e os consumidores leem via contexto. Colapsa as cópias, mata o double-fetch (Pedidos era buscado no shell **e** no OrdersManager) e torna o `lib/stock-status.ts` realmente fonte única — no dado.

---

## Task 1: Backend A1 + A4 + migration `category`

**Files:**
- Create: `backend/src/database/migrations/1751400000000-AddCategoryToProdutos.ts`
- Modify: `Produto.entity.ts`, `stock-engine.service.ts`, `products.controller.ts`, `products.service.ts`, `dto/create-product.dto.ts`
- Create: `backend/src/modules/products/dto/adjust-stock.dto.ts`
- Test: `backend/src/modules/products/products.integration.spec.ts`

**Interfaces:**
- Produces: `POST /products/:id/adjust-stock` com body `{ tipo: 'COMPRA'|'PERDA'|'DEVOLUCAO'|'AJUSTE', delta: number, motivo?: string }` → ledger-correto; `recordManualMovement` com validação sinal×tipo + 422 `INSUFFICIENT_STOCK`; criação de produto com `initial_stock?` grava `INVENTARIO_INICIAL`; coluna `category` no Produto.

- [ ] **Step 1: Migration da coluna `category`**

Criar `backend/src/database/migrations/1751400000000-AddCategoryToProdutos.ts`:
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryToProdutos1751400000000 implements MigrationInterface {
  name = 'AddCategoryToProdutos1751400000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "produtos" ADD COLUMN IF NOT EXISTS "category" character varying(100)`,
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "produtos" DROP COLUMN IF EXISTS "category"`);
  }
}
```
Em `Produto.entity.ts`, adicionar a coluna (perto de `sku`):
```typescript
  @Column({ length: 100, nullable: true })
  category?: string;
```
Run: `npm run migration:run` → aplica. Verificar a coluna existe.

- [ ] **Step 2: Escrever os testes de integração (falham)**

Em `products.integration.spec.ts`, adicionar (seguindo o bootstrap do arquivo — app HTTP + JWT + seed via SQL):
```typescript
describe('Admin estoque — adjust-stock ledger-correto', () => {
  it('COMPRA grava ledger e mantem invariante', async () => {
    if (!app) return;
    // seed produto + estoque current=10 (helper/SQL do arquivo)
    const res = await request(app.getHttpServer())
      .post(`/api/v1/products/${produtoId}/adjust-stock`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ tipo: 'COMPRA', delta: 5, motivo: 'reposicao' });
    expect(res.status).toBe(201);
    // current=15; ledger tem 1 linha COMPRA delta=5; invariante bate
  });
  it('rejeita sinal incoerente (COMPRA com delta negativo) -> 400', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer())
      .post(`/api/v1/products/${produtoId}/adjust-stock`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ tipo: 'COMPRA', delta: -5 });
    expect(res.status).toBe(400);
  });
  it('saida maior que saldo -> 422 INSUFFICIENT_STOCK', async () => {
    if (!app) return;
    // produto com current=2
    const res = await request(app.getHttpServer())
      .post(`/api/v1/products/${produtoId}/adjust-stock`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ tipo: 'PERDA', delta: -5 });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });
  it('rejeita tipo INVENTARIO_INICIAL no wire -> 400', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer())
      .post(`/api/v1/products/${produtoId}/adjust-stock`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ tipo: 'INVENTARIO_INICIAL', delta: 5 });
    expect(res.status).toBe(400);
  });
  it('criar produto com initial_stock grava UMA linha INVENTARIO_INICIAL (sem 2x)', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer())
      .post(`/api/v1/products`).set('Authorization', `Bearer ${jwtToken}`)
      .send({ name: 'Trufa', price: 5.0, initial_stock: 10 });
    expect(res.status).toBe(201);
    // estoque do produto: current=10; ledger 1 linha INVENTARIO_INICIAL delta=10
  });
});
```
Run: `npm test -- products.integration.spec.ts -t "adjust-stock ledger"` → FAIL.

- [ ] **Step 3: Validação sinal×tipo + 422 no `recordManualMovement`**

Em `stock-engine.service.ts`, no início de `recordManualMovement` (substituindo a checagem `Number.isInteger(delta) && delta !== 0`):
```typescript
    if (!Number.isInteger(delta) || delta === 0) {
      throw new BadRequestException('Delta inválido para movimento manual.');
    }
    // Validacao sinal x tipo (chokepoint unico: cobre endpoint, criacao e callers internos).
    const exigePositivo = [LedgerTipo.COMPRA, LedgerTipo.DEVOLUCAO, LedgerTipo.INVENTARIO_INICIAL];
    if (exigePositivo.includes(tipo) && delta <= 0) {
      throw new BadRequestException(`Tipo ${tipo} exige delta positivo.`);
    }
    if (tipo === LedgerTipo.PERDA && delta >= 0) {
      throw new BadRequestException('PERDA exige delta negativo.');
    }
```
E trocar a rejeição do guard (estoque negativo) por erro tipado 422. Substituir:
```typescript
    if (!updatedRows || updatedRows.length === 0) {
      throw new BadRequestException(
        `Movimento inválido: estoque ficaria negativo (produto ${produtoId}).`,
      );
    }
```
por:
```typescript
    if (!updatedRows || updatedRows.length === 0) {
      throw new UnprocessableEntityException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Estoque insuficiente para esta saída.',
      });
    }
```
Importar `UnprocessableEntityException` de `@nestjs/common`. (Os testes do motor que usam recordManualMovement com COMPRA/+ continuam válidos; conferir que nenhum usa sinal incoerente.)

- [ ] **Step 4: DTO + endpoint adjust-stock no novo contrato**

Criar `backend/src/modules/products/dto/adjust-stock.dto.ts`:
```typescript
import { IsEnum, IsInt, IsOptional, IsString, NotEquals } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AdjustStockTipo {
  COMPRA = 'COMPRA',
  PERDA = 'PERDA',
  DEVOLUCAO = 'DEVOLUCAO',
  AJUSTE = 'AJUSTE',
}

export class AdjustStockDto {
  @ApiProperty({ enum: AdjustStockTipo, description: 'Tipo de movimento manual (INVENTARIO_INICIAL nao e aceito no wire)' })
  @IsEnum(AdjustStockTipo)
  tipo: AdjustStockTipo;

  @ApiProperty({ description: 'Delta sinalizado (+ entrada / - saida)' })
  @IsInt()
  @NotEquals(0)
  delta: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  motivo?: string;
}
```
Em `products.controller.ts`, trocar o handler `adjustStock` para usar `AdjustStockDto` e chamar um novo método de service `adjustStockLedger`:
```typescript
  adjustStock(
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: Usuario,
  ) {
    return this.productsService.adjustStockLedger(id, dto.tipo, dto.delta, dto.motivo ?? null, tenantId, user?.id ?? null);
  }
```

- [ ] **Step 5: `adjustStockLedger` no service (transação + recordManualMovement)**

Em `products.service.ts`, adicionar (injetar `StockEngineService` no constructor se ainda não estiver — verificar; ProductsModule já exporta/provê):
```typescript
  async adjustStockLedger(
    produtoId: string,
    tipo: LedgerTipo,
    delta: number,
    motivo: string | null,
    tenantId: string,
    usuarioId: string | null,
  ): Promise<{ saldo_resultante: number }> {
    await this.findOne(produtoId, tenantId); // 404 se nao existe
    const res = await this.db.runInTransaction((manager) =>
      this.stockEngine.recordManualMovement(manager, tenantId, produtoId, tipo, delta, motivo, usuarioId),
    );
    await this.cacheService.invalidateProductsCache(tenantId);
    await this.cacheService.invalidateStockCache(tenantId, produtoId);
    return res;
  }
```
(`LedgerTipo` importado de `MovimentacaoEstoqueHistorico.entity`; o `AdjustStockTipo` do DTO mapeia 1:1 para `LedgerTipo` — passar `tipo as unknown as LedgerTipo` ou converter explicitamente.) **Aposentar** o `adjustStock` antigo: removê-lo se o grep confirmar que nada mais o chama (o controller agora usa `adjustStockLedger`).

- [ ] **Step 6: Criação de produto com estoque inicial (A4) + category**

Em `dto/create-product.dto.ts`, adicionar:
```typescript
  @ApiProperty({ required: false }) @IsOptional() @IsString() category?: string;
  @ApiProperty({ required: false, description: 'Estoque inicial (gera INVENTARIO_INICIAL)' })
  @IsOptional() @IsInt() @Min(0) initial_stock?: number;
```
Em `products.service.create`, envolver em transação: criar o produto, **sempre** criar a linha `movimentacoes_estoque` com `current_stock=0, reserved_stock=0, min_stock=0`, e se `initial_stock > 0`, chamar `recordManualMovement(manager, tenantId, produto.id, LedgerTipo.INVENTARIO_INICIAL, initial_stock, 'Inventário inicial', userId)`. Normalizar `category` (`trim()`; vazio→null) antes do `create`. **Nunca** setar `current_stock=initial_stock` direto.
```typescript
    const category = createProductDto.category?.trim().replace(/\s+/g, ' ') || null;
    const saved = await this.db.runInTransaction(async (manager) => {
      const produto = manager.getRepository(Produto).create({
        ...createProductDto, category, tenant_id: tenantId,
      });
      delete (produto as any).initial_stock;
      const p = await manager.getRepository(Produto).save(produto);
      await manager.getRepository(MovimentacaoEstoque).insert({
        tenant_id: tenantId, produto_id: p.id, current_stock: 0, reserved_stock: 0, min_stock: 0,
      });
      if (createProductDto.initial_stock && createProductDto.initial_stock > 0) {
        await this.stockEngine.recordManualMovement(
          manager, tenantId, p.id, LedgerTipo.INVENTARIO_INICIAL,
          createProductDto.initial_stock, 'Inventário inicial', userId ?? null,
        );
      }
      return p;
    });
    await this.cacheService.invalidateProductsCache(tenantId);
    return saved;
```
(Ajustar imports: `MovimentacaoEstoque`, `LedgerTipo`. `initial_stock` não é coluna — não pode ir no `create`; o `delete` evita isso, ou montar o objeto explicitamente sem o campo.)

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test -- products.integration.spec.ts`
Expected: novos testes PASS; pré-existentes verdes (as falhas Redis conhecidas permanecem). `npm run build` limpo.

- [ ] **Step 8: Commit**

```bash
git add backend/src/database/migrations/1751400000000-AddCategoryToProdutos.ts backend/src/database/entities/Produto.entity.ts backend/src/modules/products/
git commit -m "feat(stock): wire manual adjust through ledger (sign-by-type + 422), initial stock as INVENTARIO_INICIAL, category column"
```

---

## Task 2: Backend A2 (extrato) + A3-read (categories)

**Files:**
- Modify: `products.controller.ts`, `products.service.ts`
- Test: `backend/src/modules/products/products.integration.spec.ts`

**Interfaces:**
- Produces: `GET /products/:id/stock-history?limit&offset` → `{ items: Array<{tipo, delta, saldo_resultante, motivo, created_at}>, total }`; `GET /products/categories` → `string[]`.

- [ ] **Step 1: Testes (falham)**

```typescript
it('extrato retorna movimentacoes do produto, recentes primeiro, paginado', async () => {
  if (!app) return;
  // seed produto + 3 movimentos no ledger (COMPRA, AJUSTE, PERDA) com created_at crescente
  const res = await request(app.getHttpServer())
    .get(`/api/v1/products/${produtoId}/stock-history?limit=2&offset=0`)
    .set('Authorization', `Bearer ${jwtToken}`);
  expect(res.status).toBe(200);
  expect(res.body.items).toHaveLength(2);
  // ordenado created_at DESC (mais recente primeiro)
  expect(res.body.total).toBeGreaterThanOrEqual(3);
});
it('categories retorna DISTINCT por tenant', async () => {
  if (!app) return;
  // seed 3 produtos: category 'Trufas','Trufas','Bombons'
  const res = await request(app.getHttpServer())
    .get(`/api/v1/products/categories`).set('Authorization', `Bearer ${jwtToken}`);
  expect(res.status).toBe(200);
  expect(res.body.sort()).toEqual(['Bombons', 'Trufas']);
});
```
Run: FAIL (endpoints não existem).

- [ ] **Step 2: Implementar no service**

Em `products.service.ts`:
```typescript
  async getStockHistory(produtoId: string, tenantId: string, limit = 50, offset = 0) {
    await this.findOne(produtoId, tenantId);
    const repo = this.db.getRepository(MovimentacaoEstoqueHistorico);
    const [rows, total] = await repo
      .createQueryBuilder('h')
      .where('h.tenant_id = :tenantId', { tenantId })
      .andWhere('h.produto_id = :produtoId', { produtoId })
      .orderBy('h.created_at', 'DESC').addOrderBy('h.id', 'DESC')
      .limit(Math.min(limit, 200)).offset(offset)
      .getManyAndCount();
    return {
      items: rows.map((h) => ({
        tipo: h.tipo, delta: h.delta, saldo_resultante: h.saldo_resultante,
        motivo: h.motivo, created_at: h.created_at,
      })),
      total,
    };
  }

  async getCategories(tenantId: string): Promise<string[]> {
    const rows = await this.db.getRepository(Produto)
      .createQueryBuilder('p')
      .select('DISTINCT p.category', 'category')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.category IS NOT NULL')
      .orderBy('p.category', 'ASC')
      .getRawMany();
    return rows.map((r) => r.category).filter(Boolean);
  }
```
(Importar `MovimentacaoEstoqueHistorico`.)

- [ ] **Step 3: Endpoints no controller**

```typescript
  @Get(':id/stock-history')
  @UseGuards(JwtAuthGuard)
  getStockHistory(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.productsService.getStockHistory(id, tenantId, Number(limit) || 50, Number(offset) || 0);
  }

  @Get('categories')
  @UseGuards(JwtAuthGuard)
  getCategories(@CurrentTenant() tenantId: string) {
    return this.productsService.getCategories(tenantId);
  }
```
> Nota de rota: `@Get('categories')` deve vir ANTES de `@Get(':id')` para não ser capturado como `id='categories'`. Verificar a ordem no controller (NestJS casa por ordem de declaração).

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- products.integration.spec.ts` → PASS. `npm run build` limpo.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/products/
git commit -m "feat(products): add stock-history (ledger extrato) and categories DISTINCT endpoints"
```

---

## Task 3: Casca do admin (layout + nav responsiva + auth-gate), selos stubbed

**Files:**
- Create: `frontend/app/admin/layout.tsx`, `frontend/components/admin/shell/AdminShell.tsx`, `frontend/components/admin/shell/AdminNav.tsx`
- Modify: `frontend/app/admin/produtos/page.tsx`, `frontend/app/admin/estoque/page.tsx`, `frontend/app/admin/pedidos/page.tsx`, `frontend/app/admin/page.tsx` (remover headers próprios; virar conteúdo)

**Interfaces:**
- Produces: `AdminDataProvider` (contexto) segurando **uma** `useOrders()` (T5a estende com `useStock()`); expõe `{ pedidosCount, ... }`. `<AdminShell>` embrulha as telas em `<AdminDataProvider>` + auth-gate **único** + nav. `AdminNav` lê os selos do **contexto** (não via prop). Selo de Estoque stubbed (provider só ganha stock na T5a). `OrdersManager` passa a consumir orders do provider (sem `useOrders` próprio, sem auth-gate interno).

- [ ] **Step 1: `AdminDataProvider` — estado compartilhado (orders agora; stock na T5a)**

Criar `frontend/components/admin/shell/AdminDataProvider.tsx` (`'use client'`): um React context que chama **uma** `useOrders()` e expõe `{ orders, ordersLoading, ordersError, refetchOrders, updateOrderStatus, updatingOrderId, pedidosCount }`. `pedidosCount` = nº de pedidos em status novo/pendente (filtrar `orders` pelos status que contam pro selo — ex.: `pendente_pagamento`/`confirmado`; alinhar com o que o OrdersManager considera "novo"). Hook de consumo: `export function useAdminData()` (lança se fora do provider). (Na T5a, este provider ganha também `useStock()` e expõe `summary`/`attentionCount` — ver T5a step 4.)

- [ ] **Step 2: `AdminNav` — sidebar desktop + bottom tabs mobile + avatar, selos do contexto**

Criar `frontend/components/admin/shell/AdminNav.tsx` (`'use client'`): 4 abas (Início `/admin`, Pedidos `/admin/pedidos`, Produtos `/admin/produtos`, Estoque `/admin/estoque`) com ícones `lucide-react` (Home, Receipt, Package, Boxes). Item ativo via `usePathname`, destaque `#b8654a`. **Selos lidos de `useAdminData()`:** Pedidos = `pedidosCount`; Estoque = `attentionCount` (undefined até T5a → oculto). Mostra a contagem só se `> 0` (stub-safe). Avatar (desktop: rodapé da sidebar; mobile: topo) com `useAuth().user` + "Sair" (`logout`). Desktop: `<nav>` lateral `w-[240px]` fixa; mobile: `<nav>` fixa `bottom-0`. Tokens `#f6f3ee`/`#1a1814`/`#b8654a`, `var(--font-display)`.

- [ ] **Step 3: `AdminShell` — provider + auth-gate único + moldura**

Criar `frontend/components/admin/shell/AdminShell.tsx` (`'use client'`): usa `useAuth()`. Auth-gate **único** (verbatim do padrão de `OrdersManager`):
```typescript
  if (isLoading) return <CenteredMessage>Verificando seu acesso…</CenteredMessage>;
  if (!isAuthenticated) return (/* mensagem + <Link href="/login?redirect=/admin"> Entrar </Link> */);
```
Só DEPOIS do gate, embrulha em `<AdminDataProvider>` (assim o provider só busca dados quando autenticado): `<AdminDataProvider><AdminNav /><main>{children}</main></AdminDataProvider>` num grid responsivo (desktop: sidebar+conteúdo; mobile: conteúdo + `pb-[72px]`). Sem prop `badges` (o nav lê do contexto).

- [ ] **Step 4: `layout.tsx` + refatorar OrdersManager + remover headers**

Criar `frontend/app/admin/layout.tsx`:
```typescript
import { AdminShell } from '@/components/admin/shell/AdminShell';
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
```
Remover os headers próprios de `/admin/page.tsx`, `/admin/pedidos/page.tsx`, `/admin/estoque/page.tsx` (a casca cuida). **Refatorar `OrdersManager.tsx`:** trocar `const {...} = useOrders()` por `const {...} = useAdminData()` (orders/updateOrderStatus do provider) e **remover o auth-gate interno** (`if (authLoading)`/`if (!isAuthenticated)`) — a casca já gateia; deixar os dois evita o flash duplo de "verificando acesso" que o spec pediu pra eliminar (gate único). Mantém o resto (busca/filtro/feedback).

- [ ] **Step 5: Teste (vitest) + commit**

`AdminNav.test.tsx`: autenticado → 4 abas; selo oculto quando count 0/undefined, visível >0; ativo por pathname. `AdminShell.test.tsx`: não-autenticado → "Entrar"; autenticado → renderiza children dentro do provider. `useAdminData` fora do provider → lança.
Run: `npm test` (frontend) → PASS.
```bash
git add frontend/app/admin/layout.tsx frontend/components/admin/shell/ frontend/app/admin/ frontend/components/admin/OrdersManager.tsx
git commit -m "feat(admin): responsive shell with single auth-gate + shared AdminDataProvider (orders), OrdersManager consumes provider"
```

---

## Task 4: Fatia Produtos (`useProducts` + lista + `ProductForm`)

**Files:**
- Create: `frontend/hooks/useProducts.ts`, `frontend/components/admin/ProductsManager.tsx`, `frontend/components/admin/ProductForm.tsx`
- Modify: `frontend/lib/api-client.ts` (+`getCategories`), `frontend/lib/types.ts` (CreateProductInput +category/+initial_stock), `frontend/app/admin/produtos/page.tsx`

**Interfaces:**
- Consumes: `api.getProducts`, `api.createProduct`, `api.updateProduct`, `api.getCategories` (novo).
- Produces: `useProducts()` → `{ products, loading, error, refetch, create, update, toggleActive, mutatingId }` com optimistic no toggle.

- [ ] **Step 1: api-client + tipos**

Em `api-client.ts`, adicionar:
```typescript
  async getCategories(): Promise<string[]> {
    return this.request<string[]>('/products/categories');
  }
```
Em `lib/types.ts`, adicionar a `CreateProductInput`/`UpdateProductInput`: `category?: string; initial_stock?: number;` e a `Product`: `category?: string`.

- [ ] **Step 2: `useProducts` (modelado em `useOrders`, com optimistic no toggle)**

Criar `frontend/hooks/useProducts.ts` (`'use client'`): segue o shape de `useOrders` (`{products, loading, error, refetch}`) + `create(input)`, `update(id, input)`, `toggleActive(id, next)` com **optimistic** (`setProducts(prev.map(...))` muda `is_active` na hora; no erro reverte + retorna `{ok:false,error}`), e `mutatingId`. Deactivate = `update(id, { is_active: false })` (soft-delete; backend já faz). Import `api from '@/lib/api-client'`.

- [ ] **Step 3: `ProductForm` único (mode-aware)**

Criar `frontend/components/admin/ProductForm.tsx` (`'use client'`): props `{ mode: 'create'|'edit', initial?: Product, categories: string[], onSubmit, onCancel, submitting }`. Campos: nome\*, preço\*, descrição, **categoria (combobox creatable, match case-insensitive)**, unidade, custo, **estoque inicial (só `mode==='create'`)**, **foto por URL** (input + `<img onError>` → placeholder), **SKU** (editável no create, `readOnly` no edit). Validação local: nome e preço obrigatórios; categoria normalizada no submit (trim). SKU: se vazio no create, deixar o backend gerar (enviar undefined) — **não** gerar EAN no front. Combobox: filtra `categories` por `includes` case-insensitive do que foi digitado; permite escolher existente ou usar o texto novo. Painel lateral (desktop) / tela cheia (mobile) — seguir os tokens/estilos do `OrdersManager`.

- [ ] **Step 4: `ProductsManager` (lista + busca + filtro + form)**

Criar `frontend/components/admin/ProductsManager.tsx` (`'use client'`): usa `useProducts()` + `useState` para busca/filtro (Ativos/Inativos/Todos) e para o form aberto (create/edit). Estados loading/erro/vazio no padrão `OrdersManager` (CenteredMessage). Cada produto: nome, preço (`formatMoney`), categoria, selo Ativo/Inativo, estoque atual (se disponível via getProducts; senão omitir), botão editar + toggle Ativo (optimistic) + "+ Adicionar". Feedback inline (estado local, padrão `OrdersManager`). Carrega `categories` via `api.getCategories()` para passar ao form.

- [ ] **Step 5: Página + testes**

`frontend/app/admin/produtos/page.tsx`: `'use client'` → `<ProductsManager />` (sem header próprio — a casca cuida). Testes vitest: `useProducts` toggle optimistic aplica e **reverte no erro**; `ProductForm` valida nome/preço, combobox casa case-insensitive, estoque inicial só no create, SKU read-only no edit, foto-URL fallback.
Run: `npm test` (frontend) → PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/hooks/useProducts.ts frontend/components/admin/ProductsManager.tsx frontend/components/admin/ProductForm.tsx frontend/lib/api-client.ts frontend/lib/types.ts frontend/app/admin/produtos/page.tsx
git commit -m "feat(admin): products screen (useProducts optimistic toggle, single ProductForm, creatable category combobox)"
```

---

## Task 5a: Estoque read (`useStock` + `stock-status.ts` + badges + filtro + extrato) + fiação dos selos

**Files:**
- Create: `frontend/lib/stock-status.ts`, `frontend/hooks/useStock.ts`, `frontend/components/admin/StockManager.tsx`
- Modify: `frontend/lib/api-client.ts` (+`getStockHistory`), `frontend/app/admin/estoque/page.tsx`, `frontend/app/admin/page.tsx` (Início: número de reposição), `frontend/components/admin/shell/AdminShell.tsx` (fiar selo Estoque)

**Interfaces:**
- Consumes: `api.getStockSummary`, `api.getStockHistory` (novo).
- Produces: `stockStatus(available, minStock)` → `'ok'|'low'|'out'` (fonte única); `useStock()` → `{ summary, loading, error, refetch, history(id), attentionCount }`.

- [ ] **Step 1: `stock-status.ts` (a fonte única)**

Criar `frontend/lib/stock-status.ts`:
```typescript
export type StockStatus = 'ok' | 'low' | 'out';
/** Fonte ÚNICA do status. available = current - reserved (nunca current puro).
 *  Blindagem: campo ausente/null NÃO pode cair silenciosamente em 'ok' (mascararia
 *  um bug de chave errada do summary) — trata-se como 'out'. */
export function stockStatus(available: number | null | undefined, minStock: number | null | undefined): StockStatus {
  if (available == null || !Number.isFinite(available)) return 'out';
  const min = (minStock == null || !Number.isFinite(minStock)) ? 0 : minStock;
  if (available <= 0) return 'out';
  if (available <= min) return 'low';
  return 'ok';
}
export function isAttention(s: StockStatus): boolean {
  return s === 'low' || s === 'out';
}
export const STATUS_META: Record<StockStatus, { label: string; classes: string }> = {
  ok: { label: 'OK', classes: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  low: { label: 'Baixo', classes: 'border-amber-200 bg-amber-50 text-amber-800' },
  out: { label: 'Esgotado', classes: 'border-red-200 bg-red-50 text-red-700' },
};
```

- [ ] **Step 2: api-client + `useStock`**

Em `api-client.ts`:
```typescript
  async getStockHistory(productId: string, limit = 50, offset = 0): Promise<{ items: Array<{ tipo: string; delta: number; saldo_resultante: number; motivo: string | null; created_at: string }>; total: number }> {
    return this.request(`/products/${productId}/stock-history`, { params: { limit: String(limit), offset: String(offset) } });
  }
```
**Chaves exatas (confirmadas no retorno de `getStockSummary`):** cada `summary.products[i]` tem `{ id, name, current_stock, reserved_stock, available_stock, min_stock, status }`. Usar **exatamente** `available_stock` e `min_stock` (não `minimo`/`min`). Conferir que `frontend/lib/types.ts` (`StockSummary`) declara essas chaves; se divergir do backend, corrigir o tipo.
Criar `frontend/hooks/useStock.ts` (`'use client'`, modelado em `useOrders`): `getStockSummary` → `summary`; deriva `attentionCount` somando `isAttention(stockStatus(p.available_stock, p.min_stock))` sobre `summary.products` (via a função única); `history(id)` chama `api.getStockHistory`. Retorna `{ summary, loading, error, refetch, history, attentionCount }`.

- [ ] **Step 3: Estender o `AdminDataProvider` com `useStock` (UMA instância — a fonte única de DADO)**

Em `AdminDataProvider.tsx` (criado na T3 com orders), **adicionar** uma chamada a `useStock()` e expor no contexto: `summary`, `stockLoading`, `stockError`, `refetchStock`, `attentionCount`, `history`, e (T5b) `adjustStock`/`setMin`. Agora o provider segura **uma** instância de cada hook; todos os consumidores (selo, Início, StockManager) leem o **mesmo** estado — o optimistic de um ajuste (T5b) re-renderiza os três e reverte junto. (Este é o coração da correção: fonte única no dado, não só na função.)

- [ ] **Step 4: Consumidores leem do provider (selo, Início, tela) — sem nova instância**

- `AdminNav` (T3): o selo de Estoque agora resolve (`attentionCount` do `useAdminData()`).
- `frontend/app/admin/page.tsx` (Início hub): `'use client'` → mostra "X produtos precisam de reposição" lendo `useAdminData().attentionCount` (mesmo estado) + "Y pedidos novos" de `pedidosCount`. **Não** chamar `useStock()`/`useOrders()` aqui.
- `frontend/components/admin/StockManager.tsx` (`'use client'`): consome `useAdminData()` (`summary`, `stockLoading`, `stockError`, `refetchStock`, `history`) — **não** chama `useStock()` direto. Lista cada produto com atual/reservado/mínimo + **badge** via `STATUS_META[stockStatus(p.available_stock, p.min_stock)]`. Filtro "Precisam de atenção" (só `isAttention`). Tocar abre drawer com o extrato (`history(id)`): "tipo · delta · data → saldo". Estados loading/erro/vazio (padrão OrdersManager). (Mutações entram na T5b.)
- `frontend/app/admin/estoque/page.tsx`: `'use client'` → `<StockManager />`.

> **Por que não três `useStock()`:** hooks hand-rolled não deduplicam — seriam três fetches e três cópias; o ajuste otimista (T5b) mexeria só na cópia do StockManager e o selo/Início ficariam stale até remount. O provider colapsa as três numa.

- [ ] **Step 5: Testes**

Vitest: `stockStatus` mapeia OK/Baixo/Esgotado nas bordas (`available=min` → low; `available=0` → out; `available=min+1` → ok); **`stockStatus(undefined, undefined)` → `'out'`** (blindagem — não cair em `ok` se a chave do summary vier errada); `attentionCount` (no provider) conta low+out; `StockManager` filtro "atenção" esconde os OK; extrato renderiza as linhas do history.
Run: `npm test` (frontend) → PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/stock-status.ts frontend/hooks/useStock.ts frontend/components/admin/StockManager.tsx frontend/lib/api-client.ts frontend/app/admin/estoque/page.tsx frontend/app/admin/page.tsx frontend/components/admin/shell/AdminShell.tsx
git commit -m "feat(admin): stock read screen (single-source badges, attention filter, ledger extrato) + wire shell/inicio counts"
```

---

## Task 5b: Estoque mutações (ajuste modo-contagem + setMinStock + optimistic + badge fiel)

**Files:**
- Modify: `frontend/lib/api-client.ts` (adjustStock novo body), `frontend/hooks/useStock.ts` (+adjust, +setMinStock optimistic), `frontend/components/admin/StockManager.tsx` (modal de ajuste + edição de mínimo)

**Interfaces:**
- Consumes: `api.adjustStock` (novo body `{tipo, delta, motivo}`), `api.setMinStock`.
- Produces: ajuste de estoque com modo-contagem para Correção; optimistic update fiel ao badge.

- [ ] **Step 1: api-client — novo body do adjustStock**

Em `api-client.ts`, trocar o corpo do `adjustStock`:
```typescript
  async adjustStock(productId: string, tipo: 'COMPRA'|'PERDA'|'DEVOLUCAO'|'AJUSTE', delta: number, motivo?: string): Promise<{ saldo_resultante: number }> {
    const res = await fetch(`${this.baseUrl}/products/${productId}/adjust-stock`, {
      method: 'POST',
      headers: this.authHeaders(), // ou reusar request<T>; ver nota abaixo
      body: JSON.stringify({ tipo, delta, motivo }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.message || 'Falha no ajuste');
      (err as any).code = body.code; // surfa INSUFFICIENT_STOCK para o hook
      throw err;
    }
    return res.json();
  }
```
> **Preferir reusar o `request<T>` privado**, mas estendê-lo para preservar `body.code` no erro (hoje o `request` joga `new Error(errorBody.message)` e descarta o `code`). Ajustar `request` para anexar `(err as any).code = errorBody.code` antes do throw — assim TODO erro tipado (incl. 422 INSUFFICIENT_STOCK) chega aos hooks. Fazer essa pequena mudança no `request` e manter `adjustStock` usando-o.

- [ ] **Step 2: `useStock` — adjust + setMinStock com optimistic fiel (no estado compartilhado do provider)**

Em `useStock.ts` (a instância única vive no `AdminDataProvider`), adicionar `adjust(productId, tipo, delta, motivo)` e `setMin(productId, min)`, e expô-las pelo contexto (`useAdminData()`):
- **Optimistic:** atualiza o produto no `summary` (estado do provider) — `current_stock += delta` (adjust) ou `min_stock = min` (setMin) — e **recomputa `available_stock = current_stock - reserved_stock`** (reserved **inalterado**) + o badge pela mesma `stockStatus(available, min)`. Como o estado é do provider, o re-render propaga **de graça** pro selo da aba e pro número do Início (a correção estrutural em ação). Dispara a request; no erro **reverte** o `summary` e retorna `{ok:false, error, code}`. Se `code==='INSUFFICIENT_STOCK'`, o componente mostra "Estoque insuficiente para esta saída".

- [ ] **Step 3: Modal de ajuste (modo-contagem para Correção) + edição de mínimo**

Em `StockManager.tsx` (consumindo `adjust`/`setMin` de `useAdminData()`), adicionar um modal de ajuste por produto:
- Tipo (rótulo→enum): Compra→COMPRA, Perda→PERDA, Devolução→DEVOLUCAO, **Correção→AJUSTE**.
- **Compra/Perda/Devolução:** campo "quantidade" (positiva); a UI aplica o sinal (Perda = `-qtd`).
- **Correção:** campo "**valor contado**" (o estoque real na prateleira); a UI calcula `delta = contado - current_stock` antes de enviar. Mostrar o delta calculado ("ajuste: −3") pra confirmação.
- Motivo opcional. Submete via `adjust(...)` (optimistic). Erro 422 → mensagem específica.
- Edição de `min_stock` inline (campo + `setMin`, optimistic).

- [ ] **Step 4: Testes**

Vitest: modo-contagem calcula `delta = contado - atual` (contado=47, atual=50 → delta=−3); optimistic do adjust muda current+badge na hora e **reverte no erro**; badge otimista usa reserved inalterado; erro com `code==='INSUFFICIENT_STOCK'` mapeia na mensagem específica.
Run: `npm test` (frontend) → PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/api-client.ts frontend/hooks/useStock.ts frontend/components/admin/StockManager.tsx
git commit -m "feat(admin): stock mutations (count-mode correction, optimistic with faithful badge, typed INSUFFICIENT_STOCK)"
```

---

## Self-review (cobertura do spec)

- A1 (adjust→ledger, validação chokepoint, 422) → T1 (steps 3-5). ✔
- A2 (extrato ordenado/paginado) → T2. ✔
- A3 (category column + DISTINCT + normalização) → T1 (migration+normalização) + T2 (categories endpoint). ✔ (migration puxada pra T1 conforme decisão.)
- A4 (estoque inicial INVENTARIO_INICIAL, sem 2×) → T1 step 6. ✔
- Casca responsiva + auth-gate + selos stubbed → T3. ✔
- Produtos (form único, combobox case-insensitive, SKU interno, optimistic) → T4. ✔
- Estoque badges (available, **fonte única no DADO** via `AdminDataProvider`) + extrato + filtro → T5a. ✔ Selo/Início/tela leem o mesmo estado do provider — o optimistic do ajuste (T5b) propaga e reverte junto; sem stale-até-remount. ✔
- Estoque mutações (modo-contagem, optimistic fiel no estado compartilhado, 422 tipado) → T5b. ✔

**Verifies resolvidos (registro):**
- Migration no banco de teste: NÃO há DB de dev separado — `backend/.env` aponta pro `ucm_test_motor` e o `migration:run` (via `data-source.ts`) e os testes leem o **mesmo** `.env`. O `migration:run` da T1 aplica no próprio `ucm_test_motor` antes dos specs. ✔
- Chaves do summary pinadas: `available_stock`/`min_stock` (confirmado no retorno verbatim); `stockStatus` blindado contra null/undefined (cai em `out`). ✔
- Selo-stale + double-fetch de Pedidos: resolvidos pelo provider único (uma `useOrders` + uma `useStock`); o prop `badges` vestigial foi **removido** (nav lê do contexto). ✔
- Auth-gate único: o interno do `OrdersManager` é removido na T3 step 4 (a casca gateia) — sem flash duplo. ✔

**Verifies pendentes na execução (baratos, anotados nos steps):**
- `request<T>` do api-client deve **preservar `body.code`** no erro (T5b step 1) — mudança cross-cutting: confirmar que nenhum teste existente assere o **shape exato** do `Error` lançado.
- Ordem de rota: `@Get('categories')` **antes** de `@Get(':id')` (T2 step 3).
- `StockEngineService` injetado em `ProductsService` (T1 steps 5-6) — se não, injetar (ProductsModule já provê).
- **Decisão v1 registrada:** a lista de Produtos (T4) **omite** o estoque atual se `getProducts` não o traz (o estoque é a tela de Estoque); não é regressão, é corte de v1.
