> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# ðŸŽ¯ MVP Focado - Problemas Reais da MÃ£e

> **Foco:** Resolver os 2 problemas CRÃTICOS dela: Controle de Estoque + AutomaÃ§Ã£o WhatsApp

---

## ðŸ“‹ Problemas Identificados

### Problema #1: Controle de Estoque â­â­â­ CRÃTICO
- Overselling frequente
- Estoque nÃ£o sincronizado
- PrejuÃ­zo com vendas que nÃ£o pode entregar

### Problema #2: WhatsApp Tomando Muito Tempo â­â­â­ CRÃTICO
- Muitas mensagens de clientes
- Especialmente encomendas de bolos personalizados
- Tempo desperdiÃ§ado respondendo perguntas repetitivas

---

## ðŸŽ¯ MVP MÃ­nimo Focado (4-6 semanas)

### PRIORIDADE 1: Controle de Estoque (Semanas 1-3)

**Features:**
1. **PDV Web (Tablet/Celular)**
   - Busca produto
   - Adiciona ao carrinho
   - Finaliza venda
   - Abate estoque automaticamente (ACID)

2. **GestÃ£o de Estoque em Tempo Real**
   - Lista produtos com estoque atualizado
   - Alerta quando estoque baixo
   - HistÃ³rico de movimentaÃ§Ãµes

3. **Dashboard BÃ¡sico**
   - Estoque atual (todos produtos)
   - Produtos com estoque baixo
   - Vendas do dia (validaÃ§Ã£o)

**ValidaÃ§Ã£o:**
- âœ… ZERO overselling em 30 dias
- âœ… Ela usa TODO dia
- âœ… Estoque sempre correto

---

### PRIORIDADE 2: AutomaÃ§Ã£o WhatsApp (Semanas 4-6)

**Features:**
1. **Bot WhatsApp Inteligente**
   - Responde perguntas comuns automaticamente
   - Mostra cardÃ¡pio/menu
   - Informa preÃ§os
   - Processa encomendas simples

2. **Fluxo de Encomendas Personalizadas**
   - Coleta informaÃ§Ãµes (tipo de bolo, tamanho, data)
   - Envia para aprovaÃ§Ã£o dela
   - Ela aprova/rejeita
   - Bot confirma com cliente

3. **AutomaÃ§Ã£o de Pedidos Simples**
   - Cliente: "Quero 10 brigadeiros"
   - Bot: processa automaticamente
   - Bot: gera QR Code Pix
   - Bot: confirma quando pago

**ValidaÃ§Ã£o:**
- âœ… 80% mensagens respondidas por bot
- âœ… Ela economiza tempo
- âœ… Encomendas coletadas automaticamente

---

## ðŸ—ï¸ Arquitetura MVP Focado

### Backend (NestJS)

**MÃ³dulos Essenciais:**

1. **Auth** (jÃ¡ existe)
   - Login simples
   - JWT token

2. **Products** (jÃ¡ existe - precisa melhorar)
   - CRUD produtos
   - Estoque em tempo real
   - Alertas de estoque baixo

3. **Orders** (jÃ¡ existe - precisa garantir ACID)
   - Criar pedido
   - Abater estoque com FOR UPDATE (crÃ­tico)
   - ValidaÃ§Ã£o de estoque antes de criar

4. **WhatsApp** (implementar)
   - Mock provider primeiro (desenvolvimento)
   - Bot inteligente (processamento de mensagens)
   - Fluxo de encomendas

**MÃ³dulos NÃƒO fazer ainda:**
- âŒ E-commerce completo
- âŒ RelatÃ³rios complexos
- âŒ IntegraÃ§Ãµes externas

---

### Frontend (Next.js)

**PÃ¡ginas Essenciais:**

1. **PDV** (`/pdv`)
   - Busca produto (rÃ¡pida)
   - Carrinho com estoque em tempo real
   - Finalizar venda
   - Feedback visual (sucesso/erro de estoque)

