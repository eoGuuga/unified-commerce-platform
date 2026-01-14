# Separar chaves DEV vs PROD (obrigatorio)

Objetivo: evitar que testes afetem producao, reduzir risco de vazamento e manter
o ambiente previsivel. A regra e simples: **nunca reutilize credenciais entre
DEV e PROD**.

## 1) O que deve ser separado (sempre)

- Mercado Pago: access token, public key, webhook secret, webhook URL.
- WhatsApp: Twilio SID/token e numero, ou Evolution API key/instance.
- Email: Resend/SES API key e dominio remetente.
- OpenAI: API key (ou base URL se usar proxy).
- Banco/Redis: usuarios, senhas, e bancos separados.

## 2) Padrao de arquivos (organizado)

- Producao (VPS): `deploy/.env` (use `deploy/env.prod.example` como base).
- Dev/test (VPS): `deploy/.env` no repo de dev/test (use `deploy/env.dev.example`).
- Backend local com VPS via tunnel: `backend/.env` (use `backend/.env.dev.vps.example`).
- Backend local (Docker/localhost): `backend/.env` (use `backend/.env.example`).

## 3) Como saber se uma chave e DEV ou PROD

- Mercado Pago:
  - DEV: prefixo `TEST-`
  - PROD: sem `TEST-`
- Twilio:
  - use contas/subaccounts diferentes para dev/prod
- Resend/SES:
  - dev com dominio de teste, prod com dominio real
- OpenAI:
  - crie chaves separadas por ambiente

## 4) Checklist rapido (DEV)

- `MERCADOPAGO_ACCESS_TOKEN` com prefixo `TEST-`
- `MERCADOPAGO_PUBLIC_KEY` com prefixo `TEST-`
- `MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED=true`
- `FRONTEND_URL=https://dev.gtsofthub.com.br`
- `ENABLE_SWAGGER=true`
- `ALLOW_TENANT_FROM_REQUEST=true`

## 5) Checklist rapido (PROD)

- `MERCADOPAGO_ACCESS_TOKEN` sem `TEST-`
- `MERCADOPAGO_PUBLIC_KEY` sem `TEST-`
- `MERCADOPAGO_WEBHOOK_ALLOW_UNSIGNED` **nao definido** (ou `false`)
- `FRONTEND_URL=https://gtsofthub.com.br`
- `ENABLE_SWAGGER=false`
- `ALLOW_TENANT_FROM_REQUEST=false`

## 6) Onde pegar cada chave (resumo)

Detalhe completo em: `docs/07-setup/PEGAR-CREDENCIAIS-OFICIAIS.md`.

