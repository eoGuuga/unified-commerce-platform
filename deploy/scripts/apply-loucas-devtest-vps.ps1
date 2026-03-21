param(
  [string]$ServerHost = "37.59.118.210",
  [string]$User = "ubuntu",
  [string]$KeyPath = "$HOME\.ssh\ucm_ovh_ed25519",
  [string]$RepoPath = "/opt/ucm-test-repo",
  [string]$EvolutionApiKey,
  [string]$EvolutionInstance = "loucas-teste"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $EvolutionApiKey) {
  throw "Informe -EvolutionApiKey para configurar o Evolution API no VPS."
}

if (-not (Test-Path -LiteralPath $KeyPath)) {
  throw "Chave SSH nao encontrada em: $KeyPath"
}

$remoteScript = @'
set -euo pipefail

REPO_PATH="$1"
EVOLUTION_API_KEY_VALUE="$2"
EVOLUTION_INSTANCE_VALUE="$3"

cd "$REPO_PATH"

upsert_env() {
  local file="$1"
  local key="$2"
  local value="$3"

  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

set -a
source deploy/.env
set +a

EVOLUTION_DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/evolution?schema=public"
EVOLUTION_REDIS_URL="redis://:${REDIS_PASSWORD}@redis:6379/6"

test -f deploy/evolution.test.env || cp deploy/evolution.test.env.example deploy/evolution.test.env

upsert_env deploy/evolution.test.env AUTHENTICATION_API_KEY "$EVOLUTION_API_KEY_VALUE"
upsert_env deploy/evolution.test.env SERVER_URL "https://dev.gtsofthub.com.br"
upsert_env deploy/evolution.test.env LOG_LEVEL "ERROR,WARN"
upsert_env deploy/evolution.test.env DATABASE_ENABLED "true"
upsert_env deploy/evolution.test.env DATABASE_PROVIDER "postgresql"
upsert_env deploy/evolution.test.env DATABASE_CONNECTION_URI "$EVOLUTION_DATABASE_URL"
upsert_env deploy/evolution.test.env DATABASE_CONNECTION_CLIENT_NAME "evolution_ucmtest"
upsert_env deploy/evolution.test.env DATABASE_SAVE_DATA_INSTANCE "true"
upsert_env deploy/evolution.test.env DATABASE_SAVE_DATA_NEW_MESSAGE "true"
upsert_env deploy/evolution.test.env DATABASE_SAVE_MESSAGE_UPDATE "true"
upsert_env deploy/evolution.test.env DATABASE_SAVE_DATA_CONTACTS "false"
upsert_env deploy/evolution.test.env DATABASE_SAVE_DATA_CHATS "false"
upsert_env deploy/evolution.test.env CACHE_REDIS_ENABLED "true"
upsert_env deploy/evolution.test.env CACHE_REDIS_URI "$EVOLUTION_REDIS_URL"
upsert_env deploy/evolution.test.env CACHE_REDIS_PREFIX_KEY "evolution"

upsert_env deploy/.env WHATSAPP_PROVIDER "evolution"
upsert_env deploy/.env EVOLUTION_API_URL "http://evolution-api:8080"
upsert_env deploy/.env EVOLUTION_API_KEY "$EVOLUTION_API_KEY_VALUE"
upsert_env deploy/.env EVOLUTION_INSTANCE "$EVOLUTION_INSTANCE_VALUE"

docker exec ucm-postgres-test psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'evolution'" | grep -q 1 || \
  docker exec ucm-postgres-test psql -U postgres -c "CREATE DATABASE evolution"

bash deploy/scripts/setup-evolution-test.sh
bash deploy/scripts/apply-loucas-phase1-devtest.sh
bash deploy/scripts/configure-evolution-instance.sh

echo ""
echo "HEAD:"
git rev-parse --short HEAD
echo ""
echo "HEALTH:"
curl -fsS "https://dev.gtsofthub.com.br/api/v1/health"
echo ""
echo "WHATSAPP HEALTH:"
curl -fsS "https://dev.gtsofthub.com.br/api/v1/whatsapp/health"
'@

$sshArgs = @(
  "-i", $KeyPath,
  "$User@$ServerHost",
  "bash -s -- '$RepoPath' '$EvolutionApiKey' '$EvolutionInstance'"
)

$remoteScript | & ssh @sshArgs
