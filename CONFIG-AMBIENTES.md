# 🏗️ **CONFIGURAÇÃO DE AMBIENTES SEPARADOS**

## 🎯 **VISÃO GERAL**

O sistema agora suporta **dois ambientes completamente separados**:

- **🛠️ DEV**: Ambiente de desenvolvimento e testes
- **🚀 PROD**: Ambiente de produção público

---

## 📋 **DIFERENÇAS ENTRE AMBIENTES**

| Aspecto | Ambiente DEV | Ambiente PROD |
|---------|--------------|---------------|
| **Portas** | Backend: 3002, Frontend: 3003 | Nginx: 80/443 |
| **Banco** | `ucm_dev` (porta 5433) | `ucm_prod` (porta 5432) |
| **Dados** | Seeds de teste automáticos | Dados reais de produção |
| **Segurança** | CORS permissivo, JWT simples | Segurança máxima |
| **Logs** | Verbose para debug | Otimizado para produção |
| **WhatsApp** | Mock (simulado) | Twilio/Evolution API |
| **Pagamentos** | Sandbox Mercado Pago | Produção Mercado Pago |

---

## 🚀 **INICIANDO AMBIENTE DEV**

```powershell
# 1. Ambiente de desenvolvimento (hot reload, dados de teste)
.\INICIAR-DEV.ps1

# Acessos DEV:
# 🌐 Frontend: http://localhost:3003
# 🔧 Backend:  http://localhost:3002
# 🗄️  Banco:   localhost:5433 (ucm_dev/ucm_dev/dev_password_2026)
# 🤖 IA:       localhost:11435 (Ollama)
```

**Características DEV:**
- ✅ Hot reload automático
- ✅ Dados de teste pré-carregados
- ✅ IA Ollama integrada
- ✅ Mercado Pago sandbox
- ✅ Logs verbosos
- ✅ Sem impacto na produção

---

## 🚀 **INICIANDO AMBIENTE PROD**

```powershell
# 1. Configurar variáveis de ambiente
# Copie .env.example para .env e configure

# 2. Iniciar produção
.\INICIAR-PRODUCAO.ps1

# Acesso PROD:
# 🌐 Site: https://seudominio.com
# 🔧 API:  https://seudominio.com/api/v1
```

**Características PROD:**
- ✅ Nginx com SSL automático
- ✅ Segurança máxima
- ✅ Otimização de performance
- ✅ WhatsApp real integrado
- ✅ Mercado Pago produção
- ✅ Backups automáticos

---

## 📊 **VERIFICANDO STATUS**

```powershell
# Ver status de ambos os ambientes
.\STATUS-AMBIENTES.ps1
```

**Saída exemplo:**
```
🐳 Docker: ✅ rodando
🛠️  DEV: 🟢 RODANDO (3 containers)
🚀 PROD: 🟢 RODANDO (5 containers)
💻 Recursos: CPU OK, RAM OK
💾 Backups: 3 backups disponíveis
```

---

## 🛑 **PARANDO AMBIENTES**

```powershell
# Parar apenas desenvolvimento
.\PARAR-DEV.ps1

# Parar produção (CUIDADO!)
.\PARAR-PRODUCAO.ps1
```

---

## 🔧 **CONFIGURAÇÃO .env PARA PRODUÇÃO**

```bash
# Arquivo .env (produção)
DB_USERNAME=seu_usuario_prod
DB_PASSWORD=sua_senha_forte_prod
JWT_SECRET=jwt_secret_muito_forte_prod_2026
MERCADOPAGO_ACCESS_TOKEN=APP_USR_..._prod
MERCADOPAGO_PUBLIC_KEY=APP_USR_..._prod
WHATSAPP_PROVIDER=twilio  # ou evolution
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+5511999999999
DEFAULT_TENANT_ID=prod-tenant-001
CORS_ORIGIN=https://seudominio.com
```

---

## 🔄 **FLUXO DE DESENVOLVIMENTO**

### **1. Desenvolvimento**
```bash
# Trabalhe no ambiente DEV
.\INICIAR-DEV.ps1
# Faça mudanças no código
# Teste em localhost:3003
```

### **2. Testes**
```bash
# Teste funcionalidades
.\scripts\test-whatsapp-ai.ps1
# Teste pagamentos
.\scripts\test-payments-mercadopago.ps1
```

### **3. Deploy**
```bash
# Quando estiver pronto
.\PARAR-PRODUCAO.ps1  # Para deploy
# Faça deploy das mudanças
.\INICIAR-PRODUCAO.ps1
```

---

## 💡 **DICAS IMPORTANTES**

### **🚨 Nunca teste em produção:**
- Use sempre DEV para desenvolvimento
- PROD é só para código testado e aprovado

### **💾 Backups automáticos:**
- Produção faz backup automático antes de parar
- Backups ficam em `backups/` com timestamp

### **🔄 Atualizações seguras:**
- Sempre teste no DEV primeiro
- Faça backup antes de atualizar PROD
- Use migrações para mudanças no banco

### **📊 Monitoramento:**
- Use `.\STATUS-AMBIENTES.ps1` para ver status
- Logs DEV: `docker logs ucm-backend-dev`
- Logs PROD: `docker logs ucm-backend-prod`

---

## 🎯 **RESUMO**

**Agora você tem:**
- **🛠️ DEV**: Ambiente seguro para desenvolvimento
- **🚀 PROD**: Site público otimizado
- **📊 Status**: Monitoramento completo
- **🔄 Deploy**: Processo seguro de atualizações

**Workflow perfeito: Desenvolva no DEV → Teste tudo → Deploy no PROD!** 🚀✨