param(
    [string]$BaseUrl = "https://dev.gtsofthub.com.br/api/v1/whatsapp/test",
    [string]$TenantId = "00000000-0000-0000-0000-000000000000"
)

$ErrorActionPreference = 'Stop'

function Invoke-WhatsappTest {
    param(
        [string]$Phone,
        [string]$Message
    )

    $body = @{
        message = $Message
        tenantId = $TenantId
        phoneNumber = $Phone
    } | ConvertTo-Json -Compress

    return Invoke-RestMethod -Uri $BaseUrl -Method Post -ContentType "application/json" -Body $body
}

$catalogResponse = Invoke-WhatsappTest -Phone "+5511998899900" -Message "cardapio"
$catalogLines = [string]$catalogResponse.response -split "`n"
$preferredProductLine = $catalogLines | Where-Object { $_ -like "- Produto Teste*" } | Select-Object -First 1
$primaryProductLine = if ($preferredProductLine) { $preferredProductLine } else { $catalogLines | Where-Object { $_ -like "- *" } | Select-Object -First 1 }
if (-not $primaryProductLine) {
    throw "Nao consegui descobrir um produto valido pelo cardapio para a bateria de hardening."
}

$primaryProduct = ($primaryProductLine -replace "^- ", "") -replace "\s+\|\s+R\$.+$", ""
$secondaryProductLine = $catalogLines | Where-Object { $_ -like "- *" -and $_ -ne $primaryProductLine } | Select-Object -First 1
$secondaryProduct = if ($secondaryProductLine) {
    ($secondaryProductLine -replace "^- ", "") -replace "\s+\|\s+R\$.+$", ""
} else {
    $primaryProduct
}
$orderMessage = "quero 1 $primaryProduct"
$lowLiteracyMessage = "qro 1 $primaryProduct"
$hostileMessage = "<script>alert(1)</script> qro 1 $primaryProduct"
$phonePrefix = Get-Random -Minimum 1000 -Maximum 9999

$results = @()

