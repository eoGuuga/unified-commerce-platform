# 🧭 PLAYBOOK DA PERFEIÇÃO (Ordem Oficial) — Setup • Segurança • Testes • Escala • Produção

> **Objetivo:** um roteiro único, **executável e auditável**, para manter o UCM **confiável, estável, seguro e vendável** em escala.
>
> **Como usar:** siga as fases na ordem. Cada fase tem **gates (critérios de aprovação)** e **comandos/scripts**.
>
> **Documentos-fonte (referência):**
> - `docs/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md`
> - `docs/INDICE-DOCUMENTACAO.md`
> - `docs/05-correcoes/REVISAO-COMPLETA-SEGURANCA-E-PERFORMANCE.md`
> - `docs/08-testes/RELATORIO-TESTES-SEGURANCA-COMPLETO.md`
> - `docs/02-implementacao/ROADMAP-EXECUCAO-PERFEITA.md`

---

## ✅ Definição prática de “PERFEIÇÃO”

“Perfeito”, aqui, significa:

- **Confiável**: não duplica pedido, não perde estoque, não “crasha” silenciosamente.
- **Seguro**: isolamento multi-tenant garantido, segredos protegidos, superfícies expostas minimizadas.
- **Testável**: bateria de testes e scripts repetíveis; regressões detectadas rápido.
- **Operável**: health checks, logs úteis, rollback possível, incidentes diagnosticáveis.
- **Escalável**: consegue crescer com previsibilidade (DB, cache, filas, integrações, multi-tenancy).

Se um item acima não é verificável por **gate**, não é perfeito — é opinião.

---

## 📌 Verdades do sistema (não negociáveis)

- **ZERO overselling** é o core: transações ACID + locks (`FOR UPDATE`) e validações.
- **Multi-tenancy** deve ser defendido em camadas:
  - **Aplicação**: `tenant_id` vindo do contexto autenticado (não de query string).
  - **Banco**: RLS + policies + testes.
- **Sem segredos em repo**: `.env` nunca pode ser commitado; segredos precisam rotacionar.
- **Erros 5xx não devem vazar detalhes** em produção (stack/DB/paths internos).

---

## 🧱 FASE 0 — Setup 100% reprodutível (dev)

### 0.1 Rodar ambiente (docker + deps)

**Recomendado (automático):**

```powershell
.\scripts\INICIAR-AMBIENTE.ps1
# OU usar wrapper na raiz (compatibilidade): .\INICIAR-AMBIENTE.ps1
.\setup.ps1
```

### 0.2 Variáveis obrigatórias (mínimo saudável)

**Backend (`backend/.env`)**
- `DATABASE_URL`
- `JWT_SECRET` (**32+ chars aleatórios**)
- `ENCRYPTION_KEY` (**32+ chars aleatórios, estável**)
- `FRONTEND_URL` (principalmente para produção por causa de CORS)

**Frontend (`frontend/.env.local`)**
- `NEXT_PUBLIC_API_URL` (ex.: `http://localhost:3001/api/v1`)

### 0.3 Gates (passa/não passa)

- [ ] Docker “up” com Postgres/Redis saudáveis
- [ ] Backend sobe sem erro
- [ ] `GET /api/v1/health` retorna `200` e status ok
- [ ] Swagger abre em `/api/docs`

---

## 🔐 FASE 1 — Segurança base (hardening)

### 1.1 Autenticação e segredos

- **JWT_SECRET**: obrigatório e **não pode ser placeholder**.
- **ENCRYPTION_KEY**: obrigatório e **não pode ser placeholder**.
  - Observação crítica: se você trocar a `ENCRYPTION_KEY`, você pode **perder a capacidade de descriptografar** chaves já armazenadas.

### 1.2 Isolamento multi-tenant

Gates:
- [ ] Controllers/Services não aceitam `tenantId` por query string como fonte de verdade (somente do contexto autenticado/decorator).
- [ ] **RLS habilitado** nas tabelas críticas e policies existentes.
- [ ] Teste automatizado/script valida que tenant A não enxerga tenant B.

### 1.3 CSRF (quando habilitar)

Vocês já têm `CsrfGuard`/`CsrfService` documentados, mas o gate é:
- [ ] Frontend envia token CSRF em POST/PUT/PATCH/DELETE
- [ ] Backend valida token e **recusa** sem token
- [ ] Cookies com flags corretas (`HttpOnly`, `Secure` em produção, `SameSite` coerente)

> Nota: CSRF só faz sentido quando você usa cookies/sessão com envio automático pelo browser. Se usar apenas `Authorization: Bearer`, o risco muda, mas ainda pode existir dependendo do modelo.

### 1.4 Rate limiting (proteção contra abuso)

Gates:
- [ ] Rate limiting global ativo
- [ ] Endpoints sensíveis com política **mais restrita** (ex.: `login`, `register`)
- [ ] Headers de rate limit visíveis (quando aplicável)

### 1.5 Superfície exposta (infra)

