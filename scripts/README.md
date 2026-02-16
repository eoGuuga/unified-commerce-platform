# Scripts de Desenvolvimento

Scripts uteis para desenvolvimento e testes do Unified Commerce Platform.

---

## Estrutura
- dev/ (scripts de desenvolvimento)
- ops/ (operacao e ambientes)
- test/ (testes e validacao)
- setup/ (setup e instalacao)
- seeds/ (seeds de dados)
- tools/site/ (extracao e processamento de conteudo)
- data/site/ (arquivos de entrada e saida de extracao)
- migrations/ (sql de migrations)
- LEGADO/ (historico e referencias antigas)

---

## Execucao recomendada

Execute os scripts a partir do diretorio `backend` para garantir acesso a `node_modules`.

```powershell
cd backend
npm.cmd run test:acid
npm.cmd run seed:mae
```

Se precisar rodar diretamente, use `npx ts-node` com `-r dotenv/config`.

---

## Teste de transacoes ACID

Arquivo: `scripts/test/test-acid-transactions.ts`

O que faz:
- Testa transacoes ACID com `FOR UPDATE` locks
- Valida prevencao de overselling
- Testa race conditions (2 pedidos simultaneos)
- Verifica se estoque e atualizado corretamente

Como executar:
```bash
cd backend
npm run test:acid
```

Ou diretamente:
```bash
npx ts-node scripts/test/test-acid-transactions.ts
```

Resultado esperado (exemplo):
```
Iniciando testes de transacoes ACID...
Conectado ao banco de dados
Produto criado
Estoque criado: 50 unidades
Pedido criado com sucesso
Estoque atualizado: 45 unidades
Overselling bloqueado corretamente
Race condition testada: 1 sucesso, 1 falha
TODOS OS TESTES PASSARAM
```

---

## Cadastro de Produtos da Mae

Arquivo: `scripts/seeds/seed-produtos-mae.ts`

O que faz:
- Cadastra produtos de confeitaria
- Cria categorias (Bolos, Doces, Salgados)
- Cadastra estoque inicial
- Prepara dados reais para testes

Como executar:
```bash
cd backend
npm run seed:mae
```

Ou diretamente:
```bash
npx ts-node scripts/seeds/seed-produtos-mae.ts
```

---

## Pre-requisitos

Antes de executar os scripts:

1. Docker rodando
```bash
docker ps
# Deve mostrar ucm-postgres e ucm-redis
```

2. Migration executada
Se estiver na raiz do repo:
```bash
docker exec -i ucm-postgres psql -U postgres -d ucm < scripts/migrations/001-initial-schema.sql
```
Se estiver no backend:
```bash
docker exec -i ucm-postgres psql -U postgres -d ucm < ../scripts/migrations/001-initial-schema.sql
```

3. Arquivo .env configurado
```bash
# backend/.env deve ter:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ucm
```

4. Dependencias instaladas
```bash
cd backend
npm install
```

---

## Troubleshooting

Erro: "Cannot connect to database"
Solucao:
- Verificar se Docker esta rodando: `docker ps`
- Verificar `DATABASE_URL` no `backend/.env`
- Testar conexao: `docker exec -it ucm-postgres psql -U postgres -d ucm -c "SELECT 1;"`

Erro: "Module not found"
Solucao:
```bash
cd backend
npm install
```

Erro: "ts-node not found"
Solucao:
```bash
cd backend
npm install -D ts-node typescript
```

---

## Notas

- Scripts sao idempotentes e podem ser executados multiplas vezes.
- Scripts de teste resetam dados de teste.
- Scripts de seed nao deletam dados, apenas atualizam existentes.
- Wrappers na raiz do repo mantem compatibilidade com execucao antiga.

---

Ultima atualizacao: 2026-02-16
