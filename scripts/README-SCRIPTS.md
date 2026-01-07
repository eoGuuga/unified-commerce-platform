# 🔧 Como Executar os Scripts

## ⚠️ Problema Comum

Os scripts precisam acessar `node_modules` do backend. Se der erro de módulo não encontrado:

### Solução 1: Executar de dentro do backend (RECOMENDADO)

```powershell
cd backend
npm.cmd run test:acid
npm.cmd run seed:mae
```

### Solução 2: Executar diretamente (se Solução 1 não funcionar)

```powershell
# Na raiz do projeto
cd backend
npx ts-node -r dotenv/config ../scripts/test-acid-transactions.ts dotenv_config_path=.env
```

---

## 📋 Scripts Disponíveis

### Teste ACID
```powershell
cd backend
npm.cmd run test:acid
```

### Cadastrar Produtos
```powershell
cd backend
npm.cmd run seed:mae
```

---

## 🔍 Troubleshooting

### Erro: "Cannot find module 'typeorm'"
**Causa:** Script não encontra node_modules

**Solução:**
1. Certifique-se de estar em `backend/` ao executar
2. Verifique se `npm install` foi executado em `backend/`
3. Tente executar diretamente com `npx` (Solução 2)

### Erro: "Cannot find module '../backend/src/...'"
**Causa:** Caminho relativo incorreto

**Solução:**
- Execute sempre de dentro de `backend/`
- Ou ajuste os caminhos no script

---

**Última atualização:** 07/01/2026
