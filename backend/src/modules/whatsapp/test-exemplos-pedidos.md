# Exemplos Reais de Pedidos Brasileiros - Testes FASE 3.2

## Categorias de Testes

### 1. Formas Básicas de Pedir
- "quero 5 brigadeiros"
- "preciso de 10 brigadeiros"
- "vou querer 3 bolos"
- "gostaria de 2 bolos de chocolate"
- "desejo 1 bolo de cenoura"

### 2. Formas Coloquiais
- "me manda 5 brigadeiros"
- "manda 10 brigadeiros"
- "pode ser 3 bolos?"
- "faz 1 bolo pra mim"
- "me faz 2 bolos de chocolate"
- "pode me enviar 5 brigadeiros?"
- "tem como me enviar 3 bolos?"
- "dá pra fazer 1 bolo de cenoura?"
- "dá pra me enviar 5 brigadeiros?"
- "seria possível 2 bolos?"
- "poderia me enviar 10 brigadeiros?"

### 3. Quantidades por Extenso
- "quero um bolo de chocolate"
- "preciso de dois bolos"
- "me manda três brigadeiros"
- "quero cinco brigadeiros"
- "preciso de dez bolos"

### 4. Expressões de Quantidade
- "quero uma dúzia de brigadeiros"
- "preciso de meia dúzia de brigadeiros"
- "me manda um quilo de brigadeiros"
- "quero 500g de brigadeiros"
- "preciso de 1kg de brigadeiros"

### 5. Quantidades Indefinidas
- "quero uns brigadeiros"
- "preciso de algumas bolos"
- "me manda vários brigadeiros"
- "quero um monte de brigadeiros"
- "preciso de muitos bolos"

### 6. Variações de Produtos
- "quero 5 brigadeiros" (plural)
- "quero 5 brigadeiro" (singular)
- "preciso de 2 bolos" (plural)
- "quero 1 bolo" (singular)
- "me manda 3 bolos de chocolate"
- "quero 2 bolos de cenoura"
- "preciso de 1 bolo de chocolate"

### 7. Com Cortesia
- "quero 5 brigadeiros por favor"
- "preciso de 10 brigadeiros, obrigado"
- "me manda 3 bolos, pf"
- "quero 2 bolos, pfv"
- "preciso de 1 bolo, obg"
- "me manda 5 brigadeiros, vlw"

### 8. Com Interrogações
- "quero 5 brigadeiros?"
- "pode ser 3 bolos?"
- "tem como me enviar 10 brigadeiros?"
- "dá pra fazer 1 bolo?"

### 9. Erros Comuns de Digitação
- "quero 5 brigadero" (sem 'i')
- "preciso de 2 bolos de choclate" (sem 'o')
- "me manda 3 bolos de cenora" (sem 'u')
- "quero 10 brigadero" (sem 'i')

### 10. Formas Regionais
- "quero 5 brigadeiros, pode ser?"
- "preciso de 3 bolos, dá certo?"
- "me manda 10 brigadeiros, faz favor"
- "quero 2 bolos, se der"

### 11. Pedidos Múltiplos (futuro)
- "quero 5 brigadeiros e 2 bolos"
- "preciso de 10 brigadeiros e 1 bolo de chocolate"
- "me manda 3 bolos e 5 brigadeiros"

### 12. Casos Especiais
- "quero brigadeiros" (sem quantidade)
- "preciso de bolos" (sem quantidade)
- "me manda 5" (sem produto)
- "quero" (sem nada)
- "brigadeiros" (só produto)

## Resultados Esperados

### ✅ Deve Funcionar
- Todas as formas básicas (1)
- Formas coloquiais (2)
- Quantidades por extenso (3)
- Expressões de quantidade (4)
- Quantidades indefinidas (5) - deve usar quantidade padrão
- Variações de produtos (6)
- Com cortesia (7)
- Com interrogações (8)
- Erros comuns (9) - deve encontrar mesmo com erro

### ⚠️ Deve Perguntar
- Pedidos sem quantidade (12 - "quero brigadeiros")
- Pedidos sem produto (12 - "me manda 5")

### ❌ Deve Retornar Erro
- Pedidos vazios (12 - "quero")
- Produtos inexistentes
