# 🎯 MVP Focado - Problemas Reais da Mãe

> **Foco:** Resolver os 2 problemas CRÍTICOS dela: Controle de Estoque + Automação WhatsApp

---

## 📋 Problemas Identificados

### Problema #1: Controle de Estoque ⭐⭐⭐ CRÍTICO
- Overselling frequente
- Estoque não sincronizado
- Prejuízo com vendas que não pode entregar

### Problema #2: WhatsApp Tomando Muito Tempo ⭐⭐⭐ CRÍTICO
- Muitas mensagens de clientes
- Especialmente encomendas de bolos personalizados
- Tempo desperdiçado respondendo perguntas repetitivas

---

## 🎯 MVP Mínimo Focado (4-6 semanas)

### PRIORIDADE 1: Controle de Estoque (Semanas 1-3)

**Features:**
1. **PDV Web (Tablet/Celular)**
   - Busca produto
   - Adiciona ao carrinho
   - Finaliza venda
   - Abate estoque automaticamente (ACID)

2. **Gestão de Estoque em Tempo Real**
   - Lista produtos com estoque atualizado
   - Alerta quando estoque baixo
   - Histórico de movimentações

3. **Dashboard Básico**
   - Estoque atual (todos produtos)
   - Produtos com estoque baixo
   - Vendas do dia (validação)

**Validação:**
- ✅ ZERO overselling em 30 dias
- ✅ Ela usa TODO dia
- ✅ Estoque sempre correto

---

### PRIORIDADE 2: Automação WhatsApp (Semanas 4-6)

**Features:**
1. **Bot WhatsApp Inteligente**
   - Responde perguntas comuns automaticamente
   - Mostra cardápio/menu
   - Informa preços
   - Processa encomendas simples

2. **Fluxo de Encomendas Personalizadas**
   - Coleta informações (tipo de bolo, tamanho, data)
   - Envia para aprovação dela
   - Ela aprova/rejeita
   - Bot confirma com cliente

3. **Automação de Pedidos Simples**
   - Cliente: "Quero 10 brigadeiros"
   - Bot: processa automaticamente
   - Bot: gera QR Code Pix
   - Bot: confirma quando pago

**Validação:**
- ✅ 80% mensagens respondidas por bot
- ✅ Ela economiza tempo
- ✅ Encomendas coletadas automaticamente

---

## 🏗️ Arquitetura MVP Focado

### Backend (NestJS)

**Módulos Essenciais:**

1. **Auth** (já existe)
   - Login simples
   - JWT token

2. **Products** (já existe - precisa melhorar)
   - CRUD produtos
   - Estoque em tempo real
   - Alertas de estoque baixo

3. **Orders** (já existe - precisa garantir ACID)
   - Criar pedido
   - Abater estoque com FOR UPDATE (crítico)
   - Validação de estoque antes de criar

4. **WhatsApp** (implementar)
   - Mock provider primeiro (desenvolvimento)
   - Bot inteligente (processamento de mensagens)
   - Fluxo de encomendas

**Módulos NÃO fazer ainda:**
- ❌ E-commerce completo
- ❌ Relatórios complexos
- ❌ Integrações externas

---

### Frontend (Next.js)

**Páginas Essenciais:**

1. **PDV** (`/pdv`)
   - Busca produto (rápida)
   - Carrinho com estoque em tempo real
   - Finalizar venda
   - Feedback visual (sucesso/erro de estoque)

2. **Estoque** (`/admin/estoque`)
   - Lista de produtos
   - Estoque atual (atualizado em tempo real)
   - Produtos com estoque baixo (destaque)
   - Histórico de movimentações

3. **Dashboard** (`/admin`)
   - Vendas do dia
   - Estoque resumo (total produtos, baixos)
   - Ações rápidas

4. **WhatsApp Encomendas** (`/admin/encomendas`)
   - Lista de encomendas pendentes
   - Aprovar/rejeitar
   - Detalhes da encomenda

**Páginas NÃO fazer ainda:**
- ❌ E-commerce (depois)
- ❌ Relatórios complexos (depois)

---

## 📅 Timeline Detalhado

### Semana 1: Setup + Estoque Básico

**Objetivos:**
- [ ] Docker configurado
- [ ] Backend rodando
- [ ] Frontend rodando
- [ ] Cadastrar produtos dela
- [ ] Estoque inicial cadastrado
- [ ] Página de estoque básica

