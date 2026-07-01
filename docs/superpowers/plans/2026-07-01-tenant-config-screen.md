# Tela de Configurações da Loja — Plano de Implementação

> **Para executores agênticos:** SUB-SKILL: superpowers:subagent-driven-development — executar task-a-task, review entre elas. Steps em checkbox (`- [ ]`).

**Goal:** Cada lojista edita a própria loja (Loja / Horário por-dia / Pagamento) por uma tela `/admin/configuracoes`, sem SQL — via `GET`/`PATCH /tenants/settings` (projeção allow-list + DTO por seção + guard admin), com horário por-dia como fonte única e nome do PIX per-tenant.

**Arquitetura:** NestJS + TypeORM + Postgres (RLS) no backend; Next.js App Router + hooks no frontend. Reusa `TenantsService.updateSettings()` (merge JSONB), o `AdminShell`/`ProductsManager`/`ProductForm`, e os padrões de hook (`useProducts`). Multi-tenant: tudo escopado por `user.tenant_id` do JWT.

**Tech Stack:** Jest (integração backend via túnel SSH ao `ucm_test_motor` em `localhost:5544`), Vitest (frontend).

Spec: `docs/superpowers/specs/2026-07-01-tenant-config-screen-design.md` (APROVADO).

## Global Constraints (todas as tasks)
- **SaaS multi-tenant:** nada chumbado pro caso de um lojista; escopo sempre por `user.tenant_id` do JWT (nunca body/header em prod); RLS reforça no banco.
- **Regra de ouro de segurança:** leitura = **projeção allow-list** (NUNCA `settings` bruto nem segredo: `whatsapp.apiKey`, `bot_control_code`, tokens, colunas `*_encrypted`); escrita = DTO por seção + **guard role admin**.
- **Horário = fonte única** `settings.business_hours` (shape mapa por-dia, §3 do spec); o bot **deriva** a string do prompt do objeto; sem horário → bot não afirma horário.
- **PIX:** nome do recebedor vem do settings do tenant, `MERCHANT_NAME` (env) só como fallback. (Só o caminho estático/exibição — MP fica pra frente de credenciais.)
- **FORA:** WhatsApp/credenciais/token, persona/regras do bot, `bot_control_code`, `ignored_phones`, Camada 2 (exceções), branding "GTSoftHub" do front. NÃO editar nem expor.
- Commits: Conventional Commits em inglês, atômicos, trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Branch `feat/tenant-config`. Sem merge/push até revisão do dono.
- **Nota test-DB:** o `ucm_test_motor` compartilhado acumula produtos → testes de *criação* (orders/payments) falham por duplicate SKU (dívida pré-existente, NÃO regressão). Ignorar essas falhas específicas; focar nos testes desta frente.

## File Structure
- **Backend:** `whatsapp.service.ts` + novo util `whatsapp/utils/business-hours.ts` (shape por-dia + `describeBusinessHours`); `services/bot-config.service.ts` (deriva do canônico, apaga default); `tenants.controller.ts` (+2 rotas); `tenants.service.ts` (projeção + settings por seção); `tenants/dto/update-tenant-settings.dto.ts` (novo); guard/decorator admin (se não existir, criar em `auth/`); `payments.service.ts` (nome PIX do tenant).
- **Frontend:** `lib/api-client.ts` (+2 métodos), `hooks/useTenantSettings.ts` (novo), `app/admin/configuracoes/page.tsx` (novo), `components/admin/ConfiguracoesManager.tsx` (novo), `components/admin/shell/AdminNav.tsx` (+1 item).

## Ordem das tasks (racional)
Backend antes do frontend. **T1 (shape por-dia) primeiro** — o DTO (T4) valida e a tela (T7) edita esse shape; é a fundação. **T2 (unificação) task própria** (usa o util de T1). Endpoints T3/T4 (contrato antes da tela). **Testes de segurança são steps TDD explícitos** dentro de T3 (projeção não-vaza) e T4 (guard admin). PIX (T5) independente. Frontend T6 (dados) → T7 (tela).

- T1 — Horário: shape por-dia nos 4 consumidores.
- T2 — Horário: unificação (fonte única no bot) + apagar default.
- T3 — `GET /tenants/settings` + projeção allow-list + **teste de segurança (não-vaza-segredo)**.
- T4 — `PATCH /tenants/settings` + DTO por seção + **guard admin** + **teste de segurança (403 não-admin)**.
- T5 — PIX: nome do recebedor per-tenant.
- T6 — Frontend: api-client + hook `useTenantSettings`.
- T7 — Frontend: tela `/admin/configuracoes` (3 seções, horário por-dia, sinalização) + nav.

