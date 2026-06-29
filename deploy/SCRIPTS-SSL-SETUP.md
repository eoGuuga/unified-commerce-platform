# 🔒 Scripts e Guia para Configurar SSL/HTTPS

> **Objetivo:** Configurar HTTPS completo para `gtsofthub.com.br`  
> **Pré-requisito:** DNS apontando para o VPS  
> **Status atual:** prod e dev ja estao com HTTPS ativo neste servidor.

---

## 📋 Passo a Passo Completo

### 1. Verificar DNS

No seu PC (Windows):
```powershell
nslookup gtsofthub.com.br
nslookup www.gtsofthub.com.br
```

Ambos devem retornar o IP do VPS (`<IP_DO_SERVIDOR>`).

> Nota: `<IP_DO_SERVIDOR>` é um placeholder — o endereço real fica fora do repositório (gerenciador de senhas / doc privado).

---

### 2. Acessar VPS

```bash
ssh ubuntu@SEU_IP
sudo -i
cd /opt/ucm
```

---

### 3. Instalar Certbot (se não estiver instalado)

```bash
apt-get update
apt-get install -y certbot
```

---

### 4. Emitir Certificado SSL (Primeira Vez)

**Opção A: Standalone (recomendado para primeira vez)**

```bash
# Parar Nginx temporariamente
docker stop ucm-nginx

# Emitir certificado
certbot certonly --standalone \
  -d gtsofthub.com.br \
  -d www.gtsofthub.com.br \
  -d dev.gtsofthub.com.br \
  --email seu-email@exemplo.com \
  --agree-tos \
  --non-interactive

# Reiniciar Nginx
docker start ucm-nginx
```

**Opção B: Webroot (se Nginx já estiver rodando)**

```bash
# Criar diretório para validação
mkdir -p /var/www/certbot

# Emitir certificado
certbot certonly --webroot \
  -w /var/www/certbot \
  -d gtsofthub.com.br \
  -d www.gtsofthub.com.br \
  -d dev.gtsofthub.com.br \
  --email seu-email@exemplo.com \
  --agree-tos \
  --non-interactive
```

---

### 5. Verificar Certificados

```bash
ls -la /etc/letsencrypt/live/gtsofthub.com.br/
ls -la /etc/letsencrypt/live/dev.gtsofthub.com.br/
```

Deve mostrar:
- `fullchain.pem` ✅
- `privkey.pem` ✅
- `chain.pem` ✅ (criado automaticamente)

---

### 6. Atualizar Docker Compose

O arquivo `deploy/docker-compose.prod.yml` já está atualizado com:
- Porta 443 mapeada
- Volume de certificados montado

---

### 7. Atualizar Nginx

O arquivo `deploy/nginx/ucm.conf` já está atualizado com:
- Servidor HTTPS (443)
- Redirect HTTP → HTTPS
- Redirect www → sem www
- Headers de segurança (HSTS, etc.)

---

### 8. Recriar Container Nginx

```bash
cd /opt/ucm
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d --force-recreate nginx
```

---

### 9. Verificar HTTPS

```bash
# Testar HTTPS
curl -I https://gtsofthub.com.br/
curl -I https://gtsofthub.com.br/api/v1/health

# Testar redirect HTTP → HTTPS
curl -I http://gtsofthub.com.br/

# Testar redirect www → sem www
curl -I https://www.gtsofthub.com.br/
```

---

### 10. Configurar Renovação Automática

```bash
# Tornar script executável
chmod +x /opt/ucm/deploy/scripts/renew-ssl.sh

# Adicionar ao cron (renovar todo dia às 3:30 AM)
(crontab -l 2>/dev/null | grep -v "renew-ssl.sh"; echo "30 3 * * * /opt/ucm/deploy/scripts/renew-ssl.sh >> /var/log/ucm-ssl-renew.log 2>&1") | crontab -

# Verificar cron
crontab -l
```

---

### 11. Atualizar Variável de Ambiente

```bash
cd /opt/ucm
nano deploy/.env
```

Alterar:
```bash
FRONTEND_URL=https://gtsofthub.com.br
```

Recriar containers que usam essa variável:
```bash
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d --force-recreate backend frontend
```

---

### 12. Testar Renovação (Dry Run)

```bash
certbot renew --dry-run
```

Se funcionar, a renovação automática está configurada corretamente.

---

## ✅ Checklist Final

- [ ] DNS apontando para VPS
- [ ] Certificados SSL emitidos
- [ ] Nginx configurado para HTTPS
- [ ] Docker Compose com porta 443
- [ ] HTTPS funcionando
- [ ] Redirect HTTP → HTTPS funcionando
- [ ] Redirect www → sem www funcionando
- [ ] Renovação automática configurada
- [ ] `FRONTEND_URL` atualizado para HTTPS
- [ ] Containers recriados com nova variável

---

## 🐛 Troubleshooting

### Erro: "Port 80 is already in use"
**Solução:** Parar Nginx antes de emitir certificado:
```bash
docker stop ucm-nginx
certbot certonly --standalone ...
docker start ucm-nginx
```

### Erro: "Failed to renew certificate"
**Solução:** Verificar logs:
```bash
tail -f /var/log/ucm-ssl-renew.log
certbot renew --dry-run -v
```

### Erro: "SSL certificate not found"
**Solução:** Verificar se certificados estão montados:
```bash
docker exec ucm-nginx ls -la /etc/letsencrypt/live/gtsofthub.com.br/
```

---

**Última atualização:** 09/01/2026
