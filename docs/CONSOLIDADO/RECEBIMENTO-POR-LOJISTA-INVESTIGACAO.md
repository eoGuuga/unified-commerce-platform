# Recebimento por-lojista — investigação (mapa pra uma sessão dedicada)

> **STATUS: INVESTIGADO, NÃO INICIADO. Aguarda uma sessão DEDICADA, com o dono descansado.**
> Esta é a frente **mais séria e MAIOR** do projeto — ela roteia **dinheiro de terceiros**. Um erro aqui é **incidente**, não bug. O dono e o arquiteto decidiram (2026-07-02) que ela **não deve ser construída no fim de uma maratona**: as decisões grandes (gateway definitivo, compliance) amadurecem **fora da pressa**, e a construção exige segurança-primeiro + revisão adversarial. Este doc é o "ouro" da investigação, pra retomar sem re-investigar.

---

## 1. O objetivo (o modelo de negócio decidido)

- **Bot 100% automático:** o cliente paga e o sistema é avisado **sozinho** (webhook do gateway) — sem humano confirmando. Isso **exige um gateway** (PIX-direto-por-chave não tem confirmação automática — ver §7).
- **O dinheiro das vendas cai na conta de CADA LOJISTA** (não na da plataforma). A plataforma cobra **só a assinatura**; **não intermedeia** o dinheiro das vendas (evita o peso regulatório de segurar dinheiro de terceiros).
- **Inclusivo:** funcionar pro pequeno empreendedor, idealmente com qualquer banco.

## 2. O modelo de SUBCONTA — por que resolve os três requisitos

A plataforma cria (via API) **uma conta de pagamento por lojista** no gateway (modelo white-label/BaaS). O dinheiro liquida **direto na (sub)conta do lojista**; ele **saca pro banco que quiser** (Nubank/Itaú/qualquer um), no app/painel dele.
- **Automático:** o gateway manda **webhook de confirmação** → o bot fecha a venda sozinho.
- **Inclusivo:** o lojista mantém o banco dele; só ganha uma **conta de recebimento grátis** no gateway (a subconta), que varre pro banco pessoal. "Qualquer banco" vira "o banco dele + uma conta grátis de recebimento".
- **Dono não intermedeia:** o dinheiro **não passa** pela conta da plataforma — fica na subconta do lojista. (Diferente de *split/escrow*, onde a plataforma recebe e repassa — **evitar**, é o que coloca a plataforma no meio do dinheiro.)

## 3. Os DOIS riscos do dono e as respostas arquiteturais

### 🔴 Risco A — comprometimento externo ("se for hackeado, pega tudo do cliente")
**Resposta: credencial de ESCOPO LIMITADO — cria cobrança, NÃO saca.**
- O Asaas permite chave de API **escopada por módulo** (via `accessTokenConfig` ao criar a subconta), com escopo `READ` ou `READ_WRITE` por recurso:
  - Entra (**pode**): `PAYMENT`, `PIX_CREDIT`, `SUBSCRIPTION` = `READ_WRITE`.
  - Sai (**bloquear**): `TRANSFER`, `PIX_DEBIT`, `BILL` = `READ` (só leitura → **não move dinheiro pra fora**).
  - Exemplo literal da doc: `[{"name":"PAYMENT","scope":"READ_WRITE"},{"name":"TRANSFER","scope":"READ"}]`.
- **Efeito:** mesmo que a plataforma seja invadida e a key vaze, o atacante **só faz o dinheiro ENTRAR** na conta do lojista — **não consegue sacar/transferir**. O saque é ação do **lojista, no app Asaas dele, com a auth dele** — fora do alcance de um invasor da nossa plataforma.
- **Defesa em profundidade:** **whitelist de IP** (só o IP do servidor usa a key), **validação de saque por webhook** (Asaas pergunta antes de transferir; opt-in), **aprovação manual na interface** (o lojista exige OK dele pra qualquer saque; opt-in).
- ⚠️ **A PROVAR NO SANDBOX antes de qualquer spec:** duas páginas da doc do Asaas se contradizem — a de *permissões* diz que a key é escopável (resolve o Risco A); a geral de *chaves* diz "tudo-ou-nada". **É o pilar do Risco A — tem que ser provado no sandbox** (um `POST /transfers` com a key "só cobrança" DEVE ser recusado), com **teste automatizado** que falha se a key ganhar poder de saque. E o **default** de uma key é acesso total → least-privilege tem que ser **explicitamente configurado**.

