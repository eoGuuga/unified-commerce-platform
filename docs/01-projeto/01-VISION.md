# 01 - VISÃO E OBJETIVOS

## O Problema Central: Overselling

Pequenos negócios artesanais (confeitarias, chocolates, artesanato) enfrentam um dilema:

- Vendem em **múltiplos canais**: Loja física, e-commerce, WhatsApp
- Mas têm **estoque fragmentado**: Planilha, caderneta, memória
- **Resultado:** Vendem o que não têm = perda de reputação e vendas

### Cenário Real

\`\`\`
MANHÃ (Loja Física):
14:00 - Cliente A compra 5 brigadeiros
14:15 - Dono anota em caderneta

MESMA HORA (WhatsApp):
14:05 - Cliente B envia: "Quero 10 brigadeiros"
14:08 - Dono responde: "Tá bom, deixa para amanhã"

TARDE (E-commerce):
14:30 - Cliente C compra 8 brigadeiros no site (website de teste)

REALIDADE:
Total de estoque: 12 brigadeiros
Total vendido: 23 brigadeiros
Resultado: 11 brigadeiros não podem ser entregues ❌
\`\`\`

### Impacto Financeiro

- **Perda de vendas:** Cliente quer 10 mas só tem 3, cancela tudo
- **Perda de reputação:** Entrega atrasada/incompleta
- **Custo operacional:** Tempo desperdiçado anotando pedidos
- **Impossível escalar:** Não consegue vender mais

---

## A Solução: Um Cérebro, Três Interfaces

### Princípio Arquitetural

\`\`\`
┌─────────────────────────────┐
│   BACKEND CENTRALIZADO      │
│  (Banco de dados único)     │
│  Estoque sincronizado em    │
│  tempo real                 │
└──────────────┬──────────────┘
       │
    ├──────────────────────────────────┤
    │                                  │
    ▼                                  ▼                    ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PDV Web     │  │ E-commerce   │  │ WhatsApp Bot │
│ (Tablet)     │  │ (Website)    │  │ (Chat IA)    │
└──────────────┘  └──────────────┘  └──────────────┘

Todas as 3 interfaces:
  ✓ Veem estoque atualizado em tempo real
  ✓ Atualizam estoque atomicamente
  ✓ Jamais vendem mais do que têm
\`\`\`

### Por Que Funciona

1. **Centralização** → Um banco de dados único = fonte de verdade
2. **Transações ACID** → Venda = Abate de Estoque (tudo ou nada)
3. **Tempo Real** → Todas as interfaces veem mudanças instantaneamente
4. **Auditoria** → Cada operação é registrada (quem, quando, quanto)

---

## Objetivos Primários

### Objetivo 1: Zero Overselling
Eliminar completamente a possibilidade de vender mais do que existe em estoque. Implementação:
- Transações SQL com locks pessimistas (FOR UPDATE)
- Validação em tempo real antes de cada venda
- Auditoria completa de movimentações

**Métrica de Sucesso:** 0 overselling em 30 dias de cliente alfa

### Objetivo 2: Reduzir Carga Manual
Eliminar trabalho manual de gestão de pedidos:
- Bot automático responde pedidos WhatsApp
- Atendimento humano apenas se bot não entender
- Notificações automáticas para cliente

**Métrica de Sucesso:** 80% mensagens WhatsApp respondidas por bot

### Objetivo 3: Aumentar Visibilidade
Dar dados reais ao dono para tomar decisões:
- Relatórios de vendas por canal
- Produtos mais populares
- Horários de pico
- Trend analysis

**Métrica de Sucesso:** Dono consegue gerar qualquer relatório em 2 cliques

### Objetivo 4: Escalar Vendas
Permitir crescimento sem aumentar complexidade:
- Múltiplas lojas (franquias)
- Múltiplos vendedores simultâneos
- Múltiplos canais sincronizados

**Métrica de Sucesso:** Sistema aguenta 1000 transações/dia

---

## Caso de Teste: Cliente Alfa (ChocoláVelha)

**Empresa:** Loja de Chocolates Artesanais "ChocoláVelha"

**Situação Atual:**
- Vendas: Loja Física (70%) + WhatsApp (30%)
- Estoque: Caderneta + memória (muito erro)
- Atendimento: Lento (30 min para responder WhatsApp)

**Problemas:**
- Overselling 2x/mês (cancelamento de pedidos)
- Não sabe quanto vendeu em cada canal
- Atendente gasta 4h/dia em WhatsApp

**Objetivo com UCM:**
- ✓ Zero overselling
- ✓ Atendimento automático (< 5 min vs 30 min)
- ✓ Relatórios diários de vendas

**Métrica de Sucesso (30 dias):**
- 0 overselling
- Tempo de atendimento WhatsApp reduzido em 80%
- NPS cliente > 7

---

## Visão de Longo Prazo (18-24 meses)

### Fase 1: MVP (Mês 1-3)
Validar problema com cliente alfa, PDV funcional.

### Fase 2: Automação (Mês 4-6)
Bot WhatsApp, dashboard admin, relatórios.

### Fase 3: Multi-Canal (Mês 7-12)
Integração com Shopee, Mercado Livre, iFood.

### Fase 4: Enterprise (Mês 13+)
API pública, múltiplas lojas, parcerias.

---

## Diferencial Competitivo

| Aspecto | Shopify | VTEX | Tiny | UCM |
|--------|---------|------|------|-----|
| **Foco** | E-commerce | Enterprise | E-commerce | PDV + Multi-canal |
| **Preço** | R$ 99+ | R$ 300+ | R$ 30-80 | R$ 99-299 |
| **PDV** | Não | Sim | Não | Sim |
| **Bot IA** | Não | Não | Não | **Sim** |
| **Curva Aprendizado** | Alta | Muito Alta | Média | **Baixa** |
| **Artesão Target** | Não | Não | Sim (parcial) | **Sim (100%)** |

**Oportunidade:** Mercado azul - ninguém foca no segmento artesão + PDV + multi-canal.

---

## Princípios de Design

### 1. Simplicidade Acima de Tudo
Não é um ERP completo. Foco: Inventário → Pedidos → Vendas. Tudo mais fica para integração.

### 2. Tempo Real vs Eventual Consistency
- **Estoque:** Sempre atualizado (transacional, ACID)
- **Relatórios:** Podem ter delay de 1 segundo (cache)

### 3. Mobile First
- PDV funciona em tablet (responsivo)
- E-commerce otimizado para mobile
- WhatsApp Bot é inerentemente mobile

### 4. Sem Lock-In
- Dados sempre exportáveis
- APIs abertas
- Pode descentralizar quando desejar

---

## Prognóstico de Sucesso

Será bem-sucedido quando:

1. ✓ Cliente alfa consegue vender sem overselling (30 dias)
2. ✓ Dono consegue escalar vendas sem aumentar trabalho manual
3. ✓ Sistema roda 24/7 sem intervenção humana
4. ✓ Novos clientes conseguem onboarding em < 1 dia
5. ✓ NPS cliente > 50 (ótimo)
