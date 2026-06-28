# Spec B — Admin de Operação (Produtos & Estoque)

**Data:** 2026-06-28
**Status:** Aprovado — pronto para plano de implementação
**Escopo:** Backend (completação) + Frontend (Next.js admin). 
**Depende de:** Motor de Estoque + PDV (mergeados na main) — usa `StockEngineService.recordManualMovement`, o ledger `movimentacoes_estoque_historico` e os endpoints de produto/estoque existentes.

---

## 1. Problema & objetivo

O backend de estoque está 100% fechado (3 canais), mas é **invisível**: o lojista não tem interface para operar. O `/admin` atual é vitrine estática; `ProductCatalog`/`OnboardingPanel` são órfãos; não há hooks `useProducts`/`useStock`. Além disso, há um **furo de correção**: o `POST /products/:id/adjust-stock` ainda chama o `adjustStock` antigo (loga no `AuditLog`, **não** no ledger) — um ajuste manual quebraria o invariante `current_stock == Σ(deltas)`.

**Objetivo:** dar **rosto** ao motor — um admin operacional onde o lojista gerencia **Produtos** e **Estoque** (com extrato auditável), tudo ledger-correto e com UX instantânea (optimistic updates) para operar na velocidade do balcão.

**Escopo v1:** completação de backend + casca do admin + telas de **Produtos** e **Estoque**. (Pedidos já existe em `/admin/pedidos`.)

**Fora de escopo (v2):** **Negócio/configurações** (exige endpoints novos `GET/PATCH /tenants/settings`), **Início rico/analytics** (v1 = hub simples), **frontend do PDV** (conectar o `PdvPaymentModal` órfão), gestão relacional de categorias.

---

## 2. Seção A — Completação de backend

### A1. Ajuste manual ligado ao ledger (correção do invariante)
Religar `POST /products/:id/adjust-stock` ao `StockEngineService.recordManualMovement` (em vez do `adjustStock` antigo). Novo contrato:
```
POST /products/:id/adjust-stock
body: { tipo: 'COMPRA'|'PERDA'|'DEVOLUCAO'|'AJUSTE', delta: number (sinalizado), motivo?: string }
```
- Roda em `db.runInTransaction`; chama `recordManualMovement(manager, tenantId, produtoId, tipo, delta, motivo, usuarioId)`.
- `recordManualMovement` já guarda `current_stock + delta >= 0` e grava a linha no ledger (`saldo_resultante` incluso).
- O endpoint **deixa de chamar** o `adjustStock` antigo (AuditLog); o método antigo é **removido** se não houver outros consumidores (verificar na implementação — o grep atual mostra que só o controller o chamava). Invalida o cache de produtos como hoje.
- **Resultado:** todo ajuste manual vira movimentação auditável; o invariante sobrevive.

### A2. Endpoint de extrato (leitura do ledger)
```
GET /products/:id/stock-history?limit=50&offset=0
→ { items: [{ tipo, delta, saldo_resultante, motivo, created_at }], total }
```
- `movimentacoes_estoque_historico` do produto, escopado por tenant, **mais recentes primeiro**, paginado (`LIMIT/OFFSET`).
- Fonte do "extrato bancário" na tela de Estoque.

### A3. Categorias simplificadas
- **Migration:** coluna nullable `category` (varchar) no `Produto`. O `categoria_id` FK fica **dormente**.
- `GET /products/categories` → `DISTINCT category` (não-nulo, ordenado), escopado por tenant.
- DTOs de criar/editar produto aceitam `category?: string`.

### A4. Estoque inicial ledger-correto na criação de produto
Ao criar um produto **com estoque inicial > 0**, gravar um movimento `INVENTARIO_INICIAL` no ledger (via `recordManualMovement`) na mesma transação da criação — mantendo o invariante desde o nascimento do produto. (Já previsto no spec do motor; aqui é confirmado/implementado no fluxo de criação.)

**Testes (integração, banco real):** ajuste manual mantém o invariante; extrato retorna na ordem e paginação corretas; `categories` faz DISTINCT por tenant; criação com estoque inicial grava `INVENTARIO_INICIAL`.

---

## 3. Seção B — Casca do admin & Produtos

### B1. Casca (`app/admin/layout.tsx`)
- **Auth-gate único** no layout (não logado → `/login?redirect=...`; carregando → estado limpo). Centraliza a proteção das telas `/admin/*`.
- **Navegação responsiva:**
  - **Desktop (≥1024px):** menu lateral fixo (~240px): logo, itens, rodapé com loja + usuário + Sair.
  - **Celular:** barra de abas inferior (padrão Instagram/WhatsApp), **4 abas:** Início · Pedidos · Produtos · Estoque. Avatar no topo com usuário + Sair (Negócio entra aqui na v2). Item ativo no acento `#b8654a`.
  - **Selo de contagem** em "Pedidos" (pedidos novos/pendentes) e em "Estoque" (produtos em reposição — ver C).
- **Início (hub simples v1):** cards de navegação + 2-3 números reais (ex.: pedidos do dia, produtos em reposição). Não é dashboard rico.
- **Tokens visuais atuais:** `#f6f3ee` (fundo), `#1a1814` (escuro), `#b8654a` (acento), serif display. Coerência com login/pedidos no ar.

**Arquivos:** `app/admin/layout.tsx`, `components/admin/shell/AdminNav.tsx` (lateral+barra), `components/admin/shell/AdminShell.tsx`. As páginas de seção viram só "conteúdo" (sem header próprio).

