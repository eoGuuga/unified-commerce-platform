# Checklist de aceite DEV/TESTE - 2026-02-13

Objetivo: validar o fluxo E2E do WhatsApp no stack DEV/TESTE com evidencias claras.

## Pre-condicoes
- Repo DEV/TESTE atualizado em /opt/ucm-test-repo.
- Containers DEV/TESTE ativos e saudaveis.
- Tenant DEV ativo: 00000000-0000-0000-0000-000000000000.

## Checklist
- [x] Health do DEV/TESTE retorna status ok.
- [x] Pedido criado via WhatsApp/test e conversa inicia coleta.
- [x] Coleta de dados concluida (nome, entrega, endereco, telefone, observacoes).
- [x] Pedido confirmado e codigo gerado.
- [x] PIX retornado com chave/copia e valor com desconto.
- [x] Pagamento confirmado via endpoint /api/v1/payments/:id/confirm.
- [x] DB confirma pagamento paid e pedido confirmado.

## Evidencias
- Deploy DEV/TESTE (pull + rebuild):
	- Health: https://dev.gtsofthub.com.br/api/v1/health (2026-02-14T00:44:02.915Z).
	- Health pre-E2E: https://dev.gtsofthub.com.br/api/v1/health (2026-02-14T01:07:14.267Z).
- Tentativa confirmacao PIX sem JWT valido: 401 Unauthorized (2026-02-14T01:08:54.435Z).
- Rodada 1:
	- Health: https://dev.gtsofthub.com.br/api/v1/health (2026-02-13T02:35:14.983Z).
	- Pedido: PED-20260213-A379.
	- Pagamento: a555b0e7-48c0-4c51-91c9-e347f9808ff0 (pix).
	- Status final DB: pagamento paid + pedido confirmado (2026-02-13 23:36:58.578213).
- Rodada 2 (final):
	- Pedido: PED-20260213-03DD.
	- Pagamento: 45169b55-d25a-42e3-8498-02b402227062 (pix).
	- Status final DB: pagamento paid + pedido confirmado (2026-02-14 00:00:13.259Z).
- Rodada 3 (ajuste estoque + pix):
	- Ajuste estoque: pedido solicitado 50, confirmado com 18 unidades.
	- Pedido: PED-20260214-189F.
	- Pagamento: c48d5dde-7eb0-4728-900b-21e029080485 (pix).
	- Status final DB: pagamento paid + pedido confirmado (2026-02-14 00:28:23.692Z).
- Rodada 4 (ajuste estoque + frete + pix):
	- Ajuste estoque: pedido solicitado 50, confirmado com 16 unidades.
	- Frete aplicado: 10.
	- Pedido: PED-20260214-60D2.
	- Pagamento: PIX gerado (aguardando confirmacao).

## Observacoes
- O endpoint /api/v1/whatsapp/test exige o campo "message".
- Para pix, usar o mesmo phoneNumber do fluxo.
