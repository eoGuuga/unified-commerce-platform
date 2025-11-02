# TESTE INICIAL DO BACKEND

## Setup Rápido

### 1. Criar arquivo .env

```bash
cd backend
cp .env.example .env
# Edite .env e coloque DATABASE_URL conforme abaixo
```

### 2. Configurar Database

**Opção A: Docker (Mais fácil)**
```bash
# Na raiz do projeto
docker-compose up -d postgres

# Aguardar 10 segundos para postgres iniciar
sleep 10

# Executar migration
docker exec -i ucm-postgres psql -U postgres -d ucm < ../scripts/migrations/001-initial-schema.sql
```

**Opção B: Supabase**
1. Criar projeto em supabase.com
2. Copiar DATABASE_URL para .env
3. Executar SQL no Supabase SQL Editor

### 3. Instalar Dependências

```bash
cd backend
npm install
```

### 4. Iniciar Backend

```bash
npm run start:dev
```

Deve iniciar em: http://localhost:3001/api/v1

---

## Testar Endpoints

### Health Check
```bash
curl http://localhost:3001/api/v1/health
```

Deve retornar:
```json
{
  "status": "ok",
  "timestamp": "2024-11-15T...",
  "service": "UCM Backend"
}
```

### Listar Produtos (vazio inicialmente)
```bash
curl http://localhost:3001/api/v1/products?tenantId=00000000-0000-0000-0000-000000000000
```

Deve retornar: `[]`

### Criar Produto
```bash
curl -X POST http://localhost:3001/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Brigadeiro Gourmet",
    "price": 10.50,
    "description": "Brigadeiro feito com chocolate premium",
    "unit": "unidade"
  }' \
  '?tenantId=00000000-0000-0000-0000-000000000000'
```

Deve retornar produto criado com ID.

---

## Próximos Passos

1. ✅ Backend rodando
2. ⏳ Testar endpoints de produtos
3. ⏳ Implementar módulo de vendas
4. ⏳ Implementar WhatsApp Bot

---

**Se der erro**: Verificar se PostgreSQL está rodando e DATABASE_URL está correto no .env
