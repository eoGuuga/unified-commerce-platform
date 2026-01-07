# Testes Rigorosos - QA Senior com 70 anos de experiencia
# Testa TODOS os casos possiveis, edge cases, variações, erros, etc.

$baseUrl = "http://localhost:3001/api/v1/whatsapp/test"
$testResults = @()

# ========== CATEGORIA 1: FORMAS BASICAS DE PEDIR ==========
$categoria1 = @(
    @("quero 5 brigadeiros", "sucesso"),
    @("preciso de 10 brigadeiros", "sucesso"),
    @("vou querer 3 bolos de chocolate", "sucesso"),
    @("gostaria de 2 bolos de cenoura", "sucesso"),
    @("desejo 1 bolo de chocolate", "sucesso"),
    @("quero comprar 5 brigadeiros", "sucesso"),
    @("preciso comprar 10 brigadeiros", "sucesso"),
    @("vou comprar 3 bolos", "sucesso"),
    @("quero pedir 5 brigadeiros", "sucesso"),
    @("preciso pedir 10 brigadeiros", "sucesso")
)

# ========== CATEGORIA 2: FORMAS COLOQUIAIS BRASILEIRAS ==========
$categoria2 = @(
    @("me manda 5 brigadeiros", "sucesso"),
    @("manda 10 brigadeiros", "sucesso"),
    @("pode ser 3 bolos de chocolate?", "sucesso"),
    @("faz 1 bolo de cenoura pra mim", "sucesso"),
    @("me faz 2 bolos de chocolate", "sucesso"),
    @("pode me enviar 5 brigadeiros?", "sucesso"),
    @("tem como me enviar 3 bolos?", "sucesso"),
    @("da pra fazer 1 bolo de cenoura?", "sucesso"),
    @("da pra me enviar 5 brigadeiros?", "sucesso"),
    @("seria possivel 2 bolos?", "sucesso"),
    @("poderia me enviar 10 brigadeiros?", "sucesso"),
    @("me envia 5 brigadeiros", "sucesso"),
    @("envia 3 bolos", "sucesso"),
    @("pode me mandar 5 brigadeiros", "sucesso"),
    @("queria 3 bolos", "sucesso"),
    @("ia querer 2 brigadeiros", "sucesso")
)

# ========== CATEGORIA 3: QUANTIDADES POR EXTENSO ==========
$categoria3 = @(
    @("quero um bolo de chocolate", "sucesso"),
    @("preciso de dois bolos de cenoura", "sucesso"),
    @("me manda tres brigadeiros", "sucesso"),
    @("quero cinco brigadeiros", "sucesso"),
    @("preciso de dez bolos de chocolate", "sucesso"),
    @("quero vinte brigadeiros", "sucesso"),
    @("preciso de trinta bolos", "sucesso"),
    @("me manda uma bolo", "sucesso"),
    @("quero duas bolos", "sucesso")
)

# ========== CATEGORIA 4: EXPRESSOES DE QUANTIDADE ==========
$categoria4 = @(
    @("quero uma duzia de brigadeiros", "sucesso"),
    @("preciso de meia duzia de brigadeiros", "sucesso"),
    @("me manda um quilo de brigadeiros", "sucesso"),
    @("quero 500g de brigadeiros", "sucesso"),
    @("preciso de 1kg de brigadeiros", "sucesso")
)

# ========== CATEGORIA 5: QUANTIDADES INDEFINIDAS ==========
$categoria5 = @(
    @("quero uns brigadeiros", "sucesso"),
    @("preciso de algumas bolos", "sucesso"),
    @("me manda varios brigadeiros", "sucesso"),
    @("quero um monte de brigadeiros", "sucesso"),
    @("preciso de muitos bolos", "sucesso"),
    @("me manda varias bolos", "sucesso")
)

# ========== CATEGORIA 6: VARIAÇÕES DE PRODUTOS ==========
$categoria6 = @(
    @("quero 5 brigadeiro", "sucesso"),
    @("preciso de 2 bolo", "sucesso"),
    @("me manda 3 bolos de chocolate", "sucesso"),
    @("quero 1 bolo de cenoura", "sucesso"),
    @("preciso de 10 brigadeiro branco", "sucesso"),
    @("me manda 5 brigadeiro gourmet", "sucesso")
)

# ========== CATEGORIA 7: COM CORTESIA ==========
$categoria7 = @(
    @("quero 5 brigadeiros por favor", "sucesso"),
    @("preciso de 10 brigadeiros, obrigado", "sucesso"),
    @("me manda 3 bolos, pf", "sucesso"),
    @("quero 2 bolos, pfv", "sucesso"),
    @("preciso de 5 brigadeiros, obg", "sucesso"),
    @("me manda 3 bolos, vlw", "sucesso"),
    @("quero 5 brigadeiros, por favor", "sucesso"),
    @("preciso de 10 brigadeiros, obrigada", "sucesso")
)

# ========== CATEGORIA 8: COM INTERROGAÇÕES ==========
$categoria8 = @(
    @("quero 5 brigadeiros?", "sucesso"),
    @("pode ser 3 bolos?", "sucesso"),
    @("tem como me enviar 10 brigadeiros?", "sucesso"),
    @("da pra fazer 1 bolo?", "sucesso"),
    @("seria possivel 2 bolos?", "sucesso")
)

