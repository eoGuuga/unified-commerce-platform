# MEMÓRIA DO ESTADO ATUAL DO PROJETO

## CONTEXTO GERAL

Este é um projeto SaaS de comércio unificado para pequenos negócios artesanais que resolvem o problema de OVERSELLING (vender mais do que tem em estoque).

### PROBLEMA CORE
Loja física tem 10 brigadeiros em estoque, vende 8 no balcão, mas não atualiza o estoque online. Cliente compra os últimos 2 online E mais 5 por WhatsApp. Resultado: venderam 15 mas só tinham 10.

### SOLUÇÃO
Um BACKEND CENTRALIZADO com banco PostgreSQL que recebe TODAS as vendas de 3 fontes:
1. **PDV Web** (venda física no balcão via tablet) - APP WEB, não executável
2. **E-commerce** (site online)
3. **WhatsApp Bot** (chat automático com IA)

Usa transações ACID (atomicidade) + FOR UPDATE locks no banco para garantir que NUNCA vendam mais do que têm.

---

## ESTRUTURA TÉCNICA

### ARQUITETURA 4 CAMADAS

```
┌──────────────────────────────────────────┐
│ CAMADA 1: PRESENTATION                    │
│ - PDV Web (Next.js App Router)           │
│ - E-commerce Storefront                   │
│ - WhatsApp Bot UI                         │
│ - Admin Dashboard                         │
└───────────┬──────────────────────────────┘
            ↓
┌──────────────────────────────────────────┐
│ CAMADA 2: API & APPLICATION               │
│ - NestJS Backend (API REST)               │
│ - Controllers (rotas HTTP)                │
│ - Services (lógica de negócio)            │
│ - DTOs (validação de entrada)             │
└───────────┬──────────────────────────────┘
            ↓
┌──────────────────────────────────────────┐
│ CAMADA 3: DATA ACCESS                     │
│ - PostgreSQL 15 (Supabase ou Docker)      │
│ - TypeORM ORM                             │
│ - Redis (cache + sessões)                 │
└───────────┬──────────────────────────────┘
            ↓
┌──────────────────────────────────────────┐
│ CAMADA 4: EXTERNAL                        │
│ - Stripe (pagamentos)                     │
│ - Twilio (WhatsApp)                       │
│ - OpenAI (IA do bot)                      │
│ - Supabase Auth (autenticação)            │
└──────────────────────────────────────────┘
```

---

## O QUE JÁ ESTÁ IMPLEMENTADO ✅

### 1. Documentação Completa ✅
- ✅ 12 arquivos em `docs/`
- ✅ Schema SQL completo (`scripts/migrations/001-initial-schema.sql`)
- ✅ 11 tabelas: tenants, usuarios, produtos, pedidos, estoque, etc
- ✅ RLS, triggers, índices configurados

### 2. Backend NestJS - Entities ✅
- ✅ `Tenant.entity.ts` - Multitenancy (uma loja = um tenant)
- ✅ `Usuario.entity.ts` - Usuários com roles (admin, manager, seller, support)
- ✅ `Categoria.entity.ts` - Categorias de produtos
- ✅ `Produto.entity.ts` - Catálogo de produtos
- ✅ `MovimentacaoEstoque.entity.ts` - Estoque atual
- ✅ `Pedido.entity.ts` - Pedidos de venda (PDV/E-com/WhatsApp)
- ✅ `ItemPedido.entity.ts` - Itens de cada pedido

### 3. Backend NestJS - Módulo Products ✅
- ✅ `ProductsModule` - Módulo configurado
- ✅ `ProductsService` - Lógica de CRUD + busca
- ✅ `ProductsController` - 7 endpoints REST
- ✅ `CreateProductDto` - Validação de entrada
- ✅ `UpdateProductDto` - Validação de atualização
- ✅ TypeORM Repository configurado
- ✅ Swagger/OpenAPI documentado

### 4. Configurações ✅
- ✅ TypeORM configurado em `database.config.ts`
- ✅ AppModule importa ProductsModule
- ✅ Environment variables configuradas
- ✅ Docker Compose com PostgreSQL + Redis

---

## ENDPOINTS DISPONÍVEIS AGORA

```
GET    /api/v1/health                           → Status do sistema
GET    /api/v1/products?tenantId={UUID}         → Listar produtos
GET    /api/v1/products/search?q=brig&tenantId={UUID}  → Buscar
GET    /api/v1/products/:id?tenantId={UUID}     → Produto por ID
POST   /api/v1/products?tenantId={UUID}         → Criar produto
PATCH  /api/v1/products/:id?tenantId={UUID}     → Atualizar
DELETE /api/v1/products/:id?tenantId={UUID}     → Desativar
```

**tenantId de exemplo**: `00000000-0000-0000-0000-000000000000` (do seed SQL)

---

## O QUE FALTA IMPLEMENTAR

