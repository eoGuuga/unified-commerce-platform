# 🎯 PLANO COMPLETO DE IMPLEMENTAÇÃO - PARTE 1/8

## 📋 FUNDAMENTOS E ESTRUTURAÇÃO CRÍTICA

**Objetivo desta Parte:** Estabelecer a base sólida do sistema com segurança, controle de custos, idempotência e estrutura para WhatsApp/IA.

**Tempo Estimado:** 2-3 semanas  
**Prioridade:** 🔴 CRÍTICA (bloqueia outras partes)

---

## 1. 🗄️ MIGRAÇÕES DE BANCO DE DADOS

### 1.1 Migration: Controle de Custos e Uso

**Arquivo:** `scripts/migrations/002-usage-logs-and-encryption.sql`

```sql
-- ============================================
-- TABELA: USAGE_LOGS (Controle de Custos)
-- ============================================
-- Monitora uso de serviços externos (OpenAI, WhatsApp, Stripe)
-- Permite calcular custos reais e fazer billing preciso

CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Tipo de serviço usado
  service_type VARCHAR(50) NOT NULL, 
  -- Valores: 'openai_tokens', 'openai_request', 'whatsapp_msg', 
  --          'whatsapp_conversation', 'stripe_txn', 'stripe_fee'
  
  -- Quantidade consumida
  quantity INTEGER NOT NULL, -- tokens, mensagens, transações
  
  -- Custo estimado (em centavos para precisão)
  cost_estimated DECIMAL(12,4) NOT NULL DEFAULT 0,
  -- Ex: 0.0002 = R$ 0.000002 (para tokens OpenAI)
  
  -- Metadados adicionais (JSONB)
  metadata JSONB DEFAULT '{}',
  -- Ex: { model: 'gpt-4o-mini', prompt_tokens: 100, completion_tokens: 50 }
  
  -- Referência opcional (pedido_id, conversation_id, etc)
  reference_id UUID,
  reference_type VARCHAR(50), -- 'order', 'conversation', 'payment'
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para queries rápidas
CREATE INDEX idx_usage_logs_tenant ON usage_logs(tenant_id, created_at DESC);
CREATE INDEX idx_usage_logs_service ON usage_logs(tenant_id, service_type, created_at DESC);
CREATE INDEX idx_usage_logs_reference ON usage_logs(reference_id, reference_type) 
  WHERE reference_id IS NOT NULL;

-- Função para calcular custo total por tenant em período
CREATE OR REPLACE FUNCTION get_tenant_cost(
  p_tenant_id UUID,
  p_start_date TIMESTAMP,
  p_end_date TIMESTAMP
)
RETURNS TABLE(
  service_type VARCHAR,
  total_quantity BIGINT,
  total_cost DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ul.service_type,
    SUM(ul.quantity)::BIGINT as total_quantity,
    SUM(ul.cost_estimated) as total_cost
  FROM usage_logs ul
  WHERE ul.tenant_id = p_tenant_id
    AND ul.created_at >= p_start_date
    AND ul.created_at <= p_end_date
  GROUP BY ul.service_type
  ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE usage_logs IS 'Log de uso de serviços externos para controle de custos e billing';
COMMENT ON FUNCTION get_tenant_cost IS 'Calcula custos totais por serviço para um tenant em um período';
```

### 1.2 Migration: Criptografia para BYOK (Bring Your Own Key)

**Arquivo:** `scripts/migrations/003-tenant-api-keys-encryption.sql`

