# Snapshot do código que existia SÓ no servidor (2026-06-28)

Preservação do código/configs que estavam apenas no servidor de produção
(`/opt/ucm`) e NUNCA tinham sido commitados no GitHub. Capturado durante o
diagnóstico de infraestrutura (ver `docs/CONSOLIDADO/DIAGNOSTICO-INFRA-SERVIDOR.md`).

**Objetivo:** evitar perda irreversível. Isto NÃO é código para mergear direto —
é um arquivo histórico para análise. Cada item precisa ser avaliado: é feature
real a integrar, ou resto/experimento a descartar?

**NÃO contém secrets** (CREDENCIAIS-SERVIDOR.txt, certs/, .env ficaram de fora
de propósito — secrets nunca vão para o git).

## O que tem aqui (avaliar item a item)

- `deploy/nginx/ucm.conf` e `config/nginx.conf` — config de nginx do servidor
  (divergia muito do GitHub; provável SSL/rotas reais). IMPORTANTE para entender
  a config viva de produção.
- `deploy/docker-compose.prod.yml` — versão do servidor (comparar com a do repo;
  lembrar que NENHUMA das duas passa os secrets do MercadoPago).
- `backend/src/modules/email/` — módulo de email (NÃO está em uso: app.module
  não importa). Avaliar se é feature pretendida.
- `backend/src/modules/subscriptions/` + `Subscription.entity.ts` — esboço de
  assinaturas (NÃO em uso). Pode ser relevante para o modelo de planos do SaaS.
- `frontend/app/registrar/page.tsx` — página de cadastro (avaliar vs a atual).
- `frontend/components/landing/` (CalculadoraROI, Comparacao, ProvaSocial) —
  componentes de landing que podem ser features de marketing reais.
- `backend/auth.controller.ts`, `auth.service.ts`, `tsconfig*`, `Dockerfile`,
  `next.config.js`, etc. — versões do servidor (a main provavelmente já tem
  equivalentes; comparar antes de qualquer coisa).

## Próximo passo
Avaliar cada item na faxina de infra. O que for feature real → integrar na main
com revisão. O que for resto → descartar. Este snapshot pode ser deletado depois
que tudo for avaliado.
