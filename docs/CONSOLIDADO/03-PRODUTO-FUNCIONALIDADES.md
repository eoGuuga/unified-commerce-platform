# Produto e Funcionalidades (Consolidado)

Ultima atualizacao: 2026-02-16

## Resumo do produto
- SaaS multi-tenant para vendas omnichannel (WhatsApp + PDV + loja online).
- Foco em fluxo de pedido completo com estoque e pagamento.
- Admin para catalogo, estoque, pedidos e relatorios basicos.

## Fluxos principais (estado atual)
- WhatsApp: conversa com coleta de dados, confirmacao, geracao de PIX e confirmacao de pagamento (validado em DEV/TESTE).
- PDV: venda interna com criacao de pedido, lock de estoque (ACID) e status de pagamento.
- Loja/e-commerce: estrutura basica existe, checkout completo ainda pendente.
- Dashboard: basico funcional; avancado pendente.

## Modulos e funcionalidades (backend)
- Auth: login, register, me (JWT).
- Tenants: isolamento por tenant + RLS no banco.
- Products: list/search/detail/create/update/delete, ajustes e resumo de estoque.
- Orders: create/list/detail, status, relatorios de vendas.
- Payments: Mercado Pago (pix, credito, debito, boleto) + webhook + confirmacao; dinheiro como metodo offline.
- WhatsApp: webhook, health, endpoint de teste para fluxo.
- Health: health/live/ready.

## Frontend (status)
- PDV funcional com fluxo de venda basico.
- Admin basico (produtos, pedidos, estoque).
- Loja com paginas base; checkout completo pendente.

## Integracoes
- Pagamentos: Mercado Pago (provider principal) + mock (dev).
- WhatsApp: Twilio ou Evolution API (configuravel por env).
- IA: OpenAI ou Ollama (opcional, por env).
- Email: Resend (por env).

## Pendencias de produto (alto nivel)
- E-commerce completo: carrinho, checkout, UX final e pagamentos consistentes.
- Dashboard avancado: relatorios completos, clientes, exportacao.
- Refinos de UX no PDV e loja (mensagens, estados de erro, latencia).
- Observabilidade do fluxo de pagamento e notificacoes no WhatsApp.

## Notas de consistencia
- Docs antigos citam Stripe e Supabase; estado atual usa Mercado Pago e Postgres local.
- Alguns valores e planos comerciais sao legados e precisam de revisao antes de uso.
