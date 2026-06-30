# Spec — PDV Tela de Caixa (frontend do balcão)

**Data:** 2026-06-30
**Status:** Rascunho — aguardando aprovação do dono (antes de plano/código)
**Escopo:** Frontend (Next.js 16 + React 19 + Tailwind 4). **Zero mudança de backend** — o fast-pass do PDV já está pronto, mergeado e testado.
**Depende de:** `2026-06-28-pdv-fast-pass-design.md` (backend, na main) · `frontend/components/pdv/PdvPaymentModal.tsx` (modal existente, será reusado/adaptado) · motor de estoque (na main).
**Fecha:** o buraco operacional nº 1 do diagnóstico — "a mãe não tem por onde vender no balcão".

---

## 1. Visão geral e objetivo

O backend do PDV está completo: `POST /orders` com `channel='pdv'` cria o pedido **ENTREGUE**, **baixa o estoque** e registra o **pagamento PAGO**, tudo numa transação atômica. Falta a **tela de operação** que a mãe usa no balcão: achar o produto → montar o carrinho → cobrar → fechar a venda → próxima.

**Régua de sucesso:** uma venda típica (1–3 doces) fecha em **segundos**, com mouse e teclado, sem distração. A tela é dedicada (modo caixa), não uma aba do admin.

**Premissa herdada do fast-pass:** quando a tela chama o backend, a liquidação física **já aconteceu** (dinheiro na mão / maquininha aprovou / PIX visto no balcão). O backend é o *settlement* — a tela não inicia cobrança externa.

---

## 2. Decisões de produto (TRAVADAS — invariantes do desenho)

1. **[INVARIANTE] Aparelho:** computador (mouse/teclado). Atalhos de teclado, sem botões touch gigantes.
2. **[INVARIANTE] Tela cheia "modo caixa":** sem a navegação do `AdminShell`. Tela dedicada, com **saída clara de volta ao admin**. NÃO é aba do admin.
3. **[INVARIANTE] Busca:** por **nome** (digitar) + **grade visual dos mais vendidos** pra clicar direto. **Sem código de barras.**
4. **[INVARIANTE] Tudo por unidade, avulso:** quantidade sempre **inteira ≥ 1**. **Sem peso/granel/fracionado.**
5. **[INVARIANTE] Carrinho:** rápido pra venda curta, robusto pra encomenda grande ocasional. +/− quantidade, remover item, **total ao vivo**.
6. **[INVARIANTE] Pagamento = 4 métodos:** dinheiro, PIX, débito, crédito. (boleto fora — o backend rejeita.)
7. **[INVARIANTE] PIX = fast-pass (marcar pago):** operadora seleciona PIX, cliente paga no QR fixo da loja / maquininha, ela confirma "pago", a venda fecha na hora. **NÃO gerar QR dinâmico nem esperar webhook.** Trade-off consciente: confia que a operadora viu o pagamento (presencial, prioriza velocidade).
8. **[INVARIANTE] Cliente anônimo por padrão** ("Cliente Balcão"), nome **opcional** — não trava a venda.

---

## 3. Arquitetura da tela

### 3.1 Rota e casca
- **Nova rota dedicada:** `frontend/app/pdv/caixa/page.tsx` — tela cheia, autenticada, **fora do `AdminShell`**.
- A landing atual `app/pdv/page.tsx` (marketing) **permanece**; seu botão "Abrir PDV" passa a apontar pra `/pdv/caixa`.
- **Auth-gate próprio:** reusa o mesmo mecanismo de autenticação do admin (token/checagem do `AdminDataProvider`/hook de auth existente), mas renderiza um layout full-screen próprio (não o shell). Sem sessão → redireciona a `/login`.
- **Saída:** link/botão no topo "Sair do caixa → Admin" (volta a `/admin`).

