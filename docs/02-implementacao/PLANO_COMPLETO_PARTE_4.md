# 🎯 PLANO COMPLETO DE IMPLEMENTAÇÃO - PARTE 4/8

## 💬 FLUXO COMPLETO WHATSAPP BOT

**Objetivo desta Parte:** Implementar fluxo completo de pedidos via WhatsApp, incluindo processamento de mensagens, criação de pedidos, geração de QR Code Pix e integração com sistema de pagamentos.

**Tempo Estimado:** 2-3 semanas  
**Prioridade:** 🔴 CRÍTICA (funcionalidade principal completa)

---

## 1. 📋 VISÃO GERAL DO FLUXO

### 1.1 Fluxo Completo de Compra

```
CLIENTE ENVIA: "Quero 3 brigadeiros"
     ↓
BOT: Processa com IA → Detecta intent "fazer_pedido"
     ↓
BOT: Verifica estoque → Tem 10 unidades ✅
     ↓
BOT: "Ótimo! 3 Brigadeiros = R$ 30,00. Como prefere pagar?"
     ↓
CLIENTE: "Pix"
     ↓
BOT: Gera QR Code Pix → Envia imagem
     ↓
BOT: "Escaneie o QR Code ou copie o código Pix abaixo"
     ↓
CLIENTE: Paga via Pix
     ↓
WEBHOOK: Pagamento confirmado (Stripe/GerenciaNet)
     ↓
BOT: Cria pedido no sistema (transação ACID)
     ↓
BOT: "✅ Pedido confirmado! Número: PED-123. Pronto em ~30 min"
     ↓
ADMIN: Recebe notificação → Marca como "em produção"
     ↓
ADMIN: Marca como "pronto"
     ↓
BOT: "🎉 Seu pedido está pronto para retirada!"
```

---

## 2. 🔧 SERVIÇO DE GESTÃO DE PEDIDOS VIA WHATSAPP

### 2.1 Serviço de Pedidos WhatsApp

**Arquivo:** `backend/src/modules/whatsapp/services/whatsapp-order.service.ts`

