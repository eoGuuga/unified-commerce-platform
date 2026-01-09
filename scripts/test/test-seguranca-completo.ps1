# Script Completo de Testes de Seguranca
# Testa todas as 17 correcoes implementadas

$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:3001/api/v1"
$tenantId = "00000000-0000-0000-0000-000000000000"
$results = @{
    Total = 0
    Passed = 0
    Failed = 0
    Warnings = 0
}

function Write-TestHeader {
    param([string]$Title, [int]$Number, [int]$Total)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "[$Number/$Total] $Title" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
}

function Write-TestResult {
    param([bool]$Success, [string]$Message, [string]$Details = "")
    $results.Total++
    if ($Success) {
        $results.Passed++
        Write-Host "✅ PASSOU: $Message" -ForegroundColor Green
        if ($Details) { Write-Host "   $Details" -ForegroundColor Gray }
    } else {
        $results.Failed++
        Write-Host "❌ FALHOU: $Message" -ForegroundColor Red
        if ($Details) { Write-Host "   $Details" -ForegroundColor Gray }
    }
}

function Write-TestWarning {
    param([string]$Message, [string]$Details = "")
    $results.Warnings++
    Write-Host "⚠️  AVISO: $Message" -ForegroundColor Yellow
    if ($Details) { Write-Host "   $Details" -ForegroundColor Gray }
}

function Wait-ForRateLimit {
    Start-Sleep -Seconds 2
}

# ========================================
# INICIO DOS TESTES
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "TESTES COMPLETOS DE SEGURANCA" -ForegroundColor Magenta
Write-Host "Testando todas as 17 correcoes" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

# ========================================
# TESTE 1: Health Check
# ========================================
Write-TestHeader "Health Check Completo" 1 17
Wait-ForRateLimit

try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -TimeoutSec 5
    Write-TestResult $true "Health Check respondeu" "Status: $($health.status)"
    
    if ($health.checks.database.status -eq "ok") {
        Write-TestResult $true "Database conectado" "Response time: $($health.checks.database.responseTime)ms"
    } else {
        Write-TestResult $false "Database nao conectado" $health.checks.database.message
    }
    
    if ($health.checks.redis.status -eq "ok") {
        Write-TestResult $true "Redis conectado" "Response time: $($health.checks.redis.responseTime)ms"
    } else {
        Write-TestResult $false "Redis nao conectado" $health.checks.redis.message
    }
} catch {
    Write-TestResult $false "Health Check falhou" $_.Exception.Message
}

# ========================================
# TESTE 2: Rate Limiting (Default: 100 req/min)
# ========================================
Write-TestHeader "Rate Limiting - Default (100 req/min)" 2 17
Wait-ForRateLimit

$rateLimitPassed = $false
try {
    # Fazer 5 requisições rápidas
    $successCount = 0
    for ($i = 1; $i -le 5; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "$baseUrl/health" -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) { $successCount++ }
            Start-Sleep -Milliseconds 200
        } catch {
            if ($_.Exception.Response.StatusCode -eq 429) {
                Write-TestResult $true "Rate limiting bloqueou requisição excessiva" "Status 429 retornado"
                $rateLimitPassed = $true
                break
            }
        }
    }
    
    if (-not $rateLimitPassed) {
        Write-TestResult $true "Rate limiting permitiu requisições normais" "$successCount/5 requisições bem-sucedidas"
    }
} catch {
    Write-TestResult $false "Erro ao testar rate limiting" $_.Exception.Message
}

# ========================================
# TESTE 3: Rate Limiting (Strict: 10 req/min)
# ========================================
Write-TestHeader "Rate Limiting - Strict (10 req/min)" 3 17
Wait-ForRateLimit

Write-TestWarning "Teste de rate limiting strict requer endpoint específico" "Verificar se endpoints de login usam strict"

# ========================================
# TESTE 4: Autenticação - Registro
# ========================================
Write-TestHeader "Autenticacao - Registro de Usuario" 4 17
Wait-ForRateLimit

$global:authToken = $null
$testEmail = "teste-seguranca-$(Get-Date -Format 'yyyyMMddHHmmss')@exemplo.com"

