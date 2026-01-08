# Script para Iniciar Ambiente Completo
# Execute este script na raiz do projeto

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Iniciando Ambiente - UCM Platform" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Docker
Write-Host "[1/5] Verificando Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker encontrado: $dockerVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker não encontrado. Instale Docker Desktop primeiro." -ForegroundColor Red
        Write-Host "   Download: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Docker não está acessível. Certifique-se que Docker Desktop está rodando." -ForegroundColor Red
    Write-Host "   Inicie Docker Desktop e tente novamente." -ForegroundColor Yellow
    exit 1
}

# 2. Iniciar containers
Write-Host ""
Write-Host "[2/5] Iniciando containers Docker..." -ForegroundColor Yellow
docker-compose -f config\docker-compose.yml up -d postgres redis 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Containers iniciados!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Erro ao iniciar containers. Verifique os logs." -ForegroundColor Yellow
    docker-compose -f config\docker-compose.yml logs --tail=20
    exit 1
}

# 3. Aguardar PostgreSQL ficar pronto
Write-Host ""
Write-Host "[3/5] Aguardando PostgreSQL ficar pronto..." -ForegroundColor Yellow
$maxAttempts = 15
$attempt = 0
$ready = $false

while (-not $ready -and $attempt -lt $maxAttempts) {
    try {
        $result = docker exec ucm-postgres pg_isready -U postgres 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            Write-Host "✅ PostgreSQL está pronto!" -ForegroundColor Green
        }
    } catch {
        # Ignora erro
    }
    
    if (-not $ready) {
        $attempt++
        Write-Host "   Aguardando... ($attempt/$maxAttempts)" -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

if (-not $ready) {
    Write-Host "⚠️  PostgreSQL não ficou pronto a tempo." -ForegroundColor Yellow
    Write-Host "   Verifique os logs: docker logs ucm-postgres" -ForegroundColor Gray
    exit 1
}

# 4. Verificar Redis
Write-Host ""
Write-Host "[4/5] Verificando Redis..." -ForegroundColor Yellow
try {
    $result = docker exec ucm-redis redis-cli ping 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Redis está pronto!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Redis pode precisar de mais tempo." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Não foi possível verificar Redis, mas continuando..." -ForegroundColor Yellow
}

# 5. Verificar dependências do backend
Write-Host ""
Write-Host "[5/5] Verificando dependências do backend..." -ForegroundColor Yellow
Push-Location backend

if (-not (Test-Path "node_modules")) {
    Write-Host "   Instalando dependências..." -ForegroundColor Yellow
    npm install --silent 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Dependências instaladas!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Erro ao instalar dependências. Execute manualmente: npm install" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ Dependências já instaladas" -ForegroundColor Green
}

Pop-Location

# Resumo
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "✅ Ambiente Iniciado com Sucesso!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Containers rodando:" -ForegroundColor Cyan
docker ps --filter "name=ucm-" --format "  - {{.Names}}: {{.Status}}" | ForEach-Object { Write-Host $_ -ForegroundColor White }
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Iniciar backend:" -ForegroundColor White
Write-Host "     cd backend" -ForegroundColor Yellow
Write-Host "     npm run start:dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Em outro terminal, iniciar frontend (opcional):" -ForegroundColor White
Write-Host "     cd frontend" -ForegroundColor Yellow
Write-Host "     npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. Testar backend:" -ForegroundColor White
Write-Host "     .\scripts\test\test-backend.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "  - Backend:  http://localhost:3001/api/v1" -ForegroundColor White
Write-Host "  - Swagger:  http://localhost:3001/api/docs" -ForegroundColor White
Write-Host "  - Adminer:  http://localhost:8080" -ForegroundColor White
Write-Host "  - Redis UI: http://localhost:8081" -ForegroundColor White
Write-Host ""
