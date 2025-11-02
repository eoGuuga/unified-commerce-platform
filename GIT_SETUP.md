# Configuracao Git e GitHub

## O Git nao esta instalado na sua maquina

Para criar um repositorio Git profissional, voce precisa:

### 1. Instalar Git

Baixe e instale o Git em: https://git-scm.com/download/win

### 2. Configurar Git (primeira vez)

Apos instalar, abra PowerShell e execute:

```powershell
git config --global user.name "Seu Nome Completo"
git config --global user.email "seu.email@exemplo.com"
```

### 3. Criar repositorio local

```powershell
cd "C:\Users\gusta\Desktop\Nova pasta"
git init
git add .
git commit -m "Initial commit: Setup do projeto UCM"

# Criar branch main (se necessario)
git branch -M main
```

### 4. Criar repositorio no GitHub

1. Acesse: https://github.com/new
2. Nome do repositorio: `unified-commerce-platform` (ou outro nome)
3. Description: "SaaS de comercio unificado para negocios artesanais - previne overselling"
4. Visibilidade: Public ou Private (voce escolhe)
5. Nao marque "Add README" (ja temos um)
6. Click "Create repository"

### 5. Conectar e fazer push

```powershell
# Adicionar remote
git remote add origin https://github.com/SEU-USUARIO/unified-commerce-platform.git

# Primeiro push
git push -u origin main
```

### 6. Estrutura de commits profissional

Apos isso, voce pode fazer commits organizados:

```powershell
# Feature: Nova funcionalidade
git add .
git commit -m "feat: Adicionar modulo de produtos"

# Fix: Correcao de bug
git commit -m "fix: Corrigir validacao de estoque"

# Docs: Documentacao
git commit -m "docs: Atualizar README com instrucoes de deploy"

# Refactor: Refatoracao
git commit -m "refactor: Melhorar estruttura de pastas"

# Test: Testes
git commit -m "test: Adicionar testes para modulo Orders"
```

## Convencoes de Commit (Conventional Commits)

- `feat:` Nova funcionalidade
- `fix:` Correcao de bug
- `docs:` Documentacao
- `refactor:` Refatoracao de codigo
- `test:` Testes
- `chore:` Manutencao (deps, configs)
- `perf:` Melhoria de performance
- `build:` Build system

## Padrao de mensagens

```
tipo: Descricao curta (50 chars)

Corpo opcional explicando:
- O que foi feito
- Por que foi feito
- Como funciona
```

Exemplo:
```
feat: Implementar modulo Orders com FOR UPDATE lock

Adicionar transacoes ACID para prevenir overselling:
- Lock pessimista em movimentacoes de estoque
- Validacao de estoque dentro da transacao
- Abate automatico de estoque ao criar pedido
- Geração de numero de pedido unico

Closes #123
```
