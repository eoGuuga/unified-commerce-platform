#!/usr/bin/env bash
set -euo pipefail

# One-shot sync + nginx apply + health check (prod + dev).
# Usage: sudo -i; /opt/ucm/deploy/scripts/apply-and-health.sh

repo_root="/opt/ucm"

if [ ! -d "$repo_root/.git" ]; then
  echo "Repo not found at $repo_root" >&2
  exit 1
fi

cd "$repo_root"
git pull

chmod +x /opt/ucm/deploy/scripts/apply-nginx-config.sh
chmod +x /opt/ucm/deploy/scripts/fix-prod-dev-health.sh

/opt/ucm/deploy/scripts/apply-nginx-config.sh
RESET_REDIS=0 /opt/ucm/deploy/scripts/fix-prod-dev-health.sh

echo "==> Health (prod/dev)"
for target in "https://gtsofthub.com.br/api/v1/health" "https://dev.gtsofthub.com.br/api/v1/health"; do
  echo "--> $target"
  for i in {1..6}; do
    if curl -fsS "$target" >/dev/null; then
      break
    fi
    sleep 5
  done
  curl -i "$target" || true
done
