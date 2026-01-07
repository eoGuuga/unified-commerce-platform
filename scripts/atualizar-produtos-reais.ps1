# Script para ajudar a extrair produtos do site
# Execute este script e ele vai abrir o site no navegador

Write-Host "=== EXTRAINDO PRODUTOS DO SITE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Site: https://loucasporbrigadeiro.my.canva.site/loucas-por-brigadeiro" -ForegroundColor Yellow
Write-Host ""
Write-Host "Abrindo site no navegador..." -ForegroundColor Green

# Abrir site no navegador padrão
Start-Process "https://loucasporbrigadeiro.my.canva.site/loucas-por-brigadeiro"

Write-Host ""
Write-Host "✅ Site aberto!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 INSTRUCOES:" -ForegroundColor Cyan
Write-Host "  1. Analise o site e liste todos os produtos"
Write-Host "  2. Para cada produto, anote:"
Write-Host "     - Nome"
Write-Host "     - Preco"
Write-Host "     - Descricao (se tiver)"
Write-Host "     - Categoria (Doces/Bolos/Salgados)"
Write-Host ""
Write-Host "  3. Preencha o arquivo:" -ForegroundColor Yellow
Write-Host "     scripts/PRODUTOS-REAIS-SITE.md"
Write-Host ""
Write-Host "  4. Avise quando terminar para eu atualizar o script de seed!"
Write-Host ""
