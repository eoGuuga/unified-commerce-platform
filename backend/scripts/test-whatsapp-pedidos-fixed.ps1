# Script de Testes Automatizados - FASE 3.2 Melhorada
# Testa diversos exemplos reais de pedidos brasileiros

$baseUrl = "http://localhost:3001/api/v1/whatsapp/test"
$testResults = @()

# Array de testes: [mensagem, esperado (sucesso/erro/pergunta)]
$testes = @(
    # Formas Básicas
    @("quero 5 brigadeiros", "sucesso"),
    @("preciso de 10 brigadeiros", "sucesso"),
    @("vou querer 3 bolos de chocolate", "sucesso"),
    @("gostaria de 2 bolos de cenoura", "sucesso"),
    @("desejo 1 bolo de chocolate", "sucesso"),
    
    # Formas Coloquiais
    @("me manda 5 brigadeiros", "sucesso"),
    @("manda 10 brigadeiros", "sucesso"),
    @("pode ser 3 bolos de chocolate?", "sucesso"),
    @("faz 1 bolo de cenoura pra mim", "sucesso"),
    @("me faz 2 bolos de chocolate", "sucesso"),
    @("pode me enviar 5 brigadeiros?", "sucesso"),
    @("tem como me enviar 3 bolos?", "sucesso"),
    @("dá pra fazer 1 bolo de cenoura?", "sucesso"),
    @("dá pra me enviar 5 brigadeiros?", "sucesso"),
    @("seria possível 2 bolos?", "sucesso"),
    @("poderia me enviar 10 brigadeiros?", "sucesso"),
    
    # Quantidades por Extenso
    @("quero um bolo de chocolate", "sucesso"),
    @("preciso de dois bolos de cenoura", "sucesso"),
    @("me manda três brigadeiros", "sucesso"),
    @("quero cinco brigadeiros", "sucesso"),
    @("preciso de dez bolos de chocolate", "sucesso"),
    
    # Expressões de Quantidade
    @("quero uma dúzia de brigadeiros", "sucesso"),
    @("preciso de meia dúzia de brigadeiros", "sucesso"),
    @("me manda um quilo de brigadeiros", "sucesso"),
    
    # Quantidades Indefinidas
    @("quero uns brigadeiros", "sucesso"),
    @("preciso de algumas bolos", "sucesso"),
    @("me manda vários brigadeiros", "sucesso"),
    
    # Variações de Produtos
    @("quero 5 brigadeiro", "sucesso"),
    @("preciso de 2 bolo", "sucesso"),
    @("me manda 3 bolos de chocolate", "sucesso"),
    
    # Com Cortesia
    @("quero 5 brigadeiros por favor", "sucesso"),
    @("preciso de 10 brigadeiros, obrigado", "sucesso"),
    @("me manda 3 bolos, pf", "sucesso"),
    @("quero 2 bolos, pfv", "sucesso"),
    
    # Com Interrogações
    @("quero 5 brigadeiros?", "sucesso"),
    @("pode ser 3 bolos?", "sucesso"),
    
    # Erros Comuns de Digitação
    @("quero 5 brigadero", "sucesso"),
    @("preciso de 2 bolos de choclate", "sucesso"),
    @("me manda 3 boli", "pergunta"),
    @("quero 5 bol", "pergunta"),
    @("preciso de 10 brigadero", "sucesso"),
    @("me manda 2 bolos de cenora", "sucesso"),
    @("quero 3 bolos de choclate", "sucesso"),
    @("preciso de 1 bolo de cenoura", "sucesso"),
    @("me manda 5 brigadinho", "sucesso"),
    @("quero 2 bolinho", "pergunta"),
    
    # Casos Especiais - Deve Perguntar
    @("quero brigadeiros", "pergunta"),
    @("preciso de bolos", "pergunta"),
    @("me manda 5", "pergunta"),
    
    # Casos Especiais - Deve Retornar Erro
    @("quero", "erro"),
    @("preciso de produto inexistente", "erro")
)

Write-Host "=== TESTES AUTOMATIZADOS - FASE 3.2 MELHORADA ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total de testes: $($testes.Count)" -ForegroundColor Yellow
Write-Host ""

$sucesso = 0
$erro = 0
$pergunta = 0
$falhou = 0

foreach ($teste in $testes) {
    $mensagem = $teste[0]
    $esperado = $teste[1]
    
    try {
        $body = @{
            message = $mensagem
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
        
        $resposta = $response.response
        
        # Determinar resultado real
        $resultadoReal = "erro"
        if ($resposta -match "PEDIDO CRIADO COM SUCESSO") {
            $resultadoReal = "sucesso"
        } elseif ($resposta -match "Quantos|Qual produto|Nao consegui entender|Voce quis dizer") {
            $resultadoReal = "pergunta"
        } elseif ($resposta -match "Nao encontrei|Estoque insuficiente") {
            $resultadoReal = "erro"
        }
        
        # Verificar se corresponde ao esperado
        $status = if ($resultadoReal -eq $esperado) { "OK" } else { "FALHOU" }
        
        if ($resultadoReal -eq $esperado) {
            switch ($esperado) {
                "sucesso" { $sucesso++ }
                "pergunta" { $pergunta++ }
                "erro" { $erro++ }
            }
        } else {
            $falhou++
        }
        
        Write-Host "$status [$resultadoReal] '$mensagem'" -ForegroundColor $(if ($status -eq "OK") { "Green" } else { "Red" })
        
        $testResults += @{
            Mensagem = $mensagem
            Esperado = $esperado
            Real = $resultadoReal
            Status = $status
            Resposta = $resposta
        }
        
        Start-Sleep -Milliseconds 200
        
    } catch {
        Write-Host "ERRO ao testar '$mensagem': $_" -ForegroundColor Red
        $falhou++
    }
}

Write-Host ""
Write-Host "=== RESUMO DOS TESTES ===" -ForegroundColor Cyan
Write-Host "Sucessos: $sucesso" -ForegroundColor Green
Write-Host "Perguntas: $pergunta" -ForegroundColor Yellow
Write-Host "Erros (esperados): $erro" -ForegroundColor Magenta
Write-Host "Falhas (inesperadas): $falhou" -ForegroundColor Red
Write-Host ""
Write-Host "Total: $($testes.Count) | Passou: $($sucesso + $pergunta + $erro) | Falhou: $falhou" -ForegroundColor $(if ($falhou -eq 0) { "Green" } else { "Red" })

# Exportar resultados
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$jsonFile = "test-results-$timestamp.json"
$testResults | ConvertTo-Json -Depth 3 | Out-File -FilePath $jsonFile -Encoding UTF8
Write-Host "Resultados exportados para: $jsonFile" -ForegroundColor Cyan
