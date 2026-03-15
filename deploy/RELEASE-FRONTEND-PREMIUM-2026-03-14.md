# Release Frontend Premium - 2026-03-14

## Escopo

Promover para producao a rodada visual e estrutural do frontend validada em `dev/teste`, cobrindo:

- `frontend/app/layout.tsx`
- `frontend/app/loja/page.tsx`
- `frontend/app/admin/page.tsx`
- `frontend/app/admin/estoque/page.tsx`

## Objetivo

Elevar a percepcao do produto em tres superficies criticas:

- Loja: vitrine premium, carrinho lateral e checkout mais elegante
- Admin: command center com leitura executiva mais forte
- Estoque: operacao com mais clareza, alerta visual e acoes rapidas

## Evidencias de validacao

Ambiente validado em `https://dev.gtsofthub.com.br` com:

- `GET /api/v1/health` respondendo `200`
- `GET /loja` respondendo `200`
- `GET /admin` respondendo `200`
- `GET /admin/estoque` respondendo `200`

Builds locais validados:

- `npm run lint`
- `npm run build`

Screenshots de revisao gerados localmente em:

- `artifacts/review-2026-03-14/loja.png`
- `artifacts/review-2026-03-14/admin.png`
- `artifacts/review-2026-03-14/estoque.png`

## Estado atual no servidor

Produção:

- Caminho: `/opt/ucm`
- Commit base atual: `f8ecf61`
- Observacao: existem arquivos nao rastreados locais em producao:
  - `deploy/.env.dev`
  - `deploy/frontend.env`

Dev/teste:

- Caminho: `/opt/ucm-test-repo`
- Commit base atual: `f8ecf61`
- Mudancas validadas presentes no working tree dos 4 arquivos acima

## Promocao recomendada

### 1. Backup dos arquivos atuais de producao

```bash
sudo mkdir -p /opt/ucm/release-backups/2026-03-14-frontend-premium

sudo cp /opt/ucm/frontend/app/layout.tsx /opt/ucm/release-backups/2026-03-14-frontend-premium/layout.tsx
sudo cp /opt/ucm/frontend/app/loja/page.tsx /opt/ucm/release-backups/2026-03-14-frontend-premium/loja-page.tsx
sudo cp /opt/ucm/frontend/app/admin/page.tsx /opt/ucm/release-backups/2026-03-14-frontend-premium/admin-page.tsx
sudo cp /opt/ucm/frontend/app/admin/estoque/page.tsx /opt/ucm/release-backups/2026-03-14-frontend-premium/admin-estoque-page.tsx
```

### 2. Copiar os arquivos validados de dev/teste para producao

```bash
sudo cp /opt/ucm-test-repo/frontend/app/layout.tsx /opt/ucm/frontend/app/layout.tsx
sudo cp /opt/ucm-test-repo/frontend/app/loja/page.tsx /opt/ucm/frontend/app/loja/page.tsx
sudo cp /opt/ucm-test-repo/frontend/app/admin/page.tsx /opt/ucm/frontend/app/admin/page.tsx
sudo cp /opt/ucm-test-repo/frontend/app/admin/estoque/page.tsx /opt/ucm/frontend/app/admin/estoque/page.tsx
```

### 3. Rebuild do frontend de producao

```bash
cd /opt/ucm
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d --build frontend
```

### 4. Validacao imediata

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E 'ucm-(frontend|backend|nginx)$'

curl -I https://gtsofthub.com.br/
curl -I https://gtsofthub.com.br/loja
curl -I https://gtsofthub.com.br/admin
curl -I https://gtsofthub.com.br/admin/estoque
curl -s https://gtsofthub.com.br/api/v1/health
```

## Rollback rapido

Se algo visual ou funcional sair do esperado:

```bash
sudo cp /opt/ucm/release-backups/2026-03-14-frontend-premium/layout.tsx /opt/ucm/frontend/app/layout.tsx
sudo cp /opt/ucm/release-backups/2026-03-14-frontend-premium/loja-page.tsx /opt/ucm/frontend/app/loja/page.tsx
sudo cp /opt/ucm/release-backups/2026-03-14-frontend-premium/admin-page.tsx /opt/ucm/frontend/app/admin/page.tsx
sudo cp /opt/ucm/release-backups/2026-03-14-frontend-premium/admin-estoque-page.tsx /opt/ucm/frontend/app/admin/estoque/page.tsx

cd /opt/ucm
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.prod.yml up -d --build frontend
```

## Observacoes

- Esta promocao nao precisa mexer no backend.
- Esta promocao nao depende de migracoes.
- O caminho mais seguro e promover exatamente os arquivos ja validados em `dev/teste`.