### 3.2 Layout (2 painéis, desktop)
```
┌──────────────────────────────────────────────────────────────┐
│  CAIXA — Loja            [Cliente: Balcão ▾]   [Sair → Admin]  │  ← topbar
├───────────────────────────────┬──────────────────────────────┤
│  🔎 [buscar produto...]        │  CARRINHO                     │
│                                │  ┌──────────────────────────┐ │
│  Mais vendidos (grade visual)  │  │ Brigadeiro   − 2 +   R$… │ │
│  [card][card][card][card]      │  │ Beijinho     − 1 +   R$… │ │
│  [card][card][card][card]      │  └──────────────────────────┘ │
│                                │  ...                          │
│  resultados da busca           │  ──────────────────────────   │
│  [card][card]...               │  TOTAL ao vivo:   R$ 12,50    │
│                                │  [ Limpar ]   [ PAGAR (F2) ]  │
└───────────────────────────────┴──────────────────────────────┘
```
- **Esquerda:** campo de busca (foco automático ao abrir) + grade de mais vendidos (clique = adiciona) + resultados da busca ao digitar.
- **Direita:** carrinho (itens com −/+ e remover), total ao vivo, botões "Limpar" e "PAGAR".
- Encomenda grande: a lista do carrinho rola; o total e o botão Pagar ficam fixos (sticky) no rodapé do painel.

### 3.3 Atalhos de teclado (velocidade)
- Abrir a tela → cursor já na **busca**.
- **Enter** na busca → adiciona o 1º resultado ao carrinho e limpa a busca (pronto pra o próximo).
- **F2** (ou Enter com a busca vazia) → abre o pagamento.
- **Esc** → no pagamento, fecha o modal; na tela, limpa a venda (com confirmação se houver itens).
- (`+`/`−` ajustam a quantidade do último item; nice-to-have, não bloqueante.)

---

## 4. Fluxo de uma venda (passo a passo)

1. **Tela vazia:** carrinho vazio, cursor na busca, grade de mais vendidos visível. Botão PAGAR **desabilitado**.
2. **Achar produto:** digita o nome (filtra ao vivo) **ou** clica um card da grade.
3. **Adicionar:** clique no produto/resultado → entra no carrinho com **qty 1**; clicar de novo (ou `+`) incrementa.
4. **Ajustar:** −/+ na quantidade (mínimo 1; no 0 some o item), botão remover. **Total recalcula ao vivo** (Σ `preço × qty`).
5. **Cobrar:** clica **PAGAR** (só habilita com carrinho não-vazio) → abre o `PdvPaymentModal`.
6. **Escolher método** no modal:
   - **Dinheiro:** campo "valor recebido" → **troco** = recebido − total (cálculo de tela).
   - **PIX:** texto "Cliente paga no QR/maquininha. Confirme quando vir o pagamento." (fast-pass, sem QR na tela).
   - **Débito/Crédito:** texto "Passe na maquininha. Confirme quando aprovar."
7. **Finalizar:** botão único "**Confirmar pagamento e finalizar**" → a tela monta o payload e chama `POST /orders` (ver §6). Backend cria pedido ENTREGUE + baixa estoque + pagamento PAGO.
8. **Recibo:** o modal mostra a `CompletedSaleView` (nº do pedido, total, método, troco se dinheiro) + "Copiar comprovante".
9. **Nova venda:** botão "Nova venda" → limpa carrinho, fecha o modal, volta à tela vazia com o cursor na busca. Ciclo recomeça.

---

## 5. Componentes — criar vs. reusar

### 5.1 REUSAR: `PdvPaymentModal.tsx` (com 2 adaptações)
O modal já é **100% apresentacional** e já cobre: seleção de método, **valor recebido + troco** (`cashReceived`/`cashChange`), cupom, e a **tela de venda concluída** (`CompletedSaleView` com copiar comprovante / nova venda). **Reaproveitamos.**

**Adaptação A — adicionar Débito e Crédito.** Hoje o `PaymentFormView` só renderiza botões de **PIX** e **Dinheiro** (linhas ~310-331). Adicionar os botões **Débito** e **Crédito** (o tipo `PaymentMethod` já os inclui; o backend já aceita). Boleto fica fora.

