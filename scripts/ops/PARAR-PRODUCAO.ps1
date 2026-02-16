# ============================================
# 🛑 PARAR AMBIENTE DE PRODUÇÃO
# ============================================
# ⚠️  ATENÇÃO: Isso vai parar o site público!

Write-Host "🛑 PARANDO AMBIENTE DE PRODUÇÃO" -ForegroundColor Red
Write-Host "===============================" -ForegroundColor Red
Write-Host ""
Write-Host "⚠️  ATENÇÃO: Isso vai tirar o site do ar!" -ForegroundColor Red
Write-Host "   Clientes não conseguirão acessar!" -ForegroundColor Red
Write-Host ""

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$composeFile = Join-Path $root "deploy\docker-compose.prod.yml"

# Verificar se produção está rodando
Write-Host "🔍 Verificando containers PROD..." -ForegroundColor Yellow
$prodContainers = docker ps --format "{{.Names}}" 2>$null | Where-Object { $_ -match "prod" }

if (-not $prodContainers) {
    Write-Host "ℹ️  Nenhum container PROD rodando" -ForegroundColor Gray
    exit 0
}

Write-Host "Containers PROD rodando:" -ForegroundColor Yellow
$prodContainers | ForEach-Object { Write-Host "   • $_" -ForegroundColor White }
Write-Host ""

# Backup antes de parar
Write-Host "💾 Fazendo backup antes de parar..." -ForegroundColor Yellow
$backupDir = "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir/prod_backup_before_stop_$timestamp.sql"

try {
    if (docker exec ucm-postgres-prod pg_isready -U $env:DB_USERNAME -d ucm_prod 2>$null) {
        docker exec ucm-postgres-prod pg_dump -U $env:DB_USERNAME -d ucm_prod > $backupFile 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Backup salvo: $backupFile" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "   ⚠️  Erro no backup" -ForegroundColor Yellow
}

# Confirmação múltipla para produção
Write-Host ""
Write-Host "❌ CONFIRMAÇÃO DE SEGURANÇA:" -ForegroundColor Red
$confirm1 = Read-Host "Digite 'PARAR-PRODUCAO' para confirmar"
if ($confirm1 -ne 'PARAR-PRODUCAO') {
    Write-Host "❌ Confirmação incorreta. Operação cancelada." -ForegroundColor Red
    exit 0
}

$confirm2 = Read-Host "Tem certeza absoluta? Clientes ficarão sem acesso! (sim/nao)"
if ($confirm2 -ne 'sim') {
    Write-Host "Operação cancelada." -ForegroundColor Yellow
    exit 0
}

# Parar containers PROD
Write-Host ""
Write-Host "🛑 Parando produção..." -ForegroundColor Red
Write-Host "   Site ficará indisponível!" -ForegroundColor Red
Write-Host ""

try {
    docker-compose -f $composeFile down
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Produção parada com sucesso!" -ForegroundColor Green
        Write-Host "   Site agora está OFFLINE!" -ForegroundColor Red
    } else {
        Write-Host "❌ Erro ao parar produção" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 RESUMO:" -ForegroundColor Yellow
Write-Host "   • Produção parada" -ForegroundColor Red
Write-Host "   • Site offline" -ForegroundColor Red
if (Test-Path $backupFile) {
    Write-Host "   • Backup criado: $backupFile" -ForegroundColor Green
}
Write-Host ""
Write-Host "🔄 PARA REINICIAR:" -ForegroundColor Cyan
Write-Host "   .\INICIAR-PRODUCAO.ps1" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  LEMBRE-SE: Site está OFFLINE!" -ForegroundColor Red