$scenarios = @(
    @{
        Name = "bare_order"
        Steps = @(
            @{ Message = "quero???"; Expect = "quantidade + produto" }
        )
    },
    @{
        Name = "zero_quantity"
        Steps = @(
            @{ Message = "quero 0 brigadeiros"; Expect = "Quantidade minima e 1" }
        )
    },
    @{
        Name = "negative_quantity"
        Steps = @(
            @{ Message = "quero -1 brigadeiro"; Expect = "Quantidade minima e 1" }
        )
    },
    @{
        Name = "cancel_without_order"
        Steps = @(
            @{ Message = "cancelar"; Expect = "Nao encontrei um pedido pendente para cancelar" }
        )
    },
    @{
        Name = "soft_cancel_without_context"
        Steps = @(
            @{ Message = "nao vou querer mais"; ExpectAny = @("Sem problema.", "Nao quero te deixar preso", "Como posso ajudar", "Nao encontrei um pedido pendente", "Pedido interrompido com sucesso") }
        )
    },
    @{
        Name = "regional_negative_without_context"
        Steps = @(
            @{ Message = "num vou querer mais"; ExpectAny = @("Sem problema.", "Nao quero te deixar preso", "Como posso ajudar") }
        )
    },
    @{
        Name = "status_without_context"
        Steps = @(
            @{ Message = "cade meu pedido"; ExpectAny = @("ACOMPANHAR PEDIDO", "Portal de acompanhamento") }
        )
    },
    @{
        Name = "low_literacy_keyword"
        Steps = @(
            @{ Message = $lowLiteracyMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "REVISAO FINAL DO PEDIDO", "No momento esse item ficou sem estoque") }
        )
    },
    @{
        Name = "hostile_payload"
        Steps = @(
            @{ Message = $hostileMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "REVISAO FINAL DO PEDIDO", "No momento esse item ficou sem estoque") }
        )
    },
    @{
        Name = "reserved_name_guard"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "No momento esse item ficou sem estoque") }
            @{ Message = "sim"; Expect = "Preciso do nome da pessoa, nao de um comando" }
        )
    },
    @{
        Name = "payment_shortcut"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "No momento esse item ficou sem estoque") }
            @{ Message = "Cliente Perfeito"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "retirada"; Expect = "TELEFONE DE CONTATO" }
            @{ Message = "11999999999"; Expect = "OBSERVACOES DO PEDIDO" }
            @{ Message = "pix"; ExpectAny = @("PAGAMENTO PIX", "Acompanhamento completo") }
        )
    },
    @{
        Name = "audio_style_order_with_payment_words"
        Steps = @(
            @{ Message = "me ve meia dz de $primaryProduct pra retirar no pix"; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "REVISAO FINAL DO PEDIDO") }
        )
    },
    @{
        Name = "multi_item_written_quantity"
        Steps = @(
            @{ Message = "quero 1 $primaryProduct e um $secondaryProduct"; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "REVISAO FINAL DO PEDIDO", "Estoque insuficiente") }
        )
    },
    @{
        Name = "payment_keyword_noise"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "No momento esse item ficou sem estoque") }
            @{ Message = "Cliente Ruido"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "retirada"; Expect = "TELEFONE DE CONTATO" }
            @{ Message = "11988887777"; Expect = "OBSERVACOES DO PEDIDO" }
            @{ Message = "piks"; ExpectAny = @("PAGAMENTO PIX", "Acompanhamento completo") }
        )
    },
    @{
        Name = "status_and_cancel_after_pending_order"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo") }
            @{ Message = "Maria Serena"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "retirada"; Expect = "TELEFONE DE CONTATO" }
            @{ Message = "11977776666"; Expect = "OBSERVACOES DO PEDIDO" }
            @{ Message = "pix"; ExpectAny = @("PAGAMENTO PIX", "Acompanhamento completo") }
            @{ Message = "cade meu pedido"; ExpectAny = @("ACOMPANHAMENTO DO PEDIDO", "Status atual") }
            @{ Message = "onde ta minha encomeda"; ExpectAny = @("ACOMPANHAMENTO DO PEDIDO", "Status atual") }
            @{ Message = "cancela meu pedido"; ExpectAny = @("cancelado", "atendimento humano") }
        )
    },
    @{
        Name = "soft_cancel_with_context"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo") }
            @{ Message = "Ana Clara"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "retirada"; Expect = "TELEFONE DE CONTATO" }
            @{ Message = "11966665555"; Expect = "OBSERVACOES DO PEDIDO" }
            @{ Message = "pix"; ExpectAny = @("PAGAMENTO PIX", "Acompanhamento completo") }
            @{ Message = "nao vou querer mais"; ExpectAny = @("cancelado", "atendimento humano") }
        )
    },
    @{
        Name = "duplicate_actionable_message"
        Steps = @(
            @{ Message = "cardapio"; ExpectAny = @("CARDAPIO", "catalogo", "- ") }
            @{ Message = "cardapio"; ExpectAny = @("evitando duplicidade", "Ultima orientacao") }
        )
    },
    @{
        Name = "abusive_without_action"
        Steps = @(
            @{ Message = "vai tomar no cu"; ExpectAny = @("objetiva e respeitosa", "Se quiser seguir") }
        )
    },
    @{
        Name = "abusive_with_valid_order"
        Steps = @(
            @{ Message = "porra quero 1 $primaryProduct e um $secondaryProduct"; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "REVISAO FINAL DO PEDIDO", "Estoque insuficiente") }
        )
    }
)

for ($scenarioIndex = 0; $scenarioIndex -lt $scenarios.Count; $scenarioIndex++) {
    $scenario = $scenarios[$scenarioIndex]
    $phone = "+5511{0:d4}{1:d4}" -f $phonePrefix, ($scenarioIndex + 3000)

    foreach ($step in $scenario.Steps) {
        $response = Invoke-WhatsappTest -Phone $phone -Message $step.Message
        $text = [string]$response.response

        $passed = $true
        if ($step.ContainsKey("Expect")) {
            $passed = $text.Contains([string]$step.Expect)
        }

        if ($passed -and $step.ContainsKey("ExpectAny")) {
            $passed = $false
            foreach ($fragment in $step.ExpectAny) {
                if ($text.Contains([string]$fragment)) {
                    $passed = $true
                    break
                }
            }
        }

        $results += [pscustomobject]@{
            scenario = $scenario.Name
            message = $step.Message
            passed = $passed
            response = $text
        }
    }
}

$results | Format-Table -AutoSize

$failed = @($results | Where-Object { -not $_.passed })
if ($failed.Count -gt 0) {
    Write-Error "Falharam $($failed.Count) verificacoes da bateria de hardening do WhatsApp."
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputPath = "test-whatsapp-hardening-results-$timestamp.json"
$results | ConvertTo-Json -Depth 4 | Out-File -FilePath $outputPath -Encoding UTF8
Write-Host "Resultados salvos em $outputPath"
