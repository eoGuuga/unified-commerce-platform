# 🤖 Adaptação para Ollama (IA Gratuita)

> **Guia prático:** Como adaptar o código para usar Ollama em vez de OpenAI.

---

## 📋 Passo a Passo

### 1. Instalar Ollama

**Windows:**
1. Download: https://ollama.ai/download
2. Instalar e executar
3. Baixar modelo:

```bash
# Opção 1: Modelo pequeno e rápido
ollama pull llama3.2:3b

# Opção 2: Melhor qualidade
ollama pull mistral:7b

# Opção 3: Equilibrado
ollama pull phi3:mini
```

**Linux/Mac:**
```bash
curl https://ollama.ai/install.sh | sh
ollama pull llama3.2:3b
```

**Verificar se está rodando:**
```bash
# Terminal 1: Iniciar servidor
ollama serve

# Terminal 2: Testar
ollama run llama3.2:3b "Olá, tudo bem?"
```

---

### 2. Adaptar OpenAI Service

#### Opção A: Modificar existente (OpenAI Service)

**Arquivo:** `backend/src/modules/whatsapp/services/openai.service.ts`

```typescript
import { OpenAI } from 'openai';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    this.initializeOpenAI();
  }

  private initializeOpenAI() {
    const useOllama = this.configService.get<string>('USE_OLLAMA') === 'true';
    
    if (useOllama) {
      // Usar Ollama local
      const ollamaUrl = this.configService.get<string>('OLLAMA_URL') || 'http://localhost:11434/v1';
      const ollamaModel = this.configService.get<string>('OLLAMA_MODEL') || 'llama3.2:3b';
      
      this.openai = new OpenAI({
        baseURL: ollamaUrl,
        apiKey: 'ollama', // Não precisa, mas API requer
      });
      
      this.logger.log(`Using Ollama: ${ollamaUrl} with model ${ollamaModel}`);
    } else {
      // Usar OpenAI (quando houver verba)
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      
      if (apiKey) {
        this.openai = new OpenAI({ apiKey });
        this.logger.log('Using OpenAI');
      } else {
        this.logger.warn('No OpenAI API key configured, using fallback');
      }
    }
  }

  async processMessage(message: string): Promise<MessageIntent> {
    if (!this.openai) {
      return this.fallbackProcessing(message);
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OLLAMA_MODEL') || 'llama3.2:3b',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente de vendas de doces artesanais. Responda em português brasileiro.',
          },
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content || '';
      
      // Processar resposta (extrair intent)
      return this.parseResponse(response, message);
      
    } catch (error) {
      this.logger.error(`OpenAI/Ollama error: ${error}`);
      return this.fallbackProcessing(message);
    }
  }

  private parseResponse(response: string, originalMessage: string): MessageIntent {
    const lowerResponse = response.toLowerCase();
    const lowerMessage = originalMessage.toLowerCase();

    // Classificar intent baseado na resposta
    let intent: 'fazer_pedido' | 'cancelar' | 'consultar' | 'unknown' = 'unknown';
    let confidence = 0.5;

    if (lowerResponse.includes('pedido') || lowerMessage.includes('quero') || lowerMessage.includes('comprar')) {
      intent = 'fazer_pedido';
      confidence = 0.8;
    } else if (lowerResponse.includes('cancelar') || lowerMessage.includes('cancelar')) {
      intent = 'cancelar';
      confidence = 0.7;
    } else {
      intent = 'consultar';
      confidence = 0.6;
    }

    // Extrair quantidade (regex simples)
    const quantityMatch = originalMessage.match(/(\d+)/);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : undefined;

    return {
      intent,
      quantity,
      confidence,
    };
  }

  private fallbackProcessing(message: string): MessageIntent {
    // Fallback simples (sem IA)
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('quero') || lowerMessage.includes('preciso') || lowerMessage.includes('compra')) {
      return {
        intent: 'fazer_pedido',
        confidence: 0.6,
      };
    }

    if (lowerMessage.includes('cancelar') || lowerMessage.includes('desistir')) {
      return {
        intent: 'cancelar',
        confidence: 0.7,
      };
    }

    return {
      intent: 'consultar',
      confidence: 0.5,
    };
  }
}
```

#### Opção B: Criar Ollama Service separado

