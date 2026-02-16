# ðŸ”§ Como Executar os Scripts

## âš ï¸ Problema Comum

Os scripts precisam acessar `node_modules` do backend. Se der erro de mÃ³dulo nÃ£o encontrado:

### SoluÃ§Ã£o 1: Executar de dentro do backend (RECOMENDADO)

```powershell
cd backend
npm.cmd run test:acid
npm.cmd run seed:mae
```

### SoluÃ§Ã£o 2: Executar diretamente (se SoluÃ§Ã£o 1 nÃ£o funcionar)

```powershell
# Na raiz do projeto
cd backend
npx ts-node -r dotenv/config ../scripts/test/test-acid-transactions.ts dotenv_config_path=.env
```

---

## ðŸ“‹ Scripts DisponÃ­veis

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

## ðŸ” Troubleshooting

### Erro: "Cannot find module 'typeorm'"
**Causa:** Script nÃ£o encontra node_modules

**SoluÃ§Ã£o:**
1. Certifique-se de estar em `backend/` ao executar
2. Verifique se `npm install` foi executado em `backend/`
3. Tente executar diretamente com `npx` (SoluÃ§Ã£o 2)

### Erro: "Cannot find module '../backend/src/...'"
**Causa:** Caminho relativo incorreto

**SoluÃ§Ã£o:**
- Execute sempre de dentro de `backend/`
- Ou ajuste os caminhos no script

---

**Ãšltima atualizaÃ§Ã£o:** 07/01/2026

