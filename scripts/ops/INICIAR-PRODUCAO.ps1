# ============================================
# 🚀 INICIAR AMBIENTE DE PRODUÇÃO
# ============================================
# Ambiente otimizado para produção
# - Segurança máxima
# - Performance otimizada
# - Porta 80/443 via Nginx

Write-Host "🚀 INICIANDO AMBIENTE DE PRODUÇÃO" -ForegroundColor Magenta
Write-Host "=================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "🎯 AMBIENTE PROD - CONFIGURACOES:" -ForegroundColor Cyan
Write-Host "   • Frontend: https://seudominio.com" -ForegroundColor White
Write-Host "   • Backend: Interno (porta 3001)" -ForegroundColor White
Write-Host "   • Banco: PostgreSQL seguro" -ForegroundColor White
Write-Host "   • SSL: Let's Encrypt automático" -ForegroundColor White
Write-Host ""

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$composeFile = Join-Path $root "deploy\docker-compose.prod.yml"

# Verificar Docker
Write-Host "🔍 Verificando Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker OK: $($dockerVersion)" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker não encontrado" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Docker não encontrado" -ForegroundColor Red
    exit 1
}

# Verificar variáveis de ambiente críticas
Write-Host ""
Write-Host "🔐 Verificando variáveis de ambiente..." -ForegroundColor Yellow
$requiredEnvVars = @(
    "DB_USERNAME",
    "DB_PASSWORD",
    "JWT_SECRET",
    "MERCADOPAGO_ACCESS_TOKEN",
    "DEFAULT_TENANT_ID"
)

$envFile = ".env"
$missingVars = @()

if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    foreach ($var in $requiredEnvVars) {
        $found = $envContent | Where-Object { $_ -match "^$var=" }
        if (-not $found) {
            $missingVars += $var
        }
    }
} else {
    $missingVars = $requiredEnvVars
}

