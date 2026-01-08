# Unified Commerce Platform (UCM)

Plataforma SaaS para unificacao de vendas multi-canal para pequenos negocios artesanais

---

## 🚨 DOCUMENTO MASTER - LEIA PRIMEIRO!

> **📋 [docs/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md](./docs/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md)** - **LEIA ESTE PRIMEIRO!**  
> **📚 [docs/INDICE-DOCUMENTACAO.md](./docs/INDICE-DOCUMENTACAO.md)** - **ÍNDICE COMPLETO**

Este documento contém **TUDO** que você precisa saber para continuar o desenvolvimento:
- ✅ Estado atual completo do projeto
- ✅ O que foi implementado (detalhado)
- ✅ Onde paramos (exatamente)
- ✅ Próximos passos (priorizados)
- ✅ Estrutura de documentação (organizada)
- ✅ Contexto técnico (decisões importantes)

**Status Atual:** ✅ **BACKEND OPERACIONAL** | ✅ **16 CORREÇÕES CRÍTICAS IMPLEMENTADAS** | 🚀 **FASE 3.1 e 3.2 COMPLETAS**

**Se você está começando uma nova sessão, leia `docs/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md` primeiro!**

---

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
- **`docs/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md`** - **LEIA PRIMEIRO!**
- **`docs/00-projeto/01-VISION.md`** - Problema, solucao, objetivos
- **`docs/00-projeto/02-PERSONAS.md`** - Perfis de usuarios
- **`docs/00-projeto/09-BUSINESS-MODEL.md`** - Modelo de negocio e precificacao

**Documentacao Tecnica:**
- **`docs/01-tecnico/03-ARCHITECTURE.md`** - Arquitetura 4 camadas
- **`docs/01-tecnico/04-DATABASE.md`** - Schema SQL completo
- **`docs/01-tecnico/06-WORKFLOWS.md`** - Fluxos de venda
- **`docs/01-tecnico/07-SECURITY.md`** - Seguranca e compliance
- **`docs/01-tecnico/10-SETUP.md`** - Setup inicial

**Planos de Implementacao:**
- **`docs/02-implementacao/PLANO_IMPLEMENTACAO.md`** - Plano geral
- **`docs/02-implementacao/PLANO_COMPLETO_PARTE_1.md`** até **PARTE_8.md** - Guias passo a passo

**Documentacao Comercial:**
- **`docs/03-comercial/DOCUMENTACAO_COMPLETA_PARA_VENDAS.md`** - Estrutura para vendas

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

💡 **Desenvolvimento 100% Gratuito:** Veja [`docs/01-tecnico/13-FREE-TIER-STRATEGY.md`](docs/01-tecnico/13-FREE-TIER-STRATEGY.md) para estratégia completa sem custos.

---

## 🚀 Quick Start

### ⚠️ PRIMEIRA VEZ? LEIA O TUTORIAL COMPLETO!

> **📚 [TUTORIAL-INSTALACAO-COMPLETA.md](./TUTORIAL-INSTALACAO-COMPLETA.md)**  
> Tutorial passo a passo completo desde a instalação do Docker até rodar backend e frontend!

O tutorial cobre:
- ✅ Instalação do Node.js
- ✅ Instalação do Git
- ✅ Instalação do Docker Desktop
- ✅ Configuração do ambiente
- ✅ Setup do banco de dados
- ✅ Iniciar backend e frontend
- ✅ Troubleshooting completo

---

### Para Desenvolvedores que Já Têm Ambiente Configurado:

#### 1. Iniciar Ambiente

```powershell
# Iniciar containers Docker
.\INICIAR-AMBIENTE.ps1

# OU manualmente
docker-compose -f config/docker-compose.yml up -d postgres redis
```

#### 2. Setup Inicial (Primeira vez no projeto)

```powershell
.\setup.ps1
```

#### 3. Rodar Backend

```powershell
cd backend
npm run start:dev
```

#### 4. Rodar Frontend

```powershell
cd frontend
npm run dev
```

#### 5. Testar

```powershell
.\scripts\test\test-backend.ps1
```

---

## O Que Ja Esta Pronto

- **Documentacao**: 36 arquivos completos organizados em `docs/`  
- **Schema SQL**: Banco de dados completo  
- **Backend**: NestJS completo com Auth, Products, Orders, WhatsApp
- **Frontend**: Next.js com PDV, E-commerce, Dashboard Admin
- **Docker**: PostgreSQL + Redis + UIs  
- **Configuracoes**: TypeScript, ESLint, Jest  
- **Features**: 
  - ✅ PDV Perfeito (validações, tempo real, UX otimizada)
  - ✅ Gestão de Estoque Completa (`/admin/estoque`)
  - ✅ Dashboard Admin Melhorado (métricas, gráficos, relatórios)
  - ✅ Sistema de Reserva de Estoque
  - ✅ Transações ACID (ZERO overselling)
  - ✅ Swagger/OpenAPI (API 100% documentada)
  - ✅ Testes Unitários e de Integração
  - ✅ Health Checks, Rate Limiting, Error Boundaries
- **Scripts**: Scripts organizados em `scripts/setup/` e `scripts/test/` (wrappers na raiz para compatibilidade)

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

**Status:** ✅ FASE 0, 1 e 2 COMPLETAS | 🚀 Pronto para FASE 3 (Bot WhatsApp)  
**📊 Ver [STATUS-ATUAL-2025.md](./STATUS-ATUAL-2025.md) para status detalhado**