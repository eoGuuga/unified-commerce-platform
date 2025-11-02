# Script de Setup Automatico - UCM Platform
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Setup UCM Platform" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

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
docker-compose up -d postgres
Start-Sleep -Seconds 5

$postgresReady = $false
$maxAttempts = 12
$attempt = 0

while (-not $postgresReady -and $attempt -lt $maxAttempts) {
    try {
        $result = docker exec ucm-postgres pg_isready -U postgres 2>&1
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
Get-Content scripts/migrations/001-initial-schema.sql | docker exec -i ucm-postgres psql -U postgres -d ucm
Write-Host "Migration executada!" -ForegroundColor Green

# 4. Criar .env do backend se nao existir
Write-Host "[4/5] Configurando backend..." -ForegroundColor Yellow
if (-not (Test-Path backend/.env)) {
    @"
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ucm
JWT_SECRET=change-me-in-production-secret-key-min-32-chars
JWT_EXPIRATION=15m
FRONTEND_URL=http://localhost:3000
"@ | Out-File -FilePath backend/.env -Encoding utf8
    Write-Host "Arquivo .env criado em backend/.env" -ForegroundColor Green
} else {
    Write-Host "Arquivo .env ja existe" -ForegroundColor Gray
}

# 5. Instalar dependencias
Write-Host "[5/5] Instalando dependencias..." -ForegroundColor Yellow

# Backend
if (Test-Path backend/node_modules) {
    Write-Host "Dependencias do backend ja instaladas" -ForegroundColor Gray
} else {
    Write-Host "Instalando dependencias do backend..." -ForegroundColor Yellow
    Set-Location backend
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        npm install
        Set-Location ..
    } else {
        Write-Host "AVISO: npm nao encontrado. Execute manualmente: cd backend && npm install" -ForegroundColor Yellow
    }
}

# Frontend
if (Test-Path frontend/node_modules) {
    Write-Host "Dependencias do frontend ja instaladas" -ForegroundColor Gray
} else {
    Write-Host "Instalando dependencias do frontend..." -ForegroundColor Yellow
    Set-Location frontend
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        npm install
        Set-Location ..
    } else {
        Write-Host "AVISO: npm nao encontrado. Execute manualmente: cd frontend && npm install" -ForegroundColor Yellow
    }
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
