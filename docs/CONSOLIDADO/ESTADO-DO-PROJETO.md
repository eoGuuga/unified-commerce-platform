# Estado do Projeto — GTSoftHub

> Documento-mapa. Conta a história da arquitetura de forma honesta: o que existe, o que
> está sendo desenhado, o que falta, e como o projeto é tocado. Escrito para ser lido por
> um revisor técnico, por mim mesmo daqui a duas semanas, e por quem quiser entender o
> raciocínio — não só o código.
>
> **Âncora factual (2026-07-10):** produção em `https://gtsofthub.com.br`, HEAD `98e1827`,
> site + `/api/v1/health` = 200. Um tenant real em produção (a doceria *Loucas por
> Brigadeiro*, da mãe do fundador — o primeiro cliente e design partner). VPS única (OVH),
> deploy manual via SSH. Solo dev.

---

## 1. O que é o GTSoftHub

O GTSoftHub é um **SaaS multi-tenant para o pequeno comerciante brasileiro** — a doceria, a
padaria, a loja de bairro que vende pelo WhatsApp e no balcão, não por um site de
e-commerce. O produto tem três partes que se vendem por plano: um **bot de WhatsApp que
vende de verdade** (recebe o pedido, monta o carrinho, cobra via PIX), um **PDV** para a
venda de balcão, e um **controle de estoque** que amarra os dois canais numa fonte de
verdade só. Cada cliente conecta o próprio número de WhatsApp e o próprio recebimento — o
isolamento entre lojistas é o coração do negócio.

Deliberadamente, **não** é uma vitrine de e-commerce: o cliente final compra pelo WhatsApp
ou presencialmente, nunca navegando um catálogo web. Essa foi uma decisão de produto
consciente (a vitrine `/loja` chegou a ser construída seguindo uma visão antiga e foi
removida) — e vale registrar porque define o que o projeto **não** tenta ser. O
diferencial pretendido é a integração: bot com IA de vendas + PDV + estoque +
**recebimento por-lojista** num pacote só, contra os concorrentes de "cardápio/pedido
online".

O estágio honesto é **pré-escala**: o núcleo está no ar e provado, com um cliente real
servindo de laboratório, e as peças que faltam para vender ao segundo cliente são em boa
parte de **mundo real** (CNPJ, número dedicado) — o código está adiante do que o mundo-real
já permite ligar.

---

## 2. O núcleo que já funciona

Esta seção descreve o que está **provado**, com o nível de maturidade real de cada peça —
sem arredondar "construído" para "pronto".

### Multi-tenancy por RLS — maduro, provado sob ataque
O isolamento entre lojistas não é `WHERE tenant_id = ?` espalhado pelo código (frágil, um
`WHERE` esquecido vaza tudo). É **Row-Level Security do Postgres**: um interceptor seta
`app.current_tenant_id` por request, e as políticas do banco filtram cada query no nível do
SGBD. Uma auditoria empírica adversarial (7 blocos, ataques reais contra o ambiente de
teste) tentou quebrar isso — leitura/escrita cross-tenant, IDOR, forja de webhook — e **tudo
foi bloqueado**. Multi-tenancy provado não só no código, mas sob ataque.

### Segurança e LGPD — maduro, HIGH fechado
Todos os riscos HIGH exploráveis estão **fechados em produção**:
- **Envelope encryption** (Fase 1) para os segredos sensíveis, com AES-256-GCM real em
  TypeScript (uma descoberta importante do caminho: o serviço de cripto legado dependia de
  uma função SQL que **nunca existiu no banco** — infra-fantasma; foi reescrito de verdade).
- **Auth hardening (Bloco A):** logout com revogação por-token provada no ar (denylist de
  `jti` no Redis), privilege-escalation no registro fechada, política de senha
  (mín. 8 + letra + número), bcrypt em custo 12, branding restrito a admin.
- **PII blindado nos logs (LGPD):** um helper de mascaramento (`maskPhone`/`maskEmail`/
  `maskIp`) aplicado antes de o bot ir para produção — o vazamento que ligaria junto com o
  bot foi estancado *primeiro*.
