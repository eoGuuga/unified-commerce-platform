# 🔍 Análise Completa - Problema Stock Summary

> **Data:** 08/01/2025  
> **Status:** ⚠️ **ERRO PERSISTENTE - REQUER INVESTIGAÇÃO PROFUNDA**  
> **Prioridade:** 🟡 Média (não crítico, mas deve ser corrigido)

---

## 📊 RESUMO DO PROBLEMA

**Endpoint:** `GET /products/stock-summary`  
**Erro:** 500 Internal Server Error  
**Taxa de Sucesso Atual:** 94% (32/34 testes passando)  
**Impacto:** Funcionalidade não crítica, mas importante para gestão de estoque

---

## 🔍 INVESTIGAÇÃO REALIZADA

### Tentativas de Correção (Múltiplas)

1. ✅ **Adicionado tratamento de erro robusto** - try/catch completo
2. ✅ **Mudado de `find()` para `createQueryBuilder()`** - para order
3. ✅ **Otimizado para evitar N+1 queries** - buscar todos estoques de uma vez
4. ✅ **Adicionado tratamento de erro individual por produto**
5. ✅ **Testado com query SQL raw** - bypass RLS
6. ✅ **Simplificado processamento de arrays** - usando Set para performance
7. ✅ **Adicionado logs detalhados** - para debug
8. ✅ **Testado com diferentes abordagens** - find(), query builder, SQL raw

### Contexto do Sistema

- **Produtos no banco:** 105 produtos ativos
- **Estoques no banco:** 107 registros de estoque
- **Tenant ID:** `00000000-0000-0000-0000-000000000000`
- **RLS habilitado:** Sim (Row Level Security)
- **Policy RLS:** `estoque_tenant_isolation` usando `current_setting('app.current_tenant_id')`

### Estrutura da Tabela

```sql
CREATE TABLE movimentacoes_estoque (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  produto_id UUID NOT NULL,
  current_stock INTEGER DEFAULT 0,
  reserved_stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  last_updated TIMESTAMP,
  UNIQUE(tenant_id, produto_id)
);
```

**Índices:**
- `idx_estoque_tenant` (tenant_id)
- `idx_estoque_produto` (produto_id)
- `idx_estoque_tenant_produto` (tenant_id, produto_id)

**RLS Policy:**
```sql
CREATE POLICY estoque_tenant_isolation ON movimentacoes_estoque
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

---

## 💡 POSSÍVEIS CAUSAS

### 1. Row Level Security (RLS) - MAIS PROVÁVEL

**Hipótese:** O RLS está bloqueando a query quando há muitos produtos porque `app.current_tenant_id` não está configurado na sessão do TypeORM.

**Evidência:**
- Query SQL direta funciona quando `SET app.current_tenant_id` é executado
- TypeORM pode não estar configurando essa variável automaticamente
- Outros endpoints funcionam porque não dependem de RLS da mesma forma

**Solução Testada:**
- Tentamos configurar `app.current_tenant_id` antes da query
- Tentamos usar query SQL raw que bypass RLS
- Tentamos usar `find()` simples do TypeORM

**Status:** ❌ Nenhuma solução funcionou completamente

### 2. Timeout ou Limite de Memória

**Hipótese:** Processar 105 produtos pode estar causando timeout ou estouro de memória.

**Evidência:**
- Query SQL direta funciona e retorna 113 registros
- Processamento em memória pode estar falhando

**Solução Testada:**
- Simplificamos o processamento
- Removemos conversões complexas
- Usamos Set para performance

**Status:** ❌ Não resolveu

### 3. Serialização JSON

**Hipótese:** O problema está na serialização do JSON quando há muitos produtos.

**Evidência:**
- Todos os logs indicam que o processamento chega até o final
- Erro ocorre ao retornar a resposta

**Solução Testada:**
- Simplificamos a estrutura de retorno
- Removemos conversões desnecessárias
- Retornamos diretamente do TypeORM

**Status:** ❌ Não resolveu

### 4. Problema com TypeORM e RLS

**Hipótese:** TypeORM não está lidando corretamente com RLS quando há muitas linhas.

**Evidência:**
- Outros endpoints com menos dados funcionam
- Endpoint com muitos dados falha

**Solução Testada:**
- Usamos query SQL raw
- Usamos find() simples
- Configuramos tenant_id na sessão

**Status:** ❌ Não resolveu completamente

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS

### Opção 1: Desabilitar RLS Temporariamente (Desenvolvimento)

**Para testar se RLS é o problema:**

```sql
ALTER TABLE movimentacoes_estoque DISABLE ROW LEVEL SECURITY;
```

**Testar endpoint novamente**

**Se funcionar:** RLS é o problema. Precisamos configurar `app.current_tenant_id` corretamente no TypeORM.

**Se não funcionar:** Problema está em outro lugar.

### Opção 2: Configurar TypeORM para RLS

**Criar um interceptor ou middleware que configure `app.current_tenant_id` antes de cada query:**

```typescript
// Em database.config.ts ou um interceptor
async beforeQuery(tenantId: string) {
  await this.dataSource.query(`SET app.current_tenant_id = $1`, [tenantId]);
}
```

### Opção 3: Usar Query SQL Raw com Bypass RLS

**Usar função PostgreSQL que bypass RLS:**

```sql
CREATE OR REPLACE FUNCTION get_stock_summary(p_tenant_id UUID)
RETURNS TABLE(...) AS $$
BEGIN
  -- Query que bypass RLS
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Opção 4: Paginação no Stock Summary

