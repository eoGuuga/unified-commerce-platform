# 🎯 PLANO COMPLETO DE IMPLEMENTAÇÃO - PARTE 2/8

## 📱 ESTRUTURA BASE PARA WHATSAPP BOT

**Objetivo desta Parte:** Implementar infraestrutura completa do WhatsApp Bot com suporte a múltiplos provedores (Twilio oficial e Evolution API para bootstrap), processamento em camadas e cache Redis.

**Tempo Estimado:** 2-3 semanas  
**Prioridade:** 🔴 CRÍTICA (funcionalidade principal)

---

## 1. 📦 DEPENDÊNCIAS NECESSÁRIAS

### 1.1 Instalar Pacotes

```bash
cd backend
npm install twilio @nestjs/bull bull ioredis
npm install --save-dev @types/twilio
```

**Pacotes:**
- `twilio` - SDK oficial do Twilio
- `@nestjs/bull` + `bull` - Queue para processamento assíncrono
- `ioredis` - Cliente Redis (já instalado, mas vamos usar)

### 1.2 Atualizar package.json

```json
{
  "dependencies": {
    "twilio": "^5.0.0",
    "@nestjs/bull": "^10.0.0",
    "bull": "^4.12.0",
    "ioredis": "^5.3.0"
  },
  "devDependencies": {
    "@types/twilio": "^3.19.0"
  }
}
```

---

## 2. 🔌 SERVIÇOS DE INTEGRAÇÃO WHATSAPP

### 2.1 Interface Abstrata para Provedores

**Arquivo:** `backend/src/modules/whatsapp/providers/whatsapp-provider.interface.ts`

```typescript
export interface SendMessageOptions {
  to: string;
  body: string;
  mediaUrl?: string;
  buttons?: Array<{ id: string; title: string }>;
}

export interface ReceivedMessage {
  from: string;
  body: string;
  messageId: string;
  timestamp: Date;
  mediaUrl?: string;
  buttonId?: string;
}

export interface IWhatsappProvider {
  /**
   * Envia mensagem de texto
   */
  sendMessage(options: SendMessageOptions): Promise<string>;

  /**
   * Envia mensagem com mídia (imagem, QR Code, etc)
   */
  sendMedia(options: SendMessageOptions): Promise<string>;

  /**
   * Valida assinatura do webhook (segurança)
   */
  validateWebhookSignature(
    payload: string,
    signature: string,
  ): Promise<boolean>;

  /**
   * Verifica se o provedor está configurado e funcionando
   */
  isConfigured(): boolean;

  /**
   * Retorna tipo do provedor
   */
  getProviderType(): 'twilio' | 'evolution' | 'wppconnect';
}
```

### 2.2 Implementação Twilio (Oficial)

**Arquivo:** `backend/src/modules/whatsapp/providers/twilio.provider.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Twilio from 'twilio';
import {
  IWhatsappProvider,
  SendMessageOptions,
  ReceivedMessage,
} from './whatsapp-provider.interface';
import { EncryptionService } from '../../../modules/common/services/encryption.service';

@Injectable()
export class TwilioProvider implements IWhatsappProvider {
  private readonly logger = new Logger(TwilioProvider.name);
  private twilioClient: Twilio.Twilio | null = null;
  private whatsappNumber: string;

  constructor(
    private configService: ConfigService,
    private encryptionService: EncryptionService,
  ) {
    this.initialize();
  }

  private async initialize() {
    // Busca credenciais do tenant ou global
    const accountSid =
      this.configService.get<string>('TWILIO_ACCOUNT_SID') || '';
    const authToken =
      this.configService.get<string>('TWILIO_AUTH_TOKEN') || '';
    this.whatsappNumber =
      this.configService.get<string>('TWILIO_WHATSAPP_NUMBER') || '';

    if (accountSid && authToken) {
      this.twilioClient = Twilio(accountSid, authToken);
      this.logger.log('Twilio client initialized');
    } else {
      this.logger.warn('Twilio credentials not found');
    }
  }

  /**
   * Inicializa cliente Twilio com credenciais de um tenant específico (BYOK)
   */
  async initializeForTenant(tenantId: string): Promise<void> {
    const usesOwnCreds = await this.encryptionService.usesOwnKey(
      tenantId,
      'twilio',
    );

    if (usesOwnCreds) {
      const accountSid = await this.encryptionService.decryptApiKey(
        tenantId,
        'twilio_sid',
      );
      const authToken = await this.encryptionService.decryptApiKey(
        tenantId,
        'twilio_token',
      );

      if (accountSid && authToken) {
        this.twilioClient = Twilio(accountSid, authToken);
        this.logger.log(`Twilio client initialized for tenant ${tenantId}`);
      }
    } else {
      // Usa credenciais globais
      await this.initialize();
    }
  }

  async sendMessage(options: SendMessageOptions): Promise<string> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const message = await this.twilioClient.messages.create({
        from: `whatsapp:${this.whatsappNumber}`,
        to: `whatsapp:${options.to}`,
        body: options.body,
      });

      this.logger.log(`Message sent via Twilio: ${message.sid}`);
      return message.sid;
    } catch (error) {
      this.logger.error(`Error sending Twilio message: ${error}`);
      throw error;
    }
  }

  async sendMedia(options: SendMessageOptions): Promise<string> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    if (!options.mediaUrl) {
      throw new Error('mediaUrl is required for sendMedia');
    }

    try {
      const message = await this.twilioClient.messages.create({
        from: `whatsapp:${this.whatsappNumber}`,
        to: `whatsapp:${options.to}`,
        body: options.body || '',
        mediaUrl: [options.mediaUrl],
      });

      this.logger.log(`Media message sent via Twilio: ${message.sid}`);
      return message.sid;
    } catch (error) {
      this.logger.error(`Error sending Twilio media: ${error}`);
      throw error;
    }
  }

  async validateWebhookSignature(
    payload: string,
    signature: string,
  ): Promise<boolean> {
    if (!this.twilioClient) {
      return false;
    }

    const authToken =
      this.configService.get<string>('TWILIO_AUTH_TOKEN') || '';

    try {
      // Twilio valida assinatura usando auth token
      const isValid = Twilio.validateRequest(
        authToken,
        signature,
        '', // URL do webhook (pode ser vazio se validar apenas payload)
        payload,
      );

      return isValid;
    } catch (error) {
      this.logger.error(`Error validating Twilio signature: ${error}`);
      return false;
    }
  }

  isConfigured(): boolean {
    return this.twilioClient !== null;
  }

  getProviderType(): 'twilio' {
    return 'twilio';
  }

  /**
   * Converte mensagem recebida do Twilio para formato padrão
   */
  parseIncomingMessage(body: any): ReceivedMessage {
    return {
      from: body.From?.replace('whatsapp:', '') || '',
      body: body.Body || '',
      messageId: body.MessageSid || '',
      timestamp: new Date(body.Timestamp || Date.now()),
      mediaUrl: body.MediaUrl0 || undefined,
    };
  }
}
```

