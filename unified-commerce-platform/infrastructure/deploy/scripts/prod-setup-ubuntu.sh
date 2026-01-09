#!/usr/bin/env bash
set -euo pipefail

# UCM - Setup inicial em Ubuntu (VPS)
# Uso: sudo bash deploy/scripts/prod-setup-ubuntu.sh

if [[ $EUID -ne 0 ]]; then
  echo "Rode como root: sudo bash $0"
  exit 1
fi

apt-get update -y
apt-get install -y ca-certificates curl gnupg ufw

# Docker (repo oficial)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

# Firewall básico
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "OK. Docker + UFW instalados."
echo "Proximo passo: coloque o projeto em /opt/ucm e rode o deploy (ver deploy/README-PRODUCAO.md)."

