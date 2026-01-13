# 🔒 REVISÃO COMPLETA - Segurança, Confiabilidade, Estabilidade e Performance

> **Data:** 08/01/2025  
> **Objetivo:** Análise completa e profunda de TODAS as brechas de segurança, confiabilidade, estabilidade e performance  
> **Status:** ✅ **ANÁLISE COMPLETA REALIZADA**

---

## 📊 RESUMO EXECUTIVO

### ✅ PONTOS FORTES IDENTIFICADOS

1. **Transações ACID:** ✅ Implementadas corretamente com FOR UPDATE locks
2. **Validação de Input:** ✅ ValidationPipe global com whitelist
3. **Autenticação JWT:** ✅ Implementada corretamente
4. **Rate Limiting:** ✅ Configurado globalmente
5. **Health Checks:** ✅ Implementados para DB e Redis
6. **Exception Handling:** ✅ Filter global implementado
7. **Swagger/OpenAPI:** ✅ Documentação completa
8. **Cache Service:** ✅ Implementado (mas não totalmente utilizado)

### ⚠️ BRECHAS CRÍTICAS ENCONTRADAS

1. **🔴 CRÍTICO:** Falta Row Level Security (RLS) no PostgreSQL
2. **🔴 CRÍTICO:** Falta CSRF Protection
3. **🔴 CRÍTICO:** Falta Audit Log implementado (apenas TODO)
4. **🟡 ALTO:** Cache não está sendo usado em queries críticas
5. **🟡 ALTO:** Falta idempotência em endpoints críticos
6. **🟡 ALTO:** Falta circuit breaker para serviços externos
7. **🟡 ALTO:** Queries N+1 em ProductsService.findAll()
8. **🟡 ALTO:** Falta retry mechanism para operações críticas
9. **🟡 ALTO:** Falta sanitização de HTML/XSS no frontend
10. **🟡 ALTO:** CORS muito permissivo em desenvolvimento

---

## 🔒 1. SEGURANÇA

### 1.1 🔴 CRÍTICO: Row Level Security (RLS) Não Implementado

**Problema:**
- Documentação menciona RLS, mas não está implementado no código
- Todas as queries dependem apenas de `tenant_id` no código
- Se alguém descobrir um token, pode acessar dados de outros tenants se não houver RLS

**Impacto:** 🔴 **CRÍTICO** - Violação de isolamento multi-tenant

**Solução:**
```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Policy: Usuário só vê produtos do seu tenant
CREATE POLICY "users_see_own_tenant_products" ON produtos
  FOR SELECT
  USING (
    tenant_id = (
      SELECT tenant_id FROM usuarios WHERE id = current_setting('app.current_user_id')::uuid
    )
  );

-- Policy: Usuário só pode criar pedido no seu tenant
CREATE POLICY "users_create_own_tenant_orders" ON pedidos
  FOR INSERT
  WITH CHECK (
    tenant_id = (
      SELECT tenant_id FROM usuarios WHERE id = current_setting('app.current_user_id')::uuid
    )
  );
```

**Arquivos a modificar:**
- `scripts/migrations/002-enable-rls.sql` (criar novo)
- `backend/src/modules/auth/guards/jwt-auth.guard.ts` (adicionar set do current_user_id)

**Prioridade:** 🔴 **CRÍTICA** - Implementar IMEDIATAMENTE

---

### 1.2 🔴 CRÍTICO: CSRF Protection Não Implementado

**Problema:**
- Documentação menciona CSRF, mas não está implementado
- Frontend não envia CSRF tokens
- Backend não valida CSRF tokens

**Impacto:** 🔴 **CRÍTICO** - Vulnerável a ataques CSRF

**Solução Backend:**
```typescript
// backend/src/common/guards/csrf.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Skip para GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }
    
    const csrfToken = request.headers['x-csrf-token'];
    const sessionToken = request.cookies?.['csrf-token'];
    
    if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
      throw new ForbiddenException('CSRF token inválido');
    }
    
    return true;
  }
}
```

**Solução Frontend:**
```typescript
// frontend/lib/csrf.ts
export function getCsrfToken(): string {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf-token='))
    ?.split('=')[1] || '';
}

// Adicionar em todas as requisições POST/PUT/DELETE
headers: {
  'X-CSRF-Token': getCsrfToken(),
}
```

