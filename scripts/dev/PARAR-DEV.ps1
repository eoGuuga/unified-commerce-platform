# ============================================
# 🛑 PARAR AMBIENTE DE DESENVOLVIMENTO
# ============================================

Write-Host "🛑 PARANDO AMBIENTE DE DESENVOLVIMENTO" -ForegroundColor Red
Write-Host "====================================" -ForegroundColor Red
Write-Host ""

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$composeFile = Join-Path $root "deploy\docker-compose.dev.yml"

# Verificar se DEV está rodando
Write-Host "🔍 Verificando containers DEV..." -ForegroundColor Yellow
$devContainers = docker ps --format "{{.Names}}" 2>$null | Where-Object { $_ -match "dev" }

if (-not $devContainers) {
    Write-Host "ℹ️  Nenhum container DEV rodando" -ForegroundColor Gray
    exit 0
}

Write-Host "Containers DEV encontrados:" -ForegroundColor Yellow
$devContainers | ForEach-Object { Write-Host "   • $_" -ForegroundColor White }
Write-Host ""

# Confirmar parada
$confirm = Read-Host "Tem certeza que quer parar o ambiente DEV? (s/n)"
if ($confirm -ne 's' -and $confirm -ne 'S') {
    Write-Host "Operação cancelada." -ForegroundColor Yellow
    exit 0
}

# Parar containers DEV
Write-Host ""
Write-Host "🛑 Parando containers DEV..." -ForegroundColor Yellow
try {
    docker-compose -f $composeFile down
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Ambiente DEV parado com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro ao parar ambiente DEV" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Limpar volumes opcionais
Write-Host ""
$cleanVolumes = Read-Host "Quer limpar volumes DEV (dados serão perdidos)? (s/n)"
if ($cleanVolumes -eq 's' -or $cleanVolumes -eq 'S') {
    Write-Host "🧹 Limpando volumes DEV..." -ForegroundColor Yellow
    try {
        docker volume rm ucm-dev-postgres_data ucm-dev-redis_data ucm-dev-ollama_data 2>$null
        Write-Host "✅ Volumes DEV limpos!" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Alguns volumes podem não ter sido removidos" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Ambiente de desenvolvimento parado!" -ForegroundColor Green
Write-Host "   Para reiniciar: .\INICIAR-DEV.ps1" -ForegroundColor White