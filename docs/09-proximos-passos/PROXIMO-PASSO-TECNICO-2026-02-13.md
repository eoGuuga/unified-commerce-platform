# Proximo passo tecnico - 2026-02-13

## Objetivo
Melhorar estabilidade do fluxo WhatsApp em cenarios com conversas antigas.

## Escopo (fase 1)
1) Limpeza automatica de conversas antigas (active/waiting_payment) apos janela de inatividade.
2) Refinar confirmacao para evitar pular etapas quando existe conversa anterior.

## Entregas
- Job simples (script) para finalizar conversas inativas acima de X horas.
- Ajuste de prioridade: preferir conversa em estado de coleta ativa apenas se ela for mais recente que waiting_payment.
- Documentacao e evidencias de teste.

## Validacao
- E2E WhatsApp com conversa antiga nao interfere em novo pedido.
- Selecionar pix sempre encontra o pedido pendente atual.

## Observacoes
- Implementar apenas em DEV/TESTE primeiro.
- Revisar impacto em producao depois do aceite no DEV/TESTE.