2. **Estoque** (`/admin/estoque`)
   - Lista de produtos
   - Estoque atual (atualizado em tempo real)
   - Produtos com estoque baixo (destaque)
   - HistÃ³rico de movimentaÃ§Ãµes

3. **Dashboard** (`/admin`)
   - Vendas do dia
   - Estoque resumo (total produtos, baixos)
   - AÃ§Ãµes rÃ¡pidas

4. **WhatsApp Encomendas** (`/admin/encomendas`)
   - Lista de encomendas pendentes
   - Aprovar/rejeitar
   - Detalhes da encomenda

**PÃ¡ginas NÃƒO fazer ainda:**
- âŒ E-commerce (depois)
- âŒ RelatÃ³rios complexos (depois)

---

## ðŸ“… Timeline Detalhado

### Semana 1: Setup + Estoque BÃ¡sico

**Objetivos:**
- [ ] Docker configurado
- [ ] Backend rodando
- [ ] Frontend rodando
- [ ] Cadastrar produtos dela
- [ ] Estoque inicial cadastrado
- [ ] PÃ¡gina de estoque bÃ¡sica

**EntregÃ¡veis:**
- Sistema rodando
- Ela vÃª estoque atual
- Produtos cadastrados

---

### Semana 2: PDV com Controle de Estoque

**Objetivos:**
- [ ] PÃ¡gina PDV funcional
- [ ] Busca de produtos rÃ¡pida
- [ ] Carrinho mostra estoque em tempo real
- [ ] ValidaÃ§Ã£o antes de adicionar (tem estoque?)
- [ ] Finalizar venda com FOR UPDATE (ACID)
- [ ] Abate estoque automaticamente

**EntregÃ¡veis:**
- Ela consegue fazer venda pelo PDV
- Estoque Ã© abatido automaticamente
- ZERO overselling garantido (tecnica ACID)

---

### Semana 3: Dashboard + ValidaÃ§Ã£o

**Objetivos:**
- [ ] Dashboard com estoque resumo
- [ ] Alertas de estoque baixo
- [ ] Ela usa no dia a dia
- [ ] Feedback real
- [ ] Corrigir bugs crÃ­ticos

**ValidaÃ§Ã£o:**
- âœ… ZERO overselling em 7 dias?
- âœ… Ela usa TODO dia?
- âœ… Ela confia no sistema?

---

### Semana 4: Bot WhatsApp BÃ¡sico

**Objetivos:**
- [ ] Bot responde mensagens (mock primeiro)
- [ ] Mostra cardÃ¡pio
- [ ] Informa preÃ§os
- [ ] Processa pedidos simples

**EntregÃ¡veis:**
- Bot funcional (mesmo que mock)
- Ela testa interaÃ§Ã£o
- Feedback sobre respostas

---

### Semana 5: Fluxo de Encomendas

**Objetivos:**
- [ ] Bot coleta informaÃ§Ãµes de encomenda
- [ ] Envia para aprovaÃ§Ã£o dela
- [ ] Ela aprova/rejeita
- [ ] Bot confirma com cliente

**EntregÃ¡veis:**
- Encomendas coletadas automaticamente
- Ela aprova/rejeita rapidamente
- Cliente recebe confirmaÃ§Ã£o

---

### Semana 6: Polimento + IntegraÃ§Ã£o Real

**Objetivos:**
- [ ] Integrar WhatsApp real (Evolution API ou mock melhorado)
- [ ] Melhorias de UX
- [ ] Performance
- [ ] ValidaÃ§Ã£o final

**EntregÃ¡veis:**
- Sistema completo funcionando
- Ela usa no dia a dia
- Tempo economizado validado

---

## ðŸŽ¯ Checklist TÃ©cnico Detalhado

### Semana 1: Setup + Estoque

**Backend:**
- [ ] Validar que `OrdersService` usa FOR UPDATE
- [ ] Adicionar endpoint `/api/products/stock` (estoque atualizado)
- [ ] Adicionar endpoint `/api/products/low-stock` (produtos baixos)
- [ ] Teste: criar pedido abate estoque (ACID)

