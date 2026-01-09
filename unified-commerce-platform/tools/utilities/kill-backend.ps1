# Script para parar processos Node.js na porta 3001

Write-Host "Procurando processos na porta 3001..." -ForegroundColor Yellow

$connections = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue

if ($connections) {
    foreach ($conn in $connections) {
        $processId = $conn.OwningProcess
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        
        if ($process) {
            Write-Host "Encontrado processo: $($process.ProcessName) (PID: $processId)" -ForegroundColor Red
            Write-Host "Parando processo..." -ForegroundColor Yellow
            Stop-Process -Id $processId -Force
            Write-Host "Processo parado com sucesso!" -ForegroundColor Green
        }
    }
} else {
    Write-Host "Nenhum processo encontrado na porta 3001" -ForegroundColor Green
}

Write-Host "`nVerificando processos Node.js restantes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "Processos Node.js ainda rodando:" -ForegroundColor Yellow
    $nodeProcesses | Format-Table Id, ProcessName, StartTime
} else {
    Write-Host "Nenhum processo Node.js rodando" -ForegroundColor Green
}
