# 🚀 Plataforma de Comércio Unificado - Documentação Completa e Detalhada

> **DOCUMENTAÇÃO = SEU MAPA DE NAVEGAÇÃO**  
> Leia para entender O QUE fazer, COMO fazer e POR QUE fazer. Sempre.

**Status**: MVP Development  
**Última atualização**: Novembro 2024  
**Versão**: 1.0.0-alpha

---

## 📑 ÍNDICE COMPLETO (Clique para ir)

### SEÇÃO I: ENTENDER O PROBLEMA
- [1. Problema Técnico & Solução](#1-problema-técnico--solução)
- [2. O Que É e Por Que Existe](#2-o-que-é-e-por-que-existe)
- [3. Requisitos Não-Funcionais](#3-requisitos-não-funcionais)

### SEÇÃO II: ARQUITETURA
- [4. Arquitetura em Camadas](#4-arquitetura-em-camadas)
- [5. Padrões Arquiteturais](#5-padrões-arquiteturais)
- [6. Diagramas de Fluxo](#6-diagramas-de-fluxo)

### SEÇÃO III: STACK TECNOLÓGICO (POR QUÊ CADA ESCOLHA)
- [7. Stack Completo & Alternativas](#7-stack-completo--alternativas)
- [8. Backend: Node.js + NestJS](#8-backend-nodejs--nestjs)
- [9. Banco de Dados: Supabase](#9-banco-de-dados-supabase)
- [10. Frontend: Next.js](#10-frontend-nextjs)
- [11. Ferramentas de IA](#11-ferramentas-de-ia)
- [12. DevOps & Deployment](#12-devops--deployment)

### SEÇÃO IV: TÉCNICO (COMO FAZER)
- [13. Banco de Dados Detalhado](#13-banco-de-dados-detalhado)
- [14. Segurança & Autenticação](#14-segurança--autenticação)
- [15. API REST Completa](#15-api-rest-completa)
- [16. Transações ACID](#16-transações-acid)

### SEÇÃO V: PRÁTICO (SETUP & FLUXOS)
- [17. Setup Local Passo-a-Passo](#17-setup-local-passo-a-passo)
- [18. Fluxos de Negócio](#18-fluxos-de-negócio)
- [19. Testes & QA](#19-testes--qa)
- [20. Troubleshooting](#20-troubleshooting)

### SEÇÃO VI: NEGÓCIO
- [21. Roadmap Completo](#21-roadmap-completo)
- [22. Modelo de Negócio](#22-modelo-de-negócio)
- [23. Métricas & KPIs](#23-métricas--kpis)

---

# 1. PROBLEMA TÉCNICO & SOLUÇÃO

## O Problema: Race Conditions em Multi-Canal

Quando um negócio vende através de **múltiplos canais SIMULTÂNEOS** (loja física, WhatsApp, e-commerce), surgem **race conditions críticas**:

### Exemplo Real do Bug

\`\`\`
Timeline de execução (paralela):

13:00:00.001 | PDV       | Verificar: "Tem 2 brigadeiros?" → Banco retorna: SIM (estoque = 3)
13:00:00.002 | WhatsApp  | Verificar: "Tem 2 brigadeiros?" → Banco retorna: SIM (estoque = 3)
13:00:00.003 | PDV       | Atualizar: estoque = 3 - 2 = 1 ✓
13:00:00.004 | WhatsApp  | Atualizar: estoque = 3 - 2 = 1 ❌ OVERSELLING!

Problema: Vendeu 4 brigadeiros mas tem apenas 3!
\`\`\`

### Impactos do Problema

| Impacto | Gravidade | Consequência |
|---------|-----------|-------------|
| **Overselling** | 🔴 Crítica | Cliente não recebe, devolução, prejuízo |
| **Inconsistência de dados** | 🔴 Crítica | Sistema diz que tem estoque, mas não tem |
| **Perda de confiança** | 🟠 Alta | Cliente frustra, não volta |
| **Impossível auditar** | 🟠 Alta | Não sabe quem vendeu, quando, onde |
| **Perda financeira** | 🔴 Crítica | Desconto, devolução, reputação |

---

## A Solução Arquitetural

Criamos um sistema **CENTRALIZADO, TRANSACIONAL E EVENT-DRIVEN** com garantias ACID:

\`\`\`
ANTES (❌ Bugs)          DEPOIS (✓ Seguro)
├─ PDV                  ├─ PDV
├─ WhatsApp    Estoque  │
├─ E-commerce  Estoque  ├─ WhatsApp  ┐
├─ Admin       Estoque  │            │  Todos leem da MESMA
└─ Local       Estoque  ├─ E-commerce│  autoridade com lock
                        │            │  pessimista (mutex)
                        ├─ Admin     ┐
                        │
                        └─ BANCO PostgreSQL
                           (Source of Truth + Transações)
\`\`\`

### Princípios da Solução

1. **Single Source of Truth**: PostgreSQL é autoridade absoluta
2. **Transactions (BEGIN...COMMIT)**: Tudo ou nada (atomicity)
3. **Pessimistic Locking**: FOR UPDATE (mutex no banco)
4. **Optimistic Locking**: Version field (detect conflicts)
5. **Event Sourcing**: Cada movimento é auditado permanentemente
6. **Row-Level Security**: Isolamento entre clientes (multi-tenant)

---

## 2. O QUE É E POR QUE EXISTE

### Visão de Negócio

A **Plataforma de Comércio Unificado** é um sistema integrado que permite que um negócio (loja de chocolates, artesanato, confeitaria) venda através de **múltiplos canais SIMULTANEAMENTE** sem perder o controle do estoque.

### Problema de Negócio Resolvido

\`\`\`
ANTES (usando 4 sistemas diferentes)
├─ PDV Desktop (sistema A)      → Estoque local, desatualizado
├─ E-commerce WordPress         → Estoque duplicado, manual
├─ WhatsApp (gerenciado manual) → Sem controle
└─ Google Sheets                → Atualiza de hora em hora
Resultado: Falta sincronismo, overselling, perda de pedidos

DEPOIS (plataforma unificada)
├─ PDV Web (mobile-ready)       → Estoque em tempo real
├─ E-commerce (em site próprio) → Sincronizado automaticamente
├─ WhatsApp Bot (atendimento IA)→ Integrado ao sistema
└─ Admin Dashboard             → Visão completa
Resultado: 100% sincronizado, zero overselling, auditoria completa
\`\`\`

### Diferenciais

| Feature | Solução Unificada | PDV tradicional | E-commerce WordPress | Manual (Sheets) |
|---------|-------------------|-----------------|----------------------|-----------------|
| Estoque em tempo real | ✓ | ❌ | ⚠️ 1h delay | ❌ |
| Multi-canal | ✓ | ❌ | ❌ | ❌ |
| Sem overselling | ✓ | ❌ | ❌ | ❌ |
| Auditoria | ✓ | ❌ | ❌ | ❌ |
| WhatsApp integrado | ✓ | ❌ | ❌ | ❌ |
| Relatórios inteligentes | ✓ | ⚠️ Limitados | ⚠️ Limitados | ❌ |

---

## 3. REQUISITOS NÃO-FUNCIONAIS

Estes são os "super-poderes" que o sistema DEVE ter:

| Requisito | Meta | Razão | Status |
|-----------|------|-------|--------|
| **Consistência** | ACID Strong | Zero overselling obrigatório | ✓ |
| **Disponibilidade** | 99.5% uptime | Negócio só para com Supabase | ✓ |
| **Latência (p95)** | < 500ms | PDV não pode travar | Testing |
| **Escalabilidade** | 1000 pedidos/dia | Crescimento até 10x sem recodificar | ✓ |
| **Segurança** | PCI Level 3 | Dados de clientes seguros | Testing |
| **RTO** | 4 horas | Se cair, volta em 4h máximo | ✓ Backup automático |
| **RPO** | 24 horas | Perde 1 dia de dados no pior caso | ✓ Backup diário |
| **Audit Trail** | 100% | Cada transação registrada | ✓ |
| **Multi-tenancy** | 1000 lojas | Isolamento completo entre clientes | ✓ |

---

# 4. ARQUITETURA EM CAMADAS

## Visão Geral das 4 Camadas

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: PRESENTATION (O que o usuário vê)                     │
│  ┌──────────────┬─────────────┬──────────────┬───────────────┐  │
│  │ PDV Web      │ Admin Panel │ E-commerce   │ WhatsApp Bot  │  │
│  │ (Next.js)    │ (Next.js)   │ (Next.js)    │ (Webhook)     │  │
│  └──────────────┴─────────────┴──────────────┴───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         ↓ HTTPS REST + WebSocket (real-time)
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: APPLICATION (Como funciona)                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ API Gateway (Express + Middleware)                          ││
│  │ • JWT Validation  • Rate Limiting  • Tenant Isolation      ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Business Logic (Services)                                   ││
│  │ ┌───────────┬──────────┬──────────┬──────────┬────────────┐││
│  │ │ Product   │ Order    │ Inventory│ Payment  │ Customer   │││
│  │ │ Service   │ Service  │ Service  │ Service  │ Service    │││
│  │ └───────────┴──────────┴──────────┴──────────┴────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
         ↓ SQL Transactions
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: DATA ACCESS (Onde os dados são)                       │
│  ┌──────────────────┐  ┌──────────┐  ┌─────────────────────┐   │
│  │ PostgreSQL       │  │ Redis    │  │ Blob Storage        │   │
│  │ (Supabase)       │  │ (Upstash)│  │ (Vercel)            │   │
│  │ • Transactions   │  │ • Cache  │  │ • Product Images    │   │
│  │ • RLS            │  │ • Sessions   │ • Invoices (PDF)   │   │
│  │ • Realtime       │  │ • Locks  │  │ • Backup zips       │   │
│  └──────────────────┘  └──────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         ↓ HTTP Webhooks
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 4: EXTERNAL (Integrações)                                │
│  ┌────────────────┐ ┌────────────┐ ┌───────┐ ┌────────┐        │
│  │ 360Dialog      │ │ Mercado    │ │OpenAI │ │Resend  │        │
│  │ WhatsApp       │ │ Pago       │ │(IA)   │ │(Email) │        │
│  └────────────────┘ └────────────┘ └───────┘ └────────┘        │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

### Por Que 4 Camadas?

- **Separation of Concerns**: Cada layer tem responsabilidade
- **Fácil de testar**: Mock layer inferior
- **Escalável**: Trocar Layer 3 (PostgreSQL → MongoDB) sem afetar others
- **Segurança**: Validação em múltiplos pontos
- **Manutenível**: Não é um "blob" de código

---

# 5. PADRÕES ARQUITETURAIS

### 1️⃣ Repository Pattern

**O que é**: Abstração entre código de negócio e banco de dados.

**Por quê**: Facilita testes (mock DB) e mudanças futuras (trocar PostgreSQL → MongoDB).

\`\`\`typescript
// Interface (contrato)
interface IProductRepository {
  findById(id: string): Promise<Product>;
  findByTenant(tenantId: string): Promise<Product[]>;
  create(product: Product): Promise<Product>;
  updateStock(id: string, delta: number): Promise<void>;
}

// Implementação (PostgreSQL específica)
class PostgresProductRepository implements IProductRepository {
  async findById(id: string) {
    return this.db.query('SELECT * FROM produtos WHERE id = $1', [id]);
  }
}

// Uso no serviço (não sabe que é PostgreSQL)
class ProductService {
  constructor(private repo: IProductRepository) {}
  async sell(productId: string, qty: number) {
    await this.repo.updateStock(productId, -qty);
  }
}
\`\`\`

**Benefício**: Se um dia migrar para MongoDB, só muda a implementação, o serviço continua igual.

---

### 2️⃣ Service Layer Pattern

**O que é**: Toda lógica de negócio fica em Services, controllers só orquestram.

**Por quê**: Reutilizar lógica em diferentes endpoints (API REST, GraphQL, webhooks).

\`\`\`typescript
// Lógica de negócio centralizada
class OrderService {
  async createOrder(tenant_id: string, items: Item[]) {
    // Validar estoque
    // Criar pedido
    // Abater estoque
    // Emitir evento ORDER_CREATED
  }
}

// Pode ser usada em:
// - POST /api/orders (API REST)
// - POST /webhooks/whatsapp (WhatsApp)
// - Cron job (importar de Excel)
// Toda lógica = centralizada
\`\`\`

---

### 3️⃣ Event-Driven Architecture

**O que é**: Eventos são emitidos quando algo importante acontece.

**Por quê**: Desacoplamento. WhatsApp não precisa saber de E-commerce.

\`\`\`typescript
// Evento emitido
class OrderService {
  async createOrder(...) {
    // ... criar pedido ...
    await this.eventBus.emit('order.created', { orderId, items });
  }
}

// Subscriber: notificar por Email
class EmailNotificationSubscriber {
  @EventSubscriber('order.created')
  async handleOrderCreated(event) {
    await this.emailService.sendConfirmation(event.orderId);
  }
}

// Subscriber: notificar por WhatsApp
class WhatsAppNotificationSubscriber {
  @EventSubscriber('order.created')
  async handleOrderCreated(event) {
    await this.whatsappService.notify(event.orderId);
  }
}

// Resultado: Um evento, múltiplos handlers. Sem acoplamento.
\`\`\`

---

### 4️⃣ Multi-Tenancy Pattern

**O que é**: Um banco de dados, múltiplos clientes isolados.

**Por quê**: Economia (1 database) e escalabilidade (novo cliente = sem infraestrutura).

\`\`\`typescript
// JWT contém tenant_id
const token = jwt.verify(authToken);
const tenantId = token.tenantId;

// Middleware seta contexto
app.use(async (req, res, next) => {
  req.tenantId = token.tenantId;
  // Configura PostgreSQL com tenant_id
  await db.setConfig(`app.current_tenant_id = '${tenantId}'`);
  next();
});

// RLS automático: query apenas vê dados do tenant
// SELECT * FROM produtos; → Apenas produtos dessa loja
\`\`\`

**Segurança**: Um hacker logado em Loja A não consegue ver dados de Loja B.

---

# 6. DIAGRAMAS DE FLUXO

## Fluxo 1: Venda completa (Happy Path)

\`\`\`
CLIENTE → PDV → SISTEMA
                 │
                 ├─ 1. Buscar produto
                 │  "Brigadeiro?"
                 │  DB retorna: id=123, estoque=50 ✓
                 │
                 ├─ 2. Validar estoque
                 │  50 >= 2 (quantidade solicitada) ✓
                 │
                 ├─ 3. BEGIN TRANSACTION
                 │  ├─ Criar pedido
                 │  ├─ Criar item_pedido
                 │  ├─ UPDATE produtos SET estoque = 48
                 │  ├─ INSERT movimentacao_estoque (auditoria)
                 │  ├─ Limpar reservas expiradas
                 │  └─ COMMIT (tudo ou nada)
                 │
                 ├─ 4. Registrar pagamento
                 │  └─ INSERT pagamentos
                 │
                 ├─ 5. Emitir evento
                 │  └─ EventBus.emit('order.created')
                 │
                 ├─ 6. Notificações (async, não bloqueia)
                 │  ├─ Send email
                 │  ├─ Send WhatsApp
                 │  └─ Push notification
                 │
                 └─ 7. Retornar sucesso
                    JSON: { orderId: "123", status: "confirmado" }
\`\`\`

## Fluxo 2: Concorrência (Race Condition Prevention)

\`\`\`
PDV                           WhatsApp
│                            │
├─ Lock: FOR UPDATE          │
│  SELECT * FROM produtos    │
│  WHERE id='brigadeiro'     │
│  (bloqueia a linha)        ├─ Tenta lock: FOR UPDATE
│                            │  (fica esperando...)
├─ Validar: 50 >= 2? ✓      │
│                            │ ← ← ← BLOQUEADO AQUI
├─ UPDATE estoque = 48       │
│  (ainda com lock)          │
│                            │
├─ COMMIT (libera lock)      │
│                            ├─ Agora consegue lock!
│                            ├─ Validar: 48 >= 2? ✓
│                            ├─ UPDATE estoque = 46
│                            └─ COMMIT
│
Resultado: CORRETO! 
PDV vendeu 2 (50→48)
WhatsApp vendeu 2 (48→46)
Total = 4 brigadeiros vendidos com estoque correto!
\`\`\`

---

# 7. STACK COMPLETO & ALTERNATIVAS

## Resumo Executivo

\`\`\`
┌─────────────────────────────────────┬──────────┬──────────────────────┐
│ Componente                          │ Escolhido│ Alternativas         │
├─────────────────────────────────────┼──────────┼──────────────────────┤
│ Frontend Framework                  │ Next.js  │ Nuxt, Remix, SvelteKit│
│ Backend Runtime                     │ Node.js  │ Python, Go, Java     │
│ Backend Framework                   │ NestJS   │ Express, Fastify     │
│ Banco de Dados                      │ Supabase │ Neon, Firebase       │
│ Cache & Sessions                    │ Redis    │ Memcached            │
│ Storage (imagens, PDFs)             │ Vercel   │ S3, Cloudinary       │
│ Pagamentos                          │ Mercado  │ Stripe, PayPal       │
│ WhatsApp                            │ 360Dialog│ Twilio, Meta API     │
│ Email                               │ Resend   │ Sendgrid, Mailgun    │
│ IA (classific. mensagens)           │ OpenAI   │ Anthropic, Groq      │
│ Deployment Frontend                 │ Vercel   │ Netlify, Railway     │
│ Deployment Backend                  │ Railway  │ Render, AWS Lambda   │
│ CI/CD                               │ GitHub   │ GitLab, Bitbucket    │
│ Monitoramento de Erros              │ Sentry   │ Rollbar, Bugsnag     │
│ Logging Centralizado                │ BetterSt │ Datadog, LogRocket   │
└─────────────────────────────────────┴──────────┴──────────────────────┘
\`\`\`

---

# 8. BACKEND: NODE.JS + NESTJS

## Por quê Node.js?

| Vantagem | Detalhe |
|----------|---------|
| **JavaScript Full-Stack** | Frontend (TypeScript) + Backend (TypeScript) = reutilizar tipo |
| **Ecossistema NPM** | 2 milhões de pacotes, resolver qualquer problema |
| **Async/Await Nativo** | Não bloqueia thread, perfeito para I/O |
| **Performance** | Bom para aplicações I/O heavy (APIs) |
| **Fácil DevOps** | Um Dockerfile, um processo. Docker-compose tira em 1s |
| **Curva de aprendizado** | Desenvolvedores JavaScript já sabem |

## Por quê NestJS?

| Vantagem | Detalhe |
|----------|---------|
| **TypeScript Obrigatório** | Menos bugs = type safety |
| **Enterprise-ready** | Decorators, DI, módulos = arquitetura sólida |
| **Middleware/Guards** | Autenticação, validação centralizada |
| **Interceptors** | Logging, transformação de response automática |
| **Exception Filters** | Tratamento de erro consistente |
| **Testing** | Testable by design (DI container) |

### Stack Backend Completo

\`\`\`yaml
# RUNTIME
Node.js: 20 LTS (suporte até 2026)

# FRAMEWORK
NestJS: 10+ (Express debaixo do capô)

# DATABASE
Prisma ORM: 5+ (type-safe queries)
PostgreSQL: 15+ (via Supabase)

# VALIDAÇÃO & TIPOS
TypeScript: 5+
Zod: 3+ (runtime validation)
Class Validator: Custom decorators

# AUTENTICAÇÃO
JWT RS256: Assimétrico (chave pública/privada)
Passport.js: Estratégias prontas
JWT + Refresh Token: 15min + 7 dias

# CACHE & SESSIONS
Redis: 7+ (Upstash serverless)
Ioredis: Driver

# TAXA LIMITING
Nestjs Throttle: Rate limiter built-in

# EVENTOS
EventEmitter2: Pub/sub pattern

# LOGGING
Winston: Structured logs

# TESTES
Vitest: Unit tests (rápido)
Supertest: HTTP testing
Jest: E2E tests

# SEGURANÇA
Helmet: Headers HTTP seguros
DOMPurify: XSS prevention
Joi/Zod: Input validation

# DEPLOYMENT
Docker: Container
PM2: Process manager (production)
\`\`\`

### Como Estruturar Projeto NestJS

\`\`\`
src/
├── main.ts                    # Entry point
├── app.module.ts              # Root module
│
├── common/                    # Código compartilhado
│   ├── decorators/
│   │   └── current-tenant.ts  # @CurrentTenant() para JWT
│   ├── guards/
│   │   └── auth.guard.ts      # JWT validation
│   ├── interceptors/
│   │   └── logging.interceptor # Log todas as requisições
│   ├── filters/
│   │   └── http-exception.filter # Tratamento erro global
│   └── pipes/
│       └── validation.pipe    # Zod validation
│
├── modules/                   # Business modules
│   ├── products/
│   │   ├── products.module.ts
│   │   ├── products.service.ts
│   │   ├── products.controller.ts
│   │   ├── entities/
│   │   │   └── product.entity.ts
│   │   ├── dto/
│   │   │   ├── create-product.dto.ts
│   │   │   └── update-product.dto.ts
│   │   └── repositories/
│   │       └── products.repository.ts
│   │
│   ├── orders/
│   │   ├── orders.module.ts
│   │   ├── orders.service.ts
│   │   ├── orders.controller.ts
│   │   └── ...
│   │
│   └── payments/
│       └── ...
│
├── integrations/              # Integrações externas
│   ├── whatsapp/
│   │   ├── whatsapp.service.ts
│   │   ├── 360dialog.adapter.ts
│   │   └── whatsapp.webhook.ts
│   │
│   ├── payments/
│   │   ├── mercado-pago.adapter.ts
│   │   └── stripe.adapter.ts
│   │
│   └── ai/
│       └── openai.service.ts
│
├── database/
│   ├── migrations/           # SQL scripts
│   ├── seeds/                # Dados iniciais
│   └── schema.prisma         # Prisma schema
│
└── config/
    ├── database.config.ts
    ├── jwt.config.ts
    └── redis.config.ts
\`\`\`

### Exemplo: Order Service (Regra de Negócio)

\`\`\`typescript
// orders/orders.service.ts
@Injectable()
export class OrdersService {
  constructor(
    private ordersRepo: OrdersRepository,
    private productsRepo: ProductsRepository,
    private eventBus: EventEmitter2,
    private prisma: PrismaService
  ) {}

  async createOrder(
    tenantId: string,
    createOrderDto: CreateOrderDto
  ): Promise<Order> {
    // 1. Validar estoque
    for (const item of createOrderDto.items) {
      const product = await this.productsRepo.findById(item.productId);
      if (!product || product.stock < item.quantity) {
        throw new InsufficientStockException(item.productId);
      }
    }

    // 2. Transação atômica
    return await this.prisma.$transaction(async (tx) => {
      // 2a. Criar pedido
      const order = await tx.pedidos.create({
        data: {
          tenant_id: tenantId,
          numero_pedido: await this.generateOrderNumber(tenantId),
          cliente_nome: createOrderDto.clientName,
          status: 'pendente',
          total: 0, // Calcula depois
        },
      });

      // 2b. Criar itens e abater estoque
      let total = 0;
      for (const item of createOrderDto.items) {
        await tx.itens_pedido.create({
          data: {
            pedido_id: order.id,
            produto_id: item.productId,
            quantidade: item.quantity,
            preco_unitario: item.price,
          },
        });

        // Abater estoque de forma atômica
        await tx.produtos.updateRaw(
          `UPDATE produtos SET estoque = estoque - $1 WHERE id = $2`,
          [item.quantity, item.productId]
        );

        // Registrar auditoria
        await tx.movimentacoes_estoque.create({
          data: {
            tenant_id: tenantId,
            produto_id: item.productId,
            tipo: 'venda',
            quantidade: -item.quantity,
            pedido_id: order.id,
          },
        });

        total += item.price * item.quantity;
      }

      // 2c. Atualizar total do pedido
      await tx.pedidos.update({
        where: { id: order.id },
        data: { total },
      });

      return order;
    });

    // 3. Emitir evento (fora da transação, async)
    this.eventBus.emit('order.created', { orderId: order.id });

    return order;
  }
}
\`\`\`

---

# 9. BANCO DE DADOS: SUPABASE

## Por quê Supabase e não Neon?

| Aspecto | Supabase | Neon | Vencedor |
|--------|----------|------|---------|
| **PostgreSQL Puro** | ✓ | ✓✓ | Neon |
| **Auth Integrado** | ✓✓ | ❌ | Supabase |
| **Real-time Subs** | ✓✓ | ❌ | Supabase |
| **Row-Level Security** | ✓✓ | ✓ | Supabase (melhor docs) |
| **Storage (Imagens)** | ✓✓ | ❌ | Supabase |
| **Edge Functions** | ✓✓ | ❌ | Supabase |
| **Custo (pequeno)** | ~$25/mês | ~$15/mês | Neon |
| **Custo (grande)** | ~$600/mês | ~$200/mês | Neon |
| **Vendor Lock-in** | ⚠️ Alto | ❌ Mínimo | Neon |

### Decisão: **Supabase para MVP** (prazo curto)

- Auth já vem pronto (economiza semanas)
- Real-time para atualizações de estoque (melhor UX)
- Storage para imagens (sem terceiros)
- Migration para Neon depois se crescer (PostgreSQL é portável)

---

## Schema SQL Completo

### Tabelas Principais

\`\`\`sql
-- 1. TENANTS (Multi-tenancy)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  
  plano VARCHAR(50) DEFAULT 'free', -- free/pro/enterprise
  status VARCHAR(50) DEFAULT 'ativo', -- ativo/suspenso/cancelado
  
  -- Limites por plano
  max_produtos INT DEFAULT 100,
  max_usuarios INT DEFAULT 5,
  max_vendedores INT DEFAULT 3,
  
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT email_unique UNIQUE(email)
);

-- 2. USUARIOS (Controle de acesso)
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  email CITEXT UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  
  role VARCHAR(50) NOT NULL, -- owner/admin/gerente/vendedor/producao
  
  ativo BOOLEAN DEFAULT TRUE,
  email_verificado BOOLEAN DEFAULT FALSE,
  
  ultimo_login TIMESTAMP,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT email_format CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- 3. CATEGORIAS
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  icone VARCHAR(100),
  
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tenant_id, nome)
);

-- 4. PRODUTOS (Core)
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  sku VARCHAR(100),
  slug VARCHAR(255),
  
  preco DECIMAL(10,2) NOT NULL,
  preco_custo DECIMAL(10,2),
  preco_promocional DECIMAL(10,2),
  
  estoque_atual INT DEFAULT 0,
  estoque_minimo INT DEFAULT 0,
  tipo_estoque VARCHAR(50) DEFAULT 'normal', -- normal/sob_encomenda
  
  -- Optimistic locking
  version INT DEFAULT 1,
  
  -- Imagens (JSONB array)
  imagens JSONB DEFAULT '[]',
  
  ativo BOOLEAN DEFAULT TRUE,
  destaque BOOLEAN DEFAULT FALSE,
  
  visivel_pdv BOOLEAN DEFAULT TRUE,
  visivel_ecommerce BOOLEAN DEFAULT TRUE,
  visivel_whatsapp BOOLEAN DEFAULT TRUE,
  
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tenant_id, sku)
);

-- 5. PEDIDOS (Transações)
CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON SET NULL,
  
  numero_pedido VARCHAR(50) NOT NULL,
  referencia_externa VARCHAR(100),
  
  cliente_nome VARCHAR(255) NOT NULL,
  cliente_email VARCHAR(255),
  cliente_telefone VARCHAR(20),
  cliente_cpf VARCHAR(11),
  
  origem VARCHAR(50) NOT NULL, -- pdv/whatsapp/ecommerce/manual
  
  status VARCHAR(50) NOT NULL DEFAULT 'pendente',
  -- Estados: pendente → confirmado → producao → pronto → enviado → entregue
  --                                                              ↘ cancelado
  
  tipo_entrega VARCHAR(50), -- retirada/entrega
  endereco_completo TEXT,
  
  subtotal DECIMAL(10,2) NOT NULL,
  desconto DECIMAL(10,2) DEFAULT 0,
  taxa_entrega DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  
  forma_pagamento VARCHAR(50), -- pix/boleto/cartao/dinheiro/manual
  pagamento_status VARCHAR(50) DEFAULT 'pendente',
  pagamento_id VARCHAR(255),
  
  observacoes TEXT,
  dados_extras JSONB DEFAULT '{}',
  
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tenant_id, numero_pedido)
);

-- 6. ITENS_PEDIDO (Linhas)
CREATE TABLE itens_pedido (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  
  -- Snapshot do produto (caso delete depois)
  produto_nome VARCHAR(255) NOT NULL,
  produto_sku VARCHAR(100),
  
  quantidade INT NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  desconto DECIMAL(10,2) DEFAULT 0,
  
  -- Generated column (não é armazenado, calculado sempre)
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (quantidade * preco_unitario - COALESCE(desconto, 0)) STORED,
  
  observacoes TEXT,
  dados_customizacao JSONB DEFAULT '{}',
  
  criado_em TIMESTAMP DEFAULT NOW()
);

-- 7. MOVIMENTACOES_ESTOQUE (Auditoria)
CREATE TABLE movimentacoes_estoque (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  
  tipo VARCHAR(50) NOT NULL,
  -- venda/devolucao/ajuste/recebimento/perda/producao
  
  quantidade INT NOT NULL, -- negativo = saida, positivo = entrada
  
  estoque_anterior INT NOT NULL,
  estoque_atual INT NOT NULL,
  
  origem VARCHAR(50), -- pdv/whatsapp/ecommerce/admin/api/import
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  
  observacao TEXT,
  motivo VARCHAR(255),
  
  criado_em TIMESTAMP DEFAULT NOW()
);

-- 8. RESERVAS_ESTOQUE (Carrinho, expires em 5 min)
CREATE TABLE reservas_estoque (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  
  quantidade INT NOT NULL,
  sessao_id VARCHAR(255), -- Session browser
  
  expira_em TIMESTAMP NOT NULL,
  
  criado_em TIMESTAMP DEFAULT NOW()
);

-- 9. PAGAMENTOS (Rastreamento)
CREATE TABLE pagamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  
  id_externo VARCHAR(255),
  gateway VARCHAR(50), -- mercado_pago/stripe/pix/manual
  
  valor DECIMAL(10,2) NOT NULL,
  taxa DECIMAL(10,2) DEFAULT 0,
  valor_liquido DECIMAL(10,2) GENERATED ALWAYS AS (valor - COALESCE(taxa, 0)) STORED,
  
  status VARCHAR(50) DEFAULT 'pendente',
  -- pendente/processando/confirmado/falhou/estornado
  
  metodo VARCHAR(50), -- cartao_credito/pix/boleto/etc
  ultimos_digitos VARCHAR(4),
  bandeira VARCHAR(50),
  
  webhook_raw JSONB DEFAULT '{}',
  
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- 10. CUPONS_DESCONTO
CREATE TABLE cupons_desconto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  codigo VARCHAR(50) UNIQUE NOT NULL,
  tipo_desconto VARCHAR(50), -- percentual/fixo
  valor DECIMAL(10,2) NOT NULL,
  
  uso_maximo INT,
  uso_atual INT DEFAULT 0,
  minimo_compra DECIMAL(10,2) DEFAULT 0,
  maximo_desconto DECIMAL(10,2),
  
  data_inicio TIMESTAMP,
  data_fim TIMESTAMP,
  ativo BOOLEAN DEFAULT TRUE,
  
  criado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, codigo)
);
\`\`\`

### Funções SQL Críticas

\`\`\`sql
-- 1. Função atômica para abater estoque
CREATE OR REPLACE FUNCTION decrement_stock_atomic(
  p_produto_id UUID,
  p_quantidade INTEGER,
  p_tenant_id UUID
)
RETURNS TABLE(success BOOLEAN, novo_estoque INTEGER, erro VARCHAR) AS $$
DECLARE
  v_estoque_atual INTEGER;
  v_version INTEGER;
BEGIN
  -- Lock pessimista
  SELECT estoque_atual, version 
  INTO v_estoque_atual, v_version
  FROM produtos
  WHERE id = p_produto_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false::BOOLEAN, 0::INTEGER, 'Produto não encontrado'::VARCHAR;
    RETURN;
  END IF;
  
  -- Validar estoque
  IF v_estoque_atual < p_quantidade THEN
    RETURN QUERY SELECT false::BOOLEAN, v_estoque_atual::INTEGER, 'Estoque insuficiente'::VARCHAR;
    RETURN;
  END IF;
  
  -- Update com optimistic locking
  UPDATE produtos
  SET 
    estoque_atual = estoque_atual - p_quantidade,
    version = version + 1
  WHERE 
    id = p_produto_id 
    AND tenant_id = p_tenant_id
    AND version = v_version;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false::BOOLEAN, -1::INTEGER, 'Conflict: versão desatualizada'::VARCHAR;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true::BOOLEAN, (v_estoque_atual - p_quantidade)::INTEGER, ''::VARCHAR;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger para auditoria automática
CREATE OR REPLACE FUNCTION audit_stock_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estoque_atual IS DISTINCT FROM NEW.estoque_atual THEN
    INSERT INTO movimentacoes_estoque (
      tenant_id, produto_id, tipo, quantidade,
      estoque_anterior, estoque_atual, origem, usuario_id
    ) VALUES (
      NEW.tenant_id, 
      NEW.id, 
      'ajuste_manual',
      NEW.estoque_atual - OLD.estoque_atual,
      OLD.estoque_atual, 
      NEW.estoque_atual, 
      'admin',
      current_user_id() -- Helper function
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_produtos_estoque
AFTER UPDATE ON produtos 
FOR EACH ROW
EXECUTE FUNCTION audit_stock_change();

-- 3. View para estoque disponível (considerando reservas)
CREATE OR REPLACE VIEW v_produtos_estoque_disponivel AS
SELECT 
  p.id,
  p.tenant_id,
  p.nome,
  p.estoque_atual,
  COALESCE(SUM(r.quantidade), 0) AS estoque_reservado,
  (p.estoque_atual - COALESCE(SUM(r.quantidade), 0)) AS estoque_disponivel,
  CASE 
    WHEN (p.estoque_atual - COALESCE(SUM(r.quantidade), 0)) <= p.estoque_minimo
      THEN true
    ELSE false
  END AS precisa_reposicao
FROM produtos p
LEFT JOIN reservas_estoque r 
  ON r.produto_id = p.id 
  AND r.expira_em > NOW()
WHERE p.ativo = true
GROUP BY p.id, p.tenant_id, p.nome, p.estoque_atual, p.estoque_minimo;
\`\`\`

### Índices de Performance

\`\`\`sql
-- Índices compostos (mais importantes)
CREATE INDEX idx_produtos_tenant_ativo ON produtos(tenant_id, ativo);
CREATE INDEX idx_produtos_tenant_nome ON produtos(tenant_id, nome);
CREATE INDEX idx_pedidos_tenant_status_data ON pedidos(tenant_id, status, criado_em DESC);
CREATE INDEX idx_movimentacoes_produto_data ON movimentacoes_estoque(produto_id, criado_em DESC);
CREATE INDEX idx_usuarios_tenant_email ON usuarios(tenant_id, email);

-- Índices parciais (economizam espaço)
CREATE INDEX idx_produtos_ativos ON produtos(id) WHERE ativo = true;
CREATE INDEX idx_pedidos_abertos ON pedidos(id) WHERE status NOT IN ('entregue', 'cancelado');
CREATE INDEX idx_reservas_validas ON reservas_estoque(produto_id) WHERE expira_em > NOW();

-- Full-text search (português)
CREATE INDEX idx_produtos_search ON produtos 
USING gin(to_tsvector('portuguese', nome || ' ' || COALESCE(descricao, '')));
\`\`\`

### Row-Level Security (RLS)

\`\`\`sql
-- Habilitar RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

-- Função helper: get current tenant_id from JWT context
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Políticas
CREATE POLICY tenant_isolation_produtos ON produtos
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_pedidos ON pedidos
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_usuarios ON usuarios
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_isolation_movimentacoes ON movimentacoes_estoque
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());
\`\`\`

---

# 10. FRONTEND: NEXT.JS

## Por quê Next.js?

| Vantagem | Detalhe |
|----------|---------|
| **Server Components** | Fetch dados diretamente, sem API intermédio |
| **Image Optimization** | Next/Image automático (lazy load, format) |
| **App Router** | Roteamento simples (file-based routing) |
| **API Routes** | Webhooks direto no projeto (sem servidor extra) |
| **Middleware** | Autenticação, redirects, headers |
| **Deployment** | Deploy em 1 clique no Vercel |
| **TypeScript Native** | Suporte de primeira classe |

### Estrutura de Pastas

\`\`\`
app/
├── layout.tsx              # Root layout (Provider wrappers)
├── page.tsx                # Home page
├── error.tsx               # Global error boundary
├── not-found.tsx           # 404 page
│
├── (auth)/                 # Group: Não precisa autenticação
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── layout.tsx
│
├── (protected)/            # Group: Protegido por auth
│   ├── layout.tsx          # Layout com Guard
│   │
│   ├── pdv/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── components/
│   │       ├── pdv-search.tsx
│   │       ├── pdv-cart.tsx
│   │       └── pdv-checkout.tsx
│   │
│   ├── admin/
│   │   ├── dashboard/page.tsx
│   │   ├── produtos/
│   │   │   ├── page.tsx      # Lista
│   │   │   ├── [id]/page.tsx # Detalhe/edit
│   │   │   └── novo/page.tsx # Criar
│   │   ├── pedidos/page.tsx
│   │   ├── relatorios/
│   │   │   ├── vendas/page.tsx
│   │   │   └── estoque/page.tsx
│   │   └── usuarios/page.tsx
│   │
│   ├── perfil/
│   │   └── page.tsx
│   │
│   └── carrinho/
│       ├── page.tsx
│       └── checkout/page.tsx
│
├── ecommerce/              # Público (sem auth)
│   ├── page.tsx           # Catálogo
│   ├── layout.tsx
│   └── produtos/
│       └── [slug]/page.tsx # Detalhe do produto
│
├── api/
│   ├── auth/
│   │   ├── login/route.ts
│   │   ├── logout/route.ts
│   │   └── refresh/route.ts
│   │
│   ├── produtos/
│   │   ├── route.ts       # GET /api/produtos
│   │   └── [id]/route.ts  # GET/PATCH /api/produtos/[id]
│   │
│   ├── pedidos/
│   │   ├── route.ts       # POST create, GET list
│   │   └── [id]/route.ts  # GET detail, PATCH status
│   │
│   └── webhooks/
│       ├── mercado-pago/route.ts
│       ├── whatsapp/route.ts
│       └── stripe/route.ts
│
└── public/
    ├── images/
    └── icons/

components/
├── auth/
│   ├── login-form.tsx
│   ├── signup-form.tsx
│   └── logout-button.tsx
│
├── ui/               # Shadcn/ui components
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   └── ...
│
├── layout/
│   ├── navbar.tsx
│   ├── sidebar.tsx
│   └── footer.tsx
│
├── products/
│   ├── product-card.tsx
│   ├── product-list.tsx
│   └── product-form.tsx
│
└── orders/
    ├── order-list.tsx
    ├── order-detail.tsx
    └── order-form.tsx

lib/
├── api-client.ts      # Fetch wrapper com auth
├── auth.ts            # Auth utilities
├── jwt.ts             # JWT decode
├── validations.ts     # Zod schemas
└── utils.ts           # Helpers

hooks/
├── use-auth.ts        # Contexto de autenticação
├── use-products.ts    # Query de produtos (SWR/React Query)
├── use-orders.ts      # Query de pedidos
└── use-toast.ts       # Toast notifications

store/
├── auth.ts            # Zustand auth store
├── app.ts             # Zustand app store
└── cart.ts            # Zustand cart store

styles/
└── globals.css        # Tailwind + custom CSS

.env.local
next.config.js
tsconfig.json
package.json
\`\`\`

### Exemplo: Page com Server Component + Streaming

\`\`\`typescript
// app/(protected)/produtos/page.tsx

import { ProdutosList } from './components/produtos-list';
import { ProdutoSearch } from './components/produto-search';
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';

// Fetch diretamente do backend (Server Component)
async function getProdutos(tenantId: string, page = 1) {
  const session = await getServerSession();
  const res = await fetch(`${process.env.API_URL}/produtos`, {
    headers: {
      'Authorization': `Bearer ${session?.token}`,
      'X-Tenant-ID': tenantId,
    },
  });
  
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export default async function ProdutosPage() {
  // Fetch na server (não no cliente)
  const { data: produtos, pagination } = await getProdutos('tenant-123');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Meus Produtos</h1>
      
      <ProdutoSearch />
      
      {/* Suspense para streaming */}
      <Suspense fallback={<div>Carregando...</div>}>
        <ProdutosList produtos={produtos} pagination={pagination} />
      </Suspense>
    </div>
  );
}
\`\`\`

---

# 11. FERRAMENTAS DE IA

## Qual IA usar para o quê?

| Tarefa | Melhor IA | Por quê | Custo |
|--------|-----------|--------|-------|
| **Classificar intent (WhatsApp)** | GPT-4 Mini | Rápido + barato | $0.05/1K tokens |
| **Recomendações de produtos** | GPT-4 Mini | Entende contexto | $0.05/1K tokens |
| **Geração de descrições** | Claude 3.5 | Melhor escrita | $0.003/1K tokens |
| **Análise de sentimento** | GPT-4 Mini | Fast enough | $0.05/1K tokens |
| **Code generation (dev)** | Cursor AI | Melhor para TypeScript | $20/mês |
| **Debugging (dev)** | GitHub Copilot | Context-aware | $10-20/mês |

### OpenAI API Setup

\`\`\`typescript
// lib/openai.ts
import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Exemplo: Classificar intent de mensagem WhatsApp
export async function classifyWhatsappIntent(message: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-mini',
    messages: [
      {
        role: 'system',
        content: `Você é um classificador de intents para um chatbot de vendas.
        
Classifique a mensagem em uma destas categorias:
- CATALOG (cliente quer ver produtos)
- PRODUCT_INFO (cliente quer saber de um produto específico)
- BUY (cliente quer comprar)
- ORDER_STATUS (cliente quer status do pedido)
- COMPLAINT (cliente está reclamando)
- OTHER (não se encaixa em nenhuma)

Retorne apenas a categoria em MAIÚSCULAS.`,
      },
      {
        role: 'user',
        content: message,
      },
    ],
    temperature: 0,
    max_tokens: 10,
  });

  return response.choices[0].message.content;
}

// Exemplo: Gerar descrição de produto
export async function generateProductDescription(name: string, category: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-mini',
    messages: [
      {
        role: 'user',
        content: `Gere uma descrição curta (max 150 caracteres) e atrativa para esse produto:
        
Nome: ${name}
Categoria: ${category}

Deve ser em português, persuasiva, e apropriada para WhatsApp/E-commerce.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 50,
  });

  return response.choices[0].message.content;
}
\`\`\`

### Cursor IDE (Para Desenvolvimento)

\`\`\`
Por quê usar Cursor?
- Entende seu projeto inteiro (context window)
- Edita código automaticamente (não gera só, edita)
- Debugging visual integrado
- Atalhos: Cmd+K (gerar), Cmd+Shift+L (refatorar)

Custo: $20/mês (Pro)
\`\`\`

---

# 12. DEVOPS & DEPLOYMENT

## Arquitetura de Deploy

\`\`\`
GitHub Repo
    ↓
GitHub Actions (CI/CD)
    ├─ Lint + Type check
    ├─ Tests (unit + e2e)
    ├─ Build artifacts
    │
    ├─ Build Frontend → Vercel Deploy
    │  └─ Produção em vercel.app
    │
    └─ Build Backend → Railway Deploy
       └─ Produção em railway.app
\`\`\`

### GitHub Actions Workflow

\`\`\`yaml
# .github/workflows/deploy.yml

name: Deploy Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-build:
    runs-on: ubuntu-latest
    steps:
      # 1. Checkout código
      - uses: actions/checkout@v3

      # 2. Setup Node
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      # 3. Cache dependencies
      - uses: actions/cache@v3
        with:
          path: ~/.npm
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}

      # 4. Install dependencies
      - run: npm ci

      # 5. Lint
      - run: npm run lint

      # 6. Type check
      - run: npm run type-check

      # 7. Tests
      - run: npm run test

      # 8. E2E tests
      - run: npm run test:e2e

      # 9. Build
      - run: npm run build

  deploy-frontend:
    needs: test-build
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # Vercel CLI deployment
      - run: npx vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-backend:
    needs: test-build
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # Railway deployment
      - run: |
          npm install -g railway
          railway deploy --token ${{ secrets.RAILWAY_TOKEN }}
\`\`\`

### Docker Setup

\`\`\`dockerfile
# Dockerfile (Backend)
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build
RUN npm run build

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start
CMD ["npm", "start"]
\`\`\`

### Docker Compose (Desenvolvimento)

\`\`\`yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: unificada
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/unificada
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
    volumes:
      - ./frontend:/app
      - /app/node_modules

volumes:
  postgres_data:
  redis_data:
\`\`\`

---

# 13. BANCO DE DADOS DETALHADO

[Já coberto na SEÇÃO 9 acima]

---

# 14. SEGURANÇA & AUTENTICAÇÃO

## JWT Flow Completo

\`\`\`
CLIENTE                          SERVIDOR
│                                │
├─ POST /auth/login              │
│  { email, password }           │
│─────────────────────────────→  │
│                                ├─ Hash password
│                                ├─ Comparar com DB
│                                ├─ Gerar JWT tokens
│                                ├─ Salvar refresh token
│  ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  { accessToken, refreshToken } │
│                                │
│ (15 minutos)               (7 dias)
│
├─ GET /api/produtos             │
│  Authorization: Bearer <accessToken>
│─────────────────────────────→  │
│                                ├─ Decode JWT
│                                ├─ Verificar assinatura
│                                ├─ Validar expiration
│                                ├─ Extrair tenantId
│                                ├─ Executar query com RLS
│  ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  [lista de produtos]           │
│
│ (Após 15 min, token expira)    │
│
├─ POST /auth/refresh            │
│  { refreshToken }              │
│─────────────────────────────→  │
│                                ├─ Validar refresh token
│                                ├─ Gerar novo access token
│  ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  { accessToken }               │
│
└─ Requisição com novo token
\`\`\`

### Implementação JWT (Backend)

\`\`\`typescript
// jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      publicKey: process.env.JWT_PUBLIC_KEY,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      role: payload.role,
    };
  }
}

// auth.service.ts
@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(email: string, password: string) {
    // 1. Validar user
    const user = await this.usersService.findByEmail(email);
    const isPasswordValid = await bcrypt.compare(password, user.senhaHash);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Gerar tokens
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
      },
      {
        expiresIn: '15m',
        algorithm: 'RS256',
        privateKey: process.env.JWT_PRIVATE_KEY,
      }
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        expiresIn: '7d',
        algorithm: 'RS256',
        privateKey: process.env.JWT_PRIVATE_KEY,
      }
    );

    // 3. Salvar refresh token (para revogação depois)
    await this.sessionsService.create({
      userId: user.id,
      refreshToken: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutos em segundos
    };
  }

  async refresh(refreshToken: string) {
    // 1. Verificar se está no DB
    const session = await this.sessionsService.findByHash(hashToken(refreshToken));
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // 2. Decodificar e gerar novo access token
    const payload = this.jwtService.verify(refreshToken, {
      publicKey: process.env.JWT_PUBLIC_KEY,
    });

    const newAccessToken = this.jwtService.sign(
      { ...payload },
      {
        expiresIn: '15m',
        privateKey: process.env.JWT_PRIVATE_KEY,
      }
    );

    return { accessToken: newAccessToken, expiresIn: 900 };
  }
}
\`\`\`

### Autenticação (Frontend)

\`\`\`typescript
// hooks/use-auth.ts
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const router = useRouter();

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) throw new Error('Login failed');

    const { accessToken, refreshToken } = await res.json();

    // Salvar tokens no localStorage (ou cookies HttpOnly)
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    router.push('/admin/dashboard');
  }, [router]);

  const logout = useCallback(async () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  }, [router]);

  return { login, logout };
}

// lib/api-client.ts
export async function fetchAPI(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}${path}`,
    {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    }
  );

  // Se 401, tentar refresh
  if (response.status === 401) {
    const refreshToken = localStorage.getItem('refreshToken');
    const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (refreshRes.ok) {
      const { accessToken } = await refreshRes.json();
      localStorage.setItem('accessToken', accessToken);

      // Retry com novo token
      return fetchAPI(path, options);
    } else {
      // Logout
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
  }

  return response;
}
\`\`\`

---

# 15. API REST COMPLETA

[Coberto anteriormente, resumo:]

### Endpoints Principais

\`\`\`
Autenticação
POST   /auth/login                   Login
POST   /auth/refresh                 Refresh token
POST   /auth/logout                  Logout

Produtos
GET    /api/v1/produtos               Lista
POST   /api/v1/produtos               Criar
GET    /api/v1/produtos/:id           Detalhe
PATCH  /api/v1/produtos/:id           Editar
DELETE /api/v1/produtos/:id           Deletar
POST   /api/v1/produtos/:id/stock     Ajustar estoque

Pedidos
POST   /api/v1/orders                 Criar
GET    /api/v1/orders                 Listar
GET    /api/v1/orders/:id             Detalhe
PATCH  /api/v1/orders/:id/status      Atualizar status
POST   /api/v1/orders/:id/cancel      Cancelar

Pagamentos
GET    /api/v1/payments/:id           Detalhe
POST   /api/v1/payments/:id/confirm   Confirmar (webhook)

Relatórios
GET    /api/v1/reports/sales          Vendas por período
GET    /api/v1/reports/inventory      Status de estoque
GET    /api/v1/reports/top-products   Produtos mais vendidos

Webhooks
POST   /api/webhooks/mercado-pago     Webhook de pagamento
POST   /api/webhooks/whatsapp         Webhook de mensagem
\`\`\`

---

# 16. TRANSAÇÕES ACID

[Coberto anteriormente]

---

# 17. SETUP LOCAL PASSO-A-PASSO

## Pré-requisitos

\`\`\`bash
# Verificar versões
node --version        # >= 20.0.0
npm --version         # >= 10.0.0
git --version         # >= 2.40.0
docker --version      # >= 24.0.0
\`\`\`

## Paso 1: Clone e Setup

\`\`\`bash
# Clone
git clone https://github.com/seu-usuario/plataforma-unificada.git
cd plataforma-unificada

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
\`\`\`

## Paso 2: Variáveis de Ambiente

\`\`\`bash
# backend/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/unificada
REDIS_URL=redis://localhost:6379
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
NODE_ENV=development

# Integrações (coloque tokens reais ou skip)
WHATSAPP_TOKEN=seu_token
MERCADO_PAGO_TOKEN=seu_token
OPENAI_API_KEY=sk-...

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
\`\`\`

## Paso 3: Banco de Dados

\`\`\`bash
# Subir PostgreSQL + Redis com Docker
docker-compose up -d

# Migrations
cd backend
npm run migrate:dev

# Seed (dados de teste)
npm run seed
\`\`\`

## Paso 4: Rodando Localmente

\`\`\`bash
# Terminal 1: Backend (porta 3001)
cd backend
npm run dev

# Terminal 2: Frontend (porta 3000)
cd frontend
npm run dev

# Terminal 3: Testes (opcional)
cd backend
npm run test:watch
\`\`\`

## Paso 5: Testar

\`\`\`bash
# Abrir http://localhost:3000
# Fazer login com:
# Email: admin@test.com
# Senha: Test123456!

# Criar produto de teste
# Criar pedido
# Verificar estoque atualiza
\`\`\`

---

# 18. FLUXOS DE NEGÓCIO

## Fluxo 1: Venda via PDV

\`\`\`
1. Vendedor abre PDV (localhost:3000/pdv)
2. Busca "Brigadeiro" (GET /api/produtos?search=brigadeiro)
3. Vê: Brigadeiro (R$ 22.50, estoque=50)
4. Clica para adicionar (quantidade 2)
5. Sistema valida: 50 >= 2? SIM
6. Calcula: 22.50 × 2 = 45.00
7. Exibe carrinho com total
8. Clica "Finalizar"
9. Sistema cria pedido:
   POST /api/orders {
     origem: "pdv",
     items: [{ productId, quantidade: 2 }],
     formaPagamento: "dinheiro"
   }
10. Backend:
    a. BEGIN TRANSACTION
    b. Cria pedido (status=confirmado)
    c. Cria item_pedido
    d. Chama decrement_stock_atomic() → estoque 50→48
    e. Registra movimentação (auditoria)
    f. COMMIT
11. Retorna: { orderId: "123", numero: "#LOJA-001" }
12. Imprime recibo
13. Pedido aparece em "Fila de Produção" (admin)
\`\`\`

## Fluxo 2: Venda via E-commerce

\`\`\`
1. Cliente acessa www.meuloja.com
2. Navega catálogo (GET /api/public/produtos)
3. Clica em "Brigadeiro"
4. Vê detalhe + fotos + avaliações
5. Adiciona ao carrinho (reserva estoque por 5 min)
   POST /api/reservas {
     produtoId,
     quantidade: 2,
     sessionId
   }
6. Vai para checkout
7. Preenche dados (nome, email, endereço)
8. Seleciona "Entrega" + "Pix"
9. Clica "Pagar"
   POST /api/orders {
     origem: "ecommerce",
     items: [...],
     endereco,
     formaPagamento: "pix"
   }
10. Sistema retorna link de pagamento (Mercado Pago)
11. Cliente clica e paga
12. Webhook de confirmação:
    POST /api/webhooks/mercado-pago { orderId, status: "approved" }
13. Backend atualiza pedido → status confirmado
14. Emite evento ORDER_PAID
15. Handlers:
    - SendEmail: Envia email de confirmação
    - SendWhatsApp: Envia mensagem no WhatsApp
    - UpdateInventory: Abate estoque (deduz das reservas)
16. Pedido vai para fila de produção
\`\`\`

## Fluxo 3: Atendimento via WhatsApp

\`\`\`
Cliente: "Oi, tem brigadeiro?"

1. Webhook recebe mensagem
   POST /api/webhooks/whatsapp {
     from: "+5511999998888",
     body: "Oi, tem brigadeiro?"
   }

2. Backend classifica intent:
   classifyIntent("Oi, tem brigadeiro?") → PRODUCT_INFO

3. Busca em estoque:
   SELECT * FROM produtos WHERE nome ILIKE '%brigadeiro%'

4. Monta resposta com 3 opções:
   "Oi! Sim, temos 😊\n
    🍫 Brigadeiro Gourmet - R$22.50\n
    🍫 Brigadeiro com Nutella - R$25.00\n
    Qual interesse?"

5. Envia via 360Dialog API

Cliente clica: "Brigadeiro Gourmet (2 unidades)"

6. Classifica como BUY
7. Cria pedido:
   createOrder({ 
     clienteNome: "João",
     clienteTelefone: "+5511999998888",
     origem: "whatsapp",
     items: [{ produtoId, quantidade: 2 }]
   })
8. Gera link de pagamento
9. Envia para cliente com mensagem:
   "Ótimo! Seu pedido #LOJA-025 é:\n
    2x Brigadeiro Gourmet = R$45.00\n
    💳 Pague aqui: [link]\n
    Agradecemos!"
10. Cliente paga
11. Webhook confirma
12. Envia confirmação no WhatsApp
\`\`\`

---

# 19. TESTES & QA

## Unit Tests (Vitest)

\`\`\`typescript
// orders.service.spec.ts
describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  describe('createOrder', () => {
    it('should create order and decrement stock', async () => {
      // Setup
      const tenantId = 'tenant-123';
      const productId = 'prod-456';
      
      // Mock
      jest.spyOn(prisma, '$transaction').mockResolvedValueOnce({
        id: 'order-789',
        numero_pedido: '#LOJA-001',
      });

      // Execute
      const result = await service.createOrder(tenantId, {
        items: [{ produtoId: productId, quantidade: 2 }],
      });

      // Assert
      expect(result.id).toBe('order-789');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw InsufficientStockException', async () => {
      // Setup: estoque insuficiente
      jest.spyOn(productsRepo, 'findById').mockResolvedValueOnce({
        stock: 1,
      });

      // Execute & Assert
      await expect(
        service.createOrder(tenantId, {
          items: [{ produtoId: productId, quantidade: 2 }],
        })
      ).rejects.toThrow(InsufficientStockException);
    });
  });
});
\`\`\`

## E2E Tests (Playwright)

\`\`\`typescript
// tests/pdv.e2e.ts
import { test, expect } from '@playwright/test';

test.describe('PDV Flow', () => {
  test('should sell product and update inventory', async ({ page }) => {
    // 1. Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'vendedor@test.com');
    await page.fill('input[name="password"]', 'Test123456!');
    await page.click('button:has-text("Entrar")');
    await page.waitForURL('**/pdv');

    // 2. Search product
    await page.fill('input[placeholder="Buscar produto..."]', 'Brigadeiro');
    await page.waitForSelector('[data-product-id]');

    // 3. Add to cart
    await page.click('[data-product-id] >> text=Adicionar');
    await page.fill('input[type="number"]', '2');
    await page.click('button:has-text("Confirmar")');

    // 4. Verify cart
    const total = await page.textContent('[data-cart-total]');
    expect(total).toBe('R$ 45,00');

    // 5. Finalize
    await page.click('button:has-text("Finalizar")');
    await page.waitForURL('**/pedidos/*');

    // 6. Verify stock updated
    const response = await page.request.get(
      'http://localhost:3001/api/produtos/prod-123'
    );
    const product = await response.json();
    expect(product.estoque_atual).toBe(48); // 50 - 2
  });
});
\`\`\`

---

# 20. TROUBLESHOOTING

## Erro: "Token expirado (401)"

\`\`\`
Causa: AccessToken expirou

Solução:
1. Frontend detecta 401
2. Envia refreshToken para /auth/refresh
3. Backend valida e retorna novo accessToken
4. Frontend tenta requisição novamente
5. Se refreshToken também expirou → logout

Código (já implementado em lib/api-client.ts)
\`\`\`

## Erro: "Estoque insuficiente (409)"

\`\`\`
Causa: Race condition ou carrinho com mais itens

Verificar:
1. SELECT * FROM reservas_estoque WHERE produto_id = 'X' AND expira_em > NOW();
2. SELECT * FROM v_produtos_estoque_disponivel WHERE id = 'X';

Solução:
1. Limpar reservas expiradas
2. Validar novamente
3. Tentar criar pedido novamente
\`\`\`

## Erro: "Too many connections" (PostgreSQL)

\`\`\`
Causa: Pool de conexões encheu

Solução:
1. Reiniciar pool: 
   SELECT pg_terminate_backend(pg_stat_activity.pid) 
   WHERE datname = 'unificada'

2. Aumentar max_connections em Supabase Dashboard

3. Usar connection pooling (PgBouncer)
   DATABASE_URL=postgresql://...?sslmode=require&pool_size=5
\`\`\`

## Erro: "Redis connection refused"

\`\`\`
Causa: Redis não rodando

Solução:
docker restart redis

Ou:
redis-cli PING (deve retornar PONG)
\`\`\`

## Performance Lenta

\`\`\`
Diagnosticar:
1. Quais queries são lentas?
   SELECT query, calls, mean_time 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC LIMIT 10;

2. Índices criados?
   SELECT * FROM pg_stat_user_indexes;

3. Cache Redis funciona?
   redis-cli KEYS '*' | wc -l
\`\`\`

---

# 21. ROADMAP COMPLETO

## Phase 1: MVP (Semanas 1-8)

**Foco**: PDV funcional + E-commerce básico

- [ ] Setup infraestrutura (Git, GitHub Actions, Docker)
- [ ] Database schema completo + migrations
- [ ] Auth (login/logout, JWT)
- [ ] PDV (busca, carrinho, finalizar venda)
- [ ] API endpoints básicos
- [ ] Frontend PDV responsivo
- [ ] Deploy em staging
- [ ] Testes unitários (50% cobertura)

**Status**: Em desenvolvimento  
**Cliente Alfa**: Loja de chocolates (validação)

---

## Phase 2: Multi-Canal (Semanas 9-14)

**Foco**: E-commerce + WhatsApp Bot + Mercado Pago

- [ ] E-commerce completo (catálogo, checkout, carrinho)
- [ ] WhatsApp webhook (receber mensagens)
- [ ] WhatsApp Bot (IA para classificar intent)
- [ ] Integração Mercado Pago (pagamento)
- [ ] Email de confirmação (Resend)
- [ ] Admin Dashboard (relatórios básicos)
- [ ] Testes E2E (fluxos principais)
- [ ] Testes de carga (simular 1000 pedidos)

**Métricas**:
- Zero overselling em 100% testes
- Latência < 500ms (p95)
- Uptime 99%+

---

## Phase 3: Otimizações (Semanas 15-20)

**Foco**: Performance, UX, escalabilidade

- [ ] Implementar cache Redis (estoque)
- [ ] Imagens otimizadas (Next/Image)
- [ ] Busca full-text (PostgreSQL)
- [ ] Real-time updates (Supabase Realtime)
- [ ] Notificações por email/SMS
- [ ] Relatórios avançados (gráficos, exportação)
- [ ] Automações (produção automática, estoque mínimo)
- [ ] Mobile app (React Native)

---

## Phase 4: Enterprise (Semanas 21+)

**Foco**: Escalabilidade, integrações, vendas

- [ ] Multi-loja (um dashboard, múltiplas lojas)
- [ ] Marketplace integrado (vender para terceiros)
- [ ] Integração com Marketplace (MercadoLibre, etc)
- [ ] NF-e automática (fiscal)
- [ ] Sistema de comissões (vendedores)
- [ ] Analytics avançado (BI, ML)
- [ ] Mobile app completo (iOS/Android)

---

# 22. MODELO DE NEGÓCIO

## Preços (SaaS Brasileiro)

\`\`\`
PLANO FREE
├─ Até 50 produtos
├─ Até 50 pedidos/mês
├─ 1 usuário
├─ Sem WhatsApp Bot
├─ Sem email de confirmação
└─ PREÇO: Grátis

PLANO PRO
├─ Até 500 produtos
├─ Até 1000 pedidos/mês
├─ Até 5 usuários
├─ WhatsApp Bot incluído
├─ Relatórios avançados
├─ Email + SMS
├─ PREÇO: R$ 99/mês (R$ 1188/ano com 10% desc)

PLANO ENTERPRISE
├─ Ilimitado
├─ Múltiplos canais
├─ Até 100 usuários
├─ Suporte prioritário
├─ Integrações customizadas
├─ NF-e automática
├─ Análise de dados BI
└─ PREÇO: R$ 399/mês + implementação (R$ 2000-5000)
\`\`\`

## Projeção Financeira (5 anos)

\`\`\`
ANO 1
├─ 50 clientes × R$ 99 = R$ 4.950/mês
├─ 10 clientes × R$ 399 = R$ 3.990/mês
├─ Total MRR: R$ 8.940
├─ ARR: R$ 107.280
└─ Foco: Product-market fit

ANO 2
├─ 200 clientes Pro + 30 Enterprise
├─ MRR: R$ 31.970
├─ ARR: R$ 383.640
└─ Foco: Scale

ANO 3+
├─ 500+ clientes
├─ MRR: R$ 80k+
├─ Lucro (após custos): 60%+
└─ Foco: Vendas, Marketplace
\`\`\`

---

# 23. MÉTRICAS & KPIs

## Métricas Técnicas

\`\`\`
Disponibilidade: 99.5% uptime (máx 3.5h/mês inativo)
Latência: p95 < 500ms, p99 < 1s
Erros: < 0.5% das requisições
Testes: Cobertura >= 80%
Deploy: < 5 min (automatizado)
\`\`\`

## Métricas de Negócio

\`\`\`
Monthly Recurring Revenue (MRR)
├─ Alvo Ano 1: R$ 8.940
├─ Alvo Ano 2: R$ 31.970
└─ Alvo Ano 5: R$ 100.000+

Customer Acquisition Cost (CAC)
├─ Alvo: < R$ 500/cliente
├─ Payback: < 2 meses

Churn Rate
├─ Alvo: < 5% ao mês
├─ Sinônimo: Clientes ficam

Net Promoter Score (NPS)
├─ Alvo: > 50 (excelente)
├─ Medição: Survey mensal
\`\`\`

## Métricas de Produto

\`\`\`
Pedidos/mês por cliente
├─ Média: 20-50 pedidos
├─ Objetivo: 100+ (crescimento)

Canais utilizados
├─ % usando PDV: 90%
├─ % usando E-commerce: 40%
├─ % usando WhatsApp: 30%

Tempo implementação
├─ Setup: 2h
├─ Primeiro pedido: 5 min
├─ Time-to-value: < 1 dia
\`\`\`

---

## CONCLUSÃO

Esta documentação é seu **source of truth**. Quando dúvida surgir:

1. **Procure aqui primeiro**
2. **Se não encontrar**, atualize este documento (importante!)
3. **Compartilhe** com a equipe

### Próximos Passos

- ✅ Entender arquitetura (ler seção 1-6)
- ✅ Estudar stack (seção 7-12)
- ✅ Setup local (seção 17)
- ✅ Criar primeiro produto (teste)
- ✅ Criar primeiro pedido (teste)
- ✅ Validar estoque sincroniza
- ✅ Implementar fluxo WhatsApp

---

**Última atualização**: Novembro 2024  
**Status**: MVP em desenvolvimento  
**Versão**: 1.0.0-alpha  
**Maintainer**: @seu-usuario  

**Dúvidas?** Abra uma issue ou me envie mensagem no Discord.
