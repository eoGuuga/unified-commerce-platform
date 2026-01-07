# 🔧 Solução: Problema com npm no PowerShell

## Problema

Ao executar `npm run start:dev`, aparece o erro:
```
npm : O arquivo C:\Program Files\nodejs\npm.ps1 não pode ser carregado porque a execução de scripts foi desabilitada neste sistema.
```

## ✅ Soluções

### Solução 1: Usar npm.cmd (RECOMENDADO)

Ao invés de `npm`, use `npm.cmd`:

```powershell
npm.cmd run start:dev
```

**Ou criar um alias no PowerShell:**
```powershell
Set-Alias npm npm.cmd
```

---

### Solução 2: Usar CMD ao invés de PowerShell

Abra o **Prompt de Comando** (CMD) ao invés do PowerShell:

1. Pressione `Win + R`
2. Digite `cmd` e pressione Enter
3. Navegue até a pasta:
   ```cmd
   cd C:\Users\gusta\OneDrive\Documentos\SAS\unified-commerce-platform\backend
   ```
4. Execute:
   ```cmd
   npm run start:dev
   ```

---

### Solução 3: Alterar Política de Execução (Se necessário)

Se as soluções acima não funcionarem:

```powershell
# Executar como Administrador
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Depois reiniciar o PowerShell.**

---

## 🚀 Comandos Corretos para o Projeto

### Iniciar Backend:
```powershell
cd backend
npm.cmd run start:dev
```

### Iniciar Frontend:
```powershell
cd frontend
npm.cmd run dev
```

### Testar ACID:
```powershell
cd backend
npm.cmd run test:acid
```

### Cadastrar Produtos:
```powershell
cd backend
npm.cmd run seed:mae
```

---

## 💡 Dica: Criar Alias Permanente

Para não precisar usar `npm.cmd` sempre, adicione ao seu perfil do PowerShell:

```powershell
# Abrir perfil
notepad $PROFILE

# Adicionar esta linha:
Set-Alias npm npm.cmd

# Salvar e fechar
# Reiniciar PowerShell
```

---

**Última atualização:** 07/01/2025
