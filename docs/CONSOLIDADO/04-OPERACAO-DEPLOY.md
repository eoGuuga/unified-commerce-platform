# Operacao e Deploy (Consolidado)

Ultima atualizacao: 2026-02-16

## Fonte de verdade operacional
- Comandos detalhados: `docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md`
- Runbook de producao: `deploy/RUNBOOK-OPERACAO.md`

## Ambientes
- Producao: https://gtsofthub.com.br (stack em /opt/ucm).
- DEV/TESTE: https://dev.gtsofthub.com.br (stack em /opt/ucm-test-repo).
- Compose DEV/TESTE (stack completo): `deploy/docker-compose.test.yml`.
- Compose DEV/TESTE (DB/Redis 24/7): `deploy/docker-compose.dev.yml`.

## Fluxo padrao (producao)
1. Subir banco e redis.
2. Rodar migrations.
3. Provisionar usuario do app (RLS real).
4. Subir stack completa.

## DEV/TESTE usando DB do servidor (opcional)
- Serve para rodar backend local com DB/Redis do VPS via SSH tunnel.
- Passos e comandos detalhados: `docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md`.

## Nginx e SSL
- Config principal: `/opt/ucm/deploy/nginx/ucm.conf`
- Scripts: `deploy/scripts/apply-nginx-config.sh`, `deploy/scripts/renew-ssl.sh`
- Detalhes completos: `deploy/SCRIPTS-SSL-SETUP.md`

## Backups
- Backup local: `deploy/scripts/backup-postgres.sh`
- Offsite: `deploy/scripts/backup-offsite.sh`
- Restore drill: `deploy/scripts/restore-drill-offsite.sh`

## Observacoes
- Documentacao legada: `docs/LEGADO/README.md`