---

### Task 1 — Horário: shape por-dia nos 4 consumidores

**Files:** `whatsapp.service.ts` (L106-111, 1320-1534); novo `modules/whatsapp/utils/business-hours.ts` (mover `BusinessHours` + `describeBusinessHours` pra util compartilhado, importável pelo DTO/bot). Test: `whatsapp-pickup.spec.ts` (ajustar shape) + casos novos.

**Interfaces — Produz:**
```ts
// business-hours.ts
export interface DayHours { open: string; close: string }        // "HH:MM"
export interface BusinessHours { tz: string; days: { [dow: string]: DayHours } }  // "0".."6"; ausente = fechado
export function describeBusinessHours(bh: BusinessHours): string; // agrupa: "seg-sex 09:00-18:00, sáb 09:00-13:00"
```

- [ ] **Step 1 — Testes que falham** (`whatsapp-pickup.spec.ts` ou spec do serviço): (a) `generatePickupSlots` com `days:{ "6":{open:"09:00",close:"13:00"} }` gera slots no sábado **só até 13:00** e **nenhum** slot em dia ausente (ex.: domingo); (b) `isWithinBusinessHours` rejeita horário em dia ausente e aceita dentro da faixa do dia; (c) `describeBusinessHours` agrupa dias com mesma faixa e lista faixas distintas.
- [ ] **Step 2 — Rodar e ver falhar** (shape antigo `days:number[]`): `cd backend && npx jest --testPathPattern="whatsapp-pickup" --runInBand`.
- [ ] **Step 3 — Implementar:** criar `business-hours.ts` com o shape + `describeBusinessHours` por-dia. Ajustar `getBusinessHours` (valida objeto `{"0".."6":{open,close}}`, fail-closed→null), `generatePickupSlots` (`const dh=bh.days[String(dow)]; if(!dh) continue;` + open/close do dia), `isWithinBusinessHours` (idem), e trocar o `describeBusinessHours` inline pelo do util. Fuso/DST (`localWallClockToInstant`/`tzOffsetMinutes`) INTACTOS.
- [ ] **Step 4 — Rodar verde** + regressão do módulo whatsapp de horário/pickup.
- [ ] **Step 5 — Commit:** `feat(config): per-day business hours shape (map by weekday, absent=closed)`

---

### Task 2 — Horário: unificação (fonte única no bot) + apagar default

**Files:** `services/bot-config.service.ts` (L16, 27-50, 65-89). Test: spec do bot-config.

**Interfaces — Consome:** `describeBusinessHours` + `BusinessHours` de `business-hours.ts` (T1); lê `tenant.settings.business_hours`, `settings.store_name`, `settings.description`.

- [ ] **Step 1 — Testes que falham:** (a) `loadConfig()` com `settings.business_hours` (objeto) → `store.business_hours` (string do prompt) é **derivada** via `describeBusinessHours` (não lê `whatsapp_bot.store.business_hours`); (b) **sem** `settings.business_hours` → a string de horário no prompt fica **vazia/ausente** (NÃO `'Seg-Sex 9h-18h'`); (c) `store.name`/`store.description` derivam de `settings.store_name`/`settings.description` (decisão F).
- [ ] **Step 2 — Rodar e ver falhar** (hoje lê a string livre + default chumbado).
- [ ] **Step 3 — Implementar:** em `loadConfig()`, derivar `store.business_hours` do objeto canônico via `describeBusinessHours` (vazio se ausente); derivar `store.name`/`description` de `settings.store_name`/`description` (fallback `tenant.name`); **apagar** `DEFAULT_STORE.business_hours = 'Seg-Sex 9h-18h'` (e o campo do default). Os leitores `llm-router:129`/`action-executor:125` não mudam (continuam lendo `store.business_hours`, agora derivado).
- [ ] **Step 4 — Rodar verde** + regressão dos specs do bot (nada quebra nos leitores da string).
- [ ] **Step 5 — Commit:** `refactor(config): single-source business hours — bot derives prompt string from structured`

---

### Task 3 — `GET /tenants/settings` + projeção allow-list + teste de segurança

**Files:** `tenants.controller.ts`, `tenants.service.ts` (novo método `buildSettingsProjection`/`getSettingsForTenant`). Test: `tenants` integration spec (criar se não houver) ou spec do service.