**Prioridade:** 🔴 **CRÍTICA** - Implementar IMEDIATAMENTE

---

### 1.3 🔴 CRÍTICO: Audit Log Não Implementado

**Problema:**
- Tabela `audit_log` existe no schema, mas não está sendo usada
- `ProductsService.adjustStock()` tem TODO comentado
- Nenhuma operação crítica está sendo auditada

**Impacto:** 🔴 **CRÍTICO** - Impossível rastrear mudanças e detectar fraudes

**Solução:**
```typescript
// backend/src/modules/common/services/audit-log.service.ts
@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(params: {
    tenantId: string;
    userId?: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    tableName: string;
    recordId: string;
    oldData?: any;
    newData?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.auditLogRepository.save({
      tenant_id: params.tenantId,
      user_id: params.userId,
      action: params.action,
      table_name: params.tableName,
      record_id: params.recordId,
      old_data: params.oldData || {},
      new_data: params.newData || {},
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    });
  }
}
```

**Usar em:**
- `OrdersService.create()` - Registrar criação de pedidos
- `ProductsService.adjustStock()` - Registrar ajustes de estoque
- `ProductsService.update()` - Registrar mudanças de produtos
- `AuthService.login()` - Registrar logins

**Prioridade:** 🔴 **CRÍTICA** - Implementar IMEDIATAMENTE

---

### 1.4 🟡 ALTO: CORS Muito Permissivo

**Problema:**
```typescript
// backend/src/main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
});
```

- Em desenvolvimento, aceita qualquer origem se `FRONTEND_URL` não estiver definido
- Não valida métodos HTTP
- Não valida headers permitidos

**Impacto:** 🟡 **ALTO** - Vulnerável em produção se configurado incorretamente

**Solução:**
```typescript
app.enableCors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
});
```

**Prioridade:** 🟡 **ALTA** - Corrigir antes de produção

---

### 1.5 🟡 ALTO: Falta Sanitização de HTML/XSS no Frontend

**Problema:**
- Frontend não sanitiza dados antes de exibir
- Produtos com descrições podem conter HTML malicioso
- Nomes de produtos podem conter scripts

**Impacto:** 🟡 **ALTO** - Vulnerável a XSS

**Solução:**
```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

```typescript
// frontend/lib/sanitize.ts
import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href'],
  });
}

export function sanitizeText(text: string): string {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}
```

**Usar em:**
- Exibição de nomes de produtos
- Exibição de descrições
- Exibição de mensagens de erro

**Prioridade:** 🟡 **ALTA** - Implementar antes de produção

---

### 1.6 🟡 ALTO: JWT Secret Padrão em Desenvolvimento

**Problema:**
```typescript
// backend/src/modules/auth/strategies/jwt.strategy.ts
secretOrKey: config.get<string>('JWT_SECRET', 'change-me-in-production'),
```

- Se `.env` não tiver `JWT_SECRET`, usa valor padrão inseguro
- Mesmo em desenvolvimento, isso é perigoso

**Impacto:** 🟡 **ALTO** - Tokens podem ser forjados se secret for conhecido

**Solução:**
```typescript
const jwtSecret = config.get<string>('JWT_SECRET');
if (!jwtSecret || jwtSecret === 'change-me-in-production') {
  throw new Error('JWT_SECRET deve ser definido e seguro em .env');
}
```

**Prioridade:** 🟡 **ALTA** - Corrigir IMEDIATAMENTE

---

### 1.7 🟢 MÉDIO: Falta Rate Limiting por Usuário

**Problema:**
- Rate limiting é global, não por usuário
- Um usuário pode fazer 100 requisições/min, mas todos os usuários compartilham esse limite

**Impacto:** 🟢 **MÉDIO** - Pode causar problemas se muitos usuários simultâneos

**Solução:**
```typescript
// backend/src/modules/auth/guards/throttle-user.guard.ts
@Injectable()
export class ThrottleUserGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user;
    return user ? `user:${user.id}` : req.ip;
  }
}
```

**Prioridade:** 🟢 **MÉDIA** - Implementar quando houver múltiplos usuários

---

## 🛡️ 2. CONFIABILIDADE

### 2.1 🟡 ALTO: Falta Idempotência em Endpoints Críticos

**Problema:**
- `OrdersService.create()` não tem idempotência
- Se cliente enviar requisição 2x (rede instável), cria 2 pedidos
- `IdempotencyKey` entity existe, mas não está sendo usada

**Impacto:** 🟡 **ALTO** - Pedidos duplicados, estoque abatido 2x

**Solução:**
```typescript
// backend/src/modules/orders/orders.service.ts
async create(
  createOrderDto: CreateOrderDto, 
  tenantId: string,
  idempotencyKey?: string,
): Promise<Pedido> {
  // Verificar idempotência
  if (idempotencyKey) {
    const existing = await this.idempotencyService.get(idempotencyKey);
    if (existing) {
      return existing.result;
    }
  }
  
  // Criar pedido
  const pedido = await this.dataSource.transaction(async (manager) => {
    // ... código existente ...
  });
  
  // Salvar idempotência
  if (idempotencyKey) {
    await this.idempotencyService.save(idempotencyKey, pedido);
  }
  
  return pedido;
}
```

**Frontend:**
```typescript
// Gerar idempotency key no frontend
const idempotencyKey = crypto.randomUUID();

