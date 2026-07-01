# Tela de Configurações da Loja (multi-tenant) — Design

**Data:** 2026-07-01
**Tipo:** Feature (backend endpoints + frontend admin) — habilita config por-lojista sem SQL
**Status:** APROVADO (2026-07-01) — escopo Caminho A + horário por-dia (Camada 1); decisões A–F resolvidas (§9). Plano a seguir. NÃO implementado ainda.
**Branch:** `feat/tenant-config`

---

## 1. Objetivo e escopo (v1)

**Objetivo:** dar a cada lojista (SaaS multi-tenant) uma tela `/admin/configuracoes` para editar a própria loja **sem tocar no banco**. Hoje só o branding tem endpoint; todo o resto do `settings` (JSONB) só se edita por SQL — este é o buraco central.

**No escopo (v1) — 3 seções:**
- **Loja:** nome, descrição, tagline, logo, cor primária. (Reusa/estende o branding existente.)
- **Horário:** o objeto estruturado `settings.business_hours` **por-dia** (Camada 1 — horário recorrente semanal; cada dia com faixa própria ou fechado). Ver §3 pro shape. **Fonte única de horário.**
- **Pagamento:** formas aceitas, chave PIX, **nome do recebedor no PIX** (hoje global — vira per-tenant, §4).

**FORA do escopo v1 (explícito — §8):** WhatsApp/credenciais/token, persona/regras do bot, `bot_control_code`, `ignored_phones`, branding "GTSoftHub" do produto, e **exceções pontuais de disponibilidade (Camada 2)**.

> Racional do corte: Loja+Horário+Pagamento destravam as próximas frentes (disponibilidade, notificação) e não expõem nenhum segredo. **Mas o endpoint de leitura já nasce com a projeção allow-list correta (§6)** para quando os segredos entrarem.

---

## 2. Backend — endpoints

Dois endpoints novos no `tenants.controller.ts`, ambos escopados pelo `user.tenant_id` do JWT (nunca do body — resolve o "gap do slug": o front não precisa saber o slug).

### 2.1 `GET /tenants/settings` (autenticado)
Retorna uma **projeção allow-list** do tenant atual — **nunca** o `settings` bruto, **nunca** segredo. Shape:
```jsonc
{
  "loja":     { "store_name": string|null, "tagline": string|null, "description": string|null,
                "logo_url": string|null, "favicon_url": string|null, "primary_color": string|null },
  "horario":  { "business_hours": BusinessHours | null },     // shape em §3
  "pagamento":{ "metodos": string[], "pix_key": string|null, "pix_merchant_name": string|null },
  "status": {
    "hasBusinessHours": boolean, "hasPixKey": boolean, "hasPixMerchantName": boolean,
    "hasWhatsappNumber": boolean   // read-only: sinaliza que a loja ainda não pluga o WhatsApp (frente futura)
  }
}
```
Regras: campos ausentes → `null`/`[]`. `hasWhatsappNumber` deriva de `settings.whatsappNumbers?.length > 0` (só o booleano). **Nunca** inclui `whatsapp.apiKey`, `bot_control_code`, tokens ou colunas `*_encrypted`.

### 2.2 `PATCH /tenants/settings` (autenticado + **guard de role admin**)
Corrige o gap atual (o `PATCH /branding` exige só autenticação, não admin). Corpo = DTO **por seção, cada campo opcional**:
```
UpdateTenantSettingsDto {
  loja?:      { store_name?, tagline?, description?, logo_url?, favicon_url?, primary_color? }
  horario?:   { business_hours?: BusinessHours | null }        // shape em §3
  pagamento?: { metodos?: PaymentMethod[], pix_key?: string, pix_merchant_name?: string }
}
```
- Cada seção presente é mesclada via `TenantsService.updateSettings()` (`settings = COALESCE(settings,'{}') || $2::jsonb`, escopado por RLS). Seção ausente = não toca.
- Validação: `primary_color` hex `#RRGGBB`; `logo_url`/`favicon_url` URL; strings com limites; `business_hours` conforme §3 (chaves `"0".."6"`, `open`/`close` `HH:MM`, `tz` IANA válido); `metodos` ⊂ `{pix,dinheiro,debito,credito}`; `pix_key` formato básico.
- Guard: `JwtAuthGuard` + `RolesGuard`/checagem `UserRole.ADMIN` (o `owner_id` é setado no signup).

