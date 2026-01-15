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

Se o curl falhar com erro de "subject name", reemitir o certificado com SAN correto:
```
sudo certbot certificates
sudo apt-get install -y certbot
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d gtsofthub.com.br \
  -d www.gtsofthub.com.br
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d dev.gtsofthub.com.br

sudo systemctl reload nginx || docker restart ucm-nginx
```

Validacao (sem ignorar SSL):
```
curl -i https://gtsofthub.com.br/api/v1/health
curl -i https://dev.gtsofthub.com.br/api/v1/health
```
