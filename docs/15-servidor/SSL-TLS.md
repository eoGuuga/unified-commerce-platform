# SSL/TLS (NGINX)

Resumo de certificados e volume correto no container.

- Producao:
  - `/etc/letsencrypt/live/gtsofthub.com.br/`
- Dev:
  - `/etc/letsencrypt/live/dev.gtsofthub.com.br/`
- Nginx no container deve montar o volume:
  - `/etc/letsencrypt:/etc/letsencrypt:ro`

Validacoes rapidas:
```
ls -la /etc/letsencrypt/live
curl -s https://gtsofthub.com.br/api/v1/health
curl -s https://dev.gtsofthub.com.br/api/v1/health
```