```sql
-- ============================================
-- EXTENSÃO: pgcrypto (já existe, mas garantir)
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ADICIONAR CAMPOS ENCRIPTADOS NA TABELA TENANTS
-- ============================================
-- Armazena API Keys dos clientes de forma segura
-- Usa pgcrypto para encriptação no banco

ALTER TABLE tenants 
  ADD COLUMN IF NOT EXISTS openai_api_key_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS twilio_account_sid_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS twilio_auth_token_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS stripe_api_key_encrypted BYTEA,
  
  -- Flags para indicar se usa BYOK
  ADD COLUMN IF NOT EXISTS use_own_openai_key BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_own_twilio_creds BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_own_stripe_key BOOLEAN DEFAULT false,
  
  -- Plano do tenant (starter, professional, enterprise)
  ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) DEFAULT 'starter',
  -- Valores: 'starter', 'professional', 'enterprise'
  
  -- Limites do plano
  ADD COLUMN IF NOT EXISTS plan_limits JSONB DEFAULT '{}',
  -- Ex: { openai_tokens_per_month: 100000, whatsapp_messages_per_month: 1000 }

-- Função para encriptar API Key
CREATE OR REPLACE FUNCTION encrypt_api_key(
  p_key TEXT,
  p_encryption_key TEXT DEFAULT current_setting('app.encryption_key', true)
)
RETURNS BYTEA AS $$
BEGIN
  IF p_key IS NULL OR p_key = '' THEN
    RETURN NULL;
  END IF;
  
  -- Usa pgp_sym_encrypt com AES-256
  RETURN pgp_sym_encrypt(p_key, COALESCE(p_encryption_key, 'default-key-change-in-production'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para descriptografar API Key
CREATE OR REPLACE FUNCTION decrypt_api_key(
  p_encrypted BYTEA,
  p_encryption_key TEXT DEFAULT current_setting('app.encryption_key', true)
)
RETURNS TEXT AS $$
BEGIN
  IF p_encrypted IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN pgp_sym_decrypt(p_encrypted, COALESCE(p_encryption_key, 'default-key-change-in-production'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para validar que se use_own_*_key = true, então *_encrypted não pode ser NULL
CREATE OR REPLACE FUNCTION validate_encrypted_keys()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.use_own_openai_key = true AND NEW.openai_api_key_encrypted IS NULL THEN
    RAISE EXCEPTION 'openai_api_key_encrypted cannot be NULL when use_own_openai_key is true';
  END IF;
  
  IF NEW.use_own_twilio_creds = true AND (
    NEW.twilio_account_sid_encrypted IS NULL OR 
    NEW.twilio_auth_token_encrypted IS NULL
  ) THEN
    RAISE EXCEPTION 'twilio credentials cannot be NULL when use_own_twilio_creds is true';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_encrypted_keys_trigger
  BEFORE INSERT OR UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION validate_encrypted_keys();

COMMENT ON COLUMN tenants.openai_api_key_encrypted IS 'API Key da OpenAI encriptada (BYOK)';
COMMENT ON COLUMN tenants.twilio_account_sid_encrypted IS 'Twilio Account SID encriptado (BYOK)';
COMMENT ON COLUMN tenants.twilio_auth_token_encrypted IS 'Twilio Auth Token encriptado (BYOK)';
COMMENT ON COLUMN tenants.plan_type IS 'Tipo de plano: starter, professional, enterprise';
```

### 1.3 Migration: Tabela de Conversas WhatsApp

**Arquivo:** `scripts/migrations/004-whatsapp-conversations.sql`

```sql
-- ============================================
-- TABELA: WHATSAPP_CONVERSATIONS
-- ============================================
-- Armazena histórico de conversas do WhatsApp Bot
-- Permite contexto e rastreamento

CREATE TABLE whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Número do WhatsApp do cliente
  customer_phone VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255), -- Nome extraído da mensagem ou cadastrado
  
  -- Status da conversa
  status VARCHAR(50) DEFAULT 'active',
  -- Valores: 'active', 'waiting_payment', 'order_placed', 'completed', 'abandoned'
  
  -- Contexto da conversa (JSONB)
  context JSONB DEFAULT '{}',
  -- Ex: { current_intent: 'fazer_pedido', current_order: { items: [...] }, 
  --       last_product_mentioned: 'brigadeiro', payment_method: 'pix' }
  
  -- Pedido associado (se houver)
  pedido_id UUID REFERENCES pedidos(id),
  
  -- Timestamps
  started_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  -- Ex: { twilio_conversation_sid: '...', total_messages: 15, 
  --       ai_requests_count: 3, fallback_to_human: false }
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_whatsapp_conv_tenant ON whatsapp_conversations(tenant_id, status);
CREATE INDEX idx_whatsapp_conv_phone ON whatsapp_conversations(customer_phone, tenant_id);
CREATE INDEX idx_whatsapp_conv_pedido ON whatsapp_conversations(pedido_id) WHERE pedido_id IS NOT NULL;
CREATE INDEX idx_whatsapp_conv_active ON whatsapp_conversations(tenant_id, status, last_message_at DESC) 
  WHERE status IN ('active', 'waiting_payment');

-- ============================================
-- TABELA: WHATSAPP_MESSAGES
-- ============================================
-- Armazena cada mensagem individual da conversa

CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  
  -- Direção da mensagem
  direction VARCHAR(20) NOT NULL, -- 'inbound' (cliente -> bot) ou 'outbound' (bot -> cliente)
  
  -- Conteúdo
  body TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'document', 'button'
  
  -- Metadados da mensagem
  metadata JSONB DEFAULT '{}',
  -- Ex: { twilio_message_sid: '...', ai_intent: 'fazer_pedido', 
  --       ai_confidence: 0.95, used_cache: true }
  
  -- Timestamp
  sent_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_whatsapp_msg_conv ON whatsapp_messages(conversation_id, sent_at);
CREATE INDEX idx_whatsapp_msg_direction ON whatsapp_messages(conversation_id, direction, sent_at);

-- Trigger para atualizar last_message_at na conversa
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET last_message_at = NEW.sent_at,
      updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_last_message_trigger
  AFTER INSERT ON whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

COMMENT ON TABLE whatsapp_conversations IS 'Conversas do WhatsApp Bot com contexto e histórico';
COMMENT ON TABLE whatsapp_messages IS 'Mensagens individuais de cada conversa';
```