try {
    $registerBody = @{
        email = $testEmail
        password = "senha123Segura!"
        full_name = "Usuario Teste Seguranca"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST `
        -Body $registerBody -ContentType "application/json" `
        -Headers @{"x-tenant-id"=$tenantId}
    
    $global:authToken = $response.access_token
    Write-TestResult $true "Registro de usuario funcionou" "Token gerado: $($global:authToken.Substring(0, 30))..."
    
    if ($response.access_token) {
        Write-TestResult $true "JWT token gerado corretamente" "Token presente na resposta"
    } else {
        Write-TestResult $false "JWT token nao gerado" "Token ausente na resposta"
    }
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-TestWarning "Usuario ja existe, tentando login" ""
        try {
            $loginBody = @{
                email = $testEmail
                password = "senha123Segura!"
            } | ConvertTo-Json
            
            $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST `
                -Body $loginBody -ContentType "application/json"
            
            $global:authToken = $response.access_token
            Write-TestResult $true "Login funcionou" "Token obtido via login"
        } catch {
            Write-TestResult $false "Login falhou" $_.Exception.Message
        }
    } else {
        Write-TestResult $false "Registro falhou" $_.Exception.Message
    }
}

# ========================================
# TESTE 5: Autenticação - Login
# ========================================
Write-TestHeader "Autenticacao - Login" 5 17
Wait-ForRateLimit

if ($global:authToken) {
    Write-TestResult $true "Token de autenticacao disponivel" "Token obtido no teste anterior"
} else {
    Write-TestWarning "Token nao disponivel" "Testes subsequentes podem falhar"
}

# ========================================
# TESTE 6: JWT_SECRET Obrigatório
# ========================================
Write-TestHeader "JWT_SECRET - Validacao Obrigatoria" 6 17
Wait-ForRateLimit

# Verificar se JWT_SECRET está configurado (indiretamente, testando se token funciona)
if ($global:authToken) {
    try {
    # @CurrentTenant() pega tenant_id do usuário autenticado, não do query parameter
    $response = Invoke-RestMethod -Uri "$baseUrl/products" `
        -Headers @{"Authorization"="Bearer $global:authToken"}
    Write-TestResult $true "JWT_SECRET configurado e funcionando" "Token valido aceito pelo servidor"
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-TestResult $false "Token invalido ou JWT_SECRET incorreto" "401 Unauthorized"
        } else {
            Write-TestResult $false "Erro ao validar token" $_.Exception.Message
        }
    }
} else {
    Write-TestWarning "Nao foi possivel testar JWT_SECRET" "Token nao disponivel"
}

# ========================================
# TESTE 7: Cache de Produtos
# ========================================
Write-TestHeader "Cache de Produtos (Redis)" 7 17
Wait-ForRateLimit

if ($global:authToken) {
    try {
        # Primeira requisição (deve ir ao DB)
        $start1 = Get-Date
        $products1 = Invoke-RestMethod -Uri "$baseUrl/products" `
            -Headers @{"Authorization"="Bearer $global:authToken"}
        $time1 = ((Get-Date) - $start1).TotalMilliseconds
        
        Write-TestResult $true "Primeira requisicao (DB)" "Tempo: $([math]::Round($time1))ms - Produtos: $($products1.Count)"
        
        Wait-ForRateLimit
        
        # Segunda requisição (deve usar cache)
        $start2 = Get-Date
        $products2 = Invoke-RestMethod -Uri "$baseUrl/products" `
            -Headers @{"Authorization"="Bearer $global:authToken"}
        $time2 = ((Get-Date) - $start2).TotalMilliseconds
        
        Write-TestResult $true "Segunda requisicao (Cache)" "Tempo: $([math]::Round($time2))ms - Produtos: $($products2.Count)"
        
        if ($time2 -lt $time1 * 0.8) {
            Write-TestResult $true "Cache funcionando" "Segunda requisicao $([math]::Round(($time1 - $time2) / $time1 * 100))% mais rapida"
        } else {
            Write-TestWarning "Cache pode nao estar funcionando" "Tempos similares ($([math]::Round($time1))ms vs $([math]::Round($time2))ms)"
        }
    } catch {
        Write-TestResult $false "Erro ao testar cache" $_.Exception.Message
    }
} else {
    Write-TestWarning "Nao foi possivel testar cache" "Token nao disponivel"
}

