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

## Observacao de seguranca
- Foi criado o usuario admin.e2e@gtsofthub.com.br em producao. Remover se nao for usar.
