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
- **Validação sinal×tipo (server-side, OBRIGATÓRIA) — DENTRO do `recordManualMovement`, não (só) no DTO/controller.** Sem isso, `{tipo:'COMPRA', delta:-10}` passaria e o ledger mentiria (auditoria corrompida, mesmo com o invariante intacto). **Por que no `recordManualMovement` (chokepoint único):** a regra de `INVENTARIO_INICIAL` é inalcançável por uma validação só-de-DTO — esse tipo **nunca chega pelo endpoint** (o A4 o injeta internamente). Validando no método, a regra cobre de uma vez o endpoint A1, o A4 e qualquer caller interno futuro. Regras:
  - `COMPRA`, `DEVOLUCAO`, `INVENTARIO_INICIAL` → `delta > 0`.
  - `PERDA` → `delta < 0`.
  - `AJUSTE` → `delta ≠ 0` (qualquer sinal).
  - Sinal incoerente com o tipo → `400 BadRequest`. (O DTO do endpoint ainda faz a validação de forma/enum dos 4 tipos manuais; a regra semântica sinal×tipo é do método.)
- **Direção de `DEVOLUCAO` (decidido):** devolução de **cliente** = entra no estoque (`delta > 0`). Devolução a fornecedor (saída) **não** é coberta na v1 (seria `PERDA` ou tipo futuro).
- **Erro de estoque insuficiente tipado:** quando o guard `current_stock + delta < 0` rejeita (PERDA/AJUSTE negativo maior que o saldo), responder **`422` com código `INSUFFICIENT_STOCK`** (não erro genérico), para o hook frontend exibir "Estoque insuficiente para esta saída".
- O endpoint **deixa de chamar** o `adjustStock` antigo (AuditLog); o método antigo é **removido** se não houver outros consumidores (verificar na implementação — o grep atual mostra que só o controller o chamava). Invalida o cache de produtos como hoje.
- **Resultado:** todo ajuste manual vira movimentação auditável e coerente; o invariante sobrevive.

### A2. Endpoint de extrato (leitura do ledger)
```
GET /products/:id/stock-history?limit=50&offset=0
→ { items: [{ tipo, delta, saldo_resultante, motivo, created_at }], total }
```
- `movimentacoes_estoque_historico` do produto, escopado por tenant, paginado (`LIMIT/OFFSET`).
- **Ordenação determinística:** `ORDER BY created_at DESC, id DESC`. O desempate por `id` evita que linhas com o mesmo timestamp embaralhem entre páginas. `OFFSET` sobre um ledger append-only é aceitável na v1 (registro o caveat: sob escrita concorrente intensa, paginação por OFFSET pode repetir/pular; migrar para keyset/cursor se virar problema — improvável para o volume de uma loja).
- `usuario_id` **fora** do payload do extrato na v1 (loja de dono único — decisão consciente; reincluir quando houver multi-operador).
- Fonte do "extrato bancário" na tela de Estoque.

### A3. Categorias simplificadas
- **Migration:** coluna nullable `category` (varchar) no `Produto`. O `categoria_id` FK fica **dormente**.
- `GET /products/categories` → `DISTINCT category` (não-nulo, ordenado), escopado por tenant.
- DTOs de criar/editar produto aceitam `category?: string`. **Normalização no write:** `trim()` (e colapsar espaços internos); string vazia após trim → `null`. Evita fragmentação do DISTINCT por espaços ("Trufas" vs "Trufas "). Mantém o case digitado para exibição (sem forçar lowercase na v1).

### A4. Estoque inicial ledger-correto na criação de produto
Ao criar um produto **com estoque inicial > 0**, gravar um movimento `INVENTARIO_INICIAL` no ledger (via `recordManualMovement`) na mesma transação da criação — mantendo o invariante desde o nascimento do produto.
- **Anti-contagem-dobrada (CRÍTICO):** criar a linha de saldo com `current_stock = 0` e deixar o `recordManualMovement(INVENTARIO_INICIAL, +inicial)` **trazer** o saldo ao valor inicial. **Nunca** setar `current_stock = inicial` E gravar o movimento `+inicial` (resultaria em `2×inicial`). O movimento é a única fonte que move o saldo.
- **Enum mais largo no método:** o parâmetro `tipo` de `recordManualMovement` aceita **todos** os `LedgerTipo` (incl. `INVENTARIO_INICIAL`), embora o DTO do endpoint A1 exponha só os 4 manuais (COMPRA/PERDA/DEVOLUCAO/AJUSTE). `INVENTARIO_INICIAL` é uso interno (criação de produto), não exposto no endpoint. Confirmar essa separação na implementação.

**Testes (integração, banco real):** ajuste manual mantém o invariante; extrato retorna na ordem e paginação corretas; `categories` faz DISTINCT por tenant; criação com estoque inicial grava `INVENTARIO_INICIAL`.

