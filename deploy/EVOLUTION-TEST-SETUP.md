# Evolution API - Setup para DEV/TESTE

Ultima atualizacao: 2026-03-21

## Objetivo
- Subir Evolution API no VPS para homologacao do WhatsApp da Loucas Por Brigadeiro.
- Usar numero pessoal de teste agora.
- Trocar para o numero oficial da loja so na fase final.

## Arquivos
- `deploy/docker-compose.evolution.test.yml`
- `deploy/evolution.test.env.example`
- `deploy/scripts/setup-evolution-test.sh`
- `deploy/scripts/configure-evolution-instance.sh`

## Passo a passo no VPS
1. No repo de dev/teste:
```bash
cd /opt/ucm-test-repo
cp deploy/evolution.test.env.example deploy/evolution.test.env
nano deploy/evolution.test.env
```

2. Subir a API:
```bash
cd /opt/ucm-test-repo
bash deploy/scripts/setup-evolution-test.sh
```

3. Configurar a instancia da Loucas:
```bash
cd /opt/ucm-test-repo
bash deploy/scripts/configure-evolution-instance.sh
```

4. Confirmar container:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep evolution
docker logs --tail 100 ucm-evolution-test
```

## Configuracao do backend de dev/teste
No arquivo `/opt/ucm-test-repo/deploy/.env`, configurar:

```env
WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=change-me-evolution
EVOLUTION_INSTANCE=loucas-teste
```

Depois recriar backend:

```bash
cd /opt/ucm-test-repo
docker compose --env-file ./deploy/.env -f ./deploy/docker-compose.test.yml --project-name ucmtest up -d backend
```

## Pareamento do numero de teste
- O script `deploy/scripts/configure-evolution-instance.sh` cria a instancia `loucas-teste` com webhook apontando para:
  - `https://dev.gtsofthub.com.br/api/v1/whatsapp/webhook?tenantId=00000000-0000-0000-0000-000000000000`
- Nesta fase, usar o numero pessoal de teste.
- Na fase final, trocar para o numero oficial da loja.
- O backend agora confia na `instance` do webhook (`loucas-teste`) para amarrar o tenant, em vez de depender do telefone do cliente.

## Acesso ao manager da Evolution
- A API fica exposta apenas no loopback do VPS:
  - `http://127.0.0.1:8081`
- Manager:
  - `http://127.0.0.1:8081/manager`
- Em MobaXterm, crie um tunel local `8081 -> 127.0.0.1:8081` pelo SSH do VPS.
- Depois abra no seu navegador local:
  - `http://127.0.0.1:8081/manager`
- A partir dali, escaneie o QR com o seu numero de teste.

## URL interna usada pelo backend
- `http://evolution-api:8080`

## Observacao
- O container do Evolution fica na rede `ucmtest_ucm-test-net`, junto do stack de dev/teste.
- O manager foi exposto apenas em `127.0.0.1:8081` para facilitar configuracao sem abrir porta publica.
