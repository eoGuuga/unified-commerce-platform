# Script para limpar processos Node Ã³rfÃ£os
Write-Host "Verificando processos Node..." -ForegroundColor Cyan
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "Encontrados $($nodeProcesses.Count) processos Node" -ForegroundColor Yellow
    $nodeProcesses | ForEach-Object {
        Write-Host "  PID: $($_.Id) | Memoria: $([math]::Round($_.WorkingSet64/1MB,2)) MB | Iniciado: $($_.StartTime)" -ForegroundColor Gray
    }
    Write-Host ""
    $kill = Read-Host "Deseja matar todos os processos Node? (s/N)"
    if ($kill -eq "s" -or $kill -eq "S") {
        $nodeProcesses | Stop-Process -Force
        Write-Host "Processos Node finalizados!" -ForegroundColor Green
    }
} else {
    Write-Host "Nenhum processo Node encontrado" -ForegroundColor Green
}
