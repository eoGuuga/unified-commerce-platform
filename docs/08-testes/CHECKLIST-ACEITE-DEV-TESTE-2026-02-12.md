# Checklist de aceite DEV/TESTE - 2026-02-12

Objetivo: validar o fluxo E2E do WhatsApp no stack DEV/TESTE com evidencias claras.

## Pre-condicoes
- Repo DEV/TESTE atualizado em /opt/ucm-test-repo.
- Containers DEV/TESTE ativos e saudaveis.
- Tenant DEV ativo: 00000000-0000-0000-0000-000000000000.

## Checklist
- [ ] Health do DEV/TESTE retorna status ok.
- [ ] Pedido criado via WhatsApp/test e conversa inicia coleta.
- [ ] Coleta de dados concluida (nome, entrega, endereco, telefone, observacoes).
- [ ] Pedido confirmado e codigo gerado.
- [ ] PIX retornado com chave/copia e valor com desconto.
- [ ] Pagamento confirmado via endpoint /api/v1/payments/:id/confirm.
- [ ] DB confirma pagamento paid e pedido confirmado.

## Evidencias (preencher apos execucao)
- Health: URL + timestamp.
- Pedido: order_no.
- Pagamento: payment_id.
- Status final DB: paid + confirmado.

## Observacoes
- O endpoint /api/v1/whatsapp/test exige o campo "message".
- Para pix, usar o mesmo phoneNumber do fluxo.
