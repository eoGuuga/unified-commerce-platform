# ============================================
# SCRIPT PARA DESBLOQUEAR SSH APÓS CONSEGUIR ACESSO
# ============================================

Write-Host "🔓 SCRIPT DE DESBLOQUEIO SSH" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green
Write-Host ""

# Verificar se estamos conectados
Write-Host "🔍 Verificando conexão SSH..." -ForegroundColor Yellow

$sshTest = ssh ubuntu@<IP_DO_SERVIDOR> "echo 'SSH funcionando'"
if ($sshTest -match "SSH funcionando") {
    Write-Host "✅ SSH funcionando - podemos prosseguir!" -ForegroundColor Green
    $hasSSH = $true
} else {
    Write-Host "❌ SSH ainda não funcionando" -ForegroundColor Red
    Write-Host "Tente as opções mencionadas acima primeiro" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Pedir IP para desbloquear
$ipToUnban = Read-Host "Digite o IP que foi banido (aquele do seu computador principal)"

if (-not $ipToUnban) {
    Write-Host "❌ IP não fornecido" -ForegroundColor Red
    exit 1
}

Write-Host "🔧 Desbloqueando IP: $ipToUnban" -ForegroundColor Yellow

# Executar desbloqueio
# Seguranca: nunca embutir senha no script. O 'ssh -t' aloca TTY e o 'sudo'
# pede a senha interativamente no momento do uso.
$unbanResult = ssh -t ubuntu@<IP_DO_SERVIDOR> "sudo fail2ban-client set sshd unbanip $ipToUnban"

if ($unbanResult -match "1") {
    Write-Host "✅ IP $ipToUnban desbloqueado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "❌ Falha ao desbloquear IP: $unbanResult" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Verificar status
Write-Host "📊 Verificando status do Fail2Ban..." -ForegroundColor Yellow
$statusResult = ssh -t ubuntu@<IP_DO_SERVIDOR> "sudo fail2ban-client status sshd"
Write-Host $statusResult

Write-Host ""

# Teste final
Write-Host "🧪 Teste final - tentando conectar do computador principal..." -ForegroundColor Cyan
Write-Host "Agora volte ao seu computador principal e execute:" -ForegroundColor White
Write-Host "ssh ubuntu@<IP_DO_SERVIDOR>" -ForegroundColor Yellow
Write-Host ""
Write-Host "Se funcionar, parabéns! 🎉" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 PRÓXIMO: Análise completa de 100% do servidor!" -ForegroundColor Magenta
Write-Host "Execute: .\ANALISE-COMPLETA-100-SERVIDOR.ps1" -ForegroundColor White