**Entregáveis:**
- Sistema rodando
- Ela vê estoque atual
- Produtos cadastrados

---

### Semana 2: PDV com Controle de Estoque

**Objetivos:**
- [ ] Página PDV funcional
- [ ] Busca de produtos rápida
- [ ] Carrinho mostra estoque em tempo real
- [ ] Validação antes de adicionar (tem estoque?)
- [ ] Finalizar venda com FOR UPDATE (ACID)
- [ ] Abate estoque automaticamente

**Entregáveis:**
- Ela consegue fazer venda pelo PDV
- Estoque é abatido automaticamente
- ZERO overselling garantido (tecnica ACID)

---

### Semana 3: Dashboard + Validação

**Objetivos:**
- [ ] Dashboard com estoque resumo
- [ ] Alertas de estoque baixo
- [ ] Ela usa no dia a dia
- [ ] Feedback real
- [ ] Corrigir bugs críticos

**Validação:**
- ✅ ZERO overselling em 7 dias?
- ✅ Ela usa TODO dia?
- ✅ Ela confia no sistema?

---

### Semana 4: Bot WhatsApp Básico

**Objetivos:**
- [ ] Bot responde mensagens (mock primeiro)
- [ ] Mostra cardápio
- [ ] Informa preços
- [ ] Processa pedidos simples

**Entregáveis:**
- Bot funcional (mesmo que mock)
- Ela testa interação
- Feedback sobre respostas

---

### Semana 5: Fluxo de Encomendas

**Objetivos:**
- [ ] Bot coleta informações de encomenda
- [ ] Envia para aprovação dela
- [ ] Ela aprova/rejeita
- [ ] Bot confirma com cliente

**Entregáveis:**
- Encomendas coletadas automaticamente
- Ela aprova/rejeita rapidamente
- Cliente recebe confirmação

---

### Semana 6: Polimento + Integração Real

**Objetivos:**
- [ ] Integrar WhatsApp real (Evolution API ou mock melhorado)
- [ ] Melhorias de UX
- [ ] Performance
- [ ] Validação final

**Entregáveis:**
- Sistema completo funcionando
- Ela usa no dia a dia
- Tempo economizado validado

---

## 🎯 Checklist Técnico Detalhado

### Semana 1: Setup + Estoque

**Backend:**
- [ ] Validar que `OrdersService` usa FOR UPDATE
- [ ] Adicionar endpoint `/api/products/stock` (estoque atualizado)
- [ ] Adicionar endpoint `/api/products/low-stock` (produtos baixos)
- [ ] Teste: criar pedido abate estoque (ACID)

**Frontend:**
- [ ] Página `/admin/estoque`
- [ ] Lista produtos com estoque
- [ ] Destaque produtos com estoque baixo
- [ ] Atualização em tempo real (SWR polling)

**Teste:**
- Ela vê estoque atual?
- Produtos cadastrados corretamente?

---

### Semana 2: PDV com Estoque

**Frontend:**
- [ ] Página `/pdv` melhorada
- [ ] Busca rápida de produtos
- [ ] Mostra estoque ao lado do produto
- [ ] Desabilita produto se estoque = 0
- [ ] Validação no carrinho (tem estoque suficiente?)
- [ ] Finalizar venda com feedback visual

**Backend:**
- [ ] Validar que pedido usa transação ACID
- [ ] Validação de estoque antes de criar pedido
- [ ] Retornar erro se não tem estoque
- [ ] Abate estoque com FOR UPDATE

**Teste:**
- Ela consegue fazer venda?
- Estoque é abatido?
- Não consegue vender mais do que tem?

---

### Semana 3: Dashboard

**Frontend:**
- [ ] Dashboard `/admin` melhorado
- [ ] Cards: Vendas hoje, Estoque total, Produtos baixos
- [ ] Gráfico simples (vendas últimos 7 dias)
- [ ] Alertas visuais (estoque baixo)

**Teste:**
- Ela vê informações úteis?
- Alertas aparecem quando estoque baixo?

---

### Semana 4: Bot WhatsApp Básico

