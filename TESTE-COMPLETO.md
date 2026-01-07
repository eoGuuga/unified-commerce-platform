# ✅ Guia de Teste Completo - Backend + Frontend

> **Status:** Tudo 100% funcional! Siga este guia para testar.

---

## 🚀 PASSO 1: Iniciar Backend

**Terminal 1:**
```powershell
cd unified-commerce-platform\backend
npm.cmd run start:dev
```

**Aguarde aparecer:**
```
[Nest] INFO [NestApplication] Nest application successfully started
🚀 Backend running on http://localhost:3001/api/v1
```

**Testar se está funcionando:**
- Abrir no navegador: http://localhost:3001/api/v1/health
- Deve retornar: `{"status":"ok","timestamp":"...","service":"UCM Backend"}`

---

## 🎨 PASSO 2: Iniciar Frontend

**Terminal 2 (NOVO terminal):**
```powershell
cd unified-commerce-platform\frontend
npm.cmd run dev
```

**Aguarde aparecer:**
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

---

## 🧪 PASSO 3: Testar PDV

### 3.1 Abrir PDV
- Abrir no navegador: **http://localhost:3000/pdv**

### 3.2 Verificar Produtos
- ✅ Deve mostrar **13 produtos** cadastrados
- ✅ Produtos devem ter **estoque** visível
- ✅ Deve mostrar: Bolos, Doces, Salgados

### 3.3 Testar Venda
1. **Adicionar produto ao carrinho** (ex: Brigadeiro Gourmet)
2. **Verificar quantidade** no carrinho
3. **Clicar em "VENDER"**
4. **Verificar:**
   - ✅ Mensagem de sucesso
   - ✅ Carrinho limpo
   - ✅ Estoque atualizado (recarregar página)

### 3.4 Testar Overselling (deve falhar)
1. **Adicionar produto** ao carrinho
2. **Tentar adicionar quantidade maior** que o estoque disponível
3. **Clicar em "VENDER"**
4. **Verificar:**
   - ⚠️ Deve mostrar erro: "Estoque insuficiente"
   - ⚠️ Pedido NÃO deve ser criado

---

## ✅ CHECKLIST DE TESTE

### Backend
- [ ] Backend inicia sem erros
- [ ] Health check responde: http://localhost:3001/api/v1/health
- [ ] Endpoint de produtos funciona: http://localhost:3001/api/v1/products?tenantId=00000000-0000-0000-0000-000000000000

### Frontend
- [ ] Frontend inicia sem erros
- [ ] Página carrega: http://localhost:3000
- [ ] PDV carrega: http://localhost:3000/pdv

### PDV
- [ ] Produtos aparecem na lista
- [ ] Estoque é mostrado corretamente
- [ ] Busca funciona
- [ ] Adicionar ao carrinho funciona
- [ ] Remover do carrinho funciona
- [ ] Atualizar quantidade funciona
- [ ] Total é calculado corretamente
- [ ] Venda é criada com sucesso
- [ ] Estoque é atualizado após venda

---

## 🔍 O QUE ESPERAR

### Produtos no PDV:
- **Bolo de Chocolate** - R$ 45,00 - Estoque: 5
- **Bolo de Cenoura** - R$ 40,00 - Estoque: 3
- **Brigadeiro Gourmet** - R$ 2,50 - Estoque: 50
- **Beijinho** - R$ 2,50 - Estoque: 45
- ... e mais 9 produtos

### Ao Criar Venda:
- ✅ Pedido criado no banco
- ✅ Estoque reduzido
- ✅ Mensagem de sucesso
- ✅ Carrinho limpo

---

## ⚠️ PROBLEMAS COMUNS

### Frontend não conecta ao backend
**Verificar:**
1. Backend está rodando? (http://localhost:3001/api/v1/health)
2. `frontend/.env.local` tem: `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`

### Produtos não aparecem
**Verificar:**
1. Backend está rodando?
2. Produtos foram cadastrados? (`npm.cmd run seed:mae`)
3. Console do navegador (F12) para ver erros

### Erro ao criar venda
**Verificar:**
1. Backend está rodando?
2. Estoque suficiente?
3. Console do navegador para ver erro específico

---

## 📝 NOTAS

- **Backend:** http://localhost:3001/api/v1 ✅
- **Frontend:** http://localhost:3000 ✅
- **PDV:** http://localhost:3000/pdv ✅
- **Tenant ID:** `00000000-0000-0000-0000-000000000000`

---

**Última atualização:** 07/01/2026  
**Status:** ✅ Pronto para teste completo!
