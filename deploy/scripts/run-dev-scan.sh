#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/opt/ucm-test-repo"
LOG="/tmp/ucm-dev-scan.log"
BASE="https://dev.gtsofthub.com.br/api/v1"
TENANT="00000000-0000-0000-0000-000000000000"
EMAIL="scan+$(date +%s)@exemplo.com"
PASS="12345678"

wait_for_health() {
  local url="$1"
  local name="$2"
  local attempts="${3:-30}"
  local delay="${4:-2}"
  local i code body

  for i in $(seq 1 "$attempts"); do
    body="$(mktemp)"
    code="$(curl -s -o "$body" -w "%{http_code}" "$url" || true)"
    if [ "$code" = "200" ]; then
      cat "$body"
      rm -f "$body"
      return 0
    fi
    echo "Attempt $i/$attempts $name returned $code; retrying in ${delay}s"
    rm -f "$body"
    sleep "$delay"
  done

  echo "ERROR: $name failed after $attempts attempts"
  return 1
}

cd "$ROOT_DIR"
git pull

docker compose --env-file "$ROOT_DIR/deploy/.env" \
  -f "$ROOT_DIR/deploy/docker-compose.test.yml" \
  --project-name ucmtest up -d --build --force-recreate backend frontend

: > "$LOG"
echo "Scan started: $(date -Is)" >> "$LOG"

{
  echo
  echo "==> Health endpoints"
  wait_for_health "$BASE/health" "health"
  curl -i "$BASE/health"
  curl -i "$BASE/health/ready"
  curl -i "$BASE/health/live"
  echo
  echo "==> Containers"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
  echo
  echo "==> Restart counts"
  for c in ucm-backend-test ucm-frontend-test; do
    echo "$c restart=$(docker inspect -f '{{.RestartCount}}' "$c" 2>/dev/null || echo n/a)"
  done
} >> "$LOG" 2>&1

{
  echo
  echo "==> Auth register/login"
  REGISTER_JSON=$(curl -s -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -H "x-tenant-id: $TENANT" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"full_name\":\"Scan Dev\"}")
  echo "$REGISTER_JSON"

  TOKEN=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('access_token',''))" <<< "$REGISTER_JSON")
  echo "TOKEN=${TOKEN:0:24}..."

  echo
  echo "==> Auth me"
  curl -s -H "Authorization: Bearer $TOKEN" "$BASE/auth/me"
} >> "$LOG" 2>&1

{
  echo
  echo "==> Products CRUD + stock"
  PROD_JSON=$(curl -s -X POST "$BASE/products" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Produto Scan\",\"price\":10.5,\"description\":\"Teste\",\"unit\":\"un\"}")
  echo "$PROD_JSON"

  PROD_ID=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" <<< "$PROD_JSON")
  echo "PROD_ID=$PROD_ID"

  curl -s "$BASE/products/$PROD_ID" -H "Authorization: Bearer $TOKEN"
  curl -s -X POST "$BASE/products/$PROD_ID/adjust-stock" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"quantity\":10,\"reason\":\"scan\"}"
  curl -s "$BASE/products/stock-summary" -H "Authorization: Bearer $TOKEN"
  curl -s "$BASE/products/search?q=Scan" -H "Authorization: Bearer $TOKEN"

  curl -s -X PATCH "$BASE/products/$PROD_ID/min-stock" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"min_stock\":2}"

  curl -s -X POST "$BASE/products/$PROD_ID/reserve" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"quantity\":2}"
  curl -s -X POST "$BASE/products/$PROD_ID/release" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"quantity\":2}"
} >> "$LOG" 2>&1

{
  echo
  echo "==> Orders flow"
  ORDER_JSON=$(curl -s -X POST "$BASE/orders" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"channel\":\"pdv\",\"customer_name\":\"Cliente Scan\",\"items\":[{\"produto_id\":\"$PROD_ID\",\"quantity\":2,\"unit_price\":10.5}],\"discount_amount\":0,\"shipping_amount\":0}")
  echo "$ORDER_JSON"

  ORDER_ID=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" <<< "$ORDER_JSON")
  echo "ORDER_ID=$ORDER_ID"

  curl -s "$BASE/orders/$ORDER_ID" -H "Authorization: Bearer $TOKEN"

  echo
  echo "==> Payments (pix)"
  PAY_JSON=$(curl -s -X POST "$BASE/payments" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"pedido_id\":\"$ORDER_ID\",\"method\":\"pix\"}")
  echo "$PAY_JSON"

  PAY_ID=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" <<< "$PAY_JSON" 2>/dev/null || true)
  echo "PAY_ID=$PAY_ID"
  curl -s "$BASE/payments/pedido/$ORDER_ID" -H "Authorization: Bearer $TOKEN"

  echo
  echo "==> Orders status (opcional apos pagamento)"
  curl -s -X PATCH "$BASE/orders/$ORDER_ID/status" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"status\":\"confirmado\"}"

  curl -s "$BASE/orders/reports/sales" -H "Authorization: Bearer $TOKEN"

  echo
  echo "==> Coupons dev/upsert"
  curl -s -X POST "$BASE/coupons/dev/upsert" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"code\":\"SCAN10\",\"discount_type\":\"percentage\",\"discount_value\":10}"

  echo
  echo "==> WhatsApp"
  curl -s "$BASE/whatsapp/health"
  curl -s -X POST "$BASE/whatsapp/test" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"Teste scan\",\"tenantId\":\"$TENANT\",\"phoneNumber\":\"5511999999999\"}"
} >> "$LOG" 2>&1

{
  echo
  echo "==> Logs (last 200)"
  docker logs --tail 200 ucm-nginx
  docker logs --tail 200 ucm-backend-test
  echo
  echo "==> Scan finished: $(date -Is)"
} >> "$LOG" 2>&1

tail -n 80 "$LOG"
