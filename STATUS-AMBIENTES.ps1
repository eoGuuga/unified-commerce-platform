# ============================================
# 📊 STATUS DOS AMBIENTES
# ============================================

Write-Host "📊 STATUS DOS AMBIENTES" -ForegroundColor Magenta
Write-Host "=======================" -ForegroundColor Magenta
Write-Host ""

# Verificar Docker
Write-Host "🐳 Docker:" -ForegroundColor Cyan
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Docker rodando: $($dockerVersion.Split(' ')[2])" -ForegroundColor Green

        # Containers totais
        $totalContainers = (docker ps -a 2>$null | Measure-Object).Count - 1
        $runningContainers = (docker ps 2>$null | Measure-Object).Count - 1
        Write-Host "   📦 Containers: $runningContainers rodando, $totalContainers total" -ForegroundColor White
    } else {
        Write-Host "   ❌ Docker não está rodando" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Docker com problemas" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Status Ambiente DEV
Write-Host "🛠️  AMBIENTE DEV:" -ForegroundColor Cyan
$devContainers = docker ps --format "table {{.Names}}\t{{.Status}}" 2>$null | Where-Object { $_ -match "dev" -and $_ -notmatch "NAMES" }

if ($devContainers) {
    Write-Host "   🟢 DEV RODANDO:" -ForegroundColor Green
    $devContainers | ForEach-Object {
        $parts = $_.Split("`t", 2)
        if ($parts.Count -eq 2) {
            Write-Host "   • $($parts[0]): $($parts[1])" -ForegroundColor White
        }
    }

    # Testar conectividade DEV
    Write-Host ""
    Write-Host "   🔗 Testando conectividade DEV:" -ForegroundColor Gray
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3002/api/v1/health" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "   • Backend: ✅ (porta 3002)" -ForegroundColor Green
    } catch {
        Write-Host "   • Backend: ❌ (porta 3002)" -ForegroundColor Red
    }

    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3003" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "   • Frontend: ✅ (porta 3003)" -ForegroundColor Green
    } catch {
        Write-Host "   • Frontend: ❌ (porta 3003)" -ForegroundColor Red
    }
} else {
    Write-Host "   🔴 DEV PARADO" -ForegroundColor Red
    Write-Host "   Para iniciar: .\INICIAR-DEV.ps1" -ForegroundColor Yellow
}
Write-Host ""

# Status Ambiente PROD
Write-Host "🚀 AMBIENTE PRODUÇÃO:" -ForegroundColor Cyan
$prodContainers = docker ps --format "table {{.Names}}\t{{.Status}}" 2>$null | Where-Object { $_ -match "prod" -and $_ -notmatch "NAMES" }

if ($prodContainers) {
    Write-Host "   🟢 PRODUÇÃO RODANDO:" -ForegroundColor Green
    $prodContainers | ForEach-Object {
        $parts = $_.Split("`t", 2)
        if ($parts.Count -eq 2) {
            Write-Host "   • $($parts[0]): $($parts[1])" -ForegroundColor White
        }
    }

    # Verificar portas PROD
    Write-Host ""
    Write-Host "   🔗 Portas produção:" -ForegroundColor Gray
    $ports = docker ps --format "{{.Names}}: {{.Ports}}" 2>$null | Where-Object { $_ -match "prod" }
    $ports | ForEach-Object { Write-Host "   • $_" -ForegroundColor White }

    # Testar se Nginx está respondendo
    Write-Host ""
    Write-Host "   🌐 Testando acesso produção:" -ForegroundColor Gray
    try {
        $response = Invoke-WebRequest -Uri "http://localhost" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "   • Nginx: ✅ (porta 80)" -ForegroundColor Green
    } catch {
        Write-Host "   • Nginx: ❌ (porta 80)" -ForegroundColor Red
    }
} else {
    Write-Host "   🔴 PRODUÇÃO PARADA" -ForegroundColor Red
    Write-Host "   Para iniciar: .\INICIAR-PRODUCAO.ps1" -ForegroundColor Yellow
}
Write-Host ""

# Recursos do sistema
Write-Host "💻 RECURSOS DO SISTEMA:" -ForegroundColor Cyan
try {
    $cpu = Get-WmiObject Win32_Processor | Select-Object -First 1
    $mem = Get-WmiObject Win32_ComputerSystem
    $totalMemory = [math]::Round($mem.TotalPhysicalMemory / 1GB, 1)

    Write-Host "   • CPU: $($cpu.Name)" -ForegroundColor White
    Write-Host "   • RAM: ${totalMemory}GB" -ForegroundColor White

    # Docker stats se disponível
    $dockerStats = docker system df 2>$null
    if ($LASTEXITCODE -eq 0) {
        $statsLines = $dockerStats | Where-Object { $_ -match "Images|Containers|Local Volumes" }
        Write-Host "   • Docker:" -ForegroundColor White
        $statsLines | ForEach-Object { Write-Host "     $_" -ForegroundColor Gray }
    }
} catch {
    Write-Host "   • Recursos: Não foi possível obter informações" -ForegroundColor Yellow
}
Write-Host ""

# Backups
Write-Host "💾 BACKUPS:" -ForegroundColor Cyan
$backupDir = "backups"
if (Test-Path $backupDir) {
    $backupFiles = Get-ChildItem $backupDir -Filter "*.sql" | Sort-Object LastWriteTime -Descending
    if ($backupFiles.Count -gt 0) {
        Write-Host "   ✅ $($backupFiles.Count) backup(s) encontrado(s):" -ForegroundColor Green
        $backupFiles | Select-Object -First 3 | ForEach-Object {
            Write-Host "   • $($_.Name) ($($_.LastWriteTime.ToString('dd/MM/yyyy HH:mm')))" -ForegroundColor White
        }
        if ($backupFiles.Count -gt 3) {
            Write-Host "   • ... e mais $($backupFiles.Count - 3) backup(s)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ⚠️  Nenhum backup encontrado" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ Pasta de backups não existe" -ForegroundColor Red
}
Write-Host ""

# Recomendações
Write-Host "💡 RECOMENDAÇÕES:" -ForegroundColor Yellow

$devRunning = ($devContainers | Measure-Object).Count -gt 0
$prodRunning = ($prodContainers | Measure-Object).Count -gt 0

if (-not $devRunning -and -not $prodRunning) {
    Write-Host "   • Inicie DEV para desenvolvimento: .\INICIAR-DEV.ps1" -ForegroundColor White
    Write-Host "   • Ou PROD para produção: .\INICIAR-PRODUCAO.ps1" -ForegroundColor White
} elseif ($devRunning -and -not $prodRunning) {
    Write-Host "   • Ambiente DEV ativo - ideal para desenvolvimento" -ForegroundColor Green
    Write-Host "   • Considere iniciar PROD quando estiver pronto" -ForegroundColor White
} elseif (-not $devRunning -and $prodRunning) {
    Write-Host "   • Apenas PROD rodando - site público ativo" -ForegroundColor Green
    Write-Host "   • Use DEV para testes: .\INICIAR-DEV.ps1" -ForegroundColor White
} elseif ($devRunning -and $prodRunning) {
    Write-Host "   • Ambos ambientes rodando - tenha cuidado com recursos!" -ForegroundColor Yellow
    Write-Host "   • DEV: localhost:3003 | PROD: localhost (nginx)" -ForegroundColor White
}

Write-Host ""
Write-Host "🎯 STATUS COMPLETO VERIFICADO!" -ForegroundColor Green