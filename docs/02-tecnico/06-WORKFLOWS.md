# 06 - FLUXOS PRINCIPAIS

## Fluxo 1: Venda no PDV (Loja Física)

### Cenário
Vendedor registra venda física de 5 brigadeiros no balcão.

### Passo a Passo

\`\`\`
PASSO 1: Vendedor abre PDV
└─> App carrega interface de vendedor
└─> Estoque é carregado de cache (Redis)
└─> Exibe atalhos de produtos populares

PASSO 2: Vendedor busca produto
└─> Digita "Brigadeiro" no campo de busca
└─> Backend: SELECT * FROM products WHERE store_id = X AND name LIKE 'Brigadeiro'
└─> Mostra resultados com estoque ATUAL
└─> Vendedor seleciona "Brigadeiro Gourmet"

PASSO 3: Vendedor define quantidade
└─> Clica em quantidade
└─> Valida contra inventory.current_stock
└─> Se tem estoque: Permite selecionar
└─> Se não tem: Mostra "Apenas X disponíveis"

PASSO 4: Adiciona ao carrinho
└─> Frontend adiciona ao carrinho local (estado)
└─> Mostra subtotal

PASSO 5: Vendedor confirma venda
└─> Clica botão "VENDER"
└─> Frontend valida carrinho (não vazio, quantidades válidas)

PASSO 6: TRANSAÇÃO CRÍTICA
└─> Backend inicia TRANSAÇÃO:
     a) FOR UPDATE na inventory
     b) Verifica estoque novamente (pode ter mudado)
     c) Se ok: UPDATE inventory SET current_stock = current_stock - 5
     d) Cria pedido: INSERT INTO orders (status='ENTREGUE', ...)
     e) Registra venda: INSERT INTO sales_transactions (channel='PDV', ...)
     f) COMMIT (tudo ou nada)

PASSO 7: Sucesso
└─> Mostra comprovante de venda
└─> Atualiza estoque na tela em tempo real
└─> Limpa carrinho
└─> Cache Redis é invalidado (TTL 1 segundo)
└─> Próxima consulta traz estoque atualizado

PASSO 8: Se falha (sem estoque)
└─> ROLLBACK automático
└─> Mostra erro: "Desculpe, apenas 3 brigadeiros disponíveis"
└─> Carrinho mantido (vendedor pode ajustar quantidade)
\`\`\`

### Garantias
- ✓ **Atomicidade:** Venda é confirmada E estoque é abatido juntos
- ✓ **Sem Overselling:** Se faltar estoque, tudo é revertido
- ✓ **Auditoria:** Cada venda é registrada com quem vendeu e quando
- ✓ **Tempo Real:** Próxima venda vê estoque atualizado

---

## Fluxo 2: Compra no E-commerce

### Cenário
Cliente compra 3 brigadeiros no site com pagamento Pix.

### Passo a Passo

\`\`\`
PASSO 1: Cliente navega site
└─> Próxima.js renderiza produtos (SSG)
└─> Estoque vem do cache (revalidateTag cada 60s)
└─> Cliente vê: "Brigadeiro Gourmet - 25 em estoque - R$ 10"

PASSO 2: Cliente adiciona ao carrinho
└─> Frontend armazena em localStorage + SWR state
└─> Mostra quantidade selecionada

PASSO 3: Cliente clica "Finalizar Compra"
└─> Valida estoque novamente (pode ter mudado)
└─> Backend: SELECT current_stock FROM inventory WHERE product_id = X
└─> Se mudou (ex: agora tem apenas 2): "Apenas 2 disponíveis"

PASSO 4: Cliente preenche dados
└─> Nome, email, telefone
└─> Endereço de entrega
└─> Validações: CPF válido? CEP existe? Cep dentro do raio?

PASSO 5: Cliente escolhe forma de pagamento
└─> Seleciona: PIX
└─> Backend gera code PIX (via Stripe ou provedor)

PASSO 6: Cliente confirma pagamento
└─> Mostra QR Code PIX
└─> Cliente escaneia com celular
└─> Cliente confirma no banco
└─> Banco envia confirmação para backend (webhook)

PASSO 7: Webhook de Pagamento Confirmado
└─> Stripe/Provedor envia POST para /api/payments/webhook
└─> Backend valida assinatura (security)
└─> Busca pedido associado

PASSO 8: TRANSAÇÃO CRÍTICA (igual PDV)
└─> Backend inicia TRANSAÇÃO:
     a) FOR UPDATE na inventory
     b) Verifica estoque (pode ter mudado)
     c) Se ok: UPDATE inventory SET current_stock = current_stock - 3
     d) Cria pedido: INSERT INTO orders (status='CONFIRMED', delivery_type='delivery', ...)
     e) Registra venda: INSERT INTO sales_transactions (channel='ECOMMERCE', ...)
     f) COMMIT

PASSO 9: Sucesso - Criar integração
└─> Atualiza status pedido para CONFIRMED
└─> Envia email: "Pedido confirmado! Número: PED-123. Pronto em 30 min"
└─> Invalida cache de estoque
└─> Cria link de acompanhamento: /order/PED-123?token=xyz

PASSO 10: Se falha (sem estoque)
└─> ROLLBACK
└─> Retorna crédito ao cliente (via Stripe)
└─> Envia email: "Desculpe, produto saiu do estoque"
└─> Cliente pode recomprar outro produto
\`\`\`

### Garantias
- ✓ **Pagamento sem perda:** Se falhar venda, cliente recebe crédito
- ✓ **Sem Overselling:** Mesmo se múltiplos clientes comprarem simultaneamente
- ✓ **Rastreabilidade:** Cliente pode acompanhar via link ou email

---

## Fluxo 3: Pedido via WhatsApp Bot

### Cenário
Cliente envia "Quero 3 brigadeiros" no WhatsApp.

### Passo a Passo

\`\`\`
PASSO 1: Cliente envia mensagem
└─> WhatsApp API (Twilio) recebe
└─> Twilio envia webhook: POST /api/whatsapp
   └─> { from, message, timestamp, ... }

PASSO 2: Backend processa mensagem
└─> IA (usando LLM) processa: "Quero 3 brigadeiros"
└─> Identifica intenção: "FAZER_PEDIDO"
└─> Extrai entidades:
     └─> produto: "brigadeiro"
     └─> quantidade: 3

PASSO 3: Backend valida produto
└─> Busca no banco: SELECT * FROM products WHERE store_id = X AND name ILIKE '%brigadeiro%'
└─> Se encontra: "Brigadeiro Gourmet"
└─> Se não encontra: "Desculpe, não encontrei. Temos: Brigadeiro, Trufa, Bolo"

PASSO 4: Backend verifica estoque
└─> SELECT current_stock FROM inventory WHERE product_id = Y
└─> Se tem 3: Continua
└─> Se não tem: Responde "Desculpe, apenas 2 disponíveis. Quer assim?"

PASSO 5: Bot responde de confirmação
└─> Envia: "Ótimo! 3 Brigadeiros Gourmet = R$ 30"
└─> Oferece opções de pagamento:
     └─> "1️⃣ Pix"
     └─> "2️⃣ Crédito"
     └─> "3️⃣ Dinheiro (retirada)"

PASSO 6: Cliente responde escolha
└─> Envia: "Pix"
└─> Bot gera QR Code Pix (via endpoint)
└─> Envia: "[QR Code]" + "Código PIX: 00020126..."

PASSO 7: Cliente paga via Pix
└─> Cliente escaneia QR
└─> Confirma pagamento no banco
└─> Banco envia confirmação para backend

PASSO 8: Webhook de Pagamento Confirmado
└─> Backend recebe confirmação
└─> Inicia TRANSAÇÃO (igual PDV/E-commerce)

PASSO 9: Bot envia confirmação para cliente
└─> "✅ Pagamento recebido!"
└─> "Seu pedido está confirmado!"
└─> "Pronto em: ~30 minutos"
└─> "Número do pedido: PED-XYZ"
└─> "Link de acompanhamento: [link]"

PASSO 10: Bot envia notificação interna
└─> Avisa admin/fila de produção
└─> "Novo pedido no WhatsApp: 3 Brigadeiros"
└─> Começa produção

PASSO 11: Admin marca "Pronto"
└─> Muda status em dashboard
└─> Bot envia para cliente:
    └─> "🎉 Seu pedido está pronto!"
    └─> "Forma de entrega: Retirada na loja / Entrega"
    └─> "Endereço: ..."

PASSO 12: Cliente retira/recebe
└─> Retirada: Cliente vai na loja
└─> Entrega: Motoboy busca na loja e entrega
└─> Admin marca "ENTREGUE" no dashboard
└─> Bot envia: "✅ Obrigado!"
\`\`\`

### Garantias
- ✓ **Sem Overselling:** Mesmo fluxo de transação
- ✓ **Atendimento Automático:** Bot responde em < 3 segundos
- ✓ **Fallback Humano:** Se cliente digita algo estranho, oferece atendente
- ✓ **Rastreabilidade:** Cliente acompanha via WhatsApp

---

## Fluxo 4: Atualizar Estoque (Manualmente)

### Cenário
Admin recebe 50 brigadeiros nova produção, precisa atualizar sistema.

### Passo a Passo

\`\`\`
PASSO 1: Admin abre dashboard → Estoque
└─> Vê: Brigadeiro: 5 unidades

PASSO 2: Admin clica "Repor"
└─> Abre modal: "Adicionar Estoque"
└─> Pergunta: "Quantas unidades?"

PASSO 3: Admin digita 50
└─> Confirma

PASSO 4: Backend executa UPDATE
└─> UPDATE inventory SET current_stock = 5 + 50 = 55
└─> Registra na auditoria: "Admin adicionou 50 unidades"
└─> Invalida cache Redis

PASSO 5: Dashboard atualiza em tempo real
└─> Mostra: Brigadeiro: 55 unidades
└─> PDV recarrega cache
└─> E-commerce revalida tags
└─> WhatsApp Bot vê disponibilidade
\`\`\`

### Observação Importante
Para diminuir estoque (descartar produto ruim, por exemplo):

\`\`\`
Admin digita: -5 (negativo)
Backend:
  IF novo_estoque < 0 THEN
    Mostra erro: "Você tentou remover mais do que existe"
    Faz sugestão: "Máximo que pode remover: 5"
  END IF
\`\`\`

---

## Fluxo 5: Acompanhar Pedido (Cliente)

### Cenário
Cliente quer saber se seu pedido está pronto.

### Passo a Passo

\`\`\`
PASSO 1: Cliente recebe email de confirmação
└─> "Seu pedido foi confirmado!"
└─> Link de acompanhamento: /order/PED-123?token=xyz

PASSO 2: Cliente clica no link
└─> Abre página pública de acompanhamento
└─> Backend valida token (segurança: apenas cliente pode ver)

PASSO 3: Backend busca pedido
└─> SELECT * FROM orders WHERE id = 'PED-123'
└─> SELECT * FROM order_items WHERE order_id = 'PED-123'
└─> Retorna ao frontend

PASSO 4: Frontend exibe status
┌──────────────────────────────┐
│ ACOMPANHE SEU PEDIDO         │
│ Número: PED-123              │
│ ✓ Confirmado (14:35)        │
│ ✓ Pagamento (14:36)         │
│ → Em Produção (14:37)       │
│ ◯ Pronto p/ Retirada        │
│ ◯ Entregue                  │
│                              │
│ Produtos:                   │
│ - Brigadeiro x3 = R$ 30     │
│                              │
│ Total: R$ 30                │
└──────────────────────────────┘

PASSO 5: Cliente recebe notificação
Quando admin muda status para PRONTO:
└─> WhatsApp: "Seu pedido PED-123 está pronto! 🎉"
└─> Email: "Seu pedido está pronto para retirada"

PASSO 6: Cliente retira
└─> Vai na loja
└─> Diz numero: PED-123
└─> Loja entrega
└─> Admin marca ENTREGUE
└─> Cliente recebe SMS: "Obrigado! Espero sua próxima compra"
\`\`\`
