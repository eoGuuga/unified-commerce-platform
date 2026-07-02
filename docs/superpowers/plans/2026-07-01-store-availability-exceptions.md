# Disponibilidade da Loja (Camada 2) — Plano de Implementação

> **Para executores agênticos:** SUB-SKILL: superpowers:subagent-driven-development — task-a-task, review entre elas. Steps em checkbox (`- [ ]`).

**Goal:** O lojista marca exceções pontuais por-data (`closed` / `custom_hours`) e o bot honra na oferta de retirada — via tabela nova `store_availability_exceptions` (RLS) + módulo CRUD (admin), gate único e puro em `generatePickupSlots`, mensagem "fechado hoje" que não mente, backstop consultando exceções, e uma 4ª seção na config.

**Arquitetura:** NestJS + TypeORM + Postgres (RLS). Novo módulo `availability` (espelha `products`). O `WhatsappModule` importa `AvailabilityService` (gate) — sem ciclo. Frontend: 4ª seção no `ConfiguracoesManager` + hook novo.

**Tech Stack:** Jest (integração via túnel SSH ao `ucm_test_motor` em `localhost:5544`), Vitest (frontend).

Spec: `docs/superpowers/specs/2026-07-01-store-availability-exceptions-design.md` (APROVADO).

## Global Constraints (todas as tasks)
- **Multi-tenant:** escopo SEMPRE por `user.tenant_id` do JWT (nunca body); **RLS** reforça no banco. Escrita = **`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN)`** (reusa o da frente de config).
- **`date` = data civil no fuso da loja** (`settings.business_hours.tz`, default `America/Sao_Paulo`) — nunca UTC. "hoje"/`date >= hoje` no fuso da loja.
- **Decisões (spec §12):** R1 **upsert** por `(tenant_id,date)`; R2 **sem PATCH** (add/remove); R3 fuso da loja; R4 `POST` **rejeita passado**.
- **Gate PURO:** `generatePickupSlots` recebe as exceções por **parâmetro** (Map), sem I/O dentro da função. Fuso/DST intactos.
- **Mensagem não mente:** "fechado hoje" só quando a causa REAL é a exceção `closed` de hoje (3 casos distintos — §10 do spec).
- **Camada 1 intacta:** NÃO tocar `settings.business_hours` recorrente; a exceção mora só na tabela nova, combinada na leitura.
- **FORA:** calendário visual (upgrade futuro), pedido órfão, edição/PATCH, recorrência de exceção, múltiplas janelas por data.
- Commits: Conventional Commits em inglês + trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Branch `feat/store-availability`. Sem merge/push até revisão do dono.
- **Nota test-DB:** ignore falhas pré-existentes de duplicate-SKU em criação de pedido (dívida do `ucm_test_motor`).

## File Structure
- **Backend:** `database/migrations/1751800000000-AddStoreAvailabilityExceptions.ts` (novo); `database/entities/StoreAvailabilityException.entity.ts` (novo, + registrar em `config/database.config.ts` E `database/data-source.ts`); `modules/availability/` (`availability.module.ts`, `availability.controller.ts`, `availability.service.ts`, `dto/create-store-exception.dto.ts`); `whatsapp.service.ts` (gate ~L1372, mensagem ~L980, backstop ~L1508) + `whatsapp.module.ts` (importa AvailabilityModule).
- **Frontend:** `lib/api-client.ts` (+métodos), `hooks/useAvailabilityExceptions.ts` (novo), `components/admin/ConfiguracoesManager.tsx` (4ª seção) + tipos em `lib/types/`.

## Ordem das tasks (backend antes do frontend)
- T1 — Migration RLS idempotente + entity + enum.
- T2 — Módulo CRUD (service/dto/controller) + **testes de segurança explícitos** (guard admin 403 + cross-tenant).
- T3 — Gate em `generatePickupSlots` (puro).
- T4 — Mensagem "fechado hoje" (3 casos rigorosos).
- T5 — Backstop `isWithinBusinessHours` consulta exceções.
- T6 — Frontend: api-client + hook `useAvailabilityExceptions`.
- T7 — Frontend: 4ª seção "Exceções / Feriados" no ConfiguracoesManager.

---

### Task 1 — Migration RLS idempotente + entity

**Files:** Create `database/migrations/1751800000000-AddStoreAvailabilityExceptions.ts`, `database/entities/StoreAvailabilityException.entity.ts`; Modify `config/database.config.ts` + `database/data-source.ts` (registrar a entity nos DOIS — footgun conhecido). Test: `modules/availability/availability.migration.integration.spec.ts` (smoke da tabela).

