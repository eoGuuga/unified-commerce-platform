# Script de Setup Automatico - UCM Platform
# Execute este script a partir da raiz do projeto: .\scripts\setup\setup.ps1

# Mudar para a raiz do projeto
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptPath)
Set-Location $projectRoot

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Setup UCM Platform" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Adicionar Node.js ao PATH se necessario
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $nodePath = "C:\Program Files\nodejs"
    if (Test-Path $nodePath) {
        $env:Path = "$nodePath;$env:Path"
        Write-Host "Node.js adicionado ao PATH temporariamente" -ForegroundColor Yellow
    }
}

# 1. Verificar Docker
Write-Host "[1/5] Verificando Docker..." -ForegroundColor Yellow
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "Docker encontrado!" -ForegroundColor Green
} else {
    Write-Host "ERRO: Docker nao encontrado. Instale Docker Desktop primeiro." -ForegroundColor Red
    exit 1
}

# 2. Iniciar PostgreSQL
Write-Host "[2/5] Iniciando PostgreSQL..." -ForegroundColor Yellow
docker-compose -f config\docker-compose.yml up -d postgres
Start-Sleep -Seconds 5

$postgresReady = $false
$maxAttempts = 12
$attempt = 0

while (-not $postgresReady -and $attempt -lt $maxAttempts) {
    try {
        docker exec ucm-postgres pg_isready -U postgres 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $postgresReady = $true
            Write-Host "PostgreSQL pronto!" -ForegroundColor Green
        }
    } catch {
        # Ignora erro
    }
    $attempt++
    if (-not $postgresReady) {
        Write-Host "Aguardando PostgreSQL..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
    }
}

if (-not $postgresReady) {
    Write-Host "ERRO: PostgreSQL nao iniciou a tempo" -ForegroundColor Red
    exit 1
}

# 3. Executar Migration
Write-Host "[3/5] Executando migration SQL..." -ForegroundColor Yellow
Get-Content scripts\migrations\001-initial-schema.sql | docker exec -i ucm-postgres psql -U postgres -d ucm
Write-Host "Migration executada!" -ForegroundColor Green

# 4. Criar .env do backend se nao existir
Write-Host "[4/5] Configurando backend..." -ForegroundColor Yellow
if (-not (Test-Path backend\.env)) {
    @"
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ucm
JWT_SECRET=change-me-in-production-secret-key-min-32-chars
JWT_EXPIRATION=15m
FRONTEND_URL=http://localhost:3000
"@ | Out-File -FilePath backend\.env -Encoding utf8
    Write-Host "Arquivo .env criado em backend\.env" -ForegroundColor Green
} else {
    Write-Host "Arquivo .env ja existe" -ForegroundColor Gray
}

# 5. Instalar dependencias
Write-Host "[5/5] Instalando dependencias..." -ForegroundColor Yellow

# Verificar Node.js/npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "ERRO: Node.js/npm nao encontrado!" -ForegroundColor Red
    Write-Host "     Instale Node.js de: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Node.js/npm encontrado!" -ForegroundColor Green

# Backend
if (Test-Path backend\node_modules) {
    Write-Host "Dependencias do backend ja instaladas" -ForegroundColor Gray
} else {
    Write-Host "Instalando dependencias do backend..." -ForegroundColor Yellow
    Push-Location backend
    npm install
    Pop-Location
}

# Frontend
if (Test-Path frontend\node_modules) {
    Write-Host "Dependencias do frontend ja instaladas" -ForegroundColor Gray
} else {
    Write-Host "Instalando dependencias do frontend..." -ForegroundColor Yellow
    Push-Location frontend
    npm install
    Pop-Location
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "Setup Concluido!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "1. Backend:  cd backend && npm run start:dev" -ForegroundColor White
Write-Host "2. Frontend: cd frontend && npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Backend:  http://localhost:3001/api/v1" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
