# PDV Tela de Caixa — Plano de Implementação

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA — usar `superpowers:subagent-driven-development` (recomendado) ou `executing-plans` pra implementar task-a-task. Passos usam checkbox (`- [ ]`).

**Goal:** Construir a tela de operação do caixa (`/pdv/caixa`) que monta a venda (busca → carrinho → pagamento) e fecha pelo fast-pass do PDV já pronto, com feedback de "venda concluída" inequívoco.

**Architecture:** Frontend puro (Next.js App Router). Uma rota full-screen autenticada fora do `AdminShell`. Lógica de venda isolada num hook testável (`usePdvSale`) + módulos puros; UI em 3 componentes (`PdvProductSearch`, `PdvCart`, `PdvPaymentModal` adaptado). Reusa a camada de dados de produtos e o `apiClient.createOrder`. **Zero mudança de backend** (o `POST /orders` já faz fast-pass atômico e já honra `Idempotency-Key` — confirmado no controller, linha 85).

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Tailwind 4 + lucide-react. Testes: vitest + @testing-library/react.

**Base/Branch:** criar `feat/pdv-tela-caixa` a partir de `main` (atual, publicada).

## Global Constraints (valem pra TODAS as tasks — valores exatos do spec aprovado)
- **Spec:** `docs/superpowers/specs/2026-06-30-pdv-tela-caixa-design.md`.
- **Zero backend:** nenhuma mudança em `backend/`. Se alguma task parecer exigir, **PARAR e escalar**.
- **Contrato `POST /orders` (PDV):** `{ channel:'pdv', payment:{ method }, items:[{ produto_id, quantity, unit_price }], customer_name? }`. `method ∈ {dinheiro,pix,debito,credito}` (boleto proibido). `quantity` inteiro ≥ 1. **`unit_price` = preço VIGENTE do produto** (backend rejeita divergência > 0,01). **Não** enviar `amount` (servidor recalcula). Não enviar `delivery_type`/endereço.
- **Anti-cobrança-dupla:** cada tentativa de venda gera **uma** `Idempotency-Key` (UUID) estável; reenvio após erro de rede reusa a mesma. Botão de finalizar desabilita enquanto em voo.
- **Fast-pass:** PIX/débito/crédito = "marcar pago" (sem QR dinâmico, sem webhook). Dinheiro = valor recebido + troco (cálculo de tela).
- **Cliente:** anônimo default `"Cliente Balcão"`; nome opcional não trava.
- **Tudo por unidade**, quantidade inteira ≥ 1. Sem peso/granel/código de barras.
- **Cupom:** **oculto no v1** (render condicional `showCoupon={false}` — NÃO apagar do modal).
- **Visual:** Tailwind 4 + lucide, seguindo Admin/modal existente. Sem design system novo.
- **Build:** `next build --webpack` (dívida Turbopack conhecida). Testes via `npm test` (vitest).
- **Não quebrar:** os 11 testes existentes de `PdvPaymentModal.test.tsx` seguem verdes.

---

## Task 1 — Contrato tipado + api-client com Idempotency-Key

**Files:**
- Modify: `frontend/lib/types/order.ts` (add `payment` ao `CreateOrderInput`)
- Modify: `frontend/lib/api-client.ts` (`createOrder` encaminha `idempotency-key`)
- Test: `frontend/lib/api-client.pdv.test.ts` (novo)

**Interfaces (produz, usado pelas tasks seguintes):**
```ts
// order.ts
export type PdvPaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito';
export interface CreateOrderInput {
  /* ...campos atuais... */
  payment?: { method: PdvPaymentMethod };
}
// api-client.ts
createOrder(input: CreateOrderInput, opts?: { idempotencyKey?: string }): Promise<Order>
```

- [ ] **Step 1:** teste falhando — `createOrder` envia body com `channel/payment/items` e header `idempotency-key` quando `opts.idempotencyKey` é dado (mock do fetch/request). Asserções: método POST em `/orders`, header presente, body com `payment.method`.
- [ ] **Step 2:** rodar → FAIL (param não existe).
- [ ] **Step 3:** add `PdvPaymentMethod` + `payment?` ao `CreateOrderInput`; em `createOrder`, aceitar `opts?.idempotencyKey` e setar header `'Idempotency-Key'` quando presente (mesmo padrão do checkout público).
- [ ] **Step 4:** rodar → PASS. `tsc`/typecheck limpo.
- [ ] **Step 5:** commit — `feat(pdv): type PDV payment on CreateOrderInput + forward Idempotency-Key in createOrder`.

