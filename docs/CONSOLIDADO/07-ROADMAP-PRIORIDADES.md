# Roadmap e Prioridades (Consolidado)

Ultima atualizacao: 2026-02-16

## Prioridade 0 - Estabilidade e seguranca
- Resolver tenant em login e webhooks em producao (RLS).
- Padronizar e documentar DEV/TESTE (nome do compose e scripts).
- Evidencias recorrentes: audit log, idempotencia, RLS, backups.

## Prioridade 1 - MVP produto que vende
- Fechar e-commerce completo (catalogo, carrinho, checkout, pagamento, estados de erro).
- Completar dashboard avancado (relatorios, clientes, exportacao).
- Refinar UX do PDV e WhatsApp (mensagens e retomada de fluxo).

## Prioridade 2 - Escala e eficiencia
- Onboarding multi-tenant completo (provisionamento e setup rapido).
- Observabilidade de pagamentos e estoque (logs + alertas).
- Integracoes futuras (marketplaces, contabilidade, etc).
- Fase final do projeto: calibracao comercial fina da IA do WhatsApp com catalogo real, descricoes reais, metadata real e playbooks definitivos da loja de chocolate.

## Dependencias criticas
- Decisao de politica CSRF para frontend.
- Confirmar estrategia de precos e custos (Mercado Pago e Stripe).
- Garantir fluxo de pagamento com confirmacao automatica e notificacoes.

## Notas
- Este roadmap substitui planos e fases antigas espalhadas nos docs.
- Ajustar prioridades conforme feedback do cliente beta e testes em producao.
- Decisao atual: ate a fase final, a IA do WhatsApp pode operar com produtos e informacoes provisórias para desenvolvimento, desde que a calibracao final com dados oficiais fique documentada e pendente de fechamento.
