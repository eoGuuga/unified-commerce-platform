# Checklist de Aceite - Perfeito (2026-02-11)

## Infra/Operacao (prod)
- [x] Git pull aplicado em /opt/ucm
- [x] Backup manual executado
- [x] Migrations executadas com script idempotente
- [x] Build e deploy realizados (docker compose --build)
- [x] Nginx validado e recarregado
- [x] Health checks 200 (/, /health, /health/live, /health/ready)
- [x] Redirect www -> raiz OK

## Backend
- [x] Preco validado no backend (nao confia no cliente)
- [x] Reserva/liberacao de estoque atomicas
- [x] Seed dev bloqueado em producao
- [x] CSRF com endpoint dedicado e excecoes para webhooks
- [x] NestJS v11 aplicado com lockfile atualizado

## Frontend
- [x] Next atualizado para 16.1.6
- [x] Lockfile atualizado

## Testes
- [x] Unit + integration + ACID (dev/test)
- [x] WhatsApp E2E (dev/test)

## Documentacao
- [x] Atualizacao de producao registrada
- [x] Relatorio executivo atualizado
- [x] One-pager atualizado
- [x] Indice atualizado

## Pendencias (produto)
- [ ] Fluxo completo do WhatsApp (coleta/confirmacao)
- [ ] E-commerce e dashboard avancado