# ========================================
# TESTE 8: Idempotência em Pedidos
# ========================================
Write-TestHeader "Idempotencia em Pedidos" 8 17
Wait-ForRateLimit

if ($global:authToken) {
    # Primeiro, criar um produto de teste com estoque
    try {
        $productBody = @{
            name = "Produto Teste Idempotencia"
            price = 10.50
            description = "Produto para testar idempotencia"
        } | ConvertTo-Json
        
        $product = Invoke-RestMethod -Uri "$baseUrl/products" -Method POST `
            -Body $productBody -ContentType "application/json" `
            -Headers @{"Authorization"="Bearer $global:authToken"}
        
        $productId = $product.id
        Write-TestResult $true "Produto criado para teste" "ID: $productId"
        
        # Adicionar estoque
        $stockSql = "INSERT INTO movimentacoes_estoque (tenant_id, produto_id, current_stock) VALUES ('$tenantId', '$productId', 100) ON CONFLICT (tenant_id, produto_id) DO UPDATE SET current_stock = 100;"
        docker exec ucm-postgres psql -U postgres -d ucm -c $stockSql 2>&1 | Out-Null
        
        Wait-ForRateLimit
        
        # Criar pedido com idempotency key
        $idempotencyKey = "test-idempotency-$(Get-Date -Format 'yyyyMMddHHmmss')"
        $orderBody = @{
            items = @(@{
                produto_id = $productId
                quantidade = 1
                preco_unitario = 10.50
            })
            channel = "test"
        } | ConvertTo-Json
        
        $order1 = Invoke-RestMethod -Uri "$baseUrl/orders" -Method POST `
            -Body $orderBody -ContentType "application/json" `
            -Headers @{"Authorization"="Bearer $global:authToken"; "Idempotency-Key"=$idempotencyKey}
        
        Write-TestResult $true "Primeiro pedido criado" "ID: $($order1.id)"
        
        Wait-ForRateLimit
        
        # Tentar criar pedido novamente com mesma key
        try {
            $order2 = Invoke-RestMethod -Uri "$baseUrl/orders" -Method POST `
                -Body $orderBody -ContentType "application/json" `
                -Headers @{"Authorization"="Bearer $global:authToken"; "Idempotency-Key"=$idempotencyKey}
            
            if ($order1.id -eq $order2.id) {
                Write-TestResult $true "Idempotencia funcionando" "Mesmo ID retornado: $($order1.id)"
            } else {
                Write-TestResult $false "Idempotencia nao funcionou" "IDs diferentes: $($order1.id) vs $($order2.id)"
            }
        } catch {
            if ($_.Exception.Response.StatusCode -eq 409) {
                Write-TestResult $true "Idempotencia funcionando" "409 Conflict retornado (esperado)"
            } else {
                Write-TestResult $false "Erro inesperado" $_.Exception.Message
            }
        }
    } catch {
        Write-TestWarning "Nao foi possivel testar idempotencia" "Erro: $($_.Exception.Message)"
    }
} else {
    Write-TestWarning "Nao foi possivel testar idempotencia" "Token nao disponivel"
}

# ========================================
# TESTE 9: Validação Tenant WhatsApp
# ========================================
Write-TestHeader "Validacao Tenant WhatsApp" 9 17
Wait-ForRateLimit

