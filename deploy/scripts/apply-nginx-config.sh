#!/usr/bin/env bash
set -euo pipefail

# Apply repo nginx config to VPS and reload container.
# Usage: sudo -i; /opt/ucm/deploy/scripts/apply-nginx-config.sh

repo_root="/opt/ucm"
src="${repo_root}/deploy/nginx/ucm.conf"
dst="/opt/ucm/deploy/nginx/ucm.conf"

if [ ! -f "$src" ]; then
  echo "Missing source config: $src" >&2
  exit 1
fi

mkdir -p "$(dirname "$dst")"
if [ -f "$dst" ]; then
  cp "$dst" "${dst}.bak.$(date +%Y%m%d-%H%M%S)"
fi

if [ "$(readlink -f "$src")" != "$(readlink -f "$dst")" ]; then
  cp "$src" "$dst"
fi

docker exec ucm-nginx nginx -t
docker exec ucm-nginx nginx -s reload
echo "Nginx config applied."
