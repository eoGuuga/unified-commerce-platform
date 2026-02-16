> LEGADO: documento historico. Fonte de verdade: docs/CONSOLIDADO/README.md
> Servidor/comandos: docs/CONSOLIDADO/10-SERVIDOR-COMANDOS.md
# Como Usar Banco do Servidor (24/7) â€” Guia RÃ¡pido

> **Objetivo:** Usar PostgreSQL e Redis do servidor para desenvolvimento/testes, sem precisar do Docker Desktop local.

---

## ðŸš€ Setup RÃ¡pido (5 minutos)

### 1. No Servidor (SSH)

```bash
# Conectar no servidor
ssh ubuntu@gtsofthub.com.br

# Ir para o projeto
cd /opt/ucm

# Rodar script de setup (faz tudo automaticamente)
chmod +x deploy/scripts/setup-dev-env.sh
bash deploy/scripts/setup-dev-env.sh
```

**O que o script faz:**
- âœ… Cria containers `ucm-postgres-dev` e `ucm-redis-dev`
- âœ… Aplica todas as migrations
- âœ… Cria usuÃ¡rio do app (nÃ£o-superuser)
- âœ… Tudo pronto para usar!

---

### 2. No Seu PC (Windows)

**A) Criar SSH Tunnel (deixar rodando):**

```powershell
# Abrir um terminal PowerShell e deixar rodando
ssh -L 5433:localhost:5433 -L 6380:localhost:6380 ubuntu@gtsofthub.com.br -N
```

**âš ï¸ IMPORTANTE:** Deixe esse terminal aberto! Ele cria o "tÃºnel" entre seu PC e o servidor.

---

**B) Configurar .env no Backend:**

```powershell
# No backend/
cd backend

# Criar .env com conexÃ£o para o servidor
@"
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ucm_dev
REDIS_URL=redis://localhost:6380
JWT_SECRET=dev-jwt-secret-change-in-production-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
ENCRYPTION_KEY=dev-encryption-key-change-in-production-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789
FRONTEND_URL=http://localhost:3000
ENABLE_SWAGGER=true
"@ | Out-File -FilePath .env -Encoding utf8
```

---

**C) Testar ConexÃ£o:**

```powershell
# Rodar backend
cd backend
npm run start:dev

# Em outro terminal, rodar testes
npm run test:integration
```

---

## âœ… Pronto!

**Status:** âœ… **AMBIENTE CONFIGURADO E FUNCIONANDO**

Agora vocÃª tem:
- âœ… PostgreSQL rodando 24/7 no servidor (porta 5433, banco: `ucm_dev`)
- âœ… Redis rodando 24/7 no servidor (porta 6380)
- âœ… Migrations aplicadas
- âœ… UsuÃ¡rio `ucm_app` criado
- âœ… Containers com restart automÃ¡tico

**PrÃ³ximo passo:** Criar SSH Tunnel e configurar `.env` no seu PC (veja abaixo).

---

## ðŸ“‹ Comandos Ãšteis

### Verificar Containers no Servidor

```bash
# Via SSH
ssh ubuntu@gtsofthub.com.br
docker ps | grep -E "postgres-dev|redis-dev"
```

### Reiniciar Containers

```bash
# No servidor
cd /opt/ucm
docker compose -f deploy/docker-compose.dev.yml restart
```

### Ver Logs

```bash
# No servidor
docker compose -f deploy/docker-compose.dev.yml logs -f
```

---

## ðŸ”’ SeguranÃ§a

**Portas 5433 e 6380 estÃ£o bindadas apenas em `127.0.0.1` (localhost do servidor).**

**Isso significa:**
- âœ… NÃ£o estÃ£o expostas externamente
- âœ… Apenas processos no servidor podem acessar
- âœ… Para acessar do seu PC, precisa do SSH Tunnel

---

## ðŸ“š DocumentaÃ§Ã£o Completa

- **Guia detalhado:** `deploy/AMBIENTE-DEVELOPMENT-VPS.md`
- **Como rodar testes:** `backend/COMO-RODAR-TESTES.md`

---

**Ãšltima atualizaÃ§Ã£o:** 09/01/2026

