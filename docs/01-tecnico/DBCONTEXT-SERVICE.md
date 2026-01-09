# 🔧 DbContextService - Documentação Completa

> **Data:** 08/01/2025  
> **Versão:** 1.0  
> **Status:** ✅ **IMPLEMENTADO E EM PRODUÇÃO**  
> **Localização:** `backend/src/modules/common/services/db-context.service.ts`

---

## 🎯 PROPÓSITO

O `DbContextService` é um serviço centralizado que gerencia o contexto transacional do banco de dados usando `AsyncLocalStorage` do Node.js. Ele permite que múltiplos serviços compartilhem a mesma transação automaticamente, garantindo consistência ACID e suportando transações aninhadas.

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Por Que Foi Criado](#por-que-foi-criado)
3. [Como Funciona](#como-funciona)
4. [API Completa](#api-completa)
5. [Exemplos de Uso](#exemplos-de-uso)
6. [Integração com RLS](#integração-com-rls)
7. [Boas Práticas](#boas-práticas)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 VISÃO GERAL

### Problema que Resolve

**Antes do DbContextService:**
- Cada serviço precisava gerenciar suas próprias transações
- Difícil compartilhar transação entre múltiplos serviços
- RLS (Row Level Security) não funcionava corretamente sem contexto de tenant
- Transações aninhadas eram complexas de implementar

**Com DbContextService:**
- ✅ Transações compartilhadas automaticamente
- ✅ RLS funciona corretamente via `TenantDbContextInterceptor`
- ✅ Transações aninhadas suportadas (reutiliza manager se já existe)
- ✅ Código mais limpo e manutenível

---

## 🤔 POR QUE FOI CRIADO

### 1. **Isolamento Multi-Tenant com RLS**

O PostgreSQL RLS (Row Level Security) requer que o `tenant_id` seja definido como variável de sessão (`app.current_tenant_id`). O `DbContextService` trabalha em conjunto com o `TenantDbContextInterceptor` para garantir que todas as queries dentro de uma transação usem o tenant correto.

### 2. **Transações Compartilhadas**

Quando múltiplos serviços precisam trabalhar na mesma transação (ex: criar pedido + abater estoque + criar pagamento), o `DbContextService` permite que todos compartilhem o mesmo `EntityManager` automaticamente.

### 3. **Transações Aninhadas**

Se um serviço já está dentro de uma transação e chama outro serviço que também precisa de transação, o `DbContextService` detecta e reutiliza o manager existente ao invés de criar uma nova transação.

---

## ⚙️ COMO FUNCIONA

### Arquitetura

```
Request HTTP
    ↓
TenantDbContextInterceptor (extrai tenant_id)
    ↓
Abre transação + seta app.current_tenant_id
    ↓
DbContextService.runWithManager(manager, callback)
    ↓
AsyncLocalStorage armazena manager
    ↓
Serviços chamam db.getRepository() ou db.runInTransaction()
    ↓
DbContextService retorna manager do AsyncLocalStorage
    ↓
Todas as queries usam o mesmo manager (mesma transação)
    ↓
Commit ou Rollback automático
```

### AsyncLocalStorage

O `AsyncLocalStorage` é uma API do Node.js que permite armazenar dados no contexto assíncrono. Isso significa que:

- Cada request HTTP tem seu próprio contexto
- O contexto é automaticamente propagado para todas as funções assíncronas chamadas dentro do request
- Não há vazamento de contexto entre requests diferentes

---

## 📚 API COMPLETA

### `getManager(): EntityManager`

Retorna o `EntityManager` atual do contexto. Se não houver contexto (fora de transação), retorna o manager padrão do `DataSource`.

```typescript
const manager = dbContext.getManager();
const produtos = await manager.find(Produto, { where: { tenant_id } });
```

**Uso:** Raramente usado diretamente. Prefira `getRepository()`.

---

### `getRepository<T>(target: EntityTarget<T>): Repository<T>`

Retorna um repositório TypeORM para a entidade especificada, usando o manager do contexto atual.

```typescript
const usuariosRepo = dbContext.getRepository(Usuario);
const usuario = await usuariosRepo.findOne({ where: { id } });
```

**Uso:** **RECOMENDADO** - Use este método ao invés de injetar `@InjectRepository()` diretamente.

**Vantagens:**
- ✅ Automaticamente usa o manager da transação atual
- ✅ RLS funciona corretamente
- ✅ Compartilha transação com outros serviços

---

### `runWithManager<T>(manager: EntityManager, fn: () => Promise<T>): Promise<T>`

Executa uma função dentro de um contexto específico de manager. Usado internamente pelo `TenantDbContextInterceptor`.

```typescript
await dbContext.runWithManager(manager, async () => {
  // Todo código aqui usa o manager fornecido
  const repo = dbContext.getRepository(Usuario);
  // repo usa o manager do contexto
});
```

**Uso:** Principalmente usado pelo interceptor. Raramente usado diretamente em serviços.

---

### `runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T>`

Executa uma função dentro de uma transação. Se já estiver dentro de uma transação, reutiliza o manager existente.

```typescript
const pedido = await dbContext.runInTransaction(async (manager) => {
  // Se já estiver em transação, manager é o mesmo
  // Se não, cria nova transação
  
  const pedidoRepo = manager.getRepository(Pedido);
  const estoqueRepo = manager.getRepository(MovimentacaoEstoque);
  
  // Todas as operações são atômicas
  const pedido = await pedidoRepo.save(novoPedido);
  await estoqueRepo.update({ produto_id }, { current_stock: () => 'current_stock - 1' });
  
  return pedido;
});
```

**Uso:** **RECOMENDADO** para operações que precisam de transação explícita.

**Comportamento:**
- Se já estiver em transação: reutiliza o manager (transação aninhada)
- Se não estiver: cria nova transação

---

## 💡 EXEMPLOS DE USO

### Exemplo 1: Uso Básico em Serviço

```typescript
@Injectable()
export class ProductsService {
  constructor(
    private readonly db: DbContextService,
  ) {}

  async findAll(tenantId: string): Promise<Produto[]> {
    // ✅ Usa getRepository() - automaticamente usa transação atual
    const produtosRepo = this.db.getRepository(Produto);
    
    return await produtosRepo.find({
      where: { tenant_id: tenantId, is_active: true },
    });
  }
}
```

---

### Exemplo 2: Transação Explícita

```typescript
@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DbContextService,
  ) {}

  async create(dto: CreateOrderDto, tenantId: string): Promise<Pedido> {
    // ✅ runInTransaction garante atomicidade
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

### Exemplo 3: Transação Aninhada

```typescript
@Injectable()
export class OrdersService {
  async create(dto: CreateOrderDto, tenantId: string): Promise<Pedido> {
    // Transação externa (pode vir do interceptor)
    return await this.db.runInTransaction(async (manager) => {
      const pedido = await this.criarPedido(dto, tenantId);
      
      // ✅ Chamar outro método que também usa runInTransaction
      // O manager será reutilizado (não cria nova transação)
      await this.processarPagamento(pedido.id, tenantId);
      
      return pedido;
    });
  }

  private async processarPagamento(pedidoId: string, tenantId: string): Promise<void> {
    // ✅ Se já estiver em transação, reutiliza o manager
    await this.db.runInTransaction(async (manager) => {
      const pagamentoRepo = manager.getRepository(Pagamento);
      // ... criar pagamento
    });
  }
}
```

---

### Exemplo 4: Migração de Código Antigo

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
- ✅ Automaticamente usa transação do interceptor
- ✅ RLS funciona corretamente
- ✅ Pode compartilhar transação com outros serviços

---

## 🔒 INTEGRAÇÃO COM RLS

O `DbContextService` trabalha em conjunto com o `TenantDbContextInterceptor` para garantir que o RLS funcione corretamente:

1. **Interceptor extrai `tenant_id`** do request (header, body ou JWT)
2. **Interceptor abre transação** e seta `app.current_tenant_id`
3. **Interceptor chama `dbContext.runWithManager()`** passando o manager da transação
4. **Serviços usam `db.getRepository()`** que retorna repositório do manager da transação
5. **Todas as queries** automaticamente usam o `tenant_id` correto via RLS

**Resultado:** Zero chance de vazamento de dados entre tenants.

---

## ✅ BOAS PRÁTICAS

### 1. **Sempre use `getRepository()` ao invés de injetar `@InjectRepository()`**

❌ **Ruim:**
```typescript
constructor(
  @InjectRepository(Produto)
  private produtosRepository: Repository<Produto>,
) {}
```

✅ **Bom:**
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

### 2. **Use `runInTransaction()` para operações que precisam de atomicidade**

✅ **Bom:**
```typescript
await this.db.runInTransaction(async (manager) => {
  // Múltiplas operações atômicas
  await repo1.save(entity1);
  await repo2.update(...);
  await repo3.delete(...);
});
```

---

### 3. **Não crie transações desnecessárias**

❌ **Ruim:**
```typescript
// Se já estiver em transação (via interceptor), não precisa criar outra
await this.db.runInTransaction(async (manager) => {
  const repo = this.db.getRepository(Produto);
  // Apenas uma query - não precisa de transação explícita
  return await repo.find();
});
```

✅ **Bom:**
```typescript
// Deixa o interceptor gerenciar a transação
const repo = this.db.getRepository(Produto);
return await repo.find();
```

---

### 4. **Use `runInTransaction()` quando precisar de controle explícito**

✅ **Bom:**
```typescript
// Operação crítica que precisa de rollback explícito
await this.db.runInTransaction(async (manager) => {
  try {
    await this.operacao1();
    await this.operacao2();
  } catch (error) {
    // Rollback automático
    throw error;
  }
});
```

---

## 🐛 TROUBLESHOOTING

### Problema: "RLS não está funcionando"

**Causa:** Não está usando `DbContextService` ou não está dentro de uma transação gerenciada pelo interceptor.

**Solução:**
1. Certifique-se de que o `TenantDbContextInterceptor` está registrado globalmente
2. Use `db.getRepository()` ao invés de `@InjectRepository()`
3. Verifique se o `tenant_id` está sendo extraído corretamente pelo interceptor

---

### Problema: "Transações não estão sendo compartilhadas"

**Causa:** Está usando `@InjectRepository()` ao invés de `db.getRepository()`.

**Solução:**
```typescript
// ❌ Antes
constructor(
  @InjectRepository(Produto)
  private produtosRepository: Repository<Produto>,
) {}

// ✅ Depois
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

**Solução:**
- Se estiver em um request HTTP: o interceptor deve gerenciar a transação
- Se estiver em um script/background job: use `runInTransaction()` explicitamente

---

## 📊 ONDE É USADO

O `DbContextService` é usado em **todos os serviços principais**:

- ✅ `AuthService` - Autenticação e registro
- ✅ `OrdersService` - Criação e gestão de pedidos
- ✅ `ProductsService` - Gestão de produtos
- ✅ `CouponsService` - Sistema de cupons
- ✅ `PaymentsService` - Processamento de pagamentos
- ✅ `ConversationService` - Gestão de conversas WhatsApp
- ✅ `AuditLogService` - Logs de auditoria
- ✅ `IdempotencyService` - Idempotência de operações

---

## 🔗 RELACIONADOS

- **[TenantDbContextInterceptor](./TENANT-DB-CONTEXT-INTERCEPTOR.md)** - Interceptor que gerencia transações por tenant
- **[RLS (Row Level Security)](./04-DATABASE.md#row-level-security-rls)** - Segurança multi-tenant no PostgreSQL
- **[Arquitetura Geral](./03-ARCHITECTURE.md)** - Visão geral da arquitetura

---

## 📝 RESUMO

**O que é:** Serviço centralizado para gerenciar contexto transacional  
**Por que existe:** Garantir RLS correto e transações compartilhadas  
**Como usar:** `db.getRepository(Entity)` e `db.runInTransaction()`  
**Quando usar:** Sempre que precisar acessar o banco de dados

---

**Última atualização:** 08/01/2025  
**Status:** ✅ **DOCUMENTAÇÃO COMPLETA**
