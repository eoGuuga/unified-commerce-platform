# Script para Testar Backend
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Testando Backend - UCM Platform" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3001/api/v1"
$tenantId = "00000000-0000-0000-0000-000000000000"

# Test 1: Health Check
Write-Host "[1/6] Testando Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET -ErrorAction Stop
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
    $response = Invoke-WebRequest -Uri "$baseUrl/auth/register" -Method POST -Body $registerBody -ContentType "application/json" -Headers @{"x-tenant-id"=$tenantId} -ErrorAction Stop
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
        $response = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -ErrorAction Stop
        $tokenData = $response.Content | ConvertFrom-Json
        $token = $tokenData.access_token
        Write-Host "SUCESSO: Login realizado!" -ForegroundColor Green
    } catch {
        Write-Host "ERRO: Nao foi possivel autenticar" -ForegroundColor Red
        exit 1
    }
}

# Test 3: Listar Produtos
Write-Host "[3/6] Listando produtos..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/products?tenantId=$tenantId" -Method GET -ErrorAction Stop
    Write-Host "SUCESSO: Produtos listados!" -ForegroundColor Green
    $products = $response.Content | ConvertFrom-Json
    Write-Host "  Total de produtos: $($products.Count)" -ForegroundColor Gray
} catch {
    Write-Host "AVISO: Nenhum produto encontrado (esperado se ainda nao criou nenhum)" -ForegroundColor Yellow
}

# Test 4: Criar Produto
Write-Host "[4/6] Criando produto de teste..." -ForegroundColor Yellow
$productBody = @{
    name = "Brigadeiro Gourmet Teste"
    price = 10.50
    description = "Produto criado automaticamente pelo script de teste"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/products?tenantId=$tenantId" -Method POST -Body $productBody -ContentType "application/json" -Headers @{"Authorization"="Bearer $token"} -ErrorAction Stop
    $product = $response.Content | ConvertFrom-Json
    $productId = $product.id
    Write-Host "SUCESSO: Produto criado!" -ForegroundColor Green
    Write-Host "  ID: $productId" -ForegroundColor Gray
    Write-Host "  Nome: $($product.name)" -ForegroundColor Gray
} catch {
    Write-Host "ERRO: Nao foi possivel criar produto" -ForegroundColor Red
    Write-Host "  Detalhes: $($_.Exception.Message)" -ForegroundColor Gray
}

# Test 5: Buscar Produto
if ($productId) {
    Write-Host "[5/6] Buscando produto criado..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/products/$productId?tenantId=$tenantId" -Method GET -Headers @{"Authorization"="Bearer $token"} -ErrorAction Stop
        Write-Host "SUCESSO: Produto encontrado!" -ForegroundColor Green
    } catch {
        Write-Host "ERRO: Nao foi possivel buscar produto" -ForegroundColor Red
    }
}

# Test 6: Criar Pedido (se produto existe)
if ($productId) {
    Write-Host "[6/6] Testando criacao de pedido..." -ForegroundColor Yellow
    Write-Host "AVISO: Para criar pedido, precisa cadastrar estoque primeiro no banco" -ForegroundColor Yellow
    $sqlCmd = "docker exec -i ucm-postgres psql -U postgres -d ucm -c `"INSERT INTO movimentacoes_estoque (tenant_id, produto_id, current_stock) VALUES ('$tenantId', '$productId', 100) ON CONFLICT DO NOTHING;`""
    Write-Host "Execute: $sqlCmd" -ForegroundColor Gray
} else {
    Write-Host "[6/6] Pulando teste de pedido (produto nao criado)" -ForegroundColor Yellow
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
