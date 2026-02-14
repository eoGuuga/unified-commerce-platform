# Relatorio E2E DEV/TESTE - WhatsApp PIX - 2026-02-13

## Objetivo
Validar o fluxo completo do WhatsApp no DEV/TESTE: pedido -> coleta de dados -> confirmacao -> PIX -> confirmacao de pagamento.

## Ambiente
- Dominio DEV: https://dev.gtsofthub.com.br
- Tenant: 00000000-0000-0000-0000-000000000000
- Stack: /opt/ucm-test-repo (docker-compose.test.yml)

## Execucao
1) Health OK.
2) Pedido criado e coleta de dados concluida.
3) Pedido confirmado e PIX retornado.
4) Pagamento confirmado via endpoint.
5) Banco confirmou pagamento paid e pedido confirmado.

## Evidencias
- Health pre-E2E: https://dev.gtsofthub.com.br/api/v1/health (2026-02-14T01:07:14.267Z)
- Tentativa confirmacao PIX sem JWT valido (esperado 401): /api/v1/payments/PAGAMENTO_ID/confirm (2026-02-14T01:08:54.435Z)
- Tentativa confirmacao PIX sem JWT valido (esperado 401): /api/v1/payments/PAGAMENTO_ID/confirm (2026-02-14T01:09:52.091Z)
- Deploy DEV/TESTE (pull + rebuild):
	- Health: https://dev.gtsofthub.com.br/api/v1/health (2026-02-14T00:44:02.915Z)
- Rodada 1:
	- Health: https://dev.gtsofthub.com.br/api/v1/health (2026-02-13T02:35:14.983Z)
	- Pedido: PED-20260213-A379
	- Pagamento: a555b0e7-48c0-4c51-91c9-e347f9808ff0 (pix)
	- Status final DB: pagamento paid + pedido confirmado (2026-02-13 23:36:58.578213)
- Rodada 2 (final):
	- Pedido: PED-20260213-03DD
	- Pagamento: 45169b55-d25a-42e3-8498-02b402227062 (pix)
	- Status final DB: pagamento paid + pedido confirmado (2026-02-14 00:00:13.259Z)
- Rodada 3 (ajuste estoque + pix):
	- Ajuste estoque: solicitado 50, confirmado com 18 unidades.
	- Pedido: PED-20260214-189F
	- Pagamento: c48d5dde-7eb0-4728-900b-21e029080485 (pix)
	- Status final DB: pagamento paid + pedido confirmado (2026-02-14 00:28:23.692Z)
- Rodada 4 (ajuste estoque + frete + pix):
	- Ajuste estoque: solicitado 50, confirmado com 16 unidades.
	- Frete aplicado: 10.
	- Pedido: PED-20260214-60D2
	- Pagamento: PIX gerado (aguardando confirmacao)

## Resultado
- E2E DEV/TESTE concluido com sucesso e sem falhas.
- Fluxo WhatsApp PIX validado end-to-end (rodada final com pagamento confirmado).
