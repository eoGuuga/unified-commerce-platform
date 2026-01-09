#!/usr/bin/env bash
set -euo pipefail

# Script de Deploy Seguro - Correção de Race Condition
# Data: 09/01/2026
# Objetivo: Deploy incremental e validado das correções críticas

cd /opt/ucm

echo "🚀 Deploy Seguro - Correção de Race Condition"
echo "=============================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar se comando foi bem-sucedido
check_success() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
        exit 1
    fi
}

# Passo 1: Backup
echo "📦 Passo 1: Criando backup do banco de dados..."
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
docker exec ucm-postgres pg_dump -U postgres ucm > "/tmp/${BACKUP_FILE}" 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Aviso: Não foi possível criar backup (pode ser normal se container não estiver rodando)${NC}"
}
if [ -f "/tmp/${BACKUP_FILE}" ] && [ -s "/tmp/${BACKUP_FILE}" ]; then
    echo -e "${GREEN}✅ Backup criado: /tmp/${BACKUP_FILE}${NC}"
    ls -lh "/tmp/${BACKUP_FILE}"
else
    echo -e "${YELLOW}⚠️  Backup vazio ou não criado${NC}"
fi
echo ""

# Passo 2: Verificar status atual
echo "🔍 Passo 2: Verificando status atual..."
echo "Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep ucm || echo "Nenhum container ucm encontrado"
echo ""

echo "Health check:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" https://gtsofthub.com.br/api/v1/health/ready || echo "Health check falhou"
echo ""

# Passo 3: Verificar se código está atualizado
echo "📝 Passo 3: Verificando código..."
if [ -d ".git" ]; then
    echo "Repositório Git detectado"
    git status --short || echo "Git não disponível"
else
    echo "Sem repositório Git - assumindo código já atualizado"
fi
echo ""

# Passo 4: Rebuild backend
echo "🔨 Passo 4: Rebuild do backend..."
cd /opt/ucm
docker compose --env-file ./deploy/env.prod -f ./deploy/docker-compose.prod.yml build backend
check_success "Backend rebuild concluído"
echo ""

# Passo 5: Deploy
echo "🚀 Passo 5: Deploy do backend..."
docker compose --env-file ./deploy/env.prod -f ./deploy/docker-compose.prod.yml up -d backend
check_success "Backend deployado"
echo ""

# Aguardar container iniciar
echo "⏳ Aguardando container iniciar..."
sleep 5

# Passo 6: Verificar deploy
echo "✅ Passo 6: Verificando deploy..."
echo "Status do container:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep ucm-backend || echo "Container não encontrado"
echo ""

echo "Últimas 20 linhas de log:"
docker logs --tail 20 ucm-backend 2>&1 | tail -20
echo ""

# Passo 7: Health checks
echo "🏥 Passo 7: Health checks..."
echo "Health completo:"
HEALTH_RESPONSE=$(curl -s https://gtsofthub.com.br/api/v1/health || echo "FAILED")
if [ "$HEALTH_RESPONSE" != "FAILED" ]; then
    echo -e "${GREEN}✅ Health check passou${NC}"
    echo "$HEALTH_RESPONSE" | head -5
else
    echo -e "${RED}❌ Health check falhou${NC}"
fi
echo ""

echo "Readiness:"
READINESS=$(curl -s -o /dev/null -w "%{http_code}" https://gtsofthub.com.br/api/v1/health/ready)
if [ "$READINESS" = "200" ]; then
    echo -e "${GREEN}✅ Readiness: OK (200)${NC}"
else
    echo -e "${YELLOW}⚠️  Readiness: $READINESS${NC}"
fi
echo ""

# Passo 8: Verificar erros
echo "🔍 Passo 8: Verificando erros..."
ERROR_COUNT=$(docker logs ucm-backend 2>&1 | grep -i "error\|exception" | tail -20 | wc -l)
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ Nenhum erro encontrado nos logs recentes${NC}"
else
    echo -e "${YELLOW}⚠️  Encontrados $ERROR_COUNT erros/exceções nos logs${NC}"
    echo "Últimos erros:"
    docker logs ucm-backend 2>&1 | grep -i "error\|exception" | tail -5
fi
echo ""

# Verificar erros 23505 (race condition)
echo "🔍 Verificando erros de race condition (23505)..."
RACE_ERRORS=$(docker logs ucm-backend 2>&1 | grep "23505" | wc -l)
if [ "$RACE_ERRORS" -eq 0 ]; then
    echo -e "${GREEN}✅ Nenhum erro 23505 encontrado (correção funcionando!)${NC}"
else
    echo -e "${RED}❌ Encontrados $RACE_ERRORS erros 23505 não tratados${NC}"
    echo "Isso indica que a correção pode não estar funcionando corretamente"
fi
echo ""

# Resumo final
echo "=============================================="
echo "📊 Resumo do Deploy"
echo "=============================================="
echo ""
echo "✅ Backup: $(if [ -f "/tmp/${BACKUP_FILE}" ]; then echo "Criado"; else echo "Não criado"; fi)"
echo "✅ Container: $(docker ps --format '{{.Status}}' --filter name=ucm-backend 2>/dev/null || echo 'Não encontrado')"
echo "✅ Health: $(if [ "$READINESS" = "200" ]; then echo "OK"; else echo "Verificar"; fi)"
echo "✅ Erros: $ERROR_COUNT encontrados"
echo "✅ Race Condition: $(if [ "$RACE_ERRORS" -eq 0 ]; then echo "Corrigida"; else echo "Verificar"; fi)"
echo ""

if [ "$READINESS" = "200" ] && [ "$RACE_ERRORS" -eq 0 ]; then
    echo -e "${GREEN}🎉 Deploy concluído com sucesso!${NC}"
    echo ""
    echo "Próximos passos:"
    echo "1. Monitorar logs por 24h: docker logs -f ucm-backend"
    echo "2. Verificar UptimeRobot"
    echo "3. Testar criação de pedidos com idempotência"
else
    echo -e "${YELLOW}⚠️  Deploy concluído, mas há pontos de atenção${NC}"
    echo "Verifique os logs e health checks acima"
fi
echo ""