---

## 3. Seção B — Casca do admin & Produtos

### B1. Casca (`app/admin/layout.tsx`)
- **Auth-gate único** no layout (não logado → `/login?redirect=...`; carregando → estado limpo). Centraliza a proteção das telas `/admin/*`.
- **Navegação responsiva:**
  - **Desktop (≥1024px):** menu lateral fixo (~240px): logo, itens, rodapé com loja + usuário + Sair.
  - **Celular:** barra de abas inferior (padrão Instagram/WhatsApp), **4 abas:** Início · Pedidos · Produtos · Estoque. Avatar no topo com usuário + Sair (Negócio entra aqui na v2). Item ativo no acento `#b8654a`.
  - **Selo de contagem** em "Pedidos" (pedidos novos/pendentes) e em "Estoque" (produtos em reposição — ver C1).
  - **Fonte dos selos:** o de **Estoque** vem da fonte única de status (C1). O de **Pedidos** na v1 **deriva do `getOrders` já carregado** (filtrar status novos/pendentes no cliente) — sem endpoint novo. *Verificar na implementação se `getOrders` retorna o conjunto suficiente (se for paginado, a contagem pode subestimar); um endpoint de contagem dedicado (`GET /orders/stats` ou similar) fica como otimização v2. Confirmar se já existe um stats de pedidos antes de assumir.*
- **Início (hub simples v1):** cards de navegação + 2-3 números reais (pedidos novos/pendentes via a mesma fonte do selo de Pedidos; "X produtos precisam de reposição" via a fonte única do Estoque). Não é dashboard rico nem traz métrica que exija endpoint novo.
- **Tokens visuais atuais:** `#f6f3ee` (fundo), `#1a1814` (escuro), `#b8654a` (acento), serif display. Coerência com login/pedidos no ar.

**Arquivos:** `app/admin/layout.tsx`, `components/admin/shell/AdminNav.tsx` (lateral+barra), `components/admin/shell/AdminShell.tsx`. As páginas de seção viram só "conteúdo" (sem header próprio).

### B2. Produtos (`app/admin/produtos/page.tsx`)
- **Lista:** cada produto com nome, preço, categoria, selo Ativo/Inativo, estoque atual. Busca (nome) + filtro Ativos/Inativos/Todos. Estados: carregando, vazio, erro com retry. Botão "+ Adicionar produto".
- **Formulário ÚNICO `ProductForm` (mode-aware)** — painel lateral (desktop) / tela cheia (celular):
  - Campos: **nome\***, **preço\***, descrição, **categoria** (combobox creatable, alimentado por `GET /products/categories`; **match case-insensitive:** digitar "tru" surfa "Trufas" para a operadora **escolher** em vez de criar "trufas" — mitiga a fragmentação por case sem forçar lowercase no storage; o case digitado é preservado, só o match ignora caixa), unidade, preço de custo, **estoque inicial** (só no modo create), **foto por URL** (com `onError` → placeholder "Imagem indisponível"), **SKU** (editável no create / **read-only no edit**).
  - **SKU é INTERNO (não EAN):** se vazio no create, **gerar** a partir do nome (slug) **com uniquificação** — se colidir com o `sku` único do tenant (dois "Coca-Cola"), anexar sufixo (`-2`, `-3`…). **Backstop:** a unicidade real é garantida pela **constraint única do banco** (`[tenant_id, sku]`), não só por um `SELECT` prévio — tratar violação de unicidade no insert (retry com próximo sufixo) para ser à prova de corrida. **Não** gerar EAN/código de barras a partir do nome (produziria barcode inválido). Se o lojista quiser um **EAN real escaneável**, ele digita manualmente (armazenado como o `sku` ou, futuramente, num campo `barcode` próprio — fora do escopo v1). A geração automática vale só para SKU interno.
  - Diferenças create↔edit por props: valores iniciais, ação de submit (`createProduct`/`updateProduct`), estoque inicial e editabilidade do SKU. Validação **num lugar só**.
- **Desativar** (soft-delete, `is_active=false`) com confirmação; reativável. Nunca hard-delete (preserva histórico).
- **Hook `useProducts`** (listar/criar/editar/desativar) com **optimistic update** no toggle Ativo/Inativo (UI muda na hora; reverte + toast no erro).
- **Criação com estoque inicial** → grava `INVENTARIO_INICIAL` (A4).

---

## 4. Seção C — Estoque (alimentado pelo ledger)

