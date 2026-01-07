# Testes Extensivos - FASE 3.2
# Testa TODOS os casos possíveis

$baseUrl = "http://localhost:3001/api/v1/whatsapp/test"
$testResults = @()

# Array completo de testes
$testes = @(
    # ========== FORMAS BÁSICAS ==========
    @("quero 5 brigadeiros", "sucesso"),
    @("preciso de 10 brigadeiros", "sucesso"),
    @("vou querer 3 bolos de chocolate", "sucesso"),
    @("gostaria de 2 bolos de cenoura", "sucesso"),
    @("desejo 1 bolo de chocolate", "sucesso"),
    
    # ========== FORMAS COLOQUIAIS ==========
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
    @("me envia 5 brigadeiros", "sucesso"),
    @("envia 3 bolos", "sucesso"),
    
    # ========== QUANTIDADES POR EXTENSO ==========
    @("quero um bolo de chocolate", "sucesso"),
    @("preciso de dois bolos de cenoura", "sucesso"),
    @("me manda três brigadeiros", "sucesso"),
    @("quero cinco brigadeiros", "sucesso"),
    @("preciso de dez bolos de chocolate", "sucesso"),
    @("quero vinte brigadeiros", "sucesso"),
    
    # ========== EXPRESSÕES DE QUANTIDADE ==========
    @("quero uma dúzia de brigadeiros", "sucesso"),
    @("preciso de meia dúzia de brigadeiros", "sucesso"),
    @("me manda um quilo de brigadeiros", "sucesso"),
    
    # ========== QUANTIDADES INDEFINIDAS ==========
    @("quero uns brigadeiros", "sucesso"),
    @("preciso de algumas bolos", "sucesso"),
    @("me manda vários brigadeiros", "sucesso"),
    @("quero um monte de brigadeiros", "sucesso"),
    
    # ========== VARIAÇÕES DE PRODUTOS ==========
    @("quero 5 brigadeiro", "sucesso"),
    @("preciso de 2 bolo", "sucesso"),
    @("me manda 3 bolos de chocolate", "sucesso"),
    @("quero 1 bolo de cenoura", "sucesso"),
    
    # ========== COM CORTESIA ==========
    @("quero 5 brigadeiros por favor", "sucesso"),
    @("preciso de 10 brigadeiros, obrigado", "sucesso"),
    @("me manda 3 bolos, pf", "sucesso"),
    @("quero 2 bolos, pfv", "sucesso"),
    @("preciso de 5 brigadeiros, obg", "sucesso"),
    @("me manda 3 bolos, vlw", "sucesso"),
    
    # ========== COM INTERROGAÇÕES ==========
    @("quero 5 brigadeiros?", "sucesso"),
    @("pode ser 3 bolos?", "sucesso"),
    @("tem como me enviar 10 brigadeiros?", "sucesso"),
    
    # ========== ERROS DE DIGITAÇÃO (PEQUENOS) ==========
    @("quero 5 brigadero", "sucesso"),
    @("preciso de 2 bolos de choclate", "sucesso"),
    @("me manda 2 bolos de cenora", "sucesso"),
    @("quero 3 bolos de choclate", "sucesso"),
    @("preciso de 10 brigadero", "sucesso"),
    
    # ========== ERROS DE DIGITAÇÃO (GRANDES - DEVE PERGUNTAR) ==========
    @("me manda 3 boli", "pergunta"),
    @("quero 5 bol", "pergunta"),
    @("preciso de 2 bol", "pergunta"),
    @("me manda 10 brig", "pergunta"),
    
    # ========== DIMINUTIVOS ==========
    @("me manda 5 brigadinho", "sucesso"),
    @("quero 2 bolinho", "pergunta"),
    @("preciso de 3 beijinho", "sucesso"),
    
    # ========== CASOS ESPECIAIS - DEVE PERGUNTAR ==========
    @("quero brigadeiros", "pergunta"),
    @("preciso de bolos", "pergunta"),
    @("me manda 5", "pergunta"),
    @("quero bolo", "pergunta"),
    @("preciso de brigadeiro", "pergunta"),
    
    # ========== CASOS ESPECIAIS - DEVE RETORNAR ERRO ==========
    @("quero", "erro"),
    @("preciso de produto inexistente", "erro"),
    @("me manda 1000 brigadeiros", "erro"),
    @("quero produto que nao existe", "erro")
)

Write-Host "=== TESTES EXTENSIVOS - FASE 3.2 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total de testes: $($testes.Count)" -ForegroundColor Yellow
Write-Host ""

$sucesso = 0
$erro = 0
$pergunta = 0
$falhou = 0
$totalTestados = 0

foreach ($teste in $testes) {
    $mensagem = $teste[0]
    $esperado = $teste[1]
    $totalTestados++
    
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
        } elseif ($resposta -match "Quantos|Qual produto|Nao consegui entender|Voce quis dizer|Nao encontrei exatamente") {
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
        
        $cor = if ($status -eq "OK") { "Green" } else { "Red" }
        Write-Host "[$totalTestados/$($testes.Count)] $status [$resultadoReal] '$mensagem'" -ForegroundColor $cor
        
        $testResults += @{
            Mensagem = $mensagem
            Esperado = $esperado
            Real = $resultadoReal
            Status = $status
            Resposta = $resposta
        }
        
        Start-Sleep -Milliseconds 100
        
    } catch {
        Write-Host "[$totalTestados/$($testes.Count)] ERRO ao testar '$mensagem': $_" -ForegroundColor Red
        $falhou++
        $testResults += @{
            Mensagem = $mensagem
            Esperado = $esperado
            Real = "erro_teste"
            Status = "ERRO"
            Resposta = $_.ToString()
        }
    }
}

Write-Host ""
Write-Host "=== RESUMO FINAL ===" -ForegroundColor Cyan
Write-Host "✅ Sucessos: $sucesso" -ForegroundColor Green
Write-Host "❓ Perguntas: $pergunta" -ForegroundColor Yellow
Write-Host "❌ Erros (esperados): $erro" -ForegroundColor Magenta
Write-Host "❌ Falhas (inesperadas): $falhou" -ForegroundColor Red
Write-Host ""
$taxaSucesso = [math]::Round((($sucesso + $pergunta + $erro) / $testes.Count) * 100, 2)
Write-Host "Taxa de sucesso: $taxaSucesso%" -ForegroundColor $(if ($taxaSucesso -ge 80) { "Green" } else { "Yellow" })
Write-Host "Total: $($testes.Count) | Passou: $($sucesso + $pergunta + $erro) | Falhou: $falhou" -ForegroundColor $(if ($falhou -eq 0) { "Green" } else { "Red" })

# Exportar resultados
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$jsonFile = "test-extensivo-results-$timestamp.json"
$testResults | ConvertTo-Json -Depth 3 | Out-File -FilePath $jsonFile -Encoding UTF8
Write-Host ""
Write-Host "Resultados salvos" -ForegroundColor Cyan