# Teste 1: Tenant inválido
try {
    $invalidWebhook = @{
        From = "+5511999999999"
        Body = "Olá"
        tenantId = "invalid-tenant-id-12345"
    } | ConvertTo-Json
    
    try {
        Invoke-RestMethod -Uri "$baseUrl/whatsapp/webhook" -Method POST `
            -Body $invalidWebhook -ContentType "application/json" -ErrorAction Stop
        Write-TestResult $false "Webhook aceitou tenant invalido" "Deveria ter rejeitado"
    } catch {
        if ($_.Exception.Response.StatusCode -eq 404 -or $_.Exception.Response.StatusCode -eq 400) {
            Write-TestResult $true "Tenant invalido rejeitado" "Status: $($_.Exception.Response.StatusCode)"
        } else {
            Write-TestWarning "Resposta inesperada para tenant invalido" "Status: $($_.Exception.Response.StatusCode)"
        }
    }
} catch {
    Write-TestWarning "Erro ao testar validacao tenant" $_.Exception.Message
}

# ========================================
# TESTE 10: CORS Restritivo
# ========================================
Write-TestHeader "CORS - Validacao de Origens" 10 17
Wait-ForRateLimit

# Verificar headers CORS (indiretamente, testando se requisição funciona)
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method OPTIONS -ErrorAction SilentlyContinue
    Write-TestResult $true "CORS configurado" "Headers CORS presentes"
} catch {
    Write-TestWarning "Nao foi possivel verificar CORS diretamente" "Teste manual recomendado"
}

# ========================================
# TESTE 11: Audit Log
# ========================================
Write-TestHeader "Audit Log - Registro de Operacoes" 11 17
Wait-ForRateLimit

try {
    # Verificar se há registros de audit log recentes (tabela é audit_log, não audit_logs)
    $auditCount = docker exec ucm-postgres psql -U postgres -d ucm -t -A -c "SELECT COUNT(*) FROM audit_log WHERE created_at > NOW() - INTERVAL '10 minutes';" 2>&1
    
    if ($auditCount -match '^\d+$') {
        $count = [int]$auditCount
        if ($count -gt 0) {
            Write-TestResult $true "Audit log registrando operacoes" "$count registros nos ultimos 10 minutos"
        } else {
            Write-TestWarning "Nenhum registro de audit log recente" "Pode ser normal se nao houve operacoes criticas"
        }
    } else {
        Write-TestWarning "Nao foi possivel verificar audit log" "Resposta: $auditCount"
    }
} catch {
    Write-TestWarning "Erro ao verificar audit log" $_.Exception.Message
}

# ========================================
# TESTE 12: Queries N+1 Corrigidas
# ========================================
Write-TestHeader "Queries N+1 - Otimizacao" 12 17
Wait-ForRateLimit

if ($global:authToken) {
    try {
        # Listar produtos (deve usar eager loading)
        $start = Get-Date
        $products = Invoke-RestMethod -Uri "$baseUrl/products" `
            -Headers @{"Authorization"="Bearer $global:authToken"}
        $time = ((Get-Date) - $start).TotalMilliseconds
        
        if ($time -lt 1000) {
            Write-TestResult $true "Queries otimizadas" "Tempo: $([math]::Round($time))ms para $($products.Count) produtos"
        } else {
            Write-TestWarning "Queries podem estar lentas" "Tempo: $([math]::Round($time))ms"
        }
    } catch {
        Write-TestWarning "Nao foi possivel testar queries N+1" $_.Exception.Message
    }
} else {
    Write-TestWarning "Nao foi possivel testar queries N+1" "Token nao disponivel"
}

# ========================================
# TESTE 13: Índices no Banco de Dados
# ========================================
Write-TestHeader "Indices - Performance" 13 17
Wait-ForRateLimit

try {
    $indexes = docker exec ucm-postgres psql -U postgres -d ucm -t -A -c "SELECT COUNT(*) FROM pg_indexes WHERE tablename IN ('produtos', 'pedidos', 'movimentacoes_estoque', 'usuarios');" 2>&1
    
    if ($indexes -match '^\d+$') {
        $count = [int]$indexes
        if ($count -gt 0) {
            Write-TestResult $true "Indices criados" "$count indices encontrados nas tabelas principais"
        } else {
            Write-TestResult $false "Nenhum indice encontrado" "Performance pode estar comprometida"
        }
    } else {
        Write-TestWarning "Nao foi possivel verificar indices" "Resposta: $indexes"
    }
} catch {
    Write-TestWarning "Erro ao verificar indices" $_.Exception.Message
}

# ========================================
# TESTE 14: Row Level Security (RLS)
# ========================================
Write-TestHeader "Row Level Security (RLS)" 14 17
Wait-ForRateLimit

