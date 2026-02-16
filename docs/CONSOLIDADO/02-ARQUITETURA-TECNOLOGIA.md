# Arquitetura e Tecnologia (Consolidado)

Ultima atualizacao: 2026-02-16

## Estrutura do repo
- backend/
- frontend/
- deploy/
- scripts/
- docs/

## Backend (NestJS + TypeORM)
- Modulos principais: auth, products, orders, payments, whatsapp, tenants, health, common.
- DbContextService e TenantDbContextInterceptor para transacoes e RLS.
- IdempotencyService, CacheService, AuditLogService.
- PaymentsService usa provider mercadopago (principal) ou mock (dev).
- Metodos de pagamento: pix, credito, debito, boleto, dinheiro (offline).
- WhatsappService com ConversationService e providers (twilio/evolution).

## Banco de dados (PostgreSQL)
- RLS ativado com app.current_tenant_id.
- Transacoes ACID com FOR UPDATE no fluxo de pedido.
- Migrations em scripts/migrations/*.sql.

## Frontend (Next.js)
- App Router com paginas /, /info, /pdv, /admin, /admin/estoque, /loja, /login.
- JWT usado no cliente e no api-client.

## Infra e deploy
- Docker Compose para prod e dev.
- Nginx como reverse proxy para frontend e backend.
- Redis para cache.

## Integracoes
- Pagamentos: Mercado Pago (pix, credito, debito, boleto) + mock (dev).
- WhatsApp: Twilio ou Evolution API.
- IA: OpenAI ou Ollama via env.
- Email: Resend via env.

## Variaveis e flags chave
- ALLOW_TENANT_FROM_REQUEST
- CSRF_ENABLED e headers CSRF
- MERCADOPAGO_* (access token, public key, webhook)
- WHATSAPP_PROVIDER e credenciais
- OPENAI_* (ou OLLAMA)
- FRONTEND_URL e CORS_ORIGINS
