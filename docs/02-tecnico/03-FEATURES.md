# 03 - FUNCIONALIDADES DETALHADAS

## Módulo 1: PDV (Ponto de Venda Web)

### Responsabilidade
Interface para vendedores registrarem vendas físicas no balcão, com **velocidade máxima** e **zero erros de estoque**.

### Features Principais

#### 1.1 Dashboard do Vendedor
\`\`\`
┌─────────────────────────────────────┐
│  PDV - Loja Chocolá Velha           │ 
│  Vendedor: Maria                     │
│  Horário: 14:32 | Estoque Atualizado│
├─────────────────────────────────────┤
│ [BUSCAR PRODUTO]                    │
├─────────────────────────────────────┤
│ Atalhos Rápidos:                    │
│ [Brigadeiro Gourmet]  [Trufas]      │
│ [Bolo de Chocolate]   [Leite Ninho] │
├─────────────────────────────────────┤
│ CARRINHO DE VENDAS                  │
│ Brigadeiro x5    R$ 50.00           │
│ Trufa x3         R$ 30.00           │
│ ─────────────────────────           │
│ TOTAL:           R$ 80.00           │
│                                      │
│ [CANCELAR]  [VENDER]  [PAGAR]       │
└─────────────────────────────────────┘
\`\`\`

#### 1.2 Busca de Produtos
- Campo de busca por **nome** ou **código de barras**
- Auto-complete com sugestões
- Mostra: Nome, Preço, Estoque ATUAL
- Teclado físico (scanner) compatível

**Fluxo:**
\`\`\`
Vendedor digita "brig"
└─> Backend busca: SELECT * FROM products WHERE name ILIKE '%brig%' LIMIT 10
└─> Mostra resultado em tempo real
└─> Vendedor clica em "Brigadeiro Gourmet"
└─> Produto vai para carrinho
\`\`\`

#### 1.3 Carrinho de Vendas
- Mostra produtos selecionados
- Permite mudar quantidade
- Calcula subtotal automático
- Mostra estoque disponível (para não vender mais do que tem)
- Botão para remover item

**Validação:**
\`\`\`
Vendedor quer comprar 10 brigadeiros
Backend verifica: SELECT estoque FROM inventory WHERE product_id = X
  - Se estoque >= 10: Permite
  - Se estoque < 10: Mostra "Apenas 5 disponíveis"
\`\`\`

#### 1.4 Processar Venda
Quando vendedor clica "VENDER":

\`\`\`
1. Frontend valida:
   ├─> Carrinho não vazio? ✓
   ├─> Quantidade > 0? ✓
   ├─> Produto existe? ✓

2. Backend processa (TRANSAÇÃO):
   ├─> FOR UPDATE na tabela inventory
   ├─> Verifica estoque novamente
   ├─> Abate estoque
   ├─> Cria pedido com status ENTREGUE
   ├─> Registra na tabela sales_transactions
   ├─> COMMIT

3. Se sucesso:
   ├─> Mostra comprovante
   ├─> Limpa carrinho
   ├─> Atualiza estoque na tela

4. Se falha:
   ├─> Mostra erro (ex: "Sem estoque")
   ├─> ROLLBACK automático
   ├─> Carrinho mantido
\`\`\`

#### 1.5 Relatório de Venda (Comprovante)
\`\`\`
╔════════════════════════════════════╗
║        COMPROVANTE DE VENDA        ║
║  Chocolá Velha - PDV              ║
├────────────────────────────────────┤
║ Data: 15/11/2024 14:35            ║
║ Vendedor: Maria                    ║
║ ID Transação: TXN-20241115-0235    ║
├────────────────────────────────────┤
║ Produto              Qtd    Valor  ║
║ Brigadeiro Gourmet   5     R$ 50   ║
║ Trufa de Chocolate   3     R$ 30   ║
├────────────────────────────────────┤
║ Subtotal:                  R$ 80   ║
║ Desconto:                  R$  0   ║
║ TOTAL:                     R$ 80   ║
├────────────────────────────────────┤
║ Forma de Pagamento: Dinheiro       ║
║                                     ║
║ Obrigado pela compra!               ║
╚════════════════════════════════════╝
\`\`\`

#### 1.6 Modo Offline
- PDV salva dados em `localStorage`
- Quando volta internet, sincroniza com backend
- Evita perda de dados

---

## Módulo 2: E-COMMERCE (Web Storefront)

### Responsabilidade
Vitrine online de produtos com carrinho, checkout e integração de pagamentos.

### Features Principais

#### 2.1 Homepage & Catálogo
\`\`\`
┌────────────────────────────────────────┐
│  Chocolá Velha - Doces Artesanais      │
│  [PRODUTOS] [SOBRE] [CONTATO]          │
├────────────────────────────────────────┤
│                                         │
│  PRODUTOS POPULARES:                   │
│  ┌──────────┐ ┌──────────┐            │
│  │ Brigadeiro│ │ Trufa    │            │
│  │ R$ 10.00 │ │ R$ 12.00 │            │
│  │ (25 em stock)                       │
│  └──────────┘ └──────────┘            │
│                                         │
│  FILTROS:                              │
│  [Todos] [Brigadeiro] [Trufa] [Bolos] │
│                                         │
│  Grid de produtos com imagens          │
└────────────────────────────────────────┘
\`\`\`

**Funcionalidades:**
- Exibir categoria/filtro de produtos
- Mostrar foto, nome, preço, estoque
- Carrinho flutuante (direita)
- Pesquisa por nome
- Ordenar por: Popular, Preço (ASC/DESC), Novo

#### 2.2 Página de Produto
\`\`\`
┌────────────────────────────────────┐
│ Brigadeiro Gourmet                 │
├────────────────────────────────────┤
│ [FOTO GRANDE]                      │
│                                     │
│ Preço: R$ 10.00                    │
│ Estoque: 25 unidades               │
│ Avaliação: ⭐⭐⭐⭐⭐ (120 reviews) │
│                                     │
│ Descrição:                         │
│ "Brigadeiro feito com chocolate    │
│  premium e leite condensado..."    │
│                                     │
│ Ingredientes:                      │
│ - Chocolate 70%                    │
│ - Leite Condensado                 │
│ - Manteiga                         │
│ - Açúcar                           │
│                                     │
│ Quantidade: [1] [+] [-]            │
│ [ADICIONAR AO CARRINHO]            │
│ [COMPARTILHAR]                     │
└────────────────────────────────────┘
\`\`\`

**Funcionalidades:**
- Galeria de fotos (zoom)
- Descrição completa
- Ingredientes
- Reviews de clientes
- Relacionados/Sugestões

#### 2.3 Carrinho de Compras
\`\`\`
┌─────────────────────────────┐
│  SEU CARRINHO               │
├─────────────────────────────┤
│ Brigadeiro x3    R$ 30.00   │
│ Trufa x2         R$ 24.00   │
│                              │
│ Subtotal:        R$ 54.00   │
│ Frete:           R$  8.00   │
│ Desconto:        R$  0.00   │
│ ─────────────────────────    │
│ TOTAL:           R$ 62.00   │
│                              │
│ [CONTINUAR COMPRANDO]       │
│ [FINALIZAR COMPRA]          │
└─────────────────────────────┘
\`\`\`

**Funcionalidades:**
- Adicionar/remover produtos
- Mudar quantidade
- Aplicar cupom de desconto
- Estimar frete
- Salvar carrinho (localStorage)

#### 2.4 Checkout (Uma Página)
\`\`\`
PASSO 1: DADOS PESSOAIS
├─ Nome *
├─ Email *
├─ Telefone *
├─ CPF

PASSO 2: ENDEREÇO DE ENTREGA
├─ CEP *
├─ Rua *
├─ Número *
├─ Complemento
├─ Bairro *
├─ Cidade *
├─ Estado *

PASSO 3: FORMA DE ENTREGA
├─ [ ] Retirada na loja
├─ [ ] Entrega em domicílio
    └─ Frete: R$ 8.00
├─ [ ] Entrega expressa
    └─ Frete: R$ 15.00

PASSO 4: FORMA DE PAGAMENTO
├─ [ ] Pix (cópia e cola)
├─ [ ] Débito/Crédito (Stripe)
├─ [ ] Boleto Bancário
├─ [ ] Crediário (parcelado)

PASSO 5: REVISÃO & CONFIRMAÇÃO
├─ Resumo do pedido
├─ [CONFIRMAR PAGAMENTO]
\`\`\`

**Fluxo:**
\`\`\`
1. Cliente preenche dados
   └─> Valida em tempo real (CPF válido? CEP existe?)

2. Cliente seleciona forma de entrega
   └─> Calcula frete

3. Cliente seleciona forma de pagamento
   └─> Se Pix: Gera QR code
   └─> Se Débito/Crédito: Abre form Stripe
   └─> Se Boleto: Gera código

4. Cliente clica "CONFIRMAR"
   └─> Submete para pagamento
   └─> Aguarda confirmação

5. Quando pagamento confirmado:
   └─> Inicia TRANSAÇÃO (mesmo fluxo PDV)
   └─> Abate estoque
   └─> Cria pedido
   └─> Envia email de confirmação
   └─> Redireciona para página de sucesso
\`\`\`

#### 2.5 Acompanhamento de Pedido
Cliente pode acompanhar pedido via:
- **Link na confirmação:** `/order/ABC123?token=xyz`
- **Email:** Recebe atualizações automáticas

**Página de Acompanhamento:**
\`\`\`
┌──────────────────────────────────┐
│ ACOMPANHAMENTO DO PEDIDO         │
├──────────────────────────────────┤
│ Pedido: #ABC123                  │
│ Data: 15/11/2024 14:35           │
│ Total: R$ 62.00                  │
│                                   │
│ STATUS:                          │
│ ✓ Pedido Confirmado              │
│ ✓ Pagamento Confirmado           │
│ → Em Produção (Pronto em 1h)    │
│ ◯ Pronto para Retirada           │
│ ◯ Entregue                       │
│                                   │
│ Últimas Atualizações:           │
│ 14:35 - Pedido confirmado        │
│ 14:36 - Pagamento processado     │
│ 14:37 - Começou produção         │
└──────────────────────────────────┘
\`\`\`

---

## Módulo 3: WHATSAPP BOT

### Responsabilidade
Atendimento automático via WhatsApp para consultas, pedidos e pagamentos.

### Features Principais

#### 3.1 Fluxo de Conversa

\`\`\`
CLIENTE: Oi, vocês têm brigadeiro?

BOT: Oi! 👋 Bem-vindo à Chocolá Velha!
     Somos especializados em doces artesanais.
     
     Nossos principais produtos:
     🍫 1. Brigadeiro Gourmet (R$ 10)
     🍫 2. Trufa de Chocolate (R$ 12)
     🍰 3. Bolo de Chocolate (R$ 25)
     🍮 4. Mousse (R$ 8)
     
     Qual você gostaria?

CLIENTE: Quero 3 brigadeiros

BOT: Ótimo! 3 Brigadeiros Gourmet = R$ 30
     
     Como você gostaria de pagar?
     💳 1. Crédito/Débito
     📱 2. Pix
     💵 3. Dinheiro (retirada)

CLIENTE: Pix

BOT: [QR Code Pix]
     Código PIX (copiar e colar):
     000201...
     
     Seu pedido será confirmado assim que 
     recebemos o pagamento.
     
     Tempo de produção: ~30 min
     Pronto para retirada ou entrega?

CLIENTE: Entrega

BOT: Qual é seu endereço para entrega?

CLIENTE: Rua das Flores, 123, apt 401

BOT: Confirma?
     Rua das Flores, 123, apt 401
     Frete: R$ 8
     Total com frete: R$ 38
     
     [CONFIRMAR ENTREGA]
\`\`\`

#### 3.2 Processar Pedido via WhatsApp

\`\`\`
1. Cliente envia mensagem
   └─> Twilio webhook recebe
   └─> Backend extrai: {message, phone, timestamp}

2. IA processa (usando modelo):
   └─> Identifica intenção: "Consultar" / "Fazer pedido" / "Cancelar"
   └─> Extrai entidades: {produto, quantidade}
   └─> Valida estoque

3. Se intenção é "Fazer pedido":
   └─> "Você quer 3 brigadeiros?"
   └─> Cliente responde "sim"
   └─> Cria pedido com status PENDENTE_PAGAMENTO
   └─> Gera link de pagamento (Stripe ou Pix)
   └─> Aguarda confirmação

4. Quando pagamento confirmado (webhook):
   └─> Inicia TRANSAÇÃO
   └─> Abate estoque
   └─> Atualiza pedido para CONFIRMADO
   └─> Envia mensagem: "Pedido confirmado! Pronto em 30 min"

5. Quando pedido fica pronto:
   └─> Admin marca como PRONTO
   └─> Bot envia: "Seu pedido está pronto! 🎉"
\`\`\`

#### 3.3 Fallback para Atendimento Humano

Se bot não conseguir resolver:
\`\`\`
BOT: Desculpe, não entendi muito bem. 😅
     Você gostaria de falar com um atendente?
     [SIM] [NÃO]

CLIENTE: SIM

BOT: Conectando com atendente...
     Tempo de espera: ~5 min

[Agora atendente humano no chat]

ATENDENTE: Oi! Sou Maria, como posso ajudar?
\`\`\`

**Implementação:**
- Fila de atendimento (Upstash Redis)
- Notificação para admin quando cliente aguarda
- Histórico de conversa disponível

#### 3.4 Notificações Proativas

Bot envia para cliente:
- ✓ "Seu pedido foi confirmado!"
- ✓ "Seu pedido está em produção!"
- ✓ "Seu pedido está pronto!"
- ✓ "Seu pedido foi entregue!"

---

## Módulo 4: ADMIN DASHBOARD

### Responsabilidade
Visão centralizada para dono/gerente: relatórios, pedidos, estoque, vendedores.

### Features Principais

#### 4.1 Dashboard Home
\`\`\`
┌─────────────────────────────────────────┐
│ DASHBOARD - Chocolá Velha               │
│ 15/11/2024                              │
├─────────────────────────────────────────┤
│                                          │
│ KPIs de Hoje:                           │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Vendas   │ │ Pedidos  │ │ Estoque  │ │
│ │ R$ 2.340 │ │ 15       │ │ OK       │ │
│ └──────────┘ └──────────┘ └──────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Vendas por Canal (Últimos 7 dias)  │ │
│ │ [Gráfico]                            │ │
│ │ PDV: 60% | E-com: 30% | WhatsApp: 10│ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Últimos Pedidos (Hoje)             │ │
│ │ PED-001 - Brigadeiro x5 - PRONTO   │ │
│ │ PED-002 - Trufa x3    - EM_PRODUCAO│ │
│ │ PED-003 - Bolo x2    - PENDENTE    │ │
│ └──────────────────────────────────────┘ │
└─────────────────────────────────────────┘
\`\`\`

#### 4.2 Relatórios de Vendas
- **Período:** Hoje, Semana, Mês, Período Customizado
- **Filtros:** Canal (PDV/E-com/WhatsApp), Produto, Vendedor
- **Métricas:** Total vendido, ticket médio, produto mais vendido
- **Export:** CSV, PDF

**Exemplo de Relatório:**
\`\`\`
RELATÓRIO DE VENDAS - Novembro 2024
═════════════════════════════════════

Total Vendido: R$ 45.230
Número de Transações: 342
Ticket Médio: R$ 132,25

Por Canal:
  PDV (Loja Física):   R$ 28.500 (63%)
  E-commerce:          R$ 12.000 (27%)
  WhatsApp:            R$  4.730 (10%)

Produtos Mais Vendidos:
  1. Brigadeiro (450 unidades)
  2. Trufa (320 unidades)
  3. Bolo (180 unidades)

Horários de Pico:
  Manhã (8h-12h):  20%
  Tarde (12h-18h): 55%
  Noite (18h-23h): 25%

Vendedores (PDV):
  Maria:  R$ 15.200 (53%)
  João:   R$ 13.300 (47%)
\`\`\`

#### 4.3 Gestão de Estoque
\`\`\`
INVENTÁRIO - CHOCOLÁ VELHA
═════════════════════════════════════

PRODUTO               ESTOQUE  MÍNIMO  STATUS   AÇÃO
Brigadeiro Gourmet      120      30    ✓ OK     [EDITAR]
Trufa Chocolate          45      20    ⚠ BAIXO  [REPOR]
Bolo de Chocolate        12      10    ⚠ BAIXO  [REPOR]
Mousse                    0       5    ✗ VAZIO  [REPOR]

[ADICIONAR NOVO PRODUTO]
\`\`\`

**Funcionalidades:**
- Mostrar quantidade atual
- Quantidade mínima (alerta quando atinge)
- Histórico de movimentação
- Repor estoque (manual ou automático)
- Desativar produtos sem estoque

#### 4.4 Fila de Produção
\`\`\`
FILA DE PRODUÇÃO - EM TEMPO REAL
═════════════════════════════════════

🔴 URGENTES (10+ min esperando):
  PED-001 | Brigadeiro x10 | Cliente: João
  PED-002 | Bolo x2       | Cliente: Maria
  
🟡 NORMAIS (< 10 min):
  PED-003 | Trufa x5      | Cliente: Pedro
  PED-004 | Mousse x3     | Cliente: Ana

🟢 PRONTOS (Aguardando retirada):
  PED-005 | Brigadeiro x3 | Cliente: Lucas
  
Status por Produto:
  Brigadeiro: 3 em produção, 1 pronto
  Bolo: 1 em produção, 0 pronto
  Trufa: 1 em produção, 0 pronto
\`\`\`

**Funcionalidades:**
- Visualizar todos os pedidos em fila
- Mudar status (Pendente → Em Produção → Pronto → Entregue)
- Filtro por urgência
- Aviso sonoro/visual quando pedido fica atrasado
- Integrado com WhatsApp (notifica cliente quando pronto)

#### 4.5 Gestão de Usuarios & Permissões
\`\`\`
USUÁRIOS - CONTROLE DE ACESSO
═════════════════════════════════════

USUÁRIO    EMAIL              ROLE       STATUS    AÇÃO
Maria      maria@email        Vendedor   ✓ Ativo   [EDITAR]
João       joao@email         Vendedor   ✓ Ativo   [EDITAR]
Pedro      pedro@email        Gerente    ✓ Ativo   [EDITAR]
Admin      admin@chocola      Admin      ✓ Ativo   [EDITAR]

[ADICIONAR NOVO USUÁRIO]

ROLES:
├─ Admin: Acesso total (relatórios, configurações)
├─ Gerente: Relatórios, fila de produção, usuários
└─ Vendedor: Apenas PDV
\`\`\`

**Funcionalidades:**
- Criar/editar/remover usuários
- Atribuir roles
- Resetar senha
- Ativar/desativar acesso
- Auditoria de quem fez o quê

#### 4.6 Configurações
\`\`\`
CONFIGURAÇÕES - CHOCOLÁ VELHA
═════════════════════════════════════

INFORMAÇÕES DA LOJA:
├─ Nome: Chocolá Velha
├─ CNPJ: 12.345.678/0001-90
├─ Email: contato@chocolavelha.com.br
├─ Telefone: (11) 98765-4321
├─ Endereço: Rua das Flores, 123, São Paulo, SP

PAGAMENTOS:
├─ [ ] Dinheiro
├─ [x] Pix
├─ [x] Débito/Crédito (Stripe)
├─ [ ] Boleto

ENTREGA:
├─ Frete fixo: R$ 8.00
├─ Raio de entrega: 5 km
├─ Tempo de produção: 30 min

NOTIFICAÇÕES:
├─ [x] Email quando novo pedido
├─ [x] SMS quando pedido fica pronto
├─ [x] Notificar cliente via WhatsApp
\`\`\`
