# PIX-no-bot — pagamento PIX provado localmente — Design

**Data:** 2026-06-29
**Base factual:** o diagnóstico read-only do fluxo PIX (handleCheckout, processPixPayment, webhook fail-closed, mock impagável, "falha em silêncio"). Esta frente refina os 4 passos daquele diagnóstico num spec executável.

---

## Contexto travado (NÃO reabrir)

1. **Forma de pagamento: PIX exclusivamente.** Cartão e boleto fora de escopo (o código deles continua existindo, mas não é tocado nem testado aqui).
2. **Ordem inegociável:** terminar e **provar o PIX localmente com token de teste (`TEST-`)** antes de **qualquer** deploy. Validar em produção = criar cobrança real com `APP_USR` = **proibido**.
3. **Definição de pronto desta frente:** o fluxo PIX está provado ponta-a-ponta na máquina local (**gerar → pagar no sandbox → webhook confirmar → pedido liberar**), sem nunca tocar o token de produção.
4. **Decisões de produto travadas (AskUserQuestion + review):**
   - Cumprimento: **entrega E retirada** (o bot pergunta e ramifica).
   - Retirada: **cliente agenda um horário**, validado contra horário de funcionamento.
   - PIX expira: **o bot oferece gerar um novo PIX**.
   - Endereço de entrega: **estruturado**, coletado com **o mínimo de perguntas + confirmação final** (D2).
5. **Teste de aceitação central:** `approved → CONFIRMADO + notifica`, provando que confirmar o pagamento **não baixa estoque** (o `commitSale`/VENDA é no **PRONTO**, não no pagamento).

---

## Problema

O bot já cria Pedido real e tem webhook fail-closed que confirma/cancela. Mas o caminho PIX tem buracos que impedem uma venda paga de verdade:

- **Risco financeiro nº1:** o provider usa **qualquer** `MERCADOPAGO_ACCESS_TOKEN` sem checar ambiente — um `.env` local com `APP_USR` cria PIX **real** num teste.
- O pedido nasce **sem identidade nem endereço** (`customer_name: undefined`) — um pagamento confirmado não tem como ser cumprido.
- O bot **não envia a imagem do QR**, **engole erros em silêncio** ("aguarde o link" sem link), e **mostra o total cheio** enquanto cobra 5% menos.
- O único caminho do webhook **sem teste** é justamente o que importa: `approved → CONFIRMADO + notifica` (só os de cancelamento/recusa têm cobertura).

---

## Ordem das tasks (final, decidida no review)

**S1 → S2a → S3 → S4 → S2b.**

- **S1 é a Task 1, isolada, fechada/testada/mergeada ANTES de qualquer trabalho de pagamento.** Não é primeira por organização; é primeira **por proteção**: a partir do momento em que se mexe em pagamento, roda-se o fluxo na máquina — e o guarda anti-`APP_USR` precisa já estar de pé.
- A **prova do PIX (S4) é o marco que ordena o deploy**. Por isso tudo que ela precisa vem antes dela: o guarda (S1), os dados mínimos de um pedido de **entrega** (S2a) e o bot sem buracos (S3).
- A **retirada (S2b) vem depois da S4**, como fatia própria — é a peça **menos acoplada a provar PIX** e não deve bloqueá-la. Inclui o que só ela usa (coluna de agendamento, horário de funcionamento).

---

## Seção 1 (Task 1) — Guarda anti-token-de-produção (o cinto de segurança, primeiro)

**Estado atual:** `MercadoPagoProvider` ([providers/mercadopago.provider.ts:84-99](../../backend/src/modules/payments/providers/mercadopago.provider.ts)) lê `MERCADOPAGO_ACCESS_TOKEN` e inicializa o client sem olhar o ambiente. Nada impede `APP_USR` em dev.

**Decisão travada:** em `NODE_ENV !== 'production'`, se o token começar com `APP_USR`, o sistema **falha alto**. Dois pontos (defesa em profundidade — **ambos**):
- **No boot (construtor do provider):** se `!isProd && token.startsWith('APP_USR')` → **lançar** erro claro que impede o backend de subir. Mensagem: `[SEGURANCA] Token de PRODUÇÃO (APP_USR) detectado fora de produção. Use um token TEST- localmente. Backend bloqueado.` Falhar no boot é o mais cedo possível e impossível de ignorar.
- **No momento de criar pagamento (`createPixPayment`):** reverificar antes do `payment.create()` — backstop caso o provider seja instanciado de outra forma (testes, DI futura). Mesmo critério, mesmo erro.

