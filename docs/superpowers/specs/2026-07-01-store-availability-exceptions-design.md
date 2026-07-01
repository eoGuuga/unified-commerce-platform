# Camada 2 — Disponibilidade da Loja (exceções pontuais) — Design

**Data:** 2026-07-01
**Tipo:** Feature (backend: tabela + módulo CRUD + gate no bot; frontend: 4ª seção na config)
**Status:** APROVADO (2026-07-01) — decisões 1-3 + residuais R1-R4 travadas (§12). Plano a seguir. NÃO implementado ainda.
**Branch:** `feat/store-availability`

---

## 1. Objetivo e escopo (v1)

**Objetivo:** o lojista marca **exceções pontuais por-data** — "nesta data a loja está **fechada**" (luto/folga/feriado) ou "nesta data abre em **horário diferente**" — e o bot passa a **recusar/ajustar a retirada** naquela data. Complementa a Camada 1 (horário recorrente semanal), sobrepondo-a só na data da exceção.

**No escopo (v1):**
- Tabela nova `store_availability_exceptions` (RLS) + módulo CRUD (escopo por tenant + admin).
- Gate único no bot (`generatePickupSlots`) consumindo as exceções; mensagem de fechamento humana; backstop também consulta exceções.
- 4ª seção "Exceções / Feriados" dentro de `/admin/configuracoes` — **lista de datas** (adicionar/remover).

**Decisões travadas (dono):**
1. **Mensagem** = "genérica mas explicando o motivo": hoje com exceção `closed` → *"Hoje a loja está fechada 🙏 Volte em breve!"*, distinta de "sem horário configurado" e de "fora do horário agora". `custom_hours` (horário reduzido) → **sem** mensagem especial (só oferece os horários menores).
2. **Tela** = 4ª seção dentro de `/admin/configuracoes` (abaixo do Horário recorrente); v1 = **lista de datas** (react-day-picker fica como upgrade futuro).
3. **Backstop** = o `isWithinBusinessHours` (~L1040) **também** consulta exceções antes de confirmar o slot (cinto-e-suspensório).

---

## 2. Modelo de dados

Tabela `store_availability_exceptions` + enum PG (padrão da base):
```sql
CREATE TYPE store_exception_kind AS ENUM ('closed', 'custom_hours');

CREATE TABLE store_availability_exceptions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   uuid NOT NULL,
  date        date NOT NULL,                 -- DATA CIVIL no fuso da loja (não UTC)
  kind        store_exception_kind NOT NULL,
  open        time NULL,                      -- só em custom_hours
  close       time NULL,                      -- só em custom_hours
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_exception_tenant_date UNIQUE (tenant_id, date),   -- serve o índice de range
  CONSTRAINT chk_exception_hours CHECK (
    (kind = 'closed'       AND open IS NULL     AND close IS NULL) OR
    (kind = 'custom_hours' AND open IS NOT NULL AND close IS NOT NULL)
  )
);

ALTER TABLE store_availability_exceptions ENABLE ROW LEVEL SECURITY;
-- policy idempotente (padrão 009-rls-force-*.sql):
CREATE POLICY store_availability_exceptions_tenant_isolation ON store_availability_exceptions
  FOR ALL USING  (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
           WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```
- **Migration TypeORM** em `backend/src/database/migrations/`, timestamp **`1751800000000-AddStoreAvailabilityExceptions.ts`** (> a última `1751700000000`), `up`/`down`, idempotente (`IF NOT EXISTS`, `DO $$` para a policy). Molde: `1751300000000-AddStockLedgerAndReleaseTracking.ts` (CREATE TABLE) + `009-rls-force-*.sql` (policy).
- **Entity** `StoreAvailabilityException.entity.ts` (padrão das demais entidades PT/TypeORM).
- **`date` é data civil no fuso da loja** — nunca UTC. É a chave de junção com o loop do bot (que já opera em `y-mo-d` local do fuso).

---

## 3. Backend — módulo CRUD (espelha `products`)

Novo módulo `availability` (`backend/src/modules/availability/`): `controller` + `service` + `dto` + a `entity`. O `WhatsappModule` importa o `AvailabilityService` (para o gate) — serviço standalone, sem ciclo.

**Endpoints** (todos `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN)`, `tenantId = user.tenant_id` do JWT — nunca body):
| Verbo | Rota | Ação |
|---|---|---|
| `GET` | `/availability-exceptions` | Lista as **futuras** (`date >= hoje`), ordenadas por data |
| `POST` | `/availability-exceptions` | Cria 1 exceção (`{ date, kind, open?, close? }`) |
| `DELETE` | `/availability-exceptions/:id` | Remove uma exceção (escopada por tenant) |
| `POST` | `/availability-exceptions/close-today` | Atalho "fechar hoje" — cria `closed` para a data de **hoje** |

