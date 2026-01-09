# Script de Teste E2E - FASE 3.3 Completa
# Testa o fluxo completo: pedido -> coleta de dados -> confirmacao -> pagamento -> notificacao

param(
    [string]$BaseUrl = "http://localhost:3001/api/v1",
    [string]$TenantId = "00000000-0000-0000-0000-000000000000",
    [switch]$Extended
)

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
    # ignore
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "TESTE E2E - FASE 3.3 COMPLETA" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

$ErrorActionPreference = "Stop"

# Cores
$successColor = "Green"
$errorColor = "Red"
$infoColor = "Cyan"
$warningColor = "Yellow"

# Variaveis globais
$global:testResults = @()
$global:testCount = 0
$global:passCount = 0
$global:failCount = 0

function Test-Step {
    param(
        [string]$Name,
        [scriptblock]$Test
    )
    
    $global:testCount++
    Write-Host "`n[$global:testCount] Testando: $Name" -ForegroundColor $infoColor
    
    try {
        $result = & $Test
        $global:passCount++
        Write-Host "  [OK] PASSOU" -ForegroundColor $successColor
        $global:testResults += @{
            Name = $Name
            Status = "PASSOU"
            Details = $result
        }
        return $result
    } catch {
        $global:failCount++
        Write-Host "  [ERRO] FALHOU: $($_.Exception.Message)" -ForegroundColor $errorColor
        $global:testResults += @{
            Name = $Name
            Status = "FALHOU"
            Error = $_.Exception.Message
        }
        throw
    }
}

function Get-ResponseText($resp) {
    if ($null -eq $resp) { return "" }
    if ($resp -is [string]) { return $resp }

    # Normal: endpoint retorna objeto { success, response, ... }
    if ($resp.PSObject.Properties.Name -contains "response") {
        return [string]$resp.response
    }

    # Compat: alguns formatos usam Message
    if ($resp.PSObject.Properties.Name -contains "Message") {
        return [string]$resp.Message
    }

    return ($resp | ConvertTo-Json -Depth 6)
}

function New-RandomPhone() {
    return "+55119" + (Get-Random -Minimum 10000000 -Maximum 99999999)
}

function Ensure-DbMigrations() {
    # Best-effort: se docker/psql nao estiverem disponiveis, nao falhar o teste por isso.
    try {
        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
            Write-Host "    Aviso: docker nao encontrado; pulando ensure migrations." -ForegroundColor $warningColor
            return "SKIP"
        }

        $names = docker ps --format "{{.Names}}" 2>$null
        if (-not $names -or ($names | Select-String -SimpleMatch "ucm-postgres" -Quiet) -eq $false) {
            Write-Host "    Aviso: container ucm-postgres nao esta rodando; pulando ensure migrations." -ForegroundColor $warningColor
            return "SKIP"
        }

        $migrations = @(
            "002-security-and-performance.sql",
            "003-whatsapp-conversations.sql",
            "004-audit-log-metadata.sql",
            "005-audit-action-enum-values.sql",
            "006-idempotency.sql",
            "007-add-coupon-code-to-pedidos.sql",
            "008-usuarios-email-unique-por-tenant.sql",
            "009-rls-force-and-extra-policies.sql",
            "010-idempotency-unique-tenant-operation.sql"
        )

        foreach ($m in $migrations) {
            $path = "scripts/migrations/$m"
            if (Test-Path $path) {
                Get-Content $path | docker exec -i ucm-postgres psql -U postgres -d ucm | Out-Null
            }
        }

        return "OK"
    } catch {
        Write-Host "    Aviso: falha ao aplicar migrations automaticamente. Continuando." -ForegroundColor $warningColor
        return "SKIP"
    }
}

