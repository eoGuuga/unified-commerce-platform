# 💰 Estratégia Free Tier - Desenvolvimento Sem Custo

> **Objetivo:** Continuar desenvolvimento do projeto **100% gratuito** usando alternativas e tier gratuito de serviços.

---

## 📊 Análise de Serviços Pagos vs. Gratuitos

### ✅ Serviços JÁ Gratuitos (ou têm tier gratuito generoso)

| Serviço | Uso Atual | Alternativa Gratuita | Status |
|---------|-----------|---------------------|--------|
| **PostgreSQL** | Supabase | **Docker local** (PostgreSQL) | ✅ **GRÁTIS** |
| **Redis** | Upstash | **Docker local** (Redis) | ✅ **GRÁTIS** |
| **Frontend/Backend Deploy** | Vercel | **Vercel Free Tier** | ✅ **GRÁTIS** (até certo ponto) |
| **Email** | Resend | **Resend Free Tier** (3000 emails/mês) | ✅ **GRÁTIS** |
| **Storage Imagens** | Vercel Blob | **Vercel Blob Free Tier** (1GB) | ✅ **GRÁTIS** |
| **Database Cloud** | Supabase | **Supabase Free Tier** (500MB DB) | ✅ **GRÁTIS** |

### ❌ Serviços que Precisam de Dinheiro

| Serviço | Custo | Alternativa Gratuita | Estratégia |
|---------|-------|---------------------|-----------|
| **OpenAI (GPT-4)** | ~$0.01-0.03/mensagem | **Ollama (local)** ou **LM Studio** | ✅ **GRÁTIS** - Modelos open-source |
| **WhatsApp API** | Twilio: $0.01/msg | **Evolution API (self-hosted)** ou **Mock** | ⚠️ **Complicado** - Ver abaixo |
| **Stripe (Pagamentos)** | 2.9% + $0.30 | **Mock/Simulador** | ✅ **GRÁTIS** - Para desenvolvimento |

---

## 🎯 Estratégias por Serviço

### 1. 🤖 IA (OpenAI) → **Ollama/LM Studio (GRÁTIS)**

**Problema:** OpenAI GPT-4 custa ~$0.01-0.03 por mensagem.

**Solução:** Usar modelos open-source rodando localmente.

#### Opção A: Ollama (Recomendado)

**Vantagens:**
- ✅ **100% Gratuito**
- ✅ Rodando local na sua máquina
- ✅ Modelos como Llama 3, Mistral, Phi
- ✅ API compatível com OpenAI
- ✅ Suporta português

**Setup:**
```bash
# Instalar Ollama (Windows)
# Download: https://ollama.ai/download

# Baixar modelo (escolha um)
ollama pull llama3.2:3b        # Modelo pequeno e rápido
ollama pull mistral:7b         # Melhor qualidade
ollama pull phi3:mini          # Equilibrado

# Iniciar servidor
ollama serve
```

**Adaptar código:**
```typescript
// backend/src/modules/whatsapp/services/openai.service.ts
import { OpenAI } from 'openai';

// Em vez de:
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Use:
const openai = new OpenAI({
  baseURL: 'http://localhost:11434/v1', // Ollama endpoint
  apiKey: 'ollama', // Não precisa, mas API requer
});
```

**Modelo recomendado para começar:**
- **Llama 3.2:3b** - Rápido, leve, português OK
- **Mistral:7b** - Melhor qualidade, ainda rápido

#### Opção B: LM Studio (Interface Gráfica)

- ✅ Interface visual
- ✅ Fácil de usar
- ✅ Múltiplos modelos
- Download: https://lmstudio.ai

---

### 2. 💬 WhatsApp → **Evolution API (Self-Hosted) ou Mock**

**Problema:** Twilio custa ~$0.01 por mensagem.

**Solução A: Evolution API (Self-Hosted)** ⭐ Recomendado

**Vantagens:**
- ✅ **100% Gratuito**
- ✅ Usa WhatsApp oficial (não API oficial, mas funciona)
- ✅ Self-hosted (você controla)
- ✅ API REST completa

**Setup:**
```bash
# Opção 1: Docker (mais fácil)
docker run -d \
  --name evolution-api \
  -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=SUA_CHAVE \
  atendai/evolution-api:latest

# Opção 2: Cloud (Railway/Render) - Free Tier
# Deploy: https://github.com/EvolutionAPI/evolution-api
```

**Adaptar código:**
```typescript
// Criar EvolutionApiProvider
export class EvolutionApiProvider implements IWhatsappProvider {
  private baseURL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
  
  async sendMessage(to: string, message: string) {
    await fetch(`${this.baseURL}/message/sendText/${this.instanceName}`, {
      method: 'POST',
      headers: { 'apikey': process.env.EVOLUTION_API_KEY },
      body: JSON.stringify({ number: to, text: message })
    });
  }
}
```