**Review:** contrato bate com o backend (channel/payment/items/unit_price); header idempotência encaminhado.

---

## Task 2 — `usePdvSale`: lógica de carrinho + payload + submissão (o coração testável)

**Files:**
- Create: `frontend/lib/pdv/cart.ts` (reducer/funções puras), `frontend/lib/pdv/build-order.ts` (payload), `frontend/hooks/usePdvSale.ts`
- Test: `frontend/lib/pdv/cart.test.ts`, `frontend/lib/pdv/build-order.test.ts`, `frontend/hooks/usePdvSale.test.ts`

**Interfaces (produz):**
```ts
// cart.ts — puro
export interface PdvCartItem { produto_id: string; name: string; unit_price: number; quantity: number; stock: number; }
export type CartAction = {type:'add';product:{id;name;price;stock}} | {type:'inc';id} | {type:'dec';id} | {type:'remove';id} | {type:'clear'};
export function cartReducer(items: PdvCartItem[], a: CartAction): PdvCartItem[];
export function cartTotal(items: PdvCartItem[]): number;       // Σ unit_price*qty, 2 casas
export function calcChange(total: number, received: number): number; // received-total
// build-order.ts — puro
export function buildPdvOrderPayload(items: PdvCartItem[], method: PdvPaymentMethod, customerName?: string): CreateOrderInput;
// usePdvSale.ts
export function usePdvSale(): {
  items; total; addProduct; inc; dec; remove; clear;
  method; setMethod; cashReceived; setCashReceived; change;
  paymentLoading; paymentError; completedSale;
  beginPayment; submitSale; newSale; // submitSale gera idempotencyKey 1x e chama createOrder
}
```

- [ ] **Step 1:** testes falhando — `cart.test.ts`: add cria qty 1; add repetido incrementa; `inc`/`dec` (dec em qty 1 remove ou trava no 1 — **decisão: trava no mínimo 1, remover é explícito**); `remove`; `clear`; `cartTotal` soma com 2 casas; `calcChange`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar `cart.ts` puro.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5:** testes falhando — `build-order.test.ts`: payload tem `channel:'pdv'`, `payment.method`, itens com `unit_price` = preço do item, `quantity` inteiro; `customer_name` = `"Cliente Balcão"` quando vazio; nome dado é preservado.
- [ ] **Step 6→7:** implementar `build-order.ts` → PASS.
- [ ] **Step 8:** testes falhando — `usePdvSale.test.ts` (com `createOrder` mockado): `submitSale` em sucesso seta `completedSale` (order_no/total/method/change) e **não** dispara 2 POSTs em duplo-clique (guard `paymentLoading`); a **mesma `Idempotency-Key`** é usada se `submitSale` for chamado de novo após erro (key estável por tentativa, regenerada só em `newSale`); erro **422 INSUFFICIENT_STOCK** → `paymentError` setado e **itens preservados**; erro de **preço divergente** → flag/intenção de re-sync (mensagem específica); `newSale` limpa tudo e regenera a key.
- [ ] **Step 9→10:** implementar `usePdvSale.ts` → PASS.
- [ ] **Step 11:** commit — `feat(pdv): testable sale logic (cart reducer, order payload, usePdvSale hook with idempotent submit)`.

**Review:** cobertura dos casos de borda na lógica; key idempotente estável; 422 preserva carrinho; payload exato.

---

## Task 3 — `PdvProductSearch`: busca por nome + grade de favoritos + estoque

**Files:**
- Create: `frontend/lib/pdv/favorites.ts` (favoritos via localStorage, puro+wrapper), `frontend/components/pdv/PdvProductSearch.tsx`
- Test: `frontend/lib/pdv/favorites.test.ts`, `frontend/components/pdv/PdvProductSearch.test.tsx`
- Reuse: hook/método de dados de produtos existente (`useProducts` / `apiClient.getProducts`)

**Interfaces:**
```ts
// favorites.ts
export function listFavorites(): string[];           // ids
export function toggleFavorite(id: string): string[]; // persiste em localStorage 'pdv:favorites'
export function orderByFavorites<T extends {id:string}>(products: T[], favIds: string[]): T[]; // favoritos primeiro (puro)
// PdvProductSearch props
{ onAdd: (product:{id;name;price;stock}) => void }
```
Comportamento: campo de busca (filtra por nome ao vivo), grade de favoritos no topo (estrela toggla), demais ativos abaixo; cada card mostra nome, preço, e **selo "Esgotado"** quando `stock<=0` com **add desabilitado**. Foco programável (a página foca ao montar). Enter na busca → `onAdd(primeiro resultado)`.