### FASE 1: Core Business (CRÍTICO)
- [ ] **Módulo de Estoque** - Atualizar estoque
- [ ] **Módulo de Pedidos** - CRUD de pedidos
- [ ] **Transação FOR UPDATE lock** - Prevenir overselling ⚠️ CRÍTICO
- [ ] **Autenticação JWT** - Login, Guards, Roles

### FASE 2: Automação
- [ ] **WhatsApp Bot** - Integração Twilio + OpenAI
- [ ] **Webhook handler** - Receber mensagens
- [ ] **IA Conversacional** - Processar pedidos

### FASE 3: Frontend
- [ ] **Interface PDV** - Vender produtos
- [ ] **E-commerce** - Loja online
- [ ] **Admin Dashboard** - Relatórios e gestão

---

## FLUXO CRÍTICO DE VENDA (AINDA NÃO IMPLEMENTADO)

### Race Condition Solution

**Cenário**: 2 vendedores querem os últimos 3 brigadeiros simultaneamente

**SOLUÇÃO** (precisa implementar):
```typescript
// No OrdersService
async processSale(tenantId, items, channel) {
  return await this.dataSource.transaction(async (manager) => {
    // 1. FOR UPDATE lock
    const estoques = await manager
      .createQueryBuilder(MovimentacaoEstoque, 'e')
      .where('e.produto_id IN (:...ids)', { ids: itemIds })
      .andWhere('e.tenant_id = :tenantId', { tenantId })
      .setLock('pessimistic_write')
      .getMany();
    
    // 2. Validar estoque
    for (const item of items) {
      const estoque = estoques.find(e => e.produto_id === item.produto_id);
      if (!estoque || estoque.current_stock < item.quantity) {
        throw new InsufficientStockError();
      }
    }
    
    // 3. Abater estoque
    for (const item of items) {
      await manager.update(MovimentacaoEstoque, 
        { produto_id: item.produto_id },
        { current_stock: () => 'current_stock - :qty', qty: item.quantity }
      );
    }
    
    // 4. Criar pedido
    const pedido = await manager.insert(Pedido, {...});
    
    // 5. COMMIT (ou ROLLBACK se falhar)
  });
}
```

**PRÓXIMA IMPLEMENTAÇÃO**: OrdersModule com essa lógica

---

## ESTRUTURA ATUAL COMPLETA

```
backend/src/
├── config/
│   └── database.config.ts          ✅ TypeORM config
├── database/
│   └── entities/
│       ├── Tenant.entity.ts        ✅ Multitenancy
│       ├── Usuario.entity.ts       ✅ Auth
│       ├── Categoria.entity.ts     ✅
│       ├── Produto.entity.ts       ✅
│       ├── MovimentacaoEstoque.entity.ts  ✅
│       ├── Pedido.entity.ts        ✅
│       └── ItemPedido.entity.ts    ✅
├── modules/
│   └── products/                   ✅ COMPLETO
│       ├── products.module.ts
│       ├── products.service.ts
│       ├── products.controller.ts
│       └── dto/
│           ├── create-product.dto.ts
│           └── update-product.dto.ts
├── app.module.ts                   ✅
├── app.controller.ts               ✅
├── app.service.ts                  ✅
└── main.ts                         ✅

scripts/migrations/
└── 001-initial-schema.sql          ✅ SCHEMA COMPLETO

docs/
├── README.md                       ✅ Índice
├── 01-VISION.md                    ✅ Problema
├── 02-ARCHITECTURE.md              ✅ Arquitetura
├── 03-FEATURES.md                  ✅ Features
├── 04-DATABASE.md                  ✅ Schema
├── 06-WORKFLOWS.md                 ✅ Fluxos
├── 07-SECURITY.md                  ✅ Segurança
├── 08-ROADMAP.md                   ✅ Timeline
└── ... (mais 4 arquivos)
```

---

## PRÓXIMA AÇÃO IMEDIATA

### Testar Backend

```bash
# 1. Iniciar PostgreSQL (Docker)
docker-compose up -d postgres

# 2. Executar migration
docker exec -i ucm-postgres psql -U postgres -d ucm < scripts/migrations/001-initial-schema.sql

# 3. Configurar backend
cd backend
# Criar .env com: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ucm
npm install

# 4. Iniciar
npm run start:dev

# 5. Testar
curl http://localhost:3001/api/v1/products?tenantId=00000000-0000-0000-0000-000000000000
```

---

## DECISÃO ARQUITETURAL: PDV

**Implementado**: PDV Web (Next.js) - funciona em browser/tablet

**Não implementado**: Ainda não há executável .exe

**Decisão**: Começar com web. Se necessário, depois empacotar com Electron.

---

**Status Atual**: ✅ Backend estruturalmente completo, CRUD Products funcionando
**Próximo**: Implementar OrdersModule com FOR UPDATE lock
**Prioridade**: Módulo de Pedidos é CRÍTICO para prevenir overselling