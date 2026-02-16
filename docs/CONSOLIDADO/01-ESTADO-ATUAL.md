# Estado Atual (Consolidado)

Status: ATUALIZADO
Ultima atualizacao: 2026-02-16

## Snapshot (codigo + docs mais recentes)
- Backend operacional com RLS, idempotencia, audit log, cache e health checks.
- WhatsApp: fluxo com coleta, confirmacao e pagamento PIX validado em DEV/TESTE.
- Pagamentos: Mercado Pago como provider principal (pix, credito, debito, boleto) + webhook; dinheiro como metodo offline.
- Frontend: PDV funcional; loja e dashboard em evolucao.
- Infra: producao hardened e DEV/TESTE isolado no VPS.

## Ambientes e dominios
- Producao: https://gtsofthub.com.br (stack em /opt/ucm).
- DEV/TESTE: https://dev.gtsofthub.com.br (stack em /opt/ucm-test-repo).
- Compose DEV/TESTE: `deploy/docker-compose.test.yml` (stack completo) e `deploy/docker-compose.dev.yml` (DB/Redis 24/7).

## Evidencias recentes (DEV/TESTE)
- 2026-02-13 e 2026-02-14: E2E WhatsApp PIX validado com pedidos e pagamentos confirmados.
- Exemplos: PED-20260213-A379, PED-20260213-03DD, PED-20260214-189F.

## Achados criticos da analise de codigo (sem alteracoes)
1. Webhook WhatsApp em producao pode falhar com RLS.
   Motivo: interceptor nao aceita tenant por header/body em prod e webhook nao usa JWT.
   Impacto: TenantsService.findOneById pode retornar vazio quando RLS estiver ativo.
2. Login em producao pode falhar com RLS.
   Motivo: /auth/login em prod nao seta tenant e interceptor ignora header/body.
   Impacto: query de usuarios pode retornar vazio quando RLS estiver ativo.

## Inconsistencias documentais
- Muitos docs antigos citam Stripe e Supabase, mas o codigo atual usa Mercado Pago e Postgres local.
- Status de fases varia entre 2025 e 2026; usar este consolidado como fonte de verdade.
- Alguns valores de custos (taxas de pagamento) parecem desatualizados.
- Documentacao antiga foi movida para docs/LEGADO.

## Pendencias de produto (alto nivel)
- E-commerce completo (checkout + fluxo de pagamento).
- Dashboard avancado (relatorios, clientes, exportacao).
- Refinos de UX no PDV e loja.
