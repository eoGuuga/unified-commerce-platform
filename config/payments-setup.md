# 🚀 CONFIGURAÇÃO DE PAGAMENTOS - MERCADO PAGO

## 📋 PRÉ-REQUISITOS

1. **Conta no Mercado Pago**
   - Acesse: https://www.mercadopago.com.br/
   - Crie uma conta (pessoal ou business)

2. **Credenciais de Desenvolvimento**
   - Vá para: https://www.mercadopago.com.br/developers/panel/credentials
   - Copie as chaves de TESTE (não use produção ainda)

## 🔧 CONFIGURAÇÃO

### 1. Instalar Dependências
```bash
cd backend
npm install mercadopago@^2.11.0
```

### 2. Configurar Variáveis de Ambiente

Crie ou edite o arquivo `backend/.env`:

```bash
# ===============================
# PAGAMENTOS - MERCADO PAGO
# ===============================
PAYMENT_PROVIDER=mercadopago
MERCADOPAGO_ACCESS_TOKEN="TEST-1234567890123456-123456-abcdef1234567890abcdef1234567890"
MERCADOPAGO_PUBLIC_KEY="TEST-abcdef1234567890abcdef1234567890"
```

### 3. Obter as Chaves Reais

1. **Acesse o painel de desenvolvedores:**
   - https://www.mercadopago.com.br/developers/panel/credentials

2. **Para TESTES (Sandbox):**
   - Use as chaves que começam com `TEST-`

3. **Para PRODUÇÃO:**
   - Clique em "Ir para credenciais de produção"
   - Complete a verificação da conta
   - Use as chaves sem `TEST-`

## 💳 MÉTODOS DE PAGAMENTO SUPORTADOS

### ✅ PIX (Recomendado)
- Taxa: ~0.99% + R$ 0.49 por transação
- Prazo: Instantâneo
- Popular no Brasil

### ✅ Cartão de Crédito
- Taxa: ~4.99% + R$ 0.49 por transação
- Prazo: Imediato (aprovado) ou até 2 dias

### ✅ Boleto
- Taxa: ~3.49% + R$ 0.49 por transação
- Prazo: Até 3 dias úteis

### ✅ Cartão de Débito
- Taxa: ~3.49% + R$ 0.49 por transação
- Prazo: Imediato

## 🔄 TESTANDO A INTEGRAÇÃO

### 1. Iniciar o Backend
```bash
cd backend
npm run start:dev
```

### 2. Testar Pagamento
- Acesse: http://localhost:3000/loja
- Adicione produtos ao carrinho
- Vá para checkout
- Selecione método de pagamento

### 3. Verificar Logs
```bash
# No terminal do backend, você deve ver:
[MercadoPagoProvider] Mercado Pago client initialized
[PaymentsService] Processing Pix payment for order...
```

## 🎯 WEBHOOKS (IMPORTANTE PARA PRODUÇÃO)

### 1. Configurar URL de Webhook
No painel do Mercado Pago:
- URL: `https://seudominio.com/api/v1/payments/webhook`
- Eventos: `payment`

### 2. Implementar Handler
O sistema já tem um endpoint preparado em:
- `backend/src/modules/payments/payments.controller.ts`

## 🚨 DICAS IMPORTANTES

### 1. **Nunca use chaves de produção em desenvolvimento**
- Sempre use `TEST-` para desenvolvimento
- Mantenha chaves de produção em segredo

### 2. **Configure webhooks ANTES de ir para produção**
- Sem webhooks, pagamentos podem não ser confirmados automaticamente

### 3. **Teste todos os métodos de pagamento**
- PIX, cartão, boleto devem funcionar
- Teste casos de sucesso e falha

### 4. **Monitore taxas e custos**
- Mercado Pago cobra por transação
- Calcule se compensa financeiramente

## 🔍 RESOLUÇÃO DE PROBLEMAS

### Erro: "Invalid access token"
- Verifique se o token está correto
- Certifique-se de usar token de TESTE para desenvolvimento

### Erro: "Payment method not available"
- Alguns métodos podem não estar habilitados na sua conta
- Verifique configurações no painel do Mercado Pago

### Pagamentos não chegam
- Configure webhooks corretamente
- Verifique se a URL está acessível publicamente

## 📞 SUPORTE

- **Documentação Oficial:** https://www.mercadopago.com.br/developers/pt/docs
- **Suporte Mercado Pago:** https://www.mercadopago.com.br/ajuda
- **Comunidade:** https://github.com/mercadopago/sdk-nodejs

---

## 🎉 PRÓXIMOS PASSOS

Após configurar pagamentos:

1. ✅ **Teste em desenvolvimento**
2. ✅ **Configure webhooks**
3. ✅ **Teste em produção**
4. ✅ **Configure notificações**
5. ✅ **Implemente reembolsos**

**O sistema já está preparado para receber pagamentos reais!** 🚀💰
---

## Notas de integracao no backend

- O endpoint `POST /api/v1/payments` aceita campos extras para cartao:
  - `cardToken` (token gerado no frontend)
  - `installments` (numero de parcelas)
  - `payerEmail` (email do comprador)
- Para Pix e boleto, `payerEmail` e recomendado quando disponivel.
- Defina `MERCADOPAGO_WEBHOOK_URL` para confirmar pagamentos automaticamente.
