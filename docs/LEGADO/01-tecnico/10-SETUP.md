> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# Setup TÃ©cnico - UCM

## PrÃ©-requisitos

- Node.js 20+
- PostgreSQL 15+ (ou Supabase)
- Redis (ou Upstash)
- Git

## Estrutura de Pastas

\`\`\`
backend/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ modules/           # MÃ³dulos de negÃ³cio
â”‚   â”œâ”€â”€ common/            # CÃ³digo compartilhado
â”‚   â”œâ”€â”€ config/            # ConfiguraÃ§Ãµes
â”‚   â”œâ”€â”€ database/          # ORM e migrations
â”‚   â””â”€â”€ main.ts
â”œâ”€â”€ test/
â”œâ”€â”€ tsconfig.json
â”œâ”€â”€ package.json
â””â”€â”€ nest-cli.json

frontend/
â”œâ”€â”€ app/                   # Next.js App Router
â”œâ”€â”€ components/            # Componentes React
â”œâ”€â”€ lib/                   # UtilitÃ¡rios
â”œâ”€â”€ hooks/                 # Custom hooks
â”œâ”€â”€ types/                 # TypeScript types
â”œâ”€â”€ styles/                # CSS global
â””â”€â”€ package.json
\`\`\`

## Setup Local

1. Clone o repositÃ³rio
2. Instale dependÃªncias no backend: `cd backend && npm install`
3. Instale dependÃªncias no frontend: `cd frontend && npm install`
4. Configure variÃ¡veis de ambiente (ver `.env.example`)
5. Execute migrations: `npm run db:migrate`
6. Inicie backend: `npm run start:dev`
7. Inicie frontend: `npm run dev`

## VariÃ¡veis de Ambiente

Ver `backend/.env.example` e `frontend/ENV_SETUP.md`


