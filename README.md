# Unified Commerce Platform (UCM)

Plataforma SaaS para unificacao de vendas multi-canal para pequenos negocios artesanais

## Problema que Resolve

**OVERSELLING**: Loja vende em múltiplos canais (PDV físico, e-commerce, WhatsApp) mas não sincroniza estoque.
Resultado: Vende 15 brigadeiros mas só tinha 10 em estoque.

**SOLUÇÃO**: Backend centralizado com transações ACID + FOR UPDATE locks garantindo **ZERO OVERSELING**.

```
        BACKEND (PostgreSQL)
              ↓
    ┌─────────┼─────────┐
    ↓         ↓         ↓
  PDV Web  E-com  WhatsApp Bot
```

---

## Documentacao Completa

**VER PRIMEIRO**: [`MEMORIA_ESTADO_ATUAL.md`](MEMORIA_ESTADO_ATUAL.md) - Contexto completo do projeto

**DOCUMENTACAO EM**: [`docs/`](docs/)

### Principais Arquivos:

- **`docs/README.md`** - Indice de navegacao
- **`docs/04-DATABASE.md`** - Schema completo
- **`docs/06-WORKFLOWS.md`** - Fluxos de venda
- **`docs/08-ROADMAP.md`** - Timeline desenvolvimento
- **`README_IMPLEMENTACAO.md`** - Como implementar agora

---

## Stack Tecnologica

| Componente | Tecnologia |
|-----------|-----------|
| **Backend** | NestJS + Node.js 20 + TypeScript |
| **Frontend** | Next.js 16 + React 19 + Tailwind CSS |
| **Database** | PostgreSQL 15 (Supabase) |
| **Cache** | Redis (Upstash) |
| **ORM** | TypeORM |
| **Auth** | JWT + Supabase Auth |
| **Payments** | Stripe |
| **WhatsApp** | Twilio/360Dialog |
| **IA** | OpenAI GPT-4 |

---

## Quick Start

### 1. Setup Database

**Opção A: Docker (Local)**
```bash
docker-compose up -d postgres redis
docker exec -i ucm-postgres psql -U postgres -d ucm < scripts/migrations/001-initial-schema.sql
```

**Opção B: Supabase (Cloud)**
- Criar projeto em supabase.com
- Executar migration SQL no SQL Editor

### 2. Setup Backend

```bash
cd backend
npm install
cp ENV_SETUP.md .env  # Preencher com credenciais
npm run start:dev
# Health: http://localhost:3001/api/v1/health
```

### 3. Setup Frontend

```bash
cd frontend
npm install
cp ENV_SETUP.md .env.local  # Preencher com credenciais
npm run dev
# App: http://localhost:3000
```

---

## O Que Ja Esta Pronto

- **Documentacao**: 12 arquivos completos  
- **Schema SQL**: Banco de dados completo  
- **Estrutura**: Backend + Frontend  
- **Docker**: PostgreSQL + Redis + UIs  
- **Configuracoes**: TypeScript, ESLint, Jest  

---

## O Que Falta (Proximos Passos)

### AGORA: Implementar Módulos

1. **Configurar TypeORM** no NestJS
2. **Criar Entities** (Produto, Pedido, Estoque, etc)
3. **Implementar Módulo Products** (CRUD)
4. **Implementar Autenticação** (JWT, Guards)
5. **Implementar Módulo Orders** (com FOR UPDATE lock)

**DETALHES**: Ver [`README_IMPLEMENTACAO.md`](README_IMPLEMENTACAO.md)

---

## Features Principais

- **PDV Web** - Ponto de venda para tablet
- **E-commerce** - Loja online completa
- **WhatsApp Bot** - Atendimento automatico com IA
- **Dashboard Admin** - Relatorios e gestao
- **Zero Overselling** - Transacoes ACID
- **Multi-tenancy** - Multiplas lojas

---

## Estrutura do Projeto

```
ucm/
├── docs/                    # Documentação completa (12 arquivos)
├── backend/                 # API NestJS
│   ├── src/
│   │   ├── modules/         # Módulos de negócio
│   │   ├── database/        # Entities + repositories
│   │   └── common/          # DTOs, guards, decorators
│   └── package.json
├── frontend/                # App Next.js
│   └── app/                 # App Router
├── scripts/
│   └── migrations/
│       └── 001-initial-schema.sql  # SCHEMA COMPLETO
├── docker-compose.yml       # PostgreSQL + Redis
├── MEMORIA_ESTADO_ATUAL.md  # CONTEXTO COMPLETO (LER ISSO!)
└── README_IMPLEMENTACAO.md  # COMO COMEÇAR
```

---

## Comece Por Aqui

1. **Leia**: [`MEMORIA_ESTADO_ATUAL.md`](MEMORIA_ESTADO_ATUAL.md)
2. **Veja**: [`docs/04-DATABASE.md`](docs/04-DATABASE.md) (Schema)
3. **Implemente**: Seguindo [`README_IMPLEMENTACAO.md`](README_IMPLEMENTACAO.md)

---

## Licenca

MIT License

---

**Status:** Estrutura completa | Implementacao de modulos pendente  
**Proximo:** Implementar modulo Products seguindo README_IMPLEMENTACAO.md