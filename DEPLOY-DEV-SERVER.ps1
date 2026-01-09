# ============================================
# 🚀 DEPLOY AMBIENTE DEV NO SERVIDOR SSH
# ============================================
# Copia o ambiente de desenvolvimento para o servidor

Write-Host "🚀 DEPLOY AMBIENTE DEV NO SERVIDOR" -ForegroundColor Magenta
Write-Host "==================================" -ForegroundColor Magenta
Write-Host ""

# Configurações do servidor
$serverHost = "37.59.118.210"
$serverUser = "ubuntu"
$serverPath = "/home/ubuntu/unified-commerce-platform"

Write-Host "🎯 CONFIGURAÇÃO DO DEPLOY:" -ForegroundColor Cyan
Write-Host "   • Servidor: $serverHost" -ForegroundColor White
Write-Host "   • Usuário: $serverUser" -ForegroundColor White
Write-Host "   • Caminho: $serverPath" -ForegroundColor White
Write-Host ""

# Verificar se tem chave SSH
Write-Host "🔐 Verificando acesso SSH..." -ForegroundColor Yellow
try {
    $sshTest = ssh -o ConnectTimeout=5 -o BatchMode=yes "$serverUser@$serverHost" "echo 'SSH OK'" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Acesso SSH OK" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Problemas com SSH" -ForegroundColor Red
        Write-Host "   Configure sua chave SSH primeiro!" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "   ❌ SSH não configurado" -ForegroundColor Red
    exit 1
}

# Arquivos a copiar
$filesToCopy = @(
    "docker-compose.dev.yml",
    "INICIAR-DEV.ps1",
    "PARAR-DEV.ps1",
    "STATUS-AMBIENTES.ps1",
    "backend/",
    "frontend/",
    "scripts/",
    "deploy/",
    "CONFIG-AMBIENTES.md",
    "test-simples-final.ps1"
)

Write-Host "📁 Preparando arquivos para cópia..." -ForegroundColor Yellow

# Criar lista de arquivos para rsync
$rsyncFiles = $filesToCopy -join " "

# Comando rsync (mais eficiente que scp)
$rsyncCommand = "rsync -avz --delete --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='backups' --exclude='*.log' ./ $serverUser@$serverHost`:$serverPath/"

Write-Host "📤 Enviando arquivos para o servidor..." -ForegroundColor Yellow
Write-Host "   Comando: $rsyncCommand" -ForegroundColor Gray
Write-Host ""

try {
    Invoke-Expression $rsyncCommand
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ ARQUIVOS ENVIADOS COM SUCESSO!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro no envio de arquivos" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Executar configuração no servidor
Write-Host ""
Write-Host "🔧 Configurando ambiente DEV no servidor..." -ForegroundColor Yellow

$setupCommands = @"
cd $serverPath
echo '📦 Instalando dependências...'
cd backend && npm install
cd ../frontend && npm install
cd ..
echo '🐳 Verificando Docker...'
docker --version
echo '✅ Setup concluído!'
"@

Write-Host "   Executando setup remoto..." -ForegroundColor Gray

try {
    $setupCommands | ssh "$serverUser@$serverHost" "bash -s" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Setup remoto OK" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Setup remoto com avisos" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Setup remoto pode ter problemas" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 DEPLOY CONCLUÍDO!" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Para acessar o servidor:" -ForegroundColor Cyan
Write-Host "   ssh $serverUser@$serverHost" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Para iniciar DEV no servidor:" -ForegroundColor Cyan
Write-Host "   cd unified-commerce-platform" -ForegroundColor White
Write-Host "   ./INICIAR-DEV.ps1" -ForegroundColor White
Write-Host ""
Write-Host "📊 Para verificar status:" -ForegroundColor Cyan
Write-Host "   ./STATUS-AMBIENTES.ps1" -ForegroundColor White
Write-Host ""
Write-Host "🎉 Ambiente DEV pronto no servidor!" -ForegroundColor Green
Write-Host "   Agora você pode desenvolver remotamente!" -ForegroundColor Green