### 2.3 Endpoint de branding existente
- `GET /tenants/:slug/branding` (**público**) — **mantém intacto** (a vitrine lê branding por slug).
- `PATCH /tenants/branding` (autenticado) — **mantido funcionando (backward-compat, decisão A)**; a tela nova usa **só** o `PATCH /tenants/settings` (a seção `loja` cobre os campos de branding). Não estender o antigo.

---

## 3. Horário — shape por-dia (Camada 1) + unificação

### 3.1 Shape estruturado (fonte única)
```ts
interface DayHours { open: string; close: string }   // "HH:MM"
interface BusinessHours {
  tz: string;
  days: { [dow: string]: DayHours };  // chave "0".."6" (0=domingo); dia AUSENTE = FECHADO
}
// ex.: { tz:"America/Sao_Paulo", days:{ "1":{open:"09:00",close:"18:00"}, ... "5":{...}, "6":{open:"09:00",close:"13:00"} } }  // dom fechado
```
Permite "seg-sex 9h-18h, sáb 9h-13h, dom fechado" naturalmente. **Mapa (não array)**: consulta dominante é "abre no dia D? que horário?" → `bh.days[dow]` O(1); "ausente = fechado" mata o dia-fechado sem flag.

### 3.2 Os 4 consumidores (mudança contida, ~30 linhas; fuso/DST intactos)
- **`getBusinessHours()`** (`whatsapp.service.ts:1320-1343`) — valida `days` como objeto `{"0".."6":{open,close}}` (fail-closed → `null`).
- **`generatePickupSlots()`** (`:1366-1419`) — tira o `parseHHMM(open/close)` global; dentro do loop de `dayOffset`, após o `dow`: `const dh = bh.days[String(dow)]; if (!dh) continue;` e usa `dh.open/close`.
- **`isWithinBusinessHours()`** (backstop, `:1500-1534`) — `const dh = bh.days[dow]; if (!dh) return false;` e lê `open/close` do dia.
- **`describeBusinessHours()`** (`:1346-1350`) — itera e agrupa por dia ("seg-sex 9h-18h, sáb 9h-13h").

### 3.3 Unificação (fonte única de horário)
Hoje há 2 representações desconectadas + default chumbado (o bot *fala* um horário e *agenda* outro):
- `settings.business_hours` (objeto) — lógica de retirada. **Canônico.**
- `whatsapp_bot.store.business_hours` (string livre) — prompt do LLM (`llm-router:129`, `action-executor:125`).
- `DEFAULT_STORE.business_hours = 'Seg-Sex 9h-18h'` (`bot-config.service.ts:39`) — o que o bot afirma se não configurado.

**Mudança:**
1. A tela grava **só** `settings.business_hours` (o objeto por-dia).
2. `BotConfigService.loadConfig()` **deriva** a string do prompt a partir do objeto, via `describeBusinessHours()` (extrair pra util compartilhado) — em vez de ler `whatsapp_bot.store.business_hours`.
3. **Apagar** o default chumbado `'Seg-Sex 9h-18h'`. Sem `business_hours` → o bot **não afirma horário** (coerente com o default restritivo: sem horário → sem retirada).
4. **(Decisão F)** No mesmo toque no loader, derivar também `store.name`/`store.description` dos campos canônicos da seção Loja (`settings.store_name`/`settings.description`), removendo a duplicata em `whatsapp_bot.store`. Fonte única de nome/descrição/horário.

