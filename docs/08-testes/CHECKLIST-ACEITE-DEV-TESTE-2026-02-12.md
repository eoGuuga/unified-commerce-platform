# Checklist de aceite DEV/TESTE - 2026-02-12

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

## Evidencias (preencher apos execucao)
- Health: https://dev.gtsofthub.com.br/api/v1/health (2026-02-13T02:05:43.860Z).
- Pedido: PED-20260213-816B.
- Pagamento: e27fea30-22c7-4ea2-887d-604fd8750ea5 (pix).
- Status final DB: pagamento paid + pedido confirmado (2026-02-13 02:14:34.043365).

## Evidencias adicionais (rodada 2)
- Health: https://dev.gtsofthub.com.br/api/v1/health (2026-02-13T02:35:08.120Z).
- Pedido: PED-20260213-7CB3.
- Pagamento: 88404300-a6d3-436f-b032-9efb20da802c (pix).
- Status final DB: pagamento paid + pedido confirmado (2026-02-13 02:37:31.555177).

## Observacoes
- O endpoint /api/v1/whatsapp/test exige o campo "message".
- Para pix, usar o mesmo phoneNumber do fluxo.
