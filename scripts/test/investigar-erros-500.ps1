# Script para Investigar Erros 500
# Testa Stock Summary e Criar Pedido

$baseUrl = "http://localhost:3001/api/v1"
$tenantId = "00000000-0000-0000-0000-000000000000"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "INVESTIGACAO DE ERROS 500" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Criar usuario e obter token
Write-Host "[1/4] Criando usuario de teste..." -ForegroundColor Yellow
$testEmail = "investigacao-$(Get-Date -Format 'yyyyMMddHHmmss')@exemplo.com"
$registerBody = @{
    email = $testEmail
    password = "senha123"
    full_name = "Usuario Investigacao"
} | ConvertTo-Json

try {
    $authResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST `
        -Body $registerBody -ContentType "application/json" `
        -Headers @{"x-tenant-id"=$tenantId}
    $token = $authResponse.access_token
    Write-Host "✅ Usuario criado, token obtido" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Usuario ja existe, fazendo login..." -ForegroundColor Yellow
    $loginBody = @{
        email = $testEmail
        password = "senha123"
    } | ConvertTo-Json
    $authResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST `
        -Body $loginBody -ContentType "application/json"
    $token = $authResponse.access_token
    Write-Host "✅ Login realizado" -ForegroundColor Green
}

if (-not $token) {
    Write-Host "❌ Nao foi possivel obter token" -ForegroundColor Red
    exit 1
}

# 2. Testar Stock Summary
Write-Host ""
Write-Host "[2/4] Testando Stock Summary..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/products/stock-summary" -Method GET `
        -Headers @{"Authorization"="Bearer $token"} -ErrorAction Stop
    Write-Host "✅ Stock Summary OK" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Gray
    $content = $response.Content | ConvertFrom-Json
    Write-Host "Total produtos: $($content.total_products)" -ForegroundColor Gray
} catch {
    Write-Host "❌ ERRO no Stock Summary:" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    Write-Host "Mensagem: $($_.Exception.Message)" -ForegroundColor Yellow
    
    # Tentar ler response body
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        $reader.Close()
        $stream.Close()
        Write-Host "Response Body:" -ForegroundColor Cyan
        Write-Host $responseBody -ForegroundColor Gray
    } catch {
        Write-Host "Nao foi possivel ler response body: $($_.Exception.Message)" -ForegroundColor Gray
    }
}

# 3. Criar produto e estoque
Write-Host ""
Write-Host "[3/4] Criando produto para teste de pedido..." -ForegroundColor Yellow
$productBody = @{
    name = "Produto Teste Pedido $(Get-Date -Format 'HHmmss')"
    price = 10.50
    description = "Produto para testar criacao de pedido"
} | ConvertTo-Json

try {
    $product = Invoke-RestMethod -Uri "$baseUrl/products" -Method POST `
        -Body $productBody -ContentType "application/json" `
        -Headers @{"Authorization"="Bearer $token"}
    $productId = $product.id
    Write-Host "✅ Produto criado: $productId" -ForegroundColor Green
    
    # Adicionar estoque
    $stockSql = "INSERT INTO movimentacoes_estoque (tenant_id, produto_id, current_stock) VALUES ('$tenantId', '$productId', 100) ON CONFLICT (tenant_id, produto_id) DO UPDATE SET current_stock = 100;"
    $stockResult = docker exec ucm-postgres psql -U postgres -d ucm -c $stockSql 2>&1
    Write-Host "✅ Estoque adicionado (100 unidades)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao criar produto: $($_.Exception.Message)" -ForegroundColor Red
    $productId = $null
}

# 4. Testar criar pedido
if ($productId) {
    Write-Host ""
    Write-Host "[4/4] Testando criar pedido..." -ForegroundColor Yellow
    $orderBody = @{
        items = @(@{
            produto_id = $productId
            quantity = 2
            unit_price = 10.50
        })
        channel = "pdv"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/orders" -Method POST `
            -Body $orderBody -ContentType "application/json" `
            -Headers @{"Authorization"="Bearer $token"} -ErrorAction Stop
        Write-Host "✅ Pedido criado OK" -ForegroundColor Green
        Write-Host "Status: $($response.StatusCode)" -ForegroundColor Gray
        $content = $response.Content | ConvertFrom-Json
        Write-Host "Pedido ID: $($content.id)" -ForegroundColor Gray
        Write-Host "Total: R$ $($content.total)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ ERRO ao criar pedido:" -ForegroundColor Red
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
        Write-Host "Mensagem: $($_.Exception.Message)" -ForegroundColor Yellow
        
        # Tentar ler response body
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $responseBody = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            Write-Host "Response Body:" -ForegroundColor Cyan
            Write-Host $responseBody -ForegroundColor Gray
        } catch {
            Write-Host "Nao foi possivel ler response body: $($_.Exception.Message)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host ""
    Write-Host "[4/4] ⏭️  Pulando teste de pedido (produto nao criado)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "INVESTIGACAO CONCLUIDA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
