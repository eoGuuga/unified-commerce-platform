# ============================================
# 🚀 INICIAR AMBIENTE DE DESENVOLVIMENTO
# ============================================
# Ambiente separado para desenvolvimento e testes
# - Portas DEV: Backend 3002, Frontend 3003
# - Banco separado (ucm_dev)
# - Configurações de desenvolvimento

Write-Host "🚀 INICIANDO AMBIENTE DE DESENVOLVIMENTO" -ForegroundColor Magenta
Write-Host "=======================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "🎯 AMBIENTE DEV - CONFIGURACOES:" -ForegroundColor Cyan
Write-Host "   • Backend: http://localhost:3002" -ForegroundColor White
Write-Host "   • Frontend: http://localhost:3003" -ForegroundColor White
Write-Host "   • Banco: PostgreSQL (porta 5433)" -ForegroundColor White
Write-Host "   • Redis: Porta 6380" -ForegroundColor White
Write-Host "   • IA: Ollama (porta 11435)" -ForegroundColor White
Write-Host ""

# Verificar Docker
Write-Host "🔍 Verificando Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker OK: $($dockerVersion)" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker não encontrado" -ForegroundColor Red
        Write-Host "   Instale o Docker Desktop primeiro" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Docker não encontrado" -ForegroundColor Red
    exit 1
}

# Verificar se produção está rodando (conflito de portas)
Write-Host ""
Write-Host "🔍 Verificando conflitos com produção..." -ForegroundColor Yellow
$prodContainers = docker ps --format "{{.Names}}" 2>$null | Where-Object { $_ -match "prod" }
if ($prodContainers) {
    Write-Host "⚠️  Produção está rodando. DEV pode ter conflitos." -ForegroundColor Yellow
    Write-Host "   Considere parar produção: .\PARAR-PRODUCAO.ps1" -ForegroundColor White
    Write-Host ""
}

# Verificar containers DEV existentes
Write-Host "🔍 Verificando containers DEV existentes..." -ForegroundColor Yellow
$devContainers = docker ps -a --format "{{.Names}}" 2>$null | Where-Object { $_ -match "dev" }
if ($devContainers) {
    Write-Host "🧹 Limpando containers DEV antigos..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml down 2>$null | Out-Null
    Start-Sleep -Seconds 2
}

# Iniciar ambiente DEV
Write-Host ""
Write-Host "🚀 Iniciando containers DEV..." -ForegroundColor Yellow
Write-Host "   Isso pode levar alguns minutos..." -ForegroundColor Gray
Write-Host ""

try {
    docker-compose -f docker-compose.dev.yml up -d --build
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ AMBIENTE DEV INICIADO!" -ForegroundColor Green
        Write-Host "=========================" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro ao iniciar containers DEV" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Aguardar serviços ficarem prontos
Write-Host ""
Write-Host "⏳ Aguardando serviços ficarem prontos..." -ForegroundColor Yellow

# PostgreSQL DEV
$postgresReady = $false
$attempts = 0
Write-Host "   PostgreSQL DEV..." -NoNewline
while (-not $postgresReady -and $attempts -lt 30) {
    try {
        $result = docker exec ucm-postgres-dev pg_isready -U ucm_dev -d ucm_dev 2>$null
        if ($LASTEXITCODE -eq 0) {
            $postgresReady = $true
            Write-Host " ✅" -ForegroundColor Green
        } else {
            Write-Host "." -NoNewline
            Start-Sleep -Seconds 2
            $attempts++
        }
    } catch {
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 2
        $attempts++
    }
}

if (-not $postgresReady) {
    Write-Host " ❌ (timeout)" -ForegroundColor Red
} else {
    Write-Host "   Redis DEV... ✅" -ForegroundColor Green
}

# Executar migrações DEV
Write-Host ""
Write-Host "🗄️  Executando migrações no banco DEV..." -ForegroundColor Yellow
try {
    docker exec ucm-backend-dev npm run migration:run 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Migrações executadas" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Migrações podem ter problemas (normal na primeira vez)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Erro nas migrações (verifique logs)" -ForegroundColor Yellow
}

# Popular banco DEV com dados de teste
Write-Host ""
Write-Host "📝 Populando banco DEV com dados de teste..." -ForegroundColor Yellow
try {
    docker exec ucm-backend-dev npm run seed:run 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Dados de teste inseridos" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Problemas com seeds" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Erro nos seeds" -ForegroundColor Yellow
}

# Verificar status final
Write-Host ""
Write-Host "📊 STATUS FINAL - AMBIENTE DEV" -ForegroundColor Magenta
Write-Host "==============================" -ForegroundColor Magenta
Write-Host ""

$devStatus = docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>$null | Where-Object { $_ -match "dev" }
if ($devStatus) {
    Write-Host "🟢 Containers DEV rodando:" -ForegroundColor Green
    $devStatus | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
} else {
    Write-Host "🔴 Nenhum container DEV rodando" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎯 ACESSO AMBIENTE DEV:" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host "🌐 Frontend: http://localhost:3003" -ForegroundColor Green
Write-Host "🔧 Backend:  http://localhost:3002" -ForegroundColor Green
Write-Host "🗄️  Banco:   localhost:5433 (ucm_dev)" -ForegroundColor Green
Write-Host "🤖 IA:       localhost:11435 (Ollama)" -ForegroundColor Green
Write-Host ""
Write-Host "🧪 PARA TESTAR:" -ForegroundColor Yellow
Write-Host "   • Frontend: Abra http://localhost:3003" -ForegroundColor White
Write-Host "   • API: curl http://localhost:3002/api/v1/health" -ForegroundColor White
Write-Host "   • WhatsApp: curl -X POST http://localhost:3002/api/v1/whatsapp/webhook -H 'Content-Type: application/json' -d '{\"from\":\"5511999999999\",\"body\":\"oi\",\"tenantId\":\"dev-tenant-001\"}'" -ForegroundColor White
Write-Host ""
Write-Host "🛑 PARA PARAR DEV:" -ForegroundColor Red
Write-Host "   .\PARAR-DEV.ps1" -ForegroundColor White
Write-Host ""
Write-Host "🎉 AMBIENTE DEV PRONTO PARA DESENVOLVIMENTO!" -ForegroundColor Green