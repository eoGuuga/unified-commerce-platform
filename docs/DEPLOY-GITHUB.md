# DEPLOY VIA GITHUB - Guia Completo

## Visão Geral

Este documento descreve o sistema de deploy automático via GitHub Actions para o servidor VPS de produção.

**Fluxo:**
```
Git Push → GitHub Actions → Build Docker Image → Push to GHCR → SSH to VPS → Pull & Restart Containers
```

---

## 1. Secrets Necessários no GitHub

Você precisa configurar os seguintes secrets no repositório GitHub:

### Passos para configurar:

1. Acesse: `https://github.com/<owner>/<repo>/settings/secrets/actions`

2. Clique em **"New repository secret"** e adicione:

> Nota: `<IP_DO_SERVIDOR>` é um placeholder — o endereço real fica fora do repositório (gerenciador de senhas / doc privado).

| Secret Name | Valor |
|-------------|-------|
| `VPS_HOST` | `<IP_DO_SERVIDOR>` |
| `VPS_USER` | `ubuntu` |
| `VPS_SSH_KEY` | Chave privada SSH (código completo) |
| `GHCR_TOKEN` | Token para GitHub Container Registry |
| `DATABASE_URL` | `postgresql://ucm_app:SENHA@postgres:5432/ucm` |
| `REDIS_URL` | `redis://:SENHA@redis:6379` |
| `JWT_SECRET` | Chave secreta JWT (64+ caracteres) |
| `CORS_ORIGINS` | `https://gtsofthub.com.br` |
| `FRONTEND_URL` | `https://gtsofthub.com.br` |
| `NEXT_PUBLIC_API_URL` | `https://gtsofthub.com.br/api` |

---

## 2. Configurar Chave SSH

### No seu computador (Windows):

```powershell
# Gere uma nova chave SSH para deploy (NÃO use a mesma do github)
ssh-keygen -t ed25519 -C "deploy@gtsofthub" -f ~/.ssh/deploy_key

# Copie a chave pública para o servidor
cat ~/.ssh/deploy_key.pub | ssh -i ~/.ssh/id_ed25519 ubuntu@<IP_DO_SERVIDOR> "cat >> ~/.ssh/authorized_keys"
```

### No Servidor VPS:

```bash
# Authorize a chave pública no servidor (já feito acima)
# Verificar se a chave foi adicionada:
cat ~/.ssh/authorized_keys
```

### Adicionar no GitHub:

1. Copie a chave privada:
```powershell
cat ~/.ssh/deploy_key
```

2. No GitHub, vá em **Settings → Secrets → Actions**
3. Adicione novo secret `VPS_SSH_KEY` com o conteúdo da chave privada

---

## 3. Configurar GHCR Token

O GitHub Actions já tem acesso ao `GITHUB_TOKEN` automaticamente. Para `GHCR_TOKEN`, você pode usar o mesmo:

1. Vá em: `https://github.com/settings/tokens`
2. Crie um novo token (Classic) com permissões:
   - `write:packages`
   - `repo` (se privado)
3. Adicione como secret `GHCR_TOKEN`

---

## 4. Workflow de Deploy

O arquivo `.github/workflows/deploy-prod.yml` define o pipeline:

### Jobs:

| Job | Descrição |
|-----|-----------|
| `deploy-backend` | Build e deploy do backend (NestJS) |
| `deploy-frontend` | Build e deploy do frontend (Next.js) |
| `restart-nginx` | Reinicia o nginx após deploy |
| `notify` | Gera summary do deployment |

### Gatilhos:

- **Push** para branch `main` em arquivos de `backend/**` ou `frontend/**`
- **Manual** via `workflow_dispatch` (botão "Run workflow")

---

## 5. Como Funciona o Deploy

### Backend:
1. GitHub Actions faz build da imagem Docker
2. Push para `ghcr.io/<owner>/ucm-backend:sha-<commit>`
3. SSH para VPS
4. Login no GHCR
5. Pull da imagem
6. Stop/rm do container antigo
7. Run do novo container com variáveis de ambiente

### Frontend:
1. Mesmo processo, imagem `ucm-frontend`

### Nginx:
1. Restart do container para limpar cache

---

## 6. Comandos Úteis no Servidor

### Ver status dos containers:
```bash
docker ps
```

### Ver logs do backend:
```bash
docker logs ucm-backend --tail 50 -f
```

### Ver logs do nginx:
```bash
docker logs ucm-nginx --tail 30 -f
```

### Restart manual:
```bash
docker restart ucm-backend
docker restart ucm-nginx
```

### Ver imagens:
```bash
docker images | grep ghcr.io
```

### Limpar imagens antigas:
```bash
docker image prune -a -f
```

---

## 7. Troubleshooting

### Deploy falhou?
1. Verifique os logs no GitHub Actions
2. Teste SSH manual: `ssh -i ~/.ssh/deploy_key ubuntu@<IP_DO_SERVIDOR>`
3. Verifique se o container está rodando: `docker ps`

### Container não inicia?
```bash
# Ver logs detalhados
docker logs ucm-backend

# Verificar variáveis
docker exec ucm-backend env | grep -E 'DATABASE|REDIS|JWT'
```

### Problema de rede?
```bash
# Verificar networks
docker network ls
docker network inspect deploy_ucm-net
```

---

## 8. Estrutura de Arquivos

```
unified-commerce-platform/
├── .github/
│   └── workflows/
│       ├── ci.yml              # CI (testes)
│       ├── codeql.yml          # Análise de código
│       └── deploy-prod.yml     # DEPLOY PRODUÇÃO ←
├── backend/
│   ├── Dockerfile
│   └── src/
├── frontend/
│   ├── Dockerfile
│   └── src/
└── docs/
    └── DEPLOY-GITHUB.md        # Este arquivo
```

---

## 9. URLs de Imagens

Após o primeiro deploy, as imagens estarão disponíveis em:

- Backend: `ghcr.io/<owner>/ucm-backend:sha-<commit>`
- Frontend: `ghcr.io/<owner>/ucm-frontend:sha-<commit>`

Visualizar em: `https://github.com/<owner>/<repo>/packages`

---

## 10. Segurança

### Boas Práticas:
- ✅ Use chave SSH específica para deploy
- ✅ Não commit secrets no código
- ✅ Rotate senhas periodicamente
- ✅ Monitore logs de deploy

### Permissões Mínimas:
- `GITHUB_TOKEN`: apenas `packages:write`
- SSH key: apenas no servidor VPS (não no repositório)

---

## Próximos Passos

1. ✅ Workflow criado
2. ⬜ Configurar secrets no GitHub
3. ⬜ Testar deploy com push para main

---

*Documento criado em: $(date)*
*Versão: 1.0*