```typescript
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WhatsappConversation } from '../../../database/entities/WhatsappConversation.entity';
import { Pedido } from '../../../database/entities/Pedido.entity';
import { Produto } from '../../../database/entities/Produto.entity';
import { MovimentacaoEstoque } from '../../../database/entities/MovimentacaoEstoque.entity';
import { OrdersService } from '../../orders/orders.service';
import { PaymentService } from '../../payments/payment.service';
import { AIProcessorService } from './ai-processor.service';

export interface OrderContext {
  items: Array<{
    produto_id: string;
    produto_name: string;
    quantity: number;
    unit_price: number;
  }>;
  total: number;
  forma_pagamento?: 'pix' | 'credito' | 'debito' | 'dinheiro';
  customer_name?: string;
  customer_phone: string;
  delivery_address?: any;
}

@Injectable()
export class WhatsappOrderService {
  private readonly logger = new Logger(WhatsappOrderService.name);

  constructor(
    @InjectRepository(WhatsappConversation)
    private conversationRepository: Repository<WhatsappConversation>,
    @InjectRepository(Produto)
    private produtoRepository: Repository<Produto>,
    @InjectRepository(MovimentacaoEstoque)
    private estoqueRepository: Repository<MovimentacaoEstoque>,
    private ordersService: OrdersService,
    private paymentService: PaymentService,
    private aiProcessor: AIProcessorService,
    private dataSource: DataSource,
  ) {}

  /**
   * Processa pedido a partir de mensagem do cliente
   */
  async processOrderFromMessage(
    tenantId: string,
    conversationId: string,
    message: string,
  ): Promise<{
    status: 'waiting_payment' | 'created' | 'error';
    message: string;
    orderId?: string;
    paymentQrCode?: string;
    paymentCode?: string;
  }> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, tenant_id: tenantId },
    });

    if (!conversation) {
      throw new BadRequestException('Conversation not found');
    }

    // Processa mensagem com IA
    const intent = await this.aiProcessor.processMessage(tenantId, message, {
      conversationId,
      ...conversation.context,
    });

    // Se não é intent de fazer pedido, não processa
    if (intent.intent !== 'fazer_pedido') {
      return {
        status: 'error',
        message: 'Por favor, descreva o que você quer pedir.',
      };
    }

    // Extrai entidades (produto, quantidade)
    const produtoName = intent.entities?.produto;
    const quantidade = intent.entities?.quantidade || 1;

    if (!produtoName) {
      return {
        status: 'error',
        message: 'Qual produto você quer? Digite "cardápio" para ver nossos produtos.',
      };
    }

    // Busca produto
    const produto = await this.findProduct(tenantId, produtoName);
    if (!produto) {
      return {
        status: 'error',
        message: `Não encontrei o produto "${produtoName}". Digite "cardápio" para ver nossos produtos.`,
      };
    }

    // Verifica estoque
    const stock = await this.checkStock(tenantId, produto.id);
    if (stock < quantidade) {
      return {
        status: 'error',
        message: `Desculpe, temos apenas ${stock} unidades de ${produto.name} em estoque. Deseja outra quantidade?`,
      };
    }

    // Cria contexto de pedido
    const orderContext: OrderContext = {
      items: [
        {
          produto_id: produto.id,
          produto_name: produto.name,
          quantity: quantidade,
          unit_price: parseFloat(produto.price),
        },
      ],
      total: quantidade * parseFloat(produto.price),
      customer_phone: conversation.customer_phone,
      customer_name: conversation.customer_name,
    };

    // Salva contexto na conversa
    await this.conversationService.updateContext(conversationId, {
      orderContext,
      step: 'confirming_payment',
    });

    // Se forma de pagamento já foi escolhida, processa
    if (intent.entities?.forma_pagamento) {
      return await this.createOrder(tenantId, conversationId, orderContext, {
        formaPagamento: intent.entities.forma_pagamento,
      });
    }

    // Pergunta forma de pagamento
    return {
      status: 'waiting_payment',
      message: `✅ ${quantidade}x ${produto.name} = R$ ${orderContext.total.toFixed(2)}\n\nComo prefere pagar?\n\n1️⃣ PIX (5% desconto)\n2️⃣ Cartão de Crédito\n3️⃣ Cartão de Débito\n4️⃣ Dinheiro (retirada)`,
    };
  }

  /**
   * Cria pedido e gera pagamento
   */
  async createOrder(
    tenantId: string,
    conversationId: string,
    orderContext: OrderContext,
    payment: { formaPagamento: 'pix' | 'credito' | 'debito' | 'dinheiro' },
  ): Promise<{
    status: 'waiting_payment' | 'created' | 'error';
    message: string;
    orderId?: string;
    paymentQrCode?: string;
    paymentCode?: string;
  }> {
    // Aplica desconto PIX (5%)
    let total = orderContext.total;
    if (payment.formaPagamento === 'pix') {
      total = total * 0.95;
    }

    try {
      // Se for Pix, gera QR Code antes de criar pedido
      if (payment.formaPagamento === 'pix') {
        const pixPayment = await this.paymentService.createPixPayment({
          tenantId,
          amount: total,
          description: `Pedido via WhatsApp - ${orderContext.items.map((i) => `${i.quantity}x ${i.produto_name}`).join(', ')}`,
          customer: {
            name: orderContext.customer_name || 'Cliente WhatsApp',
            phone: orderContext.customer_phone,
          },
        });

        // Cria pedido com status "pendente_pagamento"
        const pedido = await this.ordersService.create({
          tenantId,
          channel: 'whatsapp',
          items: orderContext.items,
          total,
          discount_amount: orderContext.total - total,
          customer: {
            name: orderContext.customer_name,
            phone: orderContext.customer_phone,
          },
          payment_method: 'pix',
          status: 'pendente_pagamento',
        });

        // Atualiza conversa
        const conversation = await this.conversationRepository.findOne({
          where: { id: conversationId },
        });
        if (conversation) {
          conversation.pedido_id = pedido.id;
          conversation.status = 'waiting_payment';
          await this.conversationRepository.save(conversation);
        }

        return {
          status: 'waiting_payment',
          message: `✅ Pedido criado! Número: ${pedido.order_no}\n\n💰 Total: R$ ${total.toFixed(2)} (5% desconto PIX)\n\n📱 *Pagamento via PIX:*\n\nEscaneie o QR Code abaixo:`,
          orderId: pedido.id,
          paymentQrCode: pixPayment.qrCode,
          paymentCode: pixPayment.code,
        };
      }

      // Se for dinheiro (retirada), cria pedido direto
      if (payment.formaPagamento === 'dinheiro') {
        const pedido = await this.ordersService.create({
          tenantId,
          channel: 'whatsapp',
          items: orderContext.items,
          total,
          customer: {
            name: orderContext.customer_name,
            phone: orderContext.customer_phone,
          },
          payment_method: 'dinheiro',
          status: 'confirmado',
          delivery_type: 'pickup',
        });

        // Atualiza conversa
        const conversation = await this.conversationRepository.findOne({
          where: { id: conversationId },
        });
        if (conversation) {
          conversation.pedido_id = pedido.id;
          conversation.status = 'order_placed';
          await this.conversationRepository.save(conversation);
        }

        return {
          status: 'created',
          message: `✅ Pedido confirmado!\n\n📦 Número: ${pedido.order_no}\n💰 Total: R$ ${total.toFixed(2)}\n💰 Forma: Dinheiro (retirada)\n\n⏰ Pronto em aproximadamente 30 minutos!\n\nVocê receberá uma mensagem quando estiver pronto.`,
          orderId: pedido.id,
        };
      }

      // Se for cartão, cria payment intent
      if (
        payment.formaPagamento === 'credito' ||
        payment.formaPagamento === 'debito'
      ) {
        const cardPayment = await this.paymentService.createCardPayment({
          tenantId,
          amount: total,
          description: `Pedido via WhatsApp - ${orderContext.items.map((i) => `${i.quantity}x ${i.produto_name}`).join(', ')}`,
          customer: {
            name: orderContext.customer_name || 'Cliente WhatsApp',
            phone: orderContext.customer_phone,
          },
        });

        return {
          status: 'waiting_payment',
          message: `✅ Pedido criado! Número: PED-XXX\n\n💰 Total: R$ ${total.toFixed(2)}\n\n💳 Para pagar com cartão, clique no link:\n${cardPayment.paymentUrl}\n\nOu envie os dados do cartão (com segurança) via WhatsApp.`,
          orderId: cardPayment.orderId,
        };
      }

      throw new BadRequestException('Forma de pagamento inválida');
    } catch (error) {
      this.logger.error(`Error creating order: ${error}`);
      return {
        status: 'error',
        message: 'Desculpe, tive um problema ao criar seu pedido. Tente novamente.',
      };
    }
  }

  /**
   * Confirma pagamento e finaliza pedido
   */
  async confirmPayment(
    tenantId: string,
    orderId: string,
    paymentId: string,
  ): Promise<void> {
    // Busca pedido
    const pedido = await this.ordersService.findOne(orderId, tenantId);
    if (!pedido) {
      throw new BadRequestException('Order not found');
    }

    // Confirma pagamento
    await this.paymentService.confirmPayment(paymentId);

    // Atualiza status do pedido para "confirmado"
    await this.ordersService.updateStatus(orderId, tenantId, 'confirmado');

    // Busca conversa associada
    const conversation = await this.conversationRepository.findOne({
      where: { pedido_id: orderId, tenant_id: tenantId },
    });

    if (conversation) {
      conversation.status = 'order_placed';
      await this.conversationRepository.save(conversation);

      // Envia mensagem de confirmação
      // (será feito pelo WhatsappService)
    }
  }

  /**
   * Busca produto por nome
   */
  private async findProduct(
    tenantId: string,
    productName: string,
  ): Promise<Produto | null> {
    const produtos = await this.produtoRepository.find({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
    });

    return (
      produtos.find(
        (p) =>
          p.name.toLowerCase().includes(productName.toLowerCase()) ||
          productName.toLowerCase().includes(p.name.toLowerCase()),
      ) || null
    );
  }

  /**
   * Verifica estoque disponível
   */
  private async checkStock(tenantId: string, productId: string): Promise<number> {
    const estoque = await this.estoqueRepository.findOne({
      where: {
        tenant_id: tenantId,
        produto_id: productId,
      },
    });

    if (!estoque) {
      return 0;
    }

    return estoque.current_stock - (estoque.reserved_stock || 0);
  }
}
```

