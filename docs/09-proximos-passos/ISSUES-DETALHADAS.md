# Backlog detalhado (issues)

> Data: 2026-02-10
> Status: alinhado com a fase 3.3 e pendencias posteriores

Observacoes:
- Em PDV, o status inicial esperado e `pendente_pagamento` (alinhado com o backend atual).

Status atual (2026-02-10):
- Separacao perfeita entre dev (dev.gtsofthub.com.br) e prod (gtsofthub.com.br) validada.
- Fluxo WhatsApp E2E validado no dominio dev (pedido -> dados -> confirmacao -> pix).
- RLS para tenants corrigido via migration e runner do stack test idempotente.
- Smoke test dev ok; suites `npm run test:unit`, `npm run test:integration`, `npm run test:acid` ainda pendentes no servidor.

---

## UCP-001 - Estabilizar build e testes do backend

Tipo: Task
Estimativa: 1-2 dias
Dependencias: nenhuma
Descricao: garantir build limpo, sem dependencias circulares e testes passando.
Criterios de aceite:
- Build limpa e backend inicia sem erros
- `/api/v1/health` retorna ok
- `npm run test:unit` passa
- `npm run test:integration` passa
- `npm run test:acid` passa

---

## UCP-002 - Implementar coleta de dados do cliente no WhatsApp

Tipo: Feature
Status: concluido (validado no dev)
Estimativa: 2-3 dias
Dependencias: UCP-001
Descricao: coletar nome, endereco, telefone e observacoes no fluxo de conversa.
Criterios de aceite:
- Estado de conversa suporta coleta sequencial
- Validacoes minimas por campo (tamanho e formato)
- Dados persistidos no contexto da conversa

---

## UCP-003 - Confirmacao do pedido e atualizacao no OrdersService

Tipo: Feature
Status: concluido (validado no dev)
Estimativa: 1-2 dias
Dependencias: UCP-002
Descricao: confirmar pedido com dados completos e atualizar registro do pedido.
Criterios de aceite:
- Pedido nao segue para pagamento sem confirmacao
- Pedido salva nome, endereco, telefone e observacoes
- Mensagens claras de confirmacao e erro

---

## UCP-004 - Testes E2E do fluxo WhatsApp

Tipo: Task
Status: concluido (validado no dev)
Estimativa: 2-3 dias
Dependencias: UCP-003
Descricao: validar o fluxo completo do bot com cenarios principais.
Criterios de aceite:
- Fluxo pedido -> confirmacao -> pagamento -> notificacao
- Cancelamento no meio do fluxo
- Dados invalidos com mensagem de erro
- Timeout sem resposta tratado

---

## UCP-005 - Revisao de dependencias circulares

Tipo: Task
Estimativa: 1 dia
Dependencias: UCP-001
Descricao: garantir que nao exista ciclo entre Whatsapp, Orders, Payments e Notifications.
Criterios de aceite:
- Modulos iniciam sem warnings de dependencia circular
- Services desacoplados com repositorios quando possivel

---

## UCP-006 - Validacao funcional do PDV e Dashboard basico

Tipo: QA
Estimativa: 1 dia
Dependencias: UCP-001
Descricao: validar se o PDV e o dashboard basico estao consistentes com a doc.
Criterios de aceite:
- PDV lista produtos e estoque corretamente
- Reserva e liberacao de estoque funcionam
- Dashboard basico carrega metricas sem erros

---

## UCP-007 - E-commerce (carrinho + checkout)

Tipo: Epic
Estimativa: 5-8 dias
Dependencias: UCP-003
Descricao: finalizar fluxo de e-commerce com carrinho e checkout.
Criterios de aceite:
- Carrinho com adicionar/remover/quantidade
- Checkout com validacoes e pagamento
- Pedido criado com canal e status corretos

---

## UCP-008 - Dashboard avancado

Tipo: Epic
Estimativa: 3-5 dias
Dependencias: UCP-006
Descricao: implementar analytics avancado e gestao de clientes.
Criterios de aceite:
- Graficos e relatorios por periodo e canal
- Lista de clientes e insights basicos
- Exportacao de relatorios (csv ou similar)

---

## UCP-009 - Integracao Ollama no bot

Tipo: Epic
Estimativa: 2-4 dias
Dependencias: UCP-004
Descricao: integrar Ollama para NLP e manter fallback.
Criterios de aceite:
- OllamaService ativo e configuravel por env
- Fallback quando Ollama indisponivel
- Respostas mais naturais com contexto basico
