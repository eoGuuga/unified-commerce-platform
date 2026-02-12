# Atualizacao E2E - 2026-02-11

Contexto: tentativa de executar o plano E2E WhatsApp/PDV/Estoque usando o VPS.

## O que foi feito
- Tentativa de login via API em https://gtsofthub.com.br/api/v1/auth/login com usuario admin de teste.
- Tentativa de usar o endpoint /whatsapp/test com tenantId 00000000-0000-0000-0000-000000000000.
- Tentativa de criar produtos e ajustar estoque via API usando token (falhou por falta de token valido).

## Resultado
- Login retornou 401 (Credenciais invalidas).
- /whatsapp/test retornou 404 (tenant nao encontrado).
- Endpoints de produtos/estoque retornaram 401 por falta de token valido.

## Diagnostico
- O ambiente apontado e producao (FRONTEND_URL=https://gtsofthub.com.br).
- O endpoint /whatsapp/test depende de tenant valido e, em producao, o contexto de tenant/RLS impede a resolucao via tenantId direto.
- E2E nao deve ser executado em producao sem ambiente dev isolado.

## Decisoes
- Usar ambiente DEV no VPS para executar o E2E.
- Criar um admin de teste e tenant no banco dev (ucm_dev) para executar o fluxo com x-tenant-id.

## Pendencias
- Subir backend dev apontando para ucm_dev com ALLOW_TENANT_FROM_REQUEST=true.
- Executar o plano E2E completo do arquivo docs/08-testes/PLANO-E2E-WHATSAPP-PDV-ESTOQUE.md.
- Registrar evidencias (order_no, pagamento, estoque, resposta do bot).

## Nova tentativa (VPS)
- Docker compose dev subiu apenas postgres-dev e redis-dev.
- Falhou ao iniciar backend dev porque a imagem ucm-backend:latest nao existe no VPS.
- Variaveis do .env.dev nao foram salvas no arquivo (apenas exportadas no shell).

## Proxima acao
- Criar/editar deploy/.env.dev com ALLOW_TENANT_FROM_REQUEST=true e dados de dev.
- Buildar imagem backend dev com Dockerfile.dev e subir container separado.
- Validar que producao continua intacta (containers prod rodando).

## Execucao E2E (DEV no VPS)
- Tenant DEV: 00000000-0000-0000-0000-000000000000
- Produtos criados:
	- Brigadeiro Teste ACID (id eb3ee7b3-a9b8-4699-86e2-fd3ff4e136a1)
	- Bolo de Chocolate Teste (id 8a537d7c-3001-40ba-a155-d5b4f8feacc5)
	- Brownie Teste (id c863fa26-9332-4e5e-ba0e-06030011a26d)
- Estoque ajustado (DEV): 50/20/30 unidades respectivamente.

## Resultado parcial WhatsApp
- Fluxo completo ate confirmacao do pedido e coleta de observacoes OK.
- Pedido criado com sucesso: PED-20260212-154F.
- Falha ao selecionar pagamento ("pix"): resposta "Nao encontrei um pedido pendente para pagamento".

## Resultado PDV
- Pedido PDV falhou com 401 por token invalido/expirado (precisa login novo e header x-tenant-id em todas as chamadas dev).

## Hipoteses
- Conversa WhatsApp nao manteve pedido_id/estado waiting_payment entre mensagens.
- Token usado no PDV expirou após restart do backend dev.

## Proxima acao
- Coletar logs do backend dev no momento do "pix".
- Repetir pix logo apos o "sim" e validar context pedido_id.
- Renovar token e repetir PDV com header x-tenant-id.

## Observacao de seguranca
- Foi criado o usuario admin.e2e@gtsofthub.com.br em producao. Remover se nao for usar.

## Execucao E2E (TESTE via nginx-test:8080)
- Ambiente usado: stack TESTE (ucm-backend-test + ucm-postgres-test) via http://localhost:8080
- Ajuste de estoque (TESTE): Produto Teste com 10 unidades.
- Fluxo WhatsApp completo com telefone novo: +5511998887781
- Pedido criado: PED-20260212-BD86 (status pendente_pagamento)
- Conversa vinculada ao pedido: waiting_payment com pedido_id f559191d-a556-495a-a3c7-43a3acbe7e92
- Pagamento PIX gerado com sucesso (chave retornada pelo bot).

## Falhas encontradas e correcoes aplicadas
- Erro: coluna customer_notes nao existia no banco TESTE, causando falha na coleta de observacoes.
- Correcoes: migration 013-add-customer-notes-to-pedidos.sql aplicada no ucm-postgres-test e backend reiniciado.

## Resultado final WhatsApp (TESTE)
- Confirmacao do pedido gerou resposta de pagamento.
- PIX retornou chave com valor atualizado (R$ 39,88 com desconto).
- Mensagens apos o pagamento (ex.: "sim") sao tratadas como texto comum e nao fazem parte do fluxo.

## Confirmacao de pagamento (TESTE)
- Pagamento PIX confirmado via API: payment_id 4120edc0-603d-48eb-904a-0e9e8898a401.
- Pedido PED-20260212-BD86 passou para status confirmado.

## Health checks + snapshot (TESTE)
- Health/ready/live OK via http://localhost:8080/api/v1/health.
- Containers ativos: ucm-nginx-test, ucm-backend-test, ucm-frontend-test, ucm-postgres-test, ucm-redis-test.

## Resultado PDV (TESTE)
- Pedido PDV criado com sucesso via API.
- Pedido: PED-20260212-B194 (status pendente_pagamento)
- Estoque atualizado do produto usado (produto_id bd113ed7-3177-43c9-82a6-fa2eb83422a5).

## Plano para continuar depois
- Atualizar checklists/relatorios finais com a evidencia do PDV.
- Opcional: simular confirmacao de pagamento (payments confirm) e validar transicao de status.
- Rodar health checks finais e registrar snapshot do ambiente TESTE.
