#!/usr/bin/env powershell
# Script de validação de RLS em ambiente de desenvolvimento local
# Uso: powershell -ExecutionPolicy Bypass -File deploy/scripts/validate-rls-dev.ps1

Write-Host "=== Validação de RLS em Ambiente de Desenvolvimento ===" -ForegroundColor Green
Write-Host "Data: $(Get-Date)"
Write-Host "Ambiente: LOCAL (Windows)"
Write-Host ""

# Verificar se containers estão rodando
Write-Host "1. Verificando status dos containers..." -ForegroundColor Yellow
$containers = docker ps --format "table {{.Names}}\t{{.Status}}"
if ($containers -match "ucm-postgres") {
    Write-Host "✅ Container do PostgreSQL está rodando" -ForegroundColor Green
} else {
    Write-Host "❌ Container do PostgreSQL não está rodando" -ForegroundColor Red
    Write-Host "Execute: .\INICIAR-AMBIENTE.ps1" -ForegroundColor Yellow
    exit 1
}

if ($containers -match "ucm-redis") {
    Write-Host "✅ Container do Redis está rodando" -ForegroundColor Green
} else {
    Write-Host "❌ Container do Redis não está rodando" -ForegroundColor Red
    Write-Host "Execute: .\INICIAR-AMBIENTE.ps1" -ForegroundColor Yellow
    exit 1
}

# 2. Testar login com tenant correto
Write-Host ""
Write-Host "2. Testando login com tenant correto..." -ForegroundColor Yellow
$tenantId = "00000000-0000-0000-0000-000000000000"
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/auth/login" -Method Post -Headers @{
    "Content-Type" = "application/json"
    "x-tenant-id" = $tenantId
} -Body @{
    email = "dev@gtsofthub.com.br"
    password = "12345678"
} | ConvertTo-Json -Depth 10

if ($loginResponse -match "access_token") {
    Write-Host "✅ Login com tenant correto funcionou" -ForegroundColor Green
    $jwtToken = ($loginResponse | ConvertFrom-Json).access_token
} else {
    Write-Host "❌ Falha no login com tenant correto" -ForegroundColor Red
    Write-Host "Resposta: $loginResponse" -ForegroundColor Red
    exit 1
}

# 3. Testar acesso a dados do tenant com JWT
Write-Host ""
Write-Host "3. Testando acesso a dados do tenant com JWT..." -ForegroundColor Yellow
$userProfile = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/auth/me" -Method Get -Headers @{
    "Authorization" = "Bearer $jwtToken"
    "x-tenant-id" = $tenantId
} | ConvertTo-Json -Depth 10

if ($userProfile -match "tenant_id") {
    Write-Host "✅ Acesso a perfil de usuário funcionou" -ForegroundColor Green
    $tenantIdProfile = ($userProfile | ConvertFrom-Json).tenant_id
    Write-Host "Tenant ID no perfil: $tenantIdProfile" -ForegroundColor Cyan
} else {
    Write-Host "❌ Falha no acesso a perfil de usuário" -ForegroundColor Red
    Write-Host "Resposta: $userProfile" -ForegroundColor Red
    exit 1
}

# 4. Testar webhook do WhatsApp com tenant correto
Write-Host ""
Write-Host "4. Testando webhook do WhatsApp com tenant correto..." -ForegroundColor Yellow
$whatsappResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/whatsapp/webhook" -Method Post -Headers @{
    "Content-Type" = "application/json"
    "x-tenant-id" = $tenantId
} -Body @{
    tenantId = $tenantId
    From = "5511999999999"
    Body = "Olá, quero comprar um produto"
    Timestamp = (Get-Date -Format "o")
    MessageSid = "test-message-id"
} | ConvertTo-Json -Depth 10

if ($whatsappResponse -match "success") {
    Write-Host "✅ Webhook do WhatsApp com tenant correto funcionou" -ForegroundColor Green
} else {
    Write-Host "❌ Falha no webhook do WhatsApp" -ForegroundColor Red
    Write-Host "Resposta: $whatsappResponse" -ForegroundColor Red
    exit 1
}

# 5. Testar webhook do Mercado Pago com tenant correto
Write-Host ""
Write-Host "5. Testando webhook do Mercado Pago com tenant correto..." -ForegroundColor Yellow
# Criar um pagamento primeiro
$paymentResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/payments/public" -Method Post -Headers @{
    "Content-Type" = "application/json"
    "x-tenant-id" = $tenantId
} -Body @{
    pedidoId = "test-pedido-id"
    method = "pix"
    amount = 100.00
} | ConvertTo-Json -Depth 10

if ($paymentResponse -match "transaction_id") {
    Write-Host "✅ Pagamento criado" -ForegroundColor Green
    $transactionId = ($paymentResponse | ConvertFrom-Json).transaction_id
    Write-Host "Transaction ID: $transactionId" -ForegroundColor Cyan

    # Simular webhook do Mercado Pago
    $webhookResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/payments/webhook/mercadopago" -Method Post -Headers @{
        "Content-Type" = "application/json"
        "x-signature" = "test-signature"
        "x-request-id" = "test-request-id"
        "x-webhook-token" = "test-token"
    } -Body @{
        data = @{
            id = $transactionId
            status = "paid"
            status_detail = "accredited"
            payment_method_id = "pix"
            external_reference = $tenantId
        }
        live_mode = $false
        type = "payment"
    } | ConvertTo-Json -Depth 10

    if ($webhookResponse -match "status.*ok") {
        Write-Host "✅ Webhook do Mercado Pago com tenant correto funcionou" -ForegroundColor Green
    } else {
        Write-Host "❌ Falha no webhook do Mercado Pago" -ForegroundColor Red
        Write-Host "Resposta: $webhookResponse" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Falha ao criar pagamento para teste de webhook" -ForegroundColor Red
    exit 1
}

# 6. Testar isolamento de tenant
Write-Host ""
Write-Host "6. Testando isolamento de tenant..." -ForegroundColor Yellow
$otherTenantId = "11111111-1111-1111-1111-111111111111"

# Tentar acessar dados do outro tenant com JWT do tenant original
try {
    $attemptResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/auth/me" -Method Get -Headers @{
        "Authorization" = "Bearer $jwtToken"
        "x-tenant-id" = $otherTenantId
    }
    Write-Host "❌ Isolamento de tenant falhou - acesso permitido para tenant incorreto" -ForegroundColor Red
    exit 1
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ Isolamento de tenant funcionou - acesso negado para tenant incorreto" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro inesperado ao testar isolamento de tenant: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# 7. Verificar logs do backend
Write-Host ""
Write-Host "7. Verificando logs do backend por erros de RLS..." -ForegroundColor Yellow
if (Test-Path "backend/logs") {
    $logs = Get-Content "backend/logs/*.log" -Tail 100 -ErrorAction SilentlyContinue | Out-String
    if ($logs -match "RLS|set_config|current_tenant_id") {
        Write-Host "⚠️  Encontrados logs relacionados a RLS (verificar se são erros)" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Nenhum erro de RLS encontrado nos logs recentes" -ForegroundColor Green
    }
} else {
    Write-Host "ℹ️  Diretório de logs não encontrado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Validação de RLS em Ambiente de Desenvolvimento Concluída ===" -ForegroundColor Green
Write-Host "Todos os testes passaram! O RLS está funcionando corretamente." -ForegroundColor Green