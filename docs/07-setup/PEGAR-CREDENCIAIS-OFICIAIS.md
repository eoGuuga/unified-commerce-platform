# Pegar credenciais oficiais (passo a passo)

Este guia mostra onde pegar **todas** as chaves/credenciais, separando DEV e PROD.
Use sempre contas/subcontas diferentes quando o provedor permitir.

## 1) Mercado Pago (pagamentos)

Onde:
- https://www.mercadopago.com.br/developers/panel/credentials

Como:
1. Entre no painel de desenvolvedores.
2. Copie as credenciais de **teste** (DEV):
   - `MERCADOPAGO_ACCESS_TOKEN` (TEST-...)
   - `MERCADOPAGO_PUBLIC_KEY` (TEST-...)
3. Copie as credenciais de **producao**:
   - `MERCADOPAGO_ACCESS_TOKEN` (sem TEST-)
   - `MERCADOPAGO_PUBLIC_KEY` (sem TEST-)
4. Configure o webhook:
   - DEV: `https://dev.gtsofthub.com.br/api/v1/payments/webhook/mercadopago?token=SEU_TOKEN`
   - PROD: `https://gtsofthub.com.br/api/v1/payments/webhook/mercadopago?token=SEU_TOKEN`
5. Se o painel fornecer assinatura, copie para `MERCADOPAGO_WEBHOOK_SECRET`.

## 2) WhatsApp - Twilio

Onde:
- https://www.twilio.com/console

Como:
1. Crie uma conta/subconta para DEV e outra para PROD.
2. Copie:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
3. Ative WhatsApp no console (Sandbox para DEV).
4. Use o numero do WhatsApp autorizado em `TWILIO_WHATSAPP_NUMBER`.

## 3) WhatsApp - Evolution API

Onde:
- https://doc.evolution-api.com

Como (self-host):
1. Suba a Evolution API (Docker) no PC/servidor da loja.
2. Gere uma `API_KEY` no painel/manager.
3. Crie uma instancia e conecte o WhatsApp (QR ou numero).
4. Preencha:
   - `EVOLUTION_API_URL` (ex.: http://SEU_IP:8082)
   - `EVOLUTION_API_KEY`
   - `EVOLUTION_INSTANCE` (ex.: default)

## 4) Email - Resend

Onde:
- https://resend.com

Como:
1. Crie API key para DEV e outra para PROD.
2. Verifique o dominio de envio (SPF/DKIM).
3. Preencha:
   - `RESEND_API_KEY`
   - `EMAIL_FROM` (ex.: noreply@gtsofthub.com.br)

## 5) OpenAI

Onde:
- https://platform.openai.com/api-keys

Como:
1. Crie uma chave DEV e outra PROD.
2. Preencha:
   - `OPENAI_API_KEY`
   - `OPENAI_BASE_URL=https://api.openai.com/v1`
   - `OPENAI_MODEL` (ex.: gpt-4o-mini)

## 6) Ollama (local)

Onde:
- https://ollama.com

Como:
1. Instale o Ollama no PC/servidor local.
2. Baixe um modelo (ex.: `ollama pull llama3.1`).
3. Configure:
   - `OPENAI_BASE_URL=http://localhost:11434/v1`
   - `OPENAI_ALLOW_NO_KEY=true`
   - `OPENAI_API_KEY=` (vazio)

## 7) Redis e Postgres (ambiente)

DEV:
- Senhas diferentes de PROD.
- Banco separado (`ucm_dev`, `ucm_test`, etc).

PROD:
- Usuario do app **nao superuser** (`ucm_app`).
- Senhas fortes e armazenadas em gerenciador.

## 8) Checklist final

- DEV e PROD com chaves diferentes
- Webhooks apontando para dominios corretos
- `MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED=true` apenas em DEV
- `ALLOW_TENANT_FROM_REQUEST=false` em PROD
- `ENABLE_SWAGGER=false` em PROD