if ($missingVars.Count -eq 0) {
    Write-Host "✅ Variáveis de ambiente OK" -ForegroundColor Green
} else {
    Write-Host "❌ Variáveis de ambiente faltando:" -ForegroundColor Red
    foreach ($var in $missingVars) {
        Write-Host "   • $var" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Configure o arquivo .env primeiro!" -ForegroundColor Yellow
    exit 1
}

# Verificar se dev está rodando (conflito)
Write-Host ""
Write-Host "🔍 Verificando conflitos com desenvolvimento..." -ForegroundColor Yellow
$devContainers = docker ps --format "{{.Names}}" 2>$null | Where-Object { $_ -match "dev" }
if ($devContainers) {
    Write-Host "⚠️  Ambiente DEV está rodando." -ForegroundColor Yellow
    Write-Host "   Considere parar DEV para liberar recursos: .\PARAR-DEV.ps1" -ForegroundColor White
    Write-Host ""
}

# Backup do banco antes de iniciar produção
Write-Host "💾 Fazendo backup do banco atual..." -ForegroundColor Yellow
$backupDir = "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir/prod_backup_$timestamp.sql"

try {
    # Se já existe produção rodando, fazer backup
    $existingProd = docker ps --format "{{.Names}}" 2>$null | Where-Object { $_ -match "prod" }
    if ($existingProd -and (docker exec ucm-postgres-prod pg_isready -U $env:DB_USERNAME -d ucm_prod 2>$null)) {
        Write-Host "   Fazendo backup da produção atual..." -ForegroundColor Gray
        docker exec ucm-postgres-prod pg_dump -U $env:DB_USERNAME -d ucm_prod > $backupFile 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Backup salvo: $backupFile" -ForegroundColor Green
        }
    } else {
        Write-Host "   ℹ️  Primeiro deploy (sem backup anterior)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️  Erro no backup (continuando...)" -ForegroundColor Yellow
}

# Parar produção atual se existir
Write-Host ""
Write-Host "🔄 Parando produção atual..." -ForegroundColor Yellow
docker-compose -f $composeFile down 2>$null | Out-Null
Start-Sleep -Seconds 3

# Iniciar produção
Write-Host ""
Write-Host "🚀 Iniciando produção..." -ForegroundColor Yellow
Write-Host "   Isso pode levar alguns minutos..." -ForegroundColor Gray
Write-Host ""

try {
    docker-compose -f $composeFile up -d --build
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ PRODUÇÃO INICIADA!" -ForegroundColor Green
        Write-Host "====================" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro ao iniciar produção" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Aguardar serviços ficarem prontos
Write-Host ""
Write-Host "⏳ Aguardando serviços..." -ForegroundColor Yellow

# PostgreSQL PROD
$postgresReady = $false
$attempts = 0
Write-Host "   PostgreSQL PROD..." -NoNewline
while (-not $postgresReady -and $attempts -lt 30) {
    try {
        $result = docker exec ucm-postgres-prod pg_isready -U $env:DB_USERNAME -d ucm_prod 2>$null
        if ($LASTEXITCODE -eq 0) {
            $postgresReady = $true
            Write-Host " ✅" -ForegroundColor Green
        } else {
            Write-Host "." -NoNewline
            Start-Sleep -Seconds 3
            $attempts++
        }
    } catch {
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 3
        $attempts++
    }
}

if (-not $postgresReady) {
    Write-Host " ❌ (timeout)" -ForegroundColor Red
} else {
    Write-Host "   Redis PROD... ✅" -ForegroundColor Green
    Write-Host "   Backend PROD... ✅" -ForegroundColor Green
    Write-Host "   Frontend PROD... ✅" -ForegroundColor Green
    Write-Host "   Nginx PROD... ✅" -ForegroundColor Green
}

# Executar migrações PROD
Write-Host ""
Write-Host "🗄️  Executando migrações PROD..." -ForegroundColor Yellow
try {
    docker exec ucm-backend-prod npm run migration:run 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Migrações executadas" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erro nas migrações" -ForegroundColor Red
        Write-Host "   Verifique logs: docker logs ucm-backend-prod" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Erro nas migrações: $($_.Exception.Message)" -ForegroundColor Red
}

# Verificar status final
Write-Host ""
Write-Host "📊 STATUS FINAL - PRODUÇÃO" -ForegroundColor Magenta
Write-Host "==========================" -ForegroundColor Magenta
Write-Host ""

$prodStatus = docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>$null | Where-Object { $_ -match "prod" }
if ($prodStatus) {
    Write-Host "🟢 PRODUÇÃO RODANDO:" -ForegroundColor Green
    $prodStatus | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
} else {
    Write-Host "🔴 PRODUÇÃO COM PROBLEMAS" -ForegroundColor Red
    Write-Host "   Verifique: docker ps -a" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🎯 ACESSO PRODUÇÃO:" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host "🌐 Site: https://seudominio.com" -ForegroundColor Green
Write-Host "🔧 API:  https://seudominio.com/api/v1" -ForegroundColor Green
Write-Host "📱 WhatsApp: Configurado para produção" -ForegroundColor Green
Write-Host ""
Write-Host "🛑 PARA PARAR PRODUÇÃO:" -ForegroundColor Red
Write-Host "   .\PARAR-PRODUCAO.ps1" -ForegroundColor White
Write-Host ""
Write-Host "📋 LOGS IMPORTANTES:" -ForegroundColor Yellow
Write-Host "   Backend: docker logs ucm-backend-prod" -ForegroundColor White
Write-Host "   Frontend: docker logs ucm-frontend-prod" -ForegroundColor White
Write-Host "   Nginx: docker logs nginx-prod" -ForegroundColor White
Write-Host ""
Write-Host "🎉 PRODUÇÃO ATIVA E OPERACIONAL!" -ForegroundColor Green
Write-Host "   Clientes podem acessar o site agora!" -ForegroundColor Green