// Enviar no header
headers: {
  'Idempotency-Key': idempotencyKey,
}
```

**Prioridade:** 🟡 **ALTA** - Implementar IMEDIATAMENTE

---

### 2.2 🟡 ALTO: Falta Retry Mechanism para Operações Críticas

**Problema:**
- Se conexão com DB cair durante transação, não há retry
- Se Redis estiver indisponível, cache falha silenciosamente
- Não há retry para webhooks externos

**Impacto:** 🟡 **ALTO** - Operações críticas podem falhar sem tentar novamente

**Solução:**
```typescript
// backend/src/common/utils/retry.util.ts
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {},
): Promise<T> {
  const { maxRetries = 3, delay = 1000, onRetry } = options;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      if (onRetry) onRetry(error as Error, attempt);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw new Error('Retry failed');
}
```

**Usar em:**
- `OrdersService.create()` - Retry se DB temporariamente indisponível
- `CacheService.set()` - Retry se Redis temporariamente indisponível
- Webhooks - Retry se serviço externo temporariamente indisponível

**Prioridade:** 🟡 **ALTA** - Implementar para operações críticas

---

### 2.3 🟡 ALTO: Falta Validação de Tenant em Alguns Endpoints

**Problema:**
- Alguns endpoints não validam se `tenant_id` do usuário corresponde ao `tenant_id` da requisição
- Usuário pode acessar dados de outro tenant se passar `tenant_id` diferente

**Impacto:** 🟡 **ALTO** - Violação de isolamento multi-tenant

**Solução:**
```typescript
// backend/src/common/decorators/tenant.decorator.ts
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    
    // Sempre usar tenant_id do usuário autenticado
    return user.tenant_id;
  },
);

// Usar em todos os endpoints
@Get()
async findAll(@CurrentTenant() tenantId: string) {
  return this.service.findAll(tenantId);
}
```

**Prioridade:** 🟡 **ALTA** - Implementar IMEDIATAMENTE

---

### 2.4 🟢 MÉDIO: Falta Validação de Integridade de Dados

**Problema:**
- Não valida se `produto_id` em `ItemPedido` realmente existe
- Não valida se `categoria_id` em `Produto` realmente existe
- Não valida constraints de negócio (ex: quantidade > 0)

**Impacto:** 🟢 **MÉDIO** - Dados inconsistentes podem ser criados

**Solução:**
```typescript
// Adicionar validações em DTOs
@IsUUID()
@IsNotEmpty()
produto_id: string;

