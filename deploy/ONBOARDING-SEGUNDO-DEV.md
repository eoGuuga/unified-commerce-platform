# Onboarding do 2Âº Desenvolvedor â€” gtsofthub.com.br (SaaS)
> **Objetivo:** colocar uma segunda pessoa produtiva e segura no projeto, sem comprometer produÃ§Ã£o.
>
> **Regra de ouro:** o dev 2 deve conseguir operar com autonomia, mas com **limites** (princÃ­pio do menor privilÃ©gio).

---

## 1) Acessos (contas e permissÃµes)
### 1.1 RepositÃ³rio e documentaÃ§Ã£o
- Acesso ao repositÃ³rio (leitura/escrita conforme papel).
- Leitura obrigatÃ³ria:
  - `docs/CONSOLIDADO/README.md`
  - `docs/CONSOLIDADO/01-ESTADO-ATUAL.md`
  - `deploy/RUNBOOK-OPERACAO.md`
  - `deploy/README-PRODUCAO.md`
  - `deploy/CHECKLIST-DE-RELEASE.md`

### 1.2 VPS (produÃ§Ã£o)
- Acesso SSH **como `ubuntu`** (nÃ£o root direto).
- ElevaÃ§Ã£o via `sudo -i` (apenas quando necessÃ¡rio).

**RecomendaÃ§Ã£o forte (produÃ§Ã£o):** chaves SSH por usuÃ¡rio (ed25519).  
Se optar por senha, manter fail2ban ativo e limites no `sshd_config`.

---

## Perfil atual do 2Âº dev (iniciante / frontend-only)
> Este projeto tem um 2Âº dev iniciante que vai atuar **apenas no frontend** por enquanto.

### Regras de escopo (obrigatÃ³rias)
- **Pode mexer:** somente `frontend/**` (UI/UX).
- **NÃ£o pode mexer:** `backend/**`, `deploy/**`, `scripts/**`, `scripts/migrations/**`.
- **Sem acesso Ã  produÃ§Ã£o:** sem SSH/VPS, sem `.env`, sem tokens (B2/Telegram/UptimeRobot).

Documento oficial de regras:
- `frontend/CONTRIBUICAO-FRONTEND-INICIANTE.md`

---

## 2) Setup local (Windows/macOS/Linux)
### 2.1 Ferramentas
- Node.js LTS (compatÃ­vel com o projeto)
- Docker Desktop (para Postgres/Redis local)
- Git

### 2.2 Subir ambiente dev
- Documento: `docs/LEGADO/07-setup/COMO-INICIAR-AMBIENTE.md`
- Script recomendado: `DEV-RODAR-TUDO.ps1` (Windows)

### 2.3 PadrÃµes de execuÃ§Ã£o
- Backend: `cd backend && npm run start:dev`
- Frontend: `cd frontend && npm run dev`

---

## 3) PadrÃµes de trabalho (processo)
### 3.1 Branching e revisÃ£o
- Sempre trabalhar em branch (ex.: `feat/...`, `fix/...`).
- PR obrigatÃ³rio para mudanÃ§as significativas (backend/db/prod).
- Revisar:
  - alteraÃ§Ãµes em migrations
  - alteraÃ§Ãµes em autenticaÃ§Ã£o, seguranÃ§a, RLS
  - alteraÃ§Ãµes em `deploy/` e scripts

### 3.2 â€œGatesâ€ antes de merge
Rodar:
- `npm run lint`
- `npm run build`
- `npm run test` (quando houver)
- E2E relevante (WhatsApp/Orders) quando a mudanÃ§a tocar fluxo crÃ­tico

---

## 4) ProduÃ§Ã£o (como operar sem quebrar)
### 4.1 O que NÃƒO fazer
- NÃ£o editar `deploy/.env` sem registrar a mudanÃ§a.
- NÃ£o desativar RLS nem trocar `DB_APP_USER` para superuser.
- NÃ£o abrir portas no firewall sem necessidade.
- NÃ£o expor Swagger externamente.

### 4.2 O que fazer (padrÃ£o)
- Seguir sempre:
  - `deploy/CHECKLIST-DE-RELEASE.md`
  - `deploy/RUNBOOK-OPERACAO.md`

### 4.3 Onde ficam as coisas (no VPS)
- CÃ³digo: `/opt/ucm`
- Env de produÃ§Ã£o: `/opt/ucm/deploy/.env`
- Backups locais: `/opt/ucm/backups`
- Logs:
  - backup local: `/opt/ucm/backups/backup.log`
  - offsite: `/var/log/ucm-backup-offsite.log`
  - restore drill: `/var/log/ucm-restore-drill.log`

---

## 5) Acessos externos (monitoramento e backup)
### 5.1 UptimeRobot
O dev 2 deve ter acesso ao painel do UptimeRobot (pelo menos leitura):
- 4 monitores (site + health/ready/live/health)

### 5.2 Backblaze B2 (offsite)
Recomendado:
- Dev 2 ter acesso **de leitura** ao bucket ou ser capaz de recuperar em incidente.
- A senha do `b2crypt` (crypt) deve estar guardada em gerenciador de senhas da equipe.

---

## 6) Secrets e â€œcomo guardarâ€
**ObrigatÃ³rio:** usar gerenciador de senhas (Bitwarden/1Password).

Itens que devem existir no cofre (sem colar em chat):
- Acesso ao VPS (credenciais/chaves)
- B2 (keyID/appKey) e nome do bucket
- Senha do `b2crypt` (crypt)
- Tokens do Telegram (bot token + chat id)
- Qualquer credencial de provider (pagamentos/WhatsApp etc.)

---

## 7) Incidentes (o que fazer quando cair)
Fluxo curto:
1) Ver UptimeRobot (qual endpoint caiu?)
2) Acessar VPS por SSH
3) `docker ps`
4) `docker logs --tail 200 ucm-backend` e `ucm-nginx`
5) Reiniciar serviÃ§o afetado
6) Confirmar `/api/v1/health/ready`

ReferÃªncia: `deploy/RUNBOOK-OPERACAO.md`

---

## 8) Checklist de primeiro dia (dev 2)
- [ ] Rodou ambiente local com sucesso
- [ ] Conseguiu autenticar e bater health endpoints
- [ ] Leu o runbook e o checklist de release
- [ ] Recebeu acesso ao UptimeRobot
- [ ] Entendeu polÃ­tica de RLS/tenant
- [ ] Consegue rodar backup/restore drill em ambiente controlado

