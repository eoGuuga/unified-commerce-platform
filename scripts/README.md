# 📜 Scripts de Desenvolvimento

Scripts úteis para desenvolvimento e testes do Unified Commerce Platform.

---

## 🧪 Teste de Transações ACID

**Arquivo:** `test-acid-transactions.ts`

**O que faz:**
- Testa transações ACID com FOR UPDATE locks
- Valida prevenção de overselling
- Testa race conditions (2 pedidos simultâneos)
- Verifica se estoque é atualizado corretamente

**Como executar:**
```bash
cd backend
npm run test:acid
```

**Ou diretamente:**
```bash
npx ts-node scripts/test-acid-transactions.ts
```

**O que testa:**
1. ✅ Criação de pedido com sucesso
2. ✅ Validação de estoque insuficiente (bloqueia overselling)
3. ✅ Race condition (2 pedidos simultâneos - apenas 1 deve suceder)
4. ✅ Estoque atualizado corretamente após cada transação

**Resultado esperado:**
```
🧪 Iniciando testes de transações ACID...
✅ Conectado ao banco de dados
✅ Produto criado
✅ Estoque criado: 50 unidades
✅ Pedido criado com sucesso!
✅ Estoque atualizado: 45 unidades
✅ Overselling bloqueado corretamente
✅ Race condition testada: 1 sucesso, 1 falha
🎉 TODOS OS TESTES PASSARAM!
```

---

## 🌱 Cadastro de Produtos da Mãe

**Arquivo:** `seed-produtos-mae.ts`

**O que faz:**
- Cadastra produtos típicos de confeitaria artesanal
- Cria categorias (Bolos, Doces, Salgados)
- Cadastra estoque inicial
- Prepara dados reais para testes

**Como executar:**
```bash
cd backend
npm run seed:mae
```

**Ou diretamente:**
```bash
npx ts-node scripts/seed-produtos-mae.ts
```

**Produtos cadastrados:**
- **Bolos:** Bolo de Chocolate, Bolo de Cenoura, Bolo Personalizado
- **Doces:** Brigadeiro Gourmet, Beijinho, Brigadeiro de Leite Ninho, Brigadeiro de Maracujá, Cajuzinho, Brigadeiro Branco
- **Salgados:** Coxinha, Risole, Pastel Assado, Enroladinho de Salsicha

**Resultado esperado:**
```
🌱 Iniciando cadastro de produtos da mãe...
✅ Conectado ao banco de dados
✅ Tenant já existe
✅ Categoria criada: Bolos
✅ Categoria criada: Doces
✅ Categoria criada: Salgados
✅ Produto criado: Bolo de Chocolate
   📦 Estoque: 5 unidades (mínimo: 2)
...
🎉 Cadastro de produtos concluído com sucesso!
```

---

## 📋 Pré-requisitos

Antes de executar os scripts:

1. **Docker rodando:**
   ```bash
   docker ps
   # Deve mostrar ucm-postgres e ucm-redis
   ```

2. **Migration executada:**
   ```bash
   docker exec -i ucm-postgres psql -U postgres -d ucm < scripts/migrations/001-initial-schema.sql
   ```

3. **Arquivo .env configurado:**
   ```bash
   # backend/.env deve ter:
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ucm
   ```

4. **Dependências instaladas:**
   ```bash
   cd backend
   npm install
   ```

---

## 🔧 Troubleshooting

### Erro: "Cannot connect to database"
**Solução:**
1. Verificar se Docker está rodando: `docker ps`
2. Verificar `DATABASE_URL` no `backend/.env`
3. Testar conexão: `docker exec -it ucm-postgres psql -U postgres -d ucm -c "SELECT 1;"`

### Erro: "Module not found"
**Solução:**
```bash
cd backend
npm install
```

### Erro: "ts-node not found"
**Solução:**
```bash
cd backend
npm install -D ts-node typescript
```

---

## 📝 Notas

- **Scripts são idempotentes:** Podem ser executados múltiplas vezes sem problemas
- **Scripts resetam dados de teste:** `test-acid-transactions.ts` cria/reseta produto de teste
- **Scripts não deletam dados:** `seed-produtos-mae.ts` atualiza produtos existentes ao invés de deletar

---

**Última atualização:** 07/01/2025