### 2.3 Implementação Evolution API (Bootstrap/Econômico)

**Arquivo:** `backend/src/modules/whatsapp/providers/evolution.provider.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  IWhatsappProvider,
  SendMessageOptions,
  ReceivedMessage,
} from './whatsapp-provider.interface';

@Injectable()
export class EvolutionProvider implements IWhatsappProvider {
  private readonly logger = new Logger(EvolutionProvider.name);
  private apiClient: AxiosInstance | null = null;
  private instanceName: string;
  private apiKey: string;

  constructor(private configService: ConfigService) {
    this.initialize();
  }

  private initialize() {
    const baseURL = this.configService.get<string>('EVOLUTION_API_URL');
    this.apiKey = this.configService.get<string>('EVOLUTION_API_KEY') || '';
    this.instanceName =
      this.configService.get<string>('EVOLUTION_INSTANCE_NAME') || '';

    if (baseURL && this.apiKey && this.instanceName) {
      this.apiClient = axios.create({
        baseURL,
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json',
        },
      });
      this.logger.log('Evolution API client initialized');
    } else {
      this.logger.warn('Evolution API credentials not found');
    }
  }

  async sendMessage(options: SendMessageOptions): Promise<string> {
    if (!this.apiClient) {
      throw new Error('Evolution API client not initialized');
    }

    try {
      const response = await this.apiClient.post(
        `/message/sendText/${this.instanceName}`,
        {
          number: options.to,
          text: options.body,
        },
      );

      this.logger.log(`Message sent via Evolution: ${response.data.key.id}`);
      return response.data.key.id;
    } catch (error: any) {
      this.logger.error(`Error sending Evolution message: ${error.message}`);
      throw error;
    }
  }

  async sendMedia(options: SendMessageOptions): Promise<string> {
    if (!this.apiClient) {
      throw new Error('Evolution API client not initialized');
    }

    if (!options.mediaUrl) {
      throw new Error('mediaUrl is required for sendMedia');
    }

    try {
      // Evolution API suporta envio de imagem
      const response = await this.apiClient.post(
        `/message/sendMedia/${this.instanceName}`,
        {
          number: options.to,
          mediatype: 'image',
          media: options.mediaUrl,
          caption: options.body || '',
        },
      );

      this.logger.log(`Media sent via Evolution: ${response.data.key.id}`);
      return response.data.key.id;
    } catch (error: any) {
      this.logger.error(`Error sending Evolution media: ${error.message}`);
      throw error;
    }
  }

  async validateWebhookSignature(
    payload: string,
    signature: string,
  ): Promise<boolean> {
    // Evolution API pode usar API Key no header
    // Validar se a requisição veio do servidor Evolution configurado
    const expectedKey = this.configService.get<string>('EVOLUTION_API_KEY');
    return signature === expectedKey;
  }

  isConfigured(): boolean {
    return this.apiClient !== null;
  }

  getProviderType(): 'evolution' {
    return 'evolution';
  }

  /**
   * Converte mensagem recebida do Evolution para formato padrão
   */
  parseIncomingMessage(body: any): ReceivedMessage {
    return {
      from: body.key?.remoteJid?.replace('@s.whatsapp.net', '') || '',
      body: body.message?.conversation || body.message?.extendedTextMessage?.text || '',
      messageId: body.key?.id || '',
      timestamp: new Date(body.messageTimestamp * 1000 || Date.now()),
      mediaUrl: body.message?.imageMessage?.url || undefined,
    };
  }
}
```

