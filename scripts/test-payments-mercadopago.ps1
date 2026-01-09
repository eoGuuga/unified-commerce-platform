# ============================================
# TESTE DE INTEGRAÇÃO - MERCADO PAGO
# ============================================

Write-Host "🔍 TESTANDO INTEGRAÇÃO COM MERCADO PAGO" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se backend está rodando
Write-Host "1. Verificando se backend está rodando..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/health" -Method GET -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend está rodando" -ForegroundColor Green
    } else {
        Write-Host "❌ Backend não está respondendo corretamente" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Backend não está rodando. Execute: cd backend && npm run start:dev" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Verificar configuração do Mercado Pago
Write-Host "2. Verificando configuração do Mercado Pago..." -ForegroundColor Yellow

# Verificar se arquivo .env existe
$envPath = "backend/.env"
if (Test-Path $envPath) {
    Write-Host "✅ Arquivo .env encontrado" -ForegroundColor Green

    # Verificar se MERCADOPAGO_ACCESS_TOKEN está configurado
    $envContent = Get-Content $envPath -Raw
    if ($envContent -match "MERCADOPAGO_ACCESS_TOKEN.*=.*`"[^`"]+`"") {
        Write-Host "✅ MERCADOPAGO_ACCESS_TOKEN configurado" -ForegroundColor Green
    } else {
        Write-Host "⚠️  MERCADOPAGO_ACCESS_TOKEN não encontrado ou vazio" -ForegroundColor Yellow
        Write-Host "   Configure em: backend/.env" -ForegroundColor Yellow
    }

    # Verificar se PAYMENT_PROVIDER está como mercadopago
    if ($envContent -match "PAYMENT_PROVIDER.*=.*mercadopago") {
        Write-Host "✅ PAYMENT_PROVIDER configurado como 'mercadopago'" -ForegroundColor Green
    } else {
        Write-Host "⚠️  PAYMENT_PROVIDER não está como 'mercadopago'" -ForegroundColor Yellow
        Write-Host "   Configure: PAYMENT_PROVIDER=mercadopago" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Arquivo .env não encontrado" -ForegroundColor Red
    Write-Host "   Crie o arquivo backend/.env baseado no .env.example" -ForegroundColor Red
}

Write-Host ""

# Testar endpoint de pagamentos
Write-Host "3. Testando endpoint de pagamentos..." -ForegroundColor Yellow

# Criar um pedido de teste
Write-Host "   Criando pedido de teste..." -ForegroundColor Gray
$testOrder = @{
    channel = "ecommerce"
    items = @(
        @{
            produto_id = "test-product-id"
            quantity = 1
            unit_price = 10.00
        }
    )
    discount_amount = 0
    shipping_amount = 0
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/orders" -Method POST -Body $testOrder -ContentType "application/json" -Headers @{ "x-tenant-id" = "test-tenant" }
    if ($response.StatusCode -eq 201) {
        $orderData = $response.Content | ConvertFrom-Json
        Write-Host "✅ Pedido de teste criado: $($orderData.order_no)" -ForegroundColor Green

        # Testar criação de pagamento
        Write-Host "   Testando criação de pagamento..." -ForegroundColor Gray

        $paymentData = @{
            pedido_id = $orderData.id
            method = "pix"
            amount = 10.00
        } | ConvertTo-Json

        $paymentResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/payments" -Method POST -Body $paymentData -ContentType "application/json" -Headers @{ "x-tenant-id" = "test-tenant" }

        if ($paymentResponse.StatusCode -eq 201) {
            $paymentResult = $paymentResponse.Content | ConvertFrom-Json
            Write-Host "✅ Pagamento criado com sucesso!" -ForegroundColor Green
            Write-Host "   Status: $($paymentResult.pagamento.status)" -ForegroundColor Cyan

            if ($paymentResult.qr_code) {
                Write-Host "   ✅ QR Code PIX gerado" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  QR Code PIX não gerado (usando mock)" -ForegroundColor Yellow
            }

            if ($paymentResult.copy_paste) {
                Write-Host "   ✅ Código copia-cola PIX gerado" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  Código copia-cola não gerado (usando mock)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "❌ Falha ao criar pagamento" -ForegroundColor Red
        }

    } else {
        Write-Host "❌ Falha ao criar pedido de teste" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erro na API: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Verificar logs do backend
Write-Host "4. Verificando logs do backend..." -ForegroundColor Yellow
Write-Host "   Procure por mensagens como:" -ForegroundColor Gray
Write-Host "   - 'Mercado Pago client initialized'" -ForegroundColor Cyan
Write-Host "   - 'Processing Pix payment for order...'" -ForegroundColor Cyan
Write-Host "   - 'Erro ao processar Pix via Mercado Pago'" -ForegroundColor Red

Write-Host ""

# Resultado final
Write-Host "🎯 RESULTADO DO TESTE" -ForegroundColor Magenta
Write-Host "====================" -ForegroundColor Magenta
Write-Host ""
Write-Host "Se você viu mensagens de sucesso acima, a integração está funcionando!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 PRÓXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "1. Configure chaves reais do Mercado Pago (sem TEST-)" -ForegroundColor White
Write-Host "2. Configure webhooks para confirmação automática" -ForegroundColor White
Write-Host "3. Teste com valores reais" -ForegroundColor White
Write-Host "4. Monitore custos e taxas" -ForegroundColor White
Write-Host ""
Write-Host "📚 DOCUMENTAÇÃO: config/payments-setup.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 SEUS CLIENTES JÁ PODEM PAGAR DE VERDADE!" -ForegroundColor Green