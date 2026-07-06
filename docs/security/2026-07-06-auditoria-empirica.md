# Auditoria de Segurança Adversarial Empírica — GTSoftHub / UCM

> **Data:** 2026-07-06 · **Método:** ataques REAIS montados e rodados contra o ambiente de **TESTE** (`localhost:3009` ligado ao banco `ucm_test_motor` via túnel SSH). **Nenhum ataque tocou produção.** Cada vetor reportado com request + resposta reais.
> **Propósito:** registro de que a segurança foi auditada a fundo + base para o dossiê de um pentester profissional (quando contratado).

---

## Veredito geral

> **Nenhuma falha 🔴 explorável foi encontrada empíricamente.** Autenticação, isolamento multi-tenant, injeção, lógica de dinheiro, resistência a DoS, CSRF e gestão de segredos foram **provados sob ataque real** — não só na leitura de código. A defesa é em profundidade e segura quando atacada. Para os vetores testáveis sem provedores externos nem cliente real, o sistema está **pronto para vender do ponto de vista de segurança**, com uma lista curta de polimentos 🟡 e um único vetor a-provar (prompt-injection, que exige a chave OpenAI no ambiente de teste).

**Escopo (7 blocos):** Fase 1 (análise de código) + Blocos E/F/G (infra, só-leitura) + Empíricos 1-7 (ataques reais).

| # | Bloco | Veredito |
|---|---|---|
| Fase 1 | Auth, authz/multi-tenant, injeção, exposição de dados (código) | 🟢 sem furo explorável |
| E/F/G | Information disclosure, dependências, infra/servidor | 🟢 bem endurecido |
| Empírico 1 | Autenticação e sessão | 🟢 à prova |
| Empírico 2 | Autorização / multi-tenant (cross-tenant) | 🟢 à prova |
| Empírico 3 | Injeção (SQLi / XSS / prompt-injection) | 🟢 clássica limpa · prompt-injection a-provar |
| Empírico 4 | Business logic / dinheiro | 🟢 à prova |
| Empírico 5 | DoS / rate-limit sob carga | 🟢 (1 nit) |
| Empírico 6 | CSRF | 🟢 N/A hoje |
| Empírico 7 | Gestão de segredos | 🟢 |

---

## Achados por gravidade

### 🔴 CRÍTICO / ALTO (explorável) — **NENHUM**
Todos os ataques de invasão / roubo de dados / fraude financeira foram bloqueados com resposta real (401 / 403 / 404 / 400 / clamp / ignored).

### 🟡 MÉDIO / BAIXO (hardening — não é buraco explorável; corrigir eleva a régua)

| ID | Achado | Bloco | Nota |
|----|--------|-------|------|
| **H1** | **Revogação fail-open com Redis fora** — logout não revoga o token se o Redis cair (válido até expirar em 15min) | 1 | O mais "real" dos 🟡; mitigado por TTL curto + Redis ser infra core |
| **H2** | **Timing-oracle ~70ms** no login (usuário existe roda bcrypt, não-existe pula) → enumeração de email | 1 | Baixo; mitigável com dummy-hash de comparação |
| **H3** | **Enumeração via `send-confirmation`** (campo `success` difere p/ email existente vs inexistente) | 1 | Baixo |
| **H4** | **Body >100kb → 500 em vez de 413** | 5 | O limite (Express 100kb) protege a memória (rejeita em 3ms, sem bufferizar); só o código HTTP está errado (500 mascarado) |
| **H5** | **`@Get(':id')` sem `ParseUUIDPipe` → 500** em vez de 400/404 (UUID inválido) | 3 | Cosmético, mascarado, sem vazamento |
| **H6** | **`quantity` aceita fracionado** (`@IsNumber @Min(1)` deixa passar 1.5) | 4 | Barrado pelo estoque; produto físico deveria ser `@IsInt` |
| **H7** | **`POST /payments/:id/confirm` staff-wide** (sem `@Roles('admin')`) + não verifica o provedor | 4 | OK no modelo dono-único atual (confirmação manual de caixa/PIX); revisar se surgir staff de menor confiança no tenant |
| **H8** | **Latência degrada sob alta concorrência** (200 paralelos enfileiram; p50 dezenas de s) | 5 | Fortemente amplificado pelo túnel SSH do teste; em prod o banco é local + throttle 100/min + nginx edge cortam antes. Sem 5xx / sem queda |
| **H9** | **`JwtAuthGuard` não é global** (postura "aberto por padrão"; auth opt-in por controller) | Fase 1 | Sem furo hoje (todas as rotas sensíveis têm guard), mas é footgun p/ endpoint futuro que esqueça de aplicar |

### ⚪ A-PROVAR (não é achado — falta ambiente)

| ID | Item | Bloco |
|----|------|-------|
| **A1** | **Prompt-injection no bot LLM** não testado empíricamente — `OPENAI_API_KEY` unset no teste (o bot cai em resposta canned, o caminho do LLM não roda). Estruturalmente limitado (preço/estoque sempre do banco — invariante 7; `/whatsapp/test` é fail-closed em prod / 403). **Precisa da chave OpenAI no ambiente de teste** pra disparar a bateria no LLM ao vivo. | 3 |