> Por que ambos: o boot pega 99% dos casos (o caminho normal de subida); o check no create é o cinto-e-suspensório que garante que **nenhum** `payment.create()` real saia com token de prod em dev, mesmo que alguém mude a inicialização.

**Esta task é isolada e mergeada antes de S2a/S3/S4.** Nenhuma outra seção começa antes do guarda estar verde e na base.

**Arquivos tocados:**
- Modificar: `backend/src/modules/payments/providers/mercadopago.provider.ts` (construtor + início de `createPixPayment`).
- Test: `backend/src/modules/payments/providers/mercadopago.provider.spec.ts` (criar — hoje não existe spec unitário do provider).

**Tamanho:** Pequeno.

**Critério de teste (prova de pronto):**
- Unit: `NODE_ENV='development'` + token `'APP_USR-123'` → construir o provider **lança** com a mensagem de segurança. (E `createPixPayment` lança mesmo se o construtor for contornado.)
- Unit: `NODE_ENV='development'` + token `'TEST-123'` → **não** lança (caminho feliz).
- Unit: `NODE_ENV='production'` + token `'APP_USR-123'` → **não** lança (prod é o lugar legítimo do APP_USR).
- Unit: token vazio → comportamento atual preservado (`isConfigured()===false`, sem lançar).

---

## Seção 2a — Identidade + endereço de ENTREGA no pedido (pré-condição pra um pagamento significar algo)

**Estado atual:** `handleCheckout` cria o pedido com `customer_name: undefined` e sem endereço ([whatsapp.service.ts:799](../../backend/src/modules/whatsapp/whatsapp.service.ts)). A FSM de coleta existe (`handleCollectionStage`, estados `collecting_name → collecting_phone → collecting_address → confirming_order` em [:922-960](../../backend/src/modules/whatsapp/whatsapp.service.ts)) mas **não é acionada no checkout** e **não grava no Pedido** (só em `conversation.context`). O schema do `Pedido` **já tem** `customer_name`, `customer_phone`, `customer_email`, `customer_notes`, `delivery_address` (jsonb tipado: street, number, complement?, neighborhood, city, state, zipcode) e `delivery_type` ([Pedido.entity.ts:71-113](../../backend/src/database/entities/Pedido.entity.ts)). **Sem migration nesta fatia** (a retirada, que precisa de coluna nova, é S2b).

**Escopo desta fatia: SÓ entrega.** O bot pergunta **"Entrega ou retirada?"** e ramifica por `delivery_type`. Nesta fatia, implementa-se **o branch de entrega**; o branch de retirada responde por ora "no momento só fazemos entrega" (placeholder honesto) e é completado na S2b.

**Decisão travada — o fluxo de entrega:**
1. No checkout, **antes** de criar o pedido e o PIX, o bot pergunta "Entrega ou retirada?".
2. **Entrega** → coleta `nome → telefone (confirma o do WhatsApp) → endereço`.
3. **Endereço com mínimo de atrito (D2):** o bot pede o endereço com **poucas perguntas** (ex.: CEP + número, ou o endereço numa mensagem só), **monta o endereço estruturado** (`delivery_address`) e **mostra de volta pro cliente confirmar** antes de prosseguir. Se o cliente corrige, recoleta. Pouco atrito + proteção contra erro de digitação.
4. Grava `customer_name`, `customer_phone`, `delivery_type='delivery'`, `delivery_address` (estruturado).
5. **Só depois** de coletar e o cliente **confirmar** o endereço, o pedido é criado (`PENDENTE_PAGAMENTO`) **com os dados** e o PIX é gerado (S3/S4).
6. **Critério inviolável:** **nenhum pedido de entrega chega a `CONFIRMADO` sem `delivery_address` completo** (street, number, neighborhood, city, state, zipcode preenchidos).

**Reescrita de estado:** a FSM passa a ser orientada pelo `delivery_type`. O estado vivo continua em `conversation.context`; ao confirmar (`confirming_order`), o pedido é criado com os campos preenchidos. Acrescenta um passo de **confirmação do endereço montado** antes de fechar.

**Arquivos tocados:**
- Modificar: `backend/src/modules/whatsapp/whatsapp.service.ts` (`handleCheckout` aciona a coleta; `handleCollectionStage` ganha o branch de entrega, a coleta de endereço com confirmação, e a gravação no Pedido).
- Modificar: `backend/src/modules/orders/orders.service.ts` e o `CreateOrderDto` (aceitar `customer_name`, `delivery_address`, `delivery_type` na criação).
- Test: `backend/src/modules/whatsapp/*.spec.ts` (FSM de entrega + confirmação de endereço) e integração que cria pedido de entrega com os dados.