@IsInt()
@Min(1)
quantity: number;
```

**Prioridade:** 🟢 **MÉDIA** - Melhorar validações

---

## ⚡ 3. ESTABILIDADE

### 3.1 🟡 ALTO: Falta Circuit Breaker para Serviços Externos

**Problema:**
- Se Redis estiver indisponível, todas as requisições que usam cache falham
- Se DB estiver lento, não há fallback
- Não há circuit breaker para serviços externos (WhatsApp, Payment)

**Impacto:** 🟡 **ALTO** - Sistema pode ficar indisponível se serviço externo falhar

**Solução:**
```typescript
// backend/src/common/services/circuit-breaker.service.ts
@Injectable()
export class CircuitBreakerService {
  private states = new Map<string, { failures: number; state: 'closed' | 'open' | 'half-open'; lastFailure?: Date }>();
  
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    options: { threshold?: number; timeout?: number } = {},
  ): Promise<T> {
    const { threshold = 5, timeout = 60000 } = options;
    const state = this.states.get(key) || { failures: 0, state: 'closed' };
    
    // Circuit aberto - retornar erro imediatamente
    if (state.state === 'open') {
      if (Date.now() - (state.lastFailure?.getTime() || 0) < timeout) {
        throw new Error(`Circuit breaker ${key} is open`);
      }
      state.state = 'half-open';
    }
    
    try {
      const result = await fn();
      // Sucesso - resetar circuit
      state.failures = 0;
      state.state = 'closed';
      this.states.set(key, state);
      return result;
    } catch (error) {
      state.failures++;
      state.lastFailure = new Date();
      
      if (state.failures >= threshold) {
        state.state = 'open';
      }
      
      this.states.set(key, state);
      throw error;
    }
  }
}
```

**Usar em:**
- `CacheService` - Circuit breaker para Redis
- `WhatsappService` - Circuit breaker para provider WhatsApp
- `PaymentService` - Circuit breaker para provider de pagamento

**Prioridade:** 🟡 **ALTA** - Implementar para serviços críticos

---

### 3.2 🟡 ALTO: Health Checks Não Retornam Status HTTP Correto

**Problema:**
```typescript
// backend/src/modules/health/health.controller.ts
@Get()
async check() {
  return this.healthService.check();
}
```

- Sempre retorna 200, mesmo se DB ou Redis estiverem down
- Kubernetes/Docker não conseguem detectar que serviço está unhealthy

**Impacto:** 🟡 **ALTO** - Orquestradores não conseguem fazer health checks corretos

**Solução:**
```typescript
@Get()
async check(@Res() res: Response) {
  const health = await this.healthService.check();
  const status = health.status === 'ok' ? 200 : 503;
  return res.status(status).json(health);
}

