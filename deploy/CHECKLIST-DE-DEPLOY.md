# ✅ Checklist de Deploy — Caminho Seguro

> **Objetivo:** Deploy seguro e validado  
> **Filosofia:** Pequeno, frequente e testado

---

## 🔄 Deploy das Correções Críticas (Race Condition)

### **Pré-Deploy (5 minutos)**

- [ ] **1. Backup do Banco de Dados**
  ```bash
  # No servidor (SSH)
  cd /opt/ucm
  docker exec ucm-postgres pg_dump -U postgres ucm > backup-$(date +%Y%m%d-%H%M%S).sql
  
  # Verificar que backup foi criado
  ls -lh backup-*.sql
  ```

- [ ] **2. Verificar Status Atual**
  ```bash
  # Verificar containers
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  
  # Health check
  curl -I https://gtsofthub.com.br/api/v1/health/ready
  
  # Verificar logs recentes
  docker logs --tail 20 ucm-backend
  ```

- [ ] **3. Preparar Código**
  ```bash
  # Opção A: Se usar Git
  cd /opt/ucm
  git pull origin main  # ou branch apropriada
  
  # Opção B: Se fazer upload manual
  # Fazer upload dos arquivos corrigidos:
  # - backend/src/modules/common/services/idempotency.service.ts
  # - backend/src/modules/common/services/idempotency.integration.spec.ts
  ```

---

### **Deploy (5 minutos)**

- [ ] **4. Rebuild Backend**
  ```bash
  cd /opt/ucm
  docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml build backend
  ```

- [ ] **5. Deploy Backend**
  ```bash
  docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d backend
  ```

- [ ] **6. Verificar Deploy**
  ```bash
  # Verificar que container subiu
  docker ps | grep ucm-backend
  
  # Verificar logs iniciais
  docker logs --tail 50 ucm-backend
  ```

---

### **Validação Imediata (10 minutos)**

- [ ] **7. Health Checks**
  ```bash
  # Health completo
  curl https://gtsofthub.com.br/api/v1/health
  
  # Readiness
  curl https://gtsofthub.com.br/api/v1/health/ready
  
  # Liveness
  curl https://gtsofthub.com.br/api/v1/health/live
  ```

- [ ] **8. Verificar Erros**
  ```bash
  # Verificar se não há erros críticos
  docker logs ucm-backend | grep -i "error\|exception" | tail -20
  
  # Verificar conexão com banco
  docker logs ucm-backend | grep -i "database\|postgres" | tail -10
  ```

- [ ] **9. Smoke Test Básico**
  ```bash
  # Testar endpoint raiz
  curl https://gtsofthub.com.br/api/v1/
  
  # Testar health
  curl https://gtsofthub.com.br/api/v1/health
  ```

---

### **Validação Funcional (15 minutos)**

- [ ] **10. Testar Idempotência (Race Condition)**
  
  **Cenário:** Fazer 2 requests simultâneos com mesma chave de idempotência
  
  ```bash
  # Terminal 1
  curl -X POST https://gtsofthub.com.br/api/v1/orders \
    -H "Authorization: Bearer $TOKEN" \
    -H "Idempotency-Key: test-race-$(date +%s)" \
    -H "Content-Type: application/json" \
    -d '{"items": [...]}'
  
  # Terminal 2 (simultâneo, mesma chave)
  curl -X POST https://gtsofthub.com.br/api/v1/orders \
    -H "Authorization: Bearer $TOKEN" \
    -H "Idempotency-Key: test-race-$(date +%s)" \
    -H "Content-Type: application/json" \
    -d '{"items": [...]}'
  ```
  
  **Resultado esperado:** Ambos retornam o mesmo pedido (mesmo ID), sem erro.

- [ ] **11. Verificar Logs de Idempotência**
  ```bash
  # Verificar se não há erros 23505 não tratados
  docker logs ucm-backend | grep "23505" | tail -20
  
  # Se aparecer algum, investigar
  ```

---

### **Monitoramento (24 horas)**

- [ ] **12. Monitorar Logs**
  ```bash
  # Monitorar logs em tempo real (primeira hora)
  docker logs -f ucm-backend
  
  # Verificar logs das últimas 24h (após 24h)
  docker logs --since 24h ucm-backend | grep -i error | wc -l
  ```

- [ ] **13. Verificar UptimeRobot**
  - [ ] Acessar dashboard UptimeRobot
  - [ ] Verificar que não há downtime
  - [ ] Verificar que health checks estão passando

- [ ] **14. Métricas**
  - [ ] Tempo de resposta < 500ms
  - [ ] Taxa de erro < 0.1%
  - [ ] Zero erros `23505` não tratados

---

## 🚨 Plano de Rollback

### **Se algo der errado:**

- [ ] **1. Rollback Rápido (Container)**
  ```bash
  # Reiniciar container (pode resolver problemas temporários)
  docker restart ucm-backend
  
  # Ou fazer rollback para versão anterior
  cd /opt/ucm
  git checkout HEAD~1  # se usar git
  docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml build backend
  docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d backend
  ```

- [ ] **2. Rollback de Banco (Se necessário)**
  ```bash
  # Restaurar backup
  docker exec -i ucm-postgres psql -U postgres ucm < backup-YYYYMMDD-HHMMSS.sql
  ```

- [ ] **3. Verificar Após Rollback**
  ```bash
  curl https://gtsofthub.com.br/api/v1/health/ready
  docker logs --tail 50 ucm-backend
  ```

---

## ✅ Critérios de Sucesso

### **Deploy considerado bem-sucedido quando:**

- ✅ Health checks passando
- ✅ Zero erros críticos nos logs
- ✅ Smoke tests passando
- ✅ Idempotência funcionando (race condition corrigida)
- ✅ Zero downtime
- ✅ Tempo de resposta aceitável

---

## 📋 Próximos Passos (Após Validação)

1. **Esperar 24h de monitoramento**
2. **Validar que tudo está estável**
3. **Documentar sucesso do deploy**
4. **Prosseguir para Fase 2 (Estabilização) ou Fase 3 (Pagamentos)**

---

**Última atualização:** 09/01/2026
