# Plano E2E - WhatsApp + PDV + Estoque

Data: 2026-02-11
Objetivo: validar fluxo completo sem regressao e sem overselling.

## Cenarios obrigatorios (E2E)
1) WhatsApp: pedido simples -> coleta de nome -> entrega -> endereco -> telefone -> confirmacao -> pagamento PIX.
2) WhatsApp: pedido multi-item -> retirada -> confirmacao -> pagamento cartao.
3) WhatsApp: cancelamento no meio do fluxo.
4) WhatsApp: cupom valido e cupom invalido.
5) WhatsApp: estoque insuficiente (bloqueio correto).
6) PDV: venda com estoque suficiente (abate correto).
7) PDV: venda com estoque insuficiente (bloqueio correto).
8) PDV: reserva e liberacao de estoque (carrinho).
9) Pagamento: webhook Mercado Pago confirma pedido.
10) Idempotencia: envio duplicado de confirmacao WhatsApp nao cria pedido duplicado.

## Dados minimos
- Produtos com estoque real (3 itens).
- Tenant valido com WhatsApp autorizado.
- Usuario admin para PDV.
- Cupom DEV10 ativo.

## Evidencias
- Log de pedido criado (order_no).
- Log de pagamento criado e confirmado.
- Estoque atualizado no banco.
- Resposta do bot consistente.

## Regressao rapida (diaria)
- Executar 1, 6, 9 e 10.
