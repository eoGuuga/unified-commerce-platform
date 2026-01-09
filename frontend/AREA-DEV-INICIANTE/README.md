# Área do Dev Iniciante (Frontend-Only)

> **IMPORTANTE:** Esta pasta contém **apenas os arquivos que você pode modificar**.
>
> **Regra de ouro:** por enquanto, você mexe **somente em UI/UX** no `frontend/`.

---

## 📁 O que você pode mexer

### ✅ Arquivos permitidos (nesta pasta ou em `frontend/`)

**Páginas:**
- `frontend/app/**/*.tsx` (todas as páginas)

**Componentes:**
- `frontend/components/**/*.tsx`

**Estilos:**
- `frontend/app/globals.css`
- Arquivos de configuração do Tailwind (se necessário)

**Documentação:**
- `frontend/CONTRIBUICAO-FRONTEND-INICIANTE.md` ← **LEIA PRIMEIRO**

---

## 🚫 O que você NÃO pode mexer

- `backend/**` (qualquer coisa)
- `deploy/**` (produção)
- `scripts/**` (scripts de setup/teste)
- `config/**` (Docker)
- Qualquer coisa relacionada a:
  - autenticação/segurança
  - banco de dados
  - docker/infra

---

## 🚀 Como começar

1. **Leia primeiro:**
   - `frontend/CONTRIBUICAO-FRONTEND-INICIANTE.md`

2. **Setup local:**
   - Na raiz do projeto: `.\DEV-RODAR-TUDO.ps1`
   - Depois: `cd frontend && npm run dev`

3. **Trabalhar:**
   - Sempre criar branch: `ui/<descricao>`
   - Fazer PR (não merge direto)
   - Rodar `npm run lint && npm run build` antes de pedir review

---

## 📚 Documentação útil (para você)

- **Regras completas:** `frontend/CONTRIBUICAO-FRONTEND-INICIANTE.md`
- **Setup local:** `COMO-INICIAR-AMBIENTE.md` (raiz do projeto)

---

**Última atualização:** 09/01/2026
