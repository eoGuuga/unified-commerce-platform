# Arquitetura Multi-Tenant — o porquê (RLS + set_config + transação por request)

> Este documento explica **por que** o isolamento entre tenants é feito do jeito
> que é, e **qual o risco** de fazer errado. A **implementação** vive no código:
> `backend/src/common/interceptors/tenant-db-context.interceptor.ts` e
> `backend/src/modules/common/services/db-context.service.ts`. Consolidado a
> partir dos docs técnicos legados (DBCONTEXT-SERVICE, TENANT-DB-CONTEXT-INTERCEPTOR).

## Decisão central: isolamento por RLS no Postgres, NÃO por `WHERE tenant_id = ?`

O isolamento entre lojas (tenants) é garantido por **Row Level Security (RLS)**
do PostgreSQL — políticas no banco que filtram cada linha por
`tenant_id = current_setting('app.current_tenant_id')::uuid`.

**Por que RLS e não filtrar na aplicação (`WHERE tenant_id = ?`):**
- Filtrar na aplicação depende de **toda** query lembrar do filtro. Esquecer em
  **uma** query (um `find()`, um relatório, um join, um endpoint novo) vaza dados
  de outro tenant — e o vazamento é silencioso (não dá erro, retorna dados a mais).
- RLS move a garantia pro **banco**: a política é aplicada em toda query
  automaticamente, em todas as tabelas. É **impossível esquecer** — mesmo um
  `SELECT * FROM produtos` só retorna as linhas do tenant atual.

> **RISCO (não desfazer):** trocar RLS por `WHERE tenant_id = ?` reabre a porta do
> vazamento entre tenants. Um único endpoint que esqueça o filtro expõe dados de
> outra loja. **Não "simplifique" pra filtro na aplicação.**

## Por que `set_config('app.current_tenant_id', ..., true)` com escopo de transação

As políticas RLS leem uma **variável de sessão** (`app.current_tenant_id`). Para
o RLS funcionar, essa variável precisa estar setada **antes de qualquer query** da
requisição. Decisões:
- **`SET LOCAL` / `set_config(..., true)` (escopo de transação):** a variável só
  existe **dentro da transação atual** e é limpa automaticamente quando a
  transação termina. Isso é de **segurança**: a variável **não vaza** para outro
  request que reuse a mesma conexão do pool. Um valor "global" de sessão vazaria
  o tenant de um request pro próximo.
- Como a variável só vive dentro de uma transação, **cada request roda numa
  transação** — aberta no início pelo interceptor, que seta o tenant antes de
  delegar ao handler.

## Por que um interceptor global + AsyncLocalStorage (transação compartilhada)

`TenantDbContextInterceptor` (global) extrai o `tenant_id`, abre a transação,
seta `app.current_tenant_id`, e roda o handler dentro desse contexto via
`DbContextService` (que usa `AsyncLocalStorage` do Node). Por quê:
- **Um request, uma transação, todos os serviços no mesmo contexto.** Quando um
  fluxo encadeia serviços (ex.: **criar pedido → abater/reservar estoque → criar
  pagamento**), todos precisam estar na **mesma transação** (atomicidade ACID:
  ou tudo confirma, ou tudo reverte) **e** com o **mesmo tenant** setado. O
  `AsyncLocalStorage` propaga o `EntityManager` da transação automaticamente pra
  todas as chamadas assíncronas do request, sem passar o manager à mão.
- **Transações aninhadas reutilizam o manager:** se um serviço já está numa
  transação e chama outro que também pede transação, o `DbContextService`
  **reutiliza** o manager existente em vez de abrir uma transação nova (evita
  deadlock/transação dupla).
- **Zero configuração manual:** nenhum serviço precisa lembrar de extrair tenant,
  abrir transação ou setar RLS — some a classe inteira de bug "esqueci de setar o
  tenant_id".

> **RISCO (não desfazer):** usar `@InjectRepository(X)` direto (em vez de
> `db.getRepository(X)`) ou abrir `dataSource.transaction()` manual num controller
> **sai do contexto do interceptor** — a query roda fora da transação/tenant
> corretos, quebrando RLS e/ou a atomicidade. **Regra:** nos serviços, sempre
> `this.db.getRepository(Entity)` e `this.db.runInTransaction(...)`.

## Extração do tenant (e o porquê da ordem)

O interceptor extrai o `tenant_id` na ordem: **(1) JWT** (`req.user.tenant_id` — o
mais confiável, o usuário só acessa o próprio tenant), **(2) header
`x-tenant-id`** (para endpoints públicos como o webhook do WhatsApp — precisa ser
validado), **(3) body** (último recurso, menos seguro). Sem `tenant_id` (ex.:
`/health`), o request passa **sem transação** (endpoint público).

- **Em produção, o tenant é extraído SOMENTE do JWT** — header/body são ignorados.
  Em dev/test, `x-tenant-id`/`tenantId` no body são aceitos. Controle via
  `ALLOW_TENANT_FROM_REQUEST=true|false`. *(É por isso que o login manda o tenant
  no header em dev, mas em prod ele vem do token.)*

## Resumo
- Isolamento entre tenants = **RLS no Postgres**, não filtro na aplicação (impossível esquecer).
- RLS lê `app.current_tenant_id`, setado com **escopo de transação** (não vaza entre requests do pool).
- **Interceptor global + AsyncLocalStorage** dão "um request = uma transação = um tenant", compartilhada entre serviços, com aninhamento seguro.
- **Não reverter pra `WHERE tenant_id=?` nem usar `@InjectRepository`/transação manual** — os dois furam o isolamento/atomicidade.
