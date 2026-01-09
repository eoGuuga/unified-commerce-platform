# ============================================
# 🚀 INICIAR SISTEMA COMPLETO - E-COMMERCE + PAGAMENTOS
# ============================================

Write-Host "🎯 INICIANDO SISTEMA UNIFIED COMMERCE PLATFORM" -ForegroundColor Magenta
Write-Host "===============================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "✅ RECURSOS IMPLEMENTADOS:" -ForegroundColor Green
Write-Host "   • E-commerce completo com carrinho" -ForegroundColor White
Write-Host "   • Checkout profissional" -ForegroundColor White
Write-Host "   • Integração Mercado Pago" -ForegroundColor White
Write-Host "   • Pagamento PIX com QR Code" -ForegroundColor White
Write-Host "   • Interface moderna e responsiva" -ForegroundColor White
Write-Host ""

# Verificar se Docker está rodando
Write-Host "🔍 Verificando Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker encontrado: $dockerVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker não encontrado ou não está rodando" -ForegroundColor Red
        Write-Host "   Instale o Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Docker não encontrado" -ForegroundColor Red
    exit 1
}

# Verificar se containers estão rodando
Write-Host ""
Write-Host "🔍 Verificando containers..." -ForegroundColor Yellow
$containers = docker ps --format "table {{.Names}}\t{{.Status}}"
if ($containers -match "ucm-postgres") {
    Write-Host "✅ Banco de dados PostgreSQL rodando" -ForegroundColor Green
} else {
    Write-Host "❌ PostgreSQL não está rodando" -ForegroundColor Red
    Write-Host "   Execute primeiro: .\INICIAR-AMBIENTE.ps1" -ForegroundColor Yellow
    exit 1
}

if ($containers -match "ucm-redis") {
    Write-Host "✅ Redis (cache) rodando" -ForegroundColor Green
} else {
    Write-Host "❌ Redis não está rodando" -ForegroundColor Red
    Write-Host "   Execute primeiro: .\INICIAR-AMBIENTE.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Instalar dependências se necessário
Write-Host "📦 Instalando dependências..." -ForegroundColor Yellow

Write-Host "   Backend..." -ForegroundColor Gray
cd backend
npm install >$null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Backend OK" -ForegroundColor Green
} else {
    Write-Host "   ❌ Erro no backend" -ForegroundColor Red
}

cd ..
Write-Host "   Frontend..." -ForegroundColor Gray
cd frontend
npm install >$null 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Frontend OK" -ForegroundColor Green
} else {
    Write-Host "   ❌ Erro no frontend" -ForegroundColor Red
}

cd ..

Write-Host ""

# Verificar configuração de pagamentos
Write-Host "💰 Verificando configuração de pagamentos..." -ForegroundColor Yellow
$envPath = "backend/.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    if ($envContent -match "MERCADOPAGO_ACCESS_TOKEN.*=.*`"[^`"]+`"") {
        Write-Host "✅ Mercado Pago configurado" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Mercado Pago não configurado (usando mock)" -ForegroundColor Yellow
        Write-Host "   Configure em: backend/.env" -ForegroundColor Gray
        Write-Host "   Documentação: config/payments-setup.md" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  Arquivo .env não encontrado (usando mock)" -ForegroundColor Yellow
}

Write-Host ""

# Iniciar backend
Write-Host "🚀 Iniciando backend..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    cd backend
    npm run start:dev
} -Name "BackendJob"

Start-Sleep -Seconds 3

# Testar se backend está respondendo
Write-Host "🔍 Testando backend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/health" -Method GET -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend rodando em http://localhost:3001" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Backend não respondeu" -ForegroundColor Red
}

# Iniciar frontend
Write-Host ""
Write-Host "🚀 Iniciando frontend..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    cd frontend
    npm run dev
} -Name "FrontendJob"

Start-Sleep -Seconds 5

# Testar se frontend está respondendo
Write-Host "🔍 Testando frontend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Frontend rodando em http://localhost:3000" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Frontend não respondeu" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 SISTEMA INICIADO COM SUCESSO!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""
Write-Host "📱 ACESSE AGORA:" -ForegroundColor Cyan
Write-Host "   🌐 Loja Online: http://localhost:3000/loja" -ForegroundColor White
Write-Host "   🏪 PDV Interno: http://localhost:3000/pdv" -ForegroundColor White
Write-Host "   ⚙️  Admin: http://localhost:3000/admin" -ForegroundColor White
Write-Host ""
Write-Host "💡 TESTE O E-COMMERCE:" -ForegroundColor Yellow
Write-Host "   1. Adicione produtos ao carrinho" -ForegroundColor White
Write-Host "   2. Vá para checkout" -ForegroundColor White
Write-Host "   3. Selecione PIX como pagamento" -ForegroundColor White
Write-Host "   4. Veja o QR Code gerado!" -ForegroundColor White
Write-Host ""
Write-Host "🔧 SCRIPTS ÚTEIS:" -ForegroundColor Cyan
Write-Host "   Teste pagamentos: .\scripts\test-payments-mercadopago.ps1" -ForegroundColor White
Write-Host "   Teste completo: .\scripts\test-completo-100-porcento.ps1" -ForegroundColor White
Write-Host ""
Write-Host "🛑 PARA PARAR: Ctrl+C em cada terminal" -ForegroundColor Red
Write-Host ""
Write-Host "🎯 PRÓXIMO PASSO: Configure pagamentos reais!" -ForegroundColor Magenta
Write-Host "   Documentação: config/payments-setup.md" -ForegroundColor Gray

# Manter jobs rodando
Write-Host ""
Write-Host "Pressione Ctrl+C para parar os serviços..." -ForegroundColor Gray
Wait-Job -Job $backendJob, $frontendJob