# 📚 TUTORIAL COMPLETO - Instalação e Setup do Projeto

> **Guia passo a passo para instalar e rodar o projeto Unified Commerce Platform (UCM) em um computador NOVO**

Este tutorial cobre **TUDO** desde a instalação do Docker até rodar backend e frontend funcionando.

**Tempo estimado:** 30-45 minutos (dependendo da velocidade da internet)

---

## 📋 RESUMO EXECUTIVO

### O que você vai instalar:

1. ✅ **Node.js** (v20 LTS) - Runtime JavaScript
2. ✅ **Git** - Controle de versão
3. ✅ **Docker Desktop** - Containers para PostgreSQL e Redis
4. ✅ **Dependências do projeto** - Via npm install

### O que você vai configurar:

1. ✅ Arquivo `.env` no backend
2. ✅ Arquivo `.env.local` no frontend
3. ✅ Banco de dados PostgreSQL (via Docker)
4. ✅ Cache Redis (via Docker)
5. ✅ Migrations do banco de dados

### Resultado final:

- ✅ **Backend** rodando em http://localhost:3001
- ✅ **Frontend** rodando em http://localhost:3000
- ✅ **Swagger API Docs** em http://localhost:3001/api/docs
- ✅ **Banco de dados** funcionando e migrado
- ✅ **Tudo testado e funcionando**

---

## 🎯 PRÉ-REQUISITOS

- **Windows 10/11** (64-bit)
- **8GB RAM mínimo** (16GB recomendado)
- **10GB espaço em disco livre**
- **Acesso à internet** (para downloads)
- **Conta de administrador** (para instalações)

