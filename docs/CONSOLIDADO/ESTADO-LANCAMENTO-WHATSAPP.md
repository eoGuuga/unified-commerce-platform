# Estado de Lançamento — Bot WhatsApp

> **Data:** 2026-07-21 · **Autoria:** Gustavo (dono) + Claude Code (dev), sessão de integração WhatsApp/Meta.
>
> **TL;DR:** o bot está **tecnicamente pronto e no ar**, mas **não pode conversar com clientes** — bloqueado pela **Verificação de Negócio da Meta**, que exige **CNPJ**, que o dono ainda não tem. **O gargalo do lançamento é externo (formalização + Meta), não técnico.** Nenhuma linha de código falta.

Este documento é o histórico rastreável do lançamento no momento em que o gargalo passou a ser o CNPJ. Escrito para retomar sem depender de memória.

---

## 1. Estado técnico do bot (verificado na fonte, não presumido)

Confirmado ao vivo em 2026-07-21 (prod + Graph API), não por narrativa:

| item | estado | como foi confirmado |
|---|---|---|
| **Prod** | `f8a2c9d`, health 200 | `git rev-parse` + `curl` no servidor |
| **IA-vendedora (Fatias 1-4)** | no ar | handlers `handle*ViaLoop` + `handleProcessOrderProposal`/`handlePendingCartAdd` no `dist` do container |
| **Cinturão §5 (narration-guard)** | no ar, 5 call sites | `narration-guard.js` presente + `grep -c checkNarrationFacts` = 5 no dist |
| **Gate de escrita** | no ar | `cartService.addItem` = 1 único call site (dentro de `handlePendingCartAdd`) |
| **Throttle do webhook** | 60/min, medido | metadata em runtime + sonda em prod (429 na 61ª, não na 11ª) |

### Integração WhatsApp/Meta (confirmada via Graph API com o token vivo)

| item | valor (público) | como foi confirmado |
|---|---|---|
| **App** | "botwhats", App ID `1405041341445867` | `debug_token` + `GET /{app_id}` |
| **Token de acesso** | **permanente** — `type: SYSTEM_USER`, `expires_at: 0` | `debug_token` (nunca expira) |
| **Usuário de Sistema** | `bot-gtsofthub` (id `122103088737399343`) | `GET /me` |
| **Escopos do token** | `whatsapp_business_management`, `whatsapp_business_messaging`, `public_profile` | `debug_token` |
| **Webhook** | **ativo**, campo `messages` subscrito | `GET /{app_id}/subscriptions` → `active: true` |
| **Webhook — URL** | `https://gtsofthub.com.br/api/v1/whatsapp/webhook?tenantId=2675a300-…` | confirmado em DOIS níveis: subscrição do app **e** `webhook_configuration` do número |
| **Tenant** | doceria "Loucas por Brigadeiro" (`2675a300-1f03-4c74-b462-99754fd70eb2`) | a URL do webhook aponta pra ele |
| **Número registrado hoje** | "Test Number" (número de teste da Meta), `NOT_VERIFIED`, `platform_type: CLOUD_API` | `GET /{phone_number_id}` |

### O estado real, em uma frase

**Código 100% pronto, provado por testes e por inspeção do artefato servido — mas NUNCA exercitado ao vivo.** Nenhuma mensagem real foi trocada com um cliente. Tudo que sabemos do comportamento vem de teste e de round-trip técnico (07/jul), não de uso.

---

## 2. O bloqueio — a cadeia causal exata

```
O bot não pode conversar com clientes
        └── PORQUE as WABAs estão RESTRITAS ("Conta com restrição", duração "Permanente" = até verificar)
                └── a restrição bloqueia: iniciar conversa · responder cliente · adicionar número
        └── PORQUE a Verificação de Negócio da Meta está PENDENTE
                └── a Meta exige verificar a empresa antes de liberar mensagens a clientes reais
        └── PORQUE a verificação exige CNPJ + documentação empresarial
                └── o dono NÃO tem CNPJ da GtsoftHub ainda   ← O GARGALO DO LANÇAMENTO INTEIRO
```

**WABAs restritas (só os IDs públicos, nenhum segredo):**
- Ucm: `1027513996872585`
- Test WhatsApp Business: `1780243036671907`

**Ponto fino:** o número de teste da Meta *recebe* inbound mas *não entrega* outbound (limitação do número de teste, por design) — mas isso é secundário. Mesmo com um número real registrado, **as WABAs restritas bloqueiam a conversa com cliente até a verificação de negócio**. A verificação é o bloqueio de fundo; o número de teste é só o sintoma visível hoje.