### 2.4 Factory para Selecionar Provedor

**Arquivo:** `backend/src/modules/whatsapp/providers/whatsapp-provider.factory.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwilioProvider } from './twilio.provider';
import { EvolutionProvider } from './evolution.provider';
import { IWhatsappProvider } from './whatsapp-provider.interface';
import { EncryptionService } from '../../../modules/common/services/encryption.service';

@Injectable()
export class WhatsappProviderFactory {
  constructor(
    private configService: ConfigService,
    private twilioProvider: TwilioProvider,
    private evolutionProvider: EvolutionProvider,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Retorna provedor baseado no plano do tenant
   * Starter -> Evolution API (econômico)
   * Professional/Enterprise -> Twilio (oficial)
   */
  async getProvider(tenantId: string): Promise<IWhatsappProvider> {
    // Busca plano do tenant
    const tenant = await this.encryptionService.dataSource.query(
      `SELECT plan_type FROM tenants WHERE id = $1`,
      [tenantId],
    );

    const planType = tenant[0]?.plan_type || 'starter';

    // Professional/Enterprise usa Twilio oficial
    if (planType === 'professional' || planType === 'enterprise') {
      await this.twilioProvider.initializeForTenant(tenantId);
      if (this.twilioProvider.isConfigured()) {
        return this.twilioProvider;
      }
    }

    // Starter ou fallback usa Evolution API
    if (this.evolutionProvider.isConfigured()) {
      return this.evolutionProvider;
    }

    // Se nenhum está configurado, retorna Twilio (pode estar sem credenciais)
    return this.twilioProvider;
  }

  /**
   * Retorna provedor específico (para testes ou configuração manual)
   */
  getProviderByType(type: 'twilio' | 'evolution'): IWhatsappProvider {
    if (type === 'twilio') {
      return this.twilioProvider;
    }
    return this.evolutionProvider;
  }
}
```

---

## 3. 💬 SERVIÇO DE CONVERSAS

### 3.1 Serviço de Gerenciamento de Conversas

**Arquivo:** `backend/src/modules/whatsapp/services/conversation.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WhatsappConversation } from '../../../database/entities/WhatsappConversation.entity';
import { WhatsappMessage } from '../../../database/entities/WhatsappMessage.entity';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(WhatsappConversation)
    private conversationRepository: Repository<WhatsappConversation>,
    @InjectRepository(WhatsappMessage)
    private messageRepository: Repository<WhatsappMessage>,
    private dataSource: DataSource,
  ) {}

  /**
   * Busca ou cria conversa ativa para um número
   */
  async getOrCreateConversation(
    tenantId: string,
    customerPhone: string,
    customerName?: string,
  ): Promise<WhatsappConversation> {
    // Busca conversa ativa (não completada ou abandonada)
    let conversation = await this.conversationRepository.findOne({
      where: {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        status: 'active',
      },
      order: { last_message_at: 'DESC' },
    });

    // Se não existe ou está muito antiga (>24h), cria nova
    if (!conversation) {
      conversation = this.conversationRepository.create({
        tenant_id: tenantId,
        customer_phone: customerPhone,
        customer_name: customerName,
        status: 'active',
        context: {},
      });
      conversation = await this.conversationRepository.save(conversation);
      this.logger.log(`Created new conversation ${conversation.id}`);
    } else {
      // Verifica se conversa está muito antiga (abandonada)
      const hoursSinceLastMessage =
        (Date.now() - conversation.last_message_at.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastMessage > 24) {
        // Marca como abandonada e cria nova
        conversation.status = 'abandoned';
        await this.conversationRepository.save(conversation);

        conversation = this.conversationRepository.create({
          tenant_id: tenantId,
          customer_phone: customerPhone,
          customer_name: customerName,
          status: 'active',
          context: {},
        });
        conversation = await this.conversationRepository.save(conversation);
        this.logger.log(`Created new conversation (previous abandoned)`);
      }
    }

    return conversation;
  }

  /**
   * Salva mensagem na conversa
   */
  async saveMessage(
    conversationId: string,
    direction: 'inbound' | 'outbound',
    body: string,
    messageType: 'text' | 'image' | 'document' | 'button' = 'text',
    metadata: Record<string, any> = {},
  ): Promise<WhatsappMessage> {
    const message = this.messageRepository.create({
      conversation_id: conversationId,
      direction,
      body,
      message_type: messageType,
      metadata,
      sent_at: new Date(),
    });

    return this.messageRepository.save(message);
  }

  /**
   * Atualiza contexto da conversa
   */
  async updateContext(
    conversationId: string,
    contextUpdates: Record<string, any>,
  ): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Merge com contexto existente
    conversation.context = {
      ...conversation.context,
      ...contextUpdates,
    };

    await this.conversationRepository.save(conversation);
  }

  /**
   * Busca histórico de mensagens da conversa
   */
  async getConversationHistory(
    conversationId: string,
    limit: number = 50,
  ): Promise<WhatsappMessage[]> {
    return this.messageRepository.find({
      where: { conversation_id: conversationId },
      order: { sent_at: 'ASC' },
      take: limit,
    });
  }

  /**
   * Marca conversa como concluída
   */
  async completeConversation(
    conversationId: string,
    pedidoId?: string,
  ): Promise<void> {
    await this.conversationRepository.update(conversationId, {
      status: 'completed',
      pedido_id: pedidoId,
      completed_at: new Date(),
    });
  }

  /**
   * Marca conversa como aguardando pagamento
   */
  async setWaitingPayment(conversationId: string): Promise<void> {
    await this.conversationRepository.update(conversationId, {
      status: 'waiting_payment',
    });
  }
}
```

