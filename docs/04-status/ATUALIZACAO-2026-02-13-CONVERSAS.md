# Atualizacao Conversas WhatsApp - 2026-02-13

Contexto: conversas antigas em waiting_payment podiam interferir em novos pedidos e pular etapas de coleta.

## O que foi feito
- Limpeza automatica de conversas antigas (active/waiting_payment) por TTL.
- Prioridade mais segura: conversa active em coleta so vence se estiver recente.
- Mantem waiting_payment quando existe pedido pendente valido.

## Parametros (env)
- WHATSAPP_CONVERSATION_TTL_HOURS (padrao: 12)
- WHATSAPP_ACTIVE_GRACE_MINUTES (padrao: 30)

## Arquivo alterado
- backend/src/modules/whatsapp/services/conversation.service.ts

## Resultado esperado
- Conversas antigas nao atrapalham o inicio de novos pedidos.
- Selecao de pagamento sempre encontra o pedido pendente atual.

## Ajustes adicionais (qualidade WhatsApp)
- Estoque insuficiente agora permite confirmar quantidade disponivel ou informar outra quantidade valida.
- Endereco informado sem escolha explicita assume entrega, aplica frete default e faz parse mais robusto.
- Confirmacao de endereco nao exibe campos vazios (numero/complemento).
- Selecao de pagamento por fallback usa ultimo pedido pendente do mesmo telefone.
- Novo pedido durante confirmacao ou pagamento reinicia o fluxo de forma segura.
- Idempotencia do WhatsApp considera cada novo intento de pedido, evitando reuso de pedido antigo.

## Validacao
- Ajuste de estoque confirmou 18 unidades a partir de pedido de 50.
- Pagamento confirmado (paid) para PED-20260214-189F.
- Ajuste de estoque confirmou 16 unidades e frete aplicado no fluxo de entrega.
- PIX gerado para PED-20260214-60D2 (aguardando confirmacao).
- Deploy DEV/TESTE aplicado e health OK (2026-02-14T00:44:02.915Z).
- DEV/TESTE atualizado via git pull --ff-only (25c15fb..b1be483).
- DEV/TESTE atualizado via git pull --ff-only (b1be483..dfd3cf3).
- DEV/TESTE atualizado via git pull --ff-only (dfd3cf3..c7201c2).
- DEV/TESTE atualizado via git pull --ff-only (c7201c2..029d033).

## Arquivos alterados
- backend/src/modules/whatsapp/whatsapp.service.ts
- backend/src/modules/whatsapp/types/whatsapp.types.ts
- backend/src/modules/whatsapp/services/conversation.service.ts
- backend/src/modules/orders/orders.service.ts
