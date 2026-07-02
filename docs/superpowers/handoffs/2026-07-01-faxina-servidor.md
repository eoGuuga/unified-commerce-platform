# Handoff — Faxina do Servidor (VPS gtsofthub.com.br)

**Data:** 2026-07-01
**Fase:** PLANO (investigação read-only FEITA; **nada alterado no servidor ainda**).
**Objetivo:** deixar o servidor limpo, rastreável, confiável e acessível (amigos testarem pela internet).

---

## Estado da main local
- **45 commits à frente de `origin/main`** (que está em `02deaae`). **Nada pushado.**
- Integrado e verificado: **cleanup + admin + PIX + PDV + confirmPayment + config do lojista + Camada 2 (disponibilidade)**.
- Branch `main`, working tree limpa.

## O que a investigação do servidor constatou (read-only, SSH `ubuntu@gtsofthub.com.br`)

**1. `/opt` — 4 dirs + 1 aninhado:**
- `/opt/ucm` — git main, HEAD `b30fa0b` (13/jun), **44 sujos**. **É DAQUI que o prod builda** (`docker-compose.prod.yml` context `../backend`/`../frontend`) → **código órfão**.
- `/opt/ucm/unified-commerce-platform` — clone fresco aninhado `f6cb47e` (28/jun), limpo, **redundante** (NÃO é o que builda).
- `/opt/ucm-test-repo` — git main, HEAD `d5a6081` (10/jun), 9 sujos.
- `/opt/ucm-repo`, `/opt/ucm-test` — **lixo não-git**.

**2. De onde builda:** prod builda do dir **velho + sujo** (`/opt/ucm`) → o código em execução **não mapeia pra commit** (órfão, irreprodutível). O servidor roda código **anterior a tudo desta sessão**.

**3. nginx:** `gtsofthub.com.br` e `dev.gtsofthub.com.br` apontam pros **MESMOS containers de prod** (`ucm-frontend`/`ucm-backend`) — **dev = prod disfarçado**. Sem ambiente de teste separado no ar.

**4. Containers:** UP = prod (backend/frontend/nginx/postgres/redis) + infra de teste (`ucm-postgres-test`, `ucm-redis-test`). **App de teste NÃO roda.** Lixo: `ucm-redis-new` (Created), `ucm-ollama-test`, `ucm-backend-dev` (Exited).

**5. Produção real: NÃO existe.** Banco de prod `ucm` (container `ucm-postgres`): **16 tenants todos teste/dummy** (doceria seed + vários "Teste"/"Empresa Gustavo"), **3 pedidos, 0 entregues, 0 pagos**, último 15/jun. Zero dinheiro/cliente real. **Faxina é SEGURA.**

**6. Disco: 80% cheio** (20G livres de 96G). Memória ok. **Vilão: Docker** — build cache **49GB** (48.5 reclaimável) + imagens (6.6 reclaimável). `docker builder/image prune` libera **~55GB**.

## Sequência de faxina proposta (ordem segura — a confirmar no plano)
- **(a)** `push origin/main` dos 45 commits.
- **(b)** `docker builder/image prune` (~55GB).
- **(c)** consolidar em **UM** dir limpo rastreando `origin/main` (apagar os 2 lixos + o aninhado).
- **(d)** build/up a partir dele + validar no ar.
- **(e)** script de deploy (`git pull --ff-only` + build + health) + `frontend/.dockerignore`.
- **(f)** remover containers lixo.
- **(g)** decidir dev=prod vs stack separado.

## Decisões do dono PENDENTES (moldam o plano)
1. **dev = prod aceito**, ou **ambiente de teste separado** (subir `ucmtest` + rotear `dev.` no nginx)?
2. **Manter os dados de teste do banco de prod**, ou **zerar e recriar limpo** (é tudo dummy)?

## Regras da frente
- **Infra em 2 etapas:** plano aprovado ANTES de executar.
- **Cada passo destrutivo confirmado antes.** "Extrair antes de apagar."
- **Verifica-não-confia dobrado** (é servidor; sem "reverter commit" fácil).
- **Nada alterado no servidor até agora — tudo read-only.**

## Próximo passo
O arquiteto (via Gustavo) decide as 2 decisões e manda escrever o plano de faxina (spec→plano). **Aguardando.**