**Tamanho:** Médio.

**Critério de teste (prova de pronto):**
- Entrega: simular a conversa → o bot **mostra o endereço montado**; ao confirmar, o Pedido criado tem `customer_name`, `customer_phone`, `delivery_type='delivery'` e `delivery_address` com todos os campos obrigatórios.
- Correção: cliente rejeita o endereço montado → bot recoleta, não cria o pedido até confirmar.
- Guarda do `CONFIRMADO`: pedido de entrega sem `delivery_address` completo → **rejeitado** (não chega a `CONFIRMADO`).

---

## Seção 3 — Fluxo do bot sem buracos (comportamental, testável com mock, risco zero)

**Estado atual:** ver diagnóstico — `handleCheckout` só manda texto (descarta `qr_code_base64`), o `catch` responde "aguarde o link" sem link, e a mensagem mostra `order.total_amount` cheio enquanto o PIX cobra 95%.

**Decisão travada — três correções:**

**(a) Enviar a imagem do QR.** Após gerar o PIX, o bot envia **a imagem** (`qr_code_base64`) via `whatsappSender.sendImage(tenantId, phone, image, caption)` **além** da copia-e-cola em texto (pra quem copia e cola). Hoje o `qr_code_base64` é descartado.

**(b) Substituir o "falha em silêncio" por um caminho honesto — desacoplado do Admin (D4).** Se o PIX falhar ao ser criado (provider não configurado, MP fora do ar, guarda da S1, etc.):
- O bot **diz a verdade** ao cliente: houve um problema ao gerar o pagamento e **a loja foi avisada** (sem beco sem saída, sem "aguarde o link").
- O pedido fica num **estado de pendência claro** (não some, não vira fantasma).
- O **lojista é notificado diretamente** (via `notifications.service` — WhatsApp/email do lojista), **não via Admin**. A frente PIX **não depende** da branch não-mergeada do Admin. Quando o Admin for mergeado, esse pedido pendente aparecerá no filtro "atenção" **naturalmente**, por já estar no estado de pendência — integração sem acoplamento.

**(c) Alinhar valor exibido vs cobrado.** A mensagem do bot mostra o **valor que o cliente realmente paga** (o `valorFinal` com 5% de desconto que `createPayment` calcula em [payments.service.ts:136-142](../../backend/src/modules/payments/payments.service.ts)), explicitando "Total R$ X — com 5% de desconto no PIX: **R$ Y**".

**Arquivos tocados:**
- Modificar: `backend/src/modules/whatsapp/whatsapp.service.ts` (`handleCheckout` — sendImage, caminho de falha honesto, valor correto).
- Definir o "estado de pendência" + a notificação direta ao lojista (`backend/src/modules/notifications/notifications.service.ts` e, se preciso, o status/flag no pedido).
- Test: `backend/src/modules/whatsapp/*.spec.ts` — com `paymentsService`, `whatsappSender` e `notificationsService` **mockados** (risco zero, sem rede).

**Tamanho:** Médio.

**Critério de teste (prova de pronto):**
- (a) Mock retorna `qr_code_base64` → `whatsappSender.sendImage` é chamado com a imagem; a copia-e-cola também é enviada.
- (b) Mock de `createPayment` **lança** → o cliente recebe a mensagem honesta (não "aguarde o link"); o pedido fica no estado de pendência definido; a **notificação direta ao lojista** é disparada (sem nenhuma dependência do Admin).
- (c) Pedido com total 100 → a mensagem ao cliente mostra **R$ 95,00** (o valor cobrado), não R$ 100,00.

---

## Seção 4 — Round-trip real com sandbox + o teste que falta (onde toca dinheiro, com token de teste)

**Estado atual:** `createPixPayment` é real ([provider:105-158](../../backend/src/modules/payments/providers/mercadopago.provider.ts)); o webhook re-consulta o status no MP (`getPaymentDetails`) e confirma via `confirmPayment` → `CONFIRMADO` + `notifyPaymentConfirmed`. Os testes de integração cobrem `cancelled`/`rejected`, **mas não** `approved → CONFIRMADO`.

