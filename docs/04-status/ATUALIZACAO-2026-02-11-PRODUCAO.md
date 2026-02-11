# Atualizacao 2026-02-11 (prod)

Status: deploy concluido com sucesso e health checks OK.

## O que foi aplicado
- Backend atualizado com hardening e ajustes de seguranca.
- Frontend atualizado para Next 16.1.6.
- Script de migrations ajustado para pular 001 quando o schema ja existe.

## Evidencias (prod)
- Build completo do backend e frontend.
- Containers recriados e saudaveis.
- Health checks 200:
  - https://gtsofthub.com.br/
  - https://gtsofthub.com.br/api/v1/health
  - https://gtsofthub.com.br/api/v1/health/live
  - https://gtsofthub.com.br/api/v1/health/ready
  - https://www.gtsofthub.com.br/ (301 -> raiz)

## Observacoes
- Migrations executadas com sucesso apos ajuste do script.
- Sem falhas criticas registradas nos smoke tests.