---

## 4. 🎨 TEMPLATES DE MENSAGENS

### 4.1 Serviço de Templates

**Arquivo:** `backend/src/modules/whatsapp/services/message-templates.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../../database/entities/Tenant.entity';

export interface MessageTemplate {
  greeting: string;
  productList: (products: Array<{ name: string; price: number }>) => string;
  orderConfirmation: (orderNo: string, total: number) => string;
  paymentRequest: (total: number, method: string) => string;
  orderReady: (orderNo: string) => string;
  orderDelivered: (orderNo: string) => string;
  fallback: string;
}

@Injectable()
export class MessageTemplatesService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  /**
   * Retorna templates padrão ou customizados do tenant
   */
  async getTemplates(tenantId: string): Promise<MessageTemplate> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });

    // Se tenant tem templates customizados, usa eles
    const customTemplates = tenant?.settings?.whatsapp_templates;

    if (customTemplates) {
      return {
        greeting: customTemplates.greeting || this.getDefaultGreeting(),
        productList: customTemplates.productList || this.getDefaultProductList(),
        orderConfirmation:
          customTemplates.orderConfirmation || this.getDefaultOrderConfirmation(),
        paymentRequest:
          customTemplates.paymentRequest || this.getDefaultPaymentRequest(),
        orderReady: customTemplates.orderReady || this.getDefaultOrderReady(),
        orderDelivered:
          customTemplates.orderDelivered || this.getDefaultOrderDelivered(),
        fallback: customTemplates.fallback || this.getDefaultFallback(),
      };
    }

    // Retorna templates padrão
    return this.getDefaultTemplates();
  }

  private getDefaultTemplates(): MessageTemplate {
    return {
      greeting: this.getDefaultGreeting(),
      productList: this.getDefaultProductList(),
      orderConfirmation: this.getDefaultOrderConfirmation(),
      paymentRequest: this.getDefaultPaymentRequest(),
      orderReady: this.getDefaultOrderReady(),
      orderDelivered: this.getDefaultOrderDelivered(),
      fallback: this.getDefaultFallback(),
    };
  }

  private getDefaultGreeting(): string {
    return `👋 Olá! Bem-vindo à nossa loja!\n\nComo posso ajudar você hoje?`;
  }

  private getDefaultProductList(): (
    products: Array<{ name: string; price: number }>,
  ) => string {
    return (products) => {
      let message = `📦 *Nossos Produtos:*\n\n`;
      products.forEach((product, index) => {
        message += `${index + 1}. *${product.name}* - R$ ${product.price.toFixed(2)}\n`;
      });
      message += `\nDigite o número do produto que você quer!`;
      return message;
    };
  }

  private getDefaultOrderConfirmation(): (
    orderNo: string,
    total: number,
  ) => string {
    return (orderNo, total) => {
      return `✅ *Pedido Confirmado!*\n\n` +
        `Número: *${orderNo}*\n` +
        `Total: *R$ ${total.toFixed(2)}*\n\n` +
        `Seu pedido está sendo preparado e ficará pronto em aproximadamente 30 minutos! 🎉`;
    };
  }

  private getDefaultPaymentRequest(): (
    total: number,
    method: string,
  ) => string {
    return (total, method) => {
      if (method === 'pix') {
        return `💳 *Pagamento via PIX*\n\n` +
          `Total: *R$ ${total.toFixed(2)}*\n\n` +
          `Escaneie o QR Code abaixo para pagar:`;
      }
      return `💳 Total: *R$ ${total.toFixed(2)}*\n\nComo prefere pagar?`;
    };
  }

  private getDefaultOrderReady(): (orderNo: string) => string {
    return (orderNo) => {
      return `🎉 *Seu pedido está pronto!*\n\n` +
        `Pedido: *${orderNo}*\n\n` +
        `Você pode retirar na loja ou aguardar a entrega!`;
    };
  }

  private getDefaultOrderDelivered(): (orderNo: string) => string {
    return (orderNo) => {
      return `✅ *Pedido Entregue!*\n\n` +
        `Pedido: *${orderNo}*\n\n` +
        `Obrigado pela sua compra! Esperamos você novamente! 😊`;
    };
  }

  private getDefaultFallback(): string {
    return `Desculpe, não entendi. Pode repetir?\n\n` +
      `Posso ajudar com:\n` +
      `• Ver cardápio\n` +
      `• Fazer pedido\n` +
      `• Consultar status\n` +
      `• Outras dúvidas`;
  }
}
```

