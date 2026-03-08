# Estado Atual (Consolidado)

Status: ATUALIZADO
Ultima atualizacao: 2026-03-08

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
- 2026-02-22: testes backend (unit/integration/acid) PASS.
- 2026-02-22: /api/v1/whatsapp/test validado (pedido preparado).

## Achados criticos da analise de codigo (status)
1. Webhook WhatsApp com RLS em producao.
   Status: mitigado no codigo em 2026-03-08.
   Ajuste: TenantsService.findOneById agora seta `app.current_tenant_id` em transacao.
   Proximo passo: validar em producao com evidencias.
2. Login com RLS em producao.
   Status: mitigado no codigo em 2026-03-08.
   Ajuste: login requer `x-tenant-id` e AuthService seta `app.current_tenant_id` no fluxo de login.
   Proximo passo: validar em producao com evidencias.

## Inconsistencias documentais
- Muitos docs antigos citam Stripe e Supabase, mas o codigo atual usa Mercado Pago e Postgres local.
- Status de fases varia entre 2025 e 2026; usar este consolidado como fonte de verdade.
- Alguns valores de custos (taxas de pagamento) parecem desatualizados.
- Documentacao antiga foi movida para docs/LEGADO.

## Pendencias de produto (alto nivel)
- E-commerce completo (checkout + fluxo de pagamento).
- Dashboard avancado (relatorios, clientes, exportacao).
- Refinos de UX no PDV e loja.

## Melhorias recentes (2026-02-22)
- WhatsApp: selecao de produto prioriza SKU, estoque disponivel e mais recente em caso de duplicados.
- Scripts: limpeza de duplicados e produtos de teste antigos no DEV/TESTE.
