# Comercial e Go-To-Market (Consolidado)

Ultima atualizacao: 2026-02-16

## Posicionamento
- Produto omnichannel para pequenos negocios que vendem via WhatsApp e precisam controlar estoque e pagamento.
- Valor central: reduzir trabalho manual, evitar overselling e acelerar conversao.

## Publico alvo (base docs)
- Micro e pequenos negocios (confeitaria, lojas locais, food, artesanato).
- Operacao com alto volume de pedidos por WhatsApp e controle manual de estoque.

## Proposta de valor (resumo)
- Pedido completo via conversa (WhatsApp).
- PDV interno simples e rapido.
- Estoque consistente com lock e RLS.
- Pagamento integrado (PIX e outros metodos via Mercado Pago).

## Modelo comercial (pendente de definicao)
- Planos e precos ainda nao consolidados.
- Docs legados possuem valores de 2024 e nao devem ser usados sem revisao.
- Prioridade: alinhar precos com custos reais (Mercado Pago) e validar valores oficiais da Stripe (plano real).
- Observacao: Stripe nao esta integrada no backend atual; valores abaixo sao referencia comercial.

## Custos de pagamento (referencia 2026-02-16)
Observacao: taxas variam por produto, prazo de recebimento e podem ser negociadas. Validar no site oficial antes de fechar precos.

### Mercado Pago (Checkout - BR)
| Metodo | Recebimento | Taxa |
| --- | --- | --- |
| PIX | na hora | 0,99% |
| Boleto | ate 3 dias | R$ 3,49 |
| Cartao de credito | 30 dias | 3,98% |
| Cartao de credito | 14 dias | 4,49% |
| Cartao de credito | na hora | 4,98% |
| Saldo Mercado Pago / Linha de credito | 30 dias | 3,99% |
| Saldo Mercado Pago / Linha de credito | 14 dias | 4,49% |
| Saldo Mercado Pago / Linha de credito | na hora | 4,99% |
| Debito virtual Caixa | na hora | 3,99% |
| Open Finance | na hora | gratis |
Fonte: tabela de taxas do Checkout no Mercado Pago (site oficial).

### Stripe (Brasil - padrao)
- Cartoes nacionais: 3,99% + R$ 0,39 por transacao.
- Cartoes internacionais: adicional de 2% sobre a taxa base.
- Boleto: R$ 3,45 por boleto pago.
- PIX: 1,19% (disponivel apenas via convite).
Fonte: pagina de precos da Stripe Brasil (site oficial).

## Go-to-market (base docs)
- Validacao com cliente beta real antes de escala.
- Metas iniciais: 5-10 clientes pagantes apos fase beta.
- Foco em provas de valor (casos reais, ROI, reducao de erros).

## Materiais comerciais a consolidar
- One-pager e pitch deck.
- Pagina de precos (com calculadora simples).
- Casos de uso e depoimentos.
- FAQ de produto e pagamento.

## Pendencias criticas
- Definir precos e limites por plano.
- Formalizar SLA e politicas (privacidade, termos).
- Atualizar toda referencia a Stripe/Supabase nos docs legados.
