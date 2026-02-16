> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# ðŸš€ MVP para MÃ£e - Plano de ImplementaÃ§Ã£o TÃ©cnico

> **Foco:** Desenvolver MVP mÃ­nimo que resolve o problema REAL dela. NÃ£o tentar fazer tudo de uma vez.

---

## ðŸ“‹ Features MVP MÃ­nimo (4-6 semanas)

### Prioridade 1: ZERO OVERSELLING â­â­â­

**Features:**
1. **PDV Web (Tablet/Celular)**
   - Busca produto
   - Adiciona ao carrinho
   - Finaliza venda
   - Abate estoque automaticamente

2. **GestÃ£o de Estoque**
   - Lista produtos
   - Estoque atualizado em tempo real
   - Alerta quando estoque baixo

3. **Dashboard BÃ¡sico**
   - Vendas do dia
   - Vendas da semana
   - Produtos mais vendidos

**O que NÃƒO fazer ainda:**
- âŒ Bot WhatsApp (depois)
- âŒ E-commerce completo (depois)
- âŒ RelatÃ³rios complexos (depois)

---

## ðŸ—ï¸ Estrutura TÃ©cnica MVP

### Backend (NestJS)

**MÃ³dulos essenciais:**
1. **Auth** (jÃ¡ existe)
   - Login simples
   - JWT token

2. **Products** (jÃ¡ existe)
   - CRUD produtos
   - Estoque

3. **Orders** (jÃ¡ existe)
   - Criar pedido
   - Abater estoque (ACID)

**MÃ³dulos NÃƒO fazer ainda:**
- âŒ WhatsApp (depois)
- âŒ Encryption (depois)
- âŒ UsageLog (depois)

### Frontend (Next.js)

**PÃ¡ginas essenciais:**
1. **PDV** (`/pdv`)
   - Busca produto
   - Carrinho
   - Finalizar venda

2. **Dashboard** (`/admin`)
   - Vendas do dia
   - Estoque
   - Produtos

3. **Login** (`/login`)
   - Login simples

**PÃ¡ginas NÃƒO fazer ainda:**
- âŒ E-commerce (depois)
- âŒ RelatÃ³rios complexos (depois)

### Database

**Tabelas essenciais:**
- âœ… `usuarios` (jÃ¡ existe)
- âœ… `produtos` (jÃ¡ existe)
- âœ… `pedidos` (jÃ¡ existe)
- âœ… `itens_pedido` (jÃ¡ existe)
- âœ… `movimentacao_estoque` (jÃ¡ existe)

**Tabelas NÃƒO fazer ainda:**
- âŒ `whatsapp_conversations` (depois)
- âŒ `usage_logs` (depois)
- âŒ `idempotency_keys` (depois)

---

## ðŸ“… Timeline MVP (4-6 semanas)

### Semana 1: Setup + Produtos

**Objetivos:**
- [ ] Docker configurado (PostgreSQL + Redis)
- [ ] Backend rodando
- [ ] Frontend rodando
- [ ] Cadastrar produtos da mÃ£e
- [ ] Cadastrar estoque inicial

**EntregÃ¡veis:**
- Sistema rodando localmente
- Produtos cadastrados
- Login funcionando

---

### Semana 2: PDV BÃ¡sico

**Objetivos:**
- [ ] PÃ¡gina PDV (`/pdv`)
- [ ] Busca de produtos
- [ ] Carrinho funcional
- [ ] Finalizar venda
- [ ] Abater estoque (ACID)

**EntregÃ¡veis:**
- Ela consegue fazer venda pelo PDV
- Estoque Ã© abatido automaticamente

---

### Semana 3: Dashboard BÃ¡sico

**Objetivos:**
- [ ] PÃ¡gina Dashboard (`/admin`)
- [ ] Vendas do dia
- [ ] Vendas da semana
- [ ] Produtos mais vendidos
- [ ] Lista de produtos com estoque

**EntregÃ¡veis:**
- Ela vÃª vendas em tempo real
- Ela vÃª estoque atualizado

---

### Semana 4: Testes + Ajustes

**Objetivos:**
- [ ] Ela usa no dia a dia
- [ ] Feedback real
- [ ] Corrigir bugs encontrados
- [ ] Melhorar UX baseado em feedback

**EntregÃ¡veis:**
- Sistema funcionando no dia a dia dela
- Bugs crÃ­ticos corrigidos
- UX melhorada

---

### Semanas 5-6: Polimento

**Objetivos:**
- [ ] Melhorias de UX
- [ ] Features pequenas que ela pedir
- [ ] Performance
- [ ] ValidaÃ§Ã£o final

**EntregÃ¡veis:**
- Sistema pronto para uso diÃ¡rio
- Ela satisfeita
- ZERO overselling validado

---

## ðŸŽ¯ Checklist TÃ©cnico Semana 1

### Setup Inicial:

- [ ] Docker configurado
  ```bash
  docker-compose up -d postgres redis
  ```

- [ ] Backend `.env` configurado
  ```env
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ucm
  REDIS_URL=redis://localhost:6379
  JWT_SECRET=seu-secret-super-seguro
  ```

- [ ] Migration executada
  ```bash
  docker exec -i ucm-postgres psql -U postgres -d ucm < scripts/migrations/001-initial-schema.sql
  ```

- [ ] Backend rodando
  ```bash
  cd backend
  npm install
  npm run start:dev
  ```

- [ ] Frontend `.env.local` configurado
  ```env
  NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
  ```

- [ ] Frontend rodando
  ```bash
  cd frontend
  npm install
  npm run dev
  ```

### Cadastro de Dados:

