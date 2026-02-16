> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# 12 - GLOSSÃRIO

## Termos TÃ©cnicos

**ACID (Atomicidade, ConsistÃªncia, Isolamento, Durabilidade)**
- Garantias de transaÃ§Ãµes de banco de dados
- Atomicidade: Venda Ã© confirmada ou nÃ£o (nada no meio)
- ConsistÃªncia: Dados sempre em estado vÃ¡lido
- Isolamento: Duas transaÃ§Ãµes nÃ£o interferem
- Durabilidade: Uma vez confirmado, Ã© permanente

**Cache**
- CÃ³pia temporÃ¡ria de dados rÃ¡pida de acessar
- Reduz carga no banco principal
- Redis: cache em memÃ³ria (muito rÃ¡pido)
- TTL: Quanto tempo a cache fica vÃ¡lida

**FOR UPDATE (Lock Pessimista)**
- Bloqueia linha do banco enquanto transaÃ§Ã£o roda
- Impede race condition (mÃºltiplas vendas simultÃ¢neas)
- Garante que primeira transaÃ§Ã£o termina antes da segunda comeÃ§ar

**JWT (JSON Web Token)**
- Token de autenticaÃ§Ã£o seguro
- ContÃ©m dados do usuÃ¡rio (criptografado)
- Enviado em cada requisiÃ§Ã£o (cookie HttpOnly)

**ORM (Object-Relational Mapping)**
- Ferramenta que mapeia banco de dados â†’ objetos JavaScript
- Exemplo: Prisma, Knex
- Reduz necessidade de escrever SQL puro

**RLS (Row Level Security)**
- SeguranÃ§a no banco de dados (nÃ£o depende de cÃ³digo)
- Cada usuÃ¡rio sÃ³ vÃª dados que tem permissÃ£o
- Implementado no Supabase/PostgreSQL

**Race Condition**
- Dois processos acessam mesmo recurso simultaneamente
- Exemplo: Duas vendas do Ãºltimo produto
- SoluÃ§Ã£o: Lock ou fila (Para UCM: FOR UPDATE)

**TransaÃ§Ã£o**
- SequÃªncia de operaÃ§Ãµes que tudo ou nada
- Se falhar em qualquer etapa: ROLLBACK (desfaz tudo)
- Garante consistÃªncia de dados

---

## Termos de NegÃ³cio

**ARR (Annual Recurring Revenue)**
- Receita total esperada em 12 meses
- FÃ³rmula: MRR Ã— 12
- Exemplo: 50 clientes Ã— R$ 299/mÃªs Ã— 12 = R$ 179.400/ano

**CAC (Customer Acquisition Cost)**
- Quanto custa adquirir 1 novo cliente
- FÃ³rmula: Gastos em marketing / Clientes novos
- SaudÃ¡vel: CAC < 20% do LTV

**Churn**
- Percentual de clientes que saem por mÃªs
- Exemplo: 100 clientes - 5 que saem = 5% churn
- Para SaaS: < 5% Ã© bom

**LTV (Lifetime Value)**
- Quanto cliente gasta em mÃ©dia atÃ© sair
- FÃ³rmula: (Receita mensal / Churn mensal) Ã— 12
- Exemplo: (R$ 299 / 5%) Ã— 12 = R$ 716.400 (muito otimista)

**MRR (Monthly Recurring Revenue)**
- Receita esperada todo mÃªs
- FÃ³rmula: (NÃºmero de clientes) Ã— (PreÃ§o mÃ©dio)
- Exemplo: 50 clientes Ã— R$ 299 = R$ 14.950

**NPS (Net Promoter Score)**
- Pergunta: "De 0-10, quanto recomenda?"
- Score: (% promotores 9-10) - (% detratores 0-6)
- Bom: > 50, Ã“timo: > 70

**Payback Period**
- Quanto tempo para recuperar custo de aquisiÃ§Ã£o
- FÃ³rmula: CAC / Receita mensal por cliente
- Exemplo: R$ 200 CAC / R$ 299 mensal = 0.67 meses (20 dias)

---

## Termos de Produto

