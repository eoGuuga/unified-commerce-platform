#!/usr/bin/env bash
# Testes do offsite-freshness-check.sh (dead-man's switch) — SANDBOX com `rclone`
# FALSO e notificador FALSO (sem servidor, sem B2, sem Telegram, sem credencial).
# Prova os TRÊS estados: fresco→silêncio, velho→alerta, NÃO-SEI→alerta (fail-closed).
#
# Rodar: bash deploy/scripts/test/offsite-freshness.test.sh
set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK="${TEST_DIR}/../offsite-freshness-check.sh"

PASS=0; FAIL=0
ok()  { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }

# Sandbox: `rclone` falso (lsf controlável via env) + notificador falso (loga a msg).
new_sandbox() {
  SB="$(mktemp -d)"
  mkdir -p "$SB/bin" "$SB/log" "$SB/state"
  cat > "$SB/bin/rclone" <<'STUB'
#!/usr/bin/env bash
if [ "$1" = "lsf" ]; then
  [ "${FAKE_LSF_RC:-0}" -ne 0 ] && exit "${FAKE_LSF_RC}"
  if [ -n "${FAKE_LSF_OUT:-}" ]; then printf '%s\n' "${FAKE_LSF_OUT}"; fi
  exit 0
fi
exit 0
STUB
  chmod +x "$SB/bin/rclone"
  # notificador falso: registra CADA envio (uma linha por alerta enviado).
  cat > "$SB/bin/fake-notify" <<'STUB'
#!/usr/bin/env bash
echo "NOTIFY: $*" >> "$NOTIFY_LOG"
STUB
  chmod +x "$SB/bin/fake-notify"
  # .env falso com TELEGRAM_* (não-segredo, só pra o grep-de-2-vars achar)
  printf 'TELEGRAM_BOT_TOKEN=faketok\nTELEGRAM_CHAT_ID=fakechat\n' > "$SB/fake.env"

  export PATH="$SB/bin:$PATH"
  export FRESHNESS_LOG="$SB/log/freshness.log"
  export FRESHNESS_STATE="$SB/state/last"
  export FRESHNESS_NOTIFY="$SB/bin/fake-notify"
  export ENV_FILE="$SB/fake.env"
  export NOTIFY_LOG="$SB/notify.log"; : > "$NOTIFY_LOG"
  export REMOTE="faketest:"
  unset FAKE_LSF_RC FAKE_LSF_OUT
}

# timestamp "N horas atrás" no MESMO formato/tz que o script parseia (auto-consistente).
ago() { date -d "$1 hours ago" '+%Y-%m-%d %H:%M:%S'; }
run() { ( bash "$CHECK" ) >/dev/null 2>&1; return $?; }
notify_count() { [ -f "$NOTIFY_LOG" ] && wc -l < "$NOTIFY_LOG" | tr -d ' ' || echo 0; }
notify_has() { grep -qi "$1" "$NOTIFY_LOG" 2>/dev/null; }

echo "== 1: upload RECENTE (1h) → silêncio =="
{
  new_sandbox
  export FAKE_LSF_OUT="$(ago 1)|ucm-recente.sql.gz"
  run; rc=$?
  [ "$rc" -eq 0 ] && ok "exit 0 (fresco)" || bad "exit $rc no fresco"
  [ "$(notify_count)" -eq 0 ] && ok "não alertou" || bad "alertou no fresco"
}

echo "== 2: upload VELHO (31h) → alerta 'atrasado' =="
{
  new_sandbox
  export FAKE_LSF_OUT="$(ago 31)|ucm-velho.sql.gz"
  run; rc=$?
  [ "$rc" -ne 0 ] && ok "exit != 0 (problema detectado)" || bad "exit 0 com backup velho"
  { [ "$(notify_count)" -eq 1 ] && notify_has "atrasad"; } && ok "alertou 'atrasado'" || bad "não alertou 'atrasado'"
  notify_has "31h" && ok "mensagem traz a idade (31h)" || bad "sem idade na mensagem"
}

echo "== 3: rclone rc != 0 → alerta 'não-sei' (o buraco do desenho de 2 estados) =="
{
  new_sandbox
  export FAKE_LSF_RC=7
  run; rc=$?
  [ "$rc" -ne 0 ] && ok "exit != 0" || bad "exit 0 com rclone falhando (SILÊNCIO — o bug)"
  { [ "$(notify_count)" -eq 1 ] && notify_has "desconhecid"; } && ok "alertou estado desconhecido" || bad "não alertou no rc!=0"
}

echo "== 4: saída VAZIA (nenhum backup listado) → alerta 'não-sei' =="
{
  new_sandbox
  export FAKE_LSF_OUT=""      # lista vazia
  run; rc=$?
  [ "$rc" -ne 0 ] && ok "exit != 0" || bad "exit 0 com lista vazia (SILÊNCIO)"
  { [ "$(notify_count)" -eq 1 ] && notify_has "desconhecid\|vazia"; } && ok "alertou lista vazia" || bad "não alertou na lista vazia"
}

echo "== 5: timestamp CORROMPIDO → alerta 'não-sei' =="
{
  new_sandbox
  export FAKE_LSF_OUT="isto-nao-e-data|ucm-x.sql.gz"
  run; rc=$?
  [ "$rc" -ne 0 ] && ok "exit != 0" || bad "exit 0 com timestamp ilegível (SILÊNCIO)"
  { [ "$(notify_count)" -eq 1 ] && notify_has "desconhecid\|ileg"; } && ok "alertou timestamp ilegível" || bad "não alertou no timestamp ruim"
}

echo "== 6: anti-flood — 2 runs velhos seguidos → 1 alerta só no dia =="
{
  new_sandbox
  export FAKE_LSF_OUT="$(ago 40)|ucm-velho.sql.gz"
  run; run   # dois runs no mesmo "dia", mesmo STATE_FILE
  [ "$(notify_count)" -eq 1 ] && ok "1 alerta em 2 runs (anti-flood)" || bad "$(notify_count) alertas em 2 runs (flood)"
}

echo
echo "RESULTADO: ${PASS} passou, ${FAIL} falhou"
[ "$FAIL" -eq 0 ]