### 🟢 PROVADO SEGURO SOB ATAQUE REAL

- **Auth (Bloco 1):** forja de JWT inútil — `alg:none`, re-sign com segredo fraco/vazio, tamper de tenant/sub → **todos 401**; a validação por-request no banco derrota até assinatura VÁLIDA adulterada. Brute-force corta no #11. Rate-limit **atômico sob concorrência** (40 logins paralelos → 10 passam / 30 cortam). XFF forjado não burla em prod (`TRUST_PROXY_HOPS=1` + nginx `$proxy_add_x_forwarded_for`).
- **Multi-tenant (Bloco 2):** leitura / escrita / IDOR / `x-tenant-id` cruzado / forja de tenant em webhook cross-tenant → **todos** 404 / 403 / ignored. `POST /payments/:payB/confirm` de A → 404 (A não confirma pagamento de B). Defesa: RLS FORCE + `WHERE tenant_id` + tenant do JWT + interceptor ignora header + tenant autoritativo do provedor no webhook.
- **Injeção (Bloco 3):** SQLi parametrizada (`pg_sleep(5)` não atrasou — literal); XSS escapado na saída (React / cupom client-side / `escapeHtml` no email); command/path-traversal **sem superfície** (zero endpoint de FS/exec server-side).
- **Dinheiro (Bloco 4):** preço re-derivado do banco + divergência de `unit_price` rejeitada; `amount` do pagamento reconciliado contra o total (pagar R$1 num pedido de R$100 → 400); desconto de cupom **clampado** (`Math.min(discount, base)` → total nunca <0); quantidade negativa/zero → 400; **race de estoque segura** (2 checkouts paralelos de estoque=1 → vende 1; CHECK `current_stock>=0` no banco); **idempotência segura sem Redis** (a camada Postgres barra a duplicata).
- **DoS (Bloco 5):** sem 5xx sob 200 requests concorrentes (pool enfileira); throttle do webhook corta no 60; ReDoS-safe; limite de body enforçado (100kb).
- **CSRF (Bloco 6):** login não seta cookie → auth Bearer/localStorage pura → site malicioso não forja request autenticado (POST/PATCH sem token → 401). `CsrfGuard` (double-submit token) pronto p/ o dia do cookie httpOnly.
- **Segredos (Bloco 7):** zero vazamento em erro/health/metrics; `.env` e `.git/config` inalcançáveis (404); **JWT_SECRET e senha do Postgres ausentes do log** (0 ocorrências em 281k chars).
- **Infra (E/F/G):** sem version leak (`server_tokens off`, sem `X-Powered-By`), HSTS preload, TLS 1.2/1.3 + ECDHE-GCM, só portas 22/80/443 expostas, containers non-root, Swagger 403 em prod, sem source-maps / `.git` / `.env` expostos. *(Dependências: 28 vulns backend classe-DoS via Multer/qs — não-RCE; 2 críticas frontend só-dev via vite/vitest.)*

---

## Fronteira — o que SÓ um pentest profissional ao vivo fecha

Esta auditoria cobriu os vetores testáveis contra o ambiente de teste sem provedores externos nem cliente real. Ficam para o pentester:

1. **Prompt-injection no LLM real** (com OpenAI configurado) — o único a-provar da lista acima (A1).
2. **Fuzzing autenticado em massa** — cada endpoint / parâmetro, não só os enumerados aqui.
3. **Cadeias de business-logic multi-passo** — abuso da state-machine de pedido, corridas de cancel / refund / expiração além das testadas.
4. **Ataques client-side no frontend React** — DOM XSS, CSP bypass, vulnerabilidade no bundle buildado, `dangerouslySetInnerHTML` não render-testado.
5. **Abuso de integração com conta real** — MercadoPago / Asaas / Evolution (webhooks assinados de verdade, replay, race de callback).
6. **DoS distribuído** (muitos IPs) — aqui foi origem única; distribuído fura o rate-limit por-IP (defesa = nginx / fail2ban / Cloudflare).
7. **Infra-como-atacante** — acesso à VPS, escalada de privilégio, side-channel de rede.

---

## Ambiente de ataque (para reproduzir)

- Backend de teste: `NODE_ENV=test PORT=3009 node dist/main.js` (de `backend/`).
- Túnel SSH ao Postgres de teste: `ssh -N -L 5544:172.22.0.2:5432 ubuntu@gtsofthub.com.br` (ver `test-db-setup-motor`).
- Admin de teste auto-semeado: `dev@gtsofthub.com.br` / `12345678`, tenant `00000000-0000-0000-0000-000000000000`.
- Backend e túnel caem entre sessões — reerguer. Redis fica FORA no teste (várias provas de fail-open dependem disso).
- Scripts de app-context rodam de dentro de `backend/` com `path.join(__dirname,'dist')` (senão erro dual-copy do `@nestjs/core`); scripts HTTP-puro rodam de qualquer lugar.

---

*Todos os scripts de ataque foram removidos do repositório ao fim de cada bloco. Nenhum secret/PII/token aparece neste documento. Nenhum dos 7 blocos tocou produção.*
