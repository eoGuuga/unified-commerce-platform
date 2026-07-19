#!/usr/bin/env bash
# Testes ESTRUTURAIS do passo de refresh do nginx no deploy.sh.
#
# POR QUE ESTE TESTE EXISTE (a conta, medida no Ciclo 2 do Dia D):
#   TTL do DNS embutido do Docker .......... 600s  (medido: ucm-backend/-frontend)
#   Janela do health-loop do deploy.sh ..... 24 x 5s = 120s
#   => o TTL é 5x a janela. Quando o `up -d` recria o backend e o Docker lhe dá
#      um IP DIFERENTE, o nginx (upstream `resolve`) só re-resolveria depois de
#      até 10min — o health-check NUNCA passa dentro do próprio prazo e o script
#      declara "Deploy FALHOU" com o app 100% são. O dano real não é o 502 (o
#      watchdog recupera em 6s, provado 09/jul); é o SINAL FALSO levar a um
#      rollback desnecessário.
#
# O QUE DÁ PRA TESTAR SEM DEPLOY: a ESTRUTURA (o passo existe, na ordem certa, e
# não pode derrubar um deploy bom) + a ARITMÉTICA que justifica o passo. A troca
# real de IP e o health 200 com o fix só o Dia D observado prova.
#
# Rodar: bash deploy/scripts/test/deploy-nginx-refresh.test.sh
set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="${TEST_DIR}/../deploy.sh"

PASS=0; FAIL=0
ok()  { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }

line_of() { grep -nE "$1" "$DEPLOY" | head -1 | cut -d: -f1; }

echo "== 1: o passo de refresh do nginx EXISTE =="
{
  if grep -qE 'restart[[:space:]]+nginx' "$DEPLOY"; then
    ok "deploy.sh reinicia o nginx (força a re-resolução do upstream)"
  else
    bad "nenhum refresh de nginx no deploy.sh — o health-check fica cego ao IP novo"
  fi
}

echo "== 2: ORDEM — depois do 'up -d', antes do health-loop =="
{
  up_line="$(line_of '^docker compose .*up -d')"
  refresh_line="$(line_of 'restart[[:space:]]+nginx')"
  health_line="$(line_of 'for i in \$\(seq 1')"
  echo "     (up -d: L${up_line:-?} | refresh: L${refresh_line:-?} | health-loop: L${health_line:-?})"
  if [ -n "${refresh_line:-}" ] && [ -n "${up_line:-}" ] && [ -n "${health_line:-}" ] \
     && [ "$refresh_line" -gt "$up_line" ] && [ "$refresh_line" -lt "$health_line" ]; then
    ok "refresh na janela certa (o backend já subiu; o health ainda não começou)"
  else
    bad "refresh fora de ordem — precisa ficar ENTRE o up -d e o health-loop"
  fi
}

echo "== 3: NÃO pode derrubar um deploy bom (o fix não vira novo modo de falha) =="
{
  # O passo é um ENABLER de sinal correto, não um gate. Se o restart falhar, o
  # certo é avisar ALTO e deixar o health-loop (o árbitro real) decidir — mesma
  # convenção do próprio script no stop do watchdog (L69-70).
  ctx="$(grep -A2 -E 'restart[[:space:]]+nginx' "$DEPLOY")"
  if echo "$ctx" | grep -qE '\|\|[[:space:]]*echo'; then
    ok "falha do restart avisa ALTO e segue (health-loop é quem decide)"
  else
    bad "restart sem guarda: uma falha dele abortaria um deploy possivelmente bom"
  fi
  if echo "$ctx" | grep -qE '\|\|[[:space:]]*true[[:space:]]*$'; then
    bad "usou '|| true' — engole em SILÊNCIO (o padrão que já custou 5 semanas na frente do off-site)"
  else
    ok "não engole em silêncio (sem '|| true')"
  fi
}

echo "== 4: targeted — reinicia SÓ o nginx (não o banco, não o backend recém-subido) =="
{
  cmd="$(grep -E 'restart[[:space:]]+nginx' "$DEPLOY" | head -1)"
  if echo "$cmd" | grep -qE 'postgres|redis|--force-recreate'; then
    bad "restart largo demais (tocaria postgres/redis ou force-recreate cego): $cmd"
  else
    ok "restart targeted, só o nginx"
  fi
}

echo "== 5: a ARITMÉTICA que justifica o passo (guarda de premissa) =="
{
  # Se um dia a janela do health-loop passar do TTL (600s), o refresh vira
  # OPCIONAL — e este teste avisa que a premissa mudou.
  tries="$(grep -oE 'seq 1 [0-9]+' "$DEPLOY" | grep -oE '[0-9]+$' | head -1)"
  naps="$(grep -oE '^[[:space:]]*sleep [0-9]+' "$DEPLOY" | grep -oE '[0-9]+' | head -1)"
  window=$(( ${tries:-0} * ${naps:-0} ))
  echo "     (janela do health-loop: ${tries:-?} x ${naps:-?}s = ${window}s | TTL do DNS: 600s)"
  if [ "$window" -gt 0 ] && [ "$window" -lt 600 ]; then
    ok "janela (${window}s) < TTL (600s) → o refresh é NECESSÁRIO (premissa intacta)"
  else
    bad "premissa MUDOU (janela=${window}s vs TTL 600s) — reavaliar se o refresh ainda é preciso"
  fi
}

echo
echo "RESULTADO: ${PASS} passou, ${FAIL} falhou"
[ "$FAIL" -eq 0 ]
