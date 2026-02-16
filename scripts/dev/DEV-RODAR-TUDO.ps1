# Script para Rodar Tudo (Dev)
# Execute este script na raiz do projeto: .\scripts\DEV-RODAR-TUDO.ps1

param(
  [string]$BaseUrl = "http://localhost:3001/api/v1",
  [string]$TenantId = "00000000-0000-0000-0000-000000000000",
  [switch]$SkipSetup,
  [switch]$SkipSeed,
  [switch]$SkipE2E,
  [int]$HealthTimeoutSeconds = 40
)

$ErrorActionPreference = "Stop"

try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
  # ignore
}

function Write-Section([string]$title) {
  Write-Host ""
  Write-Host "========================================" -ForegroundColor Cyan
  Write-Host $title -ForegroundColor Cyan
  Write-Host "========================================" -ForegroundColor Cyan
}

function Wait-HttpOk([string]$url, [int]$timeoutSeconds) {
  for ($i = 0; $i -lt $timeoutSeconds; $i++) {
    try {
      Invoke-RestMethod -Uri $url -Method GET -TimeoutSec 2 | Out-Null
      return $true
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  return $false
}

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Section "ðŸš€ DEV - RODAR TUDO"

# 1. Verificar Docker
Write-Host "[1/6] Verificando Docker..." -ForegroundColor Yellow
try {
  $dockerVersion = docker --version 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host "âœ… Docker encontrado: $dockerVersion" -ForegroundColor Green
  } else {
    Write-Host "âŒ Docker nÃ£o encontrado. Instale Docker Desktop primeiro." -ForegroundColor Red
    exit 1
  }
} catch {
  Write-Host "âŒ Docker nÃ£o estÃ¡ acessÃ­vel. Certifique-se que Docker Desktop estÃ¡ rodando." -ForegroundColor Red
  exit 1
}

# 2. Iniciar containers
Write-Host ""
Write-Host "[2/6] Iniciando containers Docker..." -ForegroundColor Yellow
docker-compose -f "$root\config\docker-compose.yml" up -d postgres redis 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "âŒ Erro ao iniciar containers Docker" -ForegroundColor Red
  exit 1
}
Write-Host "âœ… Containers iniciados" -ForegroundColor Green

# 3. Aguardar serviÃ§os
Write-Host ""
Write-Host "[3/6] Aguardando serviÃ§os ficarem prontos..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
Write-Host "âœ… ServiÃ§os prontos" -ForegroundColor Green

# 4. Setup (se nÃ£o pular)
if (-not $SkipSetup) {
  Write-Host ""
  Write-Host "[4/6] Executando setup..." -ForegroundColor Yellow
  & "$root\scripts\setup\setup.ps1"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "âŒ Erro no setup" -ForegroundColor Red
    exit 1
  }
  Write-Host "âœ… Setup concluÃ­do" -ForegroundColor Green
} else {
  Write-Host "[4/6] Setup pulado (--SkipSetup)" -ForegroundColor Yellow
}

# 5. Verificar backend (se nÃ£o pular E2E)
if (-not $SkipE2E) {
  Write-Host ""
  Write-Host "[5/6] Verificando backend..." -ForegroundColor Yellow
  $healthUrl = "$BaseUrl/whatsapp/health"
  if (Wait-HttpOk -url $healthUrl -timeoutSeconds $HealthTimeoutSeconds) {
    Write-Host "âœ… Backend estÃ¡ rodando" -ForegroundColor Green
  } else {
    Write-Host "âš ï¸  Backend nÃ£o estÃ¡ respondendo (pode estar iniciando)" -ForegroundColor Yellow
    Write-Host "   Execute: cd backend && npm run start:dev" -ForegroundColor Yellow
  }
} else {
  Write-Host "[5/6] VerificaÃ§Ã£o de backend pulada (--SkipE2E)" -ForegroundColor Yellow
}

# 6. Resumo
Write-Section "âœ… CONCLUÃDO"
Write-Host "PrÃ³ximos passos:" -ForegroundColor Cyan
Write-Host "  1. Backend: cd backend && npm run start:dev" -ForegroundColor White
Write-Host "  2. Frontend: cd frontend && npm run dev" -ForegroundColor White
Write-Host "  3. Swagger: http://localhost:3001/api/docs" -ForegroundColor White
Write-Host ""
Write-Host "DocumentaÃ§Ã£o:" -ForegroundColor Cyan
Write-Host "  - Consolidado: docs/CONSOLIDADO/04-OPERACAO-DEPLOY.md" -ForegroundColor White
Write-Host "  - Legado: docs/LEGADO/07-setup/COMO-INICIAR-AMBIENTE.md" -ForegroundColor White
