# GUIDE-QUICK-SETUP-DEPLOY.md

# Guia Rápido: Configurar Deploy via GitHub

## Tempo estimado: 15-30 minutos

---

## PASSO 1: Gerar Chave SSH de Deploy

No seu computador (PowerShell):

```powershell
# Gere a chave (não use senha, deixa vazio para automação)
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -C "github-actions-deploy"

# Mostre a chave pública (vai usar depois)
cat ~/.ssh/deploy_key.pub

# Mostre a chave privada (vai copiar pro GitHub)
cat ~/.ssh/deploy_key
```

---

## PASSO 2: Adicionar Chave Pública ao Servidor

```powershell
# Copie a chave pública para o servidor
cat ~/.ssh/deploy_key.pub | ssh -i ~/.ssh/id_ed25519 ubuntu@<IP_DO_SERVIDOR> "cat >> ~/.ssh/authorized_keys"
```

---

## PASSO 3: Configurar Secrets no GitHub

1. Acesse: `https://github.com/<seu-user>/<repo>/settings/secrets/actions`

2. Clique em **"New repository secret"** para cada um:

### Secrets Obrigatórios:

> Nota: `<IP_DO_SERVIDOR>` é um placeholder — o endereço real fica fora do repositório (gerenciador de senhas / doc privado).

| Nome | Valor |
|------|-------|
| `VPS_HOST` | `<IP_DO_SERVIDOR>` |
| `VPS_USER` | `ubuntu` |
| `VPS_SSH_KEY` | **(cole a chave privada inteira)** |
| `GHCR_TOKEN` | **(token do GitHub)** |
| `DATABASE_URL` | `postgresql://ucm_app:94bFHROpoaUcT68tW6EMmCvbcWCWYaKCD8iHtETiJnW2IcOb@postgres:5432/ucm` |
| `REDIS_URL` | `redis://:701e38acffa0f3a0e632f3697124dcbd@redis:6379` |
| `JWT_SECRET` | `b8439503c443103c234fb61c0d950e412cb2d39ff9f7d4e02ef427d922baec22` |
| `CORS_ORIGINS` | `https://gtsofthub.com.br` |
| `FRONTEND_URL` | `https://gtsofthub.com.br` |
| `NEXT_PUBLIC_API_URL` | `https://gtsofthub.com.br/api` |

---

## PASSO 4: Criar GHCR Token (se necessário)

O `GITHUB_TOKEN` já está disponível automaticamente no Actions. Se precisar de um token separado:

1. Acesse: https://github.com/settings/tokens
2. Clique em **"Generate new token (Classic)"**
3. Nome: `ghcr-deploy`
4. Permissões: `write:packages`
5. Copie o token e adicione como `GHCR_TOKEN` no GitHub

---

## PASSO 5: Commit e Push

```powershell
cd "C:\Users\gusta\Documents\Projeto sas\unified-commerce-platform"

git add .github/workflows/deploy-prod.yml docs/
git commit -m "feat: add GitHub Actions deploy workflow

- Backend build & push to GHCR
- Frontend build & push to GHCR  
- SSH deploy to VPS
- Auto-restart containers"

git push origin main
```

---

## PASSO 6: Verificar Deploy

1. Vá em: `https://github.com/<seu-user>/<repo>/actions`
2. Você verá o workflow rodando
3. Clique no workflow para ver os logs
4. Aguarde ~5-10 minutos

---

## PASSO 7: Testar o Servidor

```powershell
# Testar health
curl -k https://<IP_DO_SERVIDOR>/api/v1/health

# Esperado:
# {"status":"ok",...}
```

---

## Troubleshooting

### Erro: "Permission denied (publickey)"

→ A chave SSH não foi adicionada corretamente ao servidor

### Erro: "network not found"

→ Execute no servidor:
```bash
docker network create deploy_ucm-net
```

### Erro: "Image not found"

→ Verifique se o login no GHCR funcionou:
```bash
docker login ghcr.io
```

---

## Comandos Úteis no Servidor

```bash
# Ver containers
docker ps

# Ver logs do backend
docker logs ucm-backend -f

# Ver logs do nginx
docker logs ucm-nginx -f

# Restart manual
docker restart ucm-backend ucm-nginx

# Ver imagens
docker images | grep ghcr.io

# Limpar imagens antigas
docker image prune -a -f
```