---

## 5. 💾 CACHE REDIS PARA RESPOSTAS

### 5.1 Serviço de Cache

**Arquivo:** `backend/src/modules/common/services/cache.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
    
    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis error: ${error}`);
    });
  }

  /**
   * Salva resposta no cache
   */
  async set(
    key: string,
    value: any,
    ttlSeconds: number = 3600,
  ): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.redis.setex(key, ttlSeconds, serialized);
  }

  /**
   * Busca valor do cache
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  }

  /**
   * Remove do cache
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Remove múltiplas chaves (pattern)
   */
  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Cache de resposta de pergunta frequente
   * Chave: "faq:tenant_id:question_hash"
   */
  async cacheFaqResponse(
    tenantId: string,
    questionHash: string,
    response: string,
    ttlHours: number = 24,
  ): Promise<void> {
    const key = `faq:${tenantId}:${questionHash}`;
    await this.set(key, { response, cachedAt: Date.now() }, ttlHours * 3600);
  }

  /**
   * Busca resposta em cache de FAQ
   */
  async getCachedFaqResponse(
    tenantId: string,
    questionHash: string,
  ): Promise<string | null> {
    const key = `faq:${tenantId}:${questionHash}`;
    const cached = await this.get<{ response: string }>(key);
    return cached?.response || null;
  }

  /**
   * Cache de lista de produtos
   * Chave: "products:tenant_id"
   */
  async cacheProducts(
    tenantId: string,
    products: any[],
    ttlSeconds: number = 300, // 5 minutos
  ): Promise<void> {
    const key = `products:${tenantId}`;
    await this.set(key, products, ttlSeconds);
  }

  /**
   * Busca produtos em cache
   */
  async getCachedProducts(tenantId: string): Promise<any[] | null> {
    const key = `products:${tenantId}`;
    return this.get<any[]>(key);
  }

  /**
   * Invalida cache de produtos (quando produto é criado/editado)
   */
  async invalidateProductsCache(tenantId: string): Promise<void> {
    const key = `products:${tenantId}`;
    await this.delete(key);
  }

  /**
   * Cache de estoque
   * Chave: "stock:tenant_id:product_id"
   */
  async cacheStock(
    tenantId: string,
    productId: string,
    stock: number,
    ttlSeconds: number = 10, // Cache muito curto (10s) para ser preciso
  ): Promise<void> {
    const key = `stock:${tenantId}:${productId}`;
    await this.set(key, stock, ttlSeconds);
  }

  /**
   * Busca estoque em cache
   */
  async getCachedStock(
    tenantId: string,
    productId: string,
  ): Promise<number | null> {
    const key = `stock:${tenantId}:${productId}`;
    return this.get<number>(key);
  }

  /**
   * Invalida cache de estoque (quando venda acontece)
   */
  async invalidateStockCache(tenantId: string, productId?: string): Promise<void> {
    if (productId) {
      const key = `stock:${tenantId}:${productId}`;
      await this.delete(key);
    } else {
      // Invalida todos os estoques do tenant
      await this.deletePattern(`stock:${tenantId}:*`);
    }
  }
}
```

---

## 6. 🔄 PROCESSAMENTO DE MENSAGENS EM CAMADAS

### 6.1 Processador de Mensagens

**Arquivo:** `backend/src/modules/whatsapp/services/message-processor.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { MessageTemplatesService } from './message-templates.service';
import { CacheService } from '../../../modules/common/services/cache.service';
import { ProductsService } from '../../products/products.service';
import { OpenAIService } from './openai.service';
import { IWhatsappProvider } from '../providers/whatsapp-provider.interface';
import * as crypto from 'crypto';

