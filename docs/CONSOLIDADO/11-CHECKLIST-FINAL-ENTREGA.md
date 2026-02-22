# Checklist Final de Entrega (Primor)

Ultima atualizacao: 2026-02-22

Objetivo: fechar o projeto com evidencias objetivas e risco minimo.

## Evidencias obrigatorias
- Registro de testes: Testes_com_sucesso.txt
- Validacao automatizada: docs/CONSOLIDADO/06-TESTES-VALIDACAO.md
- Status do projeto: docs/CONSOLIDADO/01-ESTADO-ATUAL.md
- Operacao: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
- Release: deploy/CHECKLIST-DE-RELEASE.md

## Checklist tecnico (aprovacao)
- [ ] Tests backend PASS (unit, integration, acid) com data registrada.
- [ ] /api/v1/health (prod e dev/test) retorna 200.
- [ ] Migrations aplicadas no ambiente correto.
- [ ] Usuario do app criado sem superuser em producao.
- [ ] RLS ativo e validado (login e webhooks com tenant correto).
- [ ] SEED_DEV_USER=false em producao.
- [ ] Redis com senha e sem vazamento de segredos nos logs.
- [ ] Backups locais e offsite ativos e verificados.
- [ ] UptimeRobot monitorando 4 endpoints (/ , /health, /health/live, /health/ready).
- [ ] Nginx com config valida e reload sem erro.
- [ ] DNS e SSL validos para prod e dev.

## Checklist funcional (aprovacao)
- [ ] WhatsApp /api/v1/whatsapp/test retorna PEDIDO PREPARADO no dev/test.
- [ ] Pedido criado e status correto em banco (pendente_pagamento).
- [ ] Fluxo de pagamento principal validado (Mercado Pago).
- [ ] PDV abre e lista produtos.
- [ ] Produtos ativos aparecem com estoque correto.
- [ ] Estoque bloqueia overselling.

## Checklist de documentacao
- [ ] README.md atualizado com data e status.
- [ ] Consolidado atualizado (01, 05, 06, 10).
- [ ] Indice de documentacao atualizado.
- [ ] Cronologia atualizada.

## Checklist de seguranca e compliance
- [ ] Politica de privacidade e termos definidos (status registrado).
- [ ] SLA definido ou documentado como pendente.
- [ ] Secrets apenas no .env do servidor (permissoes seguras).

## Encerramento (assinatura)
- Responsavel tecnico:
- Data e hora (UTC):
- Commit final:
- Observacoes:
