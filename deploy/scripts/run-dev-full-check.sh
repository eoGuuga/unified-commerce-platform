#!/usr/bin/env bash
set -euo pipefail

# Execucao completa do ambiente dev/test:
# - bootstrap (migrations + seed + smoke + WhatsApp E2E)
# - testes backend (unit + integration + acid)
# Uso: bash deploy/scripts/run-dev-full-check.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"${ROOT_DIR}/deploy/scripts/bootstrap-dev.sh"
"${ROOT_DIR}/deploy/scripts/run-backend-all-tests.sh"

echo "Full check dev OK."