**Interfaces — Produz:** `GET /tenants/settings` → o shape de projeção do §2.1 do spec.

- [ ] **Step 1 — TESTE DE SEGURANÇA (explícito) que falha:** semear um tenant com `settings` contendo segredos (`whatsapp:{apiKey:'SECRET'}`, `bot_control_code:'X'`, `whatsapp:{token...}`) + campos legítimos (store_name, business_hours, pagamento). Chamar `GET /tenants/settings` (autenticado). Asserir: retorna `loja`/`horario`/`pagamento`/`status`; e **NÃO contém** em lugar algum da resposta `apiKey`, `bot_control_code`, nenhum token, nenhuma chave `*_encrypted` (varredura recursiva do JSON). + teste do `status` (booleanos corretos: hasBusinessHours etc.).
- [ ] **Step 2 — Rodar e ver falhar** (endpoint não existe).
- [ ] **Step 3 — Implementar:** `buildSettingsProjection(tenant)` que mapeia **só** as chaves allow-list (§2.1); `getSettingsForTenant(tenantId)` (lê o tenant sob RLS); rota `@Get('settings')` `@UseGuards(JwtAuthGuard)`, `tenantId = user.tenant_id` (nunca body).
- [ ] **Step 4 — Rodar verde** (segurança + status). 
- [ ] **Step 5 — Commit:** `feat(tenants): GET /tenants/settings allow-list projection (no secret leak)`

---

### Task 4 — `PATCH /tenants/settings` + DTO por seção + guard admin + teste de segurança

**Files:** `tenants.controller.ts`, `tenants.service.ts` (`updateSettingsSectioned`), `dto/update-tenant-settings.dto.ts` (novo), guard/decorator admin em `auth/` (reusar se existir; senão criar `RolesGuard` + `@Roles(ADMIN)`). Test: tenants integration spec.

**Interfaces — Consome:** `TenantsService.updateSettings()` (merge JSONB existente), `BusinessHours` (T1). **Produz:** `PATCH /tenants/settings` (DTO §2.2).

- [ ] **Step 1 — TESTE DE SEGURANÇA (explícito) que falha:** usuário autenticado **não-admin** → `PATCH /tenants/settings` retorna **403**; usuário **admin** do tenant → 200 e aplica. (Se não houver RolesGuard, o teste falha ao ver 200 pro não-admin.)
- [ ] **Step 2 — Testes de comportamento que falham:** (a) `PATCH` só com seção `horario` grava `settings.business_hours` e **não** toca `loja`/`pagamento`; idem por seção; (b) validação rejeita inválidos (cor não-hex, URL inválida, `business_hours.days` com chave fora de 0..6 ou `open` não-`HH:MM`, `metodos` fora do enum); (c) o GET (T3) reflete o que o PATCH gravou (round-trip).
- [ ] **Step 3 — Rodar e ver falhar.**
- [ ] **Step 4 — Implementar:** `UpdateTenantSettingsDto` (class-validator, seções `loja`/`horario`/`pagamento`, todos opcionais, validação por campo); `updateSettingsSectioned` (monta o objeto de merge só com as seções presentes → `updateSettings`); rota `@Patch('settings')` com `JwtAuthGuard` + `RolesGuard`/`@Roles(ADMIN)`, `tenantId = user.tenant_id`.
- [ ] **Step 5 — Rodar verde** (segurança + comportamento + round-trip com T3).
- [ ] **Step 6 — Commit:** `feat(tenants): PATCH /tenants/settings sectioned DTO + admin guard`

---

### Task 5 — PIX: nome do recebedor per-tenant

**Files:** `payments.service.ts` (~L437, o `merchantName` do BR Code estático). Test: `payments` spec (unit do trecho de montagem do EMV, ou integração se já houver).

- [ ] **Step 1 — Teste que falha:** com `settings.pagamento.pix_merchant_name` (ou `store_name`) setado no tenant, o payload PIX estático usa **esse** nome; sem ele, cai no `MERCHANT_NAME` (env). (Hoje ignora o tenant → usa só o env.)
- [ ] **Step 2 — Rodar e ver falhar.**
- [ ] **Step 3 — Implementar:** ler o nome do recebedor do settings do tenant (via TenantsService/contexto), fallback `process.env.MERCHANT_NAME`, fallback final `'Loja'`. Não mudar o caminho MercadoPago (fora de escopo, caveat §4).
- [ ] **Step 4 — Rodar verde.**
- [ ] **Step 5 — Commit:** `feat(payments): per-tenant PIX merchant name (env fallback)`

