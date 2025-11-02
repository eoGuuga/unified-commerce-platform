# 02 - PERSONAS DE USUÁRIOS

## Persona 1: Dona da Loja (Decisora)

**Nome:** Fernanda, 42 anos  
**Negócio:** Confeitaria "Doces da Fernanda" (3 anos)  
**Estágio:** Crescendo (quer aumentar vendas)

### Perfil
- Passou de 1 para 3 vendedoras (necessita controle)
- Vende 60% loja física, 40% WhatsApp
- Planeja abrir e-commerce em 6 meses
- Problema: Já teve 2 episódios de overselling

### Objetivos com UCM
1. Eliminar overselling (problema #1)
2. Ter visibilidade de vendas em tempo real
3. Permitir que vendedoras trabalhem sem sua supervisão
4. Começar vender online sem risco

### Pain Points
- Recebe 40 mensagens/dia WhatsApp (stressante)
- Não sabe qual produto é mais lucrativo
- Quando vendedora se atrasa, fica desorganizado

### Valor Esperado
- Redução de stress (não ficar de olho em tudo)
- Aumento de vendas (pode atender mais clientes)
- Dados para tomar decisões

### Tipo de Usuário
- Tech: Básico (usa WhatsApp, Instagram, mas não expert)
- Disposição para aprender: Alta (quer crescer)
- Disposição a pagar: Alta (se resolver problema)

---

## Persona 2: Vendedora/PDV

**Nome:** Maria, 28 anos  
**Função:** Vendedora em loja (6 meses neste cargo)  
**Local:** Balcão de vendas

### Perfil
- Operacional (executa vendas, não toma decisões)
- Precisa ser rápida (não quer complicação)
- Não tem experiência com sistemas
- Quer fácil e intuitivo

### Objetivos com UCM
1. Registrar venda rápido (< 2 min)
2. Não cometer erros de estoque
3. Gerar comprovante legível
4. Modo offline (às vezes internet cai)

### Pain Points
- Às vezes esquece de anotar quantidade certa
- Cliente reclama de falta de troco (comprovante ajuda)
- Quando sistema cai, vira papel

### Valor Esperado
- Menos reclamações (comprovante legível)
- Mais confiança (estoque nunca erra)
- Velocidade (vender mais)

### Tipo de Usuário
- Tech: Muito básico (celular, isso é tudo)
- Disposição para aprender: Média (só o essencial)
- Disposição a pagar: Não aplicável

---

## Persona 3: Gerente de Loja

**Nome:** Paulo, 35 anos  
**Função:** Gerente (toma decisões operacionais)  
**Local:** Escritório/Tablet

### Perfil
- Intermediário entre donos e vendedores
- Responsável por relatórios e estoque
- Quer dados para justificar decisões
- Mais tech-savvy que Fernanda

### Objetivos com UCM
1. Gerar relatórios diários (sem sair do escritório)
2. Saber estoque em tempo real
3. Monitorar fila de produção
4. Avisos quando estoque baixo

### Pain Points
- Precisa ligar para Fernanda 5x/dia com dúvidas
- Demora 2h para fazer relatório (manual)
- Não sabe se tem estoque sem ir verificar

### Valor Esperado
- Autonomia (faz relatório sozinho)
- Velocidade (2h → 5 min)
- Precisão (dados automáticos)

### Tipo de Usuário
- Tech: Intermediário (usa Excel, tablets)
- Disposição para aprender: Alta
- Disposição a pagar: Indireta (Fernanda paga)

---

## Persona 4: Cliente Online

**Nome:** Lucas, 25 anos  
**Tipo:** E-commerce (cliente externo)  
**Local:** Casa (mobile)

### Perfil
- Acessa site do celular
- Quer comprar de forma rápida e segura
- Quer saber quando chega
- Não quer surpresa (venda depois sem estoque)

### Objetivos com UCM
1. Comprar brigadeiro online de forma fácil
2. Rastrear pedido em tempo real
3. Ter certeza que produto tem em estoque
4. Receber notificação quando pronto

### Pain Points
- Já comprou em site que depois falou "sem estoque"
- Demora espera (não sabe quanto tempo)
- Sem link de rastreamento, não sabe o quê fazer

### Valor Esperado
- Garantia de entrega (venda sólida)
- Velocidade de entrega (pronto em X min)
- Transparência (rastreio por link)

### Tipo de Usuário
- Tech: Avançado (acostumado com e-commerce)
- Disposição para aprender: N/A
- Disposição a pagar: Aplicável (paga produto)

---

## Persona 5: Cliente WhatsApp Bot

**Nome:** Carla, 32 anos  
**Tipo:** Atendimento via WhatsApp  
**Local:** Celular (sempre)

### Perfil
- Acessa tudo por WhatsApp (seu "app favorito")
- Quer conversação natural (não quer menu)
- Quer resposta rápida (< 1 min)
- Quer pagar de forma simples (Pix, não quer cartão)

### Objetivos com UCM
1. Perguntar se tem brigadeiro disponível
2. Fazer pedido rápido
3. Pagar via Pix
4. Saber quando fica pronto

### Pain Points
- Já enviou mensagem e esperou 30 min
- Quando proprietária não está online, ninguém responde
- Quer resposta rápida e segura

### Valor Esperado
- Atendimento 24/7 (bot responde sempre)
- Velocidade (< 3 seg)
- Naturalidade (conversa, não menu)

### Tipo de Usuário
- Tech: Básico (só WhatsApp)
- Disposição para aprender: Nenhuma (quer fácil)
- Disposição a pagar: Está pagando produto

---

## Matriz de Prioridades

### Impacto vs Esforço

| Persona | Impacto | Esforço | Prioridade |
|---------|---------|--------|-----------|
| Dona da Loja | Crítico | Médio | 1️⃣ |
| Vendedora | Alto | Baixo | 2️⃣ |
| Gerente | Alto | Médio | 3️⃣ |
| Cliente Online | Médio | Alto | 4️⃣ |
| Cliente WhatsApp | Médio | Alto | 5️⃣ |

**Ordem de implementação:**
1. **MVP:** Dona + Vendedora (PDV básico)
2. **Phase 2:** Gerente (Dashboard)
3. **Phase 2:** Cliente Online (E-commerce)
4. **Phase 2:** Cliente WhatsApp (Bot)

---

## Jornada de Sucesso (Happy Path)

### Dia 1: Onboarding (Dona)
\`\`\`
09:00 - Fernanda recebe email com link
09:30 - Faz login e cadastra 10 produtos
10:00 - Convida Maria (vendedora)
10:30 - Treina Maria (15 min)
✓ Pronto para vender
\`\`\`

### Semana 1: Validação (Dona)
\`\`\`
Seg-Sex:
- Maria usa PDV normalmente
- 0 erros de estoque ✓
- Fernanda vê relatório: "80 vendas, R$ 1.200"
✓ Confiante que sistema funciona
\`\`\`

### Mês 1: Expansão (Dona)
\`\`\`
- Fernanda integra e-commerce
- Bot WhatsApp começa
- Vê relatórios comparando canais
- Pensa: "Posso escalar!"
✓ Pronto para pagar
\`\`\`

---

## Métricas por Persona

### Dona da Loja
- **NPS Target:** > 70 (Net Promoter Score)
- **Retention:** > 90% (churn < 10%)
- **Expansion:** 50% upgrade para plano maior em 6 meses

### Vendedora
- **Tempo de venda:** < 2 min (vs 5 min manual)
- **Erro de estoque:** 0 (vs 2x/semana)
- **Satisfação:** Preferir sistema vs manual

### Gerente
- **Tempo relatório:** < 5 min (vs 2h)
- **Precisão:** 100% (vs 95% manual)
- **Adoção:** Usar 5+ features por semana

### Cliente Online
- **Conversão:** 50% carrinho → compra
- **Retorno:** 30% cliente volta em 30 dias
- **Referência:** 20% indicam amigos

### Cliente WhatsApp
- **Satisfação:** > 80% conseguem comprar pelo bot
- **Tempo:** Média 2 min conversa (vs 30 min espera)
- **Retenção:** 40% repetem compra