- [ ] **Step 1:** testes falhando — `favorites.test.ts`: toggle adiciona/remove e persiste; `orderByFavorites` põe favoritos primeiro mantendo o resto.
- [ ] **Step 2→4:** implementar `favorites.ts` → PASS (mock de localStorage no setup do vitest).
- [ ] **Step 5:** testes falhando — `PdvProductSearch.test.tsx`: digitar filtra; clicar produto chama `onAdd`; produto com `stock<=0` mostra "Esgotado" e add desabilitado (não chama `onAdd`); toggle de estrela reordena.
- [ ] **Step 6→7:** implementar o componente (Tailwind + lucide, cards no estilo do modal/admin) → PASS.
- [ ] **Step 8:** commit — `feat(pdv): product search with manual favorites grid and stock-aware add`.

**Review:** add bloqueado em esgotado; favoritos persistem e ordenam; reuso da camada de dados (sem refetch desnecessário).

---

## Task 4 — `PdvCart`: carrinho UI

**Files:**
- Create: `frontend/components/pdv/PdvCart.tsx`
- Test: `frontend/components/pdv/PdvCart.test.tsx`

**Interfaces (props):**
```ts
{ items: PdvCartItem[]; total: number;
  onInc(id); onDec(id); onRemove(id); onClear(); onPay();
  payDisabled: boolean; }
```
Comportamento: lista itens (nome, −/qty/+, subtotal, remover); total ao vivo (sticky no rodapé); "Limpar" pede confirmação se houver itens; "PAGAR (F2)" desabilitado quando vazio. Lista rola em encomenda grande, total/PAGAR fixos.

- [ ] **Step 1:** testes falhando — render de N itens; −/+ chamam `onDec`/`onInc`; remover chama `onRemove`; total exibido formatado BRL; PAGAR desabilitado com `payDisabled=true`; "Limpar" com itens dispara confirmação antes de `onClear`.
- [ ] **Step 2→4:** implementar → PASS.
- [ ] **Step 5:** commit — `feat(pdv): cart panel with qty controls, live total, guarded clear, pay button`.

**Review:** PAGAR desabilita vazio; limpar confirma; layout aguenta muitos itens (sticky).

---

## Task 5 — Adaptar `PdvPaymentModal` (débito/crédito + fast-pass + sucesso inequívoco)

**Files:**
- Modify: `frontend/components/pdv/PdvPaymentModal.tsx`
- Test: `frontend/components/pdv/PdvPaymentModal.test.tsx` (estender; **manter os 11 existentes verdes**)

**Mudanças (preservando a interface de props; adicionar só o necessário):**
1. **Botões Débito e Crédito** no `PaymentFormView` (hoje só PIX/Dinheiro). Selecionáveis via `onPaymentMethodChange`.
2. **Modo fast-pass:** quando o método não exige QR (todos, no nosso caso), **esconder** o bloco `paymentData`/QR e o 2º botão; um único botão **"Confirmar pagamento e finalizar"** → `onCreateOrderAndPayment`. (Nova prop `showCoupon?: boolean` default `true`; a página passa `false` — cupom **oculto** no v1.)
3. **Copy por método:** Dinheiro = "valor recebido + troco"; PIX = "Cliente paga no QR/maquininha — confirme quando vir o pagamento"; Débito/Crédito = "Passe na maquininha — confirme quando aprovar".
4. **[ACEITAÇÃO EXPLÍCITA] Sucesso inequívoco e instantâneo:** ao sucesso (`completedSale` setado), a `CompletedSaleView` aparece **imediatamente** com destaque forte: **"✅ Venda registrada"** grande, **nº do pedido**, **total**, **troco "R$ X"** (quando dinheiro), e o botão **"Nova venda"** como ação óbvia/primária. Sem ambiguidade entre "processando" e "concluído" — o `paymentLoading` mostra estado claro de "registrando…", e o sucesso troca pra o painel verde de confirmação. (É o requisito do dono: no balcão com fila, o "deu certo" tem que ser claro pra não reclica.)

- [ ] **Step 1:** rodar os 11 testes atuais → baseline verde.
- [ ] **Step 2:** testes falhando (novos) — botões Débito e Crédito aparecem e selecionam; com `showCoupon={false}` o campo de cupom **não** renderiza; modo fast-pass **não** mostra QR e usa o botão único; `completedSale` setado renderiza "✅ Venda registrada" + troco + "Nova venda" proeminente; `paymentLoading` mostra "registrando…" e desabilita o botão.
- [ ] **Step 3:** rodar → FAIL.
- [ ] **Step 4:** implementar as mudanças (sem quebrar props existentes).
- [ ] **Step 5:** rodar **todos** (11 antigos + novos) → PASS.
- [ ] **Step 6:** commit — `feat(pdv): payment modal — debito/credito, fast-pass single-step, hide coupon v1, unambiguous success view`.

