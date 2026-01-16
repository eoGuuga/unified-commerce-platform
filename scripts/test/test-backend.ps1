# Script para Testar Backend
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Testando Backend - UCM Platform" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Garantir TLS 1.2 para chamadas HTTPS
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$baseUrl = $env:BASE_URL
if ([string]::IsNullOrWhiteSpace($baseUrl)) {
    $baseUrl = "http://localhost:3001/api/v1"
}
$tenantId = $env:TENANT_ID
if ([string]::IsNullOrWhiteSpace($tenantId)) {
    $tenantId = "00000000-0000-0000-0000-000000000000"
}
$tenantHeader = @{ "x-tenant-id" = $tenantId }

# Helper: invoke with basic parsing and show response body on error
function Invoke-UcmRequest {
    param(
        [string]$Uri,
        [string]$Method,
        $Body,
        [hashtable]$Headers,
        [string]$ContentType = "application/json"
    )
    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            Headers = $Headers
            ErrorAction = "Stop"
            UseBasicParsing = $true
        }
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = $ContentType
        }
        return Invoke-WebRequest @params
    } catch {
        Write-Host "  Detalhes: $($_.Exception.Message)" -ForegroundColor Gray
        if ($_.Exception.Response) {
            try {
                $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
                $respBody = $reader.ReadToEnd()
                if ($respBody) {
                    Write-Host "  Resposta: $respBody" -ForegroundColor Gray
                }
            } catch {
                # ignore read errors
            }
        }
        throw
    }
}

# Test 1: Health Check
Write-Host "[1/6] Testando Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-UcmRequest -Uri "$baseUrl/health" -Method GET -Headers $tenantHeader
    Write-Host "SUCESSO: Backend esta rodando!" -ForegroundColor Green
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "ERRO: Backend nao esta respondendo. Certifique-se de rodar: cd backend && npm run start:dev" -ForegroundColor Red
    exit 1
}

# Test 2: Registrar Usuario
Write-Host "[2/6] Registrando usuario de teste..." -ForegroundColor Yellow
$registerBody = @{
    email = "teste@exemplo.com"
    password = "senha123"
    full_name = "Usuario Teste"
} | ConvertTo-Json

try {
    $response = Invoke-UcmRequest -Uri "$baseUrl/auth/register" -Method POST -Body $registerBody -Headers $tenantHeader
    $tokenData = $response.Content | ConvertFrom-Json
    $token = $tokenData.access_token
    Write-Host "SUCESSO: Usuario criado!" -ForegroundColor Green
    Write-Host "  Token recebido: $($token.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "AVISO: Usuario pode ja existir. Tentando login..." -ForegroundColor Yellow
    try {
        $loginBody = @{
            email = "teste@exemplo.com"
            password = "senha123"
        } | ConvertTo-Json
        $response = Invoke-UcmRequest -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -Headers $tenantHeader
        $tokenData = $response.Content | ConvertFrom-Json
        $token = $tokenData.access_token
        Write-Host "SUCESSO: Login realizado!" -ForegroundColor Green
    } catch {
        Write-Host "ERRO: Nao foi possivel autenticar" -ForegroundColor Red
        exit 1
    }
}

# Test 2.1: Verificar token (me)
Write-Host "[2.1/6] Verificando token (auth/me)..." -ForegroundColor Yellow
try {
    Invoke-UcmRequest -Uri "$baseUrl/auth/me" -Method GET -Headers (@{"Authorization"="Bearer $token"} + $tenantHeader) | Out-Null
    Write-Host "SUCESSO: Token valido!" -ForegroundColor Green
} catch {
    Write-Host "ERRO: Token invalido" -ForegroundColor Red
    exit 1
}

# Test 3: Listar Produtos (com token)
Write-Host "[3/6] Listando produtos..." -ForegroundColor Yellow
try {
    $authHeaders = $tenantHeader
    if ($token) {
        $authHeaders = @{"Authorization"="Bearer $token"} + $tenantHeader
    }
    $response = Invoke-UcmRequest -Uri "$baseUrl/products" -Method GET -Headers $authHeaders
    Write-Host "SUCESSO: Produtos listados!" -ForegroundColor Green
    $products = $response.Content | ConvertFrom-Json
    if ($products -is [System.Array]) {
        Write-Host "  Total de produtos: $($products.Count)" -ForegroundColor Gray
    } elseif ($products.data) {
        $count = if ($products.total -ne $null) { $products.total } else { $products.data.Count }
        Write-Host "  Total de produtos: $count" -ForegroundColor Gray
    } else {
        Write-Host "  Total de produtos: 0" -ForegroundColor Gray
    }
} catch {
    Write-Host "AVISO: Nao foi possivel listar produtos (verifique autenticacao)" -ForegroundColor Yellow
}

