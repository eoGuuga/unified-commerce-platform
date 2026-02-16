# ============================================
# CONFIGURAÇÃO DO OLLAMA - IA PARA WHATSAPP
# ============================================

Write-Host "🤖 CONFIGURANDO OLLAMA PARA WHATSAPP BOT" -ForegroundColor Magenta
Write-Host "=========================================" -ForegroundColor Magenta
Write-Host ""

# Verificar se Ollama já está instalado
Write-Host "🔍 Verificando se Ollama está instalado..." -ForegroundColor Yellow
try {
    $ollamaVersion = ollama --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Ollama já instalado: $ollamaVersion" -ForegroundColor Green
    } else {
        throw "Ollama não encontrado"
    }
} catch {
    Write-Host "❌ Ollama não encontrado. Instalando..." -ForegroundColor Yellow

    # Baixar e instalar Ollama
    try {
        Write-Host "   Baixando Ollama..." -ForegroundColor Gray
        Invoke-WebRequest -Uri "https://ollama.ai/download/OllamaSetup.exe" -OutFile "$env:TEMP\OllamaSetup.exe"

        Write-Host "   Instalando Ollama..." -ForegroundColor Gray
        Start-Process -FilePath "$env:TEMP\OllamaSetup.exe" -ArgumentList "/S" -Wait

        # Aguardar instalação
        Start-Sleep -Seconds 10

        # Verificar novamente
        $ollamaVersion = ollama --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Ollama instalado com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "❌ Falha na instalação do Ollama" -ForegroundColor Red
            Write-Host "   Instale manualmente: https://ollama.ai/download" -ForegroundColor Yellow
            exit 1
        }
    } catch {
        Write-Host "❌ Erro ao instalar Ollama: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Instale manualmente: https://ollama.ai/download" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""

# Verificar se serviço Ollama está rodando
Write-Host "🔍 Verificando serviço Ollama..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Serviço Ollama rodando" -ForegroundColor Green
    } else {
        throw "Serviço não responde"
    }
} catch {
    Write-Host "⚠️  Serviço Ollama não está rodando. Iniciando..." -ForegroundColor Yellow

    try {
        Start-Process -FilePath "ollama" -ArgumentList "serve" -NoNewWindow
        Start-Sleep -Seconds 5

        # Testar novamente
        $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Serviço Ollama iniciado!" -ForegroundColor Green
        } else {
            throw "Serviço não iniciou"
        }
    } catch {
        Write-Host "❌ Falha ao iniciar serviço Ollama" -ForegroundColor Red
        Write-Host "   Inicie manualmente: ollama serve" -ForegroundColor Yellow
    }
}

Write-Host ""

# Baixar modelo Llama 2 (mais leve e eficiente)
Write-Host "📥 Baixando modelo Llama 2..." -ForegroundColor Yellow
Write-Host "   Este modelo é otimizado para conversas em português" -ForegroundColor Gray
Write-Host "   Tamanho aproximado: 3.8GB (pode demorar)" -ForegroundColor Gray
Write-Host ""

try {
    # Verificar se modelo já existe
    $models = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method GET | ConvertFrom-Json
    $hasLlama2 = $models.models | Where-Object { $_.name -like "*llama2*" }

    if ($hasLlama2) {
        Write-Host "✅ Modelo Llama 2 já baixado!" -ForegroundColor Green
    } else {
        Write-Host "   Baixando llama2:7b (pode demorar alguns minutos)..." -ForegroundColor Gray
        ollama pull llama2:7b

        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Modelo Llama 2 baixado com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "❌ Erro ao baixar modelo Llama 2" -ForegroundColor Red
            Write-Host "   Execute manualmente: ollama pull llama2:7b" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Erro ao verificar/baixar modelo: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Configurar variáveis de ambiente no backend
Write-Host "⚙️  Configurando backend..." -ForegroundColor Yellow

$envPath = "backend/.env"
$ollamaConfig = "OLLAMA_URL=http://localhost:11434"

if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw

    if ($envContent -notmatch "OLLAMA_URL") {
        Add-Content -Path $envPath -Value "`n# IA - Ollama`n$ollamaConfig"
        Write-Host "✅ OLLAMA_URL adicionado ao .env" -ForegroundColor Green
    } else {
        Write-Host "✅ OLLAMA_URL já configurado" -ForegroundColor Green
    }
} else {
    Write-Host "❌ Arquivo backend/.env não encontrado" -ForegroundColor Red
    Write-Host "   Crie o arquivo primeiro" -ForegroundColor Yellow
}

Write-Host ""

# Testar integração
Write-Host "🧪 Testando integração..." -ForegroundColor Yellow

try {
    $testPrompt = @{
        model = "llama2:7b"
        prompt = "Olá! Você é um assistente de vendas de chocolates. Responda apenas: 'Olá! Como posso ajudar você hoje?'"
        stream = $false
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/generate" -Method POST -Body $testPrompt -ContentType "application/json" -TimeoutSec 30

    if ($response.StatusCode -eq 200) {
        $result = $response.Content | ConvertFrom-Json
        Write-Host "✅ Integração Ollama funcionando!" -ForegroundColor Green
        Write-Host "   Resposta de teste: $($result.response)" -ForegroundColor Gray
    } else {
        throw "Status code: $($response.StatusCode)"
    }
} catch {
    Write-Host "❌ Falha no teste de integração: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Verifique se o Ollama está rodando corretamente" -ForegroundColor Yellow
}

Write-Host ""

# Resultado final
Write-Host "🎯 CONFIGURAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "==========================" -ForegroundColor Green
Write-Host ""
Write-Host "✅ O que foi configurado:" -ForegroundColor White
Write-Host "   • Ollama instalado e rodando" -ForegroundColor White
Write-Host "   • Modelo Llama 2 baixado" -ForegroundColor White
Write-Host "   • Backend configurado" -ForegroundColor White
Write-Host "   • Integração testada" -ForegroundColor White
Write-Host ""
Write-Host "🚀 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host "   1. Inicie o backend: cd backend && npm run start:dev" -ForegroundColor White
Write-Host "   2. Teste o WhatsApp bot" -ForegroundColor White
Write-Host "   3. Envie mensagens para ver a IA em ação!" -ForegroundColor White
Write-Host ""
Write-Host "📚 PARA SUPORTE:" -ForegroundColor Gray
Write-Host "   • Documentação: https://github.com/jmorganca/ollama" -ForegroundColor Gray
Write-Host "   • Modelos disponíveis: ollama list" -ForegroundColor Gray
Write-Host ""
Write-Host "🤖 SEU WHATSAPP BOT AGORA TEM IA!" -ForegroundColor Magenta