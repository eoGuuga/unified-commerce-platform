# Script de Setup Automatico - UCM Platform
# Execute este script a partir da raiz do projeto: .\scripts\setup\setup.ps1

# Mudar para a raiz do projeto
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptPath)
Set-Location $projectRoot

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Setup UCM Platform" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
    # ignore
}

# Helper: gerar string hex segura (32 bytes => 64 hex chars)
function New-RandomHex([int]$bytes = 32) {
    $buffer = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    return ([System.BitConverter]::ToString($buffer) -replace "-", "").ToLower()
}

function Get-EnvVar([string]$content, [string]$name) {
    if (-not $content) { return $null }
    $m = [regex]::Match($content, "(?m)^\s*$name\s*=\s*(.*)\s*$")
    if ($m.Success) { return $m.Groups[1].Value.Trim() }
    return $null
}

function Set-OrReplaceEnvVar([string]$content, [string]$name, [string]$value) {
    if ($null -eq $content) { $content = "" }
    $pattern = "(?m)^\s*$name\s*=.*$"
    if ($content -match $pattern) {
        return [regex]::Replace($content, $pattern, "$name=$value")
    }
    $trimmed = $content.TrimEnd()
    if ($trimmed.Length -eq 0) { return "$name=$value`r`n" }
    return ($trimmed + "`r`n" + "$name=$value`r`n")
}

function Looks-InsecureSecret([string]$value) {
    if (-not $value) { return $true }
    $v = $value.Trim()
    if ($v.Length -lt 32) { return $true }
    $lower = $v.ToLower()
    if ($lower -like "*change-me*") { return $true }
    if ($lower -like "*dev-secret*") { return $true }
    if ($lower -like "*change-in-production*") { return $true }
    return $false
}

# Adicionar Node.js ao PATH se necessario
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $nodePath = "C:\Program Files\nodejs"
    if (Test-Path $nodePath) {
        $env:Path = "$nodePath;$env:Path"
        Write-Host "Node.js adicionado ao PATH temporariamente" -ForegroundColor Yellow
    }
}

# 1. Verificar Docker
Write-Host "[1/5] Verificando Docker..." -ForegroundColor Yellow
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "Docker encontrado!" -ForegroundColor Green
} else {
    Write-Host "ERRO: Docker nao encontrado. Instale Docker Desktop primeiro." -ForegroundColor Red
    exit 1
}

# 2. Iniciar PostgreSQL
Write-Host "[2/5] Iniciando PostgreSQL..." -ForegroundColor Yellow
docker-compose -f config\docker-compose.yml up -d postgres
if ($LASTEXITCODE -ne 0) {
    Write-Host "Aviso: docker-compose falhou (provavel conflito). Tentando iniciar container existente ucm-postgres..." -ForegroundColor Yellow
    try {
        docker start ucm-postgres 2>$null | Out-Null
    } catch {
        # Ignora erro
    }
}
Start-Sleep -Seconds 5

$postgresReady = $false
$maxAttempts = 12
$attempt = 0

while (-not $postgresReady -and $attempt -lt $maxAttempts) {
    try {
        docker exec ucm-postgres pg_isready -U postgres 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $postgresReady = $true
            Write-Host "PostgreSQL pronto!" -ForegroundColor Green
        }
    } catch {
        # Ignora erro
    }
    $attempt++
    if (-not $postgresReady) {
        Write-Host "Aguardando PostgreSQL..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
    }
}

if (-not $postgresReady) {
    Write-Host "ERRO: PostgreSQL nao iniciou a tempo" -ForegroundColor Red
    exit 1
}

