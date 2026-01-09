#!/usr/bin/env bash
set -euo pipefail

# Hardening pos-deploy (idempotente)
# Uso (no VPS, como root):
#   cd /opt/ucm
#   dos2unix deploy/scripts/*.sh
#   chmod +x deploy/scripts/*.sh
#   bash deploy/scripts/post-deploy-hardening.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERRO: rode como root (sudo -i)."
  exit 1
fi

echo "== Permissoes de segredos =="
if [[ -f "./deploy/env.prod" ]]; then
  chmod 600 "./deploy/env.prod" || true
  chown root:root "./deploy/env.prod" || true
fi

echo "== UFW (22/80 apenas; 443 fica fechado ate SSL) =="
apt-get update -y
apt-get install -y ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw --force enable
ufw status verbose || true

echo "== Cron backup (root) com log =="
mkdir -p /opt/ucm/backups
touch /opt/ucm/backups/backup.log
chmod 600 /opt/ucm/backups/backup.log || true

CRON_LINE="0 3 * * * cd /opt/ucm && bash deploy/scripts/backup-postgres.sh >> /opt/ucm/backups/backup.log 2>&1"
(crontab -l 2>/dev/null | grep -Fv "deploy/scripts/backup-postgres.sh" || true; echo "${CRON_LINE}") | crontab -

echo "== Unattended upgrades (patches automaticos) =="
apt-get install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades || true
systemctl enable --now unattended-upgrades || true

echo "== Fail2ban (SSH) =="
apt-get install -y fail2ban
cat >/etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

echo "OK: hardening aplicado."