### 1.4 Migration: Idempotência e Webhooks

**Arquivo:** `scripts/migrations/005-idempotency-and-webhooks.sql`

```sql
-- ============================================
-- TABELA: IDEMPOTENCY_KEYS
-- ============================================
-- Garante que operações idênticas não sejam executadas duas vezes
-- Usado para: vendas duplicadas, webhooks duplicados, etc

CREATE TABLE idempotency_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Chave única da operação (hash do request)
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  -- Ex: SHA256(cart_items + timestamp + user_id)
  
  -- Tipo de operação
  operation_type VARCHAR(50) NOT NULL,
  -- Valores: 'create_order', 'process_payment', 'send_whatsapp', etc
  
  -- Resultado da operação (JSONB)
  result JSONB,
  -- Ex: { order_id: '...', status: 'created', created_at: '...' }
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  -- Valores: 'pending', 'completed', 'failed'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL, -- Limpa chaves antigas (ex: 24h)
  
  -- Metadados
  metadata JSONB DEFAULT '{}'
);

-- Índices
CREATE INDEX idx_idempotency_key_hash ON idempotency_keys(key_hash);
CREATE INDEX idx_idempotency_tenant ON idempotency_keys(tenant_id, operation_type, created_at DESC);
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at) WHERE expires_at < NOW();

-- Função para limpar chaves expiradas (rodar via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM idempotency_keys
  WHERE expires_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TABELA: WEBHOOK_EVENTS
-- ============================================
-- Armazena eventos de webhooks antes de processar
-- Permite processamento assíncrono e retry

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Fonte do webhook
  source VARCHAR(50) NOT NULL,
  -- Valores: 'stripe', 'twilio', 'whatsapp', 'custom'
  
  -- Evento recebido
  event_type VARCHAR(100) NOT NULL,
  -- Ex: 'payment_intent.succeeded', 'message.received'
  
  -- Payload completo (JSONB)
  payload JSONB NOT NULL,
  
  -- Status de processamento
  status VARCHAR(50) DEFAULT 'pending',
  -- Valores: 'pending', 'processing', 'completed', 'failed', 'retrying'
  
  -- Tentativas
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  -- Erro (se houver)
  error_message TEXT,
  error_stack TEXT,
  
  -- Timestamps
  received_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  next_retry_at TIMESTAMP,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  -- Ex: { signature: '...', ip_address: '...', user_agent: '...' }
);

-- Índices
CREATE INDEX idx_webhook_events_status ON webhook_events(status, next_retry_at) 
  WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_webhook_events_tenant ON webhook_events(tenant_id, source, received_at DESC);
CREATE INDEX idx_webhook_events_type ON webhook_events(source, event_type, status);

-- Função para marcar webhook para retry
CREATE OR REPLACE FUNCTION schedule_webhook_retry(
  p_webhook_id UUID,
  p_delay_minutes INTEGER DEFAULT 5
)
RETURNS VOID AS $$
BEGIN
  UPDATE webhook_events
  SET 
    status = 'retrying',
    attempt_count = attempt_count + 1,
    next_retry_at = NOW() + (p_delay_minutes || ' minutes')::INTERVAL,
    error_message = NULL
  WHERE id = p_webhook_id
    AND attempt_count < max_attempts;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE idempotency_keys IS 'Chaves de idempotência para evitar operações duplicadas';
COMMENT ON TABLE webhook_events IS 'Eventos de webhook para processamento assíncrono';
```

