#!/bin/bash
# ==============================================
# SCRIPT DE CONFIGURAÇÃO DO DEPLOY VIA GITHUB
# ==============================================
# Execute este script no servidor VPS como root
# ==============================================

set -e

echo "=========================================="
echo "  CONFIGURAÇÃO DEPLOY GITHUB ACTIONS"
echo "=========================================="
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${GREEN}[✓]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

error() {
    echo -e "${RED}[✗]${NC} $1"
}

# ============================================
# 1. Verificar prerequisites
# ============================================
echo "1. Verificando prerequisites..."

if ! command -v docker &> /dev/null; then
    error "Docker não está instalado!"
    exit 1
fi
log "Docker encontrado"

if ! command -v curl &> /dev/null; then
    error "curl não está instalado!"
    exit 1
fi
log "curl encontrado"

# ============================================
# 2. Verificar/ criar network
# ============================================
echo ""
echo "2. Configurando networks Docker..."

# Network para deploy
if ! docker network ls | grep -q "deploy_ucm-net"; then
    docker network create deploy_ucm-net
    log "Network 'deploy_ucm-net' criada"
else
    log "Network 'deploy_ucm-net' já existe"
fi

# ============================================
# 3. Configurar firewall (se necessário)
# ============================================
echo ""
echo "3. Verificando firewall..."

if command -v ufw &> /dev/null; then
    # Permitir SSH
    ufw allow 22/tcp
    # Permitir HTTP/HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    log "Firewall configurado"
else
    warn "UFW não encontrado, firewall pode precisar de configuração manual"
fi

# ============================================
# 4. Configurar container names
# ============================================
echo ""
echo "4. Documentando containers..."

cat > /home/ubuntu/deploy-info.md << 'EOF'
# INFORMAÇÕES DE DEPLOY

## Containers em Produção:
- ucm-backend    → API NestJS (porta 3001)
- ucm-frontend  → Next.js (porta 3000)
- ucm-nginx     → Proxy reverso (portas 80, 443)
- ucm-postgres  → PostgreSQL (porta 5432)
- ucm-redis     → Redis (porta 6379)

## Networks:
- deploy_ucm-net → Rede principal de produção

## Como restartar:
docker restart ucm-backend ucm-nginx

## Como ver logs:
docker logs ucm-backend -f
docker logs ucm-nginx -f

## Como testar health:
curl -k https://<IP_DO_SERVIDOR>/api/v1/health
EOF

log "Informações de deploy salvas em /home/ubuntu/deploy-info.md"

# ============================================
# 5. Permitir conexões GHCR
# ============================================
echo ""
echo "5. Preparando para GitHub Container Registry..."

# Login no GHCR (vai pedir token depois)
echo ""
echo "Para fazer login no GHCR manualmente, execute:"
echo "docker login ghcr.io -u <seu-github-username>"
echo ""

# ============================================
# 6. Verificar variáveis de ambiente
# ============================================
echo ""
echo "6. Verificando variáveis de ambiente..."

if [ -f /home/ubuntu/deploy/.env ]; then
    log "Arquivo .env encontrado em /home/ubuntu/deploy/"
    echo "Variáveis disponíveis:"
    grep -E '^[A-Z]' /home/ubuntu/deploy/.env | head -10
else
    warn "Arquivo .env não encontrado"
fi

# ============================================
# 7. Summary
# ============================================
echo ""
echo "=========================================="
echo "  CONFIGURAÇÃO COMPLETA!"
echo "=========================================="
echo ""
echo "Próximos passos:"
echo ""
echo "1. Gere uma chave SSH para deploy:"
echo "   ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -C 'github-actions'"
echo ""
echo "2. Adicione a chave pública ao authorized_keys:"
echo "   cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys"
echo ""
echo "3. Configure os secrets no GitHub:"
echo "   - VPS_HOST: <IP_DO_SERVIDOR>"
echo "   - VPS_USER: ubuntu"
echo "   - VPS_SSH_KEY: conteúdo da chave privada"
echo "   - GHCR_TOKEN: token do GitHub"
echo ""
echo "4. Teste o deploy fazendo push para main"
echo ""
echo "=========================================="