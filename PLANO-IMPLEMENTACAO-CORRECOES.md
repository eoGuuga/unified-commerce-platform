# 📋 PLANO DE IMPLEMENTAÇÃO DAS CORREÇÕES

> **Data:** 08/01/2025  
> **Status:** ✅ **7 de 10 correções críticas implementadas**

---

## ✅ CORREÇÕES JÁ IMPLEMENTADAS

### 1. ✅ Decorator CurrentTenant
- **Arquivo:** `backend/src/common/decorators/tenant.decorator.ts`
- **Status:** ✅ Implementado e testado
- **Uso:** Todos os controllers agora usam `@CurrentTenant()`

### 2. ✅ Audit Log Service
- **Arquivos:** 
  - `backend/src/database/entities/AuditLog.entity.ts`
  - `backend/src/modules/common/services/audit-log.service.ts`
- **Status:** ✅ Implementado | ⚠️ Uso parcial (apenas em OrdersService e ProductsService.adjustStock)

### 3. ✅ Idempotência em Pedidos
- **Arquivo:** `backend/src/modules/orders/orders.service.ts`
- **Status:** ✅ Implementado
- **Como usar:** Enviar header `Idempotency-Key` nas requisições POST /orders

### 4. ✅ Queries N+1 Corrigidas
- **Arquivo:** `backend/src/modules/products/products.service.ts`
- **Status:** ✅ Corrigido
- **Melhoria:** De N+1 queries para 2 queries (produtos + estoques)

### 5. ✅ Cache Implementado
- **Arquivo:** `backend/src/modules/products/products.service.ts`
- **Status:** ✅ Implementado
- **TTL:** 5 minutos para produtos

### 6. ✅ Health Checks Corrigidos
- **Arquivo:** `backend/src/modules/health/health.controller.ts`
- **Status:** ✅ Corrigido
- **Agora retorna:** 200 se OK, 503 se unhealthy

### 7. ✅ JWT Secret Validação
- **Arquivo:** `backend/src/modules/auth/strategies/jwt.strategy.ts`
- **Status:** ✅ Implementado
- **Valida:** JWT_SECRET obrigatório e não pode ser valor padrão

### 8. ✅ Controllers Atualizados
- **Arquivos:** 
  - `backend/src/modules/orders/orders.controller.ts`
  - `backend/src/modules/products/products.controller.ts`
- **Status:** ✅ Atualizados para usar `@CurrentTenant()`

### 9. ✅ Migration Criada
- **Arquivo:** `scripts/migrations/002-security-and-performance.sql`
- **Status:** ✅ Criada | ⚠️ **NÃO EXECUTADA AINDA**
- **Contém:** Índices + RLS básico

### 10. ✅ Timeout em Queries
- **Arquivo:** `backend/src/config/database.config.ts`
- **Status:** ✅ Implementado
- **Timeout:** 30 segundos

---

## ⚠️ PRÓXIMOS PASSOS CRÍTICOS

### 1. Executar Migration (URGENTE)
```bash
# Conectar ao PostgreSQL
docker exec -it ucm-postgres psql -U postgres -d ucm

# Ou executar arquivo diretamente
docker exec -i ucm-postgres psql -U postgres -d ucm < scripts/migrations/002-security-and-performance.sql
```

### 2. Testar Correções
- [ ] Testar idempotência (criar pedido 2x com mesma key)
- [ ] Testar cache (verificar se segunda requisição é mais rápida)
- [ ] Testar health checks (parar DB e verificar 503)
- [ ] Testar validação de JWT_SECRET (remover do .env)

### 3. Implementar CSRF Protection
- [ ] Criar CSRF Guard
- [ ] Adicionar tokens no frontend
- [ ] Validar em todos endpoints POST/PUT/DELETE

### 4. Completar Audit Log
- [ ] Adicionar em ProductsService.create/update/remove
- [ ] Adicionar em AuthService.login
- [ ] Adicionar em todas operações críticas

---

## 🧪 TESTES RECOMENDADOS

### Teste 1: Idempotência
```bash
# Criar pedido
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Authorization: Bearer TOKEN" \
  -H "Idempotency-Key: test-123" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"produto_id": "xxx", "quantity": 1, "unit_price": 10}], "channel": "pdv"}'

# Tentar criar novamente (deve retornar 409 Conflict)
```

### Teste 2: Cache
```bash
# Primeira requisição (vai buscar do DB)
time curl http://localhost:3001/api/v1/products \
  -H "Authorization: Bearer TOKEN"

# Segunda requisição (deve vir do cache - mais rápido)
time curl http://localhost:3001/api/v1/products \
  -H "Authorization: Bearer TOKEN"
```

### Teste 3: Health Check
```bash
# Com DB rodando (deve retornar 200)
curl http://localhost:3001/api/v1/health

# Parar DB e testar (deve retornar 503)
docker stop ucm-postgres
curl http://localhost:3001/api/v1/health
docker start ucm-postgres
```

---

**Última atualização:** 08/01/2025  
**Progresso:** ✅ **7/10 correções críticas implementadas**