Gates:
- [ ] Serviços locais expostos apenas em `127.0.0.1` (dev)
- [ ] Nada crítico publicado sem autenticação (Adminer/Redis UI só em ambiente controlado)
- [ ] CORS em produção só libera origins explícitas

---

## 🧪 FASE 2 — Testes (ordem oficial)

### 2.1 Smoke / Health (primeiro)

```powershell
curl http://localhost:3001/api/v1/health
```

Gate:
- [ ] health ok + DB ok + Redis ok

### 2.2 Testes automatizados do projeto (scripts)

**Segurança (prioridade máxima):**

```powershell
.\scripts\test\test-seguranca-completo.ps1
```

Gate:
- [ ] 100% dos testes críticos passam
- [ ] Avisos têm item de ação (não fica “pra depois” sem dono)

**Teste completo (backend + frontend):**
- Siga `docs/08-testes/TESTE-COMPLETO.md`.

### 2.3 Testes unitários e integração (backend)

```powershell
cd backend
npm run test
npm run test:integration
```

Gates:
- [ ] unit: verde
- [ ] integração: verde
- [ ] cobertura mínima definida (e documentada) para módulos críticos (Orders/Products/Auth)

### 2.4 Gates críticos (negócio)

- **Idempotência**: mesma `Idempotency-Key` não pode criar 2 pedidos.
- **ACID / race**: 2 vendas simultâneas não podem causar overselling.
- **Audit log**: operações críticas geram registro auditável.
- **WhatsApp tenant validation**: tenant inválido deve retornar erro **controlado** (não 500 genérico).

---

## 📈 FASE 3 — Escalabilidade e performance (sem perder segurança)

### 3.1 Banco (Postgres)

Gates:
- [ ] Índices presentes para queries frequentes
- [ ] Timeouts configurados (`statement_timeout`, `query_timeout`)
- [ ] Plano de backup/restore (mesmo em dev: instrução clara)

### 3.2 Cache (Redis)

Gates:
- [ ] Cache tem TTL definido e invalidação nos eventos corretos (produto/estoque/pedido)
- [ ] Cache não quebra o sistema: se Redis cair, o sistema segue (com degradação controlada)

### 3.3 Integrações externas (WhatsApp/Pagamento/IA)

Gates:
- [ ] Timeouts e tratamento de erro consistente
- [ ] Retentativas (retry) com backoff onde fizer sentido
- [ ] Circuit breaker (quando o serviço externo instabilizar) — evita “derrubar” o core

---

## 🛰️ FASE 4 — Operação (observabilidade e incidentes)

### 4.1 Logs

Gates:
- [ ] Logs com correlação (request id / trace id)
- [ ] Sem dados sensíveis em log (senha, tokens, chaves)
- [ ] Erros 5xx logados com contexto suficiente para diagnosticar sem expor ao cliente

### 4.2 Health / readiness / liveness

Gates:
- [ ] `health` = visão do sistema
- [ ] `ready` = pronto para receber tráfego (dependências ok)
- [ ] `live` = processo vivo (não confundir com “saudável”)

### 4.3 Runbooks (procedimentos)

Gates:
- [ ] “O que fazer quando…” (DB down, Redis down, spike de 429, fila de mensagens, etc.)
- [ ] Procedimento de rollback (código + banco)

---

## 🚀 FASE 5 — Produção (release com confiança)

### 5.1 Checklist de pré-release

- [ ] Secrets configurados no ambiente (não em arquivo)
- [ ] CORS/FRONTEND_URL corretos
- [ ] Migrações versionadas + aplicadas de forma controlada
- [ ] Testes verdes (unit + integração + scripts de segurança)
- [ ] Monitoramento mínimo habilitado (logs + health)

### 5.2 Pós-release (primeira hora)

- [ ] Acompanhar erros 5xx
- [ ] Acompanhar latência p95/p99
- [ ] Acompanhar taxa de pedidos/estoque e validação de overselling (deve ser 0)

---

## 🧭 Ordem recomendada de leitura (quando alguém “novo” chega)

1. `docs/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md`
2. `docs/INDICE-DOCUMENTACAO.md`
3. `docs/05-correcoes/REVISAO-COMPLETA-SEGURANCA-E-PERFORMANCE.md`
4. `docs/08-testes/RELATORIO-TESTES-SEGURANCA-COMPLETO.md`
5. `docs/08-testes/TESTE-COMPLETO.md`
6. Este playbook (`docs/00-projeto/00-PLAYBOOK-PERFEICAO.md`)

---

## ⚠️ Nota importante (consistência de documentação vs código)

Alguns documentos (ex.: `docs/01-tecnico/07-SECURITY.md`) descrevem fluxo com Supabase/Auth/cookies como referência arquitetural.
O **gate de perfeição** é: “o que está em produção” precisa estar documentado como **fonte de verdade**.

Recomendação: manter neste playbook a **fonte de verdade operacional** (o que o sistema realmente faz hoje), e manter os demais como “plano/visão” quando divergirem.