**Adaptação B — modo fast-pass (1 passo, sem QR).** O modal foi desenhado pra um fluxo de **2 passos com QR** (cria pedido → `paymentData`/QR → `onConfirmPayment`); o cupom inclusive desabilita após `orderData.id` ("vamos regenerar o pagamento"). **No fast-pass não há QR nem 2º passo:** uma única ação cria o pedido **já PAGO**. Então:
   - Esconder o bloco de `paymentData`/QR e o 2º botão quando em modo PDV.
   - Um **único** botão "Confirmar pagamento e finalizar" dispara `onCreateOrderAndPayment`; no sucesso, o pai seta `completedSale` → o modal já renderia a `CompletedSaleView`.
   - `onConfirmPayment` fica **sem uso** no fluxo PDV (não removemos do componente pra não quebrar o teste existente; apenas não é acionado).
   *(Decisão: adaptar o modal existente, não reescrever — preserva os 11 testes e o visual já pronto.)*

**Callbacks que o PAI (a tela de caixa) precisa implementar:**

| Callback | O que faz no fast-pass |
|---|---|
| `onCreateOrderAndPayment` | **A ação principal.** Monta o payload (§6) e chama `apiClient.createOrder(...)` com `channel:'pdv'` + `payment:{method}` + itens. No **sucesso**, guarda o pedido retornado e seta `completedSale` (nº, total, método, troco). No **erro**, seta `paymentError` (tratamento por tipo — §7). Envia **Idempotency-Key** (§7, caso 5). |
| `onConfirmPayment` | Não usado no PDV (era o 2º passo do fluxo QR). Fica no-op. |
| `onPaymentMethodChange` | Atualiza o método selecionado no estado da venda. |
| `onCashReceivedChange` | Atualiza o valor recebido (dinheiro); o pai recalcula `cashChange = recebido − total`. |
| `onCouponCodeChange` | Atualiza o cupom. **Ver §9 (fora de escopo): cupom no PDV é opcional v1** — campo pode ficar oculto no MVP, decisão de produto pendente (pergunta aberta). |
| `onCopyReceipt` | Copia o resumo da venda (texto) pra área de transferência. |
| `onNewSale` | Limpa o carrinho + estado de pagamento, fecha o modal, devolve foco à busca. |
| `onClose` | Fecha o modal **sem** finalizar (volta ao carrinho intacto). |

### 5.2 CRIAR: a tela e suas partes
- **`app/pdv/caixa/page.tsx`** — a página em modo caixa (auth-gate + layout full-screen + orquestra os componentes).
- **`components/pdv/PdvProductSearch.tsx`** — campo de busca por nome + grade de mais vendidos + resultados; cada item clicável adiciona ao carrinho; mostra preço e selo de estoque (esgotado → desabilitado, §7 caso 4).
- **`components/pdv/PdvCart.tsx`** — lista do carrinho, −/+ quantidade, remover, total ao vivo, botões Limpar/Pagar.
- **`hooks/usePdvSale.ts`** (ou módulo equivalente) — **a lógica testável**: estado do carrinho (add/inc/dec/remove), cálculo de total, montagem do payload, chamada ao backend, e os estados de pagamento/erro. Manter a lógica **fora do JSX** (como o Admin fez com `stock-status.ts`) pra testar puro.

### 5.3 Busca: reusar `ProductCatalog` do admin ou componente próprio?
**Recomendação: componente próprio (`PdvProductSearch`), reusando a CAMADA DE DADOS, não a UI.** O `ProductCatalog`/`ProductsManager` do admin é orientado a **gestão** (editar, ativar/inativar, SKU) — fluxo e affordances errados pro balcão. O caixa precisa de **filtrar-e-clicar-pra-adicionar** + grade de favoritos + indicador de estoque, otimizado pra velocidade. **Reusar:** o hook/método de dados de produtos já existente (`useProducts` / `apiClient.getProducts`) e os tokens visuais. **Não** reusar o componente de gestão inteiro. *(Confirmar a forma exata do `ProductCatalog` ao escrever o plano — decisão de baixo risco.)*
> "Mais vendidos": v1 pode ser uma heurística simples (ex.: primeiros N ativos, ou marcados como favoritos). Métrica real de "mais vendidos" depende de relatório de vendas → **fora de escopo** (§9); usar um proxy simples agora.

