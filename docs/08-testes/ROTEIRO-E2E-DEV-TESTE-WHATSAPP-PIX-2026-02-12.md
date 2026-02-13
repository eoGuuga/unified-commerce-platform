# Roteiro E2E DEV/TESTE - WhatsApp PIX - 2026-02-12

Objetivo: executar fluxo completo do WhatsApp no DEV/TESTE com comandos copiados/colados.

## 1) Health DEV/TESTE
```bash
curl -s https://dev.gtsofthub.com.br/api/v1/health
```

## 2) Fluxo WhatsApp (pedido -> dados -> confirmacao -> pix)
> Use sempre o mesmo phoneNumber.

```bash
# Pedido
curl -s -X POST https://dev.gtsofthub.com.br/api/v1/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"message":"quero 2 produto teste","tenantId":"00000000-0000-0000-0000-000000000000","phoneNumber":"+5511998887790"}'

# Nome
curl -s -X POST https://dev.gtsofthub.com.br/api/v1/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"message":"Joao Silva","tenantId":"00000000-0000-0000-0000-000000000000","phoneNumber":"+5511998887790"}'

# Entrega
curl -s -X POST https://dev.gtsofthub.com.br/api/v1/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"message":"1","tenantId":"00000000-0000-0000-0000-000000000000","phoneNumber":"+5511998887790"}'

# Endereco
curl -s -X POST https://dev.gtsofthub.com.br/api/v1/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"message":"Rua A, 123, Centro, Sao Paulo, SP, 01000-000","tenantId":"00000000-0000-0000-0000-000000000000","phoneNumber":"+5511998887790"}'

# Telefone
curl -s -X POST https://dev.gtsofthub.com.br/api/v1/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"message":"11999999999","tenantId":"00000000-0000-0000-0000-000000000000","phoneNumber":"+5511998887790"}'

# Observacoes
curl -s -X POST https://dev.gtsofthub.com.br/api/v1/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"message":"sem","tenantId":"00000000-0000-0000-0000-000000000000","phoneNumber":"+5511998887790"}'

# Confirmar
curl -s -X POST https://dev.gtsofthub.com.br/api/v1/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"message":"sim","tenantId":"00000000-0000-0000-0000-000000000000","phoneNumber":"+5511998887790"}'

# PIX
curl -s -X POST https://dev.gtsofthub.com.br/api/v1/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{"message":"pix","tenantId":"00000000-0000-0000-0000-000000000000","phoneNumber":"+5511998887790"}'
```

## 3) Buscar pagamento no banco
```bash
docker exec -i ucm-postgres-test psql -U postgres -d ucm -c \
"select p.id, p.status, p.method, p.pedido_id, pe.order_no \
 from pagamentos p \
 join pedidos pe on pe.id = p.pedido_id \
 where pe.order_no = 'PED-20260213-816B' \
 order by p.created_at desc limit 1;"
```

## 4) Gerar token (DEV)
```bash
TOKEN=$(curl -s -X POST https://dev.gtsofthub.com.br/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000000" \
  -d '{"email":"dev@gtsofthub.com.br","password":"dev123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

echo "$TOKEN"
```

## 5) Confirmar pagamento
```bash
curl -s -X POST https://dev.gtsofthub.com.br/api/v1/payments/e27fea30-22c7-4ea2-887d-604fd8750ea5/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000000"
```

## 6) Validar status final
```bash
docker exec -i ucm-postgres-test psql -U postgres -d ucm -c \
"select p.id, p.status, p.method, p.updated_at, pe.order_no, pe.status as pedido_status \
 from pagamentos p \
 join pedidos pe on pe.id = p.pedido_id \
 where pe.order_no = 'PED-20260213-816B' \
 order by p.updated_at desc limit 1;"
```
