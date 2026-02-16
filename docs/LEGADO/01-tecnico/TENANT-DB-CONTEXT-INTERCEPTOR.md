> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# ðŸ”’ TenantDbContextInterceptor - DocumentaÃ§Ã£o Completa

> **Data:** 08/01/2025  
> **VersÃ£o:** 1.0  
> **Status:** âœ… **IMPLEMENTADO E EM PRODUÃ‡ÃƒO**  
> **LocalizaÃ§Ã£o:** `backend/src/common/interceptors/tenant-db-context.interceptor.ts`

---

## ðŸŽ¯ PROPÃ“SITO

O `TenantDbContextInterceptor` Ã© um interceptor global do NestJS que gerencia automaticamente transaÃ§Ãµes de banco de dados por tenant, garantindo que o RLS (Row Level Security) do PostgreSQL funcione corretamente em todas as requisiÃ§Ãµes HTTP.

---

## ðŸ“‹ ÃNDICE

1. [VisÃ£o Geral](#visÃ£o-geral)
2. [Por Que Foi Criado](#por-que-foi-criado)
3. [Como Funciona](#como-funciona)
4. [Fluxo Completo](#fluxo-completo)
5. [ExtraÃ§Ã£o de Tenant ID](#extraÃ§Ã£o-de-tenant-id)
6. [ConfiguraÃ§Ã£o](#configuraÃ§Ã£o)
7. [IntegraÃ§Ã£o com RLS](#integraÃ§Ã£o-com-rls)
8. [Boas PrÃ¡ticas](#boas-prÃ¡ticas)
9. [Troubleshooting](#troubleshooting)

---

## ðŸŽ¯ VISÃƒO GERAL

### Problema que Resolve

**Antes do Interceptor:**
- Cada serviÃ§o precisava setar `app.current_tenant_id` manualmente
- RLS nÃ£o funcionava automaticamente
- FÃ¡cil esquecer de setar o tenant_id
- TransaÃ§Ãµes nÃ£o eram compartilhadas entre serviÃ§os

**Com o Interceptor:**
- âœ… `tenant_id` extraÃ­do automaticamente de cada request
- âœ… `app.current_tenant_id` setado automaticamente para RLS
- âœ… TransaÃ§Ã£o compartilhada entre todos os serviÃ§os do request
- âœ… Zero configuraÃ§Ã£o manual necessÃ¡ria

---

## ðŸ¤” POR QUE FOI CRIADO

### 1. **RLS Requer VariÃ¡vel de SessÃ£o**

O PostgreSQL RLS funciona atravÃ©s de variÃ¡veis de sessÃ£o (`SET LOCAL app.current_tenant_id`). Essas variÃ¡veis sÃ³ existem dentro de uma transaÃ§Ã£o e precisam ser setadas antes de qualquer query.

**SoluÃ§Ã£o:** O interceptor abre uma transaÃ§Ã£o no inÃ­cio de cada request e seta a variÃ¡vel automaticamente.

---

### 2. **Isolamento Multi-Tenant AutomÃ¡tico**

Sem o interceptor, cada serviÃ§o precisaria:
1. Extrair `tenant_id` do request
2. Abrir transaÃ§Ã£o
3. Setar `app.current_tenant_id`
4. Fazer queries
5. Commit/rollback

**SoluÃ§Ã£o:** O interceptor faz tudo isso automaticamente, garantindo que nenhum serviÃ§o esqueÃ§a de setar o tenant_id.

---

### 3. **TransaÃ§Ãµes Compartilhadas**

Quando mÃºltiplos serviÃ§os sÃ£o chamados no mesmo request (ex: criar pedido â†’ abater estoque â†’ criar pagamento), todos precisam estar na mesma transaÃ§Ã£o.

**SoluÃ§Ã£o:** O interceptor cria uma transaÃ§Ã£o no inÃ­cio do request e todos os serviÃ§os compartilham essa transaÃ§Ã£o via `DbContextService`.

---

## âš™ï¸ COMO FUNCIONA

### Arquitetura

```
Request HTTP chega
    â†“
TenantDbContextInterceptor.intercept()
    â†“
Extrai tenant_id (header, body ou JWT)
    â†“
Se nÃ£o tem tenant_id â†’ passa request sem transaÃ§Ã£o
    â†“
Se tem tenant_id:
    â†“
Cria QueryRunner e abre transaÃ§Ã£o
    â†“
Seta app.current_tenant_id = tenant_id (SET LOCAL)
    â†“
dbContext.runWithManager(manager, callback)
    â†“
Executa handler do controller/service
    â†“
Todos os serviÃ§os usam db.getRepository()
    â†“
Todas as queries usam o mesmo manager (mesma transaÃ§Ã£o)
    â†“
Se sucesso â†’ COMMIT
Se erro â†’ ROLLBACK
    â†“
Release QueryRunner
```

---

## ðŸ”„ FLUXO COMPLETO

### 1. Request HTTP Chega

```http
POST /api/v1/orders
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "items": [...],
  "channel": "whatsapp"
}
```

---

### 2. Interceptor Extrai Tenant ID

O interceptor tenta extrair o `tenant_id` na seguinte ordem:

1. **Do usuÃ¡rio autenticado (JWT):**
   ```typescript
   req.user?.tenant_id
   ```

2. **Do header HTTP:**
   ```typescript
   req.headers['x-tenant-id']
   ```

3. **Do body da requisiÃ§Ã£o:**
   ```typescript
   req.body?.tenantId || req.body?.tenant_id
   ```

**Se encontrar:** Continua com transaÃ§Ã£o  
**Se nÃ£o encontrar:** Passa request sem transaÃ§Ã£o (endpoints pÃºblicos)

---

### 3. Abre TransaÃ§Ã£o e Seta RLS

```typescript
const queryRunner = dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

// âœ… CRÃTICO: Seta variÃ¡vel de sessÃ£o para RLS
await queryRunner.manager.query(
  `SELECT set_config('app.current_tenant_id', $1, true)`,
  [tenantId]
);
```

**Por que `SET LOCAL`?**
- `SET LOCAL` sÃ³ existe dentro da transaÃ§Ã£o atual
- NÃ£o vaza para outros requests (seguranÃ§a)
- Automaticamente limpo quando a transaÃ§Ã£o termina

---

### 4. Executa Request no Contexto

```typescript
await dbContext.runWithManager(queryRunner.manager, async () => {
  // Todo cÃ³digo aqui usa o manager da transaÃ§Ã£o
  return await next.handle().toPromise();
});
```

**O que acontece:**
- `AsyncLocalStorage` armazena o manager
- Todos os serviÃ§os que usam `db.getRepository()` recebem repositÃ³rios desse manager
- Todas as queries sÃ£o executadas na mesma transaÃ§Ã£o

---

### 5. Commit ou Rollback

```typescript
try {
  const result = await executeRequest();
  await queryRunner.commitTransaction();
  return result;
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw error;
} finally {
  await queryRunner.release();
}
```

**Comportamento:**
- âœ… Sucesso â†’ COMMIT (todas as mudanÃ§as sÃ£o salvas)
- âŒ Erro â†’ ROLLBACK (todas as mudanÃ§as sÃ£o revertidas)
- ðŸ”’ Sempre â†’ Release do QueryRunner (libera conexÃ£o)

---

## ðŸ” EXTRAÃ‡ÃƒO DE TENANT ID

### Ordem de Prioridade

1. **UsuÃ¡rio Autenticado (JWT)** - Mais confiÃ¡vel
   ```typescript
   req.user?.tenant_id
   ```
   - ExtraÃ­do do JWT pelo `JwtAuthGuard`
   - Sempre correto (usuÃ¡rio sÃ³ pode acessar seu prÃ³prio tenant)

2. **Header HTTP** - Para endpoints pÃºblicos
   ```typescript
   req.headers['x-tenant-id']
   ```
   - Ãštil para endpoints pÃºblicos (ex: WhatsApp webhook)
   - Precisa ser validado manualmente

3. **Body da RequisiÃ§Ã£o** - Ãšltimo recurso
   ```typescript
   req.body?.tenantId || req.body?.tenant_id
   ```
   - Menos seguro (pode ser manipulado)
   - Usado apenas quando necessÃ¡rio

---

### Exemplos de ExtraÃ§Ã£o

#### Exemplo 1: Request Autenticado

```http
POST /api/v1/orders
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**JWT Payload:**
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "tenant_id": "00000000-0000-0000-0000-000000000000"
}
```

**Resultado:** `tenant_id` extraÃ­do do JWT â†’ `req.user.tenant_id`

---

#### Exemplo 2: Request PÃºblico (WhatsApp)

```http
POST /api/v1/whatsapp/webhook
X-Tenant-Id: 00000000-0000-0000-0000-000000000000
```

**Resultado:** `tenant_id` extraÃ­do do header â†’ `req.headers['x-tenant-id']`

---

#### Exemplo 3: Request sem Tenant ID

```http
GET /api/v1/health
```

**Resultado:** Nenhum `tenant_id` encontrado â†’ Request passa sem transaÃ§Ã£o (OK para endpoints pÃºblicos)

---

## âš™ï¸ CONFIGURAÃ‡ÃƒO

### Registro Global

O interceptor Ã© registrado globalmente em `app.module.ts`:

```typescript
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantDbContextInterceptor,
    },
  ],
})
export class AppModule {}
```

**Por que global?**
- Aplica-se a todos os controllers automaticamente
- NÃ£o precisa decorar cada controller
- Garante consistÃªncia em todo o sistema

---

### DependÃªncias

O interceptor precisa de:

1. **DataSource (TypeORM)**
   ```typescript
   @InjectDataSource()
   private readonly dataSource: DataSource
   ```

2. **DbContextService**
   ```typescript
   private readonly dbContext: DbContextService
   ```

Ambos sÃ£o injetados automaticamente pelo NestJS.

---

## ðŸ”’ INTEGRAÃ‡ÃƒO COM RLS

### Como RLS Funciona

O PostgreSQL RLS usa policies que verificam a variÃ¡vel de sessÃ£o:

```sql
-- Policy exemplo
CREATE POLICY tenant_isolation ON produtos
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**O que acontece:**
1. Interceptor seta `app.current_tenant_id = 'tenant-123'`
2. Query tenta acessar `produtos`
3. Policy verifica: `tenant_id = 'tenant-123'`
4. Apenas produtos do tenant-123 sÃ£o retornados

---

### Garantias de SeguranÃ§a

âœ… **Isolamento AutomÃ¡tico:**
- ImpossÃ­vel acessar dados de outro tenant
- RLS aplicado em todas as queries automaticamente
- Zero chance de vazamento de dados

âœ… **TransaÃ§Ãµes Isoladas:**
- Cada request tem sua prÃ³pria transaÃ§Ã£o
- TransaÃ§Ãµes nÃ£o interferem entre si
- Rollback nÃ£o afeta outros requests

âœ… **VariÃ¡vel de SessÃ£o Segura:**
- `SET LOCAL` sÃ³ existe dentro da transaÃ§Ã£o
- NÃ£o vaza para outros requests
- Automaticamente limpo ao final

---

## âœ… BOAS PRÃTICAS

### 1. **Sempre use `db.getRepository()` nos serviÃ§os**

âŒ **Ruim:**
```typescript
@InjectRepository(Produto)
private produtosRepository: Repository<Produto>
```

âœ… **Bom:**
```typescript
constructor(private readonly db: DbContextService) {}

async findAll() {
  const repo = this.db.getRepository(Produto);
}
```

**Por quÃª?** `db.getRepository()` usa o manager da transaÃ§Ã£o do interceptor.

---

### 2. **Endpoints pÃºblicos nÃ£o precisam de tenant_id**

âœ… **OK:**
```typescript
@Get('health')
async health() {
  // NÃ£o precisa de tenant_id
  return { status: 'ok' };
}
```

O interceptor detecta que nÃ£o hÃ¡ `tenant_id` e passa o request sem transaÃ§Ã£o.

---

### 3. **Endpoints autenticados sempre tÃªm tenant_id**

âœ… **OK:**
```typescript
@Get('products')
@UseGuards(JwtAuthGuard)
async findAll(@CurrentTenant() tenantId: string) {
  // tenantId vem do JWT automaticamente
  return await this.productsService.findAll(tenantId);
}
```

O interceptor extrai `tenant_id` do JWT automaticamente.

---

### 4. **NÃ£o crie transaÃ§Ãµes manuais em controllers**

âŒ **Ruim:**
```typescript
async create(@Body() dto: CreateOrderDto) {
  return await this.dataSource.transaction(async (manager) => {
    // TransaÃ§Ã£o manual - nÃ£o usa o interceptor
  });
}
```

âœ… **Bom:**
```typescript
async create(@Body() dto: CreateOrderDto) {
  // Interceptor jÃ¡ gerencia a transaÃ§Ã£o
  return await this.ordersService.create(dto);
}
```

---

## ðŸ› TROUBLESHOOTING

### Problema: "RLS nÃ£o estÃ¡ bloqueando dados de outros tenants"

**Causa:** `app.current_tenant_id` nÃ£o estÃ¡ sendo setado.

**SoluÃ§Ã£o:**
1. Verifique se o interceptor estÃ¡ registrado globalmente
2. Verifique se o `tenant_id` estÃ¡ sendo extraÃ­do corretamente
3. Verifique se as policies RLS estÃ£o criadas no banco

**Debug:**
```typescript
// Adicione log no interceptor
console.log('Tenant ID extraÃ­do:', tenantId);
console.log('Query executada:', await manager.query('SELECT current_setting(\'app.current_tenant_id\')'));
```

---

### Problema: "Erro: relation does not exist"

**Causa:** RLS estÃ¡ bloqueando acesso Ã  tabela porque `tenant_id` nÃ£o foi setado.

**SoluÃ§Ã£o:**
1. Certifique-se de que o request tem `tenant_id` (header, body ou JWT)
2. Verifique se o interceptor estÃ¡ sendo executado
3. Verifique se as policies RLS estÃ£o corretas

---

### Problema: "TransaÃ§Ãµes nÃ£o estÃ£o sendo compartilhadas"

**Causa:** ServiÃ§os estÃ£o usando `@InjectRepository()` ao invÃ©s de `db.getRepository()`.

**SoluÃ§Ã£o:**
```typescript
// âŒ Antes
@InjectRepository(Produto)
private produtosRepository: Repository<Produto>

// âœ… Depois
constructor(private readonly db: DbContextService) {}
const repo = this.db.getRepository(Produto);
```

---

### Problema: "Request lento ou travando"

**Causa:** TransaÃ§Ã£o nÃ£o estÃ¡ sendo commitada/rollbackada.

**SoluÃ§Ã£o:**
1. Verifique se o interceptor estÃ¡ no `finally` block
2. Verifique se nÃ£o hÃ¡ exceÃ§Ãµes nÃ£o tratadas
3. Verifique logs do interceptor para ver se estÃ¡ fazendo commit/rollback

---

## ðŸ“Š ONDE Ã‰ USADO

O interceptor Ã© aplicado **automaticamente** a todos os controllers:

- âœ… Todos os endpoints autenticados
- âœ… Todos os endpoints pÃºblicos (se tiverem `tenant_id`)
- âœ… Webhooks (WhatsApp, pagamentos)
- âœ… Health checks (passa sem transaÃ§Ã£o se nÃ£o tiver `tenant_id`)

---

## ðŸ”— RELACIONADOS

- **[DbContextService](./DBCONTEXT-SERVICE.md)** - ServiÃ§o que gerencia contexto transacional
- **[RLS (Row Level Security)](./04-DATABASE.md#row-level-security-rls)** - SeguranÃ§a multi-tenant no PostgreSQL
- **[Arquitetura Geral](./03-ARCHITECTURE.md)** - VisÃ£o geral da arquitetura

---

## ðŸ“ RESUMO

**O que Ã©:** Interceptor global que gerencia transaÃ§Ãµes por tenant  
**Por que existe:** Garantir RLS correto e transaÃ§Ãµes compartilhadas  
**Como funciona:** Extrai `tenant_id`, abre transaÃ§Ã£o, seta RLS, executa request  
**Quando usar:** Automaticamente em todos os requests (nÃ£o precisa configurar)

---

**Ãšltima atualizaÃ§Ã£o:** 08/01/2025  
**Status:** âœ… **DOCUMENTAÃ‡ÃƒO COMPLETA**

---

## Atualizacao de comportamento (prod)

- Em producao, o tenant e extraido somente do JWT.
- Em dev/test, `x-tenant-id` e `tenantId` no body podem ser aceitos.
- Controle via `ALLOW_TENANT_FROM_REQUEST=true|false`.

