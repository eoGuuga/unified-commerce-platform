# Contribuição (Frontend) — Dev iniciante (regras e fluxo)
> **Objetivo:** permitir contribuições no frontend com **risco zero** para produção e backend.
>
> **Regra de ouro:** por enquanto, o dev iniciante mexe **somente em UI/UX** no `frontend/`.

---

## Escopo permitido (PODE)
Pode alterar:
- `frontend/app/**` (páginas)
- `frontend/components/**` (componentes)
- `frontend/styles/**` (se existir)
- `frontend/public/**` (se existir)
- CSS/Tailwind, textos, layout, responsividade, acessibilidade
- Componentes de UI (botões, cards, tabelas, modais)
- Melhorias visuais do PDV/Admin/E-commerce

---

## Escopo proibido (NÃO PODE)
Não alterar (sem exceção, por enquanto):
- `backend/**`
- `deploy/**`
- `scripts/**` e `scripts/migrations/**`
- Qualquer coisa relacionada a:
  - autenticação/segurança/RLS
  - banco de dados/migrations
  - docker/infra/produção

---

## Acesso à produção (NÃO)
O dev iniciante **não** deve ter:
- acesso ao VPS (SSH)
- acesso ao `deploy/env.prod`
- acesso a chaves/tokens (B2, Telegram, UptimeRobot)

---

## Fluxo de trabalho obrigatório (simples e seguro)
### 1) Branch
Criar branch sempre:
- `ui/<descricao-curta>`

Exemplos:
- `ui/pdv-layout`
- `ui/admin-estoque-tabela`
- `ui/loja-home-melhorias`

### 2) Commits
- Commits pequenos (1 mudança por commit quando possível)
- Mensagens claras (ex.: `ui: melhorar layout do estoque`)

### 3) Pull Request (PR)
O PR deve conter:
- **Resumo** do que mudou (1–5 bullets)
- **Prints** (antes/depois)
- **Como testar** (passo a passo)

> PR é obrigatório. Merge direto na branch principal **não**.

---

## Checklist de aprovação (gate mínimo)
Antes de pedir review:
```bash
cd frontend
npm run lint
npm run build
```

Se falhar, corrigir antes de abrir PR.

---

## Como rodar local (dev)
### Opção recomendada (Windows)
Na raiz do projeto:
```powershell
.\DEV-RODAR-TUDO.ps1
```

Depois:
```powershell
cd frontend
npm run dev
```

### URLs
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001/api/v1`

---

## Padrões de qualidade (frontend)
- Evitar “gambiarras” de estado global
- Preferir componentes reutilizáveis
- Manter acessibilidade básica (labels, botões, foco)
- Não remover validações de UI sem motivo
- Não adicionar dependências sem aprovação

---

## Quando o escopo pode aumentar?
Somente quando estes 3 pontos estiverem OK:
- PRs consistentes (sem quebrar build)
- você validou 2–3 entregas em sequência
- você decidiu abrir acesso incremental (ex.: tarefas guiadas)