# Test 4: Criar Produto
Write-Host "[4/6] Criando produto de teste..." -ForegroundColor Yellow
$productBody = @{
    name = "Brigadeiro Gourmet Teste"
    price = 10.50
    description = "Produto criado automaticamente pelo script de teste"
} | ConvertTo-Json

try {
    $response = Invoke-UcmRequest -Uri "$baseUrl/products" -Method POST -Body $productBody -Headers (@{"Authorization"="Bearer $token"} + $tenantHeader)
    $product = $response.Content | ConvertFrom-Json
    $productId = $product.id
    Write-Host "SUCESSO: Produto criado!" -ForegroundColor Green
    Write-Host "  ID: $productId" -ForegroundColor Gray
    Write-Host "  Nome: $($product.name)" -ForegroundColor Gray
} catch {
    Write-Host "ERRO: Nao foi possivel criar produto" -ForegroundColor Red
}

# Test 5: Buscar Produto
if ($productId) {
    Write-Host "[5/6] Buscando produto criado..." -ForegroundColor Yellow
    try {
        $response = Invoke-UcmRequest -Uri "$baseUrl/products/$productId" -Method GET -Headers (@{"Authorization"="Bearer $token"} + $tenantHeader)
        Write-Host "SUCESSO: Produto encontrado!" -ForegroundColor Green
    } catch {
        Write-Host "ERRO: Nao foi possivel buscar produto" -ForegroundColor Red
    }
}

# Test 6: Criar Pedido (se produto existe)
if ($productId) {
    Write-Host "[6/6] Ajustando estoque e criando pedido..." -ForegroundColor Yellow
    $adjustStockBody = @{
        quantity = 50
        reason = "Teste automatizado"
    } | ConvertTo-Json
    try {
        Invoke-UcmRequest -Uri "$baseUrl/products/$productId/adjust-stock" -Method POST -Body $adjustStockBody -Headers (@{"Authorization"="Bearer $token"} + $tenantHeader) | Out-Null
        Write-Host "SUCESSO: Estoque ajustado!" -ForegroundColor Green
    } catch {
        Write-Host "ERRO: Nao foi possivel ajustar estoque" -ForegroundColor Red
        exit 1
    }

    $orderBody = @{
        channel = "whatsapp"
        items = @(
            @{
                produto_id = $productId
                quantity = 2
                unit_price = 10.50
            }
        )
        customer_name = "Cliente Teste"
        customer_phone = "5511999999999"
        delivery_type = "pickup"
        shipping_amount = 0
        discount_amount = 0
    } | ConvertTo-Json -Depth 5
    try {
        $response = Invoke-UcmRequest -Uri "$baseUrl/orders" -Method POST -Body $orderBody -Headers (@{"Authorization"="Bearer $token"} + $tenantHeader)
        $order = $response.Content | ConvertFrom-Json
        $orderId = $order.id
        Write-Host "SUCESSO: Pedido criado!" -ForegroundColor Green
        Write-Host "  Pedido: $($order.order_no)" -ForegroundColor Gray
    } catch {
        Write-Host "ERRO: Nao foi possivel criar pedido" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[6/6] Pulando teste de pedido (produto nao criado)" -ForegroundColor Yellow
}

# Teste extra: Listar pedidos e relatorio
Write-Host "[6.1/6] Listando pedidos..." -ForegroundColor Yellow
try {
    $response = Invoke-UcmRequest -Uri "$baseUrl/orders" -Method GET -Headers (@{"Authorization"="Bearer $token"} + $tenantHeader)
    $orders = $response.Content | ConvertFrom-Json
    $orderCount = if ($orders -is [System.Array]) { $orders.Count } elseif ($orders.data) { $orders.data.Count } else { 0 }
    Write-Host "SUCESSO: Pedidos listados! Total: $orderCount" -ForegroundColor Green
} catch {
    Write-Host "AVISO: Nao foi possivel listar pedidos" -ForegroundColor Yellow
}

Write-Host "[6.2/6] Relatorio de vendas..." -ForegroundColor Yellow
try {
    Invoke-UcmRequest -Uri "$baseUrl/orders/reports/sales" -Method GET -Headers (@{"Authorization"="Bearer $token"} + $tenantHeader) | Out-Null
    Write-Host "SUCESSO: Relatorio de vendas gerado!" -ForegroundColor Green
} catch {
    Write-Host "AVISO: Nao foi possivel gerar relatorio" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "Testes Concluidos!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Token de autenticacao:" -ForegroundColor Cyan
Write-Host $token -ForegroundColor White
Write-Host ""
Write-Host "Voce pode usar este token para testar endpoints protegidos" -ForegroundColor Gray
Write-Host ""