**Interfaces — Produz:** entity `StoreAvailabilityException { id, tenant_id, date, kind: 'closed'|'custom_hours', open: string|null, close: string|null, created_at }`.

- [ ] **Step 1 — Escrever o teste smoke (falha: tabela não existe):** integração que, sob contexto de tenant (`set_config app.current_tenant_id`), (a) insere `closed` (open/close null) → OK; (b) insere `closed` com `open` preenchido → **CHECK rejeita**; (c) insere `custom_hours` com `open` null → **CHECK rejeita**; (d) insere 2× a mesma `(tenant_id,date)` → **UNIQUE rejeita**.
- [ ] **Step 2 — Rodar e ver falhar** (tabela ausente): `npx jest --testPathPattern="availability.migration" --runInBand`.
- [ ] **Step 3 — Implementar** a migration (idempotente): `up` = `CREATE TYPE store_exception_kind` (via `DO $$ IF NOT EXISTS pg_type`), `CREATE TABLE IF NOT EXISTS` (com `uuid_generate_v4()`, `date`, enum, `time NULL`, `timestamptz DEFAULT now()`, `UNIQUE(tenant_id,date)`, `CHECK`), `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY store_availability_exceptions_tenant_isolation` (via `DO $$ IF NOT EXISTS pg_policies` — molde `009-rls-force-*.sql`). `down` = drop policy/table/type. Criar a entity + registrar nos 2 lugares.
- [ ] **Step 4 — Rodar a migration no test-DB + o smoke:** `npm run migration:run` (ou o data-source do CLI) contra o `ucm_test_motor` (túnel) → depois `npx jest --testPathPattern="availability.migration" --runInBand` verde. `tsc --noEmit` limpo.
- [ ] **Step 5 — Commit:** `feat(availability): store_availability_exceptions table (RLS) + entity`

---

### Task 2 — Módulo CRUD + testes de segurança (guard admin + cross-tenant)

**Files:** Create `modules/availability/{availability.module.ts,availability.controller.ts,availability.service.ts,dto/create-store-exception.dto.ts}`; registrar o módulo no `AppModule`. Test: `modules/availability/availability.integration.spec.ts` (reusa o harness de auth do `tenants.integration.spec.ts` — seed de tenant/JWT com UUID **v4 estrito**).

**Interfaces — Produz (para T3/T4/T5):** `AvailabilityService.findByDateRange(tenantId, from: Date, to: Date): Promise<StoreAvailabilityException[]>`.

**Service:** `findFuture(tenantId)` (`date >= hoje` no fuso da loja, ordenado); `findByDateRange(tenantId, from, to)`; `create(tenantId, dto)` (`INSERT ... ON CONFLICT (tenant_id,date) DO UPDATE` = **upsert R1**); `remove(tenantId, id)`; `closeToday(tenantId)` (upsert `closed` para hoje-fuso-loja). **"hoje"/fuso:** resolver via `settings.business_hours.tz` do tenant (default `America/Sao_Paulo`).
**DTO** `CreateStoreExceptionDto`: `date` (ISO `YYYY-MM-DD`, **não-passado** = R4), `kind` (`@IsEnum`), `open`/`close` (`HH:MM`; obrigatórios se `custom_hours`, proibidos se `closed` — validação cruzada).
**Controller** (todos `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(ADMIN)`, `tenantId = user.tenant_id`): `GET /availability-exceptions`, `POST`, `DELETE /:id`, `POST /close-today`.

- [ ] **Step 1 — TESTES DE SEGURANÇA (explícitos) que falham:**
  - **Guard admin:** usuário autenticado **não-admin** (SELLER) → `POST`/`DELETE`/`close-today` retornam **403**; **admin** → 200/201.
  - **Cross-tenant:** admin de A cria exceção; admin de B **não a vê** no `GET` e **não consegue** `DELETE` a exceção de A (404/escopo) — provando RLS + escopo por JWT.
