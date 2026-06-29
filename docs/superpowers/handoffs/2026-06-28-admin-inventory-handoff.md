# Handoff — Feature `feat/admin-inventory` (Admin de Operação: Produtos & Estoque)

**Escrito para quem não estava aqui.** Lê isto antes de tocar na branch. Onde uma decisão custou debate, está marcado **[INVARIANTE]** — não reverta sem reabrir o spec.

**Spec:** `docs/superpowers/specs/2026-06-28-admin-inventory-design.md`
**Plano:** `docs/superpowers/plans/2026-06-28-admin-inventory.md`
**Motor de estoque (dependência, já na main):** `docs/superpowers/specs/2026-06-28-motor-de-estoque-design.md`

---

## 1. Estado atual factual

- **Branch:** `feat/admin-inventory` (criada de `main` após o merge do PDV).
- **Range:** `e0a8c0d..e50fc6b` — **26 commits**. `e0a8c0d` = merge-base com `main`; `e50fc6b` = head.
- **NÃO mergeada.** Espera a passada manual do usuário (ver §4).
- **Revisão final de branch (opus): READY AFTER FIXES** → os 4 achados foram corrigidos (scripts de smoke, `delta=0` amigável, import órfão, comentário do `getCategories`). As 4 costuras entre tasks passaram (ver §3 do veredito original no histórico; resumo: `adjustStock` morto sem órfãos; contrato 4-tipos ponta-a-ponta; provider no `layout` sem re-fetch entre rotas; migrations reversíveis/objetos distintos).
- **Verificação e2e AO VIVO (contra backend + ucm_test_motor reais): 31 PASS / 0 FAIL.** Achou e corrigiu 2 bugs que os testes mockados NÃO pegaram (ver §5).

### Resultado dos testes na última run + como re-verificar (comando exato)

| O quê | Resultado | Como rodar de novo |
|---|---|---|
| Backend integração (produtos) | **19/19 PASS** (~79s) | `cd backend && npm test -- products.integration.spec.ts` |
| Motor de estoque (regressão) | verde | `cd backend && npm test -- --runInBand stock-engine.service.integration cart.service.integration stock-sweeper.service.integration orders.integration` (2 falhas Redis pré-existentes em orders são conhecidas/alheias) |
| Frontend vitest | **167/167 PASS** (~21 arquivos) | `cd frontend && npm test` |
| Frontend build (typecheck real) | limpo, 17 rotas | `cd frontend && npm run build` (usa `next build --webpack` — ver dívida Turbopack em §5) |
| E2E ao vivo (cadeia funcional inteira) | **31/31 PASS** | subir o full-stack (§6), depois `node scripts/test/e2e-admin.mjs` |

> Os testes de integração/e2e batem no **ucm_test_motor** via túnel SSH (§6). Sem o túnel up, eles **pulam** (backend integração tem guarda `if (!app) return`) ou falham na conexão (e2e).

---

## 2. Mapa do que foi construído (T1 → T5b)

Cada task: implementer + revisão em dois estágios + fixes. Decisões não-óbvias marcadas.

### T1 — Backend: ajuste manual → ledger + A4 + migration `category` (spec §2 A1/A4; plano Task 1)
**Arquivos:** `stock-engine.service.ts` (validação sinal×tipo + 422), `products.controller.ts` (adjust-stock novo contrato), `products.service.ts` (`adjustStockLedger`; `create` transacional com estoque inicial; cache não-fatal; **removido** o `adjustStock` antigo sem-ledger), `dto/adjust-stock.dto.ts`, `dto/create-product.dto.ts` (+`category`,+`initial_stock`), `Produto.entity.ts` (+`category`), migration `1751400000000-AddCategoryToProdutos`.
**Por quê não-óbvio:** o `adjustStock` antigo fazia `UPDATE` direto em `movimentacoes_estoque` **sem** gravar ledger — bypass do invariante. Foi removido (grep confirmou zero callers). Cache invalidation virou **não-fatal** (try/catch) — um Redis-down não pode quebrar um write; isso de quebra resolveu 7 falhas Redis pré-existentes.