**Decisão travada — como provar localmente:**
- **Config de ambiente (tudo de teste):** `PAYMENT_PROVIDER=mercadopago`, `MERCADOPAGO_ACCESS_TOKEN=TEST-...`, `MERCADOPAGO_WEBHOOK_SECRET=<qualquer>`, `MERCADOPAGO_WEBHOOK_TOKEN=<qualquer>`, e (só pro round-trip automático) `MERCADOPAGO_WEBHOOK_URL=<url pública do túnel>`. `NODE_ENV` ≠ production (a guarda da S1 garante que o `APP_USR` nunca entre aqui).
- **Túnel é necessário?** **Não para provar a lógica.** O handler **re-consulta o status no MP** (`getPaymentDetails`), então o webhook é **simulável por POST manual** (`curl` em `/payments/webhook/mercadopago` com `{data:{id}}` e `MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED=true` em dev). O túnel (cloudflared/ngrok) só é preciso pro round-trip **automático** (o MP chamando de volta sozinho). **Plano:** provar primeiro por POST manual (determinístico, sem rede instável); o túnel é um passo opcional de confirmação final.
- **Janela de expiração do PIX (D5):** setar o `date_of_expiration` do PIX **= o mesmo TTL do pedido pendente/sweeper que já existe**. **Verify no plano:** ler o valor de TTL que o sweeper/carrinho já usa (ex.: `WHATSAPP_CART_TTL_MINUTES`) e **reutilizá-lo** — **não inventar um segundo TTL**. Assim "expira no MP" e "estoque liberado pelo sweeper" andam juntos.

**O teste inegociável (critério de aceitação central da frente):**
`approved → CONFIRMADO + notifica`, hoje sem cobertura. Integração, com o `MercadoPagoProvider.getPaymentDetails` **mockado** retornando `status: 'approved'`:
- pedido criado `PENDENTE_PAGAMENTO` + pagamento `PENDING` vinculado por `transaction_id`;
- dispara `handleMercadoPagoWebhook(payloadApproved)`;
- **assere:** pagamento vira `PAID`, pedido vira `CONFIRMADO`, `notifyPaymentConfirmed` é chamado, e **a reserva de estoque permanece intacta** — `current_stock` e `reserved_stock` inalterados, **sem VENDA no ledger ainda**. (A baixa/VENDA é o commit do `StockEngine.commitSale`, que ocorre só no **PRONTO** — [orders.service.ts:647-648](../../backend/src/modules/orders/orders.service.ts) — e está **fora do escopo deste teste**; aqui provamos que confirmar o pagamento **não** libera nem baixa estoque por engano.)
- **idempotência:** reenviar o mesmo webhook `approved` não dupla-confirma o pedido nem mexe na reserva (o lock pessimista + o short-circuit `PAID && PAID` já existem; o teste prova).

**Arquivos tocados:**
- Modificar: `backend/src/modules/payments/payments.integration.spec.ts` (adicionar o bloco `approved → CONFIRMADO`).
- Modificar: `backend/src/modules/payments/providers/mercadopago.provider.ts` (`createPixPayment` seta `date_of_expiration` reutilizando o TTL existente — D5).
- Doc: um runbook curto `scripts/test/pix-sandbox-roundtrip.md` (passos do POST manual + opcional túnel) pra reexecução futura.

**Tamanho:** Médio.

**Critério de teste (prova de pronto):** o teste `approved → CONFIRMADO` passa (verde no jest contra o `ucm_test_motor`), e o round-trip por POST manual com token `TEST-` confirma um pedido de ponta a ponta na máquina local **sem o túnel** (o túnel é a cereja opcional). **Este é o marco que libera o deploy.**

---

## Seção 2b — Retirada + agendamento + horário de funcionamento (fatia própria, DEPOIS da S4)

**Estado atual / lacuna:** o schema do `Pedido` **não tem** coluna para horário de retirada (o único timestamptz extra é `stock_released_at`). A retirada precisa de (D1) um lugar pra gravar o horário e (D3) de onde ler o horário de funcionamento.

**Decisão travada — o fluxo de retirada:**
1. Completa o branch **"retirada"** do "Entrega ou retirada?" (que na S2a respondia placeholder).
2. **Retirada** → coleta `nome → telefone → horário de retirada`.
3. **Valida o horário contra o horário de funcionamento da loja**; se fora, recusa e re-pergunta.
4. Grava `customer_name`, `customer_phone`, `delivery_type='pickup'`, e o horário em **`scheduled_at`** (coluna nova — D1).
5. **Critério inviolável:** nenhum pedido de retirada chega a `CONFIRMADO` sem `scheduled_at` válido (dentro do funcionamento).

