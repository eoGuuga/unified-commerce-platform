# Testes Simples e Diretos - QA Senior
$baseUrl = "http://localhost:3001/api/v1/whatsapp/test"

$testes = @(
    "quero 5 brigadeiros",
    "me manda 3 boli",
    "quero uma duzia de brigadeiros",
    "desejo 1 bolo de chocolate",
    "faz 2 bolos de chocolate",
    "quero 5 bol",
    "preciso de bolos",
    "me manda 5 brigadinho",
    "quero uns brigadeiros",
    "manda 3 bolos de chocolate",
    "quero 2 bolo de chocolate",
    "preciso de 10 brigadeiro branco",
    "me manda 5 brigadeiro gourmet",
    "quero 3 beijinho",
    "preciso de 2 cajuzinho",
    "quero 5 brigadeiros por favor",
    "preciso de 10 brigadeiros, obrigado",
    "me manda 3 bolos, pf",
    "quero 2 bolos, pfv",
    "quero 5 brigadeiros?",
    "pode ser 3 bolos?",
    "quero 5 brigadero",
    "preciso de 2 bolos de choclate",
    "me manda 2 bolos de cenora",
    "quero um bolo de chocolate",
    "preciso de dois bolos de cenoura",
    "me manda tres brigadeiros",
    "quero cinco brigadeiros",
    "quero uma duzia de brigadeiros",
    "preciso de meia duzia de brigadeiros",
    "quero",
    "preciso de produto inexistente"
)

Write-Host "=== TESTES QA SENIOR ===" -ForegroundColor Cyan
Write-Host "Total: $($testes.Count) testes" -ForegroundColor Yellow
Write-Host ""

$sucesso = 0
$pergunta = 0
$erro = 0
$falhou = 0

foreach ($msg in $testes) {
    try {
        $body = @{message=$msg} | ConvertTo-Json
        $r = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
        
        if ($r.response -match "PEDIDO CRIADO") {
            Write-Host "OK [sucesso] '$msg'" -ForegroundColor Green
            $sucesso++
        } elseif ($r.response -match "Quantos|Qual|Voce quis dizer|Nao encontrei exatamente") {
            Write-Host "OK [pergunta] '$msg'" -ForegroundColor Yellow
            $pergunta++
        } elseif ($r.response -match "Nao encontrei|Estoque insuficiente") {
            Write-Host "OK [erro] '$msg'" -ForegroundColor Magenta
            $erro++
        } else {
            Write-Host "FALHOU [outro] '$msg'" -ForegroundColor Red
            $falhou++
        }
        
        Start-Sleep -Milliseconds 100
    } catch {
        Write-Host "ERRO: '$msg'" -ForegroundColor Red
        $falhou++
    }
}

Write-Host ""
Write-Host "=== RESUMO ===" -ForegroundColor Cyan
Write-Host "Sucessos: $sucesso" -ForegroundColor Green
Write-Host "Perguntas: $pergunta" -ForegroundColor Yellow
Write-Host "Erros esperados: $erro" -ForegroundColor Magenta
Write-Host "Falhas: $falhou" -ForegroundColor Red
$taxa = [math]::Round((($sucesso + $pergunta + $erro) / $testes.Count) * 100, 2)
Write-Host "Taxa de sucesso: $taxa%" -ForegroundColor $(if ($taxa -ge 90) { "Green" } else { "Yellow" })
