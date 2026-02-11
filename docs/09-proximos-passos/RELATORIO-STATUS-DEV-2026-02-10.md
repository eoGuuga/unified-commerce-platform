# Relatorio de status DEV/TEST

Data: 2026-02-10
Escopo: ambiente dev/test no VPS (repositorio /opt/ucm-test-repo)

## Visao geral
- Dev e prod separados corretamente:
  - https://dev.gtsofthub.com.br -> stack dev/test
  - https://gtsofthub.com.br -> stack prod
- RLS com tenant corrigido e validado
- Fluxo WhatsApp validado end-to-end no dominio dev
- Testes backend (unit + integration + acid) passaram no stack dev/test

## Validacoes executadas
- Bootstrap dev/test (migrations + seed + smoke + E2E WhatsApp)
- Health checks:
  - /api/v1/health em prod
  - /api/v1/health em dev
- WhatsApp E2E no dev:
  - pedido -> coleta de dados -> confirmacao -> pagamento PIX
- Testes backend no dev/test:
  - test:unit
  - test:integration
  - test:acid

## Scripts usados
- deploy/scripts/bootstrap-dev.sh
- deploy/scripts/run-dev-whatsapp-e2e.sh
- deploy/scripts/run-backend-all-tests.sh
- deploy/scripts/ensure-dev-routing.sh

## Alertas e observacoes
- npm audit sinalizou vulnerabilidades (3 low, 3 moderate, 1 high)
  - nao bloqueia testes, mas recomenda revisao quando houver janela
- npm mostrou versao nova disponivel (informativo)

## Estado final
- Dev/test operacional com automacao completa
- Prod operacional e isolado
- Backlog atualizado com UCP-001/002/003/004 concluido

## Proximos passos recomendados
- Iniciar UCP-005 (revisao de dependencias circulares)
- Validar UCP-006 (PDV + dashboard basico)