**Service (métodos):**
- `findFuture(tenantId)` — `date >= hoje` (fuso da loja), ordenado.
- `findByDateRange(tenantId, fromDate, toDate)` — usado pelo bot (monta a Map do gate).
- `create(tenantId, dto)` — valida + insere; `UNIQUE(tenant_id,date)` protege duplicata.
- `remove(tenantId, id)`.
- `closeToday(tenantId)` — cria `closed` para hoje (ver **decisão residual R1** sobre "hoje" e sobre conflito com exceção existente).

**DTO** `CreateStoreExceptionDto` (class-validator): `date` (ISO `YYYY-MM-DD`, não-passado), `kind` (`@IsEnum`), `open`/`close` (`HH:MM`, **obrigatórios se `custom_hours`, proibidos se `closed`** — validação cruzada, espelha o `IsBusinessHours` da Camada 1).

**"Hoje" no fuso da loja:** `findFuture`/`closeToday` calculam "hoje" no **fuso da loja** (`settings.business_hours.tz`, default `America/Sao_Paulo`) — não a data do servidor. (Loja em Manaus não fecha o dia errado.)

---

## 4. Backend — o gate no bot (`generatePickupSlots`)

Assinatura hoje pura (`now` já é parâmetro): `whatsapp.service.ts:1372`. Adicionar **4º parâmetro**:
```ts
private generatePickupSlots(
  businessHours: BusinessHours,
  now: Date,
  opts?: { maxSlots?: number; lookaheadDays?: number },
  exceptions?: Map<string, StoreExceptionLite>,   // chave "YYYY-MM-DD" (fuso da loja)
)
```
- O **caller** (`whatsapp.service.ts:~979`) carrega via `availabilityService.findByDateRange(tenantId, now, now+lookaheadDays)` e monta a `Map` (chave = data civil no fuso). Lookup O(1); a função continua **pura/determinística** (sem I/O).
- **Encaixe entre L1400 e L1404** (depois de ter `y-mo-d`, antes de resolver o `dh` recorrente):
  ```ts
  const exc = exceptions?.get(`${y}-${mo}-${d}`);
  if (exc?.kind === 'closed') continue;                              // dia fechado → zero slots
  const dh = exc?.kind === 'custom_hours'
    ? { open: exc.open!, close: exc.close! }                          // horário especial
    : businessHours.days[String(dow)];                               // recorrente
  if (!dh) continue;                                                 // (dia recorrente ausente)
  ```
- Todo o resto do loop (slots de 1h, descarte de passado, cap) intacto. Fuso/DST inalterados.

---

## 5. Backend — a mensagem de fechamento (decisão 1)

Hoje, lista vazia → `whatsapp.service.ts:~980`: *"Não há horários disponíveis para retirada em breve. Tente novamente mais tarde."* Lista vazia tem **3 causas** (sem `business_hours` / fora de todos os horários próximos / **fechado por exceção hoje**). Para a mensagem específica, o caller precisa de um **sinal** que olhe a exceção de **hoje** (`dayOffset===0`, data civil atual no fuso da loja):
- Antes/depois de gerar os slots, o caller checa `exceptions.get(hojeKey)?.kind === 'closed'`.
- Se **sim** e a lista veio vazia → mensagem **"Hoje a loja está fechada 🙏 Volte em breve!"**.
- Senão → mantém as mensagens existentes ("sem horário/só entregas" em ~L942/L969; "sem horários em breve" em ~L980).
- `custom_hours` **não** dispara mensagem especial — os slots menores já saem normalmente pelo gate.

> A distinção é por **causa**, não por "array vazio" — o sinal é a exceção `closed` de hoje especificamente. **A mensagem "fechado hoje" NÃO pode mentir:** só aparece quando a causa REAL é a exceção `closed` de hoje; nunca quando a lista-vazia vem de "sem `business_hours`" ou de "fora do horário agora". O §10 prova os **3 casos separadamente** — é o teste que garante que a mensagem não engana o cliente.

---

## 6. Backend — o backstop (decisão 3)

`isWithinBusinessHours` (`whatsapp.service.ts:~1508`), usado no backstop de `selecting_pickup_slot` (~L1040), valida hoje **só** contra o recorrente. Passa a **também consultar a exceção da data do slot** (mantendo-o puro — recebe a exceção/Map por parâmetro):
- data do slot com exceção `closed` → `return false` (recusa confirmar).
- `custom_hours` → valida contra o `open/close` da exceção (não o recorrente).
- sem exceção → comportamento atual (recorrente).

Cinto-e-suspensório: mesmo no cenário raro, nunca confirma pedido para data fechada. (O gate do §4 já filtra na oferta; o backstop garante na confirmação.)

---

## 7. Interação com a Camada 1 (recorrente) — confirmada

A sobreposição é **por-data, em tempo de leitura**, dentro do loop (§4): cada iteração resolve UMA data civil e só nela a exceção substitui/anula o `dh` recorrente. "Essa sexta fechado" afeta só aquela sexta; as outras sextas leem `days["5"]` normal. **Sem efeito colateral** em `settings.business_hours` (JSONB do tenant, Camada 1) — são **fontes separadas** (tabela nova × JSONB), combinadas só na leitura. A Camada 1 fica **intacta**.

