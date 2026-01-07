# 🎯 Plano PDV Completo - Melhorias Focadas

> **Foco:** Melhorar o PDV existente para resolver os problemas REAIS dela: Controle de Estoque + UX Rápida

---

## 📊 Análise do PDV Atual

### O Que JÁ Existe ✅

1. **Frontend `/pdv`** (`frontend/app/pdv/page.tsx`)
   - ✅ Busca de produtos
   - ✅ Carrinho básico
   - ✅ Finalizar venda
   - ✅ Mostra estoque no produto

2. **Backend ACID** (`backend/src/modules/orders/orders.service.ts`)
   - ✅ Transação ACID completa
   - ✅ FOR UPDATE lock (lock pessimista)
   - ✅ Validação de estoque
   - ✅ Abate automático de estoque

### O Que PRECISA Melhorar ⚠️

1. **Validação de Estoque no Carrinho**
   - ❌ Não valida estoque quando atualiza quantidade no carrinho
   - ❌ Não mostra erro claro se estoque insuficiente
   - ❌ Permite adicionar mais do que tem (só valida no backend)

2. **Estoque em Tempo Real**
   - ❌ Não atualiza estoque automaticamente
   - ❌ Precisa recarregar página para ver estoque atualizado
   - ❌ Não mostra alertas visuais claros

3. **UX para Uso Diário**
   - ⚠️ Busca poderia ser mais rápida (autocomplete)
   - ⚠️ Carrinho poderia ser mais visual
   - ⚠️ Falta feedback visual claro (sucesso/erro)
   - ⚠️ Não tem modo offline básico

4. **Validações**
   - ⚠️ Não valida estoque antes de adicionar ao carrinho
   - ⚠️ Não bloqueia produto se estoque = 0
   - ⚠️ Não valida quantidade máxima disponível

---

## 🎯 Melhorias MVP (Prioridade)

### PRIORIDADE 1: Validação de Estoque no Frontend ⭐⭐⭐

**Problema:** Ela pode adicionar ao carrinho mais do que tem em estoque.

**Solução:**
1. **Validação ao adicionar ao carrinho**
   - Verificar estoque disponível ANTES de adicionar
   - Bloquear se estoque = 0
   - Validar quantidade máxima disponível

2. **Validação ao atualizar quantidade**
   - Verificar estoque ANTES de atualizar quantidade
   - Não permitir quantidade > estoque disponível
   - Mostrar erro claro: "Estoque insuficiente: só tem X unidades"

3. **Validação no carrinho**
   - Mostrar estoque disponível ao lado de cada item
   - Alerta visual se estoque baixo
   - Desabilitar botão "Vender" se algum item não tem estoque

---

### PRIORIDADE 2: Estoque em Tempo Real ⭐⭐⭐

**Problema:** Estoque não atualiza automaticamente (precisa recarregar página).

**Solução:**
1. **Atualização automática de estoque**
   - Polling a cada 5-10 segundos (SWR)
   - Atualizar estoque quando outra venda acontece
   - WebSocket (depois, se necessário)

2. **Alertas visuais**
   - Produto com estoque baixo (amarelo)
   - Produto sem estoque (vermelho)
   - Produto com estoque OK (verde)

3. **Feedback em tempo real**
   - Quando venda é finalizada, atualizar estoque imediatamente
   - Mostrar mensagem de sucesso com estoque atualizado

---

### PRIORIDADE 3: UX Otimizada para Uso Diário ⭐⭐

**Problema:** PDV precisa ser MAIS RÁPIDO e intuitivo.

**Solução:**
1. **Busca mais rápida**
   - Autocomplete (sugestões ao digitar)
   - Atalhos de teclado (Enter para adicionar)
   - Busca por código (se tiver)

2. **Carrinho mais visual**
   - Cards maiores e mais claros
   - Total destacado
   - Botão "Vender" grande e visível

3. **Feedback visual claro**
   - Toast notifications (sucesso/erro)
   - Loading states (botão desabilitado durante venda)
   - Confirmação visual (produto adicionado)

---

## 🏗️ Implementação Técnica

### Frontend: Melhorias no PDV

#### 1. Validação de Estoque no Carrinho

**Arquivo:** `frontend/app/pdv/page.tsx`

**Mudanças:**
```typescript
// Ao adicionar ao carrinho
const handleAddToCart = (product: Product) => {
  // Validar estoque ANTES de adicionar
  if (product.stock === 0) {
    alert('Produto sem estoque!');
    return;
  }

  const existingItem = cart.find(item => item.id === product.id);
  const quantityToAdd = existingItem ? existingItem.quantity + 1 : 1;

  // Validar se tem estoque suficiente
  if (quantityToAdd > product.stock) {
    alert(`Estoque insuficiente! Só tem ${product.stock} unidades.`);
    return;
  }

  // Adicionar ao carrinho
  // ...
};

// Ao atualizar quantidade
const handleUpdateQuantity = (id: string, quantity: number) => {
  // Buscar produto para validar estoque
  const product = products.find(p => p.id === id);
  
  if (product && quantity > product.stock) {
    alert(`Estoque insuficiente! Só tem ${product.stock} unidades.`);
    // Não atualizar quantidade
    return;
  }

  // Atualizar quantidade
  // ...
};
```

