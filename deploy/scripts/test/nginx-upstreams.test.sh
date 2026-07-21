#!/usr/bin/env bash
# Testes ESTRUTURAIS dos upstreams do nginx (deploy/nginx/ucm.conf).
#
# POR QUE ESTE TESTE EXISTE (medido em prod, 20/jul):
#   O arquivo declarava `upstream ucm_frontend_test` e `upstream ucm_backend_test`
#   apontando pros containers da stack de TESTE (docker-compose.test.yml), que nao
#   rodam no host de producao. Como os upstreams usam `zone` + `resolve`, o nginx
#   resolve o hostname em BACKGROUND por conta propria — independentemente de
#   qualquer requisicao usar o upstream. Resultado: retry a cada 5s
#   (resolver_timeout), para sempre:
#
#     "ucm-backend-test could not be resolved (2: Server failure)"  x 42.294
#     ~24 erros/min, 99,7% do error_log de producao
#
#   O dano nao e carga (resolucao falha e barata) — e LEGIBILIDADE: o canal de
#   erro do nginx fica afogado, e um erro REAL de prod passa despercebido.
#
#   Eram residuo puro: ZERO `proxy_pass` os referenciava e nao existe server
#   block de teste (todos os server_name sao gtsofthub.com.br). Nao roteavam
#   nada nem se a stack de teste subisse.
#
# A TRAVA QUE IMPORTA (teste 2): os upstreams VIVOS precisam manter `resolve`.
# O fix do Dia D (passo 3.5 do deploy.sh) depende dele pra re-resolver o IP novo
# do backend depois do `up -d`. Remover `resolve` aqui quebraria aquele fix em
# silencio — por isso a limpeza vem com guarda.
#
# Rodar: bash deploy/scripts/test/nginx-upstreams.test.sh
set -uo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="${TEST_DIR}/../../nginx/ucm.conf"

PASS=0; FAIL=0
ok()  { echo "  ✅ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }

[ -f "$CONF" ] || { echo "ERRO: config nao encontrada em ${CONF}" >&2; exit 1; }

echo "== 1: nenhum upstream *_test orfao =="
{
  orphans="$(grep -cE '^[[:space:]]*upstream[[:space:]]+[a-z_]+_test[[:space:]]*\{' "$CONF")"
  if [ "${orphans:-0}" -eq 0 ]; then
    ok "nenhum bloco 'upstream *_test' (nada de resolver fantasma a cada 5s)"
  else
    bad "${orphans} bloco(s) 'upstream *_test' ainda presentes — o error_log volta a afogar"
  fi
}

echo "== 2: TRAVA — os upstreams VIVOS seguem com 'resolve' (o fix do Dia D depende) =="
{
  for up in ucm-frontend:3000 ucm-backend:3001; do
    host="${up%%:*}"
    if grep -qE "^[[:space:]]*server[[:space:]]+${host}:[0-9]+[[:space:]]+resolve[[:space:]]*;" "$CONF"; then
      ok "${host} presente COM 'resolve' (re-resolucao pos-deploy preservada)"
    else
      bad "${host} sem 'resolve' (ou ausente) — isto QUEBRA o passo 3.5 do deploy.sh"
    fi
  done
}

echo "== 3: os upstreams vivos mantem 'zone' (requisito do 'resolve' em upstream) =="
{
  for z in ucm_frontend ucm_backend; do
    if grep -qE "^[[:space:]]*zone[[:space:]]+${z}[[:space:]]+[0-9]+[km]?;" "$CONF"; then
      ok "zone ${z} presente"
    else
      bad "zone ${z} ausente — sem zone compartilhada o 'resolve' nao funciona"
    fi
  done
}

echo "== 4: nenhum proxy_pass aponta pra upstream *_test =="
{
  refs="$(grep -cE 'proxy_pass[[:space:]]+https?://[a-z_]+_test[;/]' "$CONF")"
  if [ "${refs:-0}" -eq 0 ]; then
    ok "nenhuma rota referencia upstream de teste (remocao nao muda roteamento)"
  else
    bad "${refs} proxy_pass apontam pra upstream *_test — remover MUDARIA rota"
  fi
}

echo "== 5: as rotas vivas continuam apontando pros upstreams vivos =="
{
  for target in ucm_backend ucm_frontend; do
    if grep -qE "proxy_pass[[:space:]]+http://${target};" "$CONF"; then
      ok "proxy_pass -> ${target} intacto"
    else
      bad "nenhum proxy_pass -> ${target} — o roteamento de prod mudou!"
    fi
  done
}

echo
echo "RESULTADO: ${PASS} passou, ${FAIL} falhou"
[ "$FAIL" -eq 0 ]