**Limitações:**
- ⚠️ Precisa conectar WhatsApp manualmente (QR Code)
- ⚠️ Pode ser bloqueado pelo WhatsApp (mas raramente)

**Solução B: Mock/Simulador** ⭐ Para Desenvolvimento

**Vantagens:**
- ✅ **100% Gratuito**
- ✅ Testa toda a lógica sem WhatsApp real
- ✅ Desenvolvimento rápido

**Implementação:**
```typescript
// Criar MockWhatsappProvider
export class MockWhatsappProvider implements IWhatsappProvider {
  private messages: Array<{to: string, message: string}> = [];

  async sendMessage(to: string, message: string) {
    console.log(`[MOCK] WhatsApp → ${to}]: ${message}`);
    this.messages.push({ to, message });
    // Salvar em arquivo ou DB para testar
  }

  // Simular recebimento de mensagem
  async simulateIncomingMessage(from: string, body: string) {
    await this.processIncomingMessage({ from, body, timestamp: Date.now() });
  }
}
```

**Para testar:**
```typescript
// test/whatsapp.test.ts
const mockProvider = new MockWhatsappProvider();
await mockProvider.simulateIncomingMessage('5511999999999', 'Quero 10 brigadeiros');
// Verificar resposta
```

**Recomendação:**
- **Desenvolvimento:** Use Mock
- **Testes com cliente real:** Use Evolution API
- **Produção (futuro):** Avaliar Twilio quando houver verba

---

### 3. 💳 Pagamentos (Stripe) → **Mock/Simulador**

**Problema:** Stripe cobra 2.9% + $0.30 por transação.

**Solução:** Mock/Simulador para desenvolvimento.

**Implementação:**
```typescript
// Criar MockPaymentProvider
export class MockPaymentProvider {
  async createPaymentIntent(amount: number) {
    // Simula criação de Payment Intent
    return {
      id: `pi_mock_${Date.now()}`,
      client_secret: 'mock_secret',
      status: 'requires_payment_method'
    };
  }

  async confirmPayment(paymentIntentId: string) {
    // Simula confirmação (sempre sucesso no mock)
    return {
      id: paymentIntentId,
      status: 'succeeded',
      amount: 10000
    };
  }

  async generatePixQRCode(amount: number) {
    // Simula QR Code Pix
    return {
      qr_code: '00020126360014BR.GOV.BCB.PIX...',
      qr_code_image: 'data:image/png;base64,...'
    };
  }
}
```

**Para testes de pagamento:**
```typescript
// test/payments.test.ts
const mockProvider = new MockPaymentProvider();
const payment = await mockProvider.createPaymentIntent(10000);
const confirmed = await mockProvider.confirmPayment(payment.id);
expect(confirmed.status).toBe('succeeded');
```

**Recomendação:**
- **Desenvolvimento:** Use Mock
- **Testes locais:** Use Stripe Test Mode (gratuito, mas precisa cadastro)
- **Produção (futuro):** Integrar Stripe real quando houver vendas

---

### 4. 🗄️ Database → **Docker Local (GRÁTIS)**

**Solução:** PostgreSQL e Redis rodando local via Docker.

**Já está configurado:**
```yaml
# docker-compose.yml (já existe)
services:
  postgres:
    image: postgres:15
    # ...
  redis:
    image: redis:7
    # ...
```

**Comandos:**
```bash
# Iniciar
docker-compose up -d postgres redis

# Parar
docker-compose down
```

**Vantagens:**
- ✅ **100% Gratuito**
- ✅ Sem limites de uso
- ✅ Dados ficam locais (privacidade)
- ✅ Rápido (sem latência de rede)

**Desvantagens:**
- ⚠️ Precisa rodar Docker localmente
- ⚠️ Não funciona quando PC está desligado

**Alternativa Cloud (quando precisar):**
- **Supabase Free Tier:** 500MB DB, 2GB bandwidth/mês
- **Neon (PostgreSQL):** 0.5GB DB, sem limite de tempo

---

### 5. 📧 Email → **Resend Free Tier (GRÁTIS)**

**Resend Free Tier:**
- ✅ 3.000 emails/mês grátis
- ✅ Sem cartão de crédito necessário
- ✅ API simples
- ✅ Suporte HTML

**Setup:**
```bash
# Criar conta em resend.com (gratuito)
# Obter API key
# Adicionar ao .env:
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@seudominio.com
```

**Limitações:**
- ⚠️ 3.000 emails/mês (suficiente para desenvolvimento)
- ⚠️ Precisa de domínio verificado (mas pode usar domínio de teste)

**Alternativa (se precisar mais):**
- **SMTP local (MailHog):** Mock para desenvolvimento
- **Gmail SMTP:** Grátis, mas limitado

---

### 6. 🚀 Deploy → **Vercel Free Tier + Railway/Render**

**Vercel Free Tier:**
- ✅ 100GB bandwidth/mês
- ✅ Deploy automático (GitHub)
- ✅ HTTPS automático
- ✅ Preview deployments