**Arquivo:** `backend/src/modules/whatsapp/services/ollama.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MessageIntent {
  intent: 'fazer_pedido' | 'cancelar' | 'consultar' | 'unknown';
  product?: string;
  quantity?: number;
  confidence: number;
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly baseURL: string;
  private readonly model: string;

  constructor(private configService: ConfigService) {
    this.baseURL = this.configService.get<string>('OLLAMA_URL') || 'http://localhost:11434';
    this.model = this.configService.get<string>('OLLAMA_MODEL') || 'llama3.2:3b';
  }

  async processMessage(message: string): Promise<MessageIntent> {
    try {
      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: `Você é um assistente de vendas de doces artesanais. 
          Analise a seguinte mensagem do cliente e retorne APENAS o intent:
          - "fazer_pedido" se o cliente quer comprar
          - "cancelar" se quer cancelar pedido
          - "consultar" se quer informações
          - "unknown" se não entender
          
          Mensagem: "${message}"
          
          Responda APENAS com: fazer_pedido, cancelar, consultar ou unknown`,
          stream: false,
        }),
      });

      const data = await response.json();
      const intentText = data.response?.trim().toLowerCase() || 'unknown';

      let intent: 'fazer_pedido' | 'cancelar' | 'consultar' | 'unknown' = 'unknown';
      let confidence = 0.5;

      if (intentText.includes('fazer_pedido')) {
        intent = 'fazer_pedido';
        confidence = 0.8;
      } else if (intentText.includes('cancelar')) {
        intent = 'cancelar';
        confidence = 0.7;
      } else if (intentText.includes('consultar')) {
        intent = 'consultar';
        confidence = 0.6;
      }

      // Extrair quantidade
      const quantityMatch = message.match(/(\d+)/);
      const quantity = quantityMatch ? parseInt(quantityMatch[1]) : undefined;

      return {
        intent,
        quantity,
        confidence,
      };

    } catch (error) {
      this.logger.error(`Ollama error: ${error}`);
      return this.fallbackProcessing(message);
    }
  }

  private fallbackProcessing(message: string): MessageIntent {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('quero') || lowerMessage.includes('preciso') || lowerMessage.includes('compra')) {
      return {
        intent: 'fazer_pedido',
        confidence: 0.6,
      };
    }

    if (lowerMessage.includes('cancelar') || lowerMessage.includes('desistir')) {
      return {
        intent: 'cancelar',
        confidence: 0.7,
      };
    }

    return {
      intent: 'consultar',
      confidence: 0.5,
    };
  }
}
```

---

### 3. Atualizar .env

**Adicionar ao `.env`:**

```env
# IA: Usar Ollama ou OpenAI
USE_OLLAMA=true
OLLAMA_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.2:3b

# OU (quando houver verba):
OPENAI_API_KEY=sk-xxx
USE_OLLAMA=false
```

---

### 4. Atualizar Module

**Arquivo:** `backend/src/modules/whatsapp/whatsapp.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { OpenAIService } from './services/openai.service';
// OU
import { OllamaService } from './services/ollama.service';
import { MockWhatsappProvider } from './providers/mock-whatsapp.provider';

@Module({
  imports: [ConfigModule],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    // Escolher um:
    OpenAIService, // (adaptado para Ollama)
    // OU
    OllamaService, // (service separado)
    
    // WhatsApp Provider (Mock para desenvolvimento)
    {
      provide: 'WHATSAPP_PROVIDER',
      useClass: MockWhatsappProvider,
    },
  ],
  exports: [WhatsappService],
})
export class WhatsappModule {}
```

---

### 5. Testar

**Teste manual:**

```bash
# Terminal 1: Iniciar Ollama
ollama serve

# Terminal 2: Testar modelo
ollama run llama3.2:3b "Quero 10 brigadeiros"
```

**Teste via API:**

```bash
# Testar endpoint
curl -X POST http://localhost:3001/api/v1/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "from": "5511999999999",
    "body": "Quero 10 brigadeiros"
  }'
```

---

## 📊 Comparação: Ollama vs OpenAI

| Aspecto | Ollama | OpenAI |
|---------|--------|--------|
| **Custo** | ✅ **Grátis** | ❌ ~$0.01-0.03/msg |
| **Latência** | ⚠️ 1-3s (local) | ✅ 0.5-1s (cloud) |
| **Qualidade** | ⚠️ Boa (7b) | ✅ Excelente (GPT-4) |
| **Configuração** | ⚠️ Precisa instalar | ✅ Só API key |
| **Português** | ⚠️ Funciona | ✅ Excelente |
| **Recomendação** | ✅ **Desenvolvimento** | ✅ **Produção** |

---

## 💡 Dicas

### 1. Usar Modelo Certo

- **llama3.2:3b** - Rápido, leve, desenvolvimento
- **mistral:7b** - Melhor qualidade, ainda rápido
- **llama3:8b** - Qualidade excelente, mais lento

### 2. Otimizar Prompts

- Seja claro e objetivo
- Use exemplos no prompt
- Peça resposta estruturada (JSON se possível)

### 3. Fallback Inteligente

- Sempre ter fallback (regex simples)
- Se Ollama falhar, usar fallback
- Logar erros para melhorar

---

## ✅ Checklist

- [ ] Instalar Ollama
- [ ] Baixar modelo (llama3.2:3b ou mistral:7b)
- [ ] Testar Ollama manualmente
- [ ] Adaptar OpenAI Service OU criar Ollama Service
- [ ] Atualizar .env
- [ ] Atualizar Module
- [ ] Testar endpoint WhatsApp
- [ ] Verificar logs
- [ ] Documentar mudanças

---

**Última atualização:** Janeiro 2025  
**Status:** ✅ Guia Completo