---

#### 2. Estoque em Tempo Real (SWR)

**Arquivo:** `frontend/app/pdv/page.tsx`

**Mudanças:**
```typescript
import useSWR from 'swr';

// Usar SWR para atualizar estoque automaticamente
const { data: products, mutate } = useSWR(
  `/api/v1/products?tenantId=${TENANT_ID}`,
  api.getProducts,
  {
    refreshInterval: 5000, // Atualiza a cada 5 segundos
    revalidateOnFocus: true,
  }
);

// Após finalizar venda
const handleSell = async () => {
  try {
    await api.createOrder(order, TENANT_ID);
    setCart([]);
    
    // Atualizar estoque imediatamente
    await mutate();
    
    // Toast de sucesso
    alert('Venda realizada com sucesso!');
  } catch (error) {
    // Toast de erro
    alert(`Erro: ${error.message}`);
  }
};
```

---

#### 3. Melhorias de UX

**Arquivo:** `frontend/app/pdv/page.tsx`

**Mudanças:**
- **Autocomplete na busca**
  - Sugestões ao digitar
  - Selecionar com Enter ou clique

- **Atalhos de teclado**
  - Enter: adicionar produto ao carrinho
  - Esc: limpar busca
  - Ctrl+Enter: finalizar venda

- **Feedback visual**
  - Toast notifications (usar biblioteca: react-hot-toast)
  - Loading states nos botões
  - Confirmação visual ao adicionar produto

- **Carrinho melhorado**
  - Cards maiores
  - Total destacado
  - Botão "Vender" grande e verde

---

### Backend: Melhorias (Se Necessário)

#### 1. Endpoint de Estoque em Tempo Real

**Arquivo:** `backend/src/modules/products/products.controller.ts`

**Adicionar:**
```typescript
@Get('stock')
async getStock(@Query('tenantId') tenantId: string) {
  // Retornar estoque atualizado
  return this.productsService.getStockSummary(tenantId);
}
```

---

#### 2. Validação Mais Clara

**Arquivo:** `backend/src/modules/orders/orders.service.ts`

**Melhorar mensagens de erro:**
```typescript
// Em vez de só ID, retornar nome do produto
throw new BadRequestException(
  `Estoque insuficiente para "${produto.nome}": necessário ${item.quantity}, disponível ${estoque.current_stock}`
);
```

---

## 📅 Timeline de Implementação

### Semana 1: Validações de Estoque

**Objetivos:**
- [ ] Validação ao adicionar ao carrinho
- [ ] Validação ao atualizar quantidade
- [ ] Validação no carrinho (mostrar estoque disponível)
- [ ] Bloquear botão "Vender" se estoque insuficiente

**Entregáveis:**
- PDV não permite vender mais do que tem
- Erros claros quando estoque insuficiente

---

### Semana 2: Estoque em Tempo Real

**Objetivos:**
- [ ] SWR para atualização automática (5-10s)
- [ ] Atualizar estoque após venda
- [ ] Alertas visuais (cores: verde/amarelo/vermelho)
- [ ] Feedback em tempo real

**Entregáveis:**
- Estoque atualiza automaticamente
- Ela vê mudanças em tempo real

---

### Semana 3: UX Otimizada

**Objetivos:**
- [ ] Autocomplete na busca
- [ ] Atalhos de teclado
- [ ] Toast notifications
- [ ] Loading states
- [ ] Carrinho melhorado visualmente

**Entregáveis:**
- PDV mais rápido e intuitivo
- Ela usa com mais facilidade

---

## ✅ Checklist de Validação

### Validação Técnica:

- [ ] Não permite adicionar ao carrinho se estoque = 0
- [ ] Não permite quantidade > estoque disponível
- [ ] Mostra erro claro quando estoque insuficiente
- [ ] Estoque atualiza automaticamente (5-10s)
- [ ] Estoque atualiza após venda imediatamente

### Validação de Uso:

- [ ] Ela consegue fazer venda rápido (< 2 min)
- [ ] Ela vê estoque atualizado em tempo real
- [ ] Ela não consegue vender mais do que tem
- [ ] Erros são claros e fáceis de entender

### Validação de Satisfação:

- [ ] Ela gosta ("Funciona bem!")
- [ ] Ela usa TODO dia
- [ ] Ela confia no sistema (não verifica manualmente)

---

## 💡 Próximos Passos

### Esta Semana:

1. **Implementar validações de estoque** (Prioridade 1)
   - Validação ao adicionar ao carrinho
   - Validação ao atualizar quantidade
   - Erros claros

2. **Testar com ela**
   - Ela usa o PDV
   - Feedback real
   - Correções rápidas

### Próxima Semana:

3. **Implementar estoque em tempo real** (Prioridade 2)
   - SWR com polling
   - Atualização automática
   - Alertas visuais

4. **Melhorar UX** (Prioridade 3)
   - Autocomplete
   - Toast notifications
   - Atalhos de teclado

---

**Última atualização:** Janeiro 2025  
**Status:** ✅ Plano de Melhorias PDV Completo