# 3. Executar Migration
Write-Host "[3/5] Executando migration SQL..." -ForegroundColor Yellow
# Detectar se schema base ja existe (evita reexecutar 001 e gerar varios ERROs)
$tenantsExists = $false
try {
    $check = docker exec ucm-postgres psql -U postgres -d ucm -tAc "SELECT to_regclass('public.tenants') IS NOT NULL;" 2>$null
    if ($check) {
        $checkTrim = ($check | Out-String).Trim().ToLower()
        if ($checkTrim -eq "t" -or $checkTrim -eq "true") { $tenantsExists = $true }
    }
} catch {
    # Ignora erro
}

if (-not $tenantsExists) {
    Write-Host "Aplicando migration 001 (schema inicial)..." -ForegroundColor Gray
    Get-Content scripts\migrations\001-initial-schema.sql | docker exec -i ucm-postgres psql -U postgres -d ucm
} else {
    Write-Host "Schema ja existe - pulando migration 001." -ForegroundColor Gray
}

# Aplicar demais migrations (reexecutaveis/idempotentes)
Write-Host "Aplicando migration 002 (security/performance)..." -ForegroundColor Gray
Get-Content scripts\migrations\002-security-and-performance.sql | docker exec -i ucm-postgres psql -U postgres -d ucm

Write-Host "Aplicando migration 003 (whatsapp)..." -ForegroundColor Gray
Get-Content scripts\migrations\003-whatsapp-conversations.sql | docker exec -i ucm-postgres psql -U postgres -d ucm

Write-Host "Aplicando migration 004 (audit metadata)..." -ForegroundColor Gray
Get-Content scripts\migrations\004-audit-log-metadata.sql | docker exec -i ucm-postgres psql -U postgres -d ucm

Write-Host "Aplicando migration 005 (audit enum values)..." -ForegroundColor Gray
Get-Content scripts\migrations\005-audit-action-enum-values.sql | docker exec -i ucm-postgres psql -U postgres -d ucm

# Garantir tabela de idempotencia (requerida para WhatsApp/Orders)
Write-Host "Aplicando migration 006 (idempotencia)..." -ForegroundColor Gray
Get-Content scripts\migrations\006-idempotency.sql | docker exec -i ucm-postgres psql -U postgres -d ucm

# Persistir cupom no pedido (pedido.coupon_code)
Write-Host "Aplicando migration 007 (coupon_code em pedidos)..." -ForegroundColor Gray
Get-Content scripts\migrations\007-add-coupon-code-to-pedidos.sql | docker exec -i ucm-postgres psql -U postgres -d ucm

Write-Host "Aplicando migration 008 (usuarios email unique por tenant)..." -ForegroundColor Gray
Get-Content scripts\migrations\008-usuarios-email-unique-por-tenant.sql | docker exec -i ucm-postgres psql -U postgres -d ucm

Write-Host "Aplicando migration 009 (RLS force + policies extras)..." -ForegroundColor Gray
Get-Content scripts\migrations\009-rls-force-and-extra-policies.sql | docker exec -i ucm-postgres psql -U postgres -d ucm

Write-Host "Aplicando migration 010 (idempotency unique por tenant/op)..." -ForegroundColor Gray
Get-Content scripts\migrations\010-idempotency-unique-tenant-operation.sql | docker exec -i ucm-postgres psql -U postgres -d ucm

Write-Host "Migrations executadas!" -ForegroundColor Green

# 4. Criar usuario de banco "app" (nao-superuser) para RLS ser efetivo
# Importante: superuser pode bypassar RLS. Em producao, SEMPRE use usuario sem superuser.
Write-Host "[4/6] Configurando usuario do banco para o app (RLS real)..." -ForegroundColor Yellow
$dbAppUser = "ucm_app"
$dbAppPassword = $null

$envPath = "backend\.env"
$envContent = $null
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw -ErrorAction SilentlyContinue
    if ($null -eq $envContent) { $envContent = "" }
    $dbAppPassword = Get-EnvVar $envContent "DB_APP_PASSWORD"
}
if (-not $dbAppPassword) {
    # Hex = seguro e facil de escapar em SQL
    $dbAppPassword = New-RandomHex 16
}

