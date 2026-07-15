#!/usr/bin/env bash
# Testes do backup-offsite.sh — SANDBOX com `rclone` FALSO (sem servidor, sem B2,
# sem credencial). Prova o comportamento observável: de onde ele copia, e se
# falha ALTO quando a poda de retenção quebra.
#
# Rodar: bash deploy/scripts/test/offsite.test.sh
# (Não instala nada, não toca o servidor; a única dependência externa do script
#  sob teste é o `rclone`, que aqui é um stub que loga os args.)
set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OFFSITE="${TEST_DIR}/../backup-offsite.sh"
REPO_ROOT="$(cd "${TEST_DIR}/../../.." && pwd)"
EXPECTED_BACKUP_DIR="${REPO_ROOT}/backups"

PASS=0
FAIL=0
ok()  { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }

# Cria um sandbox com `rclone` falso no PATH. O stub loga cada chamada e pode
# ser instruído a falhar em `copy`/`delete` via env (FAKE_RCLONE_*_RC).
new_sandbox() {
  SB="$(mktemp -d)"
  mkdir -p "$SB/bin" "$SB/backups" "$SB/log"
  cat > "$SB/bin/rclone" <<'STUB'
#!/usr/bin/env bash
echo "rclone $*" >> "$RCLONE_LOG"
case "$1" in
  copy)   exit "${FAKE_RCLONE_COPY_RC:-0}" ;;
  delete) exit "${FAKE_RCLONE_DELETE_RC:-0}" ;;
  *)      exit 0 ;;
esac
STUB
  chmod +x "$SB/bin/rclone"
  export RCLONE_LOG="$SB/rclone.log"; : > "$RCLONE_LOG"
  export OFFSITE_LOG="$SB/log/offsite.log"
  export PATH="$SB/bin:$PATH"
}

run_offsite() { # roda o script sob teste no sandbox; devolve o exit code
  ( bash "$OFFSITE" ) >/dev/null 2>&1
}

echo "== Teste 1: PATH DERIVADO (não pode apontar pro /opt/ucm morto) =="
{
  new_sandbox
  unset BACKUP_DIR                # testa o DEFAULT (o bug do path velho)
  export REMOTE="faketest:"
  run_offsite
  copy_line="$(grep '^rclone copy' "$RCLONE_LOG" | head -1)"
  # grep -F (não awk): o caminho pode conter espaços (ex.: dev em "Projeto sas").
  if echo "$copy_line" | grep -q '/opt/ucm'; then
    bad "copia do /opt/ucm morto ($copy_line)"
  elif echo "$copy_line" | grep -qF "rclone copy ${EXPECTED_BACKUP_DIR} "; then
    ok "copia do diretório derivado do script ($EXPECTED_BACKUP_DIR)"
  else
    bad "src inesperado na linha: $copy_line (esperado $EXPECTED_BACKUP_DIR)"
  fi
}

echo "== Teste 2: RETENÇÃO falha ALTO (sem || true engolindo) =="
{
  new_sandbox
  export BACKUP_DIR="$SB/backups"
  export REMOTE="faketest:"
  export FAKE_RCLONE_COPY_RC=0     # copia OK...
  export FAKE_RCLONE_DELETE_RC=1   # ...mas a poda de retenção FALHA
  run_offsite; rc=$?
  if [ "$rc" -ne 0 ]; then
    ok "falha da retenção propaga (exit=$rc)"
  else
    bad "retenção falhou mas o script saiu 0 (silêncio — o bug)"
  fi
  if grep -qiE 'retention|reten|ERROR' "$OFFSITE_LOG" 2>/dev/null; then
    ok "log registra o erro de retenção"
  else
    bad "erro de retenção não foi logado"
  fi
  unset FAKE_RCLONE_COPY_RC FAKE_RCLONE_DELETE_RC
}

echo "== Teste 3: caminho feliz (copy ok + delete ok) → exit 0 =="
{
  new_sandbox
  export BACKUP_DIR="$SB/backups"
  export REMOTE="faketest:"
  run_offsite; rc=$?
  [ "$rc" -eq 0 ] && ok "exit 0 no caminho feliz" || bad "exit $rc no caminho feliz"
  grep -q 'offsite end' "$OFFSITE_LOG" 2>/dev/null && ok "log tem 'offsite end'" || bad "sem 'offsite end' no log"
}

echo "== Teste 4: REMOTE vem do ENV (suporte a crypt, sem remote hardcoded) =="
{
  new_sandbox
  export BACKUP_DIR="$SB/backups"
  export REMOTE="b2crypt:"          # o remote que o religamento vai usar
  run_offsite
  if grep -qE '^rclone copy .* b2crypt:' "$RCLONE_LOG"; then
    ok "copy usou o REMOTE do env (b2crypt:)"
  else
    bad "copy NÃO usou b2crypt: (remote hardcoded?)"
  fi
  if grep -qE '^rclone delete b2crypt:' "$RCLONE_LOG"; then
    ok "delete (retenção) usou o mesmo REMOTE do env"
  else
    bad "delete não usou b2crypt:"
  fi
}

echo
echo "RESULTADO: ${PASS} passou, ${FAIL} falhou"
[ "$FAIL" -eq 0 ]