**Railway/Render Free Tier:**
- ✅ $5 crédito/mês (Railway)
- ✅ 750 horas/mês (Render)
- ✅ Deploy automático

**Estratégia:**
1. **Frontend:** Vercel (Next.js)
2. **Backend:** Railway/Render (NestJS)
3. **Database:** Docker local OU Supabase Free

---

## 📋 Plano de Implementação Gratuito

### FASE 1: Setup Gratuito (1-2 dias)

1. **Instalar Ollama** (IA local)
   ```bash
   # Download: https://ollama.ai
   ollama pull llama3.2:3b
   ```

2. **Configurar Docker** (PostgreSQL + Redis)
   ```bash
   docker-compose up -d
   ```

3. **Criar Providers Mock**
   - `MockWhatsappProvider`
   - `MockPaymentProvider`

4. **Adaptar OpenAI Service**
   - Usar Ollama em vez de OpenAI
   - Ou manter fallback simples

### FASE 2: Desenvolvimento (Semanas 1-8)

- ✅ **IA:** Ollama local
- ✅ **WhatsApp:** Mock (desenvolvimento) ou Evolution API (testes)
- ✅ **Pagamentos:** Mock
- ✅ **Database:** Docker local
- ✅ **Email:** Resend Free
- ✅ **Deploy:** Vercel Free + Railway Free

### FASE 3: Testes com Cliente Real (Quando Pronto)

- ✅ **WhatsApp:** Evolution API (self-hosted) ou Evolution API Cloud (free tier)
- ✅ **IA:** Ollama (se performance OK) ou OpenAI (se necessário)
- ✅ **Pagamentos:** Continuar Mock até primeiro cliente pago

---

## 💡 Estratégias Adicionais

### 1. **Desenvolvimento Local Completo**

Tudo rodando local:
- ✅ PostgreSQL (Docker)
- ✅ Redis (Docker)
- ✅ Backend (npm run start:dev)
- ✅ Frontend (npm run dev)
- ✅ Ollama (IA)
- ✅ Mock WhatsApp/Pagamentos

**Vantagens:**
- ✅ **Zero custo**
- ✅ Rápido (sem latência)
- ✅ Dados privados

### 2. **Usar Credits/Trials**

Alguns serviços oferecem créditos iniciais:
- **Railway:** $5 crédito/mês (free tier)
- **Render:** 750 horas/mês (free tier)
- **Supabase:** 500MB DB (free tier)

### 3. **Desenvolvimento em Fases**

1. **Fase 1 (Agora):** Tudo local + Mock
2. **Fase 2 (MVP):** Usar free tiers (Supabase, Vercel)
3. **Fase 3 (Clientes):** Migrar para serviços pagos conforme necessário

---

## 🔧 Configuração Recomendada (100% Grátis)

### `.env` (Desenvolvimento)

```env
# Database (Docker Local)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ucm

# Redis (Docker Local)
REDIS_URL=redis://localhost:6379

# IA (Ollama Local)
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3.2:3b

# WhatsApp (Mock)
WHATSAPP_PROVIDER=mock
# OU Evolution API (quando configurado)
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua_chave

# Pagamentos (Mock)
PAYMENT_PROVIDER=mock

# Email (Resend Free)
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@seudominio.com

# Deploy (Vercel Free)
VERCEL_URL=https://seu-projeto.vercel.app

# JWT
JWT_SECRET=seu-jwt-secret-super-seguro
```

---

## ✅ Checklist de Migração Gratuita

- [ ] Instalar Ollama e baixar modelo (llama3.2:3b ou mistral:7b)
- [ ] Adaptar `OpenAIService` para usar Ollama
- [ ] Criar `MockWhatsappProvider`
- [ ] Criar `MockPaymentProvider`
- [ ] Configurar Docker (PostgreSQL + Redis)
- [ ] Criar conta Resend (free tier)
- [ ] Atualizar documentação com alternativas
- [ ] Testar todo o fluxo localmente
- [ ] Deploy frontend no Vercel (free)
- [ ] Deploy backend no Railway/Render (free)

---

## 🎯 Conclusão

**É possível desenvolver 100% gratuitamente usando:**
1. ✅ **Docker local** (PostgreSQL + Redis)
2. ✅ **Ollama** (IA open-source)
3. ✅ **Mock providers** (WhatsApp + Pagamentos)
4. ✅ **Resend Free** (Email)
5. ✅ **Vercel Free** (Deploy frontend)
6. ✅ **Railway/Render Free** (Deploy backend)

**Quando precisar de serviços pagos:**
- Após primeiro cliente pago
- Quando performance local não for suficiente
- Quando precisar de WhatsApp oficial (Twilio)

**Recomendação:**
- Começar **100% local + Mock**
- Migrar para **free tiers cloud** quando necessário
- Migrar para **serviços pagos** quando houver receita

---

**Última atualização:** Janeiro 2025  
**Status:** ✅ Estratégia 100% Gratuita Validada