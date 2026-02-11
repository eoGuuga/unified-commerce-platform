# Revisao Brutal - WhatsApp + PDV + Estoque

Data: 2026-02-11
Escopo: fluxo completo WhatsApp -> pedido -> pagamento -> estoque + PDV

## O que esta forte (pontos positivos)
- ACID e lock de estoque na criacao de pedido (evita overselling).
- Idempotencia em pedido e fluxo WhatsApp.
- Cupons validam no backend e protegem contra corrida.
- Webhooks e pagamentos com validacao de assinatura/token.

## Riscos e falhas criticas
1) Preco de item vindo do cliente (corrigido em 2026-02-11).
2) Reserva de estoque nao atomica (corrigido em 2026-02-11).
3) Seed dev em producao possivel se env errada (corrigido em 2026-02-11).
4) CSRF sem fluxo real de token para webhooks (corrigido em 2026-02-11).

## Gaps de produto/fluxo
- WhatsApp: falta consolidar fluxo completo com confirmacao + dados obrigatorios (documentado, mas precisa E2E real repetido).
- PDV: validar UX de erro e feedback em todos os estados de pagamento/estoque.
- E-commerce: checkout basico, sem validacoes profundas e sem UX premium.

## Recomendacao brutal
- Tratar o fluxo WhatsApp como o core do produto: testado E2E diariamente.
- Garantir que qualquer valor sensivel (preco/frete/desconto) seja calculado no backend.
- Fechar o ciclo de observabilidade (logs + alertas) para falhas de pagamento e estoque.