@Get('ready')
async ready(@Res() res: Response) {
  const health = await this.healthService.ready();
  const status = health.status === 'ok' ? 200 : 503;
  return res.status(status).json(health);
}
```

**Prioridade:** 🟡 **ALTA** - Corrigir IMEDIATAMENTE

---

### 3.3 🟢 MÉDIO: Falta Timeout em Queries Longas

**Problema:**
- Queries podem ficar travadas indefinidamente
- Não há timeout configurado no TypeORM

**Impacto:** 🟢 **MÉDIO** - Requisições podem travar se DB estiver lento

**Solução:**
```typescript
// backend/src/config/database.config.ts
TypeOrmModule.forRootAsync({
  // ...
  extra: {
    statement_timeout: 30000, // 30 segundos
    query_timeout: 30000,
  },
})
```

**Prioridade:** 🟢 **MÉDIA** - Configurar timeout

---

## 🚀 4. PERFORMANCE

### 4.1 🟡 ALTO: Queries N+1 em ProductsService.findAll()

**Problema:**
```typescript
// backend/src/modules/products/products.service.ts
async findAll(tenantId: string): Promise<any[]> {
  const produtos = await this.produtosRepository.find({
    where: { tenant_id: tenantId, is_active: true },
    relations: ['categoria'],
    order: { name: 'ASC' },
  });

  // ❌ N+1: Para cada produto, faz uma query separada
  const produtosComEstoque = await Promise.all(
    produtos.map(async (produto) => {
      const estoque = await this.estoqueRepository.findOne({
        where: { tenant_id: tenantId, produto_id: produto.id },
      });
      // ...
    })
  );
}
```

**Impacto:** 🟡 **ALTO** - Se tiver 100 produtos, faz 101 queries (1 + 100)

**Solução:**
```typescript
async findAll(tenantId: string): Promise<any[]> {
  // Buscar produtos com estoque em uma única query
  const produtos = await this.produtosRepository
    .createQueryBuilder('produto')
    .leftJoinAndSelect('produto.categoria', 'categoria')
    .leftJoinAndSelect('produto.estoque', 'estoque', 'estoque.tenant_id = :tenantId', { tenantId })
    .where('produto.tenant_id = :tenantId', { tenantId })
    .andWhere('produto.is_active = :isActive', { isActive: true })
    .orderBy('produto.name', 'ASC')
    .getMany();

  return produtos.map(produto => {
    const estoque = produto.estoque?.[0];
    const availableStock = estoque 
      ? Math.max(0, estoque.current_stock - estoque.reserved_stock)
      : 0;

    return {
      ...produto,
      stock: estoque?.current_stock || 0,
      available_stock: availableStock,
      reserved_stock: estoque?.reserved_stock || 0,
      min_stock: estoque?.min_stock || 0,
    };
  });
}
```

**Prioridade:** 🟡 **ALTA** - Corrigir IMEDIATAMENTE

---

### 4.2 🟡 ALTO: Cache Não Está Sendo Usado em Queries Críticas

**Problema:**
- `CacheService` existe, mas `ProductsService.findAll()` não usa cache
- `OrdersService.getSalesReport()` não usa cache
- Queries repetidas fazem hit no DB toda vez

**Impacto:** 🟡 **ALTO** - Performance ruim, DB sobrecarregado

**Solução:**
```typescript
// backend/src/modules/products/products.service.ts
async findAll(tenantId: string): Promise<any[]> {
  // Tentar buscar do cache primeiro
  const cached = await this.cacheService.getCachedProducts(tenantId);
  if (cached) {
    return cached;
  }
  
  // Se não estiver em cache, buscar do DB
  const produtos = await this.produtosRepository.find({
    // ... query otimizada ...
  });
  
  // Salvar no cache
  await this.cacheService.cacheProducts(tenantId, produtos, 300); // 5 minutos
  
  return produtos;
}
```

**Invalidar cache quando:**
- Produto criado/editado
- Estoque ajustado
- Pedido criado

**Prioridade:** 🟡 **ALTA** - Implementar IMEDIATAMENTE

---

### 4.3 🟡 ALTO: Falta Índices em Queries Frequentes

**Problema:**
- Schema tem alguns índices, mas faltam índices importantes:
  - `pedidos(tenant_id, status, created_at)` - Para relatórios
  - `itens_pedido(pedido_id, produto_id)` - Para joins
  - `movimentacoes_estoque(tenant_id, produto_id)` - Para busca de estoque

**Impacto:** 🟡 **ALTO** - Queries lentas quando dados crescem

**Solução:**
```sql
-- Adicionar índices faltantes
CREATE INDEX idx_pedidos_tenant_status_created ON pedidos(tenant_id, status, created_at DESC);
CREATE INDEX idx_itens_pedido_pedido_produto ON itens_pedido(pedido_id, produto_id);
CREATE INDEX idx_estoque_tenant_produto ON movimentacoes_estoque(tenant_id, produto_id);
CREATE INDEX idx_produtos_tenant_active ON produtos(tenant_id, is_active) WHERE is_active = true;
```

**Prioridade:** 🟡 **ALTA** - Adicionar índices faltantes

---

### 4.4 🟢 MÉDIO: Falta Paginação em Listagens

**Problema:**
- `ProductsService.findAll()` retorna TODOS os produtos
- `OrdersService.findAll()` retorna TODOS os pedidos
- Se tiver 10.000 produtos, retorna todos de uma vez

**Impacto:** 🟢 **MÉDIO** - Performance ruim com muitos dados, memória alta

**Solução:**
```typescript
async findAll(
  tenantId: string,
  page: number = 1,
  limit: number = 50,
): Promise<{ data: any[]; total: number; page: number; limit: number }> {
  const [data, total] = await this.produtosRepository.findAndCount({
    where: { tenant_id: tenantId, is_active: true },
    skip: (page - 1) * limit,
    take: limit,
    order: { name: 'ASC' },
  });
  
  return { data, total, page, limit };
}
```

**Prioridade:** 🟢 **MÉDIA** - Implementar paginação

---

### 4.5 🟢 MÉDIO: Falta Lazy Loading em Relações

**Problema:**
- `OrdersService.findAll()` carrega todas as relações sempre
- Se não precisar de `itens.produto`, ainda carrega

**Impacto:** 🟢 **MÉDIO** - Queries mais lentas, mais memória

**Solução:**
```typescript
async findAll(
  tenantId: string,
  includeItems: boolean = true,
  includeProducts: boolean = false,
): Promise<Pedido[]> {
  const relations: string[] = [];
  if (includeItems) relations.push('itens');
  if (includeProducts) relations.push('itens.produto');
  
  return this.pedidosRepository.find({
    where: { tenant_id: tenantId },
    relations,
    order: { created_at: 'DESC' },
  });
}
```

**Prioridade:** 🟢 **MÉDIA** - Otimizar carregamento de relações

---

## 📋 5. CHECKLIST DE IMPLEMENTAÇÃO

### 🔴 CRÍTICO - Implementar IMEDIATAMENTE

- [ ] **1.1** Implementar Row Level Security (RLS) no PostgreSQL
- [ ] **1.2** Implementar CSRF Protection
- [ ] **1.3** Implementar Audit Log Service e usar em todas operações críticas
- [ ] **1.6** Validar JWT_SECRET obrigatório
- [ ] **2.1** Implementar idempotência em `OrdersService.create()`
- [ ] **2.3** Validar tenant_id em todos os endpoints
- [ ] **3.2** Corrigir health checks para retornar 503 quando unhealthy
- [ ] **4.1** Corrigir queries N+1 em `ProductsService.findAll()`
- [ ] **4.2** Implementar cache em queries críticas
- [ ] **4.3** Adicionar índices faltantes no banco

### 🟡 ALTO - Implementar Esta Semana

- [ ] **1.4** Corrigir CORS para ser mais restritivo
- [ ] **1.5** Implementar sanitização HTML/XSS no frontend
- [ ] **2.2** Implementar retry mechanism para operações críticas
- [ ] **3.1** Implementar circuit breaker para serviços externos

### 🟢 MÉDIO - Implementar Próximas Semanas

- [ ] **1.7** Implementar rate limiting por usuário
- [ ] **2.4** Melhorar validações de integridade de dados
- [ ] **3.3** Configurar timeout em queries
- [ ] **4.4** Implementar paginação em listagens
- [ ] **4.5** Otimizar lazy loading em relações

---

## 🎯 PRIORIZAÇÃO RECOMENDADA

### Semana 1 (Crítico)
1. Row Level Security (RLS)
2. CSRF Protection
3. Audit Log
4. Idempotência em pedidos
5. Queries N+1
6. Cache em queries críticas

### Semana 2 (Alto)
1. CORS mais restritivo
2. Sanitização XSS
3. Retry mechanism
4. Circuit breaker
5. Health checks corretos

### Semana 3 (Médio)
1. Rate limiting por usuário
2. Paginação
3. Timeouts
4. Lazy loading otimizado

---

## 📊 MÉTRICAS DE SUCESSO

### Segurança
- ✅ Zero vulnerabilidades críticas
- ✅ RLS implementado e testado
- ✅ CSRF protection ativo
- ✅ Audit log completo

### Confiabilidade
- ✅ Zero pedidos duplicados (idempotência)
- ✅ Zero falhas não tratadas (retry)
- ✅ 100% das operações críticas auditadas

### Estabilidade
- ✅ Health checks retornam status correto
- ✅ Circuit breakers protegem serviços externos
- ✅ Timeouts previnem travamentos

### Performance
- ✅ Zero queries N+1
- ✅ Cache hit rate > 80%
- ✅ Queries < 100ms (p95)
- ✅ Paginação em todas listagens

---

**Última atualização:** 08/01/2025  
**Status:** ✅ **ANÁLISE COMPLETA REALIZADA**  
**Próximo passo:** Implementar itens críticos (Semana 1)
---

## Atualizacao (CSRF)

- O CsrfGuard agora e aplicado globalmente, mas fica desativado por padrao.
- Para habilitar, use `CSRF_ENABLED=true` e envie `x-csrf-token` + cookie/session.