**Decisões resolvidas que vivem aqui:**
- **D1 — `scheduled_at timestamptz nullable`** no `pedidos` (coluna typed, via migration). É só a retirada que precisa.
- **D3 — horário de funcionamento semeado no banco** (em `tenant.settings`/`bot-config`); **sem UI** nesta frente (você semeia pra sua mãe). A UI de configuração fica fora de escopo.

**Arquivos tocados:**
- Criar migration: `backend/src/database/migrations/<ts>-AddScheduledAtToPedidos.ts` (+`scheduled_at`).
- Modificar: `backend/src/database/entities/Pedido.entity.ts` (+`scheduled_at`).
- Modificar: `backend/src/modules/whatsapp/whatsapp.service.ts` (branch de retirada na FSM + validação de horário).
- Modificar: `orders.service.ts`/`CreateOrderDto` (aceitar `scheduled_at`, `delivery_type='pickup'`).
- Ler horário de funcionamento de `tenant.settings`/`bot-config` (fonte a confirmar no plano).
- Test: FSM de retirada + validação de horário (dentro/fora do funcionamento).

**Tamanho:** Médio.

**Critério de teste (prova de pronto):**
- Retirada: conversa → Pedido com `delivery_type='pickup'` e `scheduled_at` dentro do funcionamento.
- Horário fora do funcionamento → bot recusa, não cria o pedido.
- Guarda do `CONFIRMADO`: retirada sem `scheduled_at` válido → rejeitado.

---

## Decisões de produto — resolvidas (todas travadas no review)

- **D1 — horário de retirada:** coluna nova **`scheduled_at timestamptz`** (migration). Vive na **S2b**.
- **D2 — endereço:** **poucas perguntas + confirmação final** (bot monta e mostra o endereço pro cliente confirmar). Vive na **S2a**.
- **D3 — horário de funcionamento:** **semear no banco**; UI fora de escopo. Vive na **S2b**.
- **D4 — falha de PIX:** **desacoplado do Admin** — verdade ao cliente + estado de pendência + **notificação direta ao lojista**. Integração com o filtro "atenção" do Admin acontece **naturalmente** quando o Admin for mergeado (sem dependência). Vive na **S3**.
- **D5 — expiração do PIX:** `date_of_expiration` **= o TTL do pedido pendente/sweeper que já existe** (ler e reutilizar, não inventar). Vive na **S4**.
- **D6 — `payer.email`:** **placeholder** por ora; coletar e-mail real **fora de escopo**.

---

## Fora de escopo (explícito)

- Cartão e boleto (qualquer mudança).
- Deploy / produção / qualquer uso do token `APP_USR`.
- UI no Admin pra configurar horário de funcionamento ou chave PIX (semear no banco por ora).
- ViaCEP / autocompletar endereço por CEP (a coleta é poucas-perguntas + confirmação, sem serviço externo).
- Coletar e-mail real do cliente (D6).
- Nota fiscal, devolução, handoff humano, recompra (são do "bot premium", Balde C).
- Self-service de conexão do WhatsApp e billing do SaaS (outras frentes).

---

## Testes — resumo do critério de aceitação da frente

1. **S1 (Task 1):** unit do guard (APP_USR em dev lança no boot e no create; TEST não lança; APP_USR em prod não lança). **Mergeado antes de tudo.**
2. **S2a:** integração — pedido de **entrega** nasce com endereço estruturado completo, após confirmação do cliente; nada chega a `CONFIRMADO` sem o endereço.
3. **S3:** unit do bot (mocks) — sendImage chamado; falha de PIX → mensagem honesta + estado de pendência + **notificação direta ao lojista** (sem Admin); valor exibido = valor cobrado (95%).
4. **S4 (central):** integração `approved → CONFIRMADO + notifica`, **sem baixar/liberar estoque** (commitSale é no PRONTO), idempotente; e o round-trip por POST manual com token `TEST-` provado localmente sem túnel. **Marco que libera o deploy.**
5. **S2b:** integração — pedido de **retirada** com `scheduled_at` válido; horário fora do funcionamento recusado; nada chega a `CONFIRMADO` sem `scheduled_at`.

**A frente termina quando S1–S4 estão verdes E o round-trip sandbox foi rodado localmente uma vez, com token de teste, sem jamais tocar o `APP_USR`. S2b fecha a retirada logo após.**