---

## 6. Contrato com o backend

A tela monta e envia, via `apiClient.createOrder(...)` → `POST /orders` (autenticado, JWT):

```jsonc
{
  "channel": "pdv",
  "payment": { "method": "dinheiro" | "pix" | "debito" | "credito" },
  "items": [
    { "produto_id": "<uuid>", "quantity": <inteiro ≥ 1>, "unit_price": <preço VIGENTE do produto> }
  ],
  "customer_name": "Cliente Balcão"   // ou nome digitado; opcional
}
```

**Regras críticas:**
- **`unit_price` TEM que ser o preço vigente do produto.** O backend revalida e **rejeita divergência > 0.01** ("preço divergente"). A tela carrega o preço junto com o produto e envia esse valor (§7 caso 2 trata mudança de preço).
- `payment.method` **obrigatório** pro PDV; **boleto não é aceito**.
- **Não** enviar `amount` de pagamento — o backend recalcula o total no servidor (anti-adulteração). **Valor recebido/troco é só cálculo de tela**, não vai pro backend.
- `delivery_type`/endereço **não** são enviados (o backend trata o PDV como balcão).
- **Resposta:** o pedido (ENTREGUE) + o pagamento (PAGO). A tela usa `order_no`/`total`/`method` no recibo.

**Mudança de tipo no frontend (única alteração de tipo necessária):**
```ts
// frontend/lib/types/order.ts — adicionar ao CreateOrderInput:
payment?: { method: 'dinheiro' | 'pix' | 'debito' | 'credito' };
```
*(Hoje só passaria pelo index signature `[key: string]: unknown`, sem type-safety. `SalesChannel` já inclui `'pdv'`; `CreateOrderItemInput.unit_price` é opcional no tipo mas o backend exige — a tela sempre envia.)*

---

## 7. Casos de borda (operação real)

| # | Caso | Comportamento da tela |
|---|---|---|
| 1 | **Estoque insuficiente no meio da venda** (produto esgotou entre adicionar e cobrar). O PDV **não reserva** ao adicionar no carrinho (a reserva+baixa acontece atômica só no `POST /orders`); outro canal pode levar o último item. | O `POST /orders` volta **422 `INSUFFICIENT_STOCK`** (código tipado, preservado pelo `HttpExceptionFilter`). A tela **mantém o carrinho intacto**, mostra mensagem clara no modal ("Estoque insuficiente — ajuste a quantidade ou remova o item") nomeando o produto se a resposta trouxer, e deixa a operadora corrigir e tentar de novo. **Mitigação proativa:** mostrar o estoque de cada produto na busca/carrinho. |
| 2 | **Preço divergente** (o dono editou o preço entre carregar e vender). | O backend rejeita ("preço divergente"). A tela detecta esse erro, **re-busca o preço atual** dos itens, atualiza o total, avisa "O preço de X mudou para R$ Y — confirme" e deixa refazer. Não cobra com preço errado. |
| 3 | **Cancelar venda começada.** | Botão "Limpar" / `Esc`. Se o carrinho **tem itens**, pede **confirmação** ("Descartar esta venda?"); vazio, não pergunta. |
| 4 | **Produto sem estoque na busca.** | **Aparece** (a operadora vê que existe) com selo "Esgotado" e o **add desabilitado** — não dá pra adicionar 0 estoque (não-overselling preventivo; o caso 1 é a rede final). |
| 5 | **Erro de rede ao fechar a venda (não cobrar duas vezes).** | **Duas camadas:** (a) o botão "Confirmar" **desabilita** enquanto `paymentLoading` (anti duplo-clique); (b) a tela gera uma **`Idempotency-Key`** (UUID) por tentativa de venda e a envia no `POST /orders` — assim um *retry* após timeout **reusa a mesma chave** e o backend devolve o pedido já criado em vez de duplicar. ⚠️ **Dependência a verificar no plano:** confirmar que `POST /orders` honra `Idempotency-Key` (o `/orders/public/checkout` honra; se o endpoint autenticado ainda não, é o **único** retoque de backend que esta frente exigiria — sinalizado aqui pra decisão). Sem idempotência, a tela cai pro fallback: em erro de rede, **não** auto-refaz — avisa "Não confirmamos o registro; verifique em Pedidos antes de refazer". |
| 6 | **Carrinho vazio.** | Botão PAGAR **desabilitado**. |
| 7 | **Sessão expirada** (401 ao fechar). | Mensagem + manter o carrinho; redirecionar pro login preservando a intenção, se viável (senão, instruir a relogar — o carrinho é estado local, pode se perder; aceitável v1). |

