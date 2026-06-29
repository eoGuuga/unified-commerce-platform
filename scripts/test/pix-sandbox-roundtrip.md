# Runbook: PIX sandbox round-trip (local)

> **Objetivo (Step 8 da Task 4):** provar ponta-a-ponta na maquina local que o
> fluxo PIX do bot funciona: gerar o PIX -> aprovar no sandbox do Mercado Pago ->
> webhook confirmar -> pedido vira `CONFIRMADO` **sem baixar estoque**.
>
> **Este e o marco que libera o deploy.** O dono executa este runbook
> manualmente com um token `TEST-`. A integracao automatizada
> (`payments.integration.spec.ts`, bloco "approved -> CONFIRMADO") ja cobre o
> webhook com mock; aqui exercitamos o caminho real do sandbox.

---

## 0. Pre-requisitos

- Conta de **teste** do Mercado Pago (Mercado Pago Developers -> suas
  aplicacoes -> credenciais de **TESTE**).
- Token de acesso de teste: comeca com `TEST-...` (NUNCA `APP_USR-...`).
- Backend rodando localmente em `http://localhost:3000` (ajuste a porta se
  necessario).

> **Guarda da Task 1 (bidirecional):** com `NODE_ENV != production`, se voce
> tentar subir com `MERCADOPAGO_ACCESS_TOKEN=APP_USR-...` o backend **bloqueia o
> boot** (`PROD_TOKEN_IN_DEV_MSG`). Isso e proposital: impede cobrar de verdade
> em dev. Use sempre `TEST-...` localmente.

---

## 1. Variaveis de ambiente (dev/local)

No `backend/.env` (ou exportadas no shell antes de subir):

```bash
NODE_ENV=development                       # NUNCA production aqui
PAYMENT_PROVIDER=mercadopago               # ativa o provider real (sandbox)
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxxxxxx...  # token de TESTE (TEST-), nunca APP_USR

# Webhook: em dev, aceitar nao-assinado simplifica o POST manual.
MERCADOPAGO_WEBHOOK_TOKEN=um-token-qualquer-de-dev
MERCADOPAGO_WEBHOOK_SECRET=                # vazio em dev -> validacao de assinatura pulada
MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED=true    # so vale fora de producao

# TTL do PIX (expiracao). Default 60 se ausente.
ORDER_PAYMENT_TTL_MINUTES=60

# Opcional: so se for usar tunel (ver secao 6). Faz o MP chamar seu webhook.
# MERCADOPAGO_WEBHOOK_URL=https://<seu-tunel>/api/v1/payments/webhook/mercadopago
```

Notas:
- Em **producao** o webhook e **fail-closed**: `MERCADOPAGO_WEBHOOK_TOKEN` e
  `MERCADOPAGO_WEBHOOK_SECRET` sao obrigatorios e `ALLOW_UNSIGNED` e ignorado.
  Aqui estamos em dev de proposito.
- `date_of_expiration` do PIX e calculado como `agora + ORDER_PAYMENT_TTL_MINUTES`
  no offset de Brasilia (`-03:00`).

Suba o backend:

```bash
cd backend
npm run start:dev
```

---

## 2. Gerar um PIX de teste

Duas opcoes:

### (a) Pelo bot de WhatsApp
Faca um checkout pelo bot ate a geracao do PIX (entrega -> confirmar endereco
-> PIX). O bot envia o QR + copia-e-cola. Anote o **pedido** criado.

### (b) Direto pelo endpoint publico (mais rapido pra provar o round-trip)
Crie um pedido ecommerce e gere o PIX:

```bash
# 1) Checkout publico (ajuste produto_id/tenant). Retorna o pedido.
curl -s -X POST http://localhost:3000/api/v1/orders/public/checkout \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: <TENANT_ID>" \
  -H "Idempotency-Key: roundtrip-$(date +%s)" \
  -d '{
    "channel": "ecommerce",
    "customer_name": "Cliente Sandbox",
    "customer_phone": "11999998888",
    "delivery_type": "pickup",
    "items": [{ "produto_id": "<PRODUTO_ID>", "quantity": 1, "unit_price": 100 }],
    "discount_amount": 0,
    "shipping_amount": 0
  }'
# -> anote o "id" do pedido (PEDIDO_ID) e total_amount

# 2) Gera o PIX (5% desconto: 100 -> 95)
curl -s -X POST http://localhost:3000/api/v1/payments/public \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: <TENANT_ID>" \
  -d '{ "pedido_id": "<PEDIDO_ID>", "method": "pix", "amount": 95 }'
# -> resposta traz qr_code / copy_paste e o pagamento (status pending).
#    Anote o transaction_id do pagamento = o <MP_PAYMENT_ID> do Mercado Pago.
```

> O `transaction_id` retornado e o **id do pagamento no Mercado Pago** — e ele
> que vai no `data.id` do webhook.

---

## 3. CHECKPOINT CRÍTICO (negativo): webhook ANTES de aprovar → NÃO pode confirmar