- **Webhooks fail-closed em prod** (rejeitam sem assinatura/secret válido — re-verificado na
  fonte em 2026-07-09), idempotência em pagamentos, e o fluxo de dinheiro à prova
  (preço e valor recalculados server-side, cupom re-validado, corrida de estoque segura).

A auditoria fechou com **zero 🔴 explorável**; restam apenas itens de *hardening* 🟡
(documentados, não bloqueantes).

### Motor de estoque — maduro, invariante provado
O estoque tinha um vazamento silencioso (baixava na criação do pedido e nunca restaurava em
cancelamento/PIX abandonado — um DoS de inventário grátis). Foi refeito como
**reserva → commit no PRONTO**, com um **ledger auditável** (`movimentacoes_estoque_historico`
como fonte da verdade, invariante `current_stock == soma(deltas)` provado em teste),
idempotência por índice único parcial + compare-and-set, e um sweeper de TTL que libera
reservas vencidas. O motor é **agnóstico de canal** — cada pedido carrega um `channel` e a
mesma lógica de reserva/commit vale para todos. Hoje os canais vivos de venda são **PDV e
WhatsApp**; o enum de canais (`CanalVenda`) ainda herda um valor `ecommerce` do desenho
antigo, mas **não há vitrine ligada a ele** (a `/loja` foi removida) — é uma abstração que
permanece no modelo de dados, não um canal de venda ativo.

### Bot de WhatsApp — provado ponta-a-ponta, ainda não servindo cliente
O bot está **mergeado e deployado em prod** e foi **provado ponta a ponta** (2026-07-07):
webhook verificado pela Meta, round-trip real nos logs (mensagem do celular → recebida →
HMAC → processada com telefone mascarado → resposta aceita pela Meta). A arquitetura é
**rules-first** (um funil de camadas determinísticas de palavra-chave), com a IA
(OpenRouter/`gpt-4o-mini`) na cauda, respeitando o invariante *"a IA conversa, o banco
decide"* — preço, estoque e status vêm sempre do banco. O único gargalo é **de mundo real**:
o número de *teste* da Meta recebe mensagens mas não entrega o outbound; falta um número
real dedicado. O bot está pronto; o mundo-real é que ainda não o deixou atender.

### Recebimento por-lojista (PIX) — provado ao vivo em sandbox
A peça mais sensível (dinheiro de terceiros). Sobre a Asaas, construídas as fases de
fundação + subconta escopada + PIX, e a **"Rota 1" foi provada AO VIVO** (2026-07-07):
round-trip de cobrança PIX real com uma subconta **real**, roteamento reverso do webhook
para a subconta certa, e o "Risco A" confirmado ao vivo (a chave escopada de cobrança
**não** consegue sacar — 403). Está numa branch, **não mergeada** — é pré-requisito da
produção (Fase 4), que depende de CNPJ. Provado que funciona; falta o mundo-real para ligar.

### Operação de balcão e admin — em produção
PDV / venda de balcão (com fast-pass que liquida no balcão de forma atômica), o Admin de
Produtos & Estoque, gestão de pedidos com timeline de acompanhamento, e um polimento de 22
bugs — tudo **mergeado e em produção**. Um cupom de venda não-fiscal está pronto e verde
numa branch, aguardando teste na bobina térmica real.

### Operação e observabilidade — resolvido, e testado por incidentes
Depois de uma faxina de infra dedicada, produção roda de um espelho limpo do `main`, com
backup automático (restore provado byte-a-byte), e **quatro camadas de observabilidade** no
ar (watchdog com auto-recovery e alerta, netdata → Telegram, alerta de erro de aplicação →
Telegram, backup). Segredos críticos custodiados off-server.

