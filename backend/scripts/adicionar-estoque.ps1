# Script para adicionar estoque aos produtos para testes

$baseUrl = "http://localhost:3001/api/v1"
$tenantId = "00000000-0000-0000-0000-000000000000"
$token = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJlbWFpbCI6ImFkbWluQGxvamEuY29tIiwiaWF0IjoxNzM2MjY0ODAwLCJleHAiOjk5OTk5OTk5OTl9.test"

Write-Host "=== ADICIONANDO ESTOQUE AOS PRODUTOS ===" -ForegroundColor Cyan
Write-Host ""

# Buscar todos os produtos
try {
    $produtos = Invoke-RestMethod -Uri "$baseUrl/products?tenantId=$tenantId" -Method GET -Headers @{Authorization=$token} -ErrorAction Stop
    
    Write-Host "Produtos encontrados: $($produtos.Count)" -ForegroundColor Yellow
    Write-Host ""
    
    foreach ($produto in $produtos) {
        $estoqueAtual = $produto.available_stock
        $estoqueAdicionar = 100  # Adicionar 100 unidades a cada produto
        
        try {
            $body = @{
                quantity = $estoqueAdicionar
                reason = "Estoque adicionado para testes QA"
            } | ConvertTo-Json
            
            $response = Invoke-RestMethod -Uri "$baseUrl/products/$($produto.id)/adjust-stock?tenantId=$tenantId" -Method POST -Body $body -ContentType "application/json" -Headers @{Authorization=$token} -ErrorAction Stop
            
            Write-Host "✅ $($produto.name): $estoqueAtual → $($estoqueAtual + $estoqueAdicionar) unidades" -ForegroundColor Green
            Start-Sleep -Milliseconds 100
        } catch {
            Write-Host "❌ Erro ao adicionar estoque em $($produto.name): $_" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "✅ Estoque adicionado com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao buscar produtos: $_" -ForegroundColor Red
}