### T2 — Backend: extrato + categorias (spec §2 A2/A3; plano Task 2)
**Arquivos:** `products.service.ts` (`getStockHistory`, `getCategories`), `products.controller.ts` (`GET :id/stock-history`, `GET categories`).
**Por quê não-óbvio:** `@Get('categories')` **tem que** ser declarado ANTES de `@Get(':id')` no controller, senão `/products/categories` cai no handler `:id` com `id='categories'` (404 que parece bug de dado). Extrato ordena `created_at DESC, id DESC` (desempate determinístico). Payload do extrato é **whitelisted** (sem `usuario_id`/`order_id`).

### T3 — Frontend: casca + `AdminDataProvider` + auth-gate único (spec §3 B1; plano Task 3)
**Arquivos:** `app/admin/layout.tsx`, `components/admin/shell/{AdminShell,AdminNav,AdminDataProvider}.tsx`, refatorou `OrdersManager.tsx` (consome o provider, removeu auth-gate interno + `useOrders` próprio), removeu headers das páginas `/admin/*`.
**Por quê não-óbvio:** **[INVARIANTE]** o `AdminDataProvider` segura **uma** `useOrders` + (T5a) **uma** `useStock` — fonte única **no dado**, não só na função. Hooks hand-rolled não deduplicam; três `useStock()` seriam três cópias e o optimistic não propagaria pro selo. O provider mora no `layout` (persiste entre rotas no App Router) → não re-busca a cada troca de aba. Auth-gate **único** no `AdminShell` (o interno do OrdersManager foi removido — senão flash duplo de "verificando acesso"). Provider é **não-fatal**: erro de fetch deixa `children` renderizando (não derruba a casca).

### T4 — Frontend: Produtos + (backend) geração de SKU (spec §3 B2; plano Task 4)
**Arquivos:** `hooks/useProducts.ts`, `components/admin/{ProductsManager,ProductForm}.tsx`, `lib/api-client.ts` (+`getCategories`, `include_inactive`), `lib/types/product.ts`; backend `products.service.ts` (geração de SKU), migration `1751500000000-AddSkuUniqueConstraintToProdutos`.
**Por quê não-óbvio:** `ProductForm` é **único** mode-aware (validação nome/preço num lugar só); SKU **read-only no edit de verdade** (3 camadas: form não-editável, hook tira do payload, service faz `delete`). SKU gerado do nome com **backstop SAVEPOINT/23505** (ver §3). **Filtro Ativos/Inativos/Todos** exigiu `GET /products?include_inactive=true` — sem isso o `GET /products` só trazia ativos e era impossível reativar um produto (sumia da lista). Combobox de categoria casa **case-insensitive** (digitar "trufas" oferece "Trufas" existente, não cria nova).

### T5a — Frontend: Estoque read + provider ganha `useStock` (spec §4 C1/C3/C4; plano Task 5a)
**Arquivos:** `lib/stock-status.ts`, `hooks/useStock.ts`, `components/admin/StockManager.tsx`, `AdminDataProvider.tsx` (stubs → `useStock` real), `app/admin/{estoque,page}.tsx`, `lib/api-client.ts` (+`getStockHistory`).
**Por quê não-óbvio:** **[INVARIANTE]** `stock-status.ts` é a **fonte única** do status, e blinda contra chave errada do summary (`undefined → 'out'`, nunca `'ok'` silencioso). Os três consumidores (StockManager, Início, selo da aba) leem `useAdminData()` — **nenhum** chama `useStock()` direto. **Fix:** o `ExtratoDrawer` usava `useState(()=>)` (cleanup virava estado) → trocado por `useEffect` (fantasma no remount).

### T5b — Frontend: Estoque mutações (spec §4 C2/C5; plano Task 5b)
**Arquivos:** `hooks/useStock.ts` (+`adjust`/`setMin` optimistic), `components/admin/StockManager.tsx` (modal de ajuste modo-contagem + min inline), `lib/api-client.ts` (adjustStock `{tipo,delta,motivo}` + `request<T>` preserva `body.code`).
**Por quê não-óbvio:** **[INVARIANTE]** Correção em **modo-contagem** — a UI pede o *valor contado* e calcula `delta = contado − atual` (a UI manda o delta, NÃO o alvo). Optimistic é **fiel**: muda `current` no estado do provider, recomputa `available = current − reserved` (reserved inalterado), badge via `stock-status.ts` → propaga pro selo/Início no mesmo ciclo; reverte junto no erro. Provado por teste **gold-standard** (`AdminDataProvider.propagation.test.tsx` monta provider+nav+manager e vê o badge da aba ir "1"→"2" e reverter).

