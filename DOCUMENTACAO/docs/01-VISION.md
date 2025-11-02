# 01 - VISÃO E OBJETIVOS

## O Grande Problema

### Context
Pequenos negócios artesanais enfrentam um dilema:
- Querem vender online (e-commerce) para aumentar alcance
- Mas continuam vendendo offline (loja física, WhatsApp)
- **Resultado:** Estoque fragmentado e sem sincronização

### O Gargalo Real
**Overselling** é o problema #1:
1. Cliente A compra 5 brigadeiros no WhatsApp
2. Ao mesmo tempo, Cliente B compra 10 brigadeiros no site
3. Total de estoque: 12 brigadeiros
4. **RESULTADO:** 3 brigadeiros não podem ser entregues

Sem sistema, o dono fica anotando tudo em papel/planilha, propenso a erros e muito trabalho manual.

### Impacto Financeiro
- Perda de vendas (cliente vai para concorrente)
- Perda de reputação (entrega atrasada ou incompleta)
- Custo operacional (tempo gasto anotando pedidos)
- Impossível escalar (não consegue vender mais)

---

## A Solução: "Um Cérebro, Três Interfaces"

### Princípio Arquitetural
**Uma fonte única de verdade para o estoque, acessível por múltiplos canais simultaneamente.**

\`\`\`
CÉREBRO (Backend)
    ↓
    Sincroniza em tempo real
    ↓
┌─────────────────────────────────────────┐
│ Interface 1: PDV (Loja Física)         │
│ Interface 2: E-commerce (Website)      │
│ Interface 3: WhatsApp Bot (Chat)       │
└─────────────────────────────────────────┘
    ↓
    Todas atualizam o MESMO estoque
\`\`\`

### Por Que Funciona

1. **Centralização** → Um banco de dados único
2. **Atualização Atômica** → Venda = Abate de Estoque (tudo ou nada)
3. **Tempo Real** → Todas as interfaces veem o estoque atualizado
4. **Auditoria** → Cada transação é registrada

---

## Objetivos Principais

### Objetivo Primário
Eliminar **overselling** garantindo que:
- Cada produto vendido tenha estoque disponível
- O estoque nunca fique inconsistente
- O pedido seja criado automaticamente quando a venda ocorre

### Objetivos Secundários

1. **Reduzir Carga Manual**
   - Dono não precisa mais anotar pedidos em planilha
   - Atendimento automatizado via WhatsApp Bot

2. **Aumentar Visibilidade**
   - Dono vê, em tempo real:
     - Quanto vendeu hoje/semana/mês
     - Por qual canal vendeu mais
     - Quais produtos são mais populares

3. **Escalar Vendas**
   - Sistema aguenta múltiplas lojas (SaaS)
   - Múltiplos vendedores por loja
   - Múltiplos canais simultâneos

4. **Integração Simples**
   - Fácil onboarding para cliente alfa
   - Sem necessidade de trocar seu ERP/sistema atual
   - Pode coexistir com outras soluções

---

## Caso de Teste: Cliente Alfa

### Empresa
**Loja de Chocolates Artesanais "ChocoláVelha"**

### Situação Atual
- Vendas: Loja Física (principal) + WhatsApp (crescente)
- Estoque: Gerenciado em caderneta + memória
- Problemas:
  - Atendimento via WhatsApp é lento (dono responde manualmente)
  - Já foi overselling algumas vezes (pedido cancelado)
  - Não sabe quanto vendeu em cada canal

### Objetivo com UCM
- Eliminar overselling
- Automatizar atendimento WhatsApp
- Começar a vender online (e-commerce)
- Ter relatórios de vendas por canal

### Métrica de Sucesso
- ✓ Zero overselling em 30 dias
- ✓ Tempo de atendimento WhatsApp < 5 min (vs 30 min atualmente)
- ✓ Aumento de 20% em vendas online
- ✓ Dono consegue gerar relatório de vendas em 5 cliques

---

## Princípios de Design

### 1. Simplicidade Acima de Tudo
- Não é um ERP completo
- Foco: Inventário + Pedidos + Vendas
- Tudo o mais (contabilidade, RH) fica para integração

### 2. Tempo Real vs Eventual Consistency
- **Estoque** deve ser sempre atualizado (transacional, ACID)
- **Relatórios** podem ter delay de alguns segundos (cache)

### 3. Mobile First
- PDV precisa funcionar em tablet (responsivo)
- E-commerce otimizado para mobile
- WhatsApp Bot é inerentemente mobile

### 4. Sem Lock-in
- Dados sempre exportáveis
- APIs abertas para integração
- Pode descentralizar quando desejar

---

## Roadmap em Alto Nível

### Phase 1: MVP (Meses 1-3)
- PDV Web funcional
- E-commerce básico
- Cliente Alfa validando

### Phase 2: Automação (Meses 4-6)
- WhatsApp Bot integrado
- Admin Dashboard completo
- Relatórios detalhados

### Phase 3: Marketplace (Meses 7-12)
- Integração com Marketplaces (Shopee, Mercado Livre)
- Sincronização automática de estoque
- Suporte multi-canal

### Phase 4: Enterprise (Meses 13+)
- Multi-loja (franquias)
- API pública
- Integrações de terceiros

---

## Sucesso é Quando

1. ✓ Cliente Alfa consegue vender sem overselling
2. ✓ Dono consegue escalar vendas sem aumentar trabalho manual
3. ✓ Sistema funciona 24/7 sem interventção
4. ✓ Novos clientes conseguem onboarding em < 1 dia