### B2. Produtos (`app/admin/produtos/page.tsx`)
- **Lista:** cada produto com nome, preço, categoria, selo Ativo/Inativo, estoque atual. Busca (nome) + filtro Ativos/Inativos/Todos. Estados: carregando, vazio, erro com retry. Botão "+ Adicionar produto".
- **Formulário ÚNICO `ProductForm` (mode-aware)** — painel lateral (desktop) / tela cheia (celular):
  - Campos: **nome\***, **preço\***, descrição, **categoria** (combobox creatable, alimentado por `GET /products/categories`), unidade, preço de custo, **estoque inicial** (só no modo create), **foto por URL** (com `onError` → placeholder "Imagem indisponível"), **SKU/EAN** (editável no create / **read-only no edit**; se vazio no create, gera a partir do nome).
  - Diferenças create↔edit por props: valores iniciais, ação de submit (`createProduct`/`updateProduct`), estoque inicial e editabilidade do SKU. Validação **num lugar só**.
- **Desativar** (soft-delete, `is_active=false`) com confirmação; reativável. Nunca hard-delete (preserva histórico).
- **Hook `useProducts`** (listar/criar/editar/desativar) com **optimistic update** no toggle Ativo/Inativo (UI muda na hora; reverte + toast no erro).
- **Criação com estoque inicial** → grava `INVENTARIO_INICIAL` (A4).

---

## 4. Seção C — Estoque (alimentado pelo ledger)

### C1. Lista (`app/admin/estoque/page.tsx`)
- Consome `getStockSummary`: cada produto com **atual / reservado / mínimo** + **badge de status colorido** baseado em `available = current - reserved`:
  - **OK** (verde) — `available > min_stock`.
  - **Baixo** (âmbar) — `available <= min_stock` (e > 0).
  - **Esgotado** (vermelho) — `available <= 0`.
- **Por que `available` (não `current`):** evita a operadora vender no balcão um item já reservado por um carrinho do WhatsApp ("vender o que já tem dono").
- **Filtro "Precisam de atenção"** (Baixo + Esgotado). A contagem desses alimenta o **selo da aba Estoque** + o número no Início ("X produtos precisam de reposição") — estoque passa de dado passivo a tarefa ativa de reposição.

### C2. Ajuste de estoque (modal)
- Escolhe **tipo** (Compra / Perda / Devolução / Correção), `delta` (sinalizado conforme o tipo), motivo → `POST /products/:id/adjust-stock` (A1, ledger-correto).
- **Optimistic update** da linha (atual/badge mudam na hora; reverte + toast no erro).

### C3. Extrato por produto (o "extrato bancário")
- Tocar num produto abre um painel/drawer com o histórico do ledger (`GET /products/:id/stock-history`, A2), paginado, mais recentes primeiro — estilo "+50 Compra · 12/06 → saldo 50". Dá ao lojista autossuficiência de auditoria (vê a movimentação em vez de chamar suporte).

### C4. Estoque mínimo
- Editar `min_stock` por produto (`setMinStock` existente). Cruzou o piso → badge "Baixo" acende (e entra na contagem de reposição).

### C5. Hook `useStock`
- `getStockSummary`, `adjustStock` (novo contrato), `setMinStock`, `getStockHistory` — com **optimistic updates** que disfarçam a latência. O balcão não tolera spinner; o ledger garante a consistência real em segundo plano.

---

## 5. Camada de dados & padrões (cross-cutting)

- **Hooks** (`hooks/useProducts.ts`, `hooks/useStock.ts`) encapsulam o `api-client` (que já tem a maioria dos métodos; adicionar `getStockHistory`, `getCategories`, e ajustar a assinatura de `adjustStock` para o novo contrato `{tipo, delta, motivo}`).
- **Optimistic updates** padrão: muta o estado local na hora → request em background → no erro, reverte o estado e mostra toast. Garante UX instantânea sem mentir sobre consistência (o ledger é a verdade).
- **Auth/tenant:** reusa `useAuth` (token + tenant_id no `api-client`). RLS no backend já garante isolamento.
- **RBAC:** não existe (qualquer usuário do tenant faz tudo). Para o lojista dono único, **não bloqueia**; anotado como dívida (v2).

---

## 6. Testes

- **Backend (integração, banco real):** A1 (ajuste mantém invariante + grava ledger por tipo), A2 (extrato ordenado/paginado/tenant-scoped), A3 (categories DISTINCT), A4 (criação com estoque inicial grava INVENTARIO_INICIAL).
- **Frontend (vitest):** `useProducts`/`useStock` — optimistic update aplica e **reverte no erro**; `ProductForm` valida nome/preço obrigatórios e foto-URL fallback; mapeamento de badge (OK/Baixo/Esgotado) por `available`. Componentes de lista: estados carregando/vazio/erro.

---

## 7. Fora de escopo (YAGNI)

Negócio/configurações (endpoints de settings), Início rico/analytics, frontend do PDV, CRUD relacional de categorias, RBAC por papel, upload de imagem (foto fica por URL).

---

## 8. Decisões travadas

- Escopo v1: backend-completion + shell + Produtos + Estoque. Negócio e Início rico → v2.
- **A1 é correção, não feature:** adjust-stock religado ao ledger (invariante preservado).
- Categorias = coluna string `category` + DISTINCT (FK `categoria_id` dormente).
- `ProductForm` **único** (mode-aware): estoque inicial só no create; SKU read-only no edit.
- Badges por `available = current - reserved` (não por `current`).
- Optimistic updates como contrato de UX; ledger como fonte da verdade em segundo plano.
- Fatias verticais (hook + tela juntos), começando pela casca.