export interface ProcessedMessage {
  intent: 'greeting' | 'product_list' | 'make_order' | 'check_status' | 'other';
  entities?: {
    productName?: string;
    quantity?: number;
    paymentMethod?: string;
  };
  confidence: number;
  requiresAI: boolean; // Se precisa chamar OpenAI
}

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);

  constructor(
    private conversationService: ConversationService,
    private templatesService: MessageTemplatesService,
    private cacheService: CacheService,
    private productsService: ProductsService,
    private openAIService: OpenAIService,
  ) {}

  /**
   * Processa mensagem em camadas (sem custo -> com custo)
   */
  async processMessage(
    tenantId: string,
    customerPhone: string,
    messageBody: string,
    provider: IWhatsappProvider,
  ): Promise<string> {
    // CAMADA 1: Hash da pergunta para cache
    const questionHash = this.hashQuestion(messageBody);

    // CAMADA 1.1: Verifica cache de FAQ (custo zero)
    const cachedResponse = await this.cacheService.getCachedFaqResponse(
      tenantId,
      questionHash,
    );
    if (cachedResponse) {
      this.logger.log(`Cache hit for question: ${messageBody.substring(0, 50)}`);
      return cachedResponse;
    }

    // CAMADA 2: Processamento simples (regex/NLP básico - custo zero)
    const simpleProcessing = this.processSimpleIntent(messageBody);
    
    if (simpleProcessing.intent !== 'other' && simpleProcessing.confidence > 0.7) {
      // Resposta simples encontrada, processa sem IA
      const response = await this.handleSimpleIntent(
        tenantId,
        customerPhone,
        simpleProcessing,
      );
      
      // Salva no cache
      await this.cacheService.cacheFaqResponse(
        tenantId,
        questionHash,
        response,
      );
      
      return response;
    }

    // CAMADA 3: OpenAI (custo baixo - GPT-3.5-Turbo ou GPT-4o-mini)
    // Isso será implementado na PARTE 3
    // Por enquanto, retorna fallback
    const templates = await this.templatesService.getTemplates(tenantId);
    return templates.fallback;
  }

  /**
   * Processa intenção simples (regex/NLP básico)
   */
  private processSimpleIntent(message: string): ProcessedMessage {
    const lowerMessage = message.toLowerCase().trim();

    // Greeting
    if (
      /^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|e aí)$/i.test(lowerMessage)
    ) {
      return {
        intent: 'greeting',
        confidence: 0.9,
        requiresAI: false,
      };
    }

    // Product list
    if (
      /(cardápio|cardapio|menu|produtos|o que vocês têm|o que tem|lista)/i.test(
        lowerMessage,
      )
    ) {
      return {
        intent: 'product_list',
        confidence: 0.85,
        requiresAI: false,
      };
    }

    // Make order (padrões simples)
    const orderPattern = /(quero|preciso|vou querer|me dá|me manda|pedir|comprar)\s+(\d+)?\s*([a-záàâãéêíóôõúç]+)/i;
    const orderMatch = lowerMessage.match(orderPattern);
    if (orderMatch) {
      return {
        intent: 'make_order',
        entities: {
          quantity: orderMatch[2] ? parseInt(orderMatch[2]) : 1,
          productName: orderMatch[3],
        },
        confidence: 0.7,
        requiresAI: false,
      };
    }

    // Check status
    if (/(status|pedido|onde está|pronto|entregue)/i.test(lowerMessage)) {
      return {
        intent: 'check_status',
        confidence: 0.75,
        requiresAI: false,
      };
    }

    // Não identificado - precisa IA
    return {
      intent: 'other',
      confidence: 0.3,
      requiresAI: true,
    };
  }

  /**
   * Trata intenção simples sem IA
   */
  private async handleSimpleIntent(
    tenantId: string,
    customerPhone: string,
    processed: ProcessedMessage,
  ): Promise<string> {
    const templates = await this.templatesService.getTemplates(tenantId);

    switch (processed.intent) {
      case 'greeting':
        return templates.greeting;

      case 'product_list': {
        // Busca produtos (com cache)
        let products = await this.cacheService.getCachedProducts(tenantId);
        if (!products) {
          products = await this.productsService.findAll(tenantId);
          await this.cacheService.cacheProducts(tenantId, products);
        }
        return templates.productList(
          products.map((p) => ({ name: p.name, price: parseFloat(p.price) })),
        );
      }

      case 'make_order':
        // Processamento de pedido será na PARTE 4
        return `Entendi que você quer fazer um pedido! Vou processar isso agora...`;

      case 'check_status':
        return `Para verificar o status do seu pedido, preciso do número do pedido. Pode me informar?`;

      default:
        return templates.fallback;
    }
  }

  /**
   * Gera hash da pergunta para cache
   */
  private hashQuestion(question: string): string {
    // Normaliza pergunta (lowercase, remove acentos, espaços extras)
    const normalized = question
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove acentos

    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
}
```

---

## 7. 🔄 ATUALIZAÇÃO DO WHATSAPP SERVICE

### 7.1 Refatoração Completa

**Arquivo:** `backend/src/modules/whatsapp/whatsapp.service.ts` (ATUALIZADO)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappProviderFactory } from './providers/whatsapp-provider.factory';
import { ConversationService } from './services/conversation.service';
import { MessageProcessorService } from './services/message-processor.service';
import { UsageLogService } from '../../modules/common/services/usage-log.service';
import { IWhatsappProvider, ReceivedMessage } from './providers/whatsapp-provider.interface';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private configService: ConfigService,
    private providerFactory: WhatsappProviderFactory,
    private conversationService: ConversationService,
    private messageProcessor: MessageProcessorService,
    private usageLogService: UsageLogService,
  ) {}

  /**
   * Processa mensagem recebida do webhook
   */
  async processIncomingMessage(
    tenantId: string,
    rawMessage: any,
    providerType: 'twilio' | 'evolution',
  ): Promise<void> {
    try {
      // Obtém provedor
      const provider = this.providerFactory.getProviderByType(providerType);
      
      // Converte para formato padrão
      const message: ReceivedMessage = provider.parseIncomingMessage(rawMessage);

      this.logger.log(
        `Processing message from ${message.from}: ${message.body.substring(0, 50)}`,
      );

      // Busca ou cria conversa
      const conversation = await this.conversationService.getOrCreateConversation(
        tenantId,
        message.from,
      );

      // Salva mensagem recebida
      await this.conversationService.saveMessage(
        conversation.id,
        'inbound',
        message.body,
        message.mediaUrl ? 'image' : 'text',
        {
          message_id: message.messageId,
          media_url: message.mediaUrl,
        },
      );

      // Processa mensagem (camadas: cache -> regex -> IA)
      const response = await this.messageProcessor.processMessage(
        tenantId,
        message.from,
        message.body,
        provider,
      );

      // Envia resposta
      await this.sendMessage(tenantId, message.from, response, provider);

      // Registra uso (mensagem WhatsApp)
      await this.usageLogService.logUsage({
        tenantId,
        serviceType: 'whatsapp_msg',
        quantity: 1,
        costEstimated: this.calculateWhatsappCost(tenantId, provider),
        metadata: {
          direction: 'outbound',
          provider: provider.getProviderType(),
        },
        referenceId: conversation.id,
        referenceType: 'conversation',
      });
    } catch (error) {
      this.logger.error(
        `Error processing WhatsApp message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Envia mensagem
   */
  async sendMessage(
    tenantId: string,
    to: string,
    body: string,
    provider?: IWhatsappProvider,
  ): Promise<string> {
    if (!provider) {
      provider = await this.providerFactory.getProvider(tenantId);
    }

    const messageId = await provider.sendMessage({
      to,
      body,
    });

    // Busca conversa e salva mensagem enviada
    const conversation = await this.conversationService.getOrCreateConversation(
      tenantId,
      to,
    );

    await this.conversationService.saveMessage(
      conversation.id,
      'outbound',
      body,
      'text',
      {
        message_id: messageId,
        provider: provider.getProviderType(),
      },
    );

    return messageId;
  }

  /**
   * Envia mídia (QR Code, imagem)
   */
  async sendMedia(
    tenantId: string,
    to: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<string> {
    const provider = await this.providerFactory.getProvider(tenantId);

    const messageId = await provider.sendMedia({
      to,
      body: caption || '',
      mediaUrl,
    });

    // Salva mensagem
    const conversation = await this.conversationService.getOrCreateConversation(
      tenantId,
      to,
    );

    await this.conversationService.saveMessage(
      conversation.id,
      'outbound',
      caption || '[Mídia]',
      'image',
      {
        message_id: messageId,
        media_url: mediaUrl,
      },
    );

    return messageId;
  }

  /**
   * Calcula custo de mensagem WhatsApp baseado no provedor
   */
  private calculateWhatsappCost(
    tenantId: string,
    provider: IWhatsappProvider,
  ): number {
    const providerType = provider.getProviderType();

    // Twilio: ~$0.005 por mensagem (R$ 0.025)
    if (providerType === 'twilio') {
      return 0.025; // R$ 0.025 por mensagem
    }

    // Evolution API: custo zero (apenas servidor)
    return 0;
  }
}
```

---

## 8. 🔄 ATUALIZAÇÃO DO CONTROLLER

### 8.1 Controller com Validação de Webhook

**Arquivo:** `backend/src/modules/whatsapp/whatsapp.controller.ts` (ATUALIZADO)

```typescript
import {
  Controller,
  Post,
  Body,
  Get,
  Headers,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { WhatsappService } from './whatsapp.service';
import { WhatsappProviderFactory } from './providers/whatsapp-provider.factory';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly providerFactory: WhatsappProviderFactory,
  ) {}

  @Post('webhook/twilio')
  @ApiOperation({ summary: 'Webhook do Twilio para receber mensagens' })
  @ApiHeader({ name: 'X-Twilio-Signature', required: false })
  async twilioWebhook(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() request: Request,
  ) {
    // Valida assinatura do Twilio
    const provider = this.providerFactory.getProviderByType('twilio');
    const rawBody = JSON.stringify(body);
    
    // TODO: Obter tenant_id do body ou de configuração
    const tenantId = body.tenant_id || 'default-tenant-id'; // TEMPORÁRIO

    const isValid = await provider.validateWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid Twilio signature');
    }

    await this.whatsappService.processIncomingMessage(
      tenantId,
      body,
      'twilio',
    );

    return { success: true };
  }

  @Post('webhook/evolution')
  @ApiOperation({ summary: 'Webhook do Evolution API para receber mensagens' })
  @ApiHeader({ name: 'apikey', required: false })
  async evolutionWebhook(
    @Body() body: any,
    @Headers('apikey') apiKey: string,
    @Req() request: Request,
  ) {
    // Valida API Key
    const provider = this.providerFactory.getProviderByType('evolution');
    const rawBody = JSON.stringify(body);
    
    // TODO: Obter tenant_id do body ou de configuração
    const tenantId = body.tenant_id || 'default-tenant-id'; // TEMPORÁRIO

    const isValid = await provider.validateWebhookSignature(rawBody, apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid Evolution API key');
    }

    await this.whatsappService.processIncomingMessage(
      tenantId,
      body,
      'evolution',
    );

    return { success: true };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check do bot' })
  health() {
    return {
      status: 'ok',
      bot: 'WhatsApp Bot is running',
      providers: {
        twilio: this.providerFactory
          .getProviderByType('twilio')
          .isConfigured(),
        evolution: this.providerFactory
          .getProviderByType('evolution')
          .isConfigured(),
      },
    };
  }
}
```

---

## 9. 📝 ATUALIZAÇÃO DO MÓDULO

### 9.1 Módulo Completo

**Arquivo:** `backend/src/modules/whatsapp/whatsapp.module.ts` (ATUALIZADO)

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { OpenAIService } from './services/openai.service';
import { ConversationService } from './services/conversation.service';
import { MessageProcessorService } from './services/message-processor.service';
import { MessageTemplatesService } from './services/message-templates.service';
import { WhatsappProviderFactory } from './providers/whatsapp-provider.factory';
import { TwilioProvider } from './providers/twilio.provider';
import { EvolutionProvider } from './providers/evolution.provider';
import { WhatsappConversation } from '../../database/entities/WhatsappConversation.entity';
import { WhatsappMessage } from '../../database/entities/WhatsappMessage.entity';
import { Tenant } from '../../database/entities/Tenant.entity';
import { ProductsModule } from '../products/products.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WhatsappConversation,
      WhatsappMessage,
      Tenant,
    ]),
    ProductsModule,
    CommonModule, // Para UsageLogService, CacheService, EncryptionService
  ],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    OpenAIService,
    ConversationService,
    MessageProcessorService,
    MessageTemplatesService,
    WhatsappProviderFactory,
    TwilioProvider,
    EvolutionProvider,
  ],
  exports: [WhatsappService],
})
export class WhatsappModule {}
```

