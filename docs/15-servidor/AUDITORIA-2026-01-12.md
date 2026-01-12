# AUDITORIA DO SERVIDOR - 2026-01-12

Escopo: hardening, rede, SSH, backups, Docker, Nginx/TLS e observabilidade.
Fonte: saidas de comandos fornecidas pelo operador (sem segredos).

---

## Resumo executivo

Pontos fortes
- UFW ativo com portas 22/80/443 apenas.
- Fail2ban ativo e bloqueando ataques.
- Containers principais em execucao (nginx, frontend, backend, postgres, redis).
- Backups locais diarios e offsite funcionando.

Achados criticos
- Login por senha aceito pelo SSH apesar de `PasswordAuthentication no`.
  Isso indica configuracao efetiva divergente (provavel override em `sshd_config.d`).

Achados altos
- X11 forwarding habilitado (superficie extra).
- Restore drill sem log (`/var/log/ucm-restore-drill.log` ausente).

Achados medios
- Atualizacoes pendentes do sistema.
- Nginx TLS nao foi verificado (faltou dump completo do vhost).

Status apos correcoes (12/01/2026)
- SSH efetivo: `passwordauthentication no`, `x11forwarding no`, `authenticationmethods publickey`, `permitrootlogin no`.
- UFW: rate limit ativo em 22/tcp (v4/v6); 80/443 liberadas.
- Restore drill: log criado + cron mensal + logrotate configurado e teste OK.
- Updates: sistema atualizado; unattended-upgrades ativo.
- Nginx: TLS hardening aplicado (ciphers, HSTS, headers). OCSP stapling com warning (cert sem OCSP URL).
- Ambiente dev publicado em `https://dev.gtsofthub.com.br` apontando para o stack de teste.
- Nginx prod ajustado para montar `/etc/letsencrypt` no container (certificados OK).

---

## Evidencias coletadas

Rede e firewall
- UFW: ativo; allow apenas 22/80/443.
- `ss -tulpn`: portas publicas 22/80/443; servicos internos em localhost.

SSH
- `sshd_config`: `PermitRootLogin no`, `PubkeyAuthentication yes`, `PasswordAuthentication no`.
- Logs do `sshd`: "Accepted password for ubuntu" (prova de senha ativa).

Docker
- Containers ativos; restart count = 0 no momento do dump.

Backups
- `/opt/ucm/backups` contem dumps diarios.
- `backup.log` mostra execucoes ok.
- `backup-offsite.log` mostra upload ok.
- `restore-drill.log` ausente.

---

## Acoes recomendadas (ordem de prioridade)

1) Corrigir SSH para bloquear senha de fato
- Validar `sshd -T` e `sshd_config.d` para overrides.
- Definir explicitamente:
  - `PasswordAuthentication no`
  - `KbdInteractiveAuthentication no`
  - `ChallengeResponseAuthentication no`
  - `X11Forwarding no`
  - `AuthenticationMethods publickey`
- Recarregar `sshd` apos `sshd -t`.

2) Desativar X11 forwarding no cliente e no servidor
- No servidor: `X11Forwarding no` no sshd.
- No cliente: desabilitar X11 no MobaXterm.

3) Restaurar o restore drill mensal
- Verificar script e cron.
- Criar log em `/var/log/ucm-restore-drill.log` e logrotate.

4) Atualizar o SO (patches pendentes)
- Aplicar updates e reboot controlado se necessario.

5) Verificar TLS do Nginx
- Confirmar `ssl_protocols TLSv1.2 TLSv1.3`, HSTS e ciphers.

---

## Comandos para validacao (root)

```
sshd -T | egrep -i 'permitrootlogin|passwordauthentication|kbdinteractiveauthentication|x11forwarding|authenticationmethods'
grep -nE 'PasswordAuthentication|PermitRootLogin|X11Forwarding' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf
ufw status verbose
fail2ban-client status sshd
docker inspect --format '{{.Name}} restart={{.RestartCount}} started={{.State.StartedAt}}' ucm-backend ucm-frontend ucm-nginx
docker exec ucm-nginx nginx -T | egrep -n 'server_name|ssl_protocols|ssl_ciphers|add_header|proxy_pass|client_max_body_size'
ls -la /opt/ucm/backups
tail -n 60 /opt/ucm/backups/backup.log
tail -n 60 /var/log/ucm-backup-offsite.log
tail -n 60 /var/log/ucm-restore-drill.log
```