**Backend:**
- [ ] Implementar `WhatsappBotService` básico
- [ ] Processar mensagens comuns:
  - "Cardápio" → mostra produtos
  - "Preço de [produto]" → mostra preço
  - "Quero [quantidade] [produto]" → cria pedido
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
- [ ] Fluxo de coleta de informações:
  1. Cliente: "Quero encomendar um bolo"
  2. Bot: "Que tipo de bolo?"
  3. Cliente: "[tipo]"
  4. Bot: "Que tamanho? (pequeno/médio/grande)"
  5. Cliente: "[tamanho]"
  6. Bot: "Para quando?"
  7. Cliente: "[data]"
  8. Bot: "Encomenda coletada! Aguarde aprovação."
- [ ] Criar entidade `Encomenda` (tipo, tamanho, data, status)
- [ ] Endpoint para aprovar/rejeitar encomendas

**Frontend:**
- [ ] Página `/admin/encomendas`
- [ ] Lista de encomendas pendentes
- [ ] Detalhes da encomenda
- [ ] Botões: Aprovar / Rejeitar
- [ ] Ao aprovar, bot envia confirmação ao cliente

**Teste:**
- Bot coleta informações corretamente?
- Ela aprova/rejeita facilmente?
- Cliente recebe confirmação?

---

### Semana 6: Polimento

**Backend:**
- [ ] Integrar WhatsApp real (Evolution API ou mock melhorado)
- [ ] Melhorar processamento de mensagens (Ollama quando necessário)
- [ ] Performance (cache, queries otimizadas)

**Frontend:**
- [ ] Melhorias de UX (feedback visual, loading states)
- [ ] Mobile responsivo (PDV no celular funciona bem?)
- [ ] Performance (carregamento rápido)

**Validação:**
- ✅ Ela usa TODO dia?
- ✅ ZERO overselling?
- ✅ Tempo economizado no WhatsApp?

---

## 💡 Features Específicas para Encomendas

### Fluxo de Encomenda Personalizada:

```
Cliente: "Quero encomendar um bolo"
Bot: "Ótimo! Que tipo de bolo você quer?"
Bot: "Exemplos: casamento, aniversário, festa, etc"

Cliente: "Aniversário"
Bot: "Perfeito! Que tamanho? (pequeno/médio/grande)"

Cliente: "Médio"
Bot: "Para quantas pessoas serve?"

Cliente: "30 pessoas"
Bot: "Para quando você precisa? (dia/mês)"

Cliente: "15/02"
Bot: "Algum sabor específico ou tema?"

Cliente: "Chocolate com morangos"
Bot: "Entendido! Encomenda: Bolo de Aniversário, Médio (30 pessoas), Chocolate com Morangos, para 15/02"
Bot: "O valor é R$ [preço]. Está correto? (sim/não)"

Cliente: "Sim"
Bot: "Ótimo! Sua encomenda foi enviada para aprovação. Aguarde confirmação!"

[Bot cria encomenda pendente]
[Ela vê na página /admin/encomendas]
[Ela aprova/rejeita]
[Bot envia confirmação ao cliente]
```

---

## ✅ Critérios de Sucesso MVP

### Validação Técnica:

- ✅ **ZERO overselling** em 30 dias
- ✅ **Estoque sempre correto** (sincronizado)
- ✅ **Sistema estável** (sem crashes)

### Validação de Uso:

- ✅ **Ela usa TODO dia** (não só testa)
- ✅ **Ela confia no sistema** (não verifica manualmente)
- ✅ **PDV é rápido** (< 2 min por venda)

### Validação WhatsApp:

- ✅ **80% mensagens** respondidas por bot
- ✅ **Encomendas coletadas** automaticamente
- ✅ **Tempo economizado** (ela confirma: "Economizou tempo?")

### Validação de Satisfação:

- ✅ **Ela gosta** ("Funciona bem!")
- ✅ **Ela recomendaria** ("Sim, usaria sempre")
- ✅ **Ela quer continuar** usando

---

## 🚀 Próximos Passos Imediatos

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
   - Garantir que não pode vender mais do que tem

### Próxima Semana:

4. **Implementar PDV com Estoque**
   - Página PDV melhorada
   - Validação de estoque
   - Feedback visual

5. **Ela Começa a Usar**
   - Ela usa no dia a dia
   - Feedback constante
   - Correções rápidas

---

**Última atualização:** Janeiro 2025  
**Status:** ✅ MVP Focado nos 2 Problemas Críticos
