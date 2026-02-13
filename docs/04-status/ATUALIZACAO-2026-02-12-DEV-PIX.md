# Atualizacao DEV WhatsApp PIX - 2026-02-12

Contexto: no DEV, a selecao de pagamento (ex.: "pix") estava criando uma conversa nova (status active) e perdendo o pedido pendente, gerando a resposta "Nao encontrei um pedido pendente para pagamento".

## Diagnostico
- Logs do backend mostraram que o fluxo criou o pedido e marcou a conversa como waiting_payment.
- Na mensagem "pix", o sistema buscou apenas conversas com status active, entao criou outra conversa nova e perdeu o pedido.
- Confirmado no banco: duas conversas no mesmo telefone, uma waiting_payment com pedido_id e outra active vazia.

## Correcao aplicada
- Ajustada a busca de conversa para priorizar status waiting_payment antes de active.
- Resultado esperado: selecao de pagamento reutiliza a conversa correta e encontra o pedido pendente.

## Arquivo alterado
- backend/src/modules/whatsapp/services/conversation.service.ts

## Proximos passos
- Atualizar o backend DEV no VPS e reprocessar "pix" no mesmo chat.
- Opcional: finalizar a conversa active criada indevidamente para evitar confusao futura.

## Observacao de teste
- O endpoint /api/v1/whatsapp/test espera o campo "message" (nao "body").
- Exemplo (DEV/TESTE):
	curl -s -X POST https://dev.gtsofthub.com.br/api/v1/whatsapp/test -H "Content-Type: application/json" -d '{"message":"pix","tenantId":"00000000-0000-0000-0000-000000000000","phoneNumber":"+5511998887790"}'

## Validacao DEV/TESTE (2026-02-12)
- Fluxo completo executado: pedido -> dados -> confirmacao -> pix.
- Pedido gerado: PED-20260213-816B.
- Resposta PIX retornou chave e valor com desconto (R$ 39,88).
- Conversa final em waiting_payment com pedido_id 23633cd1-9452-41c2-92f1-3a3613c0d74e.