> **Este é o passo que prova que o sistema é REAL — contra-intuitivo, NÃO pule.**
> A tentação é: gerar PIX, aprovar, mandar webhook, ver "confirmado", comemorar. Mas isso
> sozinho não prova nada — um sistema que aceita qualquer POST também daria "confirmado".
> O que prova solidez é disparar o webhook ENQUANTO o pagamento ainda está `pending` no MP
> e ver o pedido **recusar** a confirmação. É o teste negativo que dá sentido ao positivo.

Com o pagamento ainda **NÃO aprovado** no sandbox, dispare o webhook (o mesmo POST do passo 5):

```bash
curl -s -X POST "http://localhost:3000/api/v1/payments/webhook/mercadopago?token=um-token-qualquer-de-dev" \
  -H "Content-Type: application/json" \
  -d '{"data":{"id":"<MP_PAYMENT_ID>"}}'
```

Verifique o pedido:
```bash
curl -s http://localhost:3000/api/v1/orders/<PEDIDO_ID> -H "x-tenant-id: <TENANT_ID>" | grep -o '"status":"[^"]*"'
# -> DEVE seguir "pendente_pagamento". NUNCA "confirmado" aqui.
```

- **Pedido NÃO confirmou** → ✅ prova que quem manda é o status real consultado no MP (`getPaymentDetails`), não o corpo do POST (que qualquer um forja). Só agora o "confirmado" do passo 5 tem sentido.
- **Pedido CONFIRMOU aqui** → 🛑 **PARE TUDO.** O handler está confiando no POST, não no MP — furo de segurança. Não mergeie; investigue antes.

## 4. Aprovar o pagamento no sandbox do MP

No painel de **teste** do Mercado Pago, va em **Atividade / Pagamentos** e
localize o pagamento PIX recem-criado (pelo `MP_PAYMENT_ID`). Use a opcao de
**aprovar/simular pagamento** do sandbox para mover o status para `approved`.

Alternativamente, com PIX de teste o MP costuma disponibilizar o "pagador de
teste" para concluir o PIX. O importante: o pagamento precisa ficar `approved`
no MP antes do proximo passo.

---

## 5. Disparar o webhook por POST manual (positivo — agora aprovado)

Como em dev o webhook aceita nao-assinado, basta o `data.id`. O backend vai
chamar `getPaymentDetails(<MP_PAYMENT_ID>)` no MP (agora `approved`) e confirmar:

```bash
curl -s -X POST "http://localhost:3000/api/v1/payments/webhook/mercadopago?token=um-token-qualquer-de-dev" \
  -H "Content-Type: application/json" \
  -d '{"data":{"id":"<MP_PAYMENT_ID>"}}'
# -> {"status":"ok"}
```

(o token tambem pode ir no header `x-webhook-token: um-token-qualquer-de-dev`.)

---

## 6. Verificar o resultado (criterio de aceitacao)

```bash
# Status do pedido -> deve ser "confirmado"
curl -s http://localhost:3000/api/v1/orders/<PEDIDO_ID> \
  -H "x-tenant-id: <TENANT_ID>" | grep -o '"status":"[^"]*"'
```

Confirme no banco (ou via Admin) que:
- pagamento esta `paid`;
- pedido esta `confirmado`;
- **estoque INTACTO**: `current_stock` e `reserved_stock` do produto seguem
  iguais ao de antes do webhook (a reserva continua de pe — confirmar pagamento
  NAO baixa nem libera);
- **sem VENDA no ledger**: nenhum movimento `tipo = 'VENDA'` para este pedido
  (a baixa/`commitSale` so acontece quando o pedido vai pra `PRONTO`).

Reenvie o mesmo POST do passo 4 para checar **idempotencia**: continua
`{"status":"ok"}`, pedido segue `confirmado`, estoque inalterado, sem VENDA
nova.

---

## 7. (Opcional) Tunel para o MP chamar seu webhook automaticamente

Se quiser que o proprio Mercado Pago dispare o webhook (em vez do POST manual),
exponha o backend com um tunel e aponte `MERCADOPAGO_WEBHOOK_URL` pra ele.

```bash
# cloudflared
cloudflared tunnel --url http://localhost:3000
# ou ngrok
ngrok http 3000
```

Pegue a URL publica e configure:

```bash
MERCADOPAGO_WEBHOOK_URL=https://<seu-tunel>/api/v1/payments/webhook/mercadopago
```

Reinicie o backend. Agora os PIX gerados ja sobem com `notification_url`
apontando pro tunel, e o MP chama o webhook sozinho quando o pagamento muda de
status. (O POST manual do passo 4 continua valendo como fallback de teste.)

---

## Lembrete final

- **Token:** somente `TEST-` em dev. A guarda da Task 1 impede subir com
  `APP_USR` fora de producao (e impede `TEST-` em producao).
- **Nao mover `commitSale`:** confirmar pagamento nao baixa estoque; a baixa e
  no `PRONTO`. Se o estoque mexer ao confirmar, e bug — pare e investigue.
