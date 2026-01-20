#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "==> Atualizando repo"
git -C "$ROOT_DIR" pull

echo "==> Preparando scripts"
chmod +x \
  "$ROOT_DIR/deploy/scripts/bootstrap-dev.sh" \
  "$ROOT_DIR/deploy/scripts/seed-test-tenant.sh" \
  "$ROOT_DIR/deploy/scripts/seed-dev-data.sh" \
  "$ROOT_DIR/deploy/scripts/run-dev-smoke.sh"

echo "==> Bootstrap dev"
"$ROOT_DIR/deploy/scripts/bootstrap-dev.sh"

echo "Dev up OK."