---

## 3. Invariantes do projeto (NÃO desfazer sem reabrir o spec)

Cada um custou debate. Se a próxima sessão "simplificar" qualquer um, quebra algo real.

1. **Validação sinal×tipo vive DENTRO de `recordManualMovement` (chokepoint), não no DTO.** [spec §2 A1] — Se for só no DTO, a regra de `INVENTARIO_INICIAL > 0` nasce morta (esse tipo nunca chega pelo endpoint; o A4 o injeta interno). No método, cobre endpoint + criação + callers futuros de uma vez.
2. **A4 sem contagem-dobrada:** produto nasce `current_stock = 0`; o movimento `INVENTARIO_INICIAL` **traz** ao valor inicial. [spec §2 A4] — Setar `current=inicial` E gravar `+inicial` daria `2×inicial`. O movimento é a ÚNICA coisa que move o saldo.
3. **`INVENTARIO_INICIAL` barrado no wire, aceito pelo método.** [spec §2 A4] — O `AdjustStockDto` expõe só 4 tipos manuais (COMPRA/PERDA/DEVOLUCAO/AJUSTE); `recordManualMovement.tipo` aceita todos os `LedgerTipo`. Tem teste negativo (`INVENTARIO_INICIAL` no endpoint → 400). Não alargue o DTO.
4. **Badges por `available = current − reserved`, via `stock-status.ts` como fonte única NO DADO (via `AdminDataProvider`).** [spec §4 C1; plano T3/T5a] — `current` puro venderia item já reservado no WhatsApp. E a fonte única tem que ser de **dado** (uma instância no provider), não três `useStock()` — senão o optimistic não propaga pro selo/Início.
5. **Modo-contagem na Correção: a UI manda `delta`, não o alvo.** [spec §4 C2] — Contagem física é absoluta; o form é relativo. A UI calcula `delta = contado − atual`. Se alguém fizer a UI mandar o valor contado como delta, "contou 47, sistema tinha 50" vira `+47 → saldo 97`.
6. **`422 INSUFFICIENT_STOCK` tipado depende do `request<T>` preservar `body.code` E do `HttpExceptionFilter` preservar `code`.** [spec §2 A1; commit `e50fc6b`] — O frontend mapeia `code === 'INSUFFICIENT_STOCK'` → "Estoque insuficiente para esta saída". Se o filtro global descartar `code` (era o caso — corrigido no `e50fc6b`), o contrato quebra no wire. **Não remova o `...(code && { code })` do filtro.**
7. **SKU é INTERNO, gerado do nome com backstop SAVEPOINT/23505 — NÃO é EAN.** [spec §3 B2] — Geração via slug + `SAVEPOINT`/`ROLLBACK TO SAVEPOINT` por tentativa + catch do `23505` no índice `[tenant_id, sku]` (a transação externa é do interceptor; um 23505 cru abortaria tudo). NÃO gerar EAN do nome (barcode inválido). EAN real é digitado.

---

## 4. Pendente e por quê

- **Passada manual do usuário: AINDA NÃO FEITA.** O usuário precisa clicar o full-stack (§6) e confirmar a experiência renderizada (o que testes não alcançam). Roteiro dos 5 passos: (1) criar produto c/ estoque inicial → ver `INVENTARIO_INICIAL` no extrato; (2) ajustar no balcão, incl. **Correção modo-contagem** (ver o delta calculado) e uma saída que estoura → "Estoque insuficiente"; (3) extrato batendo; (4) **selo da aba + número do Início mexendo junto** com o ajuste; (5) **abrir o drawer do extrato, fechar e REABRIR** — confirmar que o `useEffect` (ex-`useState(()=>)`) não deixou fantasma no remount.
- **Merge na `main`: espera o sinal do usuário** depois da passada. NÃO mergear antes.
- **Deploy unificado (motor + PDV + Admin): sessão FUTURA separada.** Não misturar com o merge. Perfil de risco diferente (produção, a mãe do Gustavo operando em cima) — merece o mesmo tratamento spec→plano→revisão, não um "vamos subir". Exige a faxina de infra (2 repos no servidor, ver memória `server-infra-debt`) + rodar as migrations novas no banco de prod.

---

## 5. Armadilhas conhecidas / dívida registrada

