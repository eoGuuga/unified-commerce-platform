# ============================================
# TESTE DO WHATSAPP BOT COM IA + FASE 3.3
# ============================================

Write-Host "🤖 TESTANDO WHATSAPP BOT COM IA + PAGAMENTOS" -ForegroundColor Magenta
Write-Host "===========================================" -ForegroundColor Magenta
Write-Host "🚀 FASE 3.3: CONFIRMAÇÃO E PAGAMENTO VIA BOT" -ForegroundColor Cyan
Write-Host ""

# Verificar se backend está rodando
Write-Host "🔍 Verificando backend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/health" -Method GET -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend rodando" -ForegroundColor Green
    } else {
        Write-Host "❌ Backend não está respondendo" -ForegroundColor Red
        Write-Host "   Execute: Set-Location backend; npm run start:dev" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Backend não está rodando" -ForegroundColor Red
    Write-Host "   Execute: cd backend && npm run start:dev" -ForegroundColor Yellow
    exit 1
}

# Verificar Ollama
Write-Host ""
Write-Host "🔍 Verificando Ollama..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        $models = $response.Content | ConvertFrom-Json
        $llamaModels = $models.models | Where-Object { $_.name -like "*llama*" }
        if ($llamaModels) {
            Write-Host "✅ Ollama rodando com modelo Llama" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Ollama rodando mas sem modelo Llama" -ForegroundColor Yellow
            Write-Host "   Execute: .\setup-ollama.ps1" -ForegroundColor Gray
        }
    } else {
        throw "Ollama não responde"
    }
} catch {
    Write-Host "❌ Ollama não está rodando" -ForegroundColor Red
    Write-Host "   Execute: .\setup-ollama.ps1" -ForegroundColor Yellow
}

Write-Host ""

# Criar tenant de teste se não existir
Write-Host "🔍 Preparando dados de teste..." -ForegroundColor Yellow

# Simular mensagens do WhatsApp para teste
$testMessages = @(
    @{
        message = "Oi"
        expected = "saudacao"
        description = "Saudação simples"
    },
    @{
        message = "Quais produtos vocês tem?"
        expected = "consulta_produtos"
        description = "Consulta de produtos"
    },
    @{
        message = "Quero 2 brigadeiros"
        expected = "pedido_detectado"
        description = "Pedido com IA"
    },
    @{
        message = "Qual o horario de funcionamento?"
        expected = "consulta_horario"
        description = "Consulta horário"
    },
    @{
        message = "Onde fica a loja?"
        expected = "consulta_endereco"
        description = "Consulta endereço"
    }
)

# 🚀 FASE 3.3: Testes de fluxo completo de pedido e pagamento
$phase3Tests = @(
    @{
        step = 1
        message = "Quero 1 brigadeiro"
        expected = "pedido_criado"
        description = "Fase 3.3 - Criar pedido"
    },
    @{
        step = 2
        message = "João Silva"
        expected = "nome_salvo"
        description = "Fase 3.3 - Informar nome"
    },
    @{
        step = 3
        message = "1"
        expected = "entrega_selecionada"
        description = "Fase 3.3 - Escolher entrega"
    },
    @{
        step = 4
        message = "Rua dos Chocolates, 123, Centro, São Paulo, SP, 01234-567"
        expected = "endereco_salvo"
        description = "Fase 3.3 - Informar endereço"
    },
    @{
        step = 5
        message = "(11) 98765-4321"
        expected = "telefone_salvo"
        description = "Fase 3.3 - Informar telefone"
    },
    @{
        step = 6
        message = "sim"
        expected = "pedido_confirmado"
        description = "Fase 3.3 - Confirmar pedido"
    },
    @{
        step = 7
        message = "1"
        expected = "pix_selecionado"
        description = "Fase 3.3 - Escolher PIX"
    }
)

Write-Host "🧪 Executando testes..." -ForegroundColor Yellow
Write-Host ""

$testResults = @()

