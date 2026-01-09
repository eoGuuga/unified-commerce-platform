# Arquivos para Dev Iniciante (Frontend-Only)

> **Lista oficial** dos arquivos que o dev iniciante **pode modificar**.

---

## 📁 Estrutura de Arquivos Permitidos

### ✅ Frontend (pode mexer)

**Páginas:**
- `frontend/app/**/*.tsx`
  - `frontend/app/page.tsx`
  - `frontend/app/pdv/page.tsx`
  - `frontend/app/admin/page.tsx`
  - `frontend/app/admin/estoque/page.tsx`
  - `frontend/app/loja/page.tsx`
  - `frontend/app/login/page.tsx`
  - `frontend/app/layout.tsx`

**Componentes:**
- `frontend/components/**/*.tsx`
  - `frontend/components/ErrorBoundary.tsx`

**Estilos:**
- `frontend/app/globals.css`
- `frontend/tailwind.config.js` (se necessário para UI)
- `frontend/postcss.config.js` (se necessário)

**Configuração (apenas se necessário para UI):**
- `frontend/next.config.js` (apenas ajustes de UI, não infra)

**Documentação:**
- `frontend/CONTRIBUICAO-FRONTEND-INICIANTE.md` ← **LEIA PRIMEIRO**
- `frontend/AREA-DEV-INICIANTE/README.md`

---

## 🚫 Arquivos Proibidos (NÃO mexer)

- **`backend/**`** (qualquer coisa)
- **`deploy/**`** (produção)
- **`scripts/**`** (scripts de setup/teste)
- **`config/**`** (Docker)
- **`docs/**`** (documentação)
- **`.gitignore`**, **`README.md`** (raiz)
- Qualquer arquivo relacionado a:
  - autenticação/segurança
  - banco de dados/migrations
  - docker/infra/produção

---

## 📋 Checklist Antes de Pedir Review

- [ ] Criei branch `ui/<descricao>`
- [ ] Rodei `cd frontend && npm run lint`
- [ ] Rodei `cd frontend && npm run build`
- [ ] PR tem prints (antes/depois)
- [ ] PR tem descrição clara do que mudou

---

**Última atualização:** 09/01/2026
