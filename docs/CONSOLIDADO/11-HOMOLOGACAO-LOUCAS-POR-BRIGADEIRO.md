# Homologacao - Loucas Por Brigadeiro

Ultima atualizacao: 2026-03-21

## Decisao operacional atual
- Primeiro cliente real: Loucas Por Brigadeiro.
- Fase atual: homologacao com numero pessoal de teste.
- Fase final: troca para o numero oficial da loja.
- PDV: uso via navegador no computador da loja.
- Pagamentos da operacao inicial: Pix e dinheiro.
- Recomendacao de provedor WhatsApp para esta fase: `Evolution API` autohospedada no nosso VPS.

## Por que a recomendacao e Evolution API
- O projeto ja aceita `WHATSAPP_PROVIDER=evolution`.
- O backend ja possui webhook generico em `POST /api/v1/whatsapp/webhook`.
- O envio outbound ja contempla Evolution em `backend/src/modules/notifications/notifications.service.ts`.
- Nao ha custo recorrente por mensagem como em provedores pagos.
- Permite homologar com o numero pessoal agora e trocar depois para o numero oficial da loja.

## Observacao importante sobre risco
- Evolution API e uma rota operacional mais barata e pratica para esta fase.
- Para escala maior e operacao mais institucional, a rota oficial/paga (ex.: Twilio/Meta partner) tende a ser mais conservadora.
- Decisao atual do projeto: priorizar custo baixo, velocidade e controle tecnico proprio.

## Arquitetura da operacao na loja
### O que roda no servidor
- backend
- frontend
- banco de dados
- redis
- bot do WhatsApp
- pagamentos
- estoque central

### O que fica no computador da loja
- navegador com atalho para `/pdv`
- navegador com atalho para `/admin` e `/admin/estoque`

### O que fica no celular da loja
- WhatsApp do numero usado na operacao
- pareamento da sessao com o provedor escolhido

## Como a operacao vai funcionar
1. O cliente manda mensagem no WhatsApp.
2. O provedor entrega a mensagem ao nosso webhook.
3. O bot consulta o catalogo do tenant Loucas Por Brigadeiro.
4. Se virar pedido, ele entra no mesmo banco usado pelo PDV e estoque.
5. O computador da loja opera o PDV no navegador.
6. O estoque e unico para WhatsApp, PDV e loja online.

## O que precisa existir no dia da homologacao presencial
- Computador da loja com internet estavel
- Navegador instalado
- Celular com o numero de teste ou numero oficial
- Acesso ao VPS
- Tenant da Loucas importado no ambiente de homologacao
- Catalogo carregado
- Estoque inicial conferido
- Pix configurado
- Operador com login valido no sistema

## Fase 1 - Preparacao em dev/teste
### Objetivo
- Deixar tudo pronto sem tocar no numero oficial da loja.

### Passos
1. Aplicar o tenant Loucas no banco de `dev/teste`.
2. Validar catalogo, estoque e metadata do bot.
3. Configurar `tenant.settings.whatsappInstance` com a instancia `loucas-teste`.
4. Configurar `WHATSAPP_PROVIDER=evolution` no ambiente de `dev/teste`.
5. Conectar o numero de teste ao provedor.
6. Homologar:
   - conversa do bot
   - criacao de pedido
   - Pix
   - dinheiro
   - PDV
   - baixa de estoque
   - ajuste manual de estoque

### Artefatos do repo para esta fase
- Stack do Evolution em `deploy/docker-compose.evolution.test.yml`
- Env exemplo em `deploy/evolution.test.env.example`
- Setup do Evolution em `deploy/scripts/setup-evolution-test.sh`
- Configuracao automatica da instancia em `deploy/scripts/configure-evolution-instance.sh`
- Seed da Loucas em `deploy/scripts/seed-loucas-dev-test.sh`
- Aplicacao rapida da fase 1 em `deploy/scripts/apply-loucas-phase1-devtest.sh`
- Guia operacional do Evolution em `deploy/EVOLUTION-TEST-SETUP.md`

## Fase 2 - Teste presencial na loja
### Objetivo
- Validar operacao real no computador da loja.

### Passos
1. Abrir `/pdv` no computador da loja.
2. Abrir `/admin/estoque` no mesmo computador ou em outra aba.
3. Rodar pedidos de teste no WhatsApp usando o numero pessoal.
4. Rodar vendas de balcao no PDV.
5. Confirmar que:
   - produto vendido no WhatsApp mexe no mesmo estoque do PDV
   - produto vendido no PDV aparece refletido no estoque
   - Pix e dinheiro funcionam no fluxo esperado

## Fase 3 - Virada para o numero oficial
### Objetivo
- Trocar o numero de teste pelo numero da loja sem reestruturar o sistema.

### Passos
1. Desconectar o numero de teste da instancia `loucas-teste`.
2. Parear o numero oficial da loja na mesma instancia `loucas-teste`.
3. Atualizar `store.phone` para o numero oficial quando a operacao final entrar.
4. Validar webhook com mensagem real.
5. Repetir smoke:
   - saudacao
   - recomendacao
   - criacao de pedido
   - pagamento Pix
   - pedido no PDV
   - ajuste de estoque

## Configuracao minima desejada para o tenant Loucas
- `vertical`: `chocolateria`
- `store.name`: `Loucas Por Brigadeiro`
- `store.phone`: telefone em uso na fase atual
- `store.address`: endereco da loja
- `store.hours`: horario da loja
- `whatsappInstance`: `loucas-teste`
- catalogo importado com metadata comercial

## Configuracao minima desejada para o ambiente
- `WHATSAPP_PROVIDER=evolution`
- `EVOLUTION_API_URL` configurada
- `EVOLUTION_API_KEY` configurada
- `EVOLUTION_INSTANCE` configurada
- `PAYMENT_PROVIDER=mercadopago`
- Pix ativo

## O que ainda nao depende do numero oficial
- catalogo
- PDV
- estoque
- painel admin
- importacao do tenant
- metadata comercial do bot
- homologacao inicial da conversa com o numero pessoal

## O que so depende do numero oficial na reta final
- pareamento final do WhatsApp da loja
- validacao final com a operacao real do cliente
- entrada oficial em producao da linha da loja
