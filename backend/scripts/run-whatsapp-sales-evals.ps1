param(
    [string]$BaseUrl = "https://dev.gtsofthub.com.br/api/v1/whatsapp/test",
    [string]$TenantId = "00000000-0000-0000-0000-000000000000",
    [string]$CorpusPath = "scripts/whatsapp-sales-evals.loucas.json",
    [string]$OutputPath = ""
)

$ErrorActionPreference = 'Stop'

function Invoke-WhatsappEvalStep {
    param(
        [string]$Phone,
        [string]$Message
    )

    $body = @{
        tenantId = $TenantId
        phone = $Phone
        message = $Message
    } | ConvertTo-Json -Compress

    $maxAttempts = 4
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            return Invoke-RestMethod -Method Post -Uri $BaseUrl -ContentType "application/json" -Body $body
        } catch {
            $response = $_.Exception.Response
            $statusCode = $null
            $errorText = ($_ | Out-String)

            if ($response -and $response.StatusCode) {
                $statusCode = [int]$response.StatusCode
            }

            if (($statusCode -eq 429 -or $errorText -match '429' -or $errorText -match 'Too Many Requests') -and $attempt -lt $maxAttempts) {
                Start-Sleep -Seconds (3 * $attempt)
                continue
            }

            throw
        }
    }
}

function Test-ContainsAny {
    param(
        [string]$Text,
        [object[]]$Needles
    )

    if (-not $Needles -or $Needles.Count -eq 0) {
        return $true
    }

    foreach ($needle in $Needles) {
        if ($Text -like "*$needle*") {
            return $true
        }
    }

    return $false
}

function Test-ContainsNone {
    param(
        [string]$Text,
        [object[]]$Needles
    )

    if (-not $Needles -or $Needles.Count -eq 0) {
        return $true
    }

    foreach ($needle in $Needles) {
        if ($Text -like "*$needle*") {
            return $false
        }
    }

    return $true
}

if (-not (Test-Path -LiteralPath $CorpusPath)) {
    throw "Corpus nao encontrado em $CorpusPath"
}

$corpus = Get-Content -LiteralPath $CorpusPath -Raw | ConvertFrom-Json
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if (-not $OutputPath) {
    $OutputPath = "whatsapp-sales-evals-results-$timestamp.json"
}

$runSeed = Get-Random -Minimum 100000 -Maximum 999999
$results = @()
$scenarioIndex = 0

foreach ($scenario in $corpus.scenarios) {
    $scenarioIndex++
    $phone = "+55119{0:d5}{1:d3}" -f $runSeed, $scenarioIndex
    $stepResults = @()
    $scenarioPassed = $true

    foreach ($step in $scenario.steps) {
        $response = Invoke-WhatsappEvalStep -Phone $phone -Message $step.message
        $responseText = [string]$response.response

        $passExpectAny = Test-ContainsAny -Text $responseText -Needles $step.expectAny
        $passForbidAny = Test-ContainsNone -Text $responseText -Needles $step.forbidAny
        $stepPassed = $passExpectAny -and $passForbidAny

        if (-not $stepPassed) {
            $scenarioPassed = $false
        }

        $stepResults += [ordered]@{
            message = $step.message
            response = $responseText
            passed = $stepPassed
            expectAny = @($step.expectAny)
            forbidAny = @($step.forbidAny)
        }
    }

    $results += [ordered]@{
        name = $scenario.name
        phone = $phone
        passed = $scenarioPassed
        steps = $stepResults
    }
}

$summary = [ordered]@{
    corpus = $corpus.name
    description = $corpus.description
    baseUrl = $BaseUrl
    tenantId = $TenantId
    runSeed = $runSeed
    timestamp = (Get-Date).ToString("o")
    totalScenarios = $results.Count
    passedScenarios = @($results | Where-Object { $_.passed }).Count
    failedScenarios = @($results | Where-Object { -not $_.passed }).Count
    results = $results
}

$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8

Write-Host ""
Write-Host "WhatsApp sales evals concluido."
Write-Host "Corpus: $($corpus.name)"
Write-Host "Cenarios: $($summary.totalScenarios)"
Write-Host "Passaram: $($summary.passedScenarios)"
Write-Host "Falharam: $($summary.failedScenarios)"
Write-Host "Resultado salvo em: $OutputPath"

if ($summary.failedScenarios -gt 0) {
    exit 1
}