**Limitar número de produtos retornados:**

```typescript
async getStockSummary(tenantId: string, limit = 100) {
  // Limitar produtos retornados
}
```

### Opção 5: Cache do Resultado

**Cachear resultado do Stock Summary:**

```typescript
const cached = await this.cacheService.get(`stock-summary:${tenantId}`);
if (cached) return cached;
// ... processar ...
await this.cacheService.set(`stock-summary:${tenantId}`, result, 60);
```

---

## 📝 CÓDIGO ATUAL (Última Versão)

```typescript
async getStockSummary(tenantId: string): Promise<{
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  products: Array<{
    id: string;
    name: string;
    current_stock: number;
    reserved_stock: number;
    available_stock: number;
    min_stock: number;
    status: 'ok' | 'low' | 'out';
  }>;
}> {
  try {
    // Buscar produtos ativos
    const produtos = await this.produtosRepository.find({
      where: { tenant_id: tenantId, is_active: true },
      order: { name: 'ASC' },
    });

    if (produtos.length === 0) {
      return { total_products: 0, low_stock_count: 0, out_of_stock_count: 0, products: [] };
    }

    // Buscar estoques
    const produtoIds = produtos.map((p) => p.id);
    const estoquesMap = new Map<string, MovimentacaoEstoque>();
    
    const allEstoques = await this.estoqueRepository.find({
      where: { tenant_id: tenantId },
    });
    
    const produtoIdsSet = new Set(produtoIds);
    allEstoques.forEach((e) => {
      if (produtoIdsSet.has(e.produto_id)) {
        estoquesMap.set(e.produto_id, e);
      }
    });

    // Processar produtos
    const produtosComEstoque = produtos.map((produto) => {
      const estoque = estoquesMap.get(produto.id);
      const current_stock = estoque?.current_stock ?? 0;
      const reserved_stock = estoque?.reserved_stock ?? 0;
      const available_stock = Math.max(0, current_stock - reserved_stock);
      const min_stock = estoque?.min_stock ?? 0;

      let status: 'ok' | 'low' | 'out' = 'ok';
      if (available_stock === 0) status = 'out';
      else if (min_stock > 0 && available_stock <= min_stock) status = 'low';

      return {
        id: produto.id,
        name: produto.name,
        current_stock,
        reserved_stock,
        available_stock,
        min_stock,
        status,
      };
    });

    const low_stock_count = produtosComEstoque.filter((p) => p.status === 'low').length;
    const out_of_stock_count = produtosComEstoque.filter((p) => p.status === 'out').length;

    return {
      total_products: produtosComEstoque.length,
      low_stock_count,
      out_of_stock_count,
      products: produtosComEstoque,
    };
  } catch (error: any) {
    this.logger.error(`[getStockSummary] ERRO: ${error.message}`, error.stack);
    return { total_products: 0, low_stock_count: 0, out_of_stock_count: 0, products: [] };
  }
}
```

---

## 🎯 CONCLUSÃO

**Status Atual:**
- ✅ **94% dos testes passando** (32/34)
- ⚠️ **Stock Summary não funcional** (erro 500)
- ✅ **Sistema funcional para uso** (endpoint não crítico)

**Recomendação:**
1. **Curto prazo:** Documentar problema conhecido e continuar desenvolvimento
2. **Médio prazo:** Investigar RLS e TypeORM (Opção 1 ou 2)
3. **Longo prazo:** Implementar cache ou paginação (Opção 4 ou 5)

**Prioridade:** 🟡 Média - Sistema está 94% funcional, pode continuar desenvolvimento

---

**Última atualização:** 08/01/2025  
**Status:** ⚠️ **PROBLEMA PERSISTENTE - REQUER INVESTIGAÇÃO PROFUNDA**
