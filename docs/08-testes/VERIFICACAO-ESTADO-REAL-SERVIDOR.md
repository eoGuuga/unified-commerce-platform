# ⚠️ VERIFICAÇÃO CRÍTICA - Estado Real do Servidor

> **Data:** 09/01/2026  
> **Objetivo:** Confirmar o que REALMENTE está configurado no servidor antes de fazer mudanças

---

## 🚨 IMPORTANTE

**ANTES de aplicar qualquer mudança, precisamos confirmar:**

1. ✅ O que está **realmente funcionando** no servidor
2. ✅ O que está **documentado** vs o que está **implementado**
3. ✅ Se há **diferenças** entre o repositório e o servidor

---

## 📋 O QUE O RUNBOOK DIZ (Estado Esperado)

### Checklist de "Perfeição" (RUNBOOK linha 236-245):
- ✅ **HTTPS ativo (443)**
- ✅ **HTTP→HTTPS (301)**
- ✅ **www→raiz (301)**
- ✅ **HSTS ativo**
- ✅ **UFW 22/80/443**

### URLs no Runbook:
- ✅ `https://gtsofthub.com.br/` (HTTPS)
- ✅ `https://gtsofthub.com.br/api/v1/health` (HTTPS)
- ✅ Todos os comandos usam `curl -I https://...`

### Containers:
- ✅ `ucm-nginx` (80/443 público) - **Porta 443 mencionada**

### SSL:
- ✅ Certificados em `/etc/letsencrypt/live/gtsofthub.com.br/`
- ✅ Comando de renovação: `certbot renew --dry-run`

---

## 🔍 O QUE ESTÁ NO REPOSITÓRIO (Agora)

### `deploy/nginx/ucm.conf`:
- ✅ Servidor HTTPS (443) configurado
- ✅ Redirect HTTP → HTTPS
- ✅ Certificados SSL referenciados
- ✅ HSTS configurado

### `deploy/docker-compose.prod.yml`:
- ✅ Porta 443 mapeada
- ✅ Volumes de certificados montados

### `deploy/scripts/renew-ssl.sh`:
- ✅ Script de renovação existe

---

## ❓ PERGUNTAS CRÍTICAS

### 1. Os arquivos no repositório estão sincronizados com o servidor?

**Verificar no servidor:**
```bash
# No VPS
cd /opt/ucm
cat deploy/nginx/ucm.conf | grep -A 5 "listen 443"
cat deploy/docker-compose.prod.yml | grep "443"
```

### 2. O HTTPS está realmente funcionando?

**Testar:**
```bash
# Do seu PC
curl -I https://gtsofthub.com.br/
curl -I http://gtsofthub.com.br/  # Deve redirecionar para HTTPS
```

### 3. Os containers estão rodando com a configuração correta?

**Verificar no servidor:**
```bash
# No VPS
docker ps | grep nginx
docker inspect ucm-nginx | grep -A 10 "Ports"
docker exec ucm-nginx nginx -T | grep -A 5 "listen 443"
```

---

## ⚠️ POSSÍVEIS CENÁRIOS

### Cenário A: Tudo já está configurado e funcionando
- ✅ Servidor tem HTTPS ativo
- ✅ Arquivos no servidor estão corretos
- ⚠️ Arquivos no repositório podem estar desatualizados
- **Ação:** Sincronizar repositório com servidor

### Cenário B: Configuração existe mas não está aplicada
- ✅ Arquivos no repositório estão corretos
- ⚠️ Servidor não tem essas configurações aplicadas
- **Ação:** Aplicar configurações no servidor

### Cenário C: Configuração parcial
- ⚠️ Algumas coisas funcionam, outras não
- ⚠️ Pode haver diferenças entre repo e servidor
- **Ação:** Verificar e corrigir o que falta

---

## ✅ CHECKLIST DE VERIFICAÇÃO (Fazer no Servidor)

### 1. Verificar Nginx
```bash
docker exec ucm-nginx nginx -T 2>&1 | grep -E "(listen 443|ssl_certificate|server_name)"
```

### 2. Verificar Docker Compose
```bash
cd /opt/ucm
cat deploy/docker-compose.prod.yml | grep -A 5 "nginx:"
```

### 3. Verificar Certificados
```bash
ls -la /etc/letsencrypt/live/gtsofthub.com.br/
```

### 4. Testar HTTPS
```bash
curl -I https://gtsofthub.com.br/
curl -I http://gtsofthub.com.br/  # Deve 301 → HTTPS
```

### 5. Verificar Portas
```bash
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep nginx
netstat -tlnp | grep 443
```

---

## 🎯 RECOMENDAÇÃO

**NÃO aplicar mudanças até confirmar:**

1. ✅ Acessar o servidor via SSH
2. ✅ Verificar configuração atual do Nginx
3. ✅ Testar HTTPS funcionando
4. ✅ Comparar com arquivos do repositório
5. ✅ Só então decidir o que precisa ser feito

---

## 📝 PRÓXIMOS PASSOS

1. **Verificar servidor** (SSH)
2. **Testar HTTPS** (curl do PC)
3. **Comparar** (repo vs servidor)
4. **Decidir** (o que realmente precisa ser feito)
5. **Documentar** (atualizar runbook se necessário)

---

**Status:** ⚠️ **AGUARDANDO CONFIRMAÇÃO DO SERVIDOR**