Se você já tem Node.js, Git e Docker instalados, pode pular para a [seção 6 - Clone do Projeto](#6-clone-do-projeto).

---

## 📋 ÍNDICE

1. [Pré-requisitos e Verificações](#1-pré-requisitos-e-verificações)
2. [Instalação do Node.js](#2-instalação-do-nodejs)
3. [Instalação do Git](#3-instalação-do-git)
4. [Instalação do Docker Desktop](#4-instalação-do-docker-desktop)
5. [Configuração do Docker Desktop](#5-configuração-do-docker-desktop)
6. [Clone do Projeto](#6-clone-do-projeto)
7. [Configuração do Ambiente](#7-configuração-do-ambiente)
8. [Setup do Banco de Dados](#8-setup-do-banco-de-dados)
9. [Instalação de Dependências](#9-instalação-de-dependências)
10. [Iniciar Backend](#10-iniciar-backend)
11. [Iniciar Frontend](#11-iniciar-frontend)
12. [Verificação e Testes](#12-verificação-e-testes)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. PRÉ-REQUISITOS E VERIFICAÇÕES

### Sistema Operacional
- **Windows 10/11** (64-bit) ✅
- **8GB RAM mínimo** (16GB recomendado)
- **10GB espaço em disco livre**
- **Acesso à internet** (para downloads e instalações)

### Verificar Versão do Windows

1. Pressione `Win + R`
2. Digite `winver` e pressione Enter
3. Verifique se é Windows 10 ou superior

---

## 2. INSTALAÇÃO DO NODE.JS

### 2.1 Download

1. Acesse: **https://nodejs.org/**
2. Baixe a versão **LTS** (Long Term Support) - recomendado
   - Exemplo: `v20.11.0 LTS`
3. Execute o arquivo `.msi` baixado

### 2.2 Instalação

1. Clique em **"Next"** na tela de boas-vindas
2. Aceite os termos de licença e clique **"Next"**
3. **Importante:** Na tela "Custom Setup", deixe marcado:
   - ✅ **npm package manager** (instalado por padrão)
   - ✅ **Add to PATH** (marca automaticamente)
4. Clique **"Next"** até chegar em **"Install"**
5. Clique **"Install"**
6. Aguarde a instalação (1-2 minutos)
7. Clique **"Finish"**

### 2.3 Verificação

Abra o **PowerShell** (Win + X → Windows PowerShell) e execute:

```powershell
node --version
npm --version
```

**Resultado esperado:**
```
v20.11.0  (ou versão similar)
10.2.3    (ou versão similar)
```

✅ Se aparecerem as versões, Node.js está instalado corretamente!

---

## 3. INSTALAÇÃO DO GIT

### 3.1 Download

1. Acesse: **https://git-scm.com/download/win**
2. Clique em **"Download"** (baixará automaticamente a versão mais recente)

### 3.2 Instalação

1. Execute o arquivo `.exe` baixado
2. Clique **"Next"** várias vezes mantendo as opções padrão
3. Na tela "Choosing the default editor", você pode deixar **"Nano editor"** ou escolher **"Visual Studio Code"** se tiver instalado
4. Continue clicando **"Next"** até chegar em **"Install"**
5. Clique **"Install"** e aguarde
6. Clique **"Finish"**

### 3.3 Verificação

No **PowerShell**, execute:

```powershell
git --version
```

**Resultado esperado:**
```
git version 2.42.0.windows.2  (ou versão similar)
```

✅ Se aparecer a versão, Git está instalado corretamente!

---

## 4. INSTALAÇÃO DO DOCKER DESKTOP

### 4.1 Verificar Requisitos do Sistema

O Docker Desktop requer:
- **WSL 2** (Windows Subsystem for Linux 2)
- **Hyper-V** (geralmente já habilitado no Windows 11)
- **Virtualização habilitada** na BIOS

**⚠️ Importante:** Se você não tem certeza, o instalador do Docker Desktop verificará automaticamente.

### 4.2 Download

1. Acesse: **https://www.docker.com/products/docker-desktop/**
2. Clique em **"Download for Windows"**
3. Aguarde o download do arquivo `Docker Desktop Installer.exe`

### 4.3 Instalação

1. **Execute** o arquivo `Docker Desktop Installer.exe` como **Administrador**
   - Clique direito → **"Executar como administrador"**

2. Na tela inicial:
   - ✅ Marque **"Use WSL 2 instead of Hyper-V"** (recomendado)
   - Clique **"Ok"**

3. O instalador verificará requisitos automaticamente:
   - Se faltar WSL 2, ele oferecerá instalar automaticamente
   - Se tudo estiver OK, aparecerá botão **"Close and restart"**
   - **IMPORTANTE:** Reinicie o computador quando solicitado!

4. Após reiniciar, o Docker Desktop iniciará automaticamente
   - Na primeira vez, pode demorar 1-2 minutos para inicializar

### 4.4 Primeiro Início

1. Quando o Docker Desktop abrir, você verá a tela de boas-vindas
2. **Opcional:** Crie uma conta Docker (não é obrigatório para desenvolvimento local)
   - Pode clicar em **"Skip"** ou **"X"** para pular

3. Você verá a interface do Docker Desktop com:
   - Ícone da baleia (Docker) na bandeja do sistema (canto inferior direito)
   - Status: **"Docker Desktop is running"**

### 4.5 Verificação

Abra o **PowerShell** e execute:

```powershell
docker --version
docker-compose --version
```

**Resultado esperado:**
```
Docker version 24.0.0, build ...
Docker Compose version v2.21.0
```

✅ Se aparecerem as versões, Docker está instalado e funcionando!

---

## 5. CONFIGURAÇÃO DO DOCKER DESKTOP

### 5.1 Configurações Básicas

1. Abra o **Docker Desktop**
2. Clique no **ícone de engrenagem** (⚙️ Settings) no canto superior direito
3. Vá em **"Resources"** → **"Advanced"**
4. Ajuste se necessário:
   - **CPUs:** Deixe pelo menos 2 CPUs alocados
   - **Memory:** Deixe pelo menos 4GB (8GB se tiver 16GB de RAM)
5. Clique **"Apply & Restart"**

### 5.2 Verificar que Docker está Rodando

1. Verifique o **ícone na bandeja do sistema** (canto inferior direito)
   - Ícone da baleia deve estar **verde** ou sem avisos

2. No **PowerShell**, execute:

```powershell
docker ps
```

**Resultado esperado:**
```
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

(Está vazio, mas sem erros = Docker funcionando ✅)

---

## 6. CLONE DO PROJETO

### 6.1 Escolher Localização

Escolha uma pasta para o projeto, por exemplo:
- `C:\Users\SeuNome\Documents\`
- `C:\Dev\`
- `C:\Projetos\`

### 6.2 Clonar o Repositório

**Opção A: Se o projeto está no GitHub/GitLab**

```powershell
# Navegue até a pasta desejada
cd C:\Users\SeuNome\Documents

# Clone o repositório (substitua a URL pela real)
git clone https://github.com/seu-usuario/unified-commerce-platform.git

# Entre na pasta do projeto
cd unified-commerce-platform
```

**Opção B: Se você tem o projeto em uma pasta/ZIP**

1. Extraia o ZIP para uma pasta (ex: `C:\Users\SeuNome\Documents\SAS\`)
2. Abra o PowerShell na pasta do projeto:

```powershell
cd C:\Users\SeuNome\Documents\SAS\unified-commerce-platform
```

### 6.3 Verificar Estrutura do Projeto

```powershell
# Liste as pastas principais
dir
```

**Você deve ver:**
```
backend/
frontend/
config/
docs/
scripts/
README.md
```

✅ Se essas pastas existem, o projeto está no lugar certo!

---

## 7. CONFIGURAÇÃO DO AMBIENTE

### 7.1 Criar Arquivo `.env` no Backend

1. Navegue até a pasta `backend`:

```powershell
cd backend
```

2. Crie o arquivo `.env`:

**Windows PowerShell:**
```powershell
# Copie o arquivo de exemplo (se existir)
Copy-Item .env.example .env

# OU crie manualmente
New-Item .env -ItemType File
```

3. Abra o arquivo `.env` em um editor de texto (Notepad, VS Code, etc.)

4. Cole o seguinte conteúdo:

```env
# ============================================
# APPLICATION
# ============================================
NODE_ENV=development
PORT=3001
API_VERSION=v1

# ============================================
# DATABASE - Docker Local
# ============================================
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ucm

# ============================================
# REDIS - Docker Local
# ============================================
REDIS_URL=redis://localhost:6379

# ============================================
# JWT
# ============================================
JWT_SECRET=dev-secret-key-change-in-production-min-32-chars
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production-min-32-chars
JWT_REFRESH_EXPIRATION=7d

# ============================================
# CORS
# ============================================
CORS_ORIGIN=http://localhost:3000

# ============================================
# STRIPE (Opcional - para desenvolvimento pode deixar vazio)
# ============================================
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# ============================================
# WHATSAPP (Opcional - para desenvolvimento pode deixar vazio)
# ============================================
WHATSAPP_API_KEY=
WHATSAPP_API_SECRET=

# ============================================
# OPENAI (Opcional - para desenvolvimento pode deixar vazio)
# ============================================
OPENAI_API_KEY=

# ============================================
# RESEND (Opcional - para desenvolvimento pode deixar vazio)
# ============================================
RESEND_API_KEY=
EMAIL_FROM=
```

5. **Salve o arquivo** (Ctrl + S)

### 7.2 Criar Arquivo `.env.local` no Frontend

1. Volte para a raiz e entre na pasta `frontend`:

```powershell
cd ..
cd frontend
```

2. Crie o arquivo `.env.local`:

```powershell
New-Item .env.local -ItemType File
```

3. Abra e cole o seguinte conteúdo:

```env
# ============================================
# APPLICATION
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Unified Commerce Platform

# ============================================
# BACKEND API
# ============================================
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
API_URL=http://localhost:3001

# ============================================
# AUTHENTICATION
# ============================================
NEXT_PUBLIC_AUTH_ENABLED=true
NEXT_PUBLIC_JWT_STORAGE_KEY=ucm-access-token

# ============================================
# FEATURES
# ============================================
NEXT_PUBLIC_ENABLE_WHATSAPP_BOT=true
NEXT_PUBLIC_ENABLE_ECOMMERCE=true
NEXT_PUBLIC_ENABLE_DARK_MODE=true

# ============================================
# SUPPORT
# ============================================
NEXT_PUBLIC_SUPPORT_EMAIL=suporte@exemplo.com
NEXT_PUBLIC_SUPPORT_PHONE=+5511999998888
```

4. **Salve o arquivo** (Ctrl + S)

✅ Arquivos de ambiente configurados!

---

## 8. SETUP DO BANCO DE DADOS

### 8.1 Iniciar Containers Docker

1. Volte para a **raiz do projeto**:

```powershell
cd ..
```

2. **Certifique-se que Docker Desktop está rodando** (verifique a bandeja do sistema)

3. Inicie os containers PostgreSQL e Redis:

```powershell
docker-compose -f config/docker-compose.yml up -d postgres redis
```

**Aguarde 10-15 segundos** enquanto os containers iniciam.

### 8.2 Verificar se Containers Estão Rodando

```powershell
docker ps
```

**Você deve ver algo como:**
```
CONTAINER ID   IMAGE                  STATUS
abc123def456   postgres:15-alpine     Up 10 seconds
def456ghi789   redis:7-alpine         Up 10 seconds
```

✅ Se os containers aparecem com status "Up", estão funcionando!

### 8.3 Executar Migrations

Aguarde mais 5-10 segundos para o PostgreSQL inicializar completamente, depois execute:

```powershell
# Executar migration inicial
docker exec -i ucm-postgres psql -U postgres -d ucm < scripts/migrations/001-initial-schema.sql
```

**Resultado esperado:**
```
CREATE TABLE
CREATE TABLE
... (várias mensagens CREATE)
```

Se der erro de arquivo não encontrado, use o caminho completo:

```powershell
# Encontre o caminho completo
$projectPath = (Get-Location).Path
docker exec -i ucm-postgres psql -U postgres -d ucm < "$projectPath\scripts\migrations\001-initial-schema.sql"
```

### 8.4 (Opcional) Executar Migration de Segurança

```powershell
docker exec -i ucm-postgres psql -U postgres -d ucm < scripts/migrations/002-security-and-performance.sql
```

### 8.5 Verificar Banco de Dados

```powershell
docker exec -i ucm-postgres psql -U postgres -d ucm -c "\dt"
```

**Resultado esperado:** Lista de tabelas criadas

✅ Banco de dados configurado!

---

## 9. INSTALAÇÃO DE DEPENDÊNCIAS

### 9.1 Instalar Dependências do Backend

1. Entre na pasta `backend`:

```powershell
cd backend
```

2. Instale as dependências:

```powershell
npm install
```

**Aguarde 2-5 minutos** (dependendo da velocidade da internet)

**Resultado esperado:**
```
added 1234 packages, and audited 1235 packages in 3m
```

✅ Se aparecer "added X packages", backend instalado!

### 9.2 Instalar Dependências do Frontend

1. Volte para a raiz e entre na pasta `frontend`:

```powershell
cd ..
cd frontend
```

2. Instale as dependências:

```powershell
npm install
```

**Aguarde 2-5 minutos**

**Resultado esperado:**
```
added 567 packages, and audited 568 packages in 2m
```

✅ Se aparecer "added X packages", frontend instalado!

---

## 10. INICIAR BACKEND

### 10.1 Verificar Docker

**Certifique-se que Docker Desktop está rodando e containers estão ativos:**

```powershell
# Volte para raiz
cd ..

# Verifique containers
docker ps --filter "name=ucm-"
```

Se os containers não estiverem rodando:

```powershell
docker-compose -f config/docker-compose.yml up -d postgres redis
```

### 10.2 Iniciar Backend

1. Entre na pasta `backend`:

```powershell
cd backend
```

2. Inicie o servidor em modo desenvolvimento:

```powershell
npm run start:dev
```

**Resultado esperado:**
```
[Nest] 12345  - 01/08/2025, 10:00:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 01/08/2025, 10:00:01 AM     LOG [InstanceLoader] AppModule dependencies initialized
...
[Nest] 12345  - 01/08/2025, 10:00:05 AM     LOG [NestApplication] Nest application successfully started on port 3001
```

✅ Se aparecer "successfully started on port 3001", backend está rodando!

### 10.3 Verificar Backend

**Em outro terminal PowerShell**, teste se o backend está respondendo:

```powershell
curl http://localhost:3001/api/v1/health
```

**Ou no navegador, abra:**
- http://localhost:3001/api/v1/health

**Resultado esperado:**
```json
{"status":"ok","timestamp":"...","service":"UCM Backend"}
```

✅ Backend funcionando!

**Deixe este terminal aberto** - o backend precisa continuar rodando!

---

## 11. INICIAR FRONTEND

### 11.1 Abrir Novo Terminal

**IMPORTANTE:** Abra um **NOVO terminal PowerShell** (deixe o backend rodando no terminal anterior).

### 11.2 Navegar até Frontend

```powershell
cd C:\Users\SeuNome\Documents\SAS\unified-commerce-platform\frontend
```

(Ajuste o caminho conforme sua localização do projeto)

### 11.3 Iniciar Frontend

```powershell
npm run dev
```

**Resultado esperado:**
```
▲ Next.js 16.0.0
- Local:        http://localhost:3000
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

✅ Frontend iniciado!

### 11.4 Acessar Frontend

**Abra o navegador** e acesse:

- **Frontend:** http://localhost:3000
- **PDV:** http://localhost:3000/pdv
- **Admin:** http://localhost:3000/admin
- **Loja:** http://localhost:3000/loja

✅ Frontend funcionando!

---

## 12. VERIFICAÇÃO E TESTES

### 12.1 Verificar Serviços Rodando

**Você deve ter 3 coisas rodando:**

1. ✅ **Docker Desktop** (na bandeja do sistema)
   - Containers: `ucm-postgres` e `ucm-redis`

2. ✅ **Backend** (terminal 1)
   - Rodando em: http://localhost:3001
   - Swagger: http://localhost:3001/api/docs

3. ✅ **Frontend** (terminal 2)
   - Rodando em: http://localhost:3000

### 12.2 Testar Backend via Swagger

1. Abra no navegador: **http://localhost:3001/api/docs**
2. Você verá a documentação Swagger da API
3. Teste o endpoint `/health`:
   - Expanda "Health"
   - Clique em "Try it out" → "Execute"
   - Deve retornar `200 OK` com status "ok"

✅ API documentada e funcionando!

### 12.3 Testar Frontend

1. Acesse: **http://localhost:3000**
2. Você deve ver a página inicial do projeto
3. Navegue pelas páginas:
   - `/pdv` - Ponto de venda
   - `/admin` - Dashboard admin
   - `/loja` - E-commerce

✅ Frontend funcionando!

### 12.4 (Opcional) Executar Testes Automatizados

**Em um novo terminal**, na raiz do projeto:

```powershell
cd C:\Users\SeuNome\Documents\SAS\unified-commerce-platform

# Testes do backend
cd backend
npm test
```

---

## 13. TROUBLESHOOTING

### Problema: "Docker daemon is not running"

**Solução:**
1. Abra **Docker Desktop**
2. Aguarde até aparecer "Docker Desktop is running"
3. Tente novamente

---

### Problema: "port is already allocated"

**Solução:**

1. Pare containers existentes:

```powershell
docker-compose -f config/docker-compose.yml down
```

2. Verifique se algo está usando as portas:

```powershell
# Porta 3001 (backend)
netstat -ano | findstr :3001

# Porta 3000 (frontend)
netstat -ano | findstr :3000

# Porta 5432 (postgres)
netstat -ano | findstr :5432
```

3. Se encontrar processos, finalize-os ou use portas diferentes

---

### Problema: "Cannot find module" no backend

**Solução:**

```powershell
cd backend
rm -rf node_modules
npm install
```

---

### Problema: "Cannot find module" no frontend

**Solução:**

```powershell
cd frontend
rm -rf node_modules .next
npm install
```

---

### Problema: Backend não conecta ao banco

**Solução:**

1. Verifique se PostgreSQL está rodando:

```powershell
docker ps --filter "name=ucm-postgres"
```

2. Se não estiver:

```powershell
docker-compose -f config/docker-compose.yml up -d postgres
```

3. Aguarde 10 segundos e tente novamente

4. Verifique o arquivo `.env` em `backend/`:
   - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ucm`

---

### Problema: Frontend não conecta ao backend

**Solução:**

1. Verifique se backend está rodando: http://localhost:3001/api/v1/health

2. Verifique o arquivo `.env.local` em `frontend/`:
   - `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`

3. Reinicie o frontend:

```powershell
# Pressione Ctrl+C para parar
# Depois inicie novamente
npm run dev
```

---

### Problema: Erro ao executar migrations

**Solução:**

1. Use caminho completo:

```powershell
$projectPath = (Get-Location).Path
$sqlPath = "$projectPath\scripts\migrations\001-initial-schema.sql"
Get-Content $sqlPath | docker exec -i ucm-postgres psql -U postgres -d ucm
```

---

### Problema: WSL 2 não instalado (para Docker)

**Solução:**

1. Abra PowerShell como **Administrador**

2. Execute:

```powershell
wsl --install
```

3. Reinicie o computador

4. Após reiniciar, o Docker Desktop deve funcionar

---

### Problema: Node.js não encontrado

**Solução:**

1. Verifique instalação:

```powershell
node --version
```

2. Se não funcionar, reinstale Node.js e **marque "Add to PATH"**

3. Reinicie o PowerShell após instalar

---

## ✅ RESUMO FINAL

Após seguir todos os passos, você deve ter:

✅ **Node.js** instalado e funcionando  
✅ **Git** instalado e funcionando  
✅ **Docker Desktop** instalado e rodando  
✅ **Projeto** clonado/configurado  
✅ **Arquivos `.env`** criados  
✅ **Banco de dados** configurado (PostgreSQL + Redis)  
✅ **Backend** rodando em http://localhost:3001  
✅ **Frontend** rodando em http://localhost:3000  

---

## 🚀 PRÓXIMOS PASSOS

Agora que tudo está funcionando:

1. **Explore a documentação:**
   - Leia: `docs/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md`

2. **Teste funcionalidades:**
   - Acesse: http://localhost:3001/api/docs
   - Teste endpoints via Swagger

3. **Acesse o frontend:**
   - Frontend: http://localhost:3000
   - PDV: http://localhost:3000/pdv
   - Admin: http://localhost:3000/admin

4. **Execute testes:**
   ```powershell
   cd backend
   npm test
   ```

---

## 📞 PRECISA DE AJUDA?

Se algo não funcionou:

1. Verifique a seção [Troubleshooting](#13-troubleshooting)
2. Verifique os logs:
   - Backend: Terminal onde `npm run start:dev` está rodando
   - Docker: `docker logs ucm-postgres` ou `docker logs ucm-redis`
3. Consulte a documentação em `docs/`

---

**Última atualização:** 08/01/2025  
**Versão do tutorial:** 1.0
