# 🔒 TenantDbContextInterceptor - Documentação Completa

> **Data:** 08/01/2025  
> **Versão:** 1.0  
> **Status:** ✅ **IMPLEMENTADO E EM PRODUÇÃO**  
> **Localização:** `backend/src/common/interceptors/tenant-db-context.interceptor.ts`

---

## 🎯 PROPÓSITO

O `TenantDbContextInterceptor` é um interceptor global do NestJS que gerencia automaticamente transações de banco de dados por tenant, garantindo que o RLS (Row Level Security) do PostgreSQL funcione corretamente em todas as requisições HTTP.

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Por Que Foi Criado](#por-que-foi-criado)
3. [Como Funciona](#como-funciona)
4. [Fluxo Completo](#fluxo-completo)
5. [Extração de Tenant ID](#extração-de-tenant-id)
6. [Configuração](#configuração)
7. [Integração com RLS](#integração-com-rls)
8. [Boas Práticas](#boas-práticas)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 VISÃO GERAL

### Problema que Resolve

**Antes do Interceptor:**
- Cada serviço precisava setar `app.current_tenant_id` manualmente
- RLS não funcionava automaticamente
- Fácil esquecer de setar o tenant_id
- Transações não eram compartilhadas entre serviços

**Com o Interceptor:**
- ✅ `tenant_id` extraído automaticamente de cada request
- ✅ `app.current_tenant_id` setado automaticamente para RLS
- ✅ Transação compartilhada entre todos os serviços do request
- ✅ Zero configuração manual necessária

---

## 🤔 POR QUE FOI CRIADO

### 1. **RLS Requer Variável de Sessão**

O PostgreSQL RLS funciona através de variáveis de sessão (`SET LOCAL app.current_tenant_id`). Essas variáveis só existem dentro de uma transação e precisam ser setadas antes de qualquer query.

**Solução:** O interceptor abre uma transação no início de cada request e seta a variável automaticamente.

---

### 2. **Isolamento Multi-Tenant Automático**

Sem o interceptor, cada serviço precisaria:
1. Extrair `tenant_id` do request
2. Abrir transação
3. Setar `app.current_tenant_id`
4. Fazer queries
5. Commit/rollback

**Solução:** O interceptor faz tudo isso automaticamente, garantindo que nenhum serviço esqueça de setar o tenant_id.

---

### 3. **Transações Compartilhadas**

Quando múltiplos serviços são chamados no mesmo request (ex: criar pedido → abater estoque → criar pagamento), todos precisam estar na mesma transação.

**Solução:** O interceptor cria uma transação no início do request e todos os serviços compartilham essa transação via `DbContextService`.

---

## ⚙️ COMO FUNCIONA

### Arquitetura

```
Request HTTP chega
    ↓
TenantDbContextInterceptor.intercept()
    ↓
Extrai tenant_id (header, body ou JWT)
    ↓
Se não tem tenant_id → passa request sem transação
    ↓
Se tem tenant_id:
    ↓
Cria QueryRunner e abre transação
    ↓
Seta app.current_tenant_id = tenant_id (SET LOCAL)
    ↓
dbContext.runWithManager(manager, callback)
    ↓
Executa handler do controller/service
    ↓
Todos os serviços usam db.getRepository()
    ↓
Todas as queries usam o mesmo manager (mesma transação)
    ↓
Se sucesso → COMMIT
Se erro → ROLLBACK
    ↓
Release QueryRunner
```

---

## 🔄 FLUXO COMPLETO

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

1. **Do usuário autenticado (JWT):**
   ```typescript
   req.user?.tenant_id
   ```

2. **Do header HTTP:**
   ```typescript
   req.headers['x-tenant-id']
   ```

3. **Do body da requisição:**
   ```typescript
   req.body?.tenantId || req.body?.tenant_id
   ```

**Se encontrar:** Continua com transação  
**Se não encontrar:** Passa request sem transação (endpoints públicos)

---

### 3. Abre Transação e Seta RLS

```typescript
const queryRunner = dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

// ✅ CRÍTICO: Seta variável de sessão para RLS
await queryRunner.manager.query(
  `SELECT set_config('app.current_tenant_id', $1, true)`,
  [tenantId]
);
```

**Por que `SET LOCAL`?**
- `SET LOCAL` só existe dentro da transação atual
- Não vaza para outros requests (segurança)
- Automaticamente limpo quando a transação termina

---

### 4. Executa Request no Contexto

```typescript
await dbContext.runWithManager(queryRunner.manager, async () => {
  // Todo código aqui usa o manager da transação
  return await next.handle().toPromise();
});
```

**O que acontece:**
- `AsyncLocalStorage` armazena o manager
- Todos os serviços que usam `db.getRepository()` recebem repositórios desse manager
- Todas as queries são executadas na mesma transação

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
- ✅ Sucesso → COMMIT (todas as mudanças são salvas)
- ❌ Erro → ROLLBACK (todas as mudanças são revertidas)
- 🔒 Sempre → Release do QueryRunner (libera conexão)

---

## 🔍 EXTRAÇÃO DE TENANT ID

### Ordem de Prioridade

1. **Usuário Autenticado (JWT)** - Mais confiável
   ```typescript
   req.user?.tenant_id
   ```
   - Extraído do JWT pelo `JwtAuthGuard`
   - Sempre correto (usuário só pode acessar seu próprio tenant)

2. **Header HTTP** - Para endpoints públicos
   ```typescript
   req.headers['x-tenant-id']
   ```
   - Útil para endpoints públicos (ex: WhatsApp webhook)
   - Precisa ser validado manualmente

3. **Body da Requisição** - Último recurso
   ```typescript
   req.body?.tenantId || req.body?.tenant_id
   ```
   - Menos seguro (pode ser manipulado)
   - Usado apenas quando necessário

---

### Exemplos de Extração

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

**Resultado:** `tenant_id` extraído do JWT → `req.user.tenant_id`

---

#### Exemplo 2: Request Público (WhatsApp)

```http
POST /api/v1/whatsapp/webhook
X-Tenant-Id: 00000000-0000-0000-0000-000000000000
```

**Resultado:** `tenant_id` extraído do header → `req.headers['x-tenant-id']`

---

#### Exemplo 3: Request sem Tenant ID

```http
GET /api/v1/health
```

**Resultado:** Nenhum `tenant_id` encontrado → Request passa sem transação (OK para endpoints públicos)

---

## ⚙️ CONFIGURAÇÃO

### Registro Global

O interceptor é registrado globalmente em `app.module.ts`:

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
- Não precisa decorar cada controller
- Garante consistência em todo o sistema

---

### Dependências

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

Ambos são injetados automaticamente pelo NestJS.

---

## 🔒 INTEGRAÇÃO COM RLS

### Como RLS Funciona

O PostgreSQL RLS usa policies que verificam a variável de sessão:

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
4. Apenas produtos do tenant-123 são retornados

---

### Garantias de Segurança

✅ **Isolamento Automático:**
- Impossível acessar dados de outro tenant
- RLS aplicado em todas as queries automaticamente
- Zero chance de vazamento de dados

✅ **Transações Isoladas:**
- Cada request tem sua própria transação
- Transações não interferem entre si
- Rollback não afeta outros requests

✅ **Variável de Sessão Segura:**
- `SET LOCAL` só existe dentro da transação
- Não vaza para outros requests
- Automaticamente limpo ao final

---

## ✅ BOAS PRÁTICAS

### 1. **Sempre use `db.getRepository()` nos serviços**

❌ **Ruim:**
```typescript
@InjectRepository(Produto)
private produtosRepository: Repository<Produto>
```

✅ **Bom:**
```typescript
constructor(private readonly db: DbContextService) {}

async findAll() {
  const repo = this.db.getRepository(Produto);
}
```

**Por quê?** `db.getRepository()` usa o manager da transação do interceptor.

---

### 2. **Endpoints públicos não precisam de tenant_id**

✅ **OK:**
```typescript
@Get('health')
async health() {
  // Não precisa de tenant_id
  return { status: 'ok' };
}
```

O interceptor detecta que não há `tenant_id` e passa o request sem transação.

---

### 3. **Endpoints autenticados sempre têm tenant_id**

✅ **OK:**
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

### 4. **Não crie transações manuais em controllers**

❌ **Ruim:**
```typescript
async create(@Body() dto: CreateOrderDto) {
  return await this.dataSource.transaction(async (manager) => {
    // Transação manual - não usa o interceptor
  });
}
```

✅ **Bom:**
```typescript
async create(@Body() dto: CreateOrderDto) {
  // Interceptor já gerencia a transação
  return await this.ordersService.create(dto);
}
```

---

## 🐛 TROUBLESHOOTING

### Problema: "RLS não está bloqueando dados de outros tenants"

**Causa:** `app.current_tenant_id` não está sendo setado.

**Solução:**
1. Verifique se o interceptor está registrado globalmente
2. Verifique se o `tenant_id` está sendo extraído corretamente
3. Verifique se as policies RLS estão criadas no banco

**Debug:**
```typescript
// Adicione log no interceptor
console.log('Tenant ID extraído:', tenantId);
console.log('Query executada:', await manager.query('SELECT current_setting(\'app.current_tenant_id\')'));
```

---

### Problema: "Erro: relation does not exist"

**Causa:** RLS está bloqueando acesso à tabela porque `tenant_id` não foi setado.

**Solução:**
1. Certifique-se de que o request tem `tenant_id` (header, body ou JWT)
2. Verifique se o interceptor está sendo executado
3. Verifique se as policies RLS estão corretas

---

### Problema: "Transações não estão sendo compartilhadas"

**Causa:** Serviços estão usando `@InjectRepository()` ao invés de `db.getRepository()`.

**Solução:**
```typescript
// ❌ Antes
@InjectRepository(Produto)
private produtosRepository: Repository<Produto>

// ✅ Depois
constructor(private readonly db: DbContextService) {}
const repo = this.db.getRepository(Produto);
```

---

### Problema: "Request lento ou travando"

**Causa:** Transação não está sendo commitada/rollbackada.

**Solução:**
1. Verifique se o interceptor está no `finally` block
2. Verifique se não há exceções não tratadas
3. Verifique logs do interceptor para ver se está fazendo commit/rollback

---

## 📊 ONDE É USADO

O interceptor é aplicado **automaticamente** a todos os controllers:

- ✅ Todos os endpoints autenticados
- ✅ Todos os endpoints públicos (se tiverem `tenant_id`)
- ✅ Webhooks (WhatsApp, pagamentos)
- ✅ Health checks (passa sem transação se não tiver `tenant_id`)

---

## 🔗 RELACIONADOS

- **[DbContextService](./DBCONTEXT-SERVICE.md)** - Serviço que gerencia contexto transacional
- **[RLS (Row Level Security)](./04-DATABASE.md#row-level-security-rls)** - Segurança multi-tenant no PostgreSQL
- **[Arquitetura Geral](./03-ARCHITECTURE.md)** - Visão geral da arquitetura

---

## 📝 RESUMO

**O que é:** Interceptor global que gerencia transações por tenant  
**Por que existe:** Garantir RLS correto e transações compartilhadas  
**Como funciona:** Extrai `tenant_id`, abre transação, seta RLS, executa request  
**Quando usar:** Automaticamente em todos os requests (não precisa configurar)

---

**Última atualização:** 08/01/2025  
**Status:** ✅ **DOCUMENTAÇÃO COMPLETA**