### 🔴 Risco B — ameaça interna ("a balconista de má-fé retira o dinheiro")
**Resposta: separação de papéis — só admin toca no financeiro. A base JÁ existe.**
- `UserRole = { ADMIN, MANAGER, SELLER, SUPPORT }` (`backend/src/database/entities/Usuario.entity.ts:13-18`, default `SELLER`).
- `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN)` já protege o PATCH das settings do tenant (`tenants.controller.ts:71-72`) → **um SELLER (balconista) já NÃO muda as configurações** (onde a conta de recebimento viveria). **A primitiva já está no lugar.**
- **Desenho:** conta de recebimento + credencial de pagamento atrás de `@Roles(ADMIN)` — **só a dona** vê/muda; a balconista (SELLER) registra venda no PDV e **nunca toca em dinheiro/recebimento/credencial**. O **saque nem passa pelo nosso sistema** (é a dona no app Asaas) → a balconista não tem como sacar **por definição**.
- **Pré-requisito operacional:** a doceria precisa **criar contas SELLER separadas** pras balconistas (não todas logarem como a dona). O modelo suporta; é disciplina de uso.
- **A construir (não existe hoje):** **step-up auth** (re-senha/2FA) + **e-mail de aviso** + **audit log** ao mudar a conta de recebimento (protege contra ADMIN comprometido e contra engano — é o vetor pra desviar o dinheiro mudando pra outra conta).

## 4. Comparativo de gateways (pesquisa da doc real 2026)

| Gateway | PIX+webhook | Acessível (MEI) | Modelo "dinheiro na conta do lojista" | Segurança da credencial |
|---|---|---|---|---|
| **Asaas** ✅ recomendado | ✅ | ✅ grátis; IP+SCD **regulada BACEN** | subconta white-label (plataforma cria) OU conta-própria+API key | **key escopável "só cobrança"** (§3A) — o melhor pro Risco A |
| **Mercado Pago** | ✅ | ✅ ubíquo | **OAuth** (lojista autoriza) → conta MP dele | token de escopo **grosso** (`read`/`write`); `write` faz reembolso; saque é no app do lojista. 180d → refresh |
| **Efí (ex-Gerencianet)** | ✅ | ✅ 30 PIX/mês grátis | conta-própria/BaaS | **exige certificado mTLS** (setup mais técnico); escopo "só-cobrança" não confirmado |
| **Stripe (Connect)** | ⚠️ PIX BR restrito | ⚠️ internacional | conta conectada | não recomendado pro caso BR-micro |
| **PagBank** | ✅ | ✅ | tende a **split** (plataforma no meio) | ⚠️ evitar o split |

**Recomendação: Asaas + subconta com key escopada "só cobrança".** Por quê: (a) feito **pra plataformas SaaS** (subconta automática via API → menor fricção de onboarding); (b) PIX + webhook de confirmação; (c) **IP de pagamento + SCD regulada pelo BACEN**; (d) grátis/baixo custo pro MEI; (e) **o único que dá a credencial "só entra, não sai"** que neutraliza o Risco A; (f) tem sandbox pra provar antes. **MP OAuth** é o forte segundo (ubíquo — se a maioria dos lojistas-alvo já tiver MP). A arquitetura deve nascer **atrás de uma interface de provider**, pra suportar mais de um gateway depois (e, no futuro, cada lojista escolher).

## 5. Como guardar a credencial (a infra já existe)