---

## 8. Frontend — 4ª seção "Exceções / Feriados"

Dentro de `ConfiguracoesManager.tsx` (`/admin/configuracoes`), **abaixo do editor de Horário recorrente** (mesma família conceitual — "quando a loja atende"). Reusa 100% do shell + `inputClass`/`labelClass` + feedback (some ~6s) + estados loading/error/empty (padrão `ProductsManager`/`ProductForm` que o Manager já copia).

**v1 = lista de datas:**
- **Adicionar exceção:** escolher a **data** (input `type=date` nativo no v1), o **tipo** (radio "Fechado" / "Horário especial") e, se "Horário especial", **abre/fecha** (`HH:MM`). Botão "Adicionar".
- **Atalho "Fechar hoje"** (botão): chama `close-today`.
- **Lista das exceções futuras:** cada linha = data + "Fechado" / "9h–13h" + botão **Remover**.
- **Dados:** hook novo `useAvailabilityExceptions` (fetch on mount + create/remove/closeToday, optimistic + rollback no padrão do `useTenantSettings`) + métodos no `api-client` (`listExceptions`/`createException`/`removeException`/`closeToday`).

O **calendário visual** (`react-day-picker`, já no repo) = **upgrade futuro**, fora do v1.

---

## 9. Segurança
- **Escopo por `user.tenant_id` do JWT** (nunca body); **RLS** na tabela reforça no banco.
- **Escrita por admin** (`@Roles(UserRole.ADMIN)` + `RolesGuard`, reusando o da frente de config).
- Sem segredo envolvido (a exceção é config de negócio).

---

## 10. Testes (por área)

**Backend:**
- **Gate:** `closed` → o dia não gera slots; `custom_hours` → gera slots no horário reduzido (ex.: sáb especial 9–13 gera só até 13h).
- **Sobreposição por-data:** exceção numa data não afeta as outras datas (o recorrente segue nas demais).
- **Backstop:** `isWithinBusinessHours` recusa slot em data com exceção `closed` (e valida contra `custom_hours`).
- **Mensagem "fechado hoje" — distinção RIGOROSA das 3 causas de lista-vazia (a mensagem não pode mentir):**
  - **(a)** hoje com exceção `closed` + lista vazia → **"Hoje a loja está fechada 🙏 Volte em breve!"**.
  - **(b)** loja **sem `business_hours`** configurado → a mensagem existente de "só entregas / sem horário" (~L942/L969), **NÃO** "fechado hoje".
  - **(c)** loja funciona hoje mas está **fora do horário agora** (lista vazia por horário, sem exceção) → "sem horários em breve" (~L980), **NÃO** "fechado hoje".
  - `custom_hours` (horário reduzido) → **sem** mensagem especial (os slots menores saem normalmente).
  - Cada caso é um teste separado — "fechado hoje" só dispara quando a causa REAL é a exceção `closed` de hoje.
- **CRUD:** criar/listar-futuras/remover escopado por tenant; guard admin (não-admin → **403**); `date >= hoje` na listagem.
- **Isolamento cross-tenant:** admin de A não lê/remove exceção de B (2 tenants).
- **Limpeza desnecessária:** a leitura filtra `date >= hoje` — exceção passada nunca é lida (sem cron).

**Frontend:**
- Adicionar (fechado e horário especial), listar futuras, remover; a tela reflete; "Fechar hoje" cria a exceção de hoje.

---

## 11. Fora de escopo (explícito)
- **Calendário visual** (react-day-picker) — upgrade futuro; v1 é lista de datas.
- **Pedido órfão** — o dono confirmou que não ocorre (o lojista só fecha dias livres). Opcional/futuro: um aviso "há N pedidos agendados nesse dia" ao fechar — **nota de futuro, não v1**.
- **Qualquer mudança no `settings.business_hours` recorrente** (Camada 1 fica intacta).
- **Recorrência de exceção** (ex.: "todo dia 25") — v1 é por-data única.
- **Múltiplas janelas por data** (ex.: manhã e tarde com pausa) — v1 é uma janela (`open/close`) por data, coerente com a Camada 1.

---

## 12. Decisões de produto residuais — RESOLVIDAS (2026-07-01)
- **R1 — UPSERT.** "Fechar hoje" / adicionar data com exceção já existente **sobrescreve** por `(tenant_id, date)` (`ON CONFLICT (tenant_id, date) DO UPDATE`). "Fechar hoje" é intenção clara de fechar; o último comando vence.
- **R2 — v1 só adicionar/remover** (para mudar, remove + adiciona). **Sem PATCH** de edição.
- **R3 — "Hoje" no fuso da loja.** `findFuture`/`closeToday`/`date >= hoje` usam o **fuso da loja** (`settings.business_hours.tz`, default `America/Sao_Paulo`), não a data do servidor.
- **R4 — `POST` rejeita `date` no passado** (exceção retroativa não faz sentido). A data corrente só entra pelo atalho "fechar hoje".