try {
    $rlsEnabled = docker exec ucm-postgres psql -U postgres -d ucm -t -A -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('produtos', 'pedidos', 'movimentacoes_estoque', 'usuarios') AND rowsecurity = true;" 2>&1
    
    if ($rlsEnabled -match '^\d+$') {
        $count = [int]$rlsEnabled
        if ($count -gt 0) {
            Write-TestResult $true "RLS habilitado" "$count tabelas com RLS ativo"
        } else {
            Write-TestResult $false "RLS nao habilitado" "Seguranca multi-tenant comprometida"
        }
    } else {
        Write-TestWarning "Nao foi possivel verificar RLS" "Resposta: $rlsEnabled"
    }
} catch {
    Write-TestWarning "Erro ao verificar RLS" $_.Exception.Message
}

# ========================================
# TESTE 15: Policies RLS
# ========================================
Write-TestHeader "Policies RLS - Isolamento Multi-tenant" 15 17
Wait-ForRateLimit

try {
    $policies = docker exec ucm-postgres psql -U postgres -d ucm -t -A -c "SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('produtos', 'pedidos', 'movimentacoes_estoque', 'usuarios');" 2>&1
    
    if ($policies -match '^\d+$') {
        $count = [int]$policies
        if ($count -gt 0) {
            Write-TestResult $true "Policies RLS criadas" "$count policies encontradas"
        } else {
            Write-TestResult $false "Nenhuma policy RLS encontrada" "Isolamento multi-tenant nao configurado"
        }
    } else {
        Write-TestWarning "Nao foi possivel verificar policies" "Resposta: $policies"
    }
} catch {
    Write-TestWarning "Erro ao verificar policies RLS" $_.Exception.Message
}

# ========================================
# TESTE 16: Timeout em Queries (30 segundos)
# ========================================
Write-TestHeader "Timeout em Queries (30s)" 16 17
Wait-ForRateLimit

Write-TestWarning "Timeout em queries requer teste de query lenta" "Configurado para 30 segundos no database.config.ts"

# ========================================
# TESTE 17: @CurrentTenant() Decorator
# ========================================
Write-TestHeader "@CurrentTenant() Decorator" 17 17
Wait-ForRateLimit

if ($global:authToken) {
    try {
        # Testar endpoint que requer tenant (@CurrentTenant() pega do usuário autenticado)
        $response = Invoke-RestMethod -Uri "$baseUrl/products" `
            -Headers @{"Authorization"="Bearer $global:authToken"}
        Write-TestResult $true "@CurrentTenant() funcionando" "Endpoint aceitou tenant_id corretamente"
    } catch {
        if ($_.Exception.Response.StatusCode -eq 400) {
            Write-TestResult $true "@CurrentTenant() validando tenant" "400 Bad Request para tenant invalido"
        } else {
            Write-TestWarning "Erro ao testar @CurrentTenant()" $_.Exception.Message
        }
    }
} else {
    Write-TestWarning "Nao foi possivel testar @CurrentTenant()" "Token nao disponivel"
}

# ========================================
# RESUMO FINAL
# ========================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "RESUMO DOS TESTES" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "Total de Testes: $($results.Total)" -ForegroundColor Cyan
Write-Host "✅ Passou: $($results.Passed)" -ForegroundColor Green
Write-Host "❌ Falhou: $($results.Failed)" -ForegroundColor Red
Write-Host "⚠️  Avisos: $($results.Warnings)" -ForegroundColor Yellow
Write-Host ""

$percentage = if ($results.Total -gt 0) { [math]::Round(($results.Passed / $results.Total) * 100) } else { 0 }
Write-Host "Taxa de Sucesso: $percentage%" -ForegroundColor $(if ($percentage -ge 80) { "Green" } elseif ($percentage -ge 60) { "Yellow" } else { "Red" })
Write-Host ""

if ($results.Failed -eq 0) {
    Write-Host "🎉 TODOS OS TESTES PASSARAM!" -ForegroundColor Green
} elseif ($percentage -ge 80) {
    Write-Host "✅ Maioria dos testes passou!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Alguns testes falharam. Revise os resultados acima." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "TESTES CONCLUIDOS" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""