### 1.5 Migration: Row Level Security (RLS) - Políticas Reais

**Arquivo:** `scripts/migrations/006-row-level-security-policies.sql`

```sql
-- ============================================
-- ROW LEVEL SECURITY - POLÍTICAS REAIS
-- ============================================
-- Implementa isolamento completo por tenant no banco de dados
-- Segurança no nível do banco, não apenas no código

-- Função auxiliar para obter tenant_id do usuário atual
-- (assumindo que o JWT contém o tenant_id)
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
  -- Tenta obter do contexto da sessão (setado pelo backend)
  RETURN current_setting('app.current_tenant_id', true)::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- POLÍTICAS PARA PRODUTOS
-- ============================================
CREATE POLICY produtos_tenant_isolation ON produtos
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================
-- POLÍTICAS PARA ESTOQUE
-- ============================================
CREATE POLICY estoque_tenant_isolation ON movimentacoes_estoque
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================
-- POLÍTICAS PARA PEDIDOS
-- ============================================
CREATE POLICY pedidos_tenant_isolation ON pedidos
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================
-- POLÍTICAS PARA USUÁRIOS
-- ============================================
CREATE POLICY usuarios_tenant_isolation ON usuarios
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================
-- POLÍTICAS PARA USAGE_LOGS
-- ============================================
CREATE POLICY usage_logs_tenant_isolation ON usage_logs
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================
-- POLÍTICAS PARA CONVERSAS WHATSAPP
-- ============================================
CREATE POLICY whatsapp_conv_tenant_isolation ON whatsapp_conversations
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================
-- POLÍTICAS PARA IDEMPOTENCY_KEYS
-- ============================================
CREATE POLICY idempotency_tenant_isolation ON idempotency_keys
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================
-- POLÍTICAS PARA WEBHOOK_EVENTS
-- ============================================
CREATE POLICY webhook_events_tenant_isolation ON webhook_events
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- NOTA: Para funcionar, o backend precisa setar o contexto:
-- SET app.current_tenant_id = 'uuid-do-tenant';
-- Isso deve ser feito em um middleware/interceptor após autenticação
```

---

## 2. 🔒 SEGURANÇA E IDEMPOTÊNCIA

### 2.1 Serviço de Idempotência

**Arquivo:** `backend/src/modules/common/services/idempotency.service.ts`

```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { IdempotencyKey } from '../../../database/entities/IdempotencyKey.entity';
import * as crypto from 'crypto';

export interface IdempotencyResult<T> {
  isNew: boolean;
  result: T | null;
}

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private idempotencyRepository: Repository<IdempotencyKey>,
    private dataSource: DataSource,
  ) {}

  /**
   * Gera hash único para uma operação
   */
  generateKey(
    operationType: string,
    data: any,
    tenantId: string,
    userId?: string,
  ): string {
    const payload = JSON.stringify({
      operationType,
      data,
      tenantId,
      userId,
      timestamp: Math.floor(Date.now() / 1000), // Arredonda para segundo (idempotência por segundo)
    });

    return crypto
      .createHash('sha256')
      .update(payload)
      .digest('hex');
  }

  /**
   * Verifica se operação já foi executada
   * Retorna resultado anterior se existir, ou null se é nova
   */
  async checkOrCreate<T>(
    keyHash: string,
    tenantId: string,
    operationType: string,
    ttlHours: number = 24,
  ): Promise<IdempotencyResult<T>> {
    // Busca chave existente
    const existing = await this.idempotencyRepository.findOne({
      where: { key_hash: keyHash },
    });

    if (existing) {
      // Operação já foi executada
      if (existing.status === 'completed' && existing.result) {
        return {
          isNew: false,
          result: existing.result as T,
        };
      }

      // Operação está pendente (pode estar sendo processada)
      if (existing.status === 'pending') {
        throw new ConflictException(
          'Operação idêntica já está sendo processada',
        );
      }

      // Operação falhou anteriormente, permite retry
      return {
        isNew: true,
        result: null,
      };
    }

    // Cria nova chave
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    const newKey = this.idempotencyRepository.create({
      key_hash: keyHash,
      tenant_id: tenantId,
      operation_type: operationType,
      status: 'pending',
      expires_at: expiresAt,
    });

    await this.idempotencyRepository.save(newKey);

    return {
      isNew: true,
      result: null,
    };
  }

  /**
   * Marca operação como concluída com resultado
   */
  async markCompleted<T>(
    keyHash: string,
    result: T,
  ): Promise<void> {
    await this.idempotencyRepository.update(
      { key_hash: keyHash },
      {
        status: 'completed',
        result: result as any,
      },
    );
  }

  /**
   * Marca operação como falha
   */
  async markFailed(keyHash: string, error: string): Promise<void> {
    await this.idempotencyRepository.update(
      { key_hash: keyHash },
      {
        status: 'failed',
        metadata: { error },
      },
    );
  }

  /**
   * Limpa chaves expiradas (rodar via cron)
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.idempotencyRepository
      .createQueryBuilder()
      .delete()
      .where('expires_at < NOW() - INTERVAL \'7 days\'')
      .execute();

    return result.affected || 0;
  }
}
```

