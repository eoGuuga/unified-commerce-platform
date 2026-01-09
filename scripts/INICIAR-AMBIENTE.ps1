# Script para Iniciar Ambiente Completo
# Execute este script na raiz do projeto: .\scripts\INICIAR-AMBIENTE.ps1

$root = Split-Path -Parent $PSScriptRoot

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
docker-compose -f "$root\config\docker-compose.yml" up -d postgres redis 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao iniciar containers" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Containers iniciados" -ForegroundColor Green

# 3. Aguardar serviços
Write-Host ""
Write-Host "[3/5] Aguardando serviços ficarem prontos..." -ForegroundColor Yellow
Start-Sleep -Seconds 15
Write-Host "✅ Serviços prontos" -ForegroundColor Green

# 4. Verificar containers
Write-Host ""
Write-Host "[4/5] Verificando containers..." -ForegroundColor Yellow
$containers = docker ps --filter "name=ucm-" --format "{{.Names}}"
if ($containers -match "ucm-postgres" -and $containers -match "ucm-redis") {
    Write-Host "✅ Containers rodando:" -ForegroundColor Green
    Write-Host "   - ucm-postgres" -ForegroundColor White
    Write-Host "   - ucm-redis" -ForegroundColor White
} else {
    Write-Host "⚠️  Alguns containers podem não estar rodando" -ForegroundColor Yellow
    Write-Host "   Execute: docker ps" -ForegroundColor Yellow
}

# 5. Resumo
Write-Host ""
Write-Host "[5/5] Ambiente iniciado!" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Backend: cd backend && npm run start:dev" -ForegroundColor White
Write-Host "  2. Frontend: cd frontend && npm run dev" -ForegroundColor White
Write-Host "  3. Testar: .\scripts\test\test-backend.ps1" -ForegroundColor White
Write-Host ""
Write-Host "URLs disponíveis:" -ForegroundColor Cyan
Write-Host "  - Backend API: http://localhost:3001/api/v1" -ForegroundColor White
Write-Host "  - Swagger: http://localhost:3001/api/docs" -ForegroundColor White
Write-Host "  - Adminer (DB): http://localhost:8080" -ForegroundColor White
Write-Host "  - Redis UI: http://localhost:8081" -ForegroundColor White
