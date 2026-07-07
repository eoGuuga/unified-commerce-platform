# Segurança — Bloco A (HIGH limpos de auth) — ✅✅ DEPLOYADA E VALIDADA EM PROD

**Branch:** `security/bloco-a-token-revocation` → mergeada `--no-ff` na `main` = prod HEAD = `72b3019`.
**Deploy: 2026-07-04** (leve, sem migration; plano em `2026-07-04-security-bloco-a-deploy-plan.md`). **Todos os 5 fixes LIVE.** Validado no ar: boot limpo (health 200, NEST_STARTED, Redis healthy); login funciona (401 em cred errada = data-path vivo); **🎯 revogação por-token PROVADA no ar** (dono rodou o round-trip: `me(A) após logout=401` revogado + `me(B)=200` 2ª sessão intacta); `/auth/logout` deployado (401 sem token); register com `role:admin`→400 (privesc fechado); headers HSTS/CSP ativos + `server:nginx` sem versão; doceria intacta (1/69/1); front serve `/`+`/login`+`/info/[slug]`=200 (Turbopack não pulou rotas). Backup de rede: `ucm-20260704-035549.sql.gz`.
- **Follow-up cosmético anotado:** o `POST /auth/logout` retorna **201** (default do Nest pra POST) em vez de 200 — ambos são sucesso (a prova é o 401 seguinte). Alinhar com `@HttpCode(HttpStatus.OK)` no próximo deploy (não vale um ciclo só pra isso).
**Data:** 2026-07-04. Fecha os HIGH/MEDIUM **limpos** do levantamento (alto valor, baixo risco de quebrar fluxo). O `localStorage→httpOnly cookie` (o delicado) foi **deixado como sub-frente própria** — ver `2026-07-04-security-cookie-subfront.md`.

## O que foi feito (cada um com teste-que-prova)

### A1 — Logout com revogação real de token (o HIGH principal) 🎯
- **Mecanismo:** denylist de `jti` em Redis. Cada token ganha um `jti` no login; `POST /auth/logout` (novo, autenticado) põe o `jti` na denylist com **TTL = vida restante do token**; o `validateUser` (que já recarrega o usuário a cada request) **rejeita** qualquer token com `jti` na lista. Escolhi jti (por-token) em vez de `token_version` (por-usuário) **de propósito**: deslogar um dispositivo **não** mata as outras sessões ativas.
- **Resiliência:** fail-open na disponibilidade — Redis fora do ar **não** derruba a auth (o token ainda expira em ≤15min). Token legado sem `jti` continua válido (back-compat).
- **Front:** o `useAuth.logout` agora chama `POST /auth/logout` **antes** de limpar (best-effort) — o "sair" mata a sessão de verdade, ponta a ponta.
- **Prova:** `auth-token-revocation.security.spec` (5/5): token válido → logout → **mesmo token rejeitado (401)**; revogar A não afeta B; TTL bounded; Redis-down resiliente; back-compat. + `useAuth.test` (front chama o logout).
- **Arquivos:** `auth.constants.ts` (novo), `auth.service.ts` (jti/logout/isTokenRevoked/validateUser + injeção do `CacheService`), `auth.controller.ts` (endpoint), front `api-client.ts`+`useAuth.ts`.

### A2 — Privesc do `role` no register (landmine removida)
- **Antes:** o RegisterDto aceitava `role` do cliente e o serviço atribuía verbatim → auto-registro como admin (inerte em prod, mas frágil). **Agora:** campo `role` removido do DTO; o servidor sempre cria **SELLER**. Com whitelist+forbidNonWhitelisted, mandar `role` no body é rejeitado (400).
- **Prova:** teste "register ignora role do cliente e cria SELLER".

### A3 — Política de senha mais forte (register)
- `@MinLength(6)` → **min 8 + ao menos uma letra e um número + max 72** (72 evita truncamento silencioso do bcrypt). Login **não** foi endurecido (não travar usuários existentes).
- **Prova:** `auth-password-policy.security.spec` (5 casos: curta/só-letra/só-número/longa rejeitadas; forte passa).

### A4 — bcrypt 10 → 12
- Constante `BCRYPT_COST=12` usada no register (`auth.service`) e na criação do admin no signup (`tenants.service`). Hashes existentes seguem o custo gravado neles (não invalida senhas antigas).
- **Prova:** o custo configurado produz hashes de 12 rounds (`bcrypt.getRounds`).

### A5 — `PATCH /tenants/branding` restrito a ADMIN
- **Antes:** só `JwtAuthGuard` → qualquer usuário do tenant (ex. seller) trocava o branding, apesar do doc dizer "requer admin". **Agora:** `RolesGuard + @Roles(ADMIN)` (espelha o `/settings`).
- **Prova:** `tenants-branding-authz.security.spec` — RolesGuard real + o handler real: seller → 403, admin → passa, a rota declara @Roles(ADMIN).

## Estado dos testes
- **Backend:** build OK; suíte unit **39 falhas = baseline pré-existente exato, ZERO nova** (as 6 suítes WhatsApp/products de sempre); +16 testes novos verdes (681 passam).
- **Frontend:** type-check OK; vitest **471/471** (os 2 de logout ajustados p/ o logout assíncrono + provar a chamada de revogação).

## Deploy (para quando aprovar)
- **Sem migration.** Deploy leve (código só). Backend + frontend rebuild + `up`.
- **Precisa Redis** (já é infra core: locks/cache). A denylist usa o `CacheService`/ioredis existente — nenhuma var nova.
- **Sem quebra de fluxo:** tokens legados sem jti seguem válidos; login/registro/branding continuam funcionando (só register exige senha mais forte + role fixo).

## Ainda aberto (fora do Bloco A)
- **Sub-frente `localStorage→httpOnly cookie`** — ver `2026-07-04-security-cookie-subfront.md` (delicada; mexe no transporte de auth dos 2 apps + exige CSRF).
- **#5 do levantamento — `JwtAuthGuard` global (fail-open→fail-closed)** — médio, exige auditar todas as rotas públicas; pode entrar num Bloco B com cuidado.
- Hardening menor: `/health/metrics` sem auth, lockout por conta, remover `JwtAuthGuardProd` (código morto), throttle no webhook WhatsApp.