- [ ] **Step 2 — Testes de comportamento que falham:** criar (`closed` e `custom_hours`); `GET` lista só **futuras** (semear passada+futura → só a futura aparece); `remove`; **upsert R1** (criar 2× a mesma data → a 2ª sobrescreve, não duplica nem 500); **R4** (`POST` com `date` no passado → 400); `close-today` cria `closed` para hoje; DTO rejeita `custom_hours` sem open/close.
- [ ] **Step 3 — Rodar e ver falhar** (módulo/rotas inexistentes): `npx jest --testPathPattern="availability.integration" --runInBand`.
- [ ] **Step 4 — Implementar** service+dto+controller+module (+ registrar no AppModule).
- [ ] **Step 5 — Rodar VERDE** + regressão (tenants/auth não regridem): `npx jest --testPathPattern="availability|tenants" --runInBand`. `tsc --noEmit` limpo.
- [ ] **Step 6 — Commit:** `feat(availability): CRUD module (list/create/remove/close-today) + admin guard + cross-tenant tests`

---

### Task 3 — Gate em `generatePickupSlots` (puro)

**Files:** Modify `whatsapp.service.ts` (`generatePickupSlots` L1372 + o caller ~L979), `whatsapp.module.ts` (importa `AvailabilityModule`). Test: `whatsapp-pickup.spec.ts` (casos novos).

**Interfaces — Consome:** `AvailabilityService.findByDateRange`. **Produz:** `generatePickupSlots(businessHours, now, opts?, exceptions?: Map<string, ExcLite>)` — `exceptions` chave `"YYYY-MM-DD"` (fuso da loja).

- [ ] **Step 1 — Testes que falham:** (a) exceção `closed` na data D → `generatePickupSlots` **não gera slot** em D (outros dias normais); (b) exceção `custom_hours` (ex.: 09:00–13:00) numa data cujo recorrente é 09:00–18:00 → slots **só até 13h** naquela data; (c) exceção numa data **não afeta** as outras datas (recorrente intacto nelas). *(Testar a função pura passando a Map diretamente — sem I/O.)*
- [ ] **Step 2 — Rodar e ver falhar** (4º parâmetro/lógica inexistentes).
- [ ] **Step 3 — Implementar:** 4º parâmetro `exceptions`; encaixe entre L1400-L1404 (`closed`→`continue`; `custom_hours`→`dh` da exceção; senão recorrente). O **caller** (~L979) carrega via `availabilityService.findByDateRange(tenantId, now, now+lookahead)` e monta a Map. `WhatsappModule` importa `AvailabilityModule`.
- [ ] **Step 4 — Rodar VERDE** + regressão `whatsapp-pickup`/`business-hours`.
- [ ] **Step 5 — Commit:** `feat(availability): pickup gate honors per-date exceptions (pure)`

---

### Task 4 — Mensagem "fechado hoje" (3 casos rigorosos)

**Files:** Modify `whatsapp.service.ts` (o caller do estágio pickup que trata lista-vazia, ~L942/L969/L980). Test: `whatsapp-pickup.spec.ts` (ou o spec de checkout-collection).

- [ ] **Step 1 — Testes que falham (a distinção RIGOROSA — a mensagem não pode mentir):**
  - **(a)** hoje com exceção `closed` + lista vazia → resposta contém **"Hoje a loja está fechada"** (a mensagem nova).
  - **(b)** loja **sem `business_hours`** → resposta é a de "só entregas / sem horário" existente, **NÃO** "fechado hoje".
  - **(c)** loja com horário hoje mas **fora do horário agora** (lista vazia, sem exceção) → resposta "sem horários em breve", **NÃO** "fechado hoje".
  - `custom_hours` hoje (reduzido, com slots) → **sem** mensagem especial (oferece os slots).
- [ ] **Step 2 — Rodar e ver falhar** (mensagem/sinal inexistentes).
- [ ] **Step 3 — Implementar:** no ponto de lista-vazia, checar `exceptions.get(hojeKey)?.kind === 'closed'` (hoje = data civil atual no fuso da loja, `dayOffset===0`) → mensagem "Hoje a loja está fechada 🙏 Volte em breve!"; senão manter as mensagens existentes por causa. NÃO disparar pra `custom_hours` nem pras outras causas.
- [ ] **Step 4 — Rodar VERDE** (os 3 casos + custom_hours) + regressão.
- [ ] **Step 5 — Commit:** `feat(availability): reason-aware 'closed today' message (3-case distinction)`

---

### Task 5 — Backstop `isWithinBusinessHours` consulta exceções

**Files:** Modify `whatsapp.service.ts` (`isWithinBusinessHours` ~L1508 + o backstop de `selecting_pickup_slot` ~L1040). Test: `whatsapp-pickup.spec.ts`.

