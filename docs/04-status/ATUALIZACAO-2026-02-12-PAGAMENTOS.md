# Atualizacao Pagamentos + Notificacoes - 2026-02-12

Contexto: reforcar fluxo de pagamentos e mensagens de acompanhamento, evitando duplicidade no WhatsApp.

## O que foi feito
- Notificacao de pagamento pendente adicionada para canais nao-WhatsApp (PDV/E-commerce).
- Evita duplicar mensagens no fluxo WhatsApp, que ja retorna instrucoes no bot.

## Impacto
- Clientes de PDV/E-commerce recebem lembrete de pagamento quando aplicavel.
- Fluxo WhatsApp permanece consistente, sem mensagens duplicadas.

## Arquivos alterados
- backend/src/modules/payments/payments.service.ts

## Proximos passos
- Avaliar agendamento de lembretes recorrentes (ex.: 30/60 min) para pendentes.
- Integrar monitoramento de webhooks do provider com alertas de falha.