---

## 10. ✅ CHECKLIST DE IMPLEMENTAÇÃO - PARTE 2

### 10.1 Dependências
- [ ] Instalar `twilio`, `@nestjs/bull`, `bull`
- [ ] Verificar `ioredis` instalado
- [ ] Atualizar `package.json`

### 10.2 Provedores WhatsApp
- [ ] Criar interface `IWhatsappProvider`
- [ ] Implementar `TwilioProvider`
- [ ] Implementar `EvolutionProvider`
- [ ] Criar `WhatsappProviderFactory`
- [ ] Testar envio de mensagem via Twilio
- [ ] Testar envio de mensagem via Evolution

### 10.3 Serviços
- [ ] Criar `ConversationService`
- [ ] Criar `MessageTemplatesService`
- [ ] Criar `MessageProcessorService`
- [ ] Atualizar `CacheService` (se necessário)
- [ ] Atualizar `WhatsappService`

### 10.4 Controller e Módulo
- [ ] Atualizar `WhatsappController` com webhooks separados
- [ ] Atualizar `WhatsappModule` com todas dependências
- [ ] Testar webhook Twilio
- [ ] Testar webhook Evolution

### 10.5 Cache Redis
- [ ] Implementar cache de FAQ
- [ ] Implementar cache de produtos
- [ ] Implementar cache de estoque
- [ ] Testar invalidação de cache