---

## 3. 💳 SERVIÇO DE PAGAMENTOS

### 3.1 Serviço de Pagamento (Stripe/GerenciaNet)

**Arquivo:** `backend/src/modules/payments/payment.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import QRCode from 'qrcode';

export interface PixPaymentResult {
  qrCode: string; // Base64 image
  code: string; // Código Pix copia e cola
  expirationDate: Date;
}

export interface CardPaymentResult {
  paymentUrl: string;
  orderId: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe | null = null;

  constructor(private configService: ConfigService) {
    this.initializeStripe();
  }

  private initializeStripe() {
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (apiKey) {
      this.stripe = new Stripe(apiKey, {
        apiVersion: '2024-06-20',
      });
      this.logger.log('Stripe initialized');
    }
  }

  /**
   * Cria pagamento Pix
   */
  async createPixPayment(data: {
    tenantId: string;
    amount: number; // Em centavos (ex: 3000 = R$ 30,00)
    description: string;
    customer: { name: string; phone: string };
  }): Promise<PixPaymentResult> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      // Cria Payment Intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100), // Converte para centavos
        currency: 'brl',
        payment_method_types: ['pix'],
        metadata: {
          tenant_id: data.tenantId,
          description: data.description,
          customer_name: data.customer.name,
          customer_phone: data.customer.phone,
        },
      });

      // Obtém QR Code do Pix
      // Nota: Stripe suporta Pix no Brasil, mas pode precisar de configuração adicional
      // Alternativa: Usar GerenciaNet, Mercado Pago ou outra API brasileira

      // Gera QR Code Pix manualmente (formato EMC)
      const pixCode = this.generatePixCode({
        amount: data.amount,
        description: data.description,
        merchantName: 'Sua Loja',
        merchantKey: 'sua-chave-pix',
      });

      // Gera imagem QR Code
      const qrCodeImage = await QRCode.toDataURL(pixCode, {
        width: 300,
        margin: 2,
      });

      return {
        qrCode: qrCodeImage,
        code: pixCode,
        expirationDate: new Date(Date.now() + 30 * 60 * 1000), // 30 minutos
      };
    } catch (error) {
      this.logger.error(`Error creating Pix payment: ${error}`);
      throw error;
    }
  }

  /**
   * Gera código Pix (formato EMC - copia e cola)
   */
  private generatePixCode(data: {
    amount: number;
    description: string;
    merchantName: string;
    merchantKey: string;
  }): string {
    // Implementação simplificada
    // Em produção, usar biblioteca específica ou API de pagamento brasileira
    // Formato EMC: https://www.bcb.gov.br/estabilidadefinanceira/pix
    return `00020126...${data.merchantKey}...${data.amount}...${data.description}`;
  }

  /**
   * Cria pagamento com cartão
   */
  async createCardPayment(data: {
    tenantId: string;
    amount: number;
    description: string;
    customer: { name: string; phone: string };
  }): Promise<CardPaymentResult> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      // Cria Checkout Session
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'brl',
              product_data: {
                name: data.description,
              },
              unit_amount: Math.round(data.amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${this.configService.get('FRONTEND_URL')}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.configService.get('FRONTEND_URL')}/payment/cancel`,
        metadata: {
          tenant_id: data.tenantId,
        },
      });

      return {
        paymentUrl: session.url || '',
        orderId: session.id,
      };
    } catch (error) {
      this.logger.error(`Error creating card payment: ${error}`);
      throw error;
    }
  }

  /**
   * Confirma pagamento (chamado via webhook)
   */
  async confirmPayment(paymentId: string): Promise<void> {
    // Busca payment intent ou checkout session
    // Atualiza status no banco
    // Este método será chamado pelo webhook do Stripe
  }
}
```

---

## 4. 📱 ATUALIZAÇÃO DO WHATSAPPSERVICE COMPLETO

### 4.1 Fluxo Completo Integrado

**Arquivo:** `backend/src/modules/whatsapp/whatsapp.service.ts` (atualizado)

```typescript
// ... imports ...
import { WhatsappOrderService } from './services/whatsapp-order.service';

