# Script para executar migration 002-security-and-performance.sql
# Execute este script no PowerShell

Write-Host "=== Executando Migration 002 ===" -ForegroundColor Green
Write-Host ""

# Verificar se container esta rodando
$containerRunning = docker ps --filter "name=ucm-postgres" --format "{{.Names}}"

if (-not $containerRunning) {
    Write-Host "ERRO: Container ucm-postgres nao esta rodando!" -ForegroundColor Red
    Write-Host "Execute: docker-compose -f ../../config/docker-compose.yml up -d" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK: Container encontrado: $containerRunning" -ForegroundColor Green
Write-Host ""

# Copiar arquivo para container
Write-Host "Copiando migration para container..." -ForegroundColor Cyan
docker cp 002-security-and-performance.sql ucm-postgres:/tmp/002-migration.sql

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Falha ao copiar arquivo!" -ForegroundColor Red
    exit 1
}

Write-Host "OK: Arquivo copiado" -ForegroundColor Green
Write-Host ""

# Executar migration
Write-Host "Executando migration..." -ForegroundColor Cyan
docker exec ucm-postgres psql -U postgres -d ucm -f /tmp/002-migration.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCESSO: Migration executada com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "O que foi feito:" -ForegroundColor Cyan
    Write-Host "  - Indices criados para performance"
    Write-Host "  - Row Level Security (RLS) habilitado"
    Write-Host "  - Policies de isolamento multi-tenant criadas"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "ERRO: Falha ao executar migration!" -ForegroundColor Red
    Write-Host "Verifique os logs acima para mais detalhes" -ForegroundColor Yellow
    exit 1
}