---

## 3. Decisão de arquitetura de negócio (contexto novo: dois clientes)

**A GtsoftHub deixou de ser ideia — é um SaaS multi-cliente.** O dono tem **dois clientes**: a loja da mãe (doceria) e a loja da tia.

**Modelo correto:**
- **GtsoftHub = plataforma/provedora** — é ELA que se verifica na Meta (Business Verification no nível da plataforma).
- **Cada loja = cliente** com seu próprio número, sob a estrutura da GtsoftHub.
- O sistema **já suporta** isso: multi-tenant via `tenantId` (cada loja é um tenant; o webhook já roteia por `?tenantId=`).

**Atalho DESCARTADO:** "verificar com o CNPJ da doceria". Com dois clientes, não serve — não dá pra pôr duas lojas sob o CNPJ de uma. A verificação tem que ser da **plataforma**, não de um cliente. Formalizar a doceria resolveria uma loja e criaria dívida na segunda.

---

## 4. Próximos passos — separados por terreno

### 🌍 Mundo real (dono — PRIORIDADE Nº 1, destrava tudo)

**Falar com contador → abrir CNPJ da GtsoftHub → verificar na Meta → destravar as WABAs.**

Perguntas-chave pro contador:
- **Tipo de empresa:** MEI, ME ou LTDA? (MEI tem teto de faturamento e limitação de sócios/atividades; SaaS costuma pedir ME/LTDA)
- **CNAE:** atividade de **desenvolvimento/licenciamento de software** (ex.: 6201-5/01, 6203-1/00) — confirmar o(s) código(s) certo(s) pra SaaS.
- **Emissão de NF pros clientes:** como a GtsoftHub fatura as lojas (mensalidade/comissão) e emite nota.
- **Regime tributário:** Simples Nacional vs outros — impacto no custo por faturamento.
- **Prazo e custo:** quanto tempo pra abrir + custo de abertura + custo mensal (contador + tributos).

### 🔧 Técnico (aqui, em paralelo — NÃO bloqueado pela Meta)

Trabalho que anda sem depender do CNPJ:
1. **🔴 #4 estorno do PDV** — protege o que as lojas **já usam hoje** (venda de balcão irreversível). Diagnóstico feito; construção fatiada com prova de invariante (ledger==estoque). Ver `00-ROADMAP.md`.
2. **🟠 deploy do fix do error_log** — branch `fix/nginx-remove-test-upstreams` (`a07edb7`) pronta e pushada; emenda no próximo deploy real.
3. **🟠 alerta do 429** — diagnóstico feito; depende do error_log limpo (item 2).
4. **Onboarding multi-loja** — quando o CNPJ sair, a estrutura pra cadastrar a 2ª loja (tia) como tenant. O sistema já é multi-tenant; falta o fluxo de onboarding.

---

## 5. O que está PRONTO esperando o desbloqueio (pra retomar liso)

Quando o CNPJ vier e a verificação passar, estes já estão mapeados/prontos — não recomeçar do zero:

- **Registrar o número real:** procedimento mapeado (ver `00-ROADMAP.md` / memória). **Só o `WHATSAPP_CLOUD_PHONE_NUMBER_ID` muda**; token (permanente), webhook, verify token e App Secret **continuam**. Atualização = editar `.env` no servidor + recriar o backend via `deploy.sh` (que blinda watchdog + refresca nginx).
- **Modo do app:** confirmar no App Dashboard (`developers.facebook.com/apps/1405041341445867`, toggle **App Mode** no topo) se está **Development** → precisa publicar (Live) ou adicionar testadores. É a suspeita nº2 do outbound, depois do número.
- **Plano de atualização da config:** o `.env` de prod tem as 5 vars WhatsApp mapeadas no `docker-compose.prod.yml` (o bug de env faltando foi consertado em `e7eadb1`). Recriar container ≠ só editar arquivo.

---

## 6. Registro

- **Data do estado:** 2026-07-21.
- **Natureza do bloqueio:** **externo** (Verificação de Negócio da Meta + formalização/CNPJ), **não técnico**. O código não tem pendência que impeça o lançamento.
- **O que muda quando o CNPJ sair:** o gargalo deixa de ser "não podemos conversar" e passa a ser onboarding + a prova viva do bot (que nunca aconteceu). A partir daí, o risco volta a ser técnico (o bot nunca processou tráfego real) — ver a fronteira honesta em `00-ROADMAP.md`.

*Sem segredos neste documento: só IDs públicos da Meta (App, WABA, System User, Phone Number ID interno). Nenhum token, App Secret, ou número de telefone pessoal.*