Custo: muda **1 produtor** (o loader do bot) na unificação; os 2 leitores da string não mudam.

---

## 4. Pagamento — nome do PIX per-tenant

**Problema:** o nome do recebedor no payload PIX (BR Code EMV) vem de `MERCHANT_NAME` (env **global**, `payments.service.ts:437`) — hoje **todos os lojistas aparecem com o mesmo nome** no PIX.

**Mudança:** o nome do recebedor passa a vir de `settings.pagamento.pix_merchant_name` (ou `store_name`) do tenant, com `MERCHANT_NAME` (env) como **fallback**. Incluir no settings: `metodos` (formas — enum `{pix,dinheiro,debito,credito}`, decisão B) e `pix_key` (chave PIX da loja).

> **Caveat aceito no v1 (decisão C):** o `merchantName` de `payments.service.ts:437` é do **PIX estático (BR Code EMV)** — mock/fallback. O **PIX principal é via MercadoPago** (`createPixPayment`), cujo recebedor é a **conta MP configurada** — global hoje. O **modelo de negócio alvo** é: **cada lojista recebe as próprias vendas no PIX dele** (credencial MP/PIX por-tenant) e **a plataforma cobra só a assinatura** — isso é a **frente futura de credenciais**. Em v1, o nome-por-loja vale pro caminho estático + exibição (tela/comprovante); o PIX-via-MP segue com a conta global até a frente de credenciais. Registrado e aceito.

---

## 5. Frontend — a tela

- **Rota:** `app/admin/configuracoes/page.tsx` (wrapper fino → `ConfiguracoesManager`), no padrão de `produtos/estoque/pedidos`.
- **Nav:** +1 item em `NAV_ITEMS` (`AdminNav.tsx:27`): `{ label: 'Configurações', href: '/admin/configuracoes', icon: Settings }`. Auth-gate/layout herdados do `AdminShell`.
- **Seções (Loja / Horário / Pagamento):** form com validação inline, feedback sucesso/erro (auto-some ~6s), estado "Salvando…". Reusa `inputClass`/`labelClass` do `ProductForm` e a estrutura do `ProductsManager`.
  - **Loja:** nome, descrição, tagline, logo (URL), cor primária (hex/color picker).
  - **Horário (por-dia):** uma linha por dia da semana (seg–dom); cada dia = toggle **Aberto/Fechado** + (se aberto) abre/fecha (HH:MM). + timezone: default `America/Sao_Paulo` + **lista curta de fusos BR** (decisão E). Grava o mapa `BusinessHours` de §3.
  - **Pagamento:** checkboxes de formas (`pix/dinheiro/debito/credito`), chave PIX, nome no PIX.
- **Onboarding/sinalização:** o lojista nasce "pelado" (`settings: {}`); a tela mostra o que falta via os booleanos de `status` — ex.: "Sua loja ainda não tem **horário** definido" / "**chave PIX** não configurada". **Não bloqueante**, mas visível.
- **Dados:** novo hook `useTenantSettings` (fetch on mount + loading/error + mutation com **optimistic update + rollback**, no padrão `useProducts`) + 2 métodos novos no `api-client.ts` (`getSettings()`, `updateSettings(dto)`).

---

## 6. Segurança (regra de ouro)
- **Leitura = projeção allow-list** (§2.1): nunca `settings` bruto, nunca segredo. Mesmo sem segredo editável em v1, o GET **já nasce** com a projeção correta para a frente de credenciais.
- **Escrita = DTO por seção + guard admin** (§2.2). Corrige o gap onde qualquer autenticado edita branding.
- **Escopo por `user.tenant_id` do JWT** (nunca do body); em prod `x-tenant-id` ignorado fora de webhooks; **RLS reforça no banco**.

---