- **Cifragem forte já pronta:** `encryption.service.ts` — **AES-256-GCM**, `ENCRYPTION_KEY` (boot falha se fraca), `encryptString/decryptString`, e o **molde funcional** `whatsapp_cloud_token_encrypted` (getter **tenant-scoped** `getWhatsappCloudToken`).
- **Write-only na UI já é padrão:** `TenantSettingsProjection` (allow-list) **nunca ecoa segredo** — só booleanos de presença. A credencial de pagamento entraria nessa convenção.
- **Padrão de ouro:** cifrado em repouso (temos) + nunca em log (regra do projeto) + write-only (temos) + acesso mínimo tenant-scoped + rotação (a conta-mãe rege as keys das subcontas) + **least-privilege no gateway** (a key "só cobrança" — protege **mesmo se a cifragem falhar**; é a blindagem mais importante).
- ⚠️ **NÃO reusar** os helpers legados `encryptAndSaveApiKey/decryptApiKey/usesOwnKey` (referenciam colunas/função SQL `encrypt_api_key` que **não existem** em migration → falham em runtime). Só `encryptString/decryptString`.

## 6. O estado do código (o que existe vs. o que falta)

- **NÃO existe abstração de provider.** Não há `PaymentProviderFactory` (grep = zero). Só `getPaymentProvider()` (`payments.service.ts:217`) lendo a env **global** `PAYMENT_PROVIDER` + `if (provider === 'mercadopago')` espalhado. **Acoplado ao MP, global, não por-tenant.**
- **A credencial é 100% global hoje:** `MERCADOPAGO_ACCESS_TOKEN` lido uma vez no boot (`mercadopago.provider.ts:132`), client **singleton** (`:127`,`:136`), reusado em tudo (`createPixPayment:167`, webhook `getPaymentDetails:334`). **Dinheiro de todos → conta única (a da plataforma).**
- **Por-tenant hoje = só cosmético:** `pix_merchant_name` (nome no EMV). O `settings.pix_key` é **armazenado, validado e devolvido ao lojista MAS NUNCA usado** pra gerar pagamento (o mock usa a env global `PIX_KEY:459`) — **campo morto que ilude** (reconciliar ao desenhar).
- **O gerador de PIX estático (`generatePixData:458-493`) está QUEBRADO** (não calcula CRC16, tags fora do padrão) — mock de dev, não gera BR Code válido.
- **RLS sólido nos pagamentos** (`pagamentos` ENABLE+FORCE; contexto setado no interceptor e no webhook). **MAS o RLS NÃO protege a escolha da credencial** (é chamada de API externa) — a blindagem do roteamento é em código.

**O PONTO MAIS PERIGOSO (roteamento):**
- **Criação:** a identidade do tenant é confiável (JWT `@CurrentTenant:41` ou `x-tenant-id:32`, gravada em `Pagamento.tenant_id:153`, embutida no metadata do MP `:223`). A seleção da credencial por-tenant (futuro) entra **antes de `provider.createPixPayment` (`payments.service.ts:340`)** e **DEVE** ser derivada do **`pagamento.tenant_id`** (mesmo do pedido), verificada — senão, dinheiro na conta errada.
- **Webhook (roteamento reverso):** hoje `getPaymentDetails:997` usa o client **global**, escolhido **ANTES** de `extractTenantId:1005` (que lê `metadata.tenant_id`). Com contas por-tenant, essa ordem é **insustentável** — precisa: identificar a conta (pelo `user_id` da notificação, OU webhook URL por-tenant `?tenantId=`, como no WhatsApp) → pegar o token daquele tenant → só então consultar.

## 7. Por que NÃO dá pra fugir do gateway (o PIX-direto-por-chave)

- Gerar um **QR PIX estático (BR Code)** apontando pra chave de qualquer banco é **viável e sem gateway** — mas **NÃO tem confirmação automática** (o dinheiro vai direto banco→banco; a plataforma não recebe callback). Confirmação seria **manual** (lojista marca "recebi") ou por comprovante no chat. Isso **mata a autonomia do bot**.
- Confirmação automática **exige** um PSP que webhooka → **o lojista precisa de conta no gateway/PSP**. É onde "automático" e "qualquer banco pessoal" se chocam; a resolução é a subconta grátis (§2).

