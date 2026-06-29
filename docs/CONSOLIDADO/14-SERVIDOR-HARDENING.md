# Postura de Segurança do Servidor (Hardening)

> Este documento registra **COMO** o servidor de produção está endurecido — a
> **política**, não o **onde** nem o **com que credencial**. Valores reais (IP,
> domínios, credenciais, chaves) **não entram neste repositório**: ficam no
> gerenciador de senhas / doc privado. Placeholders usados: `<IP_DO_SERVIDOR>`,
> `<DOMINIO_PROD>`, `<DOMINIO_DEV>`.
>
> Consolidado de `SERVIDOR-HARDENED-ROOT.md` + `AUDITORIA-2026-01-12.md` (jan/2026).
> Para a auditoria mais recente e o plano de ação, ver `12-AUDITORIA-2026-05-20.md`.

## SSH
- `PermitRootLogin no` — root não loga direto.
- **Autenticação por chave pública** (`AuthenticationMethods publickey`, `PubkeyAuthentication yes`).
- `KbdInteractiveAuthentication no`, `ChallengeResponseAuthentication no`.
- `X11Forwarding no` (remove superfície extra).
- ⚠️ **Hardening pendente recomendado — `PasswordAuthentication no`:** o alvo é
  desabilitar login por senha. Houve historicamente uma **divergência** entre o
  `sshd_config` e o comportamento **efetivo** (login por senha ainda aceito por
  override em `sshd_config.d`). Hoje o login por senha pode estar **ainda
  habilitado** — **endurecer para `no` é melhoria pendente.** Sempre verificar o
  estado **efetivo**, não só o arquivo.

**Validar (estado efetivo):**
```bash
sshd -T | egrep -i 'permitrootlogin|passwordauthentication|kbdinteractiveauthentication|x11forwarding|authenticationmethods'
grep -nE 'PasswordAuthentication|PermitRootLogin|X11Forwarding' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf
```

## Firewall (UFW) + Fail2ban
- **UFW:** default **deny** (incoming); libera **apenas 22/80/443**; **rate-limit** em `22/tcp`.
- **Fail2ban:** ativo para `sshd` (bloqueia brute-force de SSH).
- Serviços internos (Postgres/Redis) escutam só em localhost/rede interna — **nunca** expostos em porta pública (ver o compose canônico em `deploy/docker-compose.prod.yml`).

**Validar:**
```bash
ufw status verbose
fail2ban-client status sshd
ss -tulpn   # confirmar que só 22/80/443 são públicas; DB/Redis internos
```

## TLS (Nginx)
- `ssl_protocols TLSv1.2 TLSv1.3`; **HSTS** habilitado; ciphers endurecidos.
- Certificados Let's Encrypt montados **read-only** no container (`/etc/letsencrypt:/etc/letsencrypt:ro`).
- **Pendente:** OCSP stapling (warning conhecido — certificado sem OCSP URL).

**Validar:**
```bash
docker exec <container-nginx> nginx -T | egrep -n 'ssl_protocols|ssl_ciphers|add_header'
certbot renew --dry-run
```

## Backups
- **Local diário** + **offsite criptografado** (rclone/B2) + **restore drill mensal** (com log, cron e logrotate configurados).
- **RPO atual ~24h.** Melhoria futura: reduzir para ~6h ou WAL archiving (ver `12-AUDITORIA`).

## Atualizações do SO
- `unattended-upgrades` ativo (patches de segurança automáticos).

## Melhorias de hardening pendentes (resumo — ver `12-AUDITORIA` para o plano completo)
- **`PasswordAuthentication no`** (acima) — desabilitar login por senha de fato.
- **Containers como non-root** — hoje rodam como root; adicionar `user:` no compose.
- **OCSP stapling** no nginx.
- **Monitoramento externo** (uptime) + **alertas** de falha de backup/deploy — gap operacional (sem visibilidade de queda hoje).

---

## Nota de segredos (regra do repositório)
Este repositório é **público**. Endereços de produção (IP, domínios), credenciais,
chaves e senhas **não** entram em arquivo versionado — nem aqui, nem em commit que
depois seria "removido". Onde um valor real seria necessário, use placeholder
(`<IP_DO_SERVIDOR>`, `<DOMINIO_PROD>`) e mantenha o valor real fora do repo
(gerenciador de senhas / doc privado).
