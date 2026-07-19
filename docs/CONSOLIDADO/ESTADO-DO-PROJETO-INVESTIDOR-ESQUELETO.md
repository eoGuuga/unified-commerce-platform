# GTSoftHub — Esqueleto do Pitch para Investidor

> **Isto é um ESQUELETO, não um pitch pronto.** A estrutura está montada; o **conteúdo de
> negócio está como PERGUNTAS** para o Gustavo responder. Nada de número de negócio foi
> inventado — onde falta dado, há uma pergunta, não um chute.
>
> **Convenção:** o que já é **fato** (produto, tração, custo de IA) está preenchido, puxado do
> mapa técnico (`ESTADO-DO-PROJETO.md`). O que é **tese/número** aparece como
> `❓ PERGUNTA (Gustavo)` — é o que só ele responde. `_[placeholder]_` marca um número a
> preencher.
>
> Preencher os ❓ antes de mandar para qualquer investidor.

---

## 1. O problema
*Comunica:* a dor real e concreta do pequeno comerciante que vende por WhatsApp **sem
sistema** — perde pedido, controla estoque no caderno, não sabe no fim do dia o que vendeu.
Um exemplo concreto vende mais que estatística.

> ❓ **PERGUNTA (Gustavo):** Qual a **dor #1** que você viu na sua mãe, com um exemplo real de
> 2 frases? (Ex.: *"ela anotava pedido no papel e às vezes perdia; o estoque só existia na
> cabeça dela; no fim do dia não sabia quanto tinha vendido nem o que faltava comprar."*)
> Um caso concreto abre o pitch melhor que "o mercado é grande".

## 2. A solução
*Comunica:* em **uma frase**, por que alguém paga por isso.

> **Rascunho** (do mapa técnico — pra você refinar, não pra usar como está):
> *"O GTSoftHub dá ao pequeno comerciante um vendedor de WhatsApp que nunca dorme, um caixa
> (PDV) e um controle de estoque — os três amarrados numa fonte de verdade só, sem ele
> precisar entender de sistema."*
>
> ❓ **PERGUNTA (Gustavo):** Qual a **sua** frase única? A que você diria pra tua mãe, ou pro
> dono da padaria da esquina, em 10 segundos.

## 3. Mercado
*Comunica:* o tamanho da oportunidade — quantos comerciantes assim existem, e quantos você
consegue atingir. Investidor sempre pergunta **de onde vem o número**.

> ❓ **PERGUNTAS (Gustavo):**
> - Quantas docerias / padarias / lojas de bairro no Brasil vendem por WhatsApp? _[TAM — nº]_
> - **De onde tira esse número?** (Sebrae? IBGE? estimativa própria? — a fonte importa tanto
>   quanto o número)
> - Qual a fatia **realmente atingível** nos primeiros 1-2 anos, dado que é solo dev? _[SAM/SOM]_

## 4. Modelo de receita
*Comunica:* como o dinheiro entra — simples e claro.

> ❓ **PERGUNTAS (Gustavo):**
> - Quanto cobra por mês? _[R$ __/mês]_
> - Quais **planos/tiers**? (o mapa técnico diz que vende por plano: só bot / bot+PDV /
>   completo — quanto cada?)
> - É **por-tenant** (mensalidade fixa) ou tem componente **por-uso** (por conversa / por
>   venda)?

## 5. Unit economics
*Comunica:* que cada cliente **dá lucro** (ou dará com escala) — o investidor quer ver que o
negócio não sangra dinheiro ao crescer.

> **Fato já calculado (custo de IA/LLM — do mapa técnico):** o bot custa ~**R$4/mês por loja**
> a 200 conversas/mês; hoje (rules-first) é literalmente centavos, e mesmo AI-led (a IA no
> centro) fica na casa de poucos reais. No agregado, ~**R$220/mês por 10 mil conversas**
> (~**R$0,02/conversa**). **O custo de IA não é o gargalo** na escala de doceria — é
> repassável no preço do plano.
>
> ❓ **PERGUNTAS (Gustavo):**
> - Custo total por tenant/mês = rateio da VPS + Asaas (~R$0,99/cobrança) + LLM (acima) +
>   Meta. Some tudo: _[R$ __/tenant/mês]_
> - A mensalidade cobre e **sobra quanto**? _[margem bruta por tenant]_
> - A partir de quantos tenants a VPS única não aguenta (quando entra custo de infra a mais)?
>   _[ponto de virada]_

## 6. Diferencial / por que ganhamos
*Comunica:* por que **você**, e não o concorrente — o fosso.

> **Pistas do mapa técnico** (pra você confirmar e afiar): o all-in-one **bot IA + PDV +
> estoque + recebimento por-lojista** num pacote só, contra concorrentes de "cardápio/pedido
> online"; a IA que **não inventa dado** (preço/estoque sempre do banco); o recebimento
> integrado por lojista.
>
> ❓ **PERGUNTA (Gustavo):** Contra o **Cardápio Web** e afins, **por que o all-in-one ganha?**
> Qual é o fosso de verdade — o recebimento integrado? a IA de vendas? o preço? a
> simplicidade pra quem não é técnico? Escolha o ângulo mais forte e defenda-o.

## 7. Tração (o que é REAL hoje) — ✅ preenchido dos fatos
*Comunica:* que não é slide — tem coisa **provada no ar**.

- **1 design partner real** em produção: a doceria *Loucas por Brigadeiro* (a mãe do founder)
  — o primeiro cliente e laboratório.
- **Núcleo provado:** multi-tenancy por RLS **provado sob ataque** (auditoria adversarial de
  7 blocos, **zero risco crítico explorável**); segurança HIGH fechada; motor de estoque com
  **invariante provado**.
- **PIX por-lojista provado AO VIVO** (2026-07-07): round-trip de cobrança PIX real com uma
  subconta **real** — o diferencial mais sensível, provado ponta a ponta.
- **Bot de WhatsApp provado ponta-a-ponta** (2026-07-07): round-trip real, webhook verificado
  pela Meta.
- Produto **no ar** em `gtsofthub.com.br` (deploy manual, solo dev).

> ❓ **PERGUNTA (Gustavo, pra fortalecer):** tem algum **número de uso** da tua mãe? (pedidos/
> mês pelo bot, tempo/erro que ela economizou). Mesmo pequeno — "resolve uma dor real de um
> cliente real" é a tração que importa neste estágio.

## 8. O time / o founder
*Comunica:* **founder-market fit** — por que VOCÊ é a pessoa certa pra construir isso.

> ❓ **PERGUNTA (Gustavo):** A **tua história** em 3-4 frases: por que VOCÊ constrói isso?
> (solo dev que começou resolvendo a dor da **própria mãe** = founder-market fit forte — você
> conhece o cliente de dentro, não de uma pesquisa). A origem vende; conte-a.

## 9. O ask
*Comunica:* o que você quer do investidor — ou se é bootstrap. O investidor só quer
**clareza**, não uma resposta específica.

> ❓ **PERGUNTAS (Gustavo) — deixe em aberto se ainda não decidiu:**
> - Você quer **levantar**? Quanto? _[R$ __]_
> - **Pra quê?** (contratar? marketing/aquisição? sair da VPS única pra infra com redundância?)
> - Ou é **bootstrap** (crescer com a própria receita, sem diluir)? — as duas respostas são
>   legítimas; a falta de clareza é que assusta.

---

> **Como usar:** responda os ❓ um a um (não precisa de todos pra começar — o problema, a
> solução e a tração já contam uma história). O que está preenchido é fato do mapa técnico
> (`ESTADO-DO-PROJETO.md`); nada de negócio foi inventado. Quando os números existirem,
> este esqueleto vira o one-pager — e dá pra transformar num visual (Artifact/slide) por cima.