### 2.2 Decorator para Idempotência

**Arquivo:** `backend/src/modules/common/decorators/idempotent.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

export interface IdempotentOptions {
  ttlHours?: number;
  operationType: string;
  keyGenerator?: (args: any[], context: any) => string;
}

export const Idempotent = (options: IdempotentOptions) =>
  SetMetadata(IDEMPOTENT_KEY, options);
```

### 2.3 Interceptor de Idempotência

**Arquivo:** `backend/src/modules/common/interceptors/idempotency.interceptor.ts`

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { IdempotencyService } from '../services/idempotency.service';
import { IDEMPOTENT_KEY, IdempotentOptions } from '../decorators/idempotent.decorator';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private idempotencyService: IdempotencyService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const options = this.reflector.get<IdempotentOptions>(
      IDEMPOTENT_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenant_id;
    const userId = request.user?.id;

    if (!tenantId) {
      return next.handle();
    }

    // Gera chave de idempotência
    const keyGenerator =
      options.keyGenerator ||
      ((args) => JSON.stringify(args));
    
    const keyHash = this.idempotencyService.generateKey(
      options.operationType,
      {
        body: request.body,
        params: request.params,
        query: request.query,
      },
      tenantId,
      userId,
    );

    // Verifica se já existe
    const { isNew, result } = await this.idempotencyService.checkOrCreate(
      keyHash,
      tenantId,
      options.operationType,
      options.ttlHours || 24,
    );

    // Se não é nova, retorna resultado anterior
    if (!isNew && result) {
      return new Observable((observer) => {
        observer.next(result);
        observer.complete();
      });
    }

    // Executa operação
    return next.handle().pipe(
      tap(async (response) => {
        // Marca como concluída
        await this.idempotencyService.markCompleted(keyHash, response);
      }),
      catchError(async (error) => {
        // Marca como falha
        await this.idempotencyService.markFailed(
          keyHash,
          error.message,
        );
        throw error;
      }),
    );
  }
}
```

### 2.4 Middleware para RLS (Row Level Security)

**Arquivo:** `backend/src/modules/common/middleware/rls.middleware.ts`

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';

@Injectable()
export class RLSMiddleware implements NestMiddleware {
  constructor(private dataSource: DataSource) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Obtém tenant_id do usuário autenticado
    const tenantId = (req as any).user?.tenant_id;

    if (tenantId) {
      // Seta contexto no PostgreSQL para RLS
      await this.dataSource.query(
        `SET app.current_tenant_id = $1`,
        [tenantId],
      );
    }

    next();
  }
}
```

---

## 3. 📊 SERVIÇO DE CONTROLE DE CUSTOS

### 3.1 Serviço de Usage Logs

