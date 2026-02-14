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

## Arquivos alterados
- backend/src/modules/whatsapp/whatsapp.service.ts
- backend/src/modules/whatsapp/types/whatsapp.types.ts
- backend/src/modules/whatsapp/services/conversation.service.ts
- backend/src/modules/orders/orders.service.ts