### C1. Lista (`app/admin/estoque/page.tsx`)
- Consome `getStockSummary` — **confirmado (verify):** o método já retorna por produto `current_stock, reserved_stock, available_stock, min_stock` **e** um `status ('ok'|'low'|'out')` pré-computado, além de `low_stock_count`/`out_of_stock_count` agregados. **Sem gap de backend** para os badges/C4. A função pura `lib/stock-status.ts` pode reusar o `status` do servidor ou recomputar de `available`/`min` — desde que seja a **fonte única** (C1). Cada produto com **atual / reservado / mínimo** + **badge de status colorido** baseado em `available = current - reserved`:
  - **OK** (verde) — `available > min_stock`.
  - **Baixo** (âmbar) — `available <= min_stock` (e > 0).
  - **Esgotado** (vermelho) — `available <= 0`.
- **Por que `available` (não `current`):** evita a operadora vender no balcão um item já reservado por um carrinho do WhatsApp ("vender o que já tem dono").
- **Filtro "Precisam de atenção"** (Baixo + Esgotado). **Fonte única:** o cálculo de status (OK/Baixo/Esgotado) vive numa função pura derivada do `getStockSummary` (ex.: `lib/stock-status.ts`), e os **três consumidores** — o filtro C1, o **selo da aba Estoque** e o número no Início ("X produtos precisam de reposição") — leem dessa mesma fonte. Nunca recalcular em três lugares (divergiriam). Estoque passa de dado passivo a tarefa ativa de reposição.

### C2. Ajuste de estoque (modal)
- Escolhe **tipo** (rótulo na UI → enum): **Compra**→`COMPRA`, **Perda**→`PERDA`, **Devolução**→`DEVOLUCAO`, **Correção**→`AJUSTE` (mapeamento explícito; "Correção" **não** é valor literal do enum). A UI aplica o sinal conforme o tipo e o backend revalida (A1). `motivo` opcional → `POST /products/:id/adjust-stock`.
- **Foot-gun da Correção — modo contagem (decisão de UI):** contagem física é **absoluta**; um form de `delta` é **relativo**. Cenário: a operadora conta a prateleira (47), o sistema diz 50, ela quer "deixar em 47" — se digitar `47` num campo de delta, o sistema somaria 47 → 97. Por isso, **a UI de Correção pede o valor CONTADO (alvo)** e **calcula o delta = alvo − atual** (aqui: −3) antes de enviar. O wire continua `delta` sinalizado (backend inalterado); só muda **onde** o delta é computado. Compra/Perda/Devolução seguem em modo quantidade (a UI aplica o sinal do tipo).
- **Optimistic update** da linha (atual/badge mudam na hora). No erro: **reverte** o estado e mostra toast; se for `422 INSUFFICIENT_STOCK` (A1), a mensagem é específica — "Estoque insuficiente para esta saída" — não genérica.
  - **Badge otimista fiel:** o ajuste manual mexe em `current`, **não** em `reserved`. O update otimista recalcula o badge pela **mesma** função pura (`lib/stock-status.ts`) passando o `current` novo + o `reserved` **inalterado** — senão o badge otimista diverge da verdade.

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

- **Backend (integração, banco real):** A1 — ajuste mantém invariante + grava ledger; **rejeita sinal incoerente** (`{COMPRA, delta<0}` → 400; `{PERDA, delta>0}` → 400); **PERDA/AJUSTE que zeraria abaixo de 0 → 422 `INSUFFICIENT_STOCK`**. A2 — extrato ordenado `created_at DESC, id DESC`, paginado, tenant-scoped. A3 — `categories` DISTINCT por tenant; categoria com espaços é normalizada (trim). A4 — criação com estoque inicial grava **uma** linha `INVENTARIO_INICIAL` e `current_stock == inicial` (não `2×`). **Fronteira do DTO (teste negativo):** `POST /adjust-stock` com `tipo:'INVENTARIO_INICIAL'` no wire é **rejeitado** (400) — só os 4 tipos manuais passam pelo endpoint; `INVENTARIO_INICIAL` é uso interno (trava contra alguém alargar o DTO depois).
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
- **Validação sinal×tipo server-side** (COMPRA/DEVOLUCAO/INVENTARIO_INICIAL>0, PERDA<0, AJUSTE≠0); `DEVOLUCAO` = devolução de cliente (entra, +).
- **`INSUFFICIENT_STOCK` (422)** tipado para saída maior que o saldo → mensagem específica no hook.
- **A4 sem contagem-dobrada:** produto nasce `current_stock=0`; o movimento `INVENTARIO_INICIAL` traz ao valor inicial.
- `recordManualMovement.tipo` aceita todos os `LedgerTipo`; o endpoint A1 expõe só os 4 manuais.
- Extrato: `ORDER BY created_at DESC, id DESC`; OFFSET aceitável v1 (caveat); `usuario_id` fora do payload v1.
- SKU **interno** (gera+uniquifica do nome se vazio); **não** gerar EAN; EAN real é digitado.
- Categoria normalizada no write (trim; vazio→null).
- "Correção" (UI) → `AJUSTE` (enum).
- Selo de Pedidos: deriva de `getOrders` na v1 (endpoint de contagem = v2; confirmar stats existente).
