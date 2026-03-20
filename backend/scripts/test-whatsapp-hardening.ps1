param(
    [string]$BaseUrl = "https://dev.gtsofthub.com.br/api/v1/whatsapp/test",
    [string]$TenantId = "00000000-0000-0000-0000-000000000000"
)

$ErrorActionPreference = 'Stop'

function Invoke-WhatsappTest {
    param(
        [string]$Phone,
        [string]$Message,
        [string]$MessageId,
        [string]$MessageType = "text",
        [hashtable]$Metadata
    )

    $body = @{
        message = $Message
        tenantId = $TenantId
        phoneNumber = $Phone
        messageType = $MessageType
    }

    if ($MessageId) {
        $body.messageId = $MessageId
    }

    if ($Metadata) {
        $body.metadata = $Metadata
    }

    $body = $body | ConvertTo-Json -Compress

    return Invoke-RestMethod -Uri $BaseUrl -Method Post -ContentType "application/json" -Body $body
}

$catalogResponse = Invoke-WhatsappTest -Phone "+5511998899900" -Message "cardapio"
$catalogLines = [string]$catalogResponse.response -split "`n"
$catalogProductLines = @($catalogLines | Where-Object { $_ -like "- *" })
if (-not $catalogProductLines -or $catalogProductLines.Count -eq 0) {
    throw "Nao consegui descobrir um produto valido pelo cardapio para a bateria de hardening."
}

function Get-AvailableProduct {
    param(
        [string[]]$Candidates,
        [string[]]$Exclude = @()
    )

    foreach ($candidate in $Candidates) {
        if ($Exclude -contains $candidate) {
            continue
        }

        $probePhone = "+55119{0:d5}{1:d3}" -f (Get-Random -Minimum 10000 -Maximum 99999), (Get-Random -Minimum 100 -Maximum 999)
        $probeResponse = Invoke-WhatsappTest -Phone $probePhone -Message "quero 1 $candidate"
        $probeText = [string]$probeResponse.response

        if (
            $probeText.Contains("PEDIDO PREPARADO") -or
            $probeText.Contains("Como voce prefere receber") -or
            $probeText.Contains("nome completo") -or
            $probeText.Contains("REVISAO FINAL DO PEDIDO")
        ) {
            return $candidate
        }
    }

    return $null
}

function Test-InventoryFailureResponse {
    param(
        [string]$Text
    )

    return (
        $Text.Contains("No momento esse item ficou sem estoque") -or
        $Text.Contains("Estoque insuficiente")
    )
}

$catalogProducts = @($catalogProductLines | ForEach-Object { ($_ -replace "^- ", "") -replace "\s+\|\s+R\$.+$", "" })
$preferredProducts = @($catalogProducts | Where-Object { $_ -like "Produto Teste*" })
$primaryProduct = Get-AvailableProduct -Candidates @($preferredProducts + $catalogProducts)
if (-not $primaryProduct) {
    $primaryProduct = $catalogProducts[0]
}

$secondaryProduct = Get-AvailableProduct -Candidates $catalogProducts -Exclude @($primaryProduct)
if (-not $secondaryProduct) {
    $secondaryProduct = $primaryProduct
}

