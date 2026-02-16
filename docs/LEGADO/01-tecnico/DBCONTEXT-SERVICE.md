> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# ðŸ”§ DbContextService - DocumentaÃ§Ã£o Completa

> **Data:** 08/01/2025  
> **VersÃ£o:** 1.0  
> **Status:** âœ… **IMPLEMENTADO E EM PRODUÃ‡ÃƒO**  
> **LocalizaÃ§Ã£o:** `backend/src/modules/common/services/db-context.service.ts`

---

## ðŸŽ¯ PROPÃ“SITO

O `DbContextService` Ã© um serviÃ§o centralizado que gerencia o contexto transacional do banco de dados usando `AsyncLocalStorage` do Node.js. Ele permite que mÃºltiplos serviÃ§os compartilhem a mesma transaÃ§Ã£o automaticamente, garantindo consistÃªncia ACID e suportando transaÃ§Ãµes aninhadas.

---

## ðŸ“‹ ÃNDICE

1. [VisÃ£o Geral](#visÃ£o-geral)
2. [Por Que Foi Criado](#por-que-foi-criado)
3. [Como Funciona](#como-funciona)
4. [API Completa](#api-completa)
5. [Exemplos de Uso](#exemplos-de-uso)
6. [IntegraÃ§Ã£o com RLS](#integraÃ§Ã£o-com-rls)
7. [Boas PrÃ¡ticas](#boas-prÃ¡ticas)
8. [Troubleshooting](#troubleshooting)

---

## ðŸŽ¯ VISÃƒO GERAL

### Problema que Resolve

**Antes do DbContextService:**
- Cada serviÃ§o precisava gerenciar suas prÃ³prias transaÃ§Ãµes
- DifÃ­cil compartilhar transaÃ§Ã£o entre mÃºltiplos serviÃ§os
- RLS (Row Level Security) nÃ£o funcionava corretamente sem contexto de tenant
- TransaÃ§Ãµes aninhadas eram complexas de implementar

**Com DbContextService:**
- âœ… TransaÃ§Ãµes compartilhadas automaticamente
- âœ… RLS funciona corretamente via `TenantDbContextInterceptor`
- âœ… TransaÃ§Ãµes aninhadas suportadas (reutiliza manager se jÃ¡ existe)
- âœ… CÃ³digo mais limpo e manutenÃ­vel

---

## ðŸ¤” POR QUE FOI CRIADO

### 1. **Isolamento Multi-Tenant com RLS**

O PostgreSQL RLS (Row Level Security) requer que o `tenant_id` seja definido como variÃ¡vel de sessÃ£o (`app.current_tenant_id`). O `DbContextService` trabalha em conjunto com o `TenantDbContextInterceptor` para garantir que todas as queries dentro de uma transaÃ§Ã£o usem o tenant correto.

### 2. **TransaÃ§Ãµes Compartilhadas**

Quando mÃºltiplos serviÃ§os precisam trabalhar na mesma transaÃ§Ã£o (ex: criar pedido + abater estoque + criar pagamento), o `DbContextService` permite que todos compartilhem o mesmo `EntityManager` automaticamente.

### 3. **TransaÃ§Ãµes Aninhadas**

Se um serviÃ§o jÃ¡ estÃ¡ dentro de uma transaÃ§Ã£o e chama outro serviÃ§o que tambÃ©m precisa de transaÃ§Ã£o, o `DbContextService` detecta e reutiliza o manager existente ao invÃ©s de criar uma nova transaÃ§Ã£o.

---

## âš™ï¸ COMO FUNCIONA

### Arquitetura

```
Request HTTP
    â†“
TenantDbContextInterceptor (extrai tenant_id)
    â†“
Abre transaÃ§Ã£o + seta app.current_tenant_id
    â†“
DbContextService.runWithManager(manager, callback)
    â†“
AsyncLocalStorage armazena manager
    â†“
ServiÃ§os chamam db.getRepository() ou db.runInTransaction()
    â†“
DbContextService retorna manager do AsyncLocalStorage
    â†“
Todas as queries usam o mesmo manager (mesma transaÃ§Ã£o)
    â†“
Commit ou Rollback automÃ¡tico
```

### AsyncLocalStorage

O `AsyncLocalStorage` Ã© uma API do Node.js que permite armazenar dados no contexto assÃ­ncrono. Isso significa que:

- Cada request HTTP tem seu prÃ³prio contexto
- O contexto Ã© automaticamente propagado para todas as funÃ§Ãµes assÃ­ncronas chamadas dentro do request
- NÃ£o hÃ¡ vazamento de contexto entre requests diferentes

---

## ðŸ“š API COMPLETA

### `getManager(): EntityManager`

Retorna o `EntityManager` atual do contexto. Se nÃ£o houver contexto (fora de transaÃ§Ã£o), retorna o manager padrÃ£o do `DataSource`.

```typescript
const manager = dbContext.getManager();
const produtos = await manager.find(Produto, { where: { tenant_id } });
```

**Uso:** Raramente usado diretamente. Prefira `getRepository()`.

---

### `getRepository<T>(target: EntityTarget<T>): Repository<T>`

Retorna um repositÃ³rio TypeORM para a entidade especificada, usando o manager do contexto atual.

```typescript
const usuariosRepo = dbContext.getRepository(Usuario);
const usuario = await usuariosRepo.findOne({ where: { id } });
```

**Uso:** **RECOMENDADO** - Use este mÃ©todo ao invÃ©s de injetar `@InjectRepository()` diretamente.

**Vantagens:**
- âœ… Automaticamente usa o manager da transaÃ§Ã£o atual
- âœ… RLS funciona corretamente
- âœ… Compartilha transaÃ§Ã£o com outros serviÃ§os

---

### `runWithManager<T>(manager: EntityManager, fn: () => Promise<T>): Promise<T>`

Executa uma funÃ§Ã£o dentro de um contexto especÃ­fico de manager. Usado internamente pelo `TenantDbContextInterceptor`.

```typescript
await dbContext.runWithManager(manager, async () => {
  // Todo cÃ³digo aqui usa o manager fornecido
  const repo = dbContext.getRepository(Usuario);
  // repo usa o manager do contexto
});
```

**Uso:** Principalmente usado pelo interceptor. Raramente usado diretamente em serviÃ§os.

---

### `runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T>`

Executa uma funÃ§Ã£o dentro de uma transaÃ§Ã£o. Se jÃ¡ estiver dentro de uma transaÃ§Ã£o, reutiliza o manager existente.

```typescript
const pedido = await dbContext.runInTransaction(async (manager) => {
  // Se jÃ¡ estiver em transaÃ§Ã£o, manager Ã© o mesmo
  // Se nÃ£o, cria nova transaÃ§Ã£o
  
  const pedidoRepo = manager.getRepository(Pedido);
  const estoqueRepo = manager.getRepository(MovimentacaoEstoque);
  
  // Todas as operaÃ§Ãµes sÃ£o atÃ´micas
  const pedido = await pedidoRepo.save(novoPedido);
  await estoqueRepo.update({ produto_id }, { current_stock: () => 'current_stock - 1' });
  
  return pedido;
});
```

**Uso:** **RECOMENDADO** para operaÃ§Ãµes que precisam de transaÃ§Ã£o explÃ­cita.

**Comportamento:**
- Se jÃ¡ estiver em transaÃ§Ã£o: reutiliza o manager (transaÃ§Ã£o aninhada)
- Se nÃ£o estiver: cria nova transaÃ§Ã£o

---

## ðŸ’¡ EXEMPLOS DE USO

### Exemplo 1: Uso BÃ¡sico em ServiÃ§o

```typescript
@Injectable()
export class ProductsService {
  constructor(
    private readonly db: DbContextService,
  ) {}

  async findAll(tenantId: string): Promise<Produto[]> {
    // âœ… Usa getRepository() - automaticamente usa transaÃ§Ã£o atual
    const produtosRepo = this.db.getRepository(Produto);
    
    return await produtosRepo.find({
      where: { tenant_id: tenantId, is_active: true },
    });
  }
}
```

---

### Exemplo 2: TransaÃ§Ã£o ExplÃ­cita

```typescript
@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DbContextService,
  ) {}

  async create(dto: CreateOrderDto, tenantId: string): Promise<Pedido> {
    // âœ… runInTransaction garante atomicidade
    return await this.db.runInTransaction(async (manager) => {
      // 1. Validar estoque
      const estoqueRepo = manager.getRepository(MovimentacaoEstoque);
      const estoques = await estoqueRepo.find({
        where: { tenant_id: tenantId, produto_id: In(dto.items.map(i => i.produto_id)) },
      });

      // 2. Abater estoque
      for (const item of dto.items) {
        await estoqueRepo.update(
          { produto_id: item.produto_id },
          { current_stock: () => `current_stock - ${item.quantity}` },
        );
      }

      // 3. Criar pedido
      const pedidoRepo = manager.getRepository(Pedido);
      const pedido = pedidoRepo.create({ ...dto, tenant_id: tenantId });
      return await pedidoRepo.save(pedido);
    });
  }
}
```

---

### Exemplo 3: TransaÃ§Ã£o Aninhada

```typescript
@Injectable()
export class OrdersService {
  async create(dto: CreateOrderDto, tenantId: string): Promise<Pedido> {
    // TransaÃ§Ã£o externa (pode vir do interceptor)
    return await this.db.runInTransaction(async (manager) => {
      const pedido = await this.criarPedido(dto, tenantId);
      
      // âœ… Chamar outro mÃ©todo que tambÃ©m usa runInTransaction
      // O manager serÃ¡ reutilizado (nÃ£o cria nova transaÃ§Ã£o)
      await this.processarPagamento(pedido.id, tenantId);
      
      return pedido;
    });
  }

  private async processarPagamento(pedidoId: string, tenantId: string): Promise<void> {
    // âœ… Se jÃ¡ estiver em transaÃ§Ã£o, reutiliza o manager
    await this.db.runInTransaction(async (manager) => {
      const pagamentoRepo = manager.getRepository(Pagamento);
      // ... criar pagamento
    });
  }
}
```

---

### Exemplo 4: MigraÃ§Ã£o de CÃ³digo Antigo

**Antes (sem DbContextService):**
```typescript
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Produto)
    private produtosRepository: Repository<Produto>,
  ) {}

  async findAll(tenantId: string): Promise<Produto[]> {
    return await this.produtosRepository.find({
      where: { tenant_id: tenantId },
    });
  }
}
```

**Depois (com DbContextService):**
```typescript
@Injectable()
export class ProductsService {
  constructor(
    private readonly db: DbContextService,
  ) {}

  async findAll(tenantId: string): Promise<Produto[]> {
    const produtosRepo = this.db.getRepository(Produto);
    return await produtosRepo.find({
      where: { tenant_id: tenantId },
    });
  }
}
```

**Vantagens:**
- âœ… Automaticamente usa transaÃ§Ã£o do interceptor
- âœ… RLS funciona corretamente
- âœ… Pode compartilhar transaÃ§Ã£o com outros serviÃ§os

---

## ðŸ”’ INTEGRAÃ‡ÃƒO COM RLS

O `DbContextService` trabalha em conjunto com o `TenantDbContextInterceptor` para garantir que o RLS funcione corretamente:

1. **Interceptor extrai `tenant_id`** do request (header, body ou JWT)
2. **Interceptor abre transaÃ§Ã£o** e seta `app.current_tenant_id`
3. **Interceptor chama `dbContext.runWithManager()`** passando o manager da transaÃ§Ã£o
4. **ServiÃ§os usam `db.getRepository()`** que retorna repositÃ³rio do manager da transaÃ§Ã£o
5. **Todas as queries** automaticamente usam o `tenant_id` correto via RLS

**Resultado:** Zero chance de vazamento de dados entre tenants.

---

## âœ… BOAS PRÃTICAS

### 1. **Sempre use `getRepository()` ao invÃ©s de injetar `@InjectRepository()`**

âŒ **Ruim:**
```typescript
constructor(
  @InjectRepository(Produto)
  private produtosRepository: Repository<Produto>,
) {}
```

âœ… **Bom:**
```typescript
constructor(
  private readonly db: DbContextService,
) {}

async findAll() {
  const produtosRepo = this.db.getRepository(Produto);
  // ...
}
```

---

### 2. **Use `runInTransaction()` para operaÃ§Ãµes que precisam de atomicidade**

âœ… **Bom:**
```typescript
await this.db.runInTransaction(async (manager) => {
  // MÃºltiplas operaÃ§Ãµes atÃ´micas
  await repo1.save(entity1);
  await repo2.update(...);
  await repo3.delete(...);
});
```

---

### 3. **NÃ£o crie transaÃ§Ãµes desnecessÃ¡rias**

âŒ **Ruim:**
```typescript
// Se jÃ¡ estiver em transaÃ§Ã£o (via interceptor), nÃ£o precisa criar outra
await this.db.runInTransaction(async (manager) => {
  const repo = this.db.getRepository(Produto);
  // Apenas uma query - nÃ£o precisa de transaÃ§Ã£o explÃ­cita
  return await repo.find();
});
```

âœ… **Bom:**
```typescript
// Deixa o interceptor gerenciar a transaÃ§Ã£o
const repo = this.db.getRepository(Produto);
return await repo.find();
```

---

### 4. **Use `runInTransaction()` quando precisar de controle explÃ­cito**

âœ… **Bom:**
```typescript
// OperaÃ§Ã£o crÃ­tica que precisa de rollback explÃ­cito
await this.db.runInTransaction(async (manager) => {
  try {
    await this.operacao1();
    await this.operacao2();
  } catch (error) {
    // Rollback automÃ¡tico
    throw error;
  }
});
```

---

## ðŸ› TROUBLESHOOTING

### Problema: "RLS nÃ£o estÃ¡ funcionando"

**Causa:** NÃ£o estÃ¡ usando `DbContextService` ou nÃ£o estÃ¡ dentro de uma transaÃ§Ã£o gerenciada pelo interceptor.

**SoluÃ§Ã£o:**
1. Certifique-se de que o `TenantDbContextInterceptor` estÃ¡ registrado globalmente
2. Use `db.getRepository()` ao invÃ©s de `@InjectRepository()`
3. Verifique se o `tenant_id` estÃ¡ sendo extraÃ­do corretamente pelo interceptor

---

### Problema: "TransaÃ§Ãµes nÃ£o estÃ£o sendo compartilhadas"

**Causa:** EstÃ¡ usando `@InjectRepository()` ao invÃ©s de `db.getRepository()`.

**SoluÃ§Ã£o:**
```typescript
// âŒ Antes
constructor(
  @InjectRepository(Produto)
  private produtosRepository: Repository<Produto>,
) {}

// âœ… Depois
constructor(
  private readonly db: DbContextService,
) {}

async findAll() {
  const produtosRepo = this.db.getRepository(Produto);
}
```

---

### Problema: "Erro: Cannot read property 'manager' of undefined"

**Causa:** Tentando usar `db.getRepository()` fora de um contexto transacional.

**SoluÃ§Ã£o:**
- Se estiver em um request HTTP: o interceptor deve gerenciar a transaÃ§Ã£o
- Se estiver em um script/background job: use `runInTransaction()` explicitamente

---

## ðŸ“Š ONDE Ã‰ USADO

O `DbContextService` Ã© usado em **todos os serviÃ§os principais**:

- âœ… `AuthService` - AutenticaÃ§Ã£o e registro
- âœ… `OrdersService` - CriaÃ§Ã£o e gestÃ£o de pedidos
- âœ… `ProductsService` - GestÃ£o de produtos
- âœ… `CouponsService` - Sistema de cupons
- âœ… `PaymentsService` - Processamento de pagamentos
- âœ… `ConversationService` - GestÃ£o de conversas WhatsApp
- âœ… `AuditLogService` - Logs de auditoria
- âœ… `IdempotencyService` - IdempotÃªncia de operaÃ§Ãµes

---

## ðŸ”— RELACIONADOS

- **[TenantDbContextInterceptor](./TENANT-DB-CONTEXT-INTERCEPTOR.md)** - Interceptor que gerencia transaÃ§Ãµes por tenant
- **[RLS (Row Level Security)](./04-DATABASE.md#row-level-security-rls)** - SeguranÃ§a multi-tenant no PostgreSQL
- **[Arquitetura Geral](./03-ARCHITECTURE.md)** - VisÃ£o geral da arquitetura

---

## ðŸ“ RESUMO

**O que Ã©:** ServiÃ§o centralizado para gerenciar contexto transacional  
**Por que existe:** Garantir RLS correto e transaÃ§Ãµes compartilhadas  
**Como usar:** `db.getRepository(Entity)` e `db.runInTransaction()`  
**Quando usar:** Sempre que precisar acessar o banco de dados

---

**Ãšltima atualizaÃ§Ã£o:** 08/01/2025  
**Status:** âœ… **DOCUMENTAÃ‡ÃƒO COMPLETA**