**Frontend:**
- [ ] PÃ¡gina `/admin/estoque`
- [ ] Lista produtos com estoque
- [ ] Destaque produtos com estoque baixo
- [ ] AtualizaÃ§Ã£o em tempo real (SWR polling)

**Teste:**
- Ela vÃª estoque atual?
- Produtos cadastrados corretamente?

---

### Semana 2: PDV com Estoque

**Frontend:**
- [ ] PÃ¡gina `/pdv` melhorada
- [ ] Busca rÃ¡pida de produtos
- [ ] Mostra estoque ao lado do produto
- [ ] Desabilita produto se estoque = 0
- [ ] ValidaÃ§Ã£o no carrinho (tem estoque suficiente?)
- [ ] Finalizar venda com feedback visual

**Backend:**
- [ ] Validar que pedido usa transaÃ§Ã£o ACID
- [ ] ValidaÃ§Ã£o de estoque antes de criar pedido
- [ ] Retornar erro se nÃ£o tem estoque
- [ ] Abate estoque com FOR UPDATE

**Teste:**
- Ela consegue fazer venda?
- Estoque Ã© abatido?
- NÃ£o consegue vender mais do que tem?

---

### Semana 3: Dashboard

**Frontend:**
- [ ] Dashboard `/admin` melhorado
- [ ] Cards: Vendas hoje, Estoque total, Produtos baixos
- [ ] GrÃ¡fico simples (vendas Ãºltimos 7 dias)
- [ ] Alertas visuais (estoque baixo)

**Teste:**
- Ela vÃª informaÃ§Ãµes Ãºteis?
- Alertas aparecem quando estoque baixo?

---

### Semana 4: Bot WhatsApp BÃ¡sico

**Backend:**
- [ ] Implementar `WhatsappBotService` bÃ¡sico
- [ ] Processar mensagens comuns:
  - "CardÃ¡pio" â†’ mostra produtos
  - "PreÃ§o de [produto]" â†’ mostra preÃ§o
  - "Quero [quantidade] [produto]" â†’ cria pedido
- [ ] Mock provider (para testes)

**Frontend:**
- [ ] Simulador de mensagens WhatsApp (para testes)
- [ ] Ver respostas do bot

**Teste:**
- Bot responde corretamente?
- Ela gosta das respostas?

---

### Semana 5: Encomendas Personalizadas

**Backend:**
- [ ] Fluxo de coleta de informaÃ§Ãµes:
  1. Cliente: "Quero encomendar um bolo"
  2. Bot: "Que tipo de bolo?"
  3. Cliente: "[tipo]"
  4. Bot: "Que tamanho? (pequeno/mÃ©dio/grande)"
  5. Cliente: "[tamanho]"
  6. Bot: "Para quando?"
  7. Cliente: "[data]"
  8. Bot: "Encomenda coletada! Aguarde aprovaÃ§Ã£o."
- [ ] Criar entidade `Encomenda` (tipo, tamanho, data, status)
- [ ] Endpoint para aprovar/rejeitar encomendas

**Frontend:**
- [ ] PÃ¡gina `/admin/encomendas`
- [ ] Lista de encomendas pendentes
- [ ] Detalhes da encomenda
- [ ] BotÃµes: Aprovar / Rejeitar
- [ ] Ao aprovar, bot envia confirmaÃ§Ã£o ao cliente

**Teste:**
- Bot coleta informaÃ§Ãµes corretamente?
- Ela aprova/rejeita facilmente?
- Cliente recebe confirmaÃ§Ã£o?

---

### Semana 6: Polimento

**Backend:**
- [ ] Integrar WhatsApp real (Evolution API ou mock melhorado)
- [ ] Melhorar processamento de mensagens (Ollama quando necessÃ¡rio)
- [ ] Performance (cache, queries otimizadas)