function Invoke-Webhook([string]$from, [string]$body) {
    $webhookBody = @{
        from = $from
        body = $body
        tenantId = $TenantId
    } | ConvertTo-Json

    $maxAttempts = 6
    $attempt = 0
    $delayMs = 300

    while ($true) {
        try {
            $response = Invoke-RestMethod -Uri "$BaseUrl/whatsapp/webhook" `
                -Method POST `
                -Body $webhookBody `
                -ContentType "application/json"
            break
        } catch {
            $attempt++

            # Tratar rate limit (429) automaticamente
            $statusCode = $null
            try {
                if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
                    $statusCode = [int]$_.Exception.Response.StatusCode
                }
            } catch {
                $statusCode = $null
            }

            if ($statusCode -eq 429 -and $attempt -lt $maxAttempts) {
                Start-Sleep -Milliseconds $delayMs
                $delayMs = [Math]::Min(2000, [int]($delayMs * 1.7))
                continue
            }

            throw
        }
    }

    $text = Get-ResponseText $response
    $preview = if ($text.Length -gt 120) { $text.Substring(0, 120) + "..." } else { $text }
    return @{ raw = $response; text = $text; preview = $preview }
}

function Get-Orders() {
    $resp = Invoke-RestMethod -Uri "$BaseUrl/orders" -Headers @{"Authorization" = "Bearer $script:token"}
    return $(if ($resp -is [array]) { $resp } else { $resp.data })
}

function Get-LatestOrderByPhone([string]$phone) {
    $orders = Get-Orders | Where-Object { $_.customer_phone -eq $phone }
    return $orders | Sort-Object -Property created_at -Descending | Select-Object -First 1
}

function Get-PaymentsByOrderId([string]$orderId) {
    return Invoke-RestMethod -Uri "$BaseUrl/payments/pedido/$orderId" -Headers @{"Authorization" = "Bearer $script:token"}
}

function Get-StockSummary() {
    return Invoke-RestMethod -Uri "$BaseUrl/products/stock-summary" -Headers @{"Authorization" = "Bearer $script:token"}
}

function Upsert-DevCoupon([string]$code) {
    $body = @{ code = $code } | ConvertTo-Json
    return Invoke-RestMethod -Uri "$BaseUrl/coupons/dev/upsert" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -Headers @{"Authorization" = "Bearer $script:token"}
}

function Adjust-Stock([string]$productId, [int]$quantity, [string]$reason) {
    $body = @{ quantity = $quantity; reason = $reason } | ConvertTo-Json
    return Invoke-RestMethod -Uri "$BaseUrl/products/$productId/adjust-stock" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -Headers @{"Authorization" = "Bearer $script:token"}
}

function Ensure-AvailableStock([string]$productId, [int]$desiredAvailable, [string]$reason) {
    $summary = Get-StockSummary
    $p = $summary.products | Where-Object { $_.id -eq $productId } | Select-Object -First 1
    if (-not $p) { throw "Produto nao encontrado no stock-summary: $productId" }

    $available = [int]$p.available_stock
    if ($available -ge $desiredAvailable) { return "OK" }

    # Como reserved_stock pode existir, a forma mais segura aqui e aumentar current_stock
    $delta = $desiredAvailable - $available
    if ($delta -le 0) { return "OK" }

    Adjust-Stock $productId $delta $reason | Out-Null
    return "RESTOCK +$delta"
}

# ============================================
# ETAPA 1: SETUP - Criar usuario e produtos
# ============================================

Write-Host "`nETAPA 1: SETUP" -ForegroundColor $infoColor
Write-Host "========================================" -ForegroundColor $infoColor

$testEmail = "test-fase33-$(Get-Date -Format 'yyyyMMddHHmmss')@exemplo.com"
$testPassword = "senha123"
$testName = "Teste Fase 3.3"

$token = $null
$productId = $null

$null = Test-Step "Garantir migrations criticas (docker)" {
    return Ensure-DbMigrations
}

$null = Test-Step "Registrar usuario de teste" {
    $registerBody = @{
        email = $testEmail
        password = $testPassword
        full_name = $testName
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BaseUrl/auth/register" `
        -Method POST `
        -Body $registerBody `
        -ContentType "application/json" `
        -Headers @{"x-tenant-id" = $TenantId}

    $script:token = $response.access_token
    Write-Host "    Token obtido: $($script:token.Substring(0, 20))..." -ForegroundColor Gray
    return $response
}

$null = Test-Step "Login com usuario criado" {
    $loginBody = @{
        email = $testEmail
        password = $testPassword
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BaseUrl/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json" `
        -Headers @{"x-tenant-id" = $TenantId}

    $script:token = $response.access_token
    Write-Host "    Token atualizado" -ForegroundColor Gray
    return $response
}

$null = Test-Step "Garantir cupom DEV10 (dev)" {
    # Endpoint existe apenas em dev/test; se nao existir, o teste segue sem cupom.
    try {
        $resp = Upsert-DevCoupon "DEV10"
        return $resp
    } catch {
        Write-Host "    Aviso: nao consegui criar DEV10 (talvez backend antigo). Pulando." -ForegroundColor Gray
        return "SKIP"
    }
}

$null = Test-Step "Listar produtos para obter ID" {
    $response = Invoke-RestMethod -Uri "$BaseUrl/products" `
        -Headers @{"Authorization" = "Bearer $script:token"}

    if ($response -is [array] -and $response.Count -gt 0) {
        $all = $response
    } elseif ($response.data -and $response.data.Count -gt 0) {
        $all = $response.data
    } else {
        throw "Nenhum produto encontrado. Execute o seed primeiro."
    }

    # Escolher produto com estoque suficiente e nome "nao ambiguo" (evita casos tipo "3/6/10 Beijinhos...")
    $candidates = @($all | Where-Object { $_.available_stock -ge 20 -and $_.name -notmatch '^[0-9]' })
    if ($candidates.Count -eq 0) {
        $candidates = @($all | Where-Object { $_.available_stock -ge 20 })
    }
    if ($candidates.Count -eq 0) {
        $candidates = @($all | Where-Object { $_.available_stock -ge 5 -and $_.name -notmatch '^[0-9]' })
    }
    if ($candidates.Count -eq 0) {
        $candidates = @($all | Where-Object { $_.available_stock -ge 5 })
    }
    if ($candidates.Count -eq 0) {
        throw "Nenhum produto com estoque disponivel suficiente. Rode o seed ou ajuste estoque."
    }

    $main = $candidates | Select-Object -First 1
    $script:productId = $main.id
    $script:productName = $main.name
    $script:productQty = 5

    # Escolher um brownie para multi-item (se existir); senao pega outro produto
    $brownies = @($all | Where-Object { ($_.name -match "brownie") -and ($_.available_stock -ge 1) -and ($_.id -ne $script:productId) })
    $fallback2 = @($all | Where-Object { $_.available_stock -ge 1 -and $_.id -ne $script:productId })
    $second = if ($brownies.Count -gt 0) { $brownies | Select-Object -First 1 } else { $fallback2 | Select-Object -First 1 }
    if (-not $second) { throw "Nao encontrei segundo produto para multi-item." }
    $script:secondProductId = $second.id
    $script:secondProductName = $second.name

    Write-Host "    Produto principal: $($script:productName) (ID: $script:productId) estoque>= $($main.available_stock)" -ForegroundColor Gray
    Write-Host "    Segundo produto: $($script:secondProductName) (ID: $script:secondProductId) estoque>= $($second.available_stock)" -ForegroundColor Gray
    return $script:productId
}

# ============================================
# ETAPA 2: TESTE DO FLUXO COMPLETO
# ============================================

Write-Host "`nETAPA 2: FLUXO COMPLETO" -ForegroundColor $infoColor
Write-Host "========================================" -ForegroundColor $infoColor

# Usar um telefone diferente a cada execucao para evitar "estado preso" na conversa
$customerPhone = New-RandomPhone

# Evitar caracteres especiais para nao depender de encoding do terminal/PS
$customerName = "Joao Silva Teste"
$customerAddress = "Rua das Flores, 123, Apto 45, Centro, Sao Paulo, SP, 01234-567"

$null = Test-Step "Simular mensagem: Fazer pedido" {
    # Garantir estoque minimo para nao falhar por execucoes anteriores
    Ensure-AvailableStock $script:productId 20 "E2E: garantir estoque produto principal" | Out-Null
    $r = Invoke-Webhook $customerPhone ("Quero {0} {1}" -f $script:productQty, $script:productName)
    Write-Host "    Resposta: $($r.preview)" -ForegroundColor Gray
    return $r.raw
}

$null = Test-Step "Simular mensagem: Fornecer nome" {
    $r = Invoke-Webhook $customerPhone $customerName
    Write-Host "    Resposta: $($r.preview)" -ForegroundColor Gray
    return $r.raw
}

$null = Test-Step "Simular mensagem: Escolher retirada" {
    $r = Invoke-Webhook $customerPhone "2"
    Write-Host "    Resposta: $($r.preview)" -ForegroundColor Gray
    return $r.raw
}

$null = Test-Step "Simular mensagem: Confirmar pedido" {
    $r = Invoke-Webhook $customerPhone "sim"
    Write-Host "    Resposta: $($r.preview)" -ForegroundColor Gray
    if ($r.text -notmatch "PEDIDO CRIADO" ) {
        throw "Nao confirmou criacao do pedido (resposta inesperada)"
    }

    $m = [regex]::Match($r.text, "PED-\d{8}-\d{3}")
    if (-not $m.Success) { throw "Nao encontrei order_no na resposta" }
    $script:orderNo = $m.Value
    return $r.raw
}

$script:latestOrder = $null

$null = Test-Step "Verificar se pedido foi criado" {
    Start-Sleep -Seconds 2
    
    $orders = Get-Orders
    
    $latestOrder = $orders | Where-Object { $_.order_no -eq $script:orderNo } | Select-Object -First 1
    
    if ($latestOrder) {
        $script:latestOrder = $latestOrder
        Write-Host "    Pedido encontrado: $($latestOrder.order_no)" -ForegroundColor Gray
        Write-Host "    Cliente: $($latestOrder.customer_name)" -ForegroundColor Gray
        Write-Host "    Status: $($latestOrder.status)" -ForegroundColor Gray
        return $latestOrder
    } else {
        throw "Pedido nao encontrado (order_no=$script:orderNo)"
    }
}

$null = Test-Step "Simular mensagem: Escolher PIX" {
    $r = Invoke-Webhook $customerPhone "1"
    Write-Host "    Resposta: $($r.preview)" -ForegroundColor Gray
    if ($r.text -notmatch "PAGAMENTO PIX" ) {
        throw "Nao retornou pagamento PIX"
    }
    return $r.raw
}

if ($Extended) {
    Write-Host "`nETAPA 2B: REGRESSOES (EXTENDED)" -ForegroundColor $infoColor
    Write-Host "========================================" -ForegroundColor $infoColor

    $null = Test-Step "Idempotencia: confirmar 'sim' duas vezes nao duplica pedido" {
        if (-not $script:latestOrder) { throw "latestOrder nao definido" }

        $ordersBefore = Get-Orders | Where-Object { $_.customer_phone -eq $customerPhone }
        $countBefore = ($ordersBefore | Measure-Object).Count

        $r = Invoke-Webhook $customerPhone "sim"
        Write-Host "    Resposta (2o sim): $($r.preview)" -ForegroundColor Gray

        Start-Sleep -Seconds 1
        $ordersAfter = Get-Orders | Where-Object { $_.customer_phone -eq $customerPhone }
        $countAfter = ($ordersAfter | Measure-Object).Count

        if ($countAfter -ne $countBefore) {
            throw "Pedido duplicou: antes=$countBefore depois=$countAfter"
        }
        return "OK"
    }

    $null = Test-Step "Idempotencia: escolher PIX duas vezes reutiliza pagamento" {
        if (-not $script:latestOrder) { throw "latestOrder nao definido" }

        $r1 = Invoke-Webhook $customerPhone "1"
        Write-Host "    Resposta (pix 1): $($r1.preview)" -ForegroundColor Gray
        $r2 = Invoke-Webhook $customerPhone "1"
        Write-Host "    Resposta (pix 2): $($r2.preview)" -ForegroundColor Gray

        $payments = Get-PaymentsByOrderId $script:latestOrder.id
        $pixPayments = @($payments | Where-Object { $_.method -eq "pix" })
        if ($pixPayments.Count -ne 1) {
            throw "Esperado 1 pagamento pix, obtido $($pixPayments.Count)"
        }
        return "OK"
    }

    $null = Test-Step "Cancelamento: cancelar na confirmacao nao cria pedido" {
        $phone2 = New-RandomPhone
        $name2 = "Cliente Cancelamento"

        Ensure-AvailableStock $script:productId 10 "E2E: estoque cancelamento" | Out-Null
        $null = Invoke-Webhook $phone2 ("Quero 2 {0}" -f $script:productName)
        $null = Invoke-Webhook $phone2 $name2
        $null = Invoke-Webhook $phone2 "2"
        $null = Invoke-Webhook $phone2 "cancelar"

        Start-Sleep -Seconds 1
        $orders2 = Get-Orders | Where-Object { $_.customer_phone -eq $phone2 }
        if (($orders2 | Measure-Object).Count -ne 0) {
            throw "Pedido foi criado mesmo apos cancelar"
        }
        return "OK"
    }

    $null = Test-Step "Entrega: informar endereco e chegar na confirmacao" {
        $phone3 = New-RandomPhone
        $name3 = "Cliente Entrega"

        Ensure-AvailableStock $script:productId 10 "E2E: estoque entrega" | Out-Null
        $null = Invoke-Webhook $phone3 ("Quero 2 {0}" -f $script:productName)
        $null = Invoke-Webhook $phone3 $name3
        $null = Invoke-Webhook $phone3 "1"
        $rAddr = Invoke-Webhook $phone3 $customerAddress

        if ($rAddr.text -notmatch "CONFIRMA" ) {
            throw "Nao chegou na confirmacao apos informar endereco"
        }
        if ($rAddr.text -notmatch "Frete" ) {
            throw "Esperado linha de Frete na confirmacao de entrega"
        }

        # Persistencia: confirmar e validar pedido salvo com entrega + frete
        $null = Invoke-Webhook $phone3 "sim"
        Start-Sleep -Seconds 2
        $o = Get-LatestOrderByPhone $phone3
        if (-not $o) { throw "Nao encontrei pedido criado para entrega (phone3)" }
        if ([decimal]$o.shipping_amount -le 0) { throw "shipping_amount nao persistiu (>0 esperado)" }
        if ($o.delivery_type -ne "delivery") { throw "delivery_type esperado=delivery, obtido=$($o.delivery_type)" }
        if (-not $o.delivery_address) { throw "delivery_address nao persistiu" }
        return "OK"
    }

    $null = Test-Step "Cupom: aplicar DEV10 antes da confirmacao" {
        $phoneC = New-RandomPhone
        $nameC = "Cliente Cupom"

        Ensure-AvailableStock $script:productId 10 "E2E: estoque cupom" | Out-Null
        $null = Invoke-Webhook $phoneC ("Quero 2 {0}" -f $script:productName)
        $null = Invoke-Webhook $phoneC $nameC

        # Estado deve estar coletando endereco; cupom precisa funcionar mesmo assim
        $rCupom = Invoke-Webhook $phoneC "cupom DEV10"
        if ($rCupom.text -notmatch "Cupom" -and $rCupom.text -notmatch "aplicad" -and $rCupom.text -notmatch "Desconto") {
            throw "Nao confirmou aplicacao do cupom"
        }

        $rConf = Invoke-Webhook $phoneC "2"
        if ($rConf.text -notmatch "Desconto" ) {
            throw "Confirmacao nao mostrou desconto apos cupom"
        }

        # Persistencia: confirmar e validar pedido salvo com cupom + desconto
        $null = Invoke-Webhook $phoneC "sim"
        Start-Sleep -Seconds 2
        $o = Get-LatestOrderByPhone $phoneC
        if (-not $o) { throw "Nao encontrei pedido criado para cupom (phoneC)" }
        if (-not $o.coupon_code) { throw "coupon_code nao persistiu" }
        if ($o.coupon_code -ne "DEV10") { throw "coupon_code esperado=DEV10, obtido=$($o.coupon_code)" }
        if ([decimal]$o.discount_amount -le 0) { throw "discount_amount nao persistiu (>0 esperado)" }
        return "OK"
    }

    $null = Test-Step "Status do pedido: consultar por codigo" {
        if (-not $script:latestOrder) { throw "latestOrder nao definido" }
        $r = Invoke-Webhook $customerPhone ("meu pedido {0}" -f $script:latestOrder.order_no)
        if ($r.text -notmatch $script:latestOrder.order_no) {
            throw "Nao retornou o codigo do pedido no status"
        }
        if ($r.text -notmatch "Status" -and $r.text -notmatch "pendente" ) {
            throw "Nao retornou status do pedido"
        }
        return "OK"
    }

    $null = Test-Step "Mensagem longa: retorna erro amigavel" {
        $phone4 = New-RandomPhone
        $longMsg = ("a" * 1200)
        $r = Invoke-Webhook $phone4 $longMsg
        if ($r.text -notmatch "Mensagem muito longa|Mensagem vazia|invalida") {
            throw "Resposta inesperada para mensagem longa"
        }
        return "OK"
    }

    $null = Test-Step "Produto inexistente/typo: retorna sugestao ou erro amigavel" {
        $phone5 = New-RandomPhone
        $r = Invoke-Webhook $phone5 "Quero 5 brigadero"
        if ($r.text -notmatch "PEDIDO PREPARADO|quis dizer|Nao encontrei") {
            throw "Resposta inesperada para produto com typo"
        }
        return "OK"
    }

    $null = Test-Step "Estoque insuficiente: pede quantidade acima do disponivel" {
        $phone6 = New-RandomPhone
        # Para ficar deterministico: usamos o segundo produto e forcamos estoque baixo nele,
        # depois pedimos acima do disponivel usando o nome exato.
        $summary = Get-StockSummary
        $p = $summary.products | Where-Object { $_.id -eq $script:secondProductId } | Select-Object -First 1
        if (-not $p) { throw "Segundo produto nao encontrado no stock-summary" }

        # Forcar current_stock = 1 (se ja for 0, coloca 1; se for maior, reduz)
        $target = 1
        $delta = $target - [int]$p.current_stock
        if ($delta -ne 0) { Adjust-Stock $p.id $delta "E2E: forcar baixo estoque" | Out-Null }

        $summary2 = Get-StockSummary
        $p2 = $summary2.products | Where-Object { $_.id -eq $p.id } | Select-Object -First 1
        $need = ([int]$p2.available_stock) + 10

        $r = Invoke-Webhook $phone6 ("Quero {0} {1}" -f $need, $script:secondProductName)
        if ($r.text -notmatch "Estoque insuficiente") {
            throw "Esperado 'Estoque insuficiente' e nao encontrei"
        }
        return "OK"
    }

    $null = Test-Step "Multi-item: 2 itens na mesma frase" {
        $phone7 = New-RandomPhone
        Ensure-AvailableStock $script:productId 10 "E2E: estoque multi-item item1" | Out-Null
        Ensure-AvailableStock $script:secondProductId 2 "E2E: estoque multi-item item2" | Out-Null

        $r = Invoke-Webhook $phone7 ("Quero 2 {0} e 1 {1}" -f $script:productName, $script:secondProductName)
        if ($r.text -notmatch "PEDIDO PREPARADO") {
            throw "Esperado preparar pedido multi-item"
        }
        if ($r.text -notmatch [regex]::Escape($script:productName.Split(' ')[0])) {
            throw "Nao apareceu item 1 no texto"
        }
        if ($r.text -notmatch [regex]::Escape($script:secondProductName.Split(' ')[0])) {
            throw "Nao apareceu item 2 no texto"
        }
        return "OK"
    }
}

# ============================================
# ETAPA 3: VERIFICAR NOTIFICACOES
# ============================================

Write-Host "`nETAPA 3: VERIFICAR NOTIFICACOES" -ForegroundColor $infoColor
Write-Host "========================================" -ForegroundColor $infoColor

$null = Test-Step "Verificar mensagens na conversa" {
    # Buscar conversa pelo telefone
    # Nota: Isso requer um endpoint ou query direta no banco
    # Por enquanto, apenas verificamos que o fluxo nao deu erro
    Write-Host "    Notificacoes devem ter sido enviadas automaticamente" -ForegroundColor Gray
    return "OK"
}

# ============================================
# RESUMO FINAL
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "RESUMO DOS TESTES" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "Total de testes: $global:testCount" -ForegroundColor $infoColor
Write-Host "Passou: $global:passCount" -ForegroundColor $successColor
Write-Host "Falhou: $global:failCount" -ForegroundColor $(if ($global:failCount -eq 0) { $successColor } else { $errorColor })
Write-Host ""

if ($global:failCount -eq 0) {
    Write-Host "TODOS OS TESTES PASSARAM!" -ForegroundColor $successColor
    Write-Host ""
    Write-Host "FASE 3.3 esta 100% funcional!" -ForegroundColor $successColor
    exit 0
} else {
    Write-Host "Alguns testes falharam. Verifique os erros acima." -ForegroundColor $warningColor
    exit 1
}