## 7. Testes
**Backend (integração, via túnel de teste):**
- `GET /tenants/settings`: retorna a projeção; **não vaza** `whatsapp.apiKey`/`bot_control_code`/tokens/`*_encrypted` mesmo se presentes no settings.
- `PATCH /tenants/settings`: cada seção faz merge correto; seção ausente não toca as outras; validações rejeitam inválidos.
- **Guard admin:** autenticado não-admin → 403; admin passa.
- **Horário por-dia:** `generatePickupSlots` respeita faixa própria por dia + dia ausente = sem slots (ex.: sáb 9-13 gera slots só até 13h; dom não gera).
- **Unificação horário:** loader do bot deriva a string do objeto; sem `business_hours` → prompt não afirma horário chumbado.
- **PIX per-tenant:** nome do recebedor (caminho estático) vem do settings; fallback pro env quando ausente.
- Escopo/RLS: tenant A não lê/edita settings do tenant B.

**Frontend (vitest):** a tela carrega a projeção, salva cada seção (optimistic + rollback no erro), edita o horário por-dia, e sinaliza o que falta.

---

## 8. Fora de escopo (explícito)
- **Exceções pontuais de disponibilidade** (fechar dias específicos por luto/folga/feriado; horário alterado num dia) = **Camada 2, frente seguinte dedicada ("Disponibilidade da Loja")**. Núcleo é gate único no `generatePickupSlots`; armazenamento em tabela `store_availability_exceptions` com RLS; custo dominado pela tela de calendário.
- WhatsApp: provider/número/`apiKey`/instance, `whatsappNumbers`, `whatsapp_cloud_token_encrypted` (frente de credenciais).
- Bot: persona, rules, llm_model/temperature, `bot_control_code`, `ignored_phones`.
- Branding "GTSoftHub" hardcoded no front (branding do produto).
- PIX-via-MercadoPago com a loja como recebedora (frente de credenciais — modelo "cada loja recebe seu PIX, plataforma cobra assinatura", §4).
- Migrar `whatsapp.apiKey`/`bot_control_code` de plaintext p/ coluna cifrada (dívida da frente de credenciais).

---

## 9. Decisões de produto — RESOLVIDAS (nenhuma pendente)
- **A — Branding:** **manter** `PATCH /tenants/branding` (backward-compat); a tela nova usa só `PATCH /tenants/settings` (seção `loja`). `GET /:slug/branding` público fica.
- **B — Formas de pagamento:** enum **`pix, dinheiro, debito, credito`**.
- **C — Nome no PIX:** aceito o limite no v1 (nome-por-loja no PIX estático + exibição). Modelo alvo registrado: **cada lojista recebe as próprias vendas no PIX dele; a plataforma cobra só a assinatura** → credencial MP/PIX por-tenant = **frente futura de credenciais**.
- **D — Horário:** **por-dia** (Camada 1), shape mapa `{tz, days:{"0".."6":{open,close}}}`, dia ausente = fechado (§3).
- **E — Timezone:** default `America/Sao_Paulo` + lista curta de fusos BR.
- **F — Fonte única do bot:** o loader do bot deriva **nome/descrição/horário** dos campos canônicos (§3.3).

---

## 10. Arquivos que a frente toca (mapa)
- **Backend:** `tenants.controller.ts` (+2 rotas), `tenants.service.ts` (projeção + settings por seção; reusa `updateSettings`), `dto/update-tenant-settings.dto.ts` (novo), `RolesGuard`/decorator admin (se não existir), `bot-config.service.ts` (deriva horário/nome/descrição; apaga default), `whatsapp.service.ts` + util `describeBusinessHours` (shape por-dia nos 4 consumidores; extrair util), `payments.service.ts:437` (nome PIX do tenant).
- **Frontend:** `app/admin/configuracoes/page.tsx` (novo), `components/admin/shell/AdminNav.tsx` (+1 item), `components/admin/ConfiguracoesManager.tsx` (novo), `hooks/useTenantSettings.ts` (novo), `lib/api-client.ts` (+getSettings/updateSettings).
