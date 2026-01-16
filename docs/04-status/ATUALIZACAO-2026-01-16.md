# Atualizacao 2026-01-16 (prod + dev OK)

Objetivo: fechar o ciclo de alinhamento com health OK e rotina diaria.

Status final:
- Producao OK: https://gtsofthub.com.br/api/v1/health
- Dev OK: https://dev.gtsofthub.com.br/api/v1/health
- Cron diario as 19:00: apply-and-health.sh
- Log do cron: /var/log/ucm-apply-health.log

Checklist final:
- [x] prod health OK
- [x] dev health OK
- [x] cron 19:00 instalado
- [x] nginx reload OK
- [x] redis/postgres OK

Notas:
- 502 pode ocorrer durante reload/recreate; o health final deve ficar OK.
- Scripts em uso: deploy/scripts/apply-and-health.sh, deploy/scripts/fix-prod-dev-health.sh, deploy/scripts/apply-nginx-config.sh

Comandos de referencia (sem segredos):
```
curl -s https://gtsofthub.com.br/api/v1/health
curl -s https://dev.gtsofthub.com.br/api/v1/health

( crontab -l 2>/dev/null | sed '/apply-and-health.sh/d' ; \
  echo "0 19 * * * /opt/ucm/deploy/scripts/apply-and-health.sh >> /var/log/ucm-apply-health.log 2>&1" ) | crontab -

tail -n 200 /var/log/ucm-apply-health.log
```