A operação **já foi testada por incidentes reais de produção e os absorveu com método**, sem
drama. Uma "landmine" de boot — um `nginx` do host disputando a porta 80 com o container do
nginx real — chegou a derrubar produção num ciclo de testes de infra; foi diagnosticada,
recuperada, e **neutralizada de vez** (o serviço do host foi `masked`, com prova de que não
sobe mais). Depois, um deploy de validação expôs um 502 transitório — quando o backend é
recriado com um IP novo, o nginx fica com o *upstream* obsoleto; o **watchdog recuperou
sozinho**, e o incidente virou um item mapeado (o *nginx-refresh*, hoje pré-requisito do
próximo deploy). Cada susto virou **conhecimento registrado, não um remendo** — e o
`deploy.sh` passou a blindar o watchdog sozinho a partir desses aprendizados.

---

## 3. A arquitetura da IA-vendedora — o esboço 5/5

Esta é a peça que mostra o raciocínio de engenharia. O objetivo: transformar o bot
rules-first numa **IA-vendedora** — que conduz a conversa e chama ferramentas para os fatos
— sem nunca deixar a IA inventar preço, estoque ou promessa. O território foi mapeado em
quatro investigações densas (o cérebro do bot, o custo por conversa, um inventário de 10
seções, e o veredito da ilha de código dormente), e a arquitetura foi **decidida peça por
peça, com cabeça fresca** — cinco decisões, cada uma com um porquê.

**Decisão 1 — Roteamento: Modelo B (tool-calling).** A IA vira a condutora da conversa e
chama ferramentas reais (busca catálogo, checa estoque, adiciona ao carrinho) num loop,
usando *tool-calling nativo* do provider. O porquê que fechou a decisão: as ferramentas
**já existem e são provadas** — hoje presas aos handlers de palavra-chave; o trabalho é
ligá-las ao LLM, não construí-las. É **reforma**, não reescrita. E há uma coincidência que
derruba o custo: um bug latente (oito ações da IA que hoje devolvem resposta vazia) e o
Modelo B são *o mesmo trabalho* — construir B conserta o bug.

**Decisão 2 — A trava do §5 + riqueza do produto.** O princípio central: **a IA origina
conversa (tom, empatia, condução); o código origina fato (preço, estoque, atributo,
total).** Impedir a IA de originar fato é mais forte do que deixá-la gerar e verificar
depois. Quatro regras: repassar o fato exato da ferramenta (nunca originar número); não
extrapolar além do dado; admitir e escalar quando não sabe (jamais chutar); e manter a zona
crítica (criar pedido, confirmar total, pagamento) **100% determinística** — a IA só dispara
a ferramenta, o código gera a confirmação com os números reais. A riqueza do produto entra
como **atributos estruturados** no campo `metadata` (JSONB, já existe) — fato binário que a
IA lê, não prosa que ela interpreta.

**Decisão 3 — Controle de fluxo: a IA vende, o FSM de ferro fecha o pedido.** A IA é dona da
descoberta e da venda; a **máquina de estados de checkout é dona da coleta do pedido**. A IA
*entrega* o cliente ao FSM (via uma ferramenta `start_checkout`) e *retoma* quando ele
conclui ou aborta — mas **nunca dirige a coleta. O momento do dinheiro não passa pela IA.**
Funciona quase de graça porque o FSM atual já é o trilho de ferro: auto-contido, dirigido
por contexto persistido, com a garantia de **gravar no Postgres antes de responder** a cada
passo — um pedido não se perde no meio.

**Decisão 4 — Canibalizar a ilha de código dormente.** Existe uma "ilha" de ~6.300 linhas
(nove serviços de *sales-intelligence*) que foi construída e nunca ligada. O veredito
honesto: é uma **especificação validada, não código para religar** — um motor de
palavra-chave com bugs congelados e uma violação de multi-tenancy embutida. Então: **colher
as ideias e o conteúdo** (a copy de venda por vertical, o *tiering* por percentil, as
taxonomias — atemporais) e **reescrever o resto limpo** no mundo tool-calling. Nem religar
cego, nem apagar o aprendizado.

**Decisão 5 — Instrumentação: o bot aprende com o mundo real.** Capturar as **perguntas
certas**, não tudo (log que ninguém lê é morto). Três sinais de ouro, todos eventos naturais
do sistema: *"admiti e escalei"* (registra qual atributo o cliente pediu e o banco não
tinha → alimenta a lista de atributos a cadastrar), *falha/handoff*, e *"a trava salvou"*.
Tudo com o **fluxo da conversa desacoplado da identidade** (anonimização automática,
coerente com a blindagem de PII já feita), e um resumo periódico que **chega** ao dono. É a
máquina que resolve, com dado real, os pendentes das Decisões 2 e 4 — em vez de chutar.