@Injectable()
export class WhatsappService {
  constructor(
    // ... outros serviços ...
    private whatsappOrderService: WhatsappOrderService,
  ) {}

  async processIncomingMessage(message: WhatsappMessage): Promise<void> {
    // ... código existente até processar mensagem ...

    // Se intent é fazer pedido, processa pedido
    if (intent.intent === 'fazer_pedido') {
      const orderResult = await this.whatsappOrderService.processOrderFromMessage(
        tenantId,
        conversation.id,
        message.body,
      );

      // Envia resposta com QR Code se necessário
      if (orderResult.paymentQrCode) {
        // Envia QR Code como imagem
        await this.sendMedia(message.from, {
          body: orderResult.message,
          mediaUrl: orderResult.paymentQrCode,
        });

        // Envia código Pix copia e cola
        if (orderResult.paymentCode) {
          await this.sendMessage(
            message.from,
            `📋 *Código Pix (Copia e Cola):*\n\`\`\`\n${orderResult.paymentCode}\n\`\`\`\n\nApós pagar, envie "paguei" para confirmar.`,
          );
        }
      } else {
        // Envia mensagem normal
        await this.sendMessage(message.from, orderResult.message);
      }

      return;
    }

    // Se cliente confirmou pagamento
    const lowerMessage = message.body.toLowerCase();
    if (
      lowerMessage.includes('paguei') ||
      lowerMessage.includes('já paguei') ||
      lowerMessage.includes('pago')
    ) {
      // Busca pedido pendente da conversa
      const conversation = await this.conversationService.getOrCreateConversation(
        tenantId,
        message.from,
      );

      if (conversation.pedido_id && conversation.status === 'waiting_payment') {
        await this.sendMessage(
          message.from,
          '✅ Recebi sua confirmação! Verificando pagamento...\n\nAssim que confirmar, enviarei o número do seu pedido.',
        );

        // TODO: Verificar pagamento automaticamente (webhook)
        // Por enquanto, aguarda confirmação manual
      }
    }

    // Outros intents processados normalmente
    // ... resto do código ...
  }
}
```

---

## 5. 🔔 WEBHOOK DE PAGAMENTO

### 5.1 Controller de Webhook

**Arquivo:** `backend/src/modules/payments/payments.controller.ts`

```typescript
import { Controller, Post, Body, Headers, HttpCode } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { WhatsappOrderService } from '../whatsapp/services/whatsapp-order.service';
import Stripe from 'stripe';

