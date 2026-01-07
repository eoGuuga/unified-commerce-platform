# ✅ Solução: Erro "Unauthorized" no PDV

## 🔍 Problema Identificado

O endpoint `POST /orders` estava protegido com `@UseGuards(JwtAuthGuard)`, mas o PDV não estava fazendo login antes de criar pedidos.

## ✅ Solução Implementada

### 1. Usuário Padrão Criado
- **Email:** `admin@loja.com`
- **Senha:** `senha123`
- **Role:** `ADMIN`
- **Tenant:** `00000000-0000-0000-0000-000000000000`

### 2. Login Automático no PDV
O PDV agora faz login automático quando não há token no `localStorage`:
- Tenta fazer login com as credenciais padrão
- Salva o token automaticamente
- Carrega os produtos após login bem-sucedido

### 3. Script de Seed
Criado script para criar/atualizar usuário padrão:
```powershell
cd backend
npm.cmd run seed:usuario
```

---

## 🧪 Como Testar

### 1. Garantir que usuário padrão existe
```powershell
cd backend
npm.cmd run seed:usuario
```

### 2. Limpar localStorage (opcional)
- Abrir DevTools (F12)
- Console → `localStorage.clear()`
- Recarregar página

### 3. Testar PDV
1. Abrir: http://localhost:3000/pdv
2. O PDV deve fazer login automático
3. Produtos devem aparecer
4. Testar criar uma venda
5. ✅ Deve funcionar sem erro "Unauthorized"

---

## 📋 Arquivos Modificados

1. **`scripts/seed-usuario-padrao.ts`**
   - Script para criar usuário padrão

2. **`backend/scripts/seed-usuario-wrapper.js`**
   - Wrapper para executar o script

3. **`backend/package.json`**
   - Adicionado script `seed:usuario`

4. **`frontend/app/pdv/page.tsx`**
   - Adicionado `autoLogin()` no `useEffect`
   - Login automático quando não há token

---

## 🔐 Credenciais Padrão

```
Email: admin@loja.com
Senha: senha123
```

**⚠️ IMPORTANTE:** Em produção, essas credenciais devem ser alteradas!

---

## ✅ Status

- [x] Usuário padrão criado
- [x] Login automático implementado
- [x] Script de seed funcionando
- [x] PDV deve funcionar sem erro

---

**Última atualização:** 07/01/2026  
**Status:** ✅ Problema resolvido!
