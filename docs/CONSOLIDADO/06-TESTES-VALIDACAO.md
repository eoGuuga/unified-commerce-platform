# Testes e Validacao (Consolidado)

Ultima atualizacao: 2026-02-16

## Evidencias recentes (DEV/TESTE)
- E2E WhatsApp PIX validado em 2026-02-13 e 2026-02-14.
- Pedidos confirmados com pagamento paid no banco.
- Exemplos: PED-20260213-A379, PED-20260213-03DD, PED-20260214-189F.

## Roteiro E2E (referencia)
- Ver: docs/LEGADO/08-testes/ROTEIRO-E2E-DEV-TESTE-WHATSAPP-PIX-2026-02-12.md
- Ver: docs/LEGADO/08-testes/RELATORIO-E2E-DEV-TESTE-WHATSAPP-PIX-2026-02-13.md

## Testes automatizados (backend)
- unit: npm run test:unit
- integration: npm run test:integration
- acid: npm run test:acid

Observacao: resultados historicos estao em docs/LEGADO/08-testes, mas precisam ser reexecutados no ambiente atual.
Observacao: testes completos podem ser rodados via scripts em scripts/test/ (ex.: test-backend.ps1).

## Testes manuais recomendados
- Idempotencia: repetir /orders com Idempotency-Key.
- Audit log: criar produto e validar registro no audit_log.
- Cache: repetir /products e medir resposta.
- RLS: validar tenant A nao acessa tenant B.

## Execucao no servidor (DEV/TESTE)
- Health (DEV/TESTE):
```
curl -s https://dev.gtsofthub.com.br/api/v1/health
```
- Fluxo WhatsApp via /whatsapp/test conforme roteiro.
- Confirmacao de pagamento via /payments/{id}/confirm com JWT valido.
- Validacao no banco via psql no container do Postgres.

## Pendencias de validacao
- Rodar suite completa de testes no servidor DEV/TESTE.
- Registrar evidencias de audit log e idempotencia.
- Validar login e webhooks em producao com RLS ativo.