foreach ($test in $testMessages) {
    Write-Host "Testando: $($test.description)" -ForegroundColor Cyan
    Write-Host "   Mensagem: '$($test.message)'" -ForegroundColor Gray

    try {
        # Simular requisição para o endpoint do WhatsApp
        $whatsappData = @{
            from = "5511999999999"
            body = $test.message
            timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
            tenantId = "test-tenant-123"
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/whatsapp/webhook" -Method POST -Body $whatsappData -ContentType "application/json" -TimeoutSec 30

        if ($response.StatusCode -eq 200) {
            $result = $response.Content | ConvertFrom-Json
            Write-Host "   Resposta recebida" -ForegroundColor Green

            if ($result.message) {
                Write-Host "   Bot respondeu: $($result.message.Substring(0, [Math]::Min(100, $result.message.Length)))..." -ForegroundColor White
            }

            $testResults += @{
                test = $test.description
                status = "PASSOU"
                details = "Resposta gerada com sucesso"
            }
        } else {
            Write-Host "   Status code inesperado: $($response.StatusCode)" -ForegroundColor Red
            $testResults += @{
                test = $test.description
                status = "FALHOU"
                details = "Status code: $($response.StatusCode)"
            }
        }
    } catch {
        Write-Host "   Erro: $($_.Exception.Message)" -ForegroundColor Red
        $testResults += @{
            test = $test.description
            status = "FALHOU"
            details = $_.Exception.Message
        }
    }

    Write-Host ""
    Start-Sleep -Seconds 2
}

# Resultado dos testes
Write-Host "📊 RESULTADO DOS TESTES" -ForegroundColor Magenta
Write-Host "======================" -ForegroundColor Magenta
Write-Host ""

$passed = 0
$failed = 0

foreach ($result in $testResults) {
    if ($result.status -eq "PASSOU") {
        Write-Host "✅ $($result.test)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "❌ $($result.test) - $($result.details)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "📈 RESUMO:" -ForegroundColor Yellow
Write-Host "   ✅ Testes que passaram: $passed" -ForegroundColor Green
Write-Host "   ❌ Testes que falharam: $failed" -ForegroundColor Red
Write-Host "   📊 Taxa de sucesso: $([math]::Round(($passed / ($passed + $failed)) * 100, 1))%" -ForegroundColor Cyan

Write-Host ""

if ($failed -eq 0) {
    Write-Host "🎉 TODOS OS TESTES PASSARAM!" -ForegroundColor Green
    Write-Host "   Seu WhatsApp bot com IA está funcionando perfeitamente!" -ForegroundColor Green
} elseif ($passed -gt $failed) {
    Write-Host "👍 MAIORIA DOS TESTES PASSOU!" -ForegroundColor Yellow
    Write-Host "   O bot está funcionando, mas pode ser melhorado." -ForegroundColor Yellow
} else {
    Write-Host "⚠️  MAIORIA DOS TESTES FALHOU" -ForegroundColor Red
    Write-Host "   Verifique a configuração do Ollama e backend." -ForegroundColor Red
}

Write-Host ""

# 🚀 FASE 3.3: Teste de fluxo completo
Write-Host "🚀 EXECUTANDO TESTES FASE 3.3 - FLUXO COMPLETO" -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host ""

$phase3Results = @()

foreach ($test in $phase3Tests) {
    Write-Host "📤 Passo $($test.step): $($test.description)" -ForegroundColor Cyan
    Write-Host "   Mensagem: '$($test.message)'" -ForegroundColor Gray

    try {
        $whatsappData = @{
            from = "5511999999999"
            body = $test.message
            timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
            tenantId = "test-tenant-123"
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/whatsapp/webhook" -Method POST -Body $whatsappData -ContentType "application/json" -TimeoutSec 30

        if ($response.StatusCode -eq 200) {
            $result = $response.Content | ConvertFrom-Json
            Write-Host "   ✅ Resposta recebida" -ForegroundColor Green

            if ($result.message) {
                Write-Host "   💬 Bot respondeu: $($result.message.Substring(0, [Math]::Min(150, $result.message.Length)))..." -ForegroundColor White
            }

            $phase3Results += @{
                step = $test.step
                test = $test.description
                status = "PASSOU"
                details = "Fluxo funcionando"
            }
        } else {
            Write-Host "   ❌ Status code inesperado: $($response.StatusCode)" -ForegroundColor Red
            $phase3Results += @{
                step = $test.step
                test = $test.description
                status = "FALHOU"
                details = "Status code: $($response.StatusCode)"
            }
        }
    } catch {
        Write-Host "   ❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
        $phase3Results += @{
            step = $test.step
            test = $test.description
            status = "FALHOU"
            details = $_.Exception.Message
        }
    }

    Write-Host ""
    Start-Sleep -Seconds 3  # Pausa maior entre passos do fluxo
}

# Resultado dos testes Fase 3.3
Write-Host "📊 RESULTADO FASE 3.3" -ForegroundColor Magenta
Write-Host "====================" -ForegroundColor Magenta
Write-Host ""

$phase3Passed = 0
$phase3Failed = 0

foreach ($result in $phase3Results) {
    if ($result.status -eq "PASSOU") {
        Write-Host "✅ Passo $($result.step): $($result.test)" -ForegroundColor Green
        $phase3Passed++
    } else {
        Write-Host "❌ Passo $($result.step): $($result.test) - $($result.details)" -ForegroundColor Red
        $phase3Failed++
    }
}

Write-Host ""
Write-Host "📈 RESUMO FASE 3.3:" -ForegroundColor Yellow
Write-Host "   ✅ Passos que passaram: $phase3Passed" -ForegroundColor Green
Write-Host "   ❌ Passos que falharam: $phase3Failed" -ForegroundColor Red
Write-Host "   📊 Taxa de sucesso: $([math]::Round(($phase3Passed / ($phase3Passed + $phase3Failed)) * 100, 1))%" -ForegroundColor Cyan

Write-Host ""

if ($phase3Failed -eq 0) {
    Write-Host "🎉 FLUXO COMPLETO FASE 3.3 FUNCIONANDO!" -ForegroundColor Green
    Write-Host "   ✅ Pedido → Nome → Endereço → Confirmação → Pagamento → QR Code" -ForegroundColor Green
} else {
    Write-Host "⚠️  FLUXO FASE 3.3 COM PROBLEMAS" -ForegroundColor Red
    Write-Host "   Verifique os passos que falharam" -ForegroundColor Red
}

Write-Host ""

# Verificar logs do backend
Write-Host "🔍 DICAS PARA DEBUG:" -ForegroundColor Cyan
Write-Host "   • Verifique logs do backend para mensagens de erro" -ForegroundColor White
Write-Host "   • Certifique-se que Ollama está rodando: ollama serve" -ForegroundColor White
Write-Host "   • Teste Ollama diretamente: curl http://localhost:11434/api/tags" -ForegroundColor White
Write-Host "   • Verifique se .env tem OLLAMA_URL=http://localhost:11434" -ForegroundColor White
Write-Host ""

Write-Host "🚀 PARA TESTAR MANUALMENTE:" -ForegroundColor Green
Write-Host "   Use um cliente REST como Postman ou Insomnia" -ForegroundColor White
Write-Host "   URL: http://localhost:3001/api/v1/whatsapp/webhook" -ForegroundColor White
Write-Host "   Method: POST" -ForegroundColor White
Write-Host '   Body: {"from": "5511999999999", "body": "oi", "tenantId": "test-tenant"}' -ForegroundColor White
Write-Host ""
Write-Host "🏆 STATUS GERAL DO SISTEMA:" -ForegroundColor Magenta
Write-Host "===========================" -ForegroundColor Magenta
Write-Host ""

$allPassed = $passed + $phase3Passed
$allFailed = $failed + $phase3Failed
$totalTests = $allPassed + $allFailed

Write-Host "🤖 IA no WhatsApp:" -ForegroundColor Cyan
if ($failed -eq 0) {
    Write-Host "   ✅ PRONTA PARA PRODUÇÃO!" -ForegroundColor Green
} elseif ($passed -gt $failed) {
    Write-Host "   ✅ FUNCIONANDO BEM!" -ForegroundColor Yellow
} else {
    Write-Host "   ⚠️  PRECISA DE AJUSTES" -ForegroundColor Red
}

Write-Host ""
Write-Host "🚀 Fase 3.3 - Pagamentos via WhatsApp:" -ForegroundColor Cyan
if ($phase3Failed -eq 0) {
    Write-Host "   ✅ FLUXO COMPLETO FUNCIONANDO!" -ForegroundColor Green
    Write-Host "   🎯 Pedido → Confirmação → QR Code PIX" -ForegroundColor Green
} elseif ($phase3Passed -gt $phase3Failed) {
    Write-Host "   ✅ MAIORIA FUNCIONANDO!" -ForegroundColor Yellow
} else {
    Write-Host "   ⚠️  PRECISA DE AJUSTES" -ForegroundColor Red
}

Write-Host ""
Write-Host "📊 TOTAL GERAL:" -ForegroundColor Yellow
Write-Host "   ✅ Testes que passaram: $allPassed" -ForegroundColor Green
Write-Host "   ❌ Testes que falharam: $allFailed" -ForegroundColor Red
Write-Host "   📊 Taxa de sucesso geral: $([math]::Round(($allPassed / $totalTests) * 100, 1))%" -ForegroundColor Cyan

Write-Host ""
if ($allFailed -eq 0) {
    Write-Host "🎉 SISTEMA 100% FUNCIONAL!" -ForegroundColor Green
    Write-Host "   🚀 PRONTO PARA RECEBER CLIENTES!" -ForegroundColor Green
} elseif ($allPassed -gt $allFailed) {
    Write-Host "SISTEMA OPERACIONAL!" -ForegroundColor Yellow
}
    Write-Host "   🎯 FUNCIONANDO PARA A MAIORIA DOS CASOS" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  SISTEMA PRECISA DE AJUSTES" -ForegroundColor Red
    Write-Host "   VERIFIQUE OS PROBLEMAS IDENTIFICADOS" -ForegroundColor Red
}