O que fica em aberto do esboço é de **preenchimento, não de estrutura**: a lista concreta de
atributos e as verticais a priorizar esperam as conversas reais dos clientes. A arquitetura
está fechada; falta o dado do mundo.

---

## 4. O que falta — a dívida, sem esconder

**Pendentes de mundo-real (dependem do dono, fora do código).** São o gargalo central: o
código está adiante do que o mundo-real permite ligar.
- **CNPJ** (com o contador) — destrava a produção de pagamentos (a conta-plataforma Asaas o
  exige).
- **Número de WhatsApp dedicado** — destrava a entrega do bot (o número de teste da Meta
  não entrega outbound).
- **Impressora / bobina térmica** — destrava o merge do cupom de venda (testar na bobina
  real).
- **Conta Asaas de produção + KYC** (atrás do CNPJ) e a conversa com o **contador**
  (enquadramento fiscal, MEI vs. empresa) antecedem o pagamento com lojistas reais.

**Pilha de deploy — pronto-mas-não-deployado.** Produção está em `98e1827`; à frente há **12
mudanças** não-deployadas (3 fixes de serviço no `main` + 9 numa branch de vitórias baratas,
todas com testes). Elas esperam um **dia de deploy dedicado** que exige, primeiro, fechar um
item de recuperação robusta do deploy (o *nginx-refresh* 🟠) — senão todo deploy que muda a
imagem do backend bate num 502 transitório e num health-check falso-negativo. Esse terreno
(deploy/watchdog/nginx) provou ser campo minado, e a regra é tratá-lo em **ciclo dedicado,
cabeça fresca**, nunca empilhado no fim de uma sessão longa.

**Pré-requisitos da IA-vendedora (antes de mover a IA para o centro).**
- 🔴 A **resposta-vazia** do executor de ações (oito ações que hoje ghosteiam o cliente) —
  raro hoje, crítico se a IA for para o centro; e o Modelo B já o conserta.
- 🟠 O **router que voa cego** (não recebe catálogo nem histórico hoje).
- 🟡 A **trava dura anti-alucinação de preço** no caminho conversacional (hoje é só uma
  regra soft de prompt).
- 🟡 Um **FSM morto** (um branch inalcançável que responde "pedido confirmado" sem criar o
  pedido — latente, mas seria um bug sério se religado sem cuidado).

**Poda de código morto.** Um inventário consolidado e classificado por risco de remoção
(🟢 seguro / 🟡 a confirmar / 🔴 pode esconder valor) está registrado — pendente de remoção
**item-a-item**, cabeça fresca. Achado tranquilizador: os domínios de dinheiro e auth estão
quase limpos (de 112 símbolos varridos, só 4 métodos mortos isolados); o peso morto é quase
todo no WhatsApp, e a maior parte dele **já tem destino decidido** (canibalizar / reprojetar),
não é lixo para deletar cego. Um item merece atenção de segurança: um guard que *bypassa a
autenticação fora de produção*, dormente mas solto no repositório.

**Dívida de documentação.** O guia operacional (`CLAUDE.md`) está desatualizado em pontos
sobre o bot (afirma que um arquivo legado de 14 mil linhas existe — foi deletado; diz que o
orquestrador tem 1.584 linhas — tem 2.601). Registrado, a corrigir com cabeça fresca.

**Backlog de segurança não-crítico.** A migração de JWT de `localStorage` para cookie
`httpOnly` (delicada — mexe no login inteiro, exige CSRF; já mitigada por CSP + revogação +
TTL), tornar um guard global fail-closed, e a rotação de chaves via KMS (parte da Fase 4).

---

## 5. Como o projeto é construído — o método

Os princípios que aparecem, na prática, em cada frente do projeto:

**"A IA conversa, o banco decide."** É um invariante, não um slogan. Preço, estoque e status
sempre vêm do banco; a IA nunca inventa dado de negócio. É o que torna seguro botar um LLM
na frente de dinheiro de terceiros — e a Decisão 2 da IA-vendedora o transforma de regra de
prompt em trava de código.

**Multi-tenancy por RLS, não por convenção.** O isolamento vive no banco, não na lembrança
do desenvolvedor de escrever o `WHERE` certo. Falha de isolamento = fim do negócio, então a
proteção é estrutural e foi provada sob ataque.

**TDD de verdade — RED → GREEN.** Cada fix começa por um teste que falha pelo motivo certo,
e só então o código que o faz passar. Não é cerimônia: é o que garante que o teste está
medindo o comportamento, não a implementação.

**"Verifica na fonte" — a régua que mais rende.** Antes de aplicar qualquer instrução ou
confiar em qualquer registro, o passo um é confirmar na fonte (código, servidor, banco).
Essa régua repetidamente pegou premissas erradas antes de virarem bug: itens do roadmap que
estavam obsoletos (dívidas-fantasma já resolvidas), uma configuração que seria placebo (uma
variável de ambiente que o app nem lê), um DTO "para validar" que era código morto, e —
o caso mais forte — uma instrução para exigir `quantidade ≥ 1` numa rota de carrinho que,
*na fonte*, tratava `quantidade = 0` como "remover o item": aplicar a instrução cega teria
quebrado a remoção. A régua é: a fonte manda, não a instrução nem a memória.

**Deploy cuidadoso, fail-closed por padrão.** Deploy é manual, health-gated, com watchdog e
recuperação automática. Webhooks e autenticação são fail-closed (na dúvida, rejeita). O
terreno de deploy provou ser campo minado e é tratado com ciclos dedicados — nunca mudança
sensível empilhada sobre mudança sensível.

**Incremento entregável, branch por tarefa, confirmação antes de ações irreversíveis.**
Nada de big-bang. Deploy em produção, migração destrutiva, ou qualquer coisa difícil de
reverter passa por confirmação explícita. E arquitetura delicada não se desenha no fim de
uma maratona — a peça central (a IA-vendedora) foi adiada de propósito para ser decidida
descansada, justamente porque *uma arquitetura ruim não apita como um deploy ruim; ela
parece boa no papel e trai três meses depois.*

**Honestidade de resultado.** Teste que falhou é dito com a saída; passo pulado é dito;
"funciona" só depois de verificar. O que fica em aberto é registrado como aberto — inclusive
neste documento.

---

## Apêndice — estado factual de referência

| Item | Estado (2026-07-10) |
|---|---|
| Produção | `gtsofthub.com.br`, HEAD `98e1827`, site + health 200 |
| Tenants reais | 1 (doceria *Loucas por Brigadeiro*) |
| Stack backend | NestJS 11 · TypeORM 0.3 · Postgres 15 (RLS) · Redis 7 |
| Stack frontend | Next.js 16 · React 19 · Tailwind 4 |
| Infra | VPS única (OVH), deploy manual via SSH, `/opt/gtsofthub` |
| Segurança HIGH | fechada em prod; auditoria adversarial com zero 🔴 explorável |
| Bot WhatsApp | provado ponta-a-ponta (2026-07-07); falta número real dedicado |
| PIX por-lojista | provado ao vivo em sandbox (2026-07-07); falta CNPJ + prod (Fase 4) |
| IA-vendedora | esboço de arquitetura 5/5 completo; implementação não iniciada |
| Deploy pendente | 12 mudanças prontas, aguardando dia de deploy (gated no nginx-refresh) |

> **Nota de honestidade sobre este documento:** ele consolida o roadmap e as memórias do
> projeto em julho de 2026. Onde uma fonte estava desatualizada, usei o estado verificado
> mais recente. Números pontuais que não pude reconfirmar (ex.: contagem exata do catálogo)
> foram omitidos em vez de chutados. É um retrato de um momento — verifique contra o estado
> vivo antes de tratar qualquer linha como verdade corrente.
