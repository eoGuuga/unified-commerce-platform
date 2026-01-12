# ANALISE DE PERFEICAO E PLANO MESTRE (UCM)

Objetivo: deixar o projeto em um nivel de "perfeicao bizarra" comprovavel, com evidencias tecnicas, testes repetiveis e operacao robusta.

Este documento consolida o que ja foi feito, o que esta incerto ou faltando, e um plano de execucao com gates claros.

---

## 1) O que esta excelente (base forte)

Produto e stack
- Core definido com zero overselling (transacoes ACID + locks).
- Multi-tenancy documentado com RLS, policies e interceptor.
- Stack consistente: NestJS + Next.js + Postgres + Redis.
- Documentacao extensa e organizada.

Backend
- Rate limiting, health checks e exception filter globais.
- Idempotencia, audit log e cache descritos como implementados.
- N+1 e performance citados como corrigidos.
- Swagger completo e endpoints bem definidos.

Operacao
- Runbook de producao com comandos padrao.
- Backup local + offsite e restore drill mensal.
- Nginx e SSL com Lets Encrypt.

Servidor
- SSH root bloqueado, auth por chave.
- UFW com portas minimas.
- Fail2ban ativo e sysctl hardening basico.

---

## 2) O que esta errado, inconsistente ou sem evidencia

Inconsistencias entre documentos
- RLS e migration: alguns docs dizem "precisa executar", outros dizem "executado". Precisamos de evidencia real (psql + logs).
- CSRF: criado mas nao ativado; risco depende do modelo de auth no frontend.
- Status de fases: "FASE 3 pronta" em alguns locais vs "FASE 3 proxima".

Risco alto: segredos expostos em docs
- `docs/15-servidor/SERVIDOR-HARDENED-ROOT.md` contem senha de sudo. Isso e uma falha critica. Deve ser removido e credenciais rotacionadas.

Codificacao quebrada em varios docs
- Muitos arquivos aparecem com caracteres corrompidos. Isso reduz confianca e dificulta manutencao.

Auditoria real nao comprovada
- Existe audit log descrito, mas nao ha evidencias registradas ou testes oficiais anexos.

Testes declarados sem relatórios
- Ha documentos de testes, mas nao encontrei saidas reais (JUnit/coverage) anexadas.

Duplicacao de fontes
- Existe pasta `deploy/` e outra `unified-commerce-platform/infrastructure/deploy`. Precisamos definir uma fonte canonica.

---

## 3) Analise do servidor (com base nos docs)

Pontos bons
- Acesso root bloqueado via SSH.
- Firewall restritivo (22/80/443).
- Fail2ban e sysctl hardening basico.
- Backup local e offsite com restore drill.

Lacunas a confirmar com acesso real
- Estado do OS (patch level, unattended upgrades).
- Config de SSH (ciphers, Kex, PermitRootLogin, AllowUsers).
- Nginx TLS hardening (TLS1.2/1.3, HSTS, OCSP).
- Docker hardening (userns, rootless, capabilities, seccomp).
- Logs e rotacao (docker logs, nginx, app).
- Monitoramento real (UptimeRobot, alertas).
- Segregacao de rede e exposicao de portas internas.
- Integridade dos backups (restore validado, checksums).

---

## 4) Plano mestre (por fases e gates)

FASE A - Consistencia e saneamento (1 semana)
Gates:
- Documentos em UTF-8 e sem caracteres quebrados.
- Unica fonte de verdade para deploy e runbook.
- Remocao de segredos do repo e rotacao completa.

Acoes:
- Normalizar encoding dos docs criticos.
- Definir "docs canonicos" e arquivar duplicados.
- Remover senha de sudo dos docs; rotacionar credenciais.

Status atual (feito nesta sessao):
- Senha de sudo removida da documentacao; falta rotacionar no servidor.
- Auditoria inicial do servidor documentada em `docs/15-servidor/AUDITORIA-2026-01-12.md`.
- Hardening aplicado: SSH sem senha + X11 off + rate limit UFW + TLS headers + backups/restore drill com log.

FASE B - Evidencias e confiabilidade (1 a 2 semanas)
Gates:
- Relatorio de testes com cobertura real.
- Evidencia de RLS ativo e policies corretas.
- Logs de audit log gerados e verificados.

Acoes:
- Executar testes unit/integration e gerar reports.
- Criar script de validacao RLS (tenant A nao ve tenant B).
- Criar teste de idempotencia e corrida de estoque.

FASE C - Seguranca aplicacional (1 semana)
Gates:
- Threat model documentado (assets, trust boundaries).
- CSRF decidido e implementado se aplicavel.
- CORS e headers de seguranca validados (CSP, HSTS).

Acoes:
- Revisar modelo de auth (cookie vs bearer).
- Ajustar middlewares e headers.
- Rodar checklist OWASP top 10.

FASE D - Observabilidade e operacao (1 semana)
Gates:
- Logs estruturados com request id.
- Dashboards e alertas basicos ativos.
- Runbook com planos de rollback e incidentes.

Acoes:
- Padronizar logs (backend + nginx).
- Alertas de health e backup.
- Simular incidente e registrar postmortem.

FASE E - Performance e resiliencia (1 a 2 semanas)
Gates:
- SLO definido (latencia, disponibilidade).
- Teste de carga com resultados.
- Circuit breaker e retry para integracoes externas.

Acoes:
- Benchmark de endpoints criticos.
- Cache com politicas claras e invalidadas.
- Rate limit e timeouts revisados.

---

## 5) Checklist de auditoria do servidor (para executar via SSH)

Comandos base (rodar no VPS)
```
uname -a
lsb_release -a
uptime
ufw status verbose
ss -tulpn
systemctl status ssh
grep -E "PermitRootLogin|PasswordAuthentication|PubkeyAuthentication" /etc/ssh/sshd_config
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker exec ucm-nginx nginx -T | head -n 120
docker logs --tail 200 ucm-backend
```

Evidencias esperadas
- Apenas portas 22/80/443 abertas publicamente.
- Nginx com TLS 1.2/1.3 e HSTS.
- Containers sem portas internas expostas ao host.
- Backup e restore logs sem falhas.

---

## 6) Entregaveis finais (resultado "perfeito")

- Relatorio consolidado com evidencias (testes, RLS, audit, backups).
- Documentacao 100% limpa e consistente.
- Servidor auditado com checklist e evidencias.
- Roadmap com gates objetivos para novas features.

---

## 7) Proximos passos imediatos (decisao sua)

1) Eu gero o documento "Auditoria do Servidor" com checklists e ja preparo scripts de verificacao.
2) Eu normalizo os docs (encoding + segredos) e marco uma fonte canonica.
3) Eu começo a executar testes e gerar relatorios reais (backend + frontend).

Responda com 1, 2 ou 3 para comecarmos.