**Arquivo:** `backend/src/modules/common/services/usage-log.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsageLog } from '../../../database/entities/UsageLog.entity';

export type ServiceType =
  | 'openai_tokens'
  | 'openai_request'
  | 'whatsapp_msg'
  | 'whatsapp_conversation'
  | 'stripe_txn'
  | 'stripe_fee';

export interface LogUsageParams {
  tenantId: string;
  serviceType: ServiceType;
  quantity: number;
  costEstimated: number;
  metadata?: Record<string, any>;
  referenceId?: string;
  referenceType?: string;
}

@Injectable()
export class UsageLogService {
  constructor(
    @InjectRepository(UsageLog)
    private usageLogRepository: Repository<UsageLog>,
  ) {}

  /**
   * Registra uso de um serviço
   */
  async logUsage(params: LogUsageParams): Promise<UsageLog> {
    const log = this.usageLogRepository.create({
      tenant_id: params.tenantId,
      service_type: params.serviceType,
      quantity: params.quantity,
      cost_estimated: params.costEstimated,
      metadata: params.metadata || {},
      reference_id: params.referenceId,
      reference_type: params.referenceType,
    });

    return this.usageLogRepository.save(log);
  }

  /**
   * Calcula custo total por tenant em período
   */
  async getTenantCost(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ serviceType: string; totalQuantity: number; totalCost: number }>> {
    const result = await this.usageLogRepository.query(
      `SELECT * FROM get_tenant_cost($1, $2, $3)`,
      [tenantId, startDate, endDate],
    );

    return result.map((row: any) => ({
      serviceType: row.service_type,
      totalQuantity: parseInt(row.total_quantity),
      totalCost: parseFloat(row.total_cost),
    }));
  }

  /**
   * Verifica se tenant excedeu limites do plano
   */
  async checkPlanLimits(tenantId: string): Promise<{
    exceeded: boolean;
    limits: Record<string, { used: number; limit: number }>;
  }> {
    // Busca limites do plano do tenant
    const tenant = await this.usageLogRepository.query(
      `SELECT plan_limits FROM tenants WHERE id = $1`,
      [tenantId],
    );

    if (!tenant[0]?.plan_limits) {
      return { exceeded: false, limits: {} };
    }

    const planLimits = tenant[0].plan_limits;
    const limits: Record<string, { used: number; limit: number }> = {};
    let exceeded = false;

    // Calcula uso atual do mês
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const costs = await this.getTenantCost(
      tenantId,
      startOfMonth,
      new Date(),
    );

    // Verifica cada limite
    for (const [key, limit] of Object.entries(planLimits)) {
      const usage = costs.find((c) => c.serviceType === key);
      const used = usage?.totalQuantity || 0;

      limits[key] = {
        used,
        limit: limit as number,
      };

      if (used >= limit) {
        exceeded = true;
      }
    }

    return { exceeded, limits };
  }
}
```

---

## 4. 🔐 SERVIÇO DE CRIPTOGRAFIA (BYOK)

### 4.1 Serviço de Criptografia

**Arquivo:** `backend/src/modules/common/services/encryption.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import { Tenant } from '../../../database/entities/Tenant.entity';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly encryptionKey: string;

  constructor(
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {
    // Chave de encriptação do .env (deve ser forte em produção)
    this.encryptionKey =
      this.configService.get<string>('ENCRYPTION_KEY') ||
      'change-me-in-production-min-32-chars';
  }

  /**
   * Encripta API Key e salva no tenant
   */
  async encryptAndSaveApiKey(
    tenantId: string,
    keyType: 'openai' | 'twilio_sid' | 'twilio_token' | 'stripe',
    apiKey: string,
  ): Promise<void> {
    // Usa função SQL do PostgreSQL para encriptar
    const columnMap = {
      openai: 'openai_api_key_encrypted',
      twilio_sid: 'twilio_account_sid_encrypted',
      twilio_token: 'twilio_auth_token_encrypted',
      stripe: 'stripe_api_key_encrypted',
    };

    const column = columnMap[keyType];

    await this.dataSource.query(
      `UPDATE tenants 
       SET ${column} = encrypt_api_key($1, $2)
       WHERE id = $3`,
      [apiKey, this.encryptionKey, tenantId],
    );
  }

  /**
   * Descriptografa e retorna API Key
   */
  async decryptApiKey(
    tenantId: string,
    keyType: 'openai' | 'twilio_sid' | 'twilio_token' | 'stripe',
  ): Promise<string | null> {
    const columnMap = {
      openai: 'openai_api_key_encrypted',
      twilio_sid: 'twilio_account_sid_encrypted',
      twilio_token: 'twilio_auth_token_encrypted',
      stripe: 'stripe_api_key_encrypted',
    };

    const column = columnMap[keyType];

    const result = await this.dataSource.query(
      `SELECT decrypt_api_key(${column}, $1) as decrypted_key
       FROM tenants 
       WHERE id = $2`,
      [this.encryptionKey, tenantId],
    );

    return result[0]?.decrypted_key || null;
  }

  /**
   * Verifica se tenant usa BYOK para um serviço
   */
  async usesOwnKey(
    tenantId: string,
    service: 'openai' | 'twilio' | 'stripe',
  ): Promise<boolean> {
    const columnMap = {
      openai: 'use_own_openai_key',
      twilio: 'use_own_twilio_creds',
      stripe: 'use_own_stripe_key',
    };

    const column = columnMap[service];

    const result = await this.dataSource.query(
      `SELECT ${column} FROM tenants WHERE id = $1`,
      [tenantId],
    );

    return result[0]?.[column] || false;
  }
}
```

