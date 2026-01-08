# 🔍 Diagnóstico: Produtos Não Aparecem

## ✅ Checklist de Verificação

### 1. Backend está rodando?
```powershell
# Verificar se backend está rodando
# Deve aparecer: "Backend running on http://localhost:3001/api/v1"
```

### 2. Produtos estão cadastrados?
```powershell
cd backend
npm.cmd run seed:mae
```

### 3. Testar endpoint diretamente
Abra no navegador: http://localhost:3001/api/v1/products?tenantId=00000000-0000-0000-0000-000000000000

**Deve retornar:** Array JSON com produtos

### 4. Verificar Console do Navegador (F12)
Procure por:
- ✅ "Buscando produtos para tenant..."
- ✅ "Fetcher retornou: X produtos"
- ✅ "Estado dos produtos: {...}"
- ❌ Erros em vermelho

### 5. Verificar Network Tab (F12 → Network)
- Procure por requisição para `/products`
- Verifique Status Code (deve ser 200)
- Verifique Response (deve ter array de produtos)

---

## 🛠️ Soluções Rápidas

### Se produtos não aparecem:
1. **Clique no botão "↻"** ao lado de "Produtos Disponíveis"
2. **Recarregue a página** (F5)
3. **Limpe o cache** (Ctrl+Shift+R)
4. **Verifique o console** para erros

### Se ainda não funcionar:
1. Verifique se backend está rodando
2. Execute `npm.cmd run seed:mae` novamente
3. Teste o endpoint diretamente no navegador
4. Envie os logs do console

---

## 📋 Informações para Enviar

Se o problema persistir, envie:
1. **Console logs** (F12 → Console)
2. **Network tab** (F12 → Network → /products)
3. **Mensagem de erro** (se houver)
4. **Status do backend** (está rodando?)

---

**Última atualização:** 07/01/2026
