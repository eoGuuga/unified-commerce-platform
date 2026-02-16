> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# ðŸ”§ SoluÃ§Ã£o: Problema com npm no PowerShell

## Problema

Ao executar `npm run start:dev`, aparece o erro:
```
npm : O arquivo C:\Program Files\nodejs\npm.ps1 nÃ£o pode ser carregado porque a execuÃ§Ã£o de scripts foi desabilitada neste sistema.
```

## âœ… SoluÃ§Ãµes

### SoluÃ§Ã£o 1: Usar npm.cmd (RECOMENDADO)

Ao invÃ©s de `npm`, use `npm.cmd`:

```powershell
npm.cmd run start:dev
```

**Ou criar um alias no PowerShell:**
```powershell
Set-Alias npm npm.cmd
```

---

### SoluÃ§Ã£o 2: Usar CMD ao invÃ©s de PowerShell

Abra o **Prompt de Comando** (CMD) ao invÃ©s do PowerShell:

1. Pressione `Win + R`
2. Digite `cmd` e pressione Enter
3. Navegue atÃ© a pasta:
   ```cmd
   cd C:\Users\gusta\OneDrive\Documentos\SAS\unified-commerce-platform\backend
   ```
4. Execute:
   ```cmd
   npm run start:dev
   ```

---

### SoluÃ§Ã£o 3: Alterar PolÃ­tica de ExecuÃ§Ã£o (Se necessÃ¡rio)

Se as soluÃ§Ãµes acima nÃ£o funcionarem:

```powershell
# Executar como Administrador
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Depois reiniciar o PowerShell.**

---

## ðŸš€ Comandos Corretos para o Projeto

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

## ðŸ’¡ Dica: Criar Alias Permanente

Para nÃ£o precisar usar `npm.cmd` sempre, adicione ao seu perfil do PowerShell:

```powershell
# Abrir perfil
notepad $PROFILE

# Adicionar esta linha:
Set-Alias npm npm.cmd

# Salvar e fechar
# Reiniciar PowerShell
```

---

**Ãšltima atualizaÃ§Ã£o:** 07/01/2025