- [ ] **Step 1 — Testes que falham:** (a) `isWithinBusinessHours` para um slot numa data com exceção `closed` → **false** (recusa); (b) numa data com `custom_hours` → valida contra o `open/close` da exceção (aceita dentro, recusa fora); (c) sem exceção → comportamento atual (recorrente).
- [ ] **Step 2 — Rodar e ver falhar.**
- [ ] **Step 3 — Implementar:** `isWithinBusinessHours` recebe a exceção da data (ou a Map) por parâmetro (puro); `closed`→false; `custom_hours`→valida contra a exceção; senão recorrente. O backstop L1040 passa a exceção/Map.
- [ ] **Step 4 — Rodar VERDE** + regressão.
- [ ] **Step 5 — Commit:** `feat(availability): pickup backstop also rejects/adjusts by exception`

---

### Task 6 — Frontend: api-client + hook `useAvailabilityExceptions`

**Files:** Create `hooks/useAvailabilityExceptions.ts`, tipos em `lib/types/store-exception.ts`; Modify `lib/api-client.ts`. Test: `hooks/useAvailabilityExceptions.test.ts`.

**Interfaces — Produz:** `useAvailabilityExceptions()` → `{ exceptions, loading, error, add(dto), remove(id), closeToday(), refetch }` (optimistic + rollback, padrão `useTenantSettings`).

- [ ] **Step 1 — Testes que falham** (mock do api-client): fetch on mount popula; `add` otimista → chama `createException` → rollback no erro; `remove` otimista → rollback no erro; `closeToday` chama o endpoint e refaz a lista.
- [ ] **Step 2 — Rodar e ver falhar.**
- [ ] **Step 3 — Implementar:** métodos no api-client (`listExceptions`/`createException`/`removeException`/`closeToday`) + o hook + tipos.
- [ ] **Step 4 — Rodar VERDE** + suíte frontend inteira (sem regressão).
- [ ] **Step 5 — Commit:** `feat(availability): api-client + useAvailabilityExceptions hook`

---

### Task 7 — Frontend: 4ª seção "Exceções / Feriados"

**Files:** Modify `components/admin/ConfiguracoesManager.tsx` (4ª seção, abaixo do Horário). Test: `components/admin/ConfiguracoesManager.test.tsx` (casos novos).

- [ ] **Step 1 — Testes que falham** (mock do `useAvailabilityExceptions`): (a) renderiza a seção "Exceções / Feriados" com a lista das futuras; (b) adicionar exceção `closed` numa data → chama `add({date, kind:'closed'})`; (c) adicionar `custom_hours` com 09:00–13:00 → `add({date, kind:'custom_hours', open, close})`; (d) remover uma linha → chama `remove(id)`; (e) botão "Fechar hoje" → chama `closeToday()`.
- [ ] **Step 2 — Rodar e ver falhar** (seção inexistente).
- [ ] **Step 3 — Implementar:** 4ª seção reusando `inputClass`/`labelClass` + feedback + estados; form de adicionar (data `type=date` + radio Fechado/Horário especial + abre/fecha quando especial) + botão "Fechar hoje" + lista das futuras com "Remover".
- [ ] **Step 4 — Rodar VERDE** + suíte frontend inteira + `npx next build --webpack` limpo.
- [ ] **Step 5 — Commit:** `feat(availability): exceptions/holidays section in store config`

---

## Verificação final (pós-T7)
- Backend: `npx jest --testPathPattern="availability|whatsapp-pickup|business-hours|tenants" --runInBand` — verde.
- Frontend: `npx vitest run` — verde.
- Review whole-branch (subagent-driven): foco em (a) RLS/escopo por tenant (cross-tenant não vaza), (b) gate puro sem I/O, (c) a mensagem não mente (3 causas), (d) backstop coerente com o gate, (e) Camada 1 intacta.
- Sem merge/push até o dono revisar.

## Self-review do plano (checado)
- **Cobertura do spec:** §2 tabela → T1; §3 CRUD → T2; §4 gate → T3; §5 mensagem → T4; §6 backstop → T5; §8 frontend → T6/T7; §9 segurança → testes explícitos T2. ✔
- **Ordem:** backend (T1-T5) antes do frontend (T6-T7); migration/entity primeiro; gate antes da mensagem/backstop. ✔
- **Atenção do dono:** RLS idempotente = T1 Step 3; gate puro = T3 (Map por parâmetro, testado sem I/O); mensagem 3-casos = T4 Step 1 (3 testes separados + custom_hours); guard admin + cross-tenant = T2 Step 1 (testes de segurança explícitos, primeiro step). ✔
- **Placeholders:** nenhum — cada task tem teste concreto + esqueleto.
