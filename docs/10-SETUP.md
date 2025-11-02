# Setup Técnico - UCM

## Pré-requisitos

- Node.js 20+
- PostgreSQL 15+ (ou Supabase)
- Redis (ou Upstash)
- Git

## Estrutura de Pastas

\`\`\`
backend/
├── src/
│   ├── modules/           # Módulos de negócio
│   ├── common/            # Código compartilhado
│   ├── config/            # Configurações
│   ├── database/          # ORM e migrations
│   └── main.ts
├── test/
├── tsconfig.json
├── package.json
└── nest-cli.json

frontend/
├── app/                   # Next.js App Router
├── components/            # Componentes React
├── lib/                   # Utilitários
├── hooks/                 # Custom hooks
├── types/                 # TypeScript types
├── styles/                # CSS global
└── package.json
\`\`\`

## Setup Local

1. Clone o repositório
2. Instale dependências no backend: `cd backend && npm install`
3. Instale dependências no frontend: `cd frontend && npm install`
4. Configure variáveis de ambiente (ver `.env.example`)
5. Execute migrations: `npm run db:migrate`
6. Inicie backend: `npm run start:dev`
7. Inicie frontend: `npm run dev`

## Variáveis de Ambiente

Ver `backend/.env.example` e `frontend/.env.example`
