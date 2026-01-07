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

**DOCUMENTACAO EM**: [`docs/`](docs/) - **24 documentos organizados e 100% completos**

### Principais Arquivos:

**Documentacao do Projeto:**
- **`docs/01-projeto/01-VISION.md`** - Problema, solucao, objetivos
- **`docs/01-projeto/02-PERSONAS.md`** - Perfis de usuarios
- **`docs/01-projeto/09-BUSINESS-MODEL.md`** - Modelo de negocio e precificacao

**Documentacao Tecnica:**
- **`docs/02-tecnico/03-ARCHITECTURE.md`** - Arquitetura 4 camadas
- **`docs/02-tecnico/04-DATABASE.md`** - Schema SQL completo
- **`docs/02-tecnico/06-WORKFLOWS.md`** - Fluxos de venda
- **`docs/02-tecnico/07-SECURITY.md`** - Seguranca e compliance
- **`docs/02-tecnico/10-SETUP.md`** - Setup inicial

**Planos de Implementacao:**
- **`docs/03-implementacao/PLANO_IMPLEMENTACAO.md`** - Plano geral
- **`docs/03-implementacao/PLANO_COMPLETO_PARTE_1.md`** até **PARTE_8.md** - Guias passo a passo

**Documentacao Comercial:**
- **`docs/04-comercial/DOCUMENTACAO_COMPLETA_PARA_VENDAS.md`** - Estrutura para vendas

📚 **Ver [`docs/README.md`](docs/README.md) para estrutura completa**

---

## Stack Tecnologica

| Componente | Tecnologia | Alternativa Gratuita |
|-----------|-----------|---------------------|
| **Backend** | NestJS + Node.js 20 + TypeScript | - |
| **Frontend** | Next.js 16 + React 19 + Tailwind CSS | - |
| **Database** | PostgreSQL 15 (Supabase) | ✅ **Docker Local** |
| **Cache** | Redis (Upstash) | ✅ **Docker Local** |
| **ORM** | TypeORM | - |
| **Auth** | JWT + Supabase Auth | ✅ **JWT Local** |
| **Payments** | Stripe | ✅ **Mock Provider** |
| **WhatsApp** | Twilio/360Dialog | ✅ **Mock/Evolution API** |
| **IA** | OpenAI GPT-4 | ✅ **Ollama (Local)** |

💡 **Desenvolvimento 100% Gratuito:** Veja [`docs/02-tecnico/13-FREE-TIER-STRATEGY.md`](docs/02-tecnico/13-FREE-TIER-STRATEGY.md) para estratégia completa sem custos.

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