@Controller('payments')
export class PaymentsController {
  constructor(
    private paymentService: PaymentService,
    private whatsappOrderService: WhatsappOrderService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Body() body: any,
    @Headers('stripe-signature') signature: string,
  ) {
    // Valida assinatura do webhook
    const event = this.validateWebhook(body, signature);

    // Processa evento
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const tenantId = paymentIntent.metadata?.tenant_id;
      const orderId = paymentIntent.metadata?.order_id;

      if (tenantId && orderId) {
        await this.whatsappOrderService.confirmPayment(
          tenantId,
          orderId,
          paymentIntent.id,
        );
      }
    }

    return { received: true };
  }

  private validateWebhook(body: any, signature: string): Stripe.Event {
    // Valida assinatura do Stripe
    // Implementar validação real
    return body;
  }
}
```

---

## 6. ✅ CHECKLIST DE IMPLEMENTAÇÃO - PARTE 4

### 6.1 Serviços
- [ ] Criar `WhatsappOrderService`
- [ ] Criar/atualizar `PaymentService`
- [ ] Integrar com `OrdersService`
- [ ] Integrar com `AIProcessorService`

### 6.2 Fluxo Completo
- [ ] Processar mensagem de pedido
- [ ] Verificar estoque
- [ ] Criar pedido
- [ ] Gerar QR Code Pix
- [ ] Enviar QR Code via WhatsApp
- [ ] Confirmar pagamento via webhook
- [ ] Atualizar status do pedido
- [ ] Enviar mensagem de confirmação

### 6.3 Integrações
- [ ] Integrar Stripe (Pix e Cartão)
- [ ] Gerar QR Code Pix
- [ ] Configurar webhook Stripe
- [ ] Testar webhook

### 6.4 Testes
- [ ] Testar fluxo completo de pedido
- [ ] Testar geração de QR Code
- [ ] Testar confirmação de pagamento
- [ ] Testar tratamento de erros

---

## 7. 📝 PRÓXIMOS PASSOS (Após Parte 4)

**PARTE 5:** Dashboard Completo para Dono da Loja
- KPIs e métricas
- Gestão de vendas
- Gestão de clientes
- Gestão de estoque

---

**Status:** ✅ PARTE 4 COMPLETA  
**Próxima Parte:** PARTE 5 - Dashboard Completo
