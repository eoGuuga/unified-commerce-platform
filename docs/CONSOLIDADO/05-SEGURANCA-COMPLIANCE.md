# Seguranca e Compliance (Consolidado)

Ultima atualizacao: 2026-03-08

## Modelo de seguranca (aplicacao)
- Auth via JWT.
- Multi-tenant com RLS no Postgres usando app.current_tenant_id.
- TenantDbContextInterceptor abre transacao e seta contexto de tenant.
- Usuario do app sem superuser em producao (evita bypass de RLS).
- Rate limiting via Throttler.
- Idempotencia em pedidos.
- Audit log para operacoes criticas (documentado, precisa evidencia constante).

## Webhooks e CSRF
- Webhooks (WhatsApp e pagamentos) dependem de validacao de assinatura/token.
- CSRF guard existe e pode ser ativado via CSRF_ENABLED.
- Webhooks estao excluidos da validacao CSRF por design.
- Decisao pendente: quando ativar CSRF global no frontend.

## Seguranca de infraestrutura
- TLS ativo (HTTPS).
- UFW com portas 22/80/443.
- Fail2ban e hardening aplicados no servidor.
- Backups locais + offsite + restore drill mensal com logs.

## Segredos e dados sensiveis
- Segredos ficam em deploy/.env no servidor.
- Chaves criticas: JWT_SECRET, ENCRYPTION_KEY, MERCADOPAGO_*, WHATSAPP_*, OPENAI_*, RESEND_*.

## Riscos e pontos criticos (codigo)
- Login em producao com RLS: mitigado em codigo (2026-03-08) exigindo `x-tenant-id` no login e contexto RLS explicito no AuthService.
- Webhook WhatsApp em producao com RLS: mitigado em codigo (2026-03-08) com contexto RLS explicito no TenantsService.
- Pendente: validacao em producao com evidencias operacionais (gate final + logs).

## Compliance (estado atual)
- LGPD e termos ainda precisam de documentos oficiais.
- Politica de privacidade e termos de uso nao estao consolidados.
- Nao ha SLA formal publicado.

## Acoes recomendadas (curto prazo)
- Garantir SEED_DEV_USER=false em producao (seed apenas em dev/test).
- Definir fluxo oficial de tenant em login e webhooks em producao.
- Validar audit log e idempotencia com testes e evidencias repetiveis.
- Consolidar politicas legais (LGPD, privacidade, termos).

---

## Auditoria 2026-06-26 (backlog priorizado)

Varredura de codigo. Severidade: CRITICO (risco juridico/fraude) > ALTO > MEDIO.
Cada item vira tarefa de sprint. Marcar como resolvido com data + commit ao concluir.

### Verificado e OK (nao e problema)
- `.env` real **NAO esta versionado** no git (so `.env.example` e templates com placeholder). Confirmado `git ls-files`.
- Sem secrets reais commitados em historico (busca por chaves conhecidas: nada).
- Audit log de PII e idempotencia de pedidos existem.

### CRITICO
- [ ] **Webhook WhatsApp aceita sem assinatura quando secret ausente** — `whatsapp.controller.ts` (~L363). `if (secret && signature)` = fail-open. Tornar obrigatorio em prod (fail-closed).
- [ ] **Webhook MercadoPago bypass com token vazio** — `payments.service.ts` (~L741). Token ausente vira string vazia que casa com header vazio. Exigir token+assinatura em prod.
- [ ] **`/whatsapp/test` exposto sem guard** — `whatsapp.controller.ts` (~L467). Permite acionar o bot com `tenantId` arbitrario. Remover do build de prod ou exigir auth.
- [ ] **`/whatsapp/metrics` com API key opcional** — `whatsapp.controller.ts` (~L517). Em dev fica publico; risco de vazar analytics. Sempre exigir auth.
- [ ] **LGPD exclusao de dados e stub** — `lgpd.service.ts` so registra em memoria; nao apaga PII (Art. 18). Implementar exclusao real em cascata + trilha de auditoria.
- [ ] **Sem consentimento + politica de privacidade/termos** — coleta de dados de WhatsApp sem base legal registrada (Art. 7/8). Adicionar consentimento, `/privacy`, `/termos`.

### ALTO
- [ ] **Fallback de senha real no docker-compose.prod.yml** (L13/62/64): `${POSTGRES_PASSWORD:-password123}` e `${JWT_SECRET:-super-secret-jwt-key-123456789}`. Trocar por `${VAR:?obrigatorio}` para falhar se ausente. (Mitiga so se prod sempre define as vars — nao confiar nisso.)
- [ ] **Guard `JwtAuthGuardProd` com bypass por NODE_ENV** — `auth/guards/jwt-auth-prod.guard.ts`. Codigo morto perigoso; remover.
- [ ] **PIX com chave mock de fallback** — `payments.service.ts` (~L417) `mock-chave-pix-123456789`. Validar `PIX_KEY` no boot; falhar em prod se mock.
- [ ] **Idempotencia de webhook de pagamento ausente** — deduplicar retries do MercadoPago por `request_id` para evitar dupla confirmacao.
- [ ] **Cobertura de teste baixa / integration `continue-on-error`** — `.github/workflows/ci.yml`. Caminho de pagamento sem teste critico. Remover continue-on-error e cobrir fluxo de pagamento.

### MEDIO
- [ ] **`npm audit` com `continue-on-error`** no CI — pode shipar CVE alto. Falhar o CI; adicionar Dependabot.
- [ ] **Politica de retencao de dados** — conversas de WhatsApp guardadas indefinidamente. Definir retencao (ex.: conversas 6 meses, pedidos 5 anos).
- [ ] **186 usos de `any`** e monolito `whatsapp.service.ts` — divida tecnica; tipar e decompor incrementalmente.