### 10.6 Testes
- [ ] Testar processamento em camadas (cache -> regex -> IA)
- [ ] Testar criação de conversas
- [ ] Testar salvamento de mensagens
- [ ] Testar templates de mensagens

### 10.7 Configuração
- [ ] Adicionar variáveis de ambiente (.env):
  ```
  TWILIO_ACCOUNT_SID=
  TWILIO_AUTH_TOKEN=
  TWILIO_WHATSAPP_NUMBER=
  EVOLUTION_API_URL=
  EVOLUTION_API_KEY=
  EVOLUTION_INSTANCE_NAME=
  REDIS_URL=redis://localhost:6379
  ```

---

## 11. 📝 PRÓXIMOS PASSOS (Após Parte 2)

**PARTE 3:** Integração OpenAI em Camadas
- Camada 1: Regex/NLP simples (já implementado)
- Camada 2: GPT-3.5-Turbo / GPT-4o-mini
- Camada 3: Cache de respostas (já implementado)
- Extração de entidades (produto, quantidade, pagamento)

**PARTE 4:** Fluxo Completo WhatsApp Bot
- Processamento de pedidos via WhatsApp
- Geração QR Code Pix
- Integração com OrdersService
- Fluxo completo de compra

---

**Status:** ✅ PARTE 2 COMPLETA  
**Próxima Parte:** Aguardando confirmação para continuar