# ========== CATEGORIA 9: ERROS DE DIGITAÇÃO PEQUENOS ==========
$categoria9 = @(
    @("quero 5 brigadero", "sucesso"),
    @("preciso de 2 bolos de choclate", "sucesso"),
    @("me manda 2 bolos de cenora", "sucesso"),
    @("quero 3 bolos de choclate", "sucesso"),
    @("preciso de 10 brigadero", "sucesso"),
    @("me manda 5 brigadero branco", "sucesso"),
    @("quero 3 bolos de cenora", "sucesso")
)

# ========== CATEGORIA 10: ERROS DE DIGITAÇÃO GRANDES (DEVE PERGUNTAR) ==========
$categoria10 = @(
    @("me manda 3 boli", "pergunta"),
    @("quero 5 bol", "pergunta"),
    @("preciso de 2 bol", "pergunta"),
    @("me manda 10 brig", "pergunta"),
    @("quero 3 bol", "pergunta"),
    @("preciso de brig", "pergunta")
)

# ========== CATEGORIA 11: DIMINUTIVOS ==========
$categoria11 = @(
    @("me manda 5 brigadinho", "sucesso"),
    @("quero 2 bolinho", "pergunta"),
    @("preciso de 3 beijinho", "sucesso"),
    @("me manda 10 cajuzinho", "sucesso")
)

# ========== CATEGORIA 12: CASOS ESPECIAIS - DEVE PERGUNTAR ==========
$categoria12 = @(
    @("quero brigadeiros", "pergunta"),
    @("preciso de bolos", "pergunta"),
    @("me manda 5", "pergunta"),
    @("quero bolo", "pergunta"),
    @("preciso de brigadeiro", "pergunta"),
    @("me manda produto", "pergunta"),
    @("quero algo", "pergunta")
)

# ========== CATEGORIA 13: CASOS ESPECIAIS - DEVE RETORNAR ERRO ==========
$categoria13 = @(
    @("quero", "erro"),
    @("preciso de produto inexistente", "erro"),
    @("me manda 1000 brigadeiros", "erro"),
    @("quero produto que nao existe", "erro"),
    @("preciso de xyz", "erro"),
    @("me manda abc", "erro")
)

# ========== CATEGORIA 14: CASOS EXTREMOS ==========
$categoria14 = @(
    @("quero 999999 brigadeiros", "erro"),
    @("preciso de -5 bolos", "erro"),
    @("me manda 0 brigadeiros", "pergunta"),
    @("quero um milhao de bolos", "erro"),
    @("preciso de infinito brigadeiros", "erro")
)

# ========== CATEGORIA 15: VARIAÇÕES LINGUÍSTICAS REGIONAIS ==========
$categoria15 = @(
    @("quero 5 brigadeiros, pode ser?", "sucesso"),
    @("preciso de 3 bolos, da certo?", "sucesso"),
    @("me manda 10 brigadeiros, faz favor", "sucesso"),
    @("quero 2 bolos, se der", "sucesso"),
    @("preciso de 5 brigadeiros, se puder", "sucesso")
)

# Combinar todas as categorias
$testes = $categoria1 + $categoria2 + $categoria3 + $categoria4 + $categoria5 + 
          $categoria6 + $categoria7 + $categoria8 + $categoria9 + $categoria10 + 
          $categoria11 + $categoria12 + $categoria13 + $categoria14 + $categoria15

Write-Host "=== TESTES RIGOROSOS - QA SENIOR ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total de testes: $($testes.Count)" -ForegroundColor Yellow
Write-Host "Categorias: 15" -ForegroundColor Yellow
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
        
        Start-Sleep -Milliseconds 50
        
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
Write-Host "=== RESUMO FINAL - QA SENIOR ===" -ForegroundColor Cyan
Write-Host "✅ Sucessos: $sucesso" -ForegroundColor Green
Write-Host "❓ Perguntas: $pergunta" -ForegroundColor Yellow
Write-Host "❌ Erros (esperados): $erro" -ForegroundColor Magenta
Write-Host "❌ Falhas (inesperadas): $falhou" -ForegroundColor Red
Write-Host ""
$taxaSucesso = [math]::Round((($sucesso + $pergunta + $erro) / $testes.Count) * 100, 2)
Write-Host "Taxa de sucesso: $taxaSucesso%" -ForegroundColor $(if ($taxaSucesso -ge 90) { "Green" } elseif ($taxaSucesso -ge 70) { "Yellow" } else { "Red" })
Write-Host "Total: $($testes.Count) | Passou: $($sucesso + $pergunta + $erro) | Falhou: $falhou" -ForegroundColor $(if ($falhou -eq 0) { "Green" } else { "Red" })

# Exportar resultados
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$jsonFile = "test-qa-senior-results-$timestamp.json"
$testResults | ConvertTo-Json -Depth 3 | Out-File -FilePath $jsonFile -Encoding UTF8
Write-Host ""
Write-Host "Resultados salvos" -ForegroundColor Cyan
