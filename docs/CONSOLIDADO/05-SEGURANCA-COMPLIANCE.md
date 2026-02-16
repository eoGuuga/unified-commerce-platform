# Seguranca e Compliance (Consolidado)

Ultima atualizacao: 2026-02-16

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
- Login em producao pode falhar com RLS se tenant nao vier do JWT.
- Webhook WhatsApp em producao pode falhar com RLS se tenant nao for resolvido.
- Necessario definir abordagem oficial para tenant em webhooks e login prod.

## Compliance (estado atual)
- LGPD e termos ainda precisam de documentos oficiais.
- Politica de privacidade e termos de uso nao estao consolidados.
- Nao ha SLA formal publicado.

## Acoes recomendadas (curto prazo)
- Definir fluxo oficial de tenant em login e webhooks em producao.
- Validar audit log e idempotencia com testes e evidencias repetiveis.
- Consolidar politicas legais (LGPD, privacidade, termos).