$orderMessage = "quero 1 $primaryProduct"
$lowLiteracyMessage = "qro 1 $primaryProduct"
$hostileMessage = "<script>alert(1)</script> qro 1 $primaryProduct"
$runSeed = Get-Random -Minimum 100000 -Maximum 999999

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
        Name = "natural_name_phrase"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "No momento esse item ficou sem estoque") }
            @{ Message = "me chamo Ana Paula"; Expect = "Como voce prefere receber esse pedido?" }
        )
    },
    @{
        Name = "fragmented_delivery_address"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "No momento esse item ficou sem estoque") }
            @{ Message = "Ana Paula"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "entrega"; Expect = "ENDERECO DE ENTREGA" }
            @{ Message = "Rua das Flores"; ExpectAny = @("Estou montando o endereco por etapas", "Agora me envie o numero") }
            @{ Message = "123"; ExpectAny = @("Agora complete com bairro, cidade e estado", "Rascunho atual") }
            @{ Message = "Centro, Sao Paulo, SP"; Expect = "TELEFONE DE CONTATO" }
        )
    },
    @{
        Name = "loose_audio_delivery_address"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "No momento esse item ficou sem estoque") }
            @{ Message = "Ana Paula"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "entrega"; Expect = "ENDERECO DE ENTREGA" }
            @{ Message = "meu endereco e rua das flores 123 centro sao paulo sp"; MessageType = "audio"; Metadata = @{ audio = $true; transcriptionSource = "mock-stt-address" }; Expect = "TELEFONE DE CONTATO" }
        )
    },
    @{
        Name = "address_during_phone_stage"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "No momento esse item ficou sem estoque") }
            @{ Message = "Cliente Telefone"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "retirada"; Expect = "TELEFONE DE CONTATO" }
            @{ Message = "Rua das Flores, 123, Centro, Sao Paulo, SP"; ExpectAny = @("preciso do telefone de contato", "telefone de contato com DDD") }
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
        Name = "waiting_payment_out_of_order_phone"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "No momento esse item ficou sem estoque") }
            @{ Message = "Cliente Etapa"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "retirada"; Expect = "TELEFONE DE CONTATO" }
            @{ Message = "11999999999"; Expect = "OBSERVACOES DO PEDIDO" }
            @{ Message = "sem"; ExpectAny = @("REVISAO FINAL DO PEDIDO", "Confirma o pedido") }
            @{ Message = "sim"; ExpectAny = @("FORMAS DE PAGAMENTO", "ESCOLHA A FORMA DE PAGAMENTO") }
            @{ Message = "11988887777"; ExpectAny = @("forma de pagamento", "PAGAMENTO", "Nao preciso mais de telefone") }
        )
    },
    @{
        Name = "waiting_payment_out_of_order_address"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "No momento esse item ficou sem estoque") }
            @{ Message = "Cliente Endereco"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "retirada"; Expect = "TELEFONE DE CONTATO" }
            @{ Message = "11977776666"; Expect = "OBSERVACOES DO PEDIDO" }
            @{ Message = "sem"; ExpectAny = @("REVISAO FINAL DO PEDIDO", "Confirma o pedido") }
            @{ Message = "sim"; ExpectAny = @("FORMAS DE PAGAMENTO", "ESCOLHA A FORMA DE PAGAMENTO") }
            @{ Message = "Rua das Flores, 123, Centro, Sao Paulo, SP"; ExpectAny = @("forma de pagamento", "PAGAMENTO", "Nao preciso mais de endereco") }
        )
    },
    @{
        Name = "audio_style_order_with_payment_words"
        Steps = @(
            @{ Message = "me ve meia dz de $primaryProduct pra retirar no pix"; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "REVISAO FINAL DO PEDIDO", "Estoque insuficiente", "No momento esse item ficou sem estoque") }
        )
    },
    @{
        Name = "audio_transcript_chaotic_multi_item"
        Steps = @(
            @{ Message = "oi bom dia queria ver se tem como separar pra mim 1 $primaryProduct e um $secondaryProduct pra retirar no pix ta"; MessageType = "audio"; Metadata = @{ audio = $true; transcriptionSource = "mock-stt" }; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "REVISAO FINAL DO PEDIDO", "Estoque insuficiente") }
        )
    },
    @{
        Name = "audio_regional_multi_item"
        Steps = @(
            @{ Message = "oxe meu fi mim ve 2 $primaryProduct e 1 $secondaryProduct pra viagem no pix visse"; MessageType = "audio"; Metadata = @{ audio = $true; transcriptionSource = "mock-stt-regional" }; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "REVISAO FINAL DO PEDIDO", "Estoque insuficiente", "No momento esse item ficou sem estoque") }
        )
    },
    @{
        Name = "audio_regional_extreme_noise"
        Steps = @(
            @{ Message = "eita meu rei seguinte kkk me arruma 2 $primaryProduct e 1 $secondaryProduct pra nois retirar no piks hein"; MessageType = "audio"; Metadata = @{ audio = $true; transcriptionSource = "mock-stt-regional-noisy" }; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "REVISAO FINAL DO PEDIDO", "Estoque insuficiente", "No momento esse item ficou sem estoque") }
        )
    },
    @{
        Name = "audio_truncated_product_name"
        Steps = @(
            @{ Message = "me manda 1 $($primaryProduct.Substring(0, [Math]::Min(10, $primaryProduct.Length)))"; MessageType = "audio"; Metadata = @{ audio = $true; transcriptionSource = "mock-stt-truncated" }; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "quis dizer", "REVISAO FINAL DO PEDIDO", "No momento esse item ficou sem estoque", "Estoque insuficiente") }
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
        Name = "payment_proof_after_waiting_payment"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo") }
            @{ Message = "Cliente Pix"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "retirada"; Expect = "TELEFONE DE CONTATO" }
            @{ Message = "11966554433"; Expect = "OBSERVACOES DO PEDIDO" }
            @{ Message = "sem"; ExpectAny = @("REVISAO FINAL DO PEDIDO", "Confirma o pedido") }
            @{ Message = "sim"; ExpectAny = @("FORMAS DE PAGAMENTO", "ESCOLHA A FORMA DE PAGAMENTO") }
            @{ Message = "ja fiz o pix visse"; ExpectAny = @("nao vou gerar outra cobranca", "operadora confirmar", "Acompanhamento completo") }
        )
    },
    @{
        Name = "provocative_payment_proof_after_waiting_payment"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo") }
            @{ Message = "Cliente Provocacao"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "retirada"; Expect = "TELEFONE DE CONTATO" }
            @{ Message = "11966554432"; Expect = "OBSERVACOES DO PEDIDO" }
            @{ Message = "sem"; ExpectAny = @("REVISAO FINAL DO PEDIDO", "Confirma o pedido") }
            @{ Message = "sim"; ExpectAny = @("FORMAS DE PAGAMENTO", "ESCOLHA A FORMA DE PAGAMENTO") }
            @{ Message = "ja fiz o pix e voces tao de sacanagem"; ExpectAny = @("nao vou gerar outra cobranca", "operadora confirmar", "Acompanhamento completo") }
        )
    },
    @{
        Name = "courtesy_after_waiting_payment"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo") }
            @{ Message = "Cliente Valeu"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "retirada"; Expect = "TELEFONE DE CONTATO" }
            @{ Message = "11966443322"; Expect = "OBSERVACOES DO PEDIDO" }
            @{ Message = "sem"; ExpectAny = @("REVISAO FINAL DO PEDIDO", "Confirma o pedido") }
            @{ Message = "sim"; ExpectAny = @("FORMAS DE PAGAMENTO", "ESCOLHA A FORMA DE PAGAMENTO") }
            @{ Message = "valeu fechou"; ExpectAny = @("Fico acompanhando", "Acompanhamento completo", "pedido avanca") }
        )
    },
    @{
        Name = "post_payment_address_change"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo") }
            @{ Message = "Cliente Endereco 2"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "retirada"; Expect = "TELEFONE DE CONTATO" }
            @{ Message = "11966443321"; Expect = "OBSERVACOES DO PEDIDO" }
            @{ Message = "sem"; ExpectAny = @("REVISAO FINAL DO PEDIDO", "Confirma o pedido") }
            @{ Message = "sim"; ExpectAny = @("FORMAS DE PAGAMENTO", "ESCOLHA A FORMA DE PAGAMENTO") }
            @{ Message = "muda meu endereco pra rua das flores 123 centro sao paulo sp"; ExpectAny = @("nao altero itens, endereco ou forma de recebimento automaticamente", "atendimento humano", "Acompanhamento completo") }
        )
    },
    @{
        Name = "post_payment_item_change"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo") }
            @{ Message = "Cliente Item 2"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "retirada"; Expect = "TELEFONE DE CONTATO" }
            @{ Message = "11966443320"; Expect = "OBSERVACOES DO PEDIDO" }
            @{ Message = "sem"; ExpectAny = @("REVISAO FINAL DO PEDIDO", "Confirma o pedido") }
            @{ Message = "sim"; ExpectAny = @("FORMAS DE PAGAMENTO", "ESCOLHA A FORMA DE PAGAMENTO") }
            @{ Message = "acrescenta 1 $secondaryProduct"; ExpectAny = @("nao altero itens, endereco ou forma de recebimento automaticamente", "cancelar esse pedido", "Acompanhamento completo") }
        )
    },
    @{
        Name = "fresh_order_while_waiting_payment"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo") }
            @{ Message = "Cliente Mais Um"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "retirada"; Expect = "TELEFONE DE CONTATO" }
            @{ Message = "11966443319"; Expect = "OBSERVACOES DO PEDIDO" }
            @{ Message = "sem"; ExpectAny = @("REVISAO FINAL DO PEDIDO", "Confirma o pedido") }
            @{ Message = "sim"; ExpectAny = @("FORMAS DE PAGAMENTO", "ESCOLHA A FORMA DE PAGAMENTO") }
            @{ Message = "quero mais 1 $secondaryProduct"; ExpectAny = @("nao altero itens, endereco ou forma de recebimento automaticamente", "cancelar esse pedido", "Acompanhamento completo") }
        )
    },
    @{
        Name = "mixed_status_and_change_after_pending_order"
        Steps = @(
            @{ Message = $orderMessage; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo") }
            @{ Message = "Cliente Misto"; Expect = "Como voce prefere receber esse pedido?" }
            @{ Message = "retirada"; Expect = "TELEFONE DE CONTATO" }
            @{ Message = "11966443318"; Expect = "OBSERVACOES DO PEDIDO" }
            @{ Message = "sem"; ExpectAny = @("REVISAO FINAL DO PEDIDO", "Confirma o pedido") }
            @{ Message = "sim"; ExpectAny = @("FORMAS DE PAGAMENTO", "ESCOLHA A FORMA DE PAGAMENTO") }
            @{ Message = "cade meu pedido e muda para entrega"; ExpectAny = @("Status atual", "nao faco essa mudanca automaticamente", "Acompanhamento completo") }
        )
    },
    @{
        Name = "ambiguous_choice_order"
        Steps = @(
            @{ Message = "quero 1 $primaryProduct ou 1 $secondaryProduct nao sei"; ExpectAny = @("uma decisao por vez", "me indica entre brownie e brigadeiro", "opcao clara") }
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
        Name = "replay_same_message_id"
        Steps = @(
            @{ Message = "cardapio"; MessageId = "replay-cardapio-001"; ExpectAny = @("CATALOGO DA LOJA", "CARDAPIO", "- ") }
            @{ Message = "cardapio"; MessageId = "replay-cardapio-001"; ExpectAny = @("CATALOGO DA LOJA", "CARDAPIO", "- ") }
        )
    },
    @{
        Name = "abusive_without_action"
        Steps = @(
            @{ Message = "vai tomar no cu"; ExpectAny = @("objetiva e respeitosa", "Se quiser seguir") }
        )
    },
    @{
        Name = "ironic_provocation_without_action"
        Steps = @(
            @{ Message = "que bot ridiculo responde direito"; ExpectAny = @("objetiva e respeitosa", "Se quiser seguir") }
        )
    },
    @{
        Name = "abusive_escalation_without_action"
        Steps = @(
            @{ Message = "vai tomar no cu"; ExpectAny = @("objetiva e respeitosa", "Se quiser seguir") }
            @{ Message = "seu idiota do caralho"; ExpectAny = @("objetiva e respeitosa", "Eu sigo disponivel") }
            @{ Message = "bot lixo do cacete"; ExpectAny = @("Eu nao vou seguir nesse tom", "mensagem objetiva e respeitosa") }
        )
    },
    @{
        Name = "abusive_with_valid_order"
        Steps = @(
            @{ Message = "porra quero 1 $primaryProduct e um $secondaryProduct"; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "REVISAO FINAL DO PEDIDO", "Estoque insuficiente") }
        )
    },
    @{
        Name = "malicious_fuzz_sql_like"
        Steps = @(
            @{ Message = "'; DROP TABLE pedidos; -- quero 1 $primaryProduct"; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "REVISAO FINAL DO PEDIDO", "Nao encontrei") }
        )
    },
    @{
        Name = "malicious_fuzz_brackets"
        Steps = @(
            @{ Message = "(({{[[ qro 1 $primaryProduct ]]}))"; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "REVISAO FINAL DO PEDIDO") }
        )
    },
    @{
        Name = "malicious_fuzz_elongated"
        Steps = @(
            @{ Message = "qroooo 1 $primaryProduct!!!!!"; ExpectAny = @("PEDIDO PREPARADO", "Como voce prefere receber", "nome completo", "REVISAO FINAL DO PEDIDO") }
        )
    }
)