- [ ] Listar produtos do site dela
- [ ] Criar usuÃ¡rio (mÃ£e)
- [ ] Criar tenant
- [ ] Cadastrar produtos (API ou direto no banco)
- [ ] Cadastrar estoque inicial

---

## ðŸŽ¯ Checklist TÃ©cnico Semana 2

### PDV BÃ¡sico:

- [ ] PÃ¡gina `/pdv` criada
- [ ] Busca de produtos funcionando
- [ ] Lista de produtos com estoque
- [ ] Carrinho funcional (adicionar/remover)
- [ ] Total do carrinho
- [ ] Finalizar venda
- [ ] Abater estoque (ACID transaction)
- [ ] Feedback visual (sucesso/erro)

**Teste:**
- Ela consegue fazer uma venda completa?
- Estoque foi abatido?

---

## ðŸŽ¯ Checklist TÃ©cnico Semana 3

### Dashboard BÃ¡sico:

- [ ] PÃ¡gina `/admin` criada
- [ ] Vendas do dia (query simples)
- [ ] Vendas da semana (query simples)
- [ ] Produtos mais vendidos (top 5)
- [ ] Lista de produtos com estoque
- [ ] Alerta de estoque baixo

**Teste:**
- Ela vÃª vendas em tempo real?
- Ela vÃª estoque atualizado?

---

## ðŸŽ¯ Checklist TÃ©cnico Semana 4

### Testes + Ajustes:

- [ ] Ela usa no dia a dia
- [ ] Coletar feedback
- [ ] Lista de bugs encontrados
- [ ] Priorizar correÃ§Ãµes
- [ ] Corrigir bugs crÃ­ticos
- [ ] Melhorar UX (baseado em feedback)

**ValidaÃ§Ã£o:**
- ZERO overselling em 7 dias?
- Ela gosta? ("Funciona bem?")
- Ela usaria sempre?

---

## ðŸ’¡ Dicas Importantes

### 1. **Foco em Funcionalidade, NÃ£o PerfeiÃ§Ã£o**

- âŒ NÃ£o fazer design perfeito
- âœ… Funcional primeiro
- âœ… Depois melhora visual

### 2. **Testar com Dados Reais**

- âŒ NÃ£o usar dados de teste genÃ©ricos
- âœ… Usar produtos REAIS dela
- âœ… Usar preÃ§os REAIS
- âœ… Testar com vendas REAIS

### 3. **IteraÃ§Ã£o RÃ¡pida**

- âŒ NÃ£o esperar "ficar perfeito" para mostrar
- âœ… Mostrar cedo (mesmo incompleto)
- âœ… Feedback rÃ¡pido
- âœ… Ajustar rapidamente

### 4. **UX Simples**

- âŒ NÃ£o complicar
- âœ… MÃ¡ximo 3 cliques para qualquer aÃ§Ã£o
- âœ… Visual limpo
- âœ… Feedback claro (sucesso/erro)

---

## ðŸ› Problemas Comuns (E Como Resolver)

### Problema: Ela nÃ£o usa

**Causa:** Muito complicado ou nÃ£o resolve problema
**SoluÃ§Ã£o:**
- Simplificar UX
- Focar no problema REAL dela
- Pedir feedback honesto

### Problema: Bugs constantes

**Causa:** Desenvolvimento rÃ¡pido = bugs
**SoluÃ§Ã£o:**
- Priorizar bugs crÃ­ticos (overselling)
- Iterar rÃ¡pido (corrigir e testar)
- Ter paciÃªncia (ela tambÃ©m)

### Problema: Feature que ela nÃ£o usa

**Causa:** VocÃª achou que ela queria
**SoluÃ§Ã£o:**
- Perguntar antes de fazer
- Focar no que ELA pede
- Remover features nÃ£o usadas

---

## âœ… CritÃ©rios de Sucesso MVP

### ValidaÃ§Ã£o TÃ©cnica:

- âœ… ZERO overselling em 30 dias
- âœ… Sistema estÃ¡vel (sem crashes)
- âœ… Performance OK (< 2s para carregar)

### ValidaÃ§Ã£o de Uso:

- âœ… Ela usa TODO dia
- âœ… Ela faz vendas pelo sistema
- âœ… Ela nÃ£o volta para sistema antigo

### ValidaÃ§Ã£o de SatisfaÃ§Ã£o:

- âœ… Ela gosta ("Funciona bem!")
- âœ… Ela recomendaria ("Sim, usaria sempre")
- âœ… Ela quer continuar usando

---

## ðŸš€ PrÃ³ximos Passos ApÃ³s MVP

### Se MVP Funcionar:

1. **Bot WhatsApp** (Semanas 7-12)
   - Automatizar vendas WhatsApp
   - Processar pedidos
   - Gerar QR Code Pix

2. **Melhorias** (Baseado em feedback)
   - RelatÃ³rios melhores
   - Features extras que ela pedir

3. **Vender para Outros** (Quando estÃ¡vel)
   - Usar caso dela como prova social
   - Onboarding para novos clientes

### Se MVP NÃ£o Funcionar:

1. **Entender por quÃª**
   - Feedback honesto dela
   - O que nÃ£o funcionou?
   - O que precisa melhorar?

2. **Ajustar**
   - Corrigir problemas
   - Re-validar

3. **NÃ£o desistir**
   - IteraÃ§Ã£o rÃ¡pida
   - Feedback constante
   - Melhorar baseado em uso real

---

**Ãšltima atualizaÃ§Ã£o:** Janeiro 2025  
**Status:** âœ… Plano TÃ©cnico MVP para Cliente Beta Real

