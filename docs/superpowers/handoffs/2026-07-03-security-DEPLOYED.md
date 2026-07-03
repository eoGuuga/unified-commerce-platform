# ✅ Frente de Segurança (Blocos 1+2) — DEPLOYADA e VALIDADA em prod

**Data:** 2026-07-03 · **`origin/main` = `eeb896f`** (merge `--no-ff` + push; prod = espelho de novo).
Ponto de entrada/histórico: `2026-07-03-SECURITY-RETOMADA.md`, `-security-deploy-plan.md`.

## O que está LIVE em produção
- **Rate-limit de login efetivo** (`trust proxy` — o balde volta a ser por-cliente).
- **Headers de segurança** — HSTS (2 anos, preload) + CSP + `server_tokens off` (nginx) + helmet.
- **Boot fail-closed anti-superuser** — o app recusa subir se conectar como superuser/BYPASSRLS.
- **RLS imposto em TODAS as tabelas sensíveis** (Bloco 2 A+B: as 4 métricas WhatsApp + ledger + reservas + `whatsapp_carts`), com os **2 sweepers refeitos** (loop-por-tenant) e a primitiva `app_list_tenant_ids()` (SECURITY DEFINER) — o app segue 100% restrito (`ucm_app`, sem BYPASSRLS).

## Deploy (como foi)
- Migrations `1751900000000` + `1752000000000` rodadas em prod **como admin** via `DATABASE_ADMIN_URL` (contêiner efêmero: `run --rm backend node_modules/.bin/typeorm -d dist/database/data-source.js migration:run`). **`npm run migration:run` NÃO serve em prod** (usa ts-node + `src/`, que a imagem não tem).
- **F9 resolvido antes:** senha do role `postgres` sincronizada com o `.env` via `ALTER USER` (socket local, senha via stdin). A senha era **forte** (32 chars aleatórios) — mantida.
- **2 tropeços operacionais (resolvidos):** (1) o Stage B cortou no buffer após a migration → backend `Exited` → ~1 min de 502 → `up -d` recuperou (health 200). (2) nginx bind-mount de arquivo único não vê o novo inode do `git pull` → `up -d --force-recreate nginx` aplicou os headers.

## Validação pós-deploy (as 4 passaram)
- **(a) app vende:** health 200; login OK (JWT válido); **read do `whatsapp_carts` sob RLS = 200** (GET com carrinho); write via sweeper.
- **(b) os 2 sweepers — prova FUNCIONAL:** carrinho vencido → `expired`+`released`; pedido pendente vencido → `cancelado`+`released`; log ao vivo `"Sweeper: 1 pedido(s)... em 1 tenant(s)"`.
- **(c) RLS imposto:** 7 tabelas `relforcerowsecurity=t`; `ucm_app` sem contexto → 0.
- **(d) rate-limit + headers:** 11º login → 429; HSTS/CSP/X-Frame/`server` sem versão.
- Doceria intacta (tenants=1, produtos=69, usuarios=1); lixo de teste removido.

---

## 🐞 Follow-up: 2 bugs do cart-API HTTP (achados na validação)

**Pré-existentes, NÃO-regressão da Fase B.** Ambos no `whatsapp-cart.controller.ts`. **O bot real NÃO usa esses endpoints HTTP** — ele chama o `CartService` in-process via o webhook do WhatsApp — por isso nunca afetaram vendas. Mas o cart-API HTTP (para um front/PDV de carrinho) está quebrado. **Consertar quando atacarmos os follow-ups de produto.**

- **BUG-CART-1 — `buildMinimalCartSummary(null)` → 500.** O `GET /whatsapp/cart/:tenantId/:phone` (público) dá **500** quando o telefone **não tem carrinho** (o caso comum): `getCartByTenantAndPhone` retorna `null` e `buildMinimalCartSummary` não trata `null`. **Fix:** retornar um resumo vazio (`hasCart:false`) quando `cart` for `null`. *(Confirmado: com carrinho presente o endpoint responde 200 — o read sob RLS funciona; o 500 é só o null-handling.)*
- **BUG-CART-2 — `POST /whatsapp/cart/add` (e clear/update) → 401 "Invalid token: missing user ID".** Mesmo com JWT válido (payload tem `sub`), a extração do `userId` no controller lê o campo errado (espera `id`/`userId`, o token traz `sub`). **Fix:** ler `req.user.sub` (ou alinhar o que a JwtStrategy popula em `req.user` com o que o controller lê).

Nenhum é urgente (bot in-process não passa por aqui); ficam pro bloco de follow-ups de produto.

## Falta na frente de segurança
- **Fase C** (`email_confirmations` sem RLS — controle app-level + TTL; decisão do dono; não-crítico).
- **Bloco 3** (Tier-2/altos da auditoria) — os HIGH vivos primeiro: **SSH key-only + sem root** e **`npm audit`** (axios/next/ws/multer/path-to-regexp). Detalhe no `-SECURITY-RETOMADA.md`.
