# 12 - GLOSSÁRIO

## Termos Técnicos

**ACID (Atomicidade, Consistência, Isolamento, Durabilidade)**
- Garantias de transações de banco de dados
- Atomicidade: Venda é confirmada ou não (nada no meio)
- Consistência: Dados sempre em estado válido
- Isolamento: Duas transações não interferem
- Durabilidade: Uma vez confirmado, é permanente

**Cache**
- Cópia temporária de dados rápida de acessar
- Reduz carga no banco principal
- Redis: cache em memória (muito rápido)
- TTL: Quanto tempo a cache fica válida

**FOR UPDATE (Lock Pessimista)**
- Bloqueia linha do banco enquanto transação roda
- Impede race condition (múltiplas vendas simultâneas)
- Garante que primeira transação termina antes da segunda começar

**JWT (JSON Web Token)**
- Token de autenticação seguro
- Contém dados do usuário (criptografado)
- Enviado em cada requisição (cookie HttpOnly)

**ORM (Object-Relational Mapping)**
- Ferramenta que mapeia banco de dados → objetos JavaScript
- Exemplo: Prisma, Knex
- Reduz necessidade de escrever SQL puro

**RLS (Row Level Security)**
- Segurança no banco de dados (não depende de código)
- Cada usuário só vê dados que tem permissão
- Implementado no Supabase/PostgreSQL

**Race Condition**
- Dois processos acessam mesmo recurso simultaneamente
- Exemplo: Duas vendas do último produto
- Solução: Lock ou fila (Para UCM: FOR UPDATE)

**Transação**
- Sequência de operações que tudo ou nada
- Se falhar em qualquer etapa: ROLLBACK (desfaz tudo)
- Garante consistência de dados

---

## Termos de Negócio

**ARR (Annual Recurring Revenue)**
- Receita total esperada em 12 meses
- Fórmula: MRR × 12
- Exemplo: 50 clientes × R$ 299/mês × 12 = R$ 179.400/ano

**CAC (Customer Acquisition Cost)**
- Quanto custa adquirir 1 novo cliente
- Fórmula: Gastos em marketing / Clientes novos
- Saudável: CAC < 20% do LTV

**Churn**
- Percentual de clientes que saem por mês
- Exemplo: 100 clientes - 5 que saem = 5% churn
- Para SaaS: < 5% é bom

**LTV (Lifetime Value)**
- Quanto cliente gasta em média até sair
- Fórmula: (Receita mensal / Churn mensal) × 12
- Exemplo: (R$ 299 / 5%) × 12 = R$ 716.400 (muito otimista)

**MRR (Monthly Recurring Revenue)**
- Receita esperada todo mês
- Fórmula: (Número de clientes) × (Preço médio)
- Exemplo: 50 clientes × R$ 299 = R$ 14.950

**NPS (Net Promoter Score)**
- Pergunta: "De 0-10, quanto recomenda?"
- Score: (% promotores 9-10) - (% detratores 0-6)
- Bom: > 50, Ótimo: > 70

**Payback Period**
- Quanto tempo para recuperar custo de aquisição
- Fórmula: CAC / Receita mensal por cliente
- Exemplo: R$ 200 CAC / R$ 299 mensal = 0.67 meses (20 dias)

---

## Termos de Produto

**Bot IA**
- Sistema automático que conversa com clientes
- Entende intenção: "Quero 3 brigadeiros"
- Processa pedido sem humano intervir

**E-commerce**
- Loja online (website)
- Cliente entra, busca, compra, paga

**Overselling**
- Vender mais do que tem em estoque
- Exemplo: Vender 10 brigadeiros tendo apenas 5
- Problema principal que UCM resolve

**PDV (Ponto de Venda)**
- Sistema usado no balcão para registrar vendas
- Vendedor busca produto, define quantidade, vende
- Funciona em tablet ou computador

**Webhook**
- Notificação automática de evento externo
- Exemplo: Stripe envia webhook quando pagamento é confirmado
- UCM backend processa webhook e confirma pedido

---

## Termos de Banco de Dados

**Constraint (Restrição)**
- Regra que banco enforça
- Exemplo: NOT NULL (campo não pode ser vazio)
- Exemplo: UNIQUE (não pode repetir)

**Foreign Key**
- Chave que referencia outra tabela
- Exemplo: order.customer_id aponta para customer.id
- Garante integridade referencial

**Índice**
- Estrutura de busca rápida
- Sem índice: banco procura cada linha (lento)
- Com índice: banco encontra direto (rápido)

**Política (Policy)**
- Regra de RLS
- Define quem pode ver qual dado
- Executada no banco (não depende de código)

**Primary Key**
- Chave única que identifica linha
- Exemplo: id UUID
- Sempre única, nunca vazia, nunca muda

**Tabela**
- Estrutura de dados (como planilha)
- Linhas: registros
- Colunas: campos

**Trigger**
- Ação automática quando evento acontece
- Exemplo: Quando atualizar estoque, registrar em audit_log
- Executado pelo banco (não código)

---

## Acrônimos Comuns

| Sigla | Significado | Contexto |
|-------|------------|---------|
| API | Application Programming Interface | Comunicação entre serviços |
| CRUD | Create, Read, Update, Delete | Operações básicas |
| CSS | Cascading Style Sheets | Estilos (design) |
| DB | Database | Banco de dados |
| DNS | Domain Name System | Converter URL → IP |
| DX | Developer Experience | Facilidade de programar |
| HTML | HyperText Markup Language | Estrutura de página |
| HTTP | HyperText Transfer Protocol | Protocolo web |
| HTTPS | HTTP Secure | HTTP com criptografia |
| IDE | Integrated Development Environment | Editor de código (VSCode) |
| JSON | JavaScript Object Notation | Formato de dados |
| JWT | JSON Web Token | Autenticação |
| MVP | Minimum Viable Product | Produto mínimo funcional |
| PCI | Payment Card Industry | Compliance de cartão |
| QA | Quality Assurance | Testes |
| REST | Representational State Transfer | Estilo de API |
| RLS | Row Level Security | Segurança no banco |
| SaaS | Software as a Service | Software na nuvem |
| SQL | Structured Query Language | Linguagem de banco |
| SLA | Service Level Agreement | Promessa de uptime |
| SLO | Service Level Objective | Objetivo de uptime |
| SSG | Static Site Generation | Gerar HTML estático |
| SSR | Server-Side Rendering | Renderizar no servidor |
| SSL | Secure Sockets Layer | Criptografia (HTTPS) |
| TTL | Time To Live | Quanto tempo dados vivem em cache |
| UX | User Experience | Experiência do usuário |
| UUID | Universally Unique Identifier | ID único (alternativa a números) |
