# Onboarding do 2º Desenvolvedor — gtsofthub.com.br (SaaS)
> **Objetivo:** colocar uma segunda pessoa produtiva e segura no projeto, sem comprometer produção.
>
> **Regra de ouro:** o dev 2 deve conseguir operar com autonomia, mas com **limites** (princípio do menor privilégio).

---

## 1) Acessos (contas e permissões)
### 1.1 Repositório e documentação
- Acesso ao repositório (leitura/escrita conforme papel).
- Leitura obrigatória:
  - `docs/00-projeto/00-DOCUMENTO-MESTRE-LEIA-PRIMEIRO.md`
  - `docs/00-projeto/RELATORIO-COMPLETO-DO-PROJETO-2026.md`
  - `deploy/RUNBOOK-OPERACAO.md`
  - `deploy/README-PRODUCAO.md`
  - `deploy/CHECKLIST-DE-RELEASE.md`

### 1.2 VPS (produção)
- Acesso SSH **como `ubuntu`** (não root direto).
- Elevação via `sudo -i` (apenas quando necessário).

**Recomendação forte (produção):** chaves SSH por usuário (ed25519).  
Se optar por senha, manter fail2ban ativo e limites no `sshd_config`.

---

## Perfil atual do 2º dev (iniciante / frontend-only)
> Este projeto tem um 2º dev iniciante que vai atuar **apenas no frontend** por enquanto.

### Regras de escopo (obrigatórias)
- **Pode mexer:** somente `frontend/**` (UI/UX).
- **Não pode mexer:** `backend/**`, `deploy/**`, `scripts/**`, `scripts/migrations/**`.
- **Sem acesso à produção:** sem SSH/VPS, sem `env.prod`, sem tokens (B2/Telegram/UptimeRobot).

Documento oficial de regras:
- `frontend/CONTRIBUICAO-FRONTEND-INICIANTE.md`

---

## 2) Setup local (Windows/macOS/Linux)
### 2.1 Ferramentas
- Node.js LTS (compatível com o projeto)
- Docker Desktop (para Postgres/Redis local)
- Git

### 2.2 Subir ambiente dev
- Documento: `COMO-INICIAR-AMBIENTE.md`
- Script recomendado: `DEV-RODAR-TUDO.ps1` (Windows)

### 2.3 Padrões de execução
- Backend: `cd backend && npm run start:dev`
- Frontend: `cd frontend && npm run dev`

---

## 3) Padrões de trabalho (processo)
### 3.1 Branching e revisão
- Sempre trabalhar em branch (ex.: `feat/...`, `fix/...`).
- PR obrigatório para mudanças significativas (backend/db/prod).
- Revisar:
  - alterações em migrations
  - alterações em autenticação, segurança, RLS
  - alterações em `deploy/` e scripts

### 3.2 “Gates” antes de merge
Rodar:
- `npm run lint`
- `npm run build`
- `npm run test` (quando houver)
- E2E relevante (WhatsApp/Orders) quando a mudança tocar fluxo crítico

---

## 4) Produção (como operar sem quebrar)
### 4.1 O que NÃO fazer
- Não editar `deploy/env.prod` sem registrar a mudança.
- Não desativar RLS nem trocar `DB_APP_USER` para superuser.
- Não abrir portas no firewall sem necessidade.
- Não expor Swagger externamente.

### 4.2 O que fazer (padrão)
- Seguir sempre:
  - `deploy/CHECKLIST-DE-RELEASE.md`
  - `deploy/RUNBOOK-OPERACAO.md`

### 4.3 Onde ficam as coisas (no VPS)
- Código: `/opt/ucm`
- Env de produção: `/opt/ucm/deploy/env.prod`
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

## 6) Secrets e “como guardar”
**Obrigatório:** usar gerenciador de senhas (Bitwarden/1Password).

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
5) Reiniciar serviço afetado
6) Confirmar `/api/v1/health/ready`

Referência: `deploy/RUNBOOK-OPERACAO.md`

---

## 8) Checklist de primeiro dia (dev 2)
- [ ] Rodou ambiente local com sucesso
- [ ] Conseguiu autenticar e bater health endpoints
- [ ] Leu o runbook e o checklist de release
- [ ] Recebeu acesso ao UptimeRobot
- [ ] Entendeu política de RLS/tenant
- [ ] Consegue rodar backup/restore drill em ambiente controlado