for ($scenarioIndex = 0; $scenarioIndex -lt $scenarios.Count; $scenarioIndex++) {
    $scenario = $scenarios[$scenarioIndex]
    $phone = "+55119{0:d5}{1:d3}" -f $runSeed, ($scenarioIndex + 100)
    $scenarioPrimaryProduct = Get-AvailableProduct -Candidates @($preferredProducts + $catalogProducts)
    if (-not $scenarioPrimaryProduct) {
        $scenarioPrimaryProduct = $primaryProduct
    }

    $scenarioSecondaryProduct = Get-AvailableProduct -Candidates $catalogProducts -Exclude @($scenarioPrimaryProduct)
    if (-not $scenarioSecondaryProduct) {
        $scenarioSecondaryProduct = $scenarioPrimaryProduct
    }

    for ($stepIndex = 0; $stepIndex -lt $scenario.Steps.Count; $stepIndex++) {
        $step = $scenario.Steps[$stepIndex]
        $resolvedMessage = [string]$step.Message
        $resolvedMessage = $resolvedMessage.Replace($primaryProduct, $scenarioPrimaryProduct)
        $resolvedMessage = $resolvedMessage.Replace($secondaryProduct, $scenarioSecondaryProduct)

        $response = Invoke-WhatsappTest -Phone $phone -Message $resolvedMessage -MessageId $step.MessageId -MessageType $step.MessageType -Metadata $step.Metadata
        $text = [string]$response.response

        if ($stepIndex -eq 0 -and $scenario.Steps.Count -gt 1 -and (Test-InventoryFailureResponse -Text $text)) {
            $alternatePrimary = Get-AvailableProduct -Candidates $catalogProducts -Exclude @($scenarioPrimaryProduct, $scenarioSecondaryProduct)
            if ($alternatePrimary) {
                $scenarioPrimaryProduct = $alternatePrimary
                $scenarioSecondaryProduct = Get-AvailableProduct -Candidates $catalogProducts -Exclude @($scenarioPrimaryProduct)
                if (-not $scenarioSecondaryProduct) {
                    $scenarioSecondaryProduct = $scenarioPrimaryProduct
                }

                $resolvedMessage = [string]$step.Message
                $resolvedMessage = $resolvedMessage.Replace($primaryProduct, $scenarioPrimaryProduct)
                $resolvedMessage = $resolvedMessage.Replace($secondaryProduct, $scenarioSecondaryProduct)
                $response = Invoke-WhatsappTest -Phone $phone -Message $resolvedMessage -MessageId $step.MessageId -MessageType $step.MessageType -Metadata $step.Metadata
                $text = [string]$response.response
            }

            if (Test-InventoryFailureResponse -Text $text) {
                $results += [pscustomobject]@{
                    scenario = $scenario.Name
                    message = $resolvedMessage
                    passed = $true
                    response = "SKIPPED_STOCK_DYNAMIC`n$text"
                }
                break
            }
        }

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
            message = $resolvedMessage
            passed = $passed
            response = $text
        }
    }
}

$results | Format-Table -AutoSize

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputPath = "test-whatsapp-hardening-results-$timestamp.json"
$results | ConvertTo-Json -Depth 4 | Out-File -FilePath $outputPath -Encoding UTF8
Write-Host "Resultados salvos em $outputPath"

$failed = @($results | Where-Object { -not $_.passed })
if ($failed.Count -gt 0) {
    Write-Error "Falharam $($failed.Count) verificacoes da bateria de hardening do WhatsApp."
}
