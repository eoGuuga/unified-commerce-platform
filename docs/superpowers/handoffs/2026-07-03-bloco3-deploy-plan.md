# Plano de deploy — Bloco 3 (deps + SSH) — LEVE, sem migration

**Branch:** `security/bloco3-npm-audit-ssh` (2 commits: `ee77db4` safe npm audit fix front+back; `b3ae0d8` override path-to-regexp 8.4.2). **Não mergeado, não deployado.** SSH já foi feito (cosmético, no servidor — não é código).
**Escopo:** só código do frontend (axios/next/ws) + lock/override do backend (path-to-regexp). **SEM migration, SEM mudança de nginx, SEM mudança de banco.**

## Sequência
1. **Merge + push:** `git checkout main && git merge --no-ff security/bloco3-npm-audit-ssh && git push origin main`. No servidor: `git -C /opt/gtsofthub pull --ff-only`.
2. **Build `--no-cache` (front + back):** `cd /opt/gtsofthub/deploy && docker compose -p deploy -f docker-compose.prod.yml --env-file .env build --no-cache backend frontend`. **Zero downtime** (build não toca os containers rodando).
3. **`up -d` (SEM stop/migration):** `docker compose -p deploy -f docker-compose.prod.yml --env-file .env up -d`.

## Downtime — SIM, mas breve (~15-30s de API), muito menor que o deploy anterior
- **Não há a janela deliberada** do deploy anterior (aquilo era o `stop backend` pra rodar a migration em segurança). Aqui **não há migration** → não paramos nada de propósito.
- Mas o `up -d` **recria** o backend (para o container velho → sobe o novo → boota ~15-30s do Nest). Nesse intervalo a **API responde 502** (o nginx não alcança o upstream). O frontend recria rápido (Next inicia em segundos). Total: **~15-30s de API fora**, em single-replica.
- **Não dá pra ter cutover zero-downtime** aqui — Docker Compose single-replica recria = janela breve. Zero-downtime real exigiria blue-green / 2 réplicas + LB, que **não vale pra 1 lojista**. É a MESMA janela do `up -d` do deploy passado, só que agora é a ÚNICA (sem stop, sem migration).
- **Minimizar:** buildar primeiro (passo 2, 0 downtime) e só então `up -d` — a janela do recreate é inevitável mas curta. Fazer em horário de baixo movimento.

## Validação pós-deploy
- **npm audit no ar (as exploráveis fecharam?):** `docker exec ucm-frontend npm audit --omit=dev 2>&1 | tail -1` (esperar sem axios/next/ws high) + `docker exec ucm-backend sh -c 'npm audit 2>&1 | grep -i path-to-regexp'` → **vazio** (fechado). *(Ou rodar local no repo já mergeado.)*
- **Rotas do backend (o path-to-regexp mexe no roteamento):** `curl` health **200** + **login** (POST /auth/login → token) + uma **rota autenticada** (GET /orders com Bearer → 200) + o **webhook** path resolvendo — confirmam que o Nest roteia com o path-to-regexp 8.4.2 pinado.
- **Frontend carregando:** `curl -sI https://gtsofthub.com.br/` → **200** + a raiz renderiza (HTML).
- **Headers ainda ativos:** `curl -sI` mostra HSTS/CSP/`server` sem versão (nginx não muda no Bloco 3, mas confirma que o recreate não regrediu).
- **App vendendo:** health + login OK (o fluxo cart/order já foi validado no Bloco 2; smoke rápido basta).

## Rollback (se algo quebrar — ex.: rota 404/500 pelo path-to-regexp, ou front não carrega)
- **Reverter o código:** `git revert` do merge na main (ou checkout do commit anterior `ee77256`) + `build --no-cache` + `up -d` da imagem anterior. **Sem migration = sem revert de schema.**
- Como não toca banco, **não precisa restaurar backup** (o backup do deploy anterior segue lá, por garantia).
- Rollback é rápido (mesma sequência build+up com o código antigo).

## Nota
As correções **só valem no ar após este deploy** (o front axios/next/ws e o back path-to-regexp estão no código/lock, não no runtime atual de prod). Prioridade: baixa-média (as exploráveis reais do front + o DoS por ReDoS do back) — deploy quando conveniente, em baixo movimento.
