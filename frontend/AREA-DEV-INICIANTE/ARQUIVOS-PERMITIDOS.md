# Arquivos Permitidos — Dev Iniciante (Frontend-Only)

> **Lista oficial** dos arquivos que você pode modificar.

---

## ✅ Arquivos que você PODE mexer

### Páginas (App Router)
- `frontend/app/page.tsx` (home)
- `frontend/app/pdv/page.tsx` (PDV)
- `frontend/app/loja/page.tsx` (e-commerce)
- `frontend/app/admin/page.tsx` (dashboard admin)
- `frontend/app/admin/estoque/page.tsx` (gestão de estoque)
- `frontend/app/login/page.tsx` (login)
- `frontend/app/layout.tsx` (layout global)
- `frontend/app/globals.css` (estilos globais)

### Componentes
- `frontend/components/ErrorBoundary.tsx`
- Qualquer novo componente em `frontend/components/**/*.tsx`

### Configuração (apenas se necessário para UI)
- `frontend/tailwind.config.js` (apenas para cores/estilos, não remover validações)
- `frontend/postcss.config.js` (apenas se necessário para Tailwind)

---

## 🚫 Arquivos que você NÃO pode mexer

### Backend (proibido)
- `backend/**` (qualquer arquivo)

### Deploy/Produção (proibido)
- `deploy/**` (qualquer arquivo)

### Scripts (proibido)
- `scripts/**` (qualquer arquivo)

### Config Docker (proibido)
- `config/**` (qualquer arquivo)

### Arquivos de Configuração Sensíveis (proibido)
- `frontend/.env*` (se existir)
- `frontend/next.config.js` (apenas se você souber o que está fazendo e tiver aprovação)

### Hooks/Services (proibido por enquanto)
- `frontend/hooks/useAuth.ts` (autenticação)
- `frontend/lib/api-client.ts` (cliente API)
- `frontend/lib/config.ts` (configuração)

> **Nota:** Se você precisar mudar algo em hooks/lib, **discuta primeiro** antes de modificar.

---

## 📝 Como trabalhar

1. **Sempre criar branch:** `ui/<descricao>`
2. **Fazer PR** (não merge direto)
3. **Rodar antes de pedir review:**
   ```bash
   cd frontend
   npm run lint
   npm run build
   ```

---

**Última atualização:** 09/01/2026
