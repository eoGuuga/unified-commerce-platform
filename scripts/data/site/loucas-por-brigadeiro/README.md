# Loucas Por Brigadeiro - Extracao MenuDireto

- Extraido em: 2026-03-21T14:32:50.257Z
- Fonte: https://menudireto.com/loucas-por-brigadeiro/#12
- RestauranteN: 756
- Telefone: (11) 95109-3485
- Endereco: Avenida Pires do Rio, 1949 - Jardim São Sebastião - SAO PAULO
- Horario: 13:00 às 17:30
- Plataforma: MenuDireto

## Resumo

- Categorias: 10
- Produtos totais: 63
- Produtos vendaveis: 61
- Itens informativos: 2
- Grupos de adicionais: 28
- Opcoes de adicionais: 47

## Categorias

- Informações: 2 itens (0 vendaveis)
- Açaí: 2 itens (2 vendaveis)
- Docinhos: 6 itens (6 vendaveis)
- Bolo no Pote 220 ml: 4 itens (4 vendaveis)
- Bolos Gelados e Fatias de Bolo: 5 itens (5 vendaveis)
- Bolo Vulcão: 2 itens (2 vendaveis)
- Delícias: 20 itens (20 vendaveis)
- Bala de Coco Artesanal 120g: 2 itens (2 vendaveis)
- Bebidas: 8 itens (8 vendaveis)
- Presentear: 12 itens (12 vendaveis)

## Arquivos gerados

- `menudireto-catalog.json`: extracao estruturada fiel ao MenuDireto.
- `ucm-homologacao.json`: rascunho normalizado para homologacao de bot, PDV e estoque.
- `scripts/seeds/seed-client-catalog.ts`: importador generico para criar/atualizar tenant, categorias, produtos, estoque e metadata comercial.

## Seed para homologacao

Para transformar este catalogo em tenant real no sistema:

```bash
cd backend
npm run seed:catalog -- --input ../scripts/data/site/loucas-por-brigadeiro/ucm-homologacao.json --dry-run
```

E depois, para gravar no banco:

```bash
cd backend
npm run seed:catalog -- --input ../scripts/data/site/loucas-por-brigadeiro/ucm-homologacao.json
```

Esse seed configura:

- tenant da loja
- numero de WhatsApp autorizado no `tenant.settings`
- categorias e produtos vendaveis
- estoque sintetico de homologacao
- metadata comercial para o bot do WhatsApp
- itens informativos guardados em `tenant.settings`

## Validacao local desta rodada

- `npm run seed:catalog -- --input ../scripts/data/site/loucas-por-brigadeiro/ucm-homologacao.json --dry-run` => PASS
- `npm run seed:catalog -- --input ../scripts/data/site/loucas-por-brigadeiro/ucm-homologacao.json` => BLOQUEADO por `ECONNREFUSED` no Postgres local (`127.0.0.1:5432`)

Assim que o banco local ou o ambiente `dev/teste` estiver disponivel, esse mesmo comando ja serve para aplicar o tenant de homologacao.

## Operacao recomendada da loja

- O servidor continua sendo o nucleo do sistema.
- O computador da loja usa navegador para `/pdv`, `/admin` e `/admin/estoque`.
- O celular da loja segura o numero do WhatsApp.
- Na fase atual de homologacao, usar numero pessoal de teste.
- Na fase final, trocar para o numero oficial da loja.
- Provedor recomendado nesta fase: `Evolution API` autohospedada.

Checklist operacional detalhado:

- [11-HOMOLOGACAO-LOUCAS-POR-BRIGADEIRO.md](C:/Users/gusta/OneDrive/Desktop/sas/docs/CONSOLIDADO/11-HOMOLOGACAO-LOUCAS-POR-BRIGADEIRO.md)

## Observacao

Os campos `estoque` e `min_stock` do rascunho de homologacao sao sinteticos e servem apenas para testes iniciais. Na homologacao oficial, esses valores devem ser substituidos pelos dados reais do cliente.
