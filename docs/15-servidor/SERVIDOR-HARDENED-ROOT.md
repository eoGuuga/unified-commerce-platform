# SERVIDOR HARDENED - ROOT (RESUMO)

Servidor: 37.59.118.210 (OVH VPS)
Status: HARDENED (jan/2026)

---

## SSH
- PermitRootLogin no
- PasswordAuthentication no
- KbdInteractiveAuthentication no
- AuthenticationMethods publickey
- X11Forwarding no

Login:
```
ssh ubuntu@37.59.118.210
sudo -i
```

---

## Firewall e Fail2ban
- UFW: allow 22/80/443; default deny (incoming)
- Rate limit ativo em 22/tcp
- Fail2ban ativo para sshd

Comandos:
```
ufw status verbose
fail2ban-client status sshd
```

---

## Backups
- Local: /opt/ucm/backups (diario)
- Offsite: log em /var/log/ucm-backup-offsite.log
- Restore drill: /var/log/ucm-restore-drill.log (mensal)

---

## Nginx / TLS
- Prod: https://gtsofthub.com.br
- Dev: https://dev.gtsofthub.com.br
- Certificados:
  - /etc/letsencrypt/live/gtsofthub.com.br/
  - /etc/letsencrypt/live/dev.gtsofthub.com.br/
- Volume correto no container:
  - /etc/letsencrypt:/etc/letsencrypt:ro

---

## Checks rapidos
```
sshd -T | egrep -i 'permitrootlogin|passwordauthentication|kbdinteractiveauthentication|x11forwarding|authenticationmethods'
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
curl -s https://gtsofthub.com.br/api/v1/health
curl -s https://dev.gtsofthub.com.br/api/v1/health
```

---

Hardened: Janeiro 2026