**Review:** 11 antigos verdes; sucesso instantâneo e claro; sem QR; cupom oculto.

---

## Task 6 — Página `/pdv/caixa`: auth-gate + layout modo-caixa + fiação + atalhos

**Files:**
- Create: `frontend/app/pdv/caixa/page.tsx`
- Modify: `frontend/app/pdv/page.tsx` (botão "Abrir PDV" → `/pdv/caixa`)
- Test: `frontend/app/pdv/caixa/page.test.tsx` (fluxo integrado com api mockada)

**Comportamento:**
- **Auth-gate** reusando o mecanismo do admin (mesma checagem de sessão/token do `AdminShell`/hook de auth); sem sessão → redireciona `/login`. **Sem** `AdminShell` (tela cheia própria).
- **Topbar:** título "Caixa", nome da loja, campo opcional de nome do cliente (default "Cliente Balcão"), botão **"Sair → Admin"** (`/admin`).
- **Layout 2 painéis** (spec §3.2): esquerda `PdvProductSearch`, direita `PdvCart`; `PdvPaymentModal` por cima ao pagar. Tudo ligado via `usePdvSale`.
- **Atalhos:** foco na busca ao montar; Enter adiciona 1º resultado; **F2** abre pagamento (se carrinho não-vazio); **Esc** fecha modal / limpa venda (com confirmação se houver itens).
- **Momento de sucesso (reforço do requisito):** ao `completedSale`, o modal de sucesso domina a tela; "Nova venda" devolve foco à busca e zera tudo.

- [ ] **Step 1:** teste falhando — render da página autenticada (mock auth) mostra busca + carrinho; **fluxo:** adicionar produto (mock) → PAGAR → escolher Dinheiro → informar recebido → finalizar (mock `createOrder` sucesso) → aparece "✅ Venda registrada" com troco → "Nova venda" limpa o carrinho. E: sem auth → redireciona.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar a página (auth-gate, layout, fiação `usePdvSale`, atalhos) + ajustar o botão da landing.
- [ ] **Step 4:** rodar → PASS. `npm run build --webpack` limpo (17→18 rotas).
- [ ] **Step 5:** commit — `feat(pdv): full-screen caixa screen wiring search+cart+payment with keyboard flow`.

**Review:** auth-gate correto; fluxo ponta-a-ponta verde; build limpo; landing aponta pro caixa.

---

## Task 7 — Revisão de branch + nota de passada manual

- [ ] Revisão whole-branch (modelo `requesting-code-review`): 4 costuras — (1) `unit_price` sempre = preço vigente no payload; (2) Idempotency-Key estável por venda ponta-a-ponta; (3) 422 INSUFFICIENT_STOCK preserva carrinho + mensagem; (4) sucesso inequívoco renderiza antes da próxima venda. Confirmar zero mudança em `backend/`.
- [ ] Rodar `npm test` (vitest) inteiro: alvo **todos os testes novos verdes + os 11 do modal + sem regressão** no restante do front.
- [ ] Registrar no `.superpowers/sdd/progress-pdv-tela-caixa.md`: estado, e **PENDENTE: passada manual do dono** (clicar uma venda real no balcão antes do merge), + decisão de merge.
- [ ] **NÃO mergear** — espera o sinal do dono após a passada manual (como Admin/PIX).

---

## Self-review do plano (feito)
- **Cobertura do spec:** §3 (rota/layout) → T6; §4 (fluxo) → T6; §5 (componentes/modal/callbacks) → T2-T5; §6 (contrato/tipo) → T1; §7 (casos de borda) → T2 (lógica) + T3/T4/T5/T6 (UI); §10 (testes) → cada task; momento de sucesso (requisito do dono) → T5 (aceitação explícita) + T6.
- **Sem placeholders:** interfaces e casos de teste concretos por task.
- **Consistência de tipos:** `PdvPaymentMethod`, `PdvCartItem`, `buildPdvOrderPayload`, `usePdvSale` usados de forma consistente entre T1→T6.
- **Decisão registrada:** `dec` em qty 1 trava no mínimo (remover é explícito) — fixado em T2.
- **Backend:** confirmado zero mudança (idempotência já suportada no controller).