- **Redis não-fatal (intencional):** o backend sobe e opera sem Redis (cache desabilitado, warns no log). Trade-off conhecido: após um write, cache stale é possível até expirar — aceitável (o banco é a verdade). NÃO "consertar" tornando o cache fatal.
- **Extrato usa OFFSET:** paginação por OFFSET num ledger append-only — aceitável v1; sob escrita concorrente intensa pode repetir/pular linha. Migrar p/ keyset/cursor só se virar problema (improvável p/ uma loja). [spec §2 A2]
- **RBAC inexistente:** qualquer usuário do tenant faz tudo. Aceitável p/ dono único; v2. [spec §5]
- **`usuario_id` fora do payload do extrato (v1):** decisão consciente (dono único). Reincluir quando houver multi-operador. [spec §2 A2]
- **Turbopack mordeu antes:** `next build` usa `--webpack` de propósito (Turbopack já pulou rotas no build). Se algo estranho no dev/build, suspeite do Turbopack e troque pra webpack. [dívida pré-existente, ver `deploy-frontend-gotchas`]
- **Estoque-atual omitido na lista de Produtos (v1):** o `GET /products` não traz `current_stock`; a tela de Produtos não mostra estoque (isso é a tela de Estoque). Decisão v1, não regressão.
- **2 bugs achados no e2e ao vivo (corrigidos no `e50fc6b`):** (a) CORS não permitia `Cache-Control` (o frontend manda esse header; preflight falhava cross-origin — mascarado em prod same-origin); (b) o `HttpExceptionFilter` global descartava `code` das exceções tipadas (o 422 chegava sem `code`). **Lição:** os testes jest de integração NÃO aplicam o filtro global do `main.ts`, então não pegaram (b). Um e2e ao vivo (ou a passada humana) pega o que mock não pega.

---

## 6. Como rodar localmente (full-stack) — pra reerguer sem redescobrir

**Banco de teste:** `ucm_test_motor` dentro do container `ucm-postgres-test` no servidor (`ubuntu@gtsofthub.com.br`). Acesso via **túnel SSH** (ver memória `test-db-setup-motor` — ARMADILHA: o banner SSH "GT SOFT HUB" contamina o STDOUT ao pegar a senha; extrair com sentinelas).
1. **Túnel** (background): `ssh -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -N -L 5544:172.22.0.2:5432 ubuntu@gtsofthub.com.br` (IP do container: confirmar com `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ucm-postgres-test`).
2. **`backend/.env`** (gitignored): `DATABASE_URL=postgres://postgres:<senha-url-encoded>@localhost:5544/ucm_test_motor`, `NODE_ENV=test`, `PORT=3001`, `JWT_SECRET`/`JWT_REFRESH_SECRET` (qualquer valor de teste), `JWT_EXPIRATION=15m`, `PAYMENT_PROVIDER=mock`, `WHATSAPP_PROVIDER=mock`, `OPENAI_ALLOW_NO_KEY=true`, **`ENCRYPTION_KEY=<64 hex>`** (32+ chars — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; SEM isso o boot falha).
3. **Backend:** `cd backend && npm run start:dev` → `http://localhost:3001/api/v1`. Redis não conecta (não-fatal, sobe assim mesmo).
4. **`frontend/.env.local`** (gitignored): `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1` + `NEXT_PUBLIC_TENANT_ID=00000000-0000-0000-0000-000000000000`.
5. **Frontend:** `cd frontend && npm run dev` → `http://localhost:3000`.
6. **Login:** abrir `http://localhost:3000/login` → **email `admin@exemplo.com` / senha `admin123` / workspace** `00000000-0000-0000-0000-000000000000` (tenant "Loja de Exemplo"). *(A senha `admin123` foi setada nesse usuário no `ucm_test_motor`; se sumir, re-hash com bcryptjs e UPDATE em `usuarios`. O tenant tem ~422 produtos de teste — telas populadas.)*
7. **Smoke e2e:** com o full-stack up, `node scripts/test/e2e-admin.mjs` → 31/31 (login + criar + extrato + ajustes + 422 + categorias + mínimo + inativos).

**Detalhe que custou:** o login manda o `tenant` no **header `x-tenant-id`**, NÃO no body (body = `{email,password}`). E o CORS em dev (`NODE_ENV !== production`) já permite `localhost:3000/3001` + agora `Cache-Control` (commit `e50fc6b`).