## 8. As decisões NÃO-CÓDIGO (o dono decide com calma, FORA da sessão)

1. **Escolha DEFINITIVA do gateway** (Asaas vs MP vs outro) — é escolher a infra financeira do produto **por anos**. Ler termos, taxas 2026, talvez falar com o comercial do Asaas.
2. **Obrigações de compliance/KYC/contratuais** de movimentar dinheiro de terceiros — o que a plataforma assume ao criar subcontas (contrato com o Asaas, responsabilidades, KYC dos lojistas = PII sensível).
3. **Criar a conta de PLATAFORMA no Asaas** — dependência de **mundo real** (documentação, verificação de empresa, burocracia mais séria que a da Meta — porque é dinheiro). Não está sob o nosso controle; provavelmente demora.
4. **Sondar lojistas reais** (a doceria + 2-3 prospects): que conta de recebimento eles já usam? Isso, mais que a técnica, decide o gateway primário.

## 9. O tamanho real + o método

**É a MAIOR e mais sensível frente do projeto — maior que o bot.** Envolve: abstração de provider de verdade (não existe) · integração do gateway (criar subconta + KYC + key escopada + cobrança PIX) · **webhook por-subconta (roteamento reverso)** · armazenamento cifrado por-tenant · **roteamento credencial↔tenant blindado** · separação de papéis + step-up auth · migração do MP-global sem quebrar a doceria.

**Método que ela EXIGE:**
- **Segurança-primeiro** — cada ponto onde um token é escolhido, amarrado ao tenant do pedido e verificado; least-privilege no gateway; step-up nas ações financeiras.
- **TDD** — inclusive um teste que **falha se a key ganhar poder de saque**.
- **Revisão adversarial / de segurança dedicada** (idealmente um par de olhos externo) **antes** de tocar dinheiro real de terceiros.
- **Sandbox primeiro** — provar o escopo "só cobrança" e o fluxo inteiro sem dinheiro real.

## 10. O que ainda precisa ser VERIFICADO antes de desenhar (não fechar no chute)

- **Sandbox Asaas:** provar que a key "só cobrança" recusa `POST /transfers` (pilar do Risco A) + resolver a contradição das duas páginas da doc.
- **Compliance:** requisitos exatos pra a plataforma criar subcontas (contrato, responsabilidades, KYC).
- **Taxas** por-transação de PIX em 2026 (variam por volume/plano) — comercial do Asaas/MP.
- **Formato da notificação OAuth/webhook** por-conta (traz `user_id`? dá pra rotear?).
- **Refresh do MP** (se for MP): se o `refresh_token` rotaciona.

---

**Fontes (2026):** Asaas — [permissões de chaves](https://docs.asaas.com/docs/gerenciamento-de-permiss%C3%B5es-de-chaves-de-api), [chaves de API](https://docs.asaas.com/docs/chaves-de-api), [validação de saque](https://docs.asaas.com/docs/mecanismo-para-validacao-de-saque-via-webhooks), [whitelist de IPs](https://docs.asaas.com/docs/whitelist-de-ips), [criação de subcontas](https://docs.asaas.com/docs/criacao-de-subcontas) · Mercado Pago — [OAuth marketplace](https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/how-tos/integrate-marketplace), [OAuth token](https://www.mercadopago.com.br/developers/en/reference/authentication/oauth/_oauth_token/post) · Efí — [API PIX](https://sejaefi.com.br/efi-pay/api-pix) · Stripe — [Pix](https://docs.stripe.com/payments/pix) · BACEN — [Manual de Iniciação do Pix](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf).

_Investigação: 2026-07-02. NÃO implementado, NÃO desenhado. Aguarda sessão dedicada com o dono descansado e as decisões grandes amadurecidas._