---

### Task 6 — Frontend: api-client + hook `useTenantSettings`

**Files:** `lib/api-client.ts` (+`getSettings`, `updateSettings`), `hooks/useTenantSettings.ts` (novo). Test: `useTenantSettings.test.ts`.

**Interfaces — Produz:** `useTenantSettings()` → `{ settings, loading, error, update(section, patch), refetch }` (optimistic + rollback, padrão `useProducts`).

- [ ] **Step 1 — Testes que falham** (`useTenantSettings.test.ts`, mock do api-client): fetch on mount popula `settings`; `update('horario', {...})` aplica otimista → chama `apiClient.updateSettings` → no erro, **rollback** ao estado anterior e retorna `{ok:false}`.
- [ ] **Step 2 — Rodar e ver falhar.**
- [ ] **Step 3 — Implementar:** métodos no `api-client` (`getSettings():Promise<TenantSettingsProjection>`, `updateSettings(dto)`), no padrão `this.request<T>()`; hook espelhando `useProducts` (useState/useEffect/useCallback + optimistic/rollback).
- [ ] **Step 4 — Rodar verde.**
- [ ] **Step 5 — Commit:** `feat(config): api-client tenant settings + useTenantSettings hook`

---

### Task 7 — Frontend: tela `/admin/configuracoes` (3 seções) + nav

**Files:** `app/admin/configuracoes/page.tsx` (novo), `components/admin/ConfiguracoesManager.tsx` (novo), `components/admin/shell/AdminNav.tsx` (+1 item). Test: `ConfiguracoesManager.test.tsx`.

- [ ] **Step 1 — Testes que falham** (`ConfiguracoesManager.test.tsx`, mock do hook): (a) renderiza as 3 seções (Loja/Horário/Pagamento) com os valores da projeção; (b) editar+salvar a seção Loja chama `update('loja', {...})`; (c) **horário por-dia**: marcar sábado com 09:00-13:00 e domingo fechado monta o `business_hours` mapa correto ao salvar; (d) **sinalização**: com `status.hasBusinessHours=false`, mostra o aviso "sem horário definido".
- [ ] **Step 2 — Rodar e ver falhar** (componente não existe).
- [ ] **Step 3 — Implementar:** `ConfiguracoesManager` (reusa `inputClass`/`labelClass` + estrutura de feedback do `ProductsManager`), 3 seções; editor de horário por-dia (linha por dia: toggle Aberto/Fechado + abre/fecha; tz select São Paulo+lista BR); banners de sinalização via `status`. `page.tsx` fino. +1 item `{label:'Configurações', href:'/admin/configuracoes', icon:Settings}` em `NAV_ITEMS`.
- [ ] **Step 4 — Rodar verde** + suíte frontend inteira (sem regressão).
- [ ] **Step 5 — Commit:** `feat(config): store settings screen (Loja/Horario/Pagamento) + nav item`

---

## Verificação final (pós-T7)
- Backend: `npx jest --testPathPattern="tenants|whatsapp-pickup|bot-config|payments" --runInBand` — verde (ignorar as falhas pré-existentes de duplicate-SKU em criação de pedido, se aparecerem).
- Frontend: `npx vitest run` — tudo verde.
- Review whole-branch (subagent-driven): foco em (a) a projeção NÃO vaza segredo em nenhum caminho, (b) guard admin barra não-admin, (c) horário fonte única (bot fala = agenda), (d) escopo por tenant/RLS.
- Sem merge/push até o dono revisar.

## Self-review do plano (checado)
- **Cobertura do spec:** §2 endpoints → T3/T4; §3 horário shape+unificação → T1/T2; §4 PIX → T5; §5 frontend → T6/T7; §6 segurança → testes explícitos em T3 (não-vaza) e T4 (admin 403); §7 testes → distribuídos por task. ✔
- **Ordem:** backend (T1-T5) antes do frontend (T6-T7); unificação como task própria (T2); shape antes do DTO/tela (T1 primeiro). ✔
- **Segurança explícita:** teste de não-vazamento (T3 Step 1) e guard admin (T4 Step 1) são o PRIMEIRO step TDD de cada endpoint, não notas. ✔
- **Backend vs frontend:** separação limpa (T1-T5 backend / T6-T7 frontend). ✔
- **Placeholders:** nenhum — cada task tem teste concreto + esqueleto de implementação.