---

## 5. ✅ CHECKLIST DE IMPLEMENTAÇÃO - PARTE 1

### 5.1 Banco de Dados
- [ ] Criar migration `002-usage-logs-and-encryption.sql`
- [ ] Criar migration `003-tenant-api-keys-encryption.sql`
- [ ] Criar migration `004-whatsapp-conversations.sql`
- [ ] Criar migration `005-idempotency-and-webhooks.sql`
- [ ] Criar migration `006-row-level-security-policies.sql`
- [ ] Executar todas as migrations no banco de desenvolvimento
- [ ] Testar funções SQL (get_tenant_cost, encrypt_api_key, etc)
- [ ] Validar índices e performance

### 5.2 Backend - Serviços
- [ ] Criar `IdempotencyService`
- [ ] Criar `IdempotencyInterceptor`
- [ ] Criar decorator `@Idempotent()`
- [ ] Criar `RLSMiddleware`
- [ ] Criar `UsageLogService`
- [ ] Criar `EncryptionService`
- [ ] Registrar serviços no módulo comum

### 5.3 Backend - Integração
- [ ] Aplicar `RLSMiddleware` globalmente
- [ ] Aplicar `IdempotencyInterceptor` em `OrdersController.create()`
- [ ] Adicionar logging de uso em `OrdersService`
- [ ] Adicionar logging de uso em futuros serviços (OpenAI, WhatsApp)

### 5.4 Testes
- [ ] Testar idempotência (duplicar request, deve retornar mesmo resultado)
- [ ] Testar RLS (usuário de tenant A não acessa dados de tenant B)
- [ ] Testar criptografia (salvar e recuperar API keys)
- [ ] Testar usage logs (registrar e calcular custos)

### 5.5 Documentação
- [ ] Documentar migrations no README
- [ ] Documentar uso de idempotência
- [ ] Documentar BYOK (Bring Your Own Key)
- [ ] Documentar controle de custos

---

## 6. 📝 PRÓXIMOS PASSOS (Após Parte 1)

**PARTE 2:** Estrutura Base para WhatsApp Bot
- Serviços base (Twilio, Evolution API)
- Processamento de mensagens em camadas
- Cache Redis para respostas

**PARTE 3:** Integração OpenAI em Camadas
- Camada 1: Regex/NLP simples
- Camada 2: GPT-3.5-Turbo / GPT-4o-mini
- Camada 3: Cache de respostas

**PARTE 4:** Fluxo Completo WhatsApp Bot
- Processamento de pedidos
- Geração QR Code Pix
- Histórico de conversas

**PARTE 5:** Webhooks e Processamento Assíncrono
- Worker/Queue para webhooks
- Retry logic
- Processamento de pagamentos

**PARTE 6:** Dashboard Admin Completo
- KPIs e gráficos
- Relatórios avançados
- Gestão de estoque

**PARTE 7:** Performance e Otimizações
- Cache Redis implementado
- Otimização de queries
- Paginação

**PARTE 8:** Testes, Deploy e Monitoramento
- Testes automatizados
- CI/CD
- Monitoramento (Sentry, logs)

---

**Status:** ✅ PARTE 1 COMPLETA  
**Próxima Parte:** Aguardando confirmação para continuar