try {
    $roleExists = docker exec ucm-postgres psql -U postgres -d ucm -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$dbAppUser';" 2>$null
    $roleExists = ($roleExists | Out-String).Trim()

    if (-not $roleExists) {
        Write-Host "Criando role $dbAppUser (LOGIN, sem superuser)..." -ForegroundColor Gray
        docker exec ucm-postgres psql -U postgres -d ucm -c "CREATE ROLE $dbAppUser LOGIN PASSWORD '$dbAppPassword';" | Out-Null
    } else {
        Write-Host "Role $dbAppUser ja existe - mantendo." -ForegroundColor Gray
    }

    # Garantir flags seguras (idempotente)
    docker exec ucm-postgres psql -U postgres -d ucm -c "ALTER ROLE $dbAppUser NOSUPERUSER NOCREATEDB NOCREATEROLE;" | Out-Null

    # Grants minimos para o app (TypeORM precisa ler/escrever nas tabelas do schema public)
    docker exec ucm-postgres psql -U postgres -d ucm -c "GRANT CONNECT ON DATABASE ucm TO $dbAppUser;" | Out-Null
    docker exec ucm-postgres psql -U postgres -d ucm -c "GRANT USAGE ON SCHEMA public TO $dbAppUser;" | Out-Null
    docker exec ucm-postgres psql -U postgres -d ucm -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $dbAppUser;" | Out-Null
    docker exec ucm-postgres psql -U postgres -d ucm -c "GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO $dbAppUser;" | Out-Null
    docker exec ucm-postgres psql -U postgres -d ucm -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $dbAppUser;" | Out-Null
    docker exec ucm-postgres psql -U postgres -d ucm -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO $dbAppUser;" | Out-Null

    Write-Host "Usuario do app pronto: $dbAppUser" -ForegroundColor Green
} catch {
    Write-Host "ERRO: Falha ao criar/configurar usuario do app no Postgres." -ForegroundColor Red
    throw
}

