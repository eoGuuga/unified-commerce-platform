# Script para executar migration 011-create-pagamentos-table.sql
# Execute este script no PowerShell

Write-Host "=== Executando Migration 011: Criar Tabela PAGAMENTOS ===" -ForegroundColor Green
Write-Host ""

# Verificar se DATABASE_URL está configurado
$envFile = Join-Path $PSScriptRoot "..\..\backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERRO: Arquivo .env não encontrado em backend/.env" -ForegroundColor Red
    Write-Host "Configure o DATABASE_URL no arquivo .env" -ForegroundColor Yellow
    exit 1
}

# Ler DATABASE_URL do .env
$envContent = Get-Content $envFile -Raw
$databaseUrlMatch = [regex]::Match($envContent, "(?m)^\s*DATABASE_URL\s*=\s*(.*)\s*$")
if (-not $databaseUrlMatch.Success) {
    Write-Host "ERRO: DATABASE_URL não encontrado no arquivo .env" -ForegroundColor Red
    exit 1
}

$databaseUrl = $databaseUrlMatch.Groups[1].Value.Trim()

# Parse DATABASE_URL: postgresql://user:password@host:port/database
$urlPattern = "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)"
$urlMatch = [regex]::Match($databaseUrl, $urlPattern)

if (-not $urlMatch.Success) {
    Write-Host "ERRO: DATABASE_URL inválido. Formato esperado: postgresql://user:password@host:port/database" -ForegroundColor Red
    Write-Host "DATABASE_URL atual: $databaseUrl" -ForegroundColor Yellow
    exit 1
}

$dbUser = $urlMatch.Groups[1].Value
$dbPassword = $urlMatch.Groups[2].Value
$dbHost = $urlMatch.Groups[3].Value
$dbPort = $urlMatch.Groups[4].Value
$dbName = $urlMatch.Groups[5].Value

Write-Host "Conectando ao banco:" -ForegroundColor Cyan
Write-Host "  Host: $dbHost" -ForegroundColor Gray
Write-Host "  Port: $dbPort" -ForegroundColor Gray
Write-Host "  Database: $dbName" -ForegroundColor Gray
Write-Host "  User: $dbUser" -ForegroundColor Gray
Write-Host ""

# Verificar se psql está disponível
$psqlPath = $null
if (Get-Command psql -ErrorAction SilentlyContinue) {
    $psqlPath = "psql"
} else {
    # Tentar encontrar psql em caminhos comuns
    $commonPaths = @(
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe",
        "C:\Program Files\PostgreSQL\13\bin\psql.exe"
    )
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $psqlPath = $path
            break
        }
    }
}

if (-not $psqlPath) {
    Write-Host "AVISO: psql não encontrado. Tentando executar via Node.js..." -ForegroundColor Yellow
    Write-Host ""
    
    # Executar via Node.js
    $migrationFile = Join-Path $PSScriptRoot "011-create-pagamentos-table.sql"
    $migrationContent = Get-Content $migrationFile -Raw
    
    $nodeScript = @"
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '../../backend/.env');
const envContent = fs.readFileSync(envFile, 'utf8');
const dbUrlMatch = envContent.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
if (!dbUrlMatch) {
    console.error('ERRO: DATABASE_URL não encontrado');
    process.exit(1);
}

const client = new Client({
    connectionString: dbUrlMatch[1].trim()
});

const migrationFile = path.join(__dirname, '011-create-pagamentos-table.sql');
const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

(async () => {
    try {
        await client.connect();
        console.log('Conectado ao banco de dados');
        await client.query(migrationSQL);
        console.log('SUCESSO: Migration executada com sucesso!');
        await client.end();
    } catch (error) {
        console.error('ERRO:', error.message);
        process.exit(1);
    }
})();
"@
    
    # Criar arquivo temporário no diretório backend
    $backendDir = Join-Path $PSScriptRoot "..\..\backend"
    $nodeScriptFile = Join-Path $backendDir "temp-exec-migration.js"
    $nodeScript | Out-File -FilePath $nodeScriptFile -Encoding UTF8

    try {
        # Executar do diretório backend onde o node_modules está
        Push-Location $backendDir
        node $nodeScriptFile
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "SUCESSO: Migration executada com sucesso!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "ERRO: Falha ao executar migration!" -ForegroundColor Red
            exit 1
        }
    } finally {
        Pop-Location
        if (Test-Path $nodeScriptFile) {
            Remove-Item $nodeScriptFile -Force
        }
    }
} else {
    # Executar via psql
    Write-Host "Executando migration via psql..." -ForegroundColor Cyan
    
    $migrationFile = Join-Path $PSScriptRoot "011-create-pagamentos-table.sql"
    
    # Configurar variável de ambiente PGPASSWORD
    $env:PGPASSWORD = $dbPassword
    
    $psqlArgs = @(
        "-h", $dbHost,
        "-p", $dbPort,
        "-U", $dbUser,
        "-d", $dbName,
        "-f", $migrationFile
    )
    
    & $psqlPath $psqlArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "SUCESSO: Migration executada com sucesso!" -ForegroundColor Green
        Write-Host ""
        Write-Host "O que foi feito:" -ForegroundColor Cyan
        Write-Host "  - Tipos ENUM criados (pagamento_status, metodo_pagamento)"
        Write-Host "  - Tabela pagamentos criada"
        Write-Host "  - Índices criados"
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "ERRO: Falha ao executar migration!" -ForegroundColor Red
        Write-Host "Verifique os logs acima para mais detalhes" -ForegroundColor Yellow
        exit 1
    }
    
    # Limpar variável de ambiente
    Remove-Item Env:\PGPASSWORD
}