**Frontend:**
- [ ] Melhorias de UX (feedback visual, loading states)
- [ ] Mobile responsivo (PDV no celular funciona bem?)
- [ ] Performance (carregamento rÃ¡pido)

**ValidaÃ§Ã£o:**
- âœ… Ela usa TODO dia?
- âœ… ZERO overselling?
- âœ… Tempo economizado no WhatsApp?

---

## ðŸ’¡ Features EspecÃ­ficas para Encomendas

### Fluxo de Encomenda Personalizada:

```
Cliente: "Quero encomendar um bolo"
Bot: "Ã“timo! Que tipo de bolo vocÃª quer?"
Bot: "Exemplos: casamento, aniversÃ¡rio, festa, etc"

Cliente: "AniversÃ¡rio"
Bot: "Perfeito! Que tamanho? (pequeno/mÃ©dio/grande)"

Cliente: "MÃ©dio"
Bot: "Para quantas pessoas serve?"

Cliente: "30 pessoas"
Bot: "Para quando vocÃª precisa? (dia/mÃªs)"

Cliente: "15/02"
Bot: "Algum sabor especÃ­fico ou tema?"

Cliente: "Chocolate com morangos"
Bot: "Entendido! Encomenda: Bolo de AniversÃ¡rio, MÃ©dio (30 pessoas), Chocolate com Morangos, para 15/02"
Bot: "O valor Ã© R$ [preÃ§o]. EstÃ¡ correto? (sim/nÃ£o)"

Cliente: "Sim"
Bot: "Ã“timo! Sua encomenda foi enviada para aprovaÃ§Ã£o. Aguarde confirmaÃ§Ã£o!"

[Bot cria encomenda pendente]
[Ela vÃª na pÃ¡gina /admin/encomendas]
[Ela aprova/rejeita]
[Bot envia confirmaÃ§Ã£o ao cliente]
```

---

## âœ… CritÃ©rios de Sucesso MVP

### ValidaÃ§Ã£o TÃ©cnica:

- âœ… **ZERO overselling** em 30 dias
- âœ… **Estoque sempre correto** (sincronizado)
- âœ… **Sistema estÃ¡vel** (sem crashes)

### ValidaÃ§Ã£o de Uso:

- âœ… **Ela usa TODO dia** (nÃ£o sÃ³ testa)
- âœ… **Ela confia no sistema** (nÃ£o verifica manualmente)
- âœ… **PDV Ã© rÃ¡pido** (< 2 min por venda)

### ValidaÃ§Ã£o WhatsApp:

- âœ… **80% mensagens** respondidas por bot
- âœ… **Encomendas coletadas** automaticamente
- âœ… **Tempo economizado** (ela confirma: "Economizou tempo?")

### ValidaÃ§Ã£o de SatisfaÃ§Ã£o:

- âœ… **Ela gosta** ("Funciona bem!")
- âœ… **Ela recomendaria** ("Sim, usaria sempre")
- âœ… **Ela quer continuar** usando

---

## ðŸš€ PrÃ³ximos Passos Imediatos

### Esta Semana:

1. **Validar Setup**
   - Docker configurado?
   - Backend rodando?
   - Frontend rodando?

2. **Cadastrar Produtos**
   - Listar produtos dela
   - Cadastrar no sistema
   - Cadastrar estoque inicial

3. **Garantir ACID**
   - Validar que pedidos usam FOR UPDATE
   - Testar: criar pedido abate estoque
   - Garantir que nÃ£o pode vender mais do que tem

### PrÃ³xima Semana:

4. **Implementar PDV com Estoque**
   - PÃ¡gina PDV melhorada
   - ValidaÃ§Ã£o de estoque
   - Feedback visual

5. **Ela ComeÃ§a a Usar**
   - Ela usa no dia a dia
   - Feedback constante
   - CorreÃ§Ãµes rÃ¡pidas

---

**Ãšltima atualizaÃ§Ã£o:** Janeiro 2025  
**Status:** âœ… MVP Focado nos 2 Problemas CrÃ­ticos