# 5. Criar .env do backend se nao existir
Write-Host "[5/6] Configurando backend..." -ForegroundColor Yellow
if (-not (Test-Path $envPath)) {
    $jwtSecret = New-RandomHex 32
    $encryptionKey = New-RandomHex 32
    @"
NODE_ENV=development
PORT=3001
DB_APP_USER=$dbAppUser
DB_APP_PASSWORD=$dbAppPassword
DATABASE_URL=postgresql://${dbAppUser}:${dbAppPassword}@localhost:5432/ucm
DATABASE_ADMIN_URL=postgresql://postgres:postgres@localhost:5432/ucm
JWT_SECRET=$jwtSecret
JWT_EXPIRATION=15m
FRONTEND_URL=http://localhost:3000
ENCRYPTION_KEY=$encryptionKey
"@ | Out-File -FilePath $envPath -Encoding utf8
    Write-Host "Arquivo .env criado em backend\.env" -ForegroundColor Green
    Write-Host "JWT_SECRET e ENCRYPTION_KEY gerados automaticamente (seguros para dev)." -ForegroundColor Green
} else {
    Write-Host "Arquivo .env ja existe - validando e corrigindo automaticamente (se preciso)..." -ForegroundColor Gray
    if ($null -eq $envContent) {
        $envContent = Get-Content $envPath -Raw -ErrorAction SilentlyContinue
        if ($null -eq $envContent) { $envContent = "" }
    }

    $currentJwt = Get-EnvVar $envContent "JWT_SECRET"
    $currentEnc = Get-EnvVar $envContent "ENCRYPTION_KEY"

    $needsJwtFix = Looks-InsecureSecret $currentJwt
    $needsEncFix = Looks-InsecureSecret $currentEnc

    if ($needsJwtFix -or $needsEncFix) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        Copy-Item $envPath "$envPath.bak-$timestamp" -Force
        Write-Host "Backup criado: $envPath.bak-$timestamp" -ForegroundColor Yellow
    }

    if ($needsJwtFix) {
        $newJwt = New-RandomHex 32
        $envContent = Set-OrReplaceEnvVar $envContent "JWT_SECRET" $newJwt
        Write-Host "JWT_SECRET estava ausente/fraco - gerado e aplicado automaticamente." -ForegroundColor Green
    }

    if ($needsEncFix) {
        $newEnc = New-RandomHex 32
        $envContent = Set-OrReplaceEnvVar $envContent "ENCRYPTION_KEY" $newEnc
        Write-Host "ENCRYPTION_KEY estava ausente/fraco - gerado e aplicado automaticamente." -ForegroundColor Green
    }

    # Garantir defaults uteis em dev (nao sobrescreve se ja existir)
    if (-not (Get-EnvVar $envContent "NODE_ENV")) { $envContent = Set-OrReplaceEnvVar $envContent "NODE_ENV" "development" }
    if (-not (Get-EnvVar $envContent "PORT")) { $envContent = Set-OrReplaceEnvVar $envContent "PORT" "3001" }
    if (-not (Get-EnvVar $envContent "DB_APP_USER")) { $envContent = Set-OrReplaceEnvVar $envContent "DB_APP_USER" $dbAppUser }
    if (-not (Get-EnvVar $envContent "DB_APP_PASSWORD")) { $envContent = Set-OrReplaceEnvVar $envContent "DB_APP_PASSWORD" $dbAppPassword }
    $envContent = Set-OrReplaceEnvVar $envContent "DATABASE_URL" "postgresql://${dbAppUser}:${dbAppPassword}@localhost:5432/ucm"
    if (-not (Get-EnvVar $envContent "DATABASE_ADMIN_URL")) { $envContent = Set-OrReplaceEnvVar $envContent "DATABASE_ADMIN_URL" "postgresql://postgres:postgres@localhost:5432/ucm" }
    if (-not (Get-EnvVar $envContent "JWT_EXPIRATION")) { $envContent = Set-OrReplaceEnvVar $envContent "JWT_EXPIRATION" "15m" }
    if (-not (Get-EnvVar $envContent "FRONTEND_URL")) { $envContent = Set-OrReplaceEnvVar $envContent "FRONTEND_URL" "http://localhost:3000" }
    if (-not (Get-EnvVar $envContent "WHATSAPP_DEFAULT_SHIPPING_AMOUNT")) { $envContent = Set-OrReplaceEnvVar $envContent "WHATSAPP_DEFAULT_SHIPPING_AMOUNT" "10" }

    $envContent | Out-File -FilePath $envPath -Encoding utf8
    Write-Host "backend\.env validado/atualizado." -ForegroundColor Green
}

# 6. Instalar dependencias
Write-Host "[6/6] Instalando dependencias..." -ForegroundColor Yellow

# Verificar Node.js/npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "ERRO: Node.js/npm nao encontrado!" -ForegroundColor Red
    Write-Host "     Instale Node.js de: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Node.js/npm encontrado!" -ForegroundColor Green

# Backend
if (Test-Path backend\node_modules) {
    Write-Host "Dependencias do backend ja instaladas" -ForegroundColor Gray
} else {
    Write-Host "Instalando dependencias do backend..." -ForegroundColor Yellow
    Push-Location backend
    npm install
    Pop-Location
}

# Frontend
if (Test-Path frontend\node_modules) {
    Write-Host "Dependencias do frontend ja instaladas" -ForegroundColor Gray
} else {
    Write-Host "Instalando dependencias do frontend..." -ForegroundColor Yellow
    Push-Location frontend
    npm install
    Pop-Location
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "Setup Concluido!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "1. Backend:  cd backend; npm run start:dev" -ForegroundColor White
Write-Host "2. Frontend: cd frontend; npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Backend:  http://localhost:3001/api/v1" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