**Bot IA**
- Sistema automÃ¡tico que conversa com clientes
- Entende intenÃ§Ã£o: "Quero 3 brigadeiros"
- Processa pedido sem humano intervir

**E-commerce**
- Loja online (website)
- Cliente entra, busca, compra, paga

**Overselling**
- Vender mais do que tem em estoque
- Exemplo: Vender 10 brigadeiros tendo apenas 5
- Problema principal que UCM resolve

**PDV (Ponto de Venda)**
- Sistema usado no balcÃ£o para registrar vendas
- Vendedor busca produto, define quantidade, vende
- Funciona em tablet ou computador

**Webhook**
- NotificaÃ§Ã£o automÃ¡tica de evento externo
- Exemplo: Stripe envia webhook quando pagamento Ã© confirmado
- UCM backend processa webhook e confirma pedido

---

## Termos de Banco de Dados

**Constraint (RestriÃ§Ã£o)**
- Regra que banco enforÃ§a
- Exemplo: NOT NULL (campo nÃ£o pode ser vazio)
- Exemplo: UNIQUE (nÃ£o pode repetir)

**Foreign Key**
- Chave que referencia outra tabela
- Exemplo: order.customer_id aponta para customer.id
- Garante integridade referencial

**Ãndice**
- Estrutura de busca rÃ¡pida
- Sem Ã­ndice: banco procura cada linha (lento)
- Com Ã­ndice: banco encontra direto (rÃ¡pido)

**PolÃ­tica (Policy)**
- Regra de RLS
- Define quem pode ver qual dado
- Executada no banco (nÃ£o depende de cÃ³digo)

**Primary Key**
- Chave Ãºnica que identifica linha
- Exemplo: id UUID
- Sempre Ãºnica, nunca vazia, nunca muda

**Tabela**
- Estrutura de dados (como planilha)
- Linhas: registros
- Colunas: campos

**Trigger**
- AÃ§Ã£o automÃ¡tica quando evento acontece
- Exemplo: Quando atualizar estoque, registrar em audit_log
- Executado pelo banco (nÃ£o cÃ³digo)

---

## AcrÃ´nimos Comuns

| Sigla | Significado | Contexto |
|-------|------------|---------|
| API | Application Programming Interface | ComunicaÃ§Ã£o entre serviÃ§os |
| CRUD | Create, Read, Update, Delete | OperaÃ§Ãµes bÃ¡sicas |
| CSS | Cascading Style Sheets | Estilos (design) |
| DB | Database | Banco de dados |
| DNS | Domain Name System | Converter URL â†’ IP |
| DX | Developer Experience | Facilidade de programar |
| HTML | HyperText Markup Language | Estrutura de pÃ¡gina |
| HTTP | HyperText Transfer Protocol | Protocolo web |
| HTTPS | HTTP Secure | HTTP com criptografia |
| IDE | Integrated Development Environment | Editor de cÃ³digo (VSCode) |
| JSON | JavaScript Object Notation | Formato de dados |
| JWT | JSON Web Token | AutenticaÃ§Ã£o |
| MVP | Minimum Viable Product | Produto mÃ­nimo funcional |
| PCI | Payment Card Industry | Compliance de cartÃ£o |
| QA | Quality Assurance | Testes |
| REST | Representational State Transfer | Estilo de API |
| RLS | Row Level Security | SeguranÃ§a no banco |
| SaaS | Software as a Service | Software na nuvem |
| SQL | Structured Query Language | Linguagem de banco |
| SLA | Service Level Agreement | Promessa de uptime |
| SLO | Service Level Objective | Objetivo de uptime |
| SSG | Static Site Generation | Gerar HTML estÃ¡tico |
| SSR | Server-Side Rendering | Renderizar no servidor |
| SSL | Secure Sockets Layer | Criptografia (HTTPS) |
| TTL | Time To Live | Quanto tempo dados vivem em cache |
| UX | User Experience | ExperiÃªncia do usuÃ¡rio |
| UUID | Universally Unique Identifier | ID Ãºnico (alternativa a nÃºmeros) |

