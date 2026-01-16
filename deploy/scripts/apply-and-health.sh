#!/usr/bin/env bash
set -euo pipefail

# One-shot sync + nginx apply + health check (prod + dev).
# Usage: sudo -i; /opt/ucm/deploy/scripts/apply-and-health.sh

repo_root="/opt/ucm"
health_urls=(
  "https://gtsofthub.com.br/api/v1/health"
  "https://dev.gtsofthub.com.br/api/v1/health"
)

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

check_health() {
  local url="$1"
  local attempts=12
  local delay=5
  local ok=1
  local tmp
  tmp="$(mktemp)"

  for i in $(seq 1 "$attempts"); do
    code="$(curl -k -sS -o "$tmp" -w "%{http_code}" "$url" || true)"
    if [ "$code" = "200" ]; then
      ok=0
      break
    fi
    sleep "$delay"
  done

  echo "--> $url"
  cat "$tmp"
  rm -f "$tmp"

  if [ "$ok" -ne 0 ]; then
    echo "Health failed for $url" >&2
    return 1
  fi
}

if [ ! -d "$repo_root/.git" ]; then
  echo "Repo not found at $repo_root" >&2
  exit 1
fi

require_cmd git
require_cmd docker
require_cmd curl

cd "$repo_root"
git pull --ff-only

chmod +x /opt/ucm/deploy/scripts/apply-nginx-config.sh
chmod +x /opt/ucm/deploy/scripts/fix-prod-dev-health.sh

/opt/ucm/deploy/scripts/apply-nginx-config.sh
RESET_REDIS=0 /opt/ucm/deploy/scripts/fix-prod-dev-health.sh

echo "==> Health (prod/dev)"
for target in "${health_urls[@]}"; do
  check_health "$target"
done
