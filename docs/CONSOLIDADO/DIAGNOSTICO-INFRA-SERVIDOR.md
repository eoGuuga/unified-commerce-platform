# Diagnóstico da Infraestrutura do Servidor (2026-06-28)

Mapeamento honesto do estado real do servidor de produção (`ubuntu@gtsofthub.com.br`),
feito sem modificar nada. Objetivo: dar a Gustavo o quadro completo para decidir a "faxina".

---

## O que está NO AR e funcionando (não mexer sem cuidado)

- Site completo: home, login, /admin/pedidos, catálogo — todos respondendo 200.
- Backend rodando = **código NOVO** (confirmado: tem módulos LGPD e R2 no `dist`).
  Apesar de o repo "oficial" estar velho, a IMAGEM que está rodando foi buildada hoje
  do clone atualizado. Ou seja: **o container está certo; o repo no disco é que está bagunçado.**
- `NODE_ENV=production` ativo (proteções fail-closed ligadas).
- Banco com backup recente + colunas LGPD/R2 aplicadas.

---

## A bagunça (a dívida a arrumar)

### 1. DOIS repositórios git no servidor
| Diretório | Estado | É usado? |
|---|---|---|
| `/opt/ucm` | commit velho (`b30fa0b`), **86 commits atrás**, **43 arquivos modificados localmente** | É o que o `docker-compose.prod.yml` referencia (`context: ../backend`), MAS o container atual foi buildado do clone abaixo |
| `/opt/ucm/unified-commerce-platform` | **atualizado (0 atrás), limpo** | Clone que o agente manteve; foi a fonte do build de hoje |

**Decisão necessária:** eleger UM repo como fonte da verdade e eliminar o outro.
O caminho mais limpo: fazer `/opt/ucm` voltar a ser a fonte (é o que o compose espera),
reconciliando-o com a `main` — MAS preservando as edições locais importantes (ver abaixo).

### 2. Edições locais em `/opt/ucm` que NUNCA foram para o GitHub
Risco de PERDA se o servidor morrer, e risco de QUEBRA se sobrescrever sem cuidado:

- **`deploy/nginx/ucm.conf`** — diverge MUITO do GitHub (534 linhas alteradas). Provavelmente
  contém a config real de SSL/rotas/proxy. **NÃO sobrescrever** — esta é a config viva do site.
- **`backend/auth.controller.ts`, `auth.service.ts`** — editados à mão no servidor (ex.: o
  `b30fa0b "Allow public registration"`). Verificar se já estão na main (provavelmente sim,
  de forma diferente).
- **Módulos só-no-servidor (untracked):** `backend/src/modules/email/` (email.service),
  `backend/src/modules/subscriptions/` (plan.enum), `frontend/app/registrar/`,
  componentes de landing (`CalculadoraROI`, `Comparacao`, `ProvaSocial`).
  **STATUS: NÃO estão em uso** — `app.module.ts` não os importa. São experimentos/restos.
  Mas o `registrar/` e os componentes de landing podem ser features reais que alguém começou.
- **Lixo a limpar:** `*.sh` soltos (fix-critical, fix-safe, security-check...),
  backups de nginx (`.broken`, `.backup`, `.new`), `CREDENCIAIS-SERVIDOR.txt` (⚠️ secret em texto),
  `certs/`.

### 3. O compose NÃO passa os secrets do MercadoPago
- A seção `environment:` do backend (docker-compose.prod.yml ~L66) lista DATABASE_URL, JWT,
  OPENAI, etc. — mas **NÃO** lista `MERCADOPAGO_ACCESS_TOKEN` nem `MERCADOPAGO_WEBHOOK_TOKEN`.
- **Isto também está assim NO GITHUB** (não é só edição local) — é um bug do compose versionado.
- **Consequência:** o container nunca recebe esses secrets → o pagamento real (MercadoPago)
  provavelmente NUNCA funcionou por este compose. **Este é o item mais crítico para vender.**

### 4. Sem processo de deploy confiável
- Não há `.dockerignore` no backend versionado em `/opt/ucm` (causou o bug do build de hoje).
- Build pega do diretório errado se não tomar cuidado.
- Sem validação automatizada de boot antes de trocar o container.

---

## Plano de faxina sugerido (ordem de menor risco → maior valor)

1. **Salvar o que só existe no servidor** (antes de qualquer coisa): commitar/backupear
   `nginx/ucm.conf` real, os módulos email/subscriptions/registrar, componentes de landing,
   para o GitHub (numa branch), para NUNCA perder. Avaliar o que é feature vs lixo.
2. **Consolidar para UM repo.** Eleger `/opt/ucm` como fonte; reconciliar com a main
   preservando nginx/.env locais; remover o clone duplicado.
3. **Corrigir o compose:** adicionar os secrets do MercadoPago ao `environment:` (no GitHub).
4. **Validar o pagamento ponta a ponta** (depende do #3): pedido real → PIX real → confirmação.
5. **Documentar o processo de deploy** no CLAUDE.md (dir certo, .dockerignore, validar boot).
6. **Limpar o lixo** (scripts soltos, backups, CREDENCIAIS-SERVIDOR.txt → mover para secret manager).

> Cada passo é uma operação dedicada e reversível. NÃO fazer tudo de uma vez com a API no ar.
> O #1 (salvar o que só existe no servidor) é urgente — é o único risco de perda irreversível.
