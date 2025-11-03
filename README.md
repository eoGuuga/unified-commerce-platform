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

**DOCUMENTACAO EM**: [`docs/`](docs/)

### Principais Arquivos:

- **`docs/01-VISION.md`** - Visao e objetivos
- **`docs/03-ARCHITECTURE.md`** - Arquitetura 4 camadas
- **`docs/04-DATABASE.md`** - Schema SQL completo
- **`docs/06-WORKFLOWS.md`** - Fluxos de venda
- **`docs/10-SETUP.md`** - Setup inicial

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

### 2. Setup Automatico (PowerShell)

```powershell
.\setup.ps1
```

O script configura tudo automaticamente.

### 3. Rodar Backend

```powershell
cd backend
npm run start:dev
```

### 4. Rodar Frontend

```powershell
cd frontend
npm run dev
```

### 5. Testar

```powershell
.\test-backend.ps1
```

---

## O Que Ja Esta Pronto

- **Documentacao**: 12 arquivos completos  
- **Schema SQL**: Banco de dados completo  
- **Backend**: NestJS completo com Auth, Products, Orders, WhatsApp
- **Frontend**: Next.js com PDV, E-commerce, Dashboard Admin
- **Docker**: PostgreSQL + Redis + UIs  
- **Configuracoes**: TypeScript, ESLint, Jest  
- **Features**: Estoque em tempo real, Checkout, Relatorios
- **Scripts**: setup.ps1 e test-backend.ps1 automaticos

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
├── setup.ps1                # SETUP AUTOMATICO
└── test-backend.ps1         # TESTES AUTOMATIZADOS
```

---

## Comece Por Aqui

### Sistema ja esta rodando!

**Acesse as URLs:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001/api/v1
- Admin: http://localhost:3000/admin
- PDV: http://localhost:3000/pdv
- Loja: http://localhost:3000/loja

**Credenciais de teste:**
- Email: teste@exemplo.com
- Senha: senha123

### Para reiniciar:

1. Instale Node.js: https://nodejs.org/ (versao LTS)
2. Execute: `.\setup.ps1`
3. Rode: `cd backend && npm run start:dev` e `cd frontend && npm run dev`
4. Teste: `.\test-backend.ps1`

---

## Licenca

MIT License

---

**Status:** MVP COMPLETO | TODOS OS MODULOS IMPLEMENTADOS E FUNCIONANDO!