---

## 8. Consistência visual
- **Tailwind 4 + `lucide-react`**, seguindo o visual do Admin e do próprio `PdvPaymentModal` (cards arredondados `rounded-[24px]`, `slate-*`, acentos `cyan/emerald`). **Sem introduzir design system novo** (o app não usa um `components/ui` central — é Tailwind direto).
- Tipografia/escala de botão pensada pra **mouse/teclado** (não touch).

---

## 9. Fora de escopo (pra não inflar)
- **Geração de QR PIX dinâmico / espera de webhook** — é o caminho do bot; o PDV é fast-pass por decisão (inv. 7).
- **Peso / granel / quantidade fracionada** — a loja não usa (inv. 4).
- **Código de barras / leitor** — não usado (inv. 3).
- **Relatórios de venda, "mais vendidos" por métrica real, fechamento de caixa** — é do admin/relatórios; o PDV usa um proxy simples pros favoritos.
- **Gestão de produto (criar/editar/estoque)** — é o Admin.
- **Cupom no PDV** — **decisão de produto pendente** (ver pergunta aberta §11); MVP pode ocultar o campo.
- **Multi-operador / quem-vendeu (seller_id), RBAC** — v2 (dona única).
- **Impressão fiscal / NF** — fora de escopo.

---

## 10. Testes (pra a tela ser confiável)
Foco na **lógica** (puro/hook), não em pixels:
- **Carrinho** (`usePdvSale`/reducer): add cria item qty 1; add repetido incrementa; −/+ respeita mínimo 1; remover; total = Σ(preço×qty) com 2 casas; limpar zera.
- **Montagem do payload:** gera `{channel:'pdv', payment:{method}, items:[{produto_id, quantity, unit_price}], customer_name}` correto; `unit_price` = preço carregado; nome default "Cliente Balcão" quando vazio.
- **Troco:** `cashChange = recebido − total`; negativo (recebido < total) bloqueia finalizar em dinheiro.
- **Casos de borda:** 422 INSUFFICIENT_STOCK mantém carrinho + mostra erro; preço divergente dispara re-sync; carrinho vazio desabilita pagar; produto esgotado não adiciona; duplo-clique/`paymentLoading` não dispara 2 POSTs; Idempotency-Key estável por tentativa.
- **Modal adaptado:** os botões Débito/Crédito aparecem e selecionam; modo fast-pass não mostra QR e usa o botão único; os 11 testes existentes do modal seguem verdes.
- **Build/typecheck** limpo (lembrar da dívida Turbopack → usar `--webpack`).

---

## 11. Perguntas abertas (pra fechar antes do plano)
1. **Cupom no PDV:** mantém o campo de cupom (o modal já tem) ou oculta no MVP? *(Recomendo ocultar v1 — doceria de balcão raramente dá cupom no caixa; reabrir se a mãe pedir.)*
2. **Idempotency-Key em `POST /orders`:** verificar se o endpoint autenticado já honra (caso 5). Se não, aceitar o pequeno retoque de backend ou ir de fallback? *(Recomendo confirmar e, se faltar, fazer o retoque — é a proteção contra cobrança dupla.)*
3. **"Mais vendidos":** proxy simples (N ativos / favoritos manuais) está ok pro v1? *(Recomendo sim.)*

---

> **Próximo passo:** revisão e **aprovação do dono** deste spec. Só depois: plano de implementação (writing-plans) → código. Nenhuma linha de código